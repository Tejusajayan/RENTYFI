import { 
  users, bankAccounts, categories, buildings, shops, tenants, transactions, transfers, rentPayments, tenantShops,
  type User, type InsertUser, type BankAccount, type InsertBankAccount,
  type Category, type InsertCategory, type Building, type InsertBuilding,
  type Shop, type InsertShop, type Tenant, type InsertTenant,
  type Transaction, type InsertTransaction, type Transfer, type InsertTransfer,
  type RentPayment, type InsertRentPayment
} from "@shared/schema";
import { db } from "./db";
import { eq, and, or, desc, sum, count, lt } from "drizzle-orm";

export interface IStorage {
  // User methods
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(insertUser: InsertUser): Promise<User>;
  
  // Dashboard methods
  getPersonalDashboardData(userId: number): Promise<any>;
  getPropertyDashboardData(userId: number): Promise<any>;
  
  // Bank Account methods
  getBankAccounts(userId: number): Promise<BankAccount[]>;
  createBankAccount(insertAccount: InsertBankAccount): Promise<BankAccount>;
  updateBankAccount(id: number, updates: Partial<BankAccount>): Promise<BankAccount>;
  deleteBankAccount(id: number): Promise<void>;
  
  // Category methods
  getCategories(userId: number, context?: string): Promise<Category[]>;
  createCategory(insertCategory: InsertCategory): Promise<Category>;
  deleteCategory(id: number, userId: number): Promise<void>; // <-- add this line
  updateCategory(id: number, userId: number, updates: Partial<Category>): Promise<Category>; // <-- add this line
  
  // Building methods
  getBuildings(userId: number): Promise<Building[]>;
  createBuilding(insertBuilding: InsertBuilding): Promise<Building>;
  deleteBuilding(id: number, userId: number): Promise<void>; // <-- add userId
  updateBuilding(id: number, userId: number, updates: Partial<Building>): Promise<Building>;

  // Shop methods
  getShops(userId: number, buildingId?: number): Promise<Shop[]>;
  createShop(insertShop: InsertShop): Promise<Shop>;
  deleteShop(id: number, userId: number): Promise<void>; // <-- add userId
  updateShop(id: number, userId: number, updates: Partial<Shop>): Promise<Shop>;
  
  // Tenant methods
  getTenants(userId: number): Promise<Tenant[]>;
  createTenant(insertTenant: InsertTenant): Promise<Tenant>;
  deleteTenant(id: number, userId: number): Promise<void>; // <-- add this line
  updateTenant(id: number, userId: number, updates: Partial<Tenant>): Promise<Tenant>; // <-- add this line
  
  // Transaction methods
  getTransactions(userId: number, context?: string, limit?: number): Promise<Transaction[]>;
  createTransaction(insertTransaction: InsertTransaction): Promise<Transaction>;
  deleteTransaction(id: number): Promise<void>;
  
  // Transfer methods
  getTransfers(userId: number): Promise<Transfer[]>;
  createTransfer(insertTransfer: InsertTransfer): Promise<Transfer>;
  deleteTransfer(id: number, userId: number): Promise<void>;
  
  // Rent Payment methods
  getRentPayments(userId: number): Promise<RentPayment[]>;
  createRentPayment(insertRentPayment: InsertRentPayment): Promise<RentPayment>;
  updateRentPayment(id: number, updates: Partial<RentPayment>): Promise<RentPayment>;
  updateRentPaymentAfterTransactionDelete(params: {
    userId: number;
    tenantId: number;
    shopId: number;
    month: number;
    year: number;
    amount: number;
  }): Promise<void>;
  deleteRentPayment(id: number, userId: number): Promise<void>; // <-- add this line
  
  // Backup methods
  getFullBackup(userId: number): Promise<any>;
}

export class DatabaseStorage implements IStorage {
  async deleteRentPayment(id: number, userId: number): Promise<void> {
    // Ensure the rent payment belongs to the user before deleting
    const [rentPayment] = await db.select().from(rentPayments).where(and(eq(rentPayments.id, id), eq(rentPayments.userId, userId)));
    if (!rentPayment) {
      throw new Error("Rent payment not found or not owned by user");
    }
    await db.delete(rentPayments).where(and(eq(rentPayments.id, id), eq(rentPayments.userId, userId)));
  }

  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }

  async getPersonalDashboardData(userId: number): Promise<any> {
    // Fetch all personal transactions (no date filter)
    let userTransactions = await db
      .select()
      .from(transactions)
      .where(and(eq(transactions.userId, userId), eq(transactions.context, 'personal')));

    const totalIncome = userTransactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + Number(t.amount), 0);
    
    const totalExpenses = userTransactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + Number(t.amount), 0);

    // Add property expenses to netSavings and savingsRate
    let propertyExpenses = 0;
    let propertyTransactions = await db
      .select()
      .from(transactions)
      .where(and(eq(transactions.userId, userId), eq(transactions.context, 'property')));
    propertyExpenses = propertyTransactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + Number(t.amount), 0);

    // --- Add: sum of all bank account initial balances (exclude chitfund/investment) ---
    const accounts = await db.select().from(bankAccounts).where(eq(bankAccounts.userId, userId));
    const totalInitialBalance = accounts
      .filter(acc =>
        acc.accountType !== 'chitfund' &&
        acc.accountType !== 'investment'
      )
      .reduce((sum, acc) => sum + Number(acc.initialBalance || 0), 0);

    return {
      totalIncome,
      totalExpenses,
      netSavings: totalIncome - totalExpenses - propertyExpenses + totalInitialBalance,
      savingsRate: totalIncome > 0
        ? ((totalIncome - totalExpenses - propertyExpenses + totalInitialBalance) / totalIncome) * 100
        : 0
    };
  }

  async getPropertyDashboardData(userId: number): Promise<any> {
    // Fetch all rent payments for this user (no date filter)
    const allRentPayments = await db
      .select()
      .from(rentPayments)
      .where(eq(rentPayments.userId, userId));

    // Get all shops and buildings for mapping
    const allShops = await db.select().from(shops).where(eq(shops.userId, userId));
    const allBuildings = await db.select().from(buildings).where(eq(buildings.userId, userId));

    // --- Calculate rent collection and pending by summing all payments for each shop (all-time) ---
    let totalIncome = 0;
    let pendingRent = 0;
    const buildingIncomeMap: Record<number, number> = {};

    // Only consider active shops
    const activeShops = allShops.filter(s => s.isActive);

    for (const shop of activeShops) {
      // Find all payments for this shop (all-time)
      const payments = allRentPayments.filter(
        p => p.shopId === shop.id
      );
      const totalPaid = payments.reduce((sum, p) => sum + Number(p.paidAmount ?? 0), 0);
      const shopRent = Number(shop.monthlyRent);

      // If shop is occupied, count its rent
      if (shop.isOccupied) {
        // Collected income is what is paid (up to shopRent per month, but sum all paid)
        const collected = totalPaid;
        // Add advance amount if paid and not already included
        let advanceIncome = 0;
        if (shop.isAdvancePaid && shop.advance && Number(shop.advance) > 0) {
          advanceIncome = Number(shop.advance);
        }
        // Add to totals
        totalIncome += collected + advanceIncome;

        // Map to building
        if (!buildingIncomeMap[shop.buildingId]) buildingIncomeMap[shop.buildingId] = 0;
        buildingIncomeMap[shop.buildingId] += collected + advanceIncome;
      }
    }

    // Calculate property expenses from transactions (all-time)
    const propertyExpenses = await db
      .select()
      .from(transactions)
      .where(and(eq(transactions.userId, userId), eq(transactions.context, 'property')));
    const totalExpenses = propertyExpenses
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + Number(t.amount), 0);

    // Calculate pendingRent as sum of all rentPayments with pendingAmount > 0, EXCLUDING current month
    pendingRent = 0;
    if (Array.isArray(allRentPayments)) {
      const now = new Date();
      const currentMonth = now.getMonth() + 1;
      const currentYear = now.getFullYear();
      pendingRent = allRentPayments.reduce(
        (sum, p) =>
          Number(p.pendingAmount) > 0 &&
          (p.year < currentYear || (p.year === currentYear && p.month < currentMonth))
            ? sum + Number(p.pendingAmount)
            : sum,
        0
      );
    }

    return {
      totalIncome,
      totalExpenses,
      netIncome: totalIncome - totalExpenses,
      pendingRent,
      buildingIncomeMap // for dashboard
    };
  }

  async getBankAccounts(userId: number): Promise<BankAccount[]> {
    return await db.select().from(bankAccounts).where(eq(bankAccounts.userId, userId));
  }

  async createBankAccount(insertAccount: InsertBankAccount): Promise<BankAccount> {
    // Ensure currentBalance is set to initialBalance as string with 2 decimals
    const initial = Number(insertAccount.initialBalance ?? 0);
    const [account] = await db
      .insert(bankAccounts)
      .values({ ...insertAccount, currentBalance: initial.toFixed(2) })
      .returning();
    return account;
  }

  async updateBankAccount(id: number, updates: Partial<BankAccount>): Promise<BankAccount> {
    const [account] = await db
      .update(bankAccounts)
      .set(updates)
      .where(eq(bankAccounts.id, id))
      .returning();
    return account;
  }

  async deleteBankAccount(id: number): Promise<void> {
    // Delete all transactions referencing this account
    await db.delete(transactions).where(eq(transactions.accountId, id));
    // Delete all transfers where this account is fromAccount or toAccount
    await db.delete(transfers).where(
      or(eq(transfers.fromAccountId, id), eq(transfers.toAccountId, id))
    );
    // Now delete the bank account itself
    await db.delete(bankAccounts).where(eq(bankAccounts.id, id));
  }

  async getCategories(userId: number, context?: string): Promise<Category[]> {
    if (context) {
      return await db.select().from(categories)
        .where(and(eq(categories.userId, userId), eq(categories.context, context)));
    }
    return await db.select().from(categories).where(eq(categories.userId, userId));
  }

  async createCategory(insertCategory: InsertCategory): Promise<Category> {
    const [category] = await db
      .insert(categories)
      .values(insertCategory)
      .returning();
    return category;
  }

  async deleteCategory(id: number, userId: number): Promise<void> {
    // Optionally, check if category belongs to user
    const [category] = await db.select().from(categories).where(and(eq(categories.id, id), eq(categories.userId, userId)));
    if (!category) {
      throw new Error("Category not found or not owned by user");
    }
    await db.delete(categories).where(and(eq(categories.id, id), eq(categories.userId, userId)));
  }

  async updateCategory(id: number, userId: number, updates: Partial<Category>): Promise<Category> {
    // Ensure the category belongs to the user
    const [category] = await db.select().from(categories).where(and(eq(categories.id, id), eq(categories.userId, userId)));
    if (!category) throw new Error("Category not owned by user or not found");
    const [updated] = await db
      .update(categories)
      .set(updates)
      .where(and(eq(categories.id, id), eq(categories.userId, userId)))
      .returning();
    return updated;
  }

  async getBuildings(userId: number): Promise<Building[]> {
    return await db.select().from(buildings).where(eq(buildings.userId, userId));
  }

  async createBuilding(insertBuilding: InsertBuilding): Promise<Building> {
    const [building] = await db
      .insert(buildings)
      .values(insertBuilding)
      .returning();
    return building;
  }

  async deleteBuilding(id: number, userId: number): Promise<void> {
    const buildingId = Number(id);
    // Check if building exists and belongs to user
    const [building] = await db.select().from(buildings).where(and(eq(buildings.id, buildingId), eq(buildings.userId, userId)));
    if (!building) {
      throw new Error("Building not found or not owned by user");
    }
    // Find all shops for this building and user
    const shopsToDelete = await db.select().from(shops).where(and(eq(shops.buildingId, buildingId), eq(shops.userId, userId)));
    if (shopsToDelete.length > 0) {
      for (const shop of shopsToDelete) {
        // Delete all rent_payments for this shop
        await db.delete(rentPayments).where(eq(rentPayments.shopId, shop.id));
        // Delete all tenant_shops for this shop
        await db.delete(tenantShops).where(eq(tenantShops.shopId, shop.id));
        // Set shopId to null in transactions for this shop
        await db.update(transactions).set({ shopId: null }).where(eq(transactions.shopId, shop.id));
      }
      // Delete all shops associated with this building and user
      await db.delete(shops).where(and(eq(shops.buildingId, buildingId), eq(shops.userId, userId)));
    }
    // Then delete the building (always attempt this)
    await db.delete(buildings).where(and(eq(buildings.id, buildingId), eq(buildings.userId, userId)));
  }

  async updateBuilding(id: number, userId: number, updates: Partial<Building>): Promise<Building> {
    const buildingId = Number(id);
    // Check if building exists and belongs to user
    const [building] = await db.select().from(buildings).where(and(eq(buildings.id, buildingId), eq(buildings.userId, userId)));
    if (!building) {
      throw new Error("Building not found or not owned by user");
    }
    const [updated] = await db
      .update(buildings)
      .set(updates)
      .where(and(eq(buildings.id, buildingId), eq(buildings.userId, userId)))
      .returning();
    return updated;
  }

  async getShops(userId: number, buildingId?: number): Promise<Shop[]> {
    if (buildingId) {
      return await db.select().from(shops)
        .where(and(eq(shops.userId, userId), eq(shops.buildingId, buildingId)));
    }
    return await db.select().from(shops).where(eq(shops.userId, userId));
  }

  async createShop(insertShop: InsertShop): Promise<Shop> {
    const values = { ...insertShop };
    // Accept both allocated_at and allocatedAt from payload, but always use allocated_at
    if ((values as any).allocatedAt && !values.allocated_at) {
      values.allocated_at = (values as any).allocatedAt;
    }
    // --- Robustly parse allocation date as date-only (no timezone shift) ---
    let allocationDate: Date | null = null;
    if (values.allocated_at) {
      if (typeof values.allocated_at === 'string') {
        const dateStr = values.allocated_at as string;
        if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
          const [year, month, day] = dateStr.split('-').map(Number);
          allocationDate = new Date(Date.UTC(year, month - 1, day)); // Use UTC
        } else {
          const parsed = new Date(dateStr);
          allocationDate = !isNaN(parsed.getTime()) ? parsed : null;
        }
      } else if (values.allocated_at instanceof Date) {
        allocationDate = !isNaN(values.allocated_at.getTime()) ? values.allocated_at : null;
      } else {
        allocationDate = null;
      }
    } else {
      allocationDate = null;
    }
    // Only set to now if tenantId is present and allocated_at is not set or invalid
    if (values.tenantId && !allocationDate) {
      allocationDate = new Date();
    }
    // Always set values.allocated_at to a Date object or undefined/null
    if (values.tenantId) {
      values.allocated_at = allocationDate ?? undefined;
    } else {
      values.allocated_at = undefined;
    }
    // Set isOccupied based on allocation
    if (values.tenantId) {
      const allocDate = allocationDate ? allocationDate : new Date();
      const now = new Date();
      values.isOccupied = allocDate <= now;
    } else {
      values.isOccupied = false;
    }
    // Remove allocatedAt camelCase if present
    delete (values as any).allocatedAt;
    const [shop] = await db
      .insert(shops)
      .values(values)
      .returning();

    // --- Auto-create missing rent_payments for allocated shops ---
    if (shop.tenantId && shop.allocated_at && new Date(shop.allocated_at) <= new Date()) {
      allocationDate = new Date(shop.allocated_at);
      let y = allocationDate.getFullYear();
      let m = allocationDate.getMonth() + 1;
      const now = new Date();
      let lastMonth = now.getMonth() + 1;
      let lastYear = now.getFullYear();
      if (now.getDate() === 1) {
        // On the 1st, only create up to previous month
        lastMonth = now.getMonth();
        if (lastMonth === 0) {
          lastMonth = 12;
          lastYear = now.getFullYear() - 1;
        }
      } else {
        // Any other day, only create up to previous month
        lastMonth = now.getMonth();
        if (lastMonth === 0) {
          lastMonth = 12;
          lastYear = now.getFullYear() - 1;
        }
      }
      while (y < lastYear || (y === lastYear && m <= lastMonth)) {
        const existing = await db.select().from(rentPayments).where(
          and(
            eq(rentPayments.userId, shop.userId),
            eq(rentPayments.tenantId, shop.tenantId),
            eq(rentPayments.shopId, shop.id),
            eq(rentPayments.month, m),
            eq(rentPayments.year, y)
          )
        );
        if (existing.length === 0) {
          await db.insert(rentPayments).values({
            userId: shop.userId,
            tenantId: shop.tenantId,
            shopId: shop.id,
            month: m,
            year: y,
            amount: shop.monthlyRent,
            paidAmount: "0.00",
            pendingAmount: shop.monthlyRent,
            status: "pending"
          });
        }
        m++;
        if (m > 12) {
          m = 1;
          y++;
        }
      }
    }
    return shop;
  }

  async updateShop(id: number, userId: number, updates: Partial<Shop>): Promise<Shop> {
    // Accept both allocatedAt and allocated_at, but always use allocated_at
    if ((updates as any).allocatedAt && !updates.allocated_at) {
      updates.allocated_at = (updates as any).allocatedAt;
    }
    let allocationDate: Date | null = null;
    if (updates.allocated_at) {
      if (typeof updates.allocated_at === "string") {
        const dateStr = updates.allocated_at as string;
        if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
          const [year, month, day] = dateStr.split('-').map(Number);
          allocationDate = new Date(Date.UTC(year, month - 1, day)); // Use UTC
        } else {
          const parsed = new Date(dateStr);
          allocationDate = !isNaN(parsed.getTime()) ? parsed : null;
        }
        updates.allocated_at = allocationDate && !isNaN(allocationDate.getTime()) ? allocationDate : null;
      } else {
        allocationDate = updates.allocated_at instanceof Date && !isNaN(updates.allocated_at.getTime())
          ? updates.allocated_at
          : null;
        updates.allocated_at = allocationDate;
      }
    } else if ((updates as any).allocatedAt) {
      allocationDate = typeof (updates as any).allocatedAt === "string"
        ? new Date((updates as any).allocatedAt)
        : (updates as any).allocatedAt;
      updates.allocated_at = allocationDate && !isNaN(allocationDate.getTime()) ? allocationDate : null;
    }
    if (updates.tenantId && !updates.allocated_at) {
      allocationDate = new Date();
      updates.allocated_at = allocationDate;
    }
    // If deallocating (tenantId is null/undefined), set allocated_at to null
    if (updates.tenantId === null || updates.tenantId === undefined) {
      updates.allocated_at = null;
      updates.isOccupied = false;
    } else if (updates.tenantId) {
      const allocDate = updates.allocated_at ? new Date(updates.allocated_at) : new Date();
      const now = new Date();
      updates.isOccupied = allocDate <= now;
    }
    // Remove allocatedAt camelCase if present
    delete (updates as any).allocatedAt;
    const [shop] = await db
      .update(shops)
      .set(updates)
      .where(and(eq(shops.id, id), eq(shops.userId, userId)))
      .returning();

    // --- ADDED: Recalculate rent payments if allocation date or tenantId changed ---
    // Only run if allocated_at or tenantId is present in updates
    if (
      ('allocated_at' in updates || 'tenantId' in updates) &&
      shop.tenantId &&
      shop.allocated_at &&
      new Date(shop.allocated_at) <= new Date()
    ) {
      const allocationDate = new Date(shop.allocated_at);
      const tenantId = shop.tenantId;
      const shopId = shop.id;
      const userId = shop.userId;

      // 1. Delete rent payments for this shop/tenant before the new allocation date
      await db.delete(rentPayments).where(
        and(
          eq(rentPayments.userId, userId),
          eq(rentPayments.tenantId, tenantId),
          eq(rentPayments.shopId, shopId),
          or(
            lt(rentPayments.year, allocationDate.getFullYear()),
            and(
              eq(rentPayments.year, allocationDate.getFullYear()),
              lt(rentPayments.month, allocationDate.getMonth() + 1)
            )
          )
        )
      );

      // 2. Recreate missing rent payments from allocation date up to previous month
      let y = allocationDate.getFullYear();
      let m = allocationDate.getMonth() + 1;
      const now = new Date();
      let lastMonth = now.getMonth();
      let lastYear = now.getFullYear();
      if (lastMonth === 0) {
        lastMonth = 12;
        lastYear = now.getFullYear() - 1;
      }
      while (y < lastYear || (y === lastYear && m <= lastMonth)) {
        const existing = await db.select().from(rentPayments).where(
          and(
            eq(rentPayments.userId, userId),
            eq(rentPayments.tenantId, tenantId),
            eq(rentPayments.shopId, shopId),
            eq(rentPayments.month, m),
            eq(rentPayments.year, y)
          )
        );
        if (existing.length === 0) {
          await db.insert(rentPayments).values({
            userId,
            tenantId,
            shopId,
            month: m,
            year: y,
            amount: shop.monthlyRent,
            paidAmount: "0.00",
            pendingAmount: shop.monthlyRent,
            status: "pending"
          });
        }
        m++;
        if (m > 12) {
          m = 1;
          y++;
        }
      }
    }
    return shop;
  }

  async deleteShop(id: number, userId: number): Promise<void> {
    const shopId = Number(id);
    // Check if shop exists and belongs to user
    const [shop] = await db.select().from(shops).where(and(eq(shops.id, shopId), eq(shops.userId, userId)));
    if (!shop) {
      throw new Error("Shop not found or not owned by user");
    }
    // Delete all rent_payments for this shop
    await db.delete(rentPayments).where(eq(rentPayments.shopId, shopId));
    // Delete all tenant_shops for this shop
    await db.delete(tenantShops).where(eq(tenantShops.shopId, shopId));
    // Set shopId to null in transactions for this shop
    await db.update(transactions).set({ shopId: null }).where(eq(transactions.shopId, shopId));
    // Now delete the shop
    await db.delete(shops).where(and(eq(shops.id, shopId), eq(shops.userId, userId)));
  }

  async getTenants(userId: number): Promise<Tenant[]> {
    return await db.select().from(tenants).where(eq(tenants.userId, userId));
  }

  async createTenant(insertTenant: InsertTenant): Promise<Tenant> {
    const [tenant] = await db
      .insert(tenants)
      .values(insertTenant)
      .returning();
    return tenant;
  }

  async deleteTenant(id: number, userId: number): Promise<void> {
    const tenantId = Number(id);
    // Check if tenant exists and belongs to user
    const [tenant] = await db.select().from(tenants).where(and(eq(tenants.id, tenantId), eq(tenants.userId, userId)));
    if (!tenant) {
      throw new Error("Tenant not found or not owned by user");
    }

    // Delete all rent_payments for this tenant
    await db.delete(rentPayments).where(eq(rentPayments.tenantId, tenantId));

    // Delete all tenant_shops for this tenant
    await db.delete(tenantShops).where(eq(tenantShops.tenantId, tenantId));

    // Set tenantId to null, allocated_at to null, and isAdvancePaid to false in shops for this tenant
    await db.update(shops)
      .set({ tenantId: null, isOccupied: false, allocated_at: null, isAdvancePaid: false })
      .where(eq(shops.tenantId, tenantId));

    // Set tenantId to null in transactions for this tenant
    await db.update(transactions).set({ tenantId: null }).where(eq(transactions.tenantId, tenantId));

    // Finally, delete the tenant
    await db.delete(tenants).where(and(eq(tenants.id, tenantId), eq(tenants.userId, userId)));
  }

  async updateTenant(id: number, userId: number, updates: Partial<Tenant>): Promise<Tenant> {
    // Only allow updating specific fields (including address)
    const allowedFields = ['name', 'phone', 'email', 'address', 'aadhaarNumber', 'isActive'];
    const filteredUpdates: Partial<Tenant> = {};
    for (const key of allowedFields) {
      if (key in updates) {
        // @ts-ignore
        filteredUpdates[key] = updates[key];
      }
    }
    // Ensure the tenant belongs to the user
    const [tenant] = await db.select().from(tenants).where(and(eq(tenants.id, id), eq(tenants.userId, userId)));
    if (!tenant) throw new Error("Tenant not owned by user or not found");
    const [updated] = await db
      .update(tenants)
      .set(filteredUpdates)
      .where(and(eq(tenants.id, id), eq(tenants.userId, userId)))
      .returning();
    return updated;
  }

  async getTransactions(userId: number, context?: string, limit?: number): Promise<Transaction[]> {
    let whereClause;
    if (context) {
      whereClause = and(eq(transactions.userId, userId), eq(transactions.context, context));
    } else {
      whereClause = eq(transactions.userId, userId);
    }

    let queryBuilder = db
      .select()
      .from(transactions)
      .where(whereClause)
      .orderBy(desc(transactions.transactionDate));

    if (limit) {
      return await queryBuilder.limit(limit);
    }
    return await queryBuilder;
  }

  async createTransaction(insertTransaction: InsertTransaction): Promise<Transaction> {
    // Start a transaction to ensure atomicity
    const transaction = await db.transaction(async (tx) => {
      // Ensure proper number handling
      const accountId = Number(insertTransaction.accountId);
      const amount = Number(insertTransaction.amount);

      // Get the current account balance FIRST
      const [account] = await tx
        .select()
        .from(bankAccounts)
        .where(eq(bankAccounts.id, accountId));

      if (!account) {
        throw new Error("Account not found");
      }

      // Calculate new balance based on transaction type
      const currentBalance = Number(account.currentBalance);
      let newBalance = currentBalance;
      
      if (insertTransaction.type === 'income') {
        newBalance = currentBalance + amount;
      } else if (insertTransaction.type === 'expense') {
        newBalance = currentBalance - amount;
      } else {
        throw new Error("Invalid transaction type");
      }

      // Update account balance BEFORE creating transaction
      await tx
        .update(bankAccounts)
        .set({ currentBalance: newBalance.toFixed(2) })
        .where(eq(bankAccounts.id, accountId));

      // Create the transaction record
      const [newTransaction] = await tx
        .insert(transactions)
        .values({
          ...insertTransaction,
          amount: amount.toFixed(2),
          // transactionDate and createdAt are passed as system time from client
        })
        .returning();

      return newTransaction;
    });

    return transaction;
  }

  async deleteTransaction(id: number): Promise<void> {
    await db.transaction(async (tx) => {
      // Get transaction before delete
      const [transaction] = await tx
        .select()
        .from(transactions)
        .where(eq(transactions.id, id));

      if (!transaction) {
        throw new Error("Transaction not found");
      }

      // Get current account balance
      if (transaction.accountId == null) {
        throw new Error("Transaction does not have a valid accountId");
      }
      const [account] = await tx
        .select()
        .from(bankAccounts)
        .where(eq(bankAccounts.id, transaction.accountId));

      if (!account) {
        throw new Error("Account not found");
      }

      // Calculate new balance
      const currentBalance = Number(account.currentBalance);
      const amount = Number(transaction.amount);
      let newBalance = currentBalance;

      // Reverse the original transaction effect
      if (transaction.type === 'income') {
        newBalance = currentBalance - amount;
      } else if (transaction.type === 'expense') {
        newBalance = currentBalance + amount;
      }

      // Update account balance
      await tx
        .update(bankAccounts)
        .set({ currentBalance: newBalance.toFixed(2) })
        .where(eq(bankAccounts.id, transaction.accountId));

      // Delete the transaction
      await tx
        .delete(transactions)
        .where(eq(transactions.id, id));
    });
  }

  async getTransfers(userId: number): Promise<Transfer[]> {
    return await db.select().from(transfers)
      .where(eq(transfers.userId, userId))
      .orderBy(desc(transfers.transferDate));
  }

  async createTransfer(insertTransfer: InsertTransfer): Promise<Transfer> {
    // Start a transaction to ensure atomicity
    const transfer = await db.transaction(async (tx) => {
      const fromAccountId = Number(insertTransfer.fromAccountId);
      const toAccountId = Number(insertTransfer.toAccountId);
      const amount = Number(insertTransfer.amount);

      // Convert transferDate to Date if it's a string
      let transferDate = insertTransfer.transferDate;
      if (transferDate && typeof transferDate === "string") {
        transferDate = new Date(transferDate);
      }

      // Get both accounts
      const [fromAccount] = await tx.select().from(bankAccounts).where(eq(bankAccounts.id, fromAccountId));
      const [toAccount] = await tx.select().from(bankAccounts).where(eq(bankAccounts.id, toAccountId));

      if (!fromAccount || !toAccount) {
        throw new Error("One or both accounts not found");
      }

      // Check if fromAccount has enough balance
      if (Number(fromAccount.currentBalance) < amount) {
        throw new Error("Insufficient balance in the source account");
      }

      // Update balances
      const newFromBalance = Number(fromAccount.currentBalance) - amount;
      const newToBalance = Number(toAccount.currentBalance) + amount;

      await tx.update(bankAccounts)
        .set({ currentBalance: newFromBalance.toFixed(2) })
        .where(eq(bankAccounts.id, fromAccountId));

      await tx.update(bankAccounts)
        .set({ currentBalance: newToBalance.toFixed(2) })
        .where(eq(bankAccounts.id, toAccount.id)); // <-- fix here

      // Insert transfer record
      const [createdTransfer] = await tx
        .insert(transfers)
        .values({
          ...insertTransfer,
          transferDate, // always a Date object or undefined
          // --- Ensure id is NOT set here ---
        })
        .returning();

      return createdTransfer;
    });

    return transfer;
  }

  async deleteTransfer(id: number, userId: number): Promise<void> {
    // Get the transfer to delete
    const [transfer] = await db.select().from(transfers).where(eq(transfers.id, id));
    if (!transfer) {
      throw new Error("Transfer not found");
    }
    if (transfer.userId !== userId) {
      throw new Error("Unauthorized to delete this transfer");
    }

    // Revert transfer effect on accounts
    if (
      transfer.fromAccountId &&
      transfer.toAccountId &&
      transfer.amount
    ) {
      const [fromAccount] = await db.select().from(bankAccounts).where(eq(bankAccounts.id, transfer.fromAccountId));
      const [toAccount] = await db.select().from(bankAccounts).where(eq(bankAccounts.id, transfer.toAccountId));
      if (fromAccount && toAccount) {
        let newFromBalance = parseFloat(fromAccount.currentBalance ?? "0");
        let newToBalance = parseFloat(toAccount.currentBalance ?? "0");
        const amount = parseFloat(transfer.amount ?? "0");

        // Revert the transfer: add back to fromAccount, subtract from toAccount
        newFromBalance += amount;
        newToBalance -= amount;

        await db.update(bankAccounts)
          .set({ currentBalance: newFromBalance.toFixed(2) })
          .where(eq(bankAccounts.id, transfer.fromAccountId));
        await db.update(bankAccounts)
          .set({ currentBalance: newToBalance.toFixed(2) })
          .where(eq(bankAccounts.id, transfer.toAccountId));
      }
    }

    // Delete the transfer record
    const result = await db.delete(transfers).where(eq(transfers.id, id));
    // Optionally, check if a row was deleted (for extra safety)
    // If using a DB that returns affected rows, you can check here
  }

  async getRentPayments(userId: number): Promise<RentPayment[]> {
    return await db.select().from(rentPayments).where(eq(rentPayments.userId, userId));
  }

  async createRentPayment(insertRentPayment: InsertRentPayment): Promise<RentPayment> {
    // Only include paymentDate if present and valid
    const data: any = {
      ...insertRentPayment,
      amount: insertRentPayment.amount?.toString?.() ?? "",
      paidAmount: insertRentPayment.paidAmount?.toString?.() ?? "",
      pendingAmount: insertRentPayment.pendingAmount?.toString?.() ?? "",
    };
    // Only set paymentDate if it's a valid Date
    if (insertRentPayment.paymentDate instanceof Date && !isNaN(insertRentPayment.paymentDate.getTime())) {
      data.paymentDate = insertRentPayment.paymentDate;
    } else {
      delete data.paymentDate;
    }
    const [rentPayment] = await db
      .insert(rentPayments)
      .values(data)
      .returning();
    return rentPayment;
  }

  async updateRentPayment(id: number, updates: Partial<RentPayment>): Promise<RentPayment> {
    const [rentPayment] = await db
      .update(rentPayments)
      .set(updates)
      .where(eq(rentPayments.id, id))
      .returning();
    return rentPayment;
  }

  // Add upsertRentPayment method
  async upsertRentPayment(data: any): Promise<RentPayment> {
    // Find existing rent payment for this period
    const existing = await db.select().from(rentPayments).where(
      and(
        eq(rentPayments.userId, data.userId),
        eq(rentPayments.tenantId, data.tenantId),
        eq(rentPayments.shopId, data.shopId),
        eq(rentPayments.month, data.month),
        eq(rentPayments.year, data.year)
      )
    );
    if (existing.length > 0) {
      // Update existing: increment paidAmount, recalc pendingAmount/status, update paymentDate
      const prev = existing[0];
      const prevPaid = Number(prev.paidAmount ?? 0);
      const newPaid = prevPaid + Number(data.paidAmount ?? 0);
      const amount = Number(data.amount ?? prev.amount ?? 0);
      const pending = Math.max(amount - newPaid, 0);
      const status = pending === 0 ? "paid" : "pending";
      const paymentDate = data.paymentDate ?? new Date();
      const [updated] = await db
        .update(rentPayments)
        .set({
          paidAmount: newPaid.toFixed(2),
          pendingAmount: pending.toFixed(2),
          status,
          paymentDate,
          notes: data.notes ?? prev.notes,
        })
        .where(eq(rentPayments.id, prev.id))
        .returning();
      return updated;
    } else {
      // Insert new
      const [created] = await db
        .insert(rentPayments)
        .values({
          ...data,
          paidAmount: Number(data.paidAmount ?? 0).toFixed(2),
          pendingAmount: Number(data.pendingAmount ?? 0).toFixed(2),
          status: data.status ?? (Number(data.pendingAmount ?? 0) === 0 ? "paid" : "pending"),
        })
        .returning();
      return created;
    }
  }

  // Implements IStorage: updateRentPaymentAfterTransactionDelete
  async updateRentPaymentAfterTransactionDelete(params: {
    userId: number;
    tenantId: number;
    shopId: number;
    month: number;
    year: number;
    amount: number;
  }): Promise<void> {
    // Find the rent payment for this period
    const existing = await db.select().from(rentPayments).where(
      and(
        eq(rentPayments.userId, params.userId),
        eq(rentPayments.tenantId, params.tenantId),
        eq(rentPayments.shopId, params.shopId),
        eq(rentPayments.month, params.month),
        eq(rentPayments.year, params.year)
      )
    );
    if (existing.length > 0) {
      const rent = existing[0];
      const prevPaid = Number(rent.paidAmount ?? 0);
      const newPaid = Math.max(prevPaid - Number(params.amount ?? 0), 0);
      const amount = Number(rent.amount ?? 0);
      const pending = Math.max(amount - newPaid, 0);
      const status = pending === 0 ? "paid" : "pending";
      await db
        .update(rentPayments)
        .set({
          paidAmount: newPaid.toFixed(2),
          pendingAmount: pending.toFixed(2),
          status,
        })
        .where(eq(rentPayments.id, rent.id));
    }
  }

  async getFullBackup(userId: number): Promise<any> {
    // Example: return all user-related data
    const [
      user,
      accounts,
      cats,
      builds,
      shps,
      tnts,
      txs,
      trs,
      rents
    ] = await Promise.all([
      db.select().from(users).where(eq(users.id, userId)),
      db.select().from(bankAccounts).where(eq(bankAccounts.userId, userId)),
      db.select().from(categories).where(eq(categories.userId, userId)),
      db.select().from(buildings).where(eq(buildings.userId, userId)),
      db.select().from(shops).where(eq(shops.userId, userId)),
      db.select().from(tenants).where(eq(tenants.userId, userId)),
      db.select().from(transactions).where(eq(transactions.userId, userId)),
      db.select().from(transfers).where(eq(transfers.userId, userId)),
      db.select().from(rentPayments).where(eq(rentPayments.userId, userId)),
    ]);
    return {
      user,
      accounts, // <-- changed from bankAccounts to accounts
      categories: cats,
      buildings: builds,
      shops: shps,
      tenants: tnts,
      transactions: txs,
      transfers: trs,
      rentPayments: rents,
    };
  }

  // Wipe all user-related data (except user record itself)
  async deleteAllUserData(userId: number): Promise<void> {
    // Delete in order to avoid FK constraint errors
    await db.delete(rentPayments).where(eq(rentPayments.userId, userId));
    await db.delete(transfers).where(eq(transfers.userId, userId));
    await db.delete(transactions).where(eq(transactions.userId, userId));
    await db.delete(tenantShops);
    await db.delete(shops).where(eq(shops.userId, userId));
    await db.delete(buildings).where(eq(buildings.userId, userId));
    await db.delete(tenants).where(eq(tenants.userId, userId));
    await db.delete(categories).where(eq(categories.userId, userId));
    await db.delete(bankAccounts).where(eq(bankAccounts.userId, userId));
  }

  // Add new validation method
  async validateBackupData(backup: any): Promise<void> {
    const requiredArrays = [
      "accounts",
      "categories",
      "buildings",
      "shops",
      "tenants",
      "transactions",
      "transfers",
      "rentPayments"
    ];

    // Check if backup has all required arrays
    for (const key of requiredArrays) {
      if (!Array.isArray(backup[key])) {
        throw new Error(`Invalid backup: missing or invalid '${key}' array`);
      }
    }

    // Additional validation for required properties in each array
    const validateRequired = (obj: any, props: string[], context: string) => {
      for (const prop of props) {
        if (obj[prop] === undefined || obj[prop] === null) {
          throw new Error(`Invalid backup: missing required property '${prop}' in ${context}`);
        }
      }
    };

    // Validate each array's contents
    backup.accounts?.forEach((acc: any) => validateRequired(acc, ['name', 'accountType'], 'account'));
    backup.categories?.forEach((cat: any) => validateRequired(cat, ['name', 'type'], 'category'));
    backup.buildings?.forEach((bld: any) => validateRequired(bld, ['name'], 'building'));
    backup.shops?.forEach((shop: any) => validateRequired(shop, ['name', 'buildingId'], 'shop'));
    backup.tenants?.forEach((tenant: any) => validateRequired(tenant, ['name'], 'tenant'));
    backup.transactions?.forEach((tx: any) => validateRequired(tx, ['type', 'amount'], 'transaction'));
    backup.transfers?.forEach((tr: any) => validateRequired(tr, ['amount', 'fromAccountId', 'toAccountId'], 'transfer'));
    backup.rentPayments?.forEach((rent: any) => validateRequired(rent, ['amount', 'shopId', 'tenantId'], 'rent payment'));

    // Validate date fields
    const dateFields = {
      transactions: ["transactionDate"],
      transfers: ["transferDate"],
      rentPayments: ["paymentDate"]
    };

    for (const [table, fields] of Object.entries(dateFields)) {
      for (const record of (backup[table] || [])) {
        for (const field of fields) {
          if (record[field]) {
            const date = new Date(record[field]);
            if (isNaN(date.getTime())) {
              throw new Error(`Invalid date in ${table}.${field}`);
            }
          }
        }
      }
    }
  }

  // Import backup data for user
  // (removed duplicate implementation; see the patched version below)

  // --- Add this helper method ---
  async recalculateAllPendingRents(userId: number): Promise<void> {
    // Get all rent payments for this user
    const allRentPayments = await db.select().from(rentPayments).where(eq(rentPayments.userId, userId));
    // Group by tenantId, shopId, month, year
    const grouped: Record<string, { payments: any[]; amount: number }> = {};
    for (const p of allRentPayments) {
      const key = `${p.tenantId}-${p.shopId}-${p.month}-${p.year}`;
      if (!grouped[key]) {
        // Use the amount stored in the rent payment record for that month
        grouped[key] = { payments: [], amount: Number(p.amount) };
      }
      grouped[key].payments.push(p);
    }
    // For each group, sum paidAmount and update all records' pendingAmount
    for (const key in grouped) {
      const { payments, amount } = grouped[key];
      const totalPaid = payments.reduce((sum, p) => sum + Number(p.paidAmount ?? 0), 0);
      // Always use the amount stored in the rent payment record for that month
      const pending = Math.max(amount - totalPaid, 0);
      for (const p of payments) {
        await db.update(rentPayments)
          .set({ pendingAmount: pending.toFixed(2), status: pending === 0 ? "paid" : "pending" })
          .where(eq(rentPayments.id, p.id));
      }
    }
  }

  // --- Patch importBackupData to recalculate pending rents after import ---
  async importBackupData(userId: number, backup: any): Promise<void> {
    // Helper to parse date fields
    function parseDateField(val: any) {
      if (!val) return undefined;
      if (val instanceof Date) return val;
      const d = new Date(val);
      return isNaN(d.getTime()) ? undefined : d;
    }

    // --- Insert with original IDs to preserve references ---
    if (Array.isArray(backup.accounts) && backup.accounts.length > 0) {
      await db.insert(bankAccounts).values(
        backup.accounts.map((a: any) => ({
          ...a,
          userId,
          createdAt: parseDateField(a.createdAt),
          id: a.id, // preserve original id
        }))
      );
    }
    if (Array.isArray(backup.categories) && backup.categories.length > 0) {
      await db.insert(categories).values(
        backup.categories.map((c: any) => ({
          ...c,
          userId,
          createdAt: parseDateField(c.createdAt),
          id: c.id, // preserve original id
        }))
      );
    }
    if (Array.isArray(backup.buildings) && backup.buildings.length > 0) {
      await db.insert(buildings).values(
        backup.buildings.map((b: any) => ({
          ...b,
          userId,
          createdAt: parseDateField(b.createdAt),
          id: b.id, // preserve original id
        }))
      );
    }
    // --- Insert tenants BEFORE shops to satisfy FK constraint ---
    if (Array.isArray(backup.tenants) && backup.tenants.length > 0) {
      await db.insert(tenants).values(
        backup.tenants.map((t: any) => ({
          ...t,
          userId,
          createdAt: parseDateField(t.createdAt),
          id: t.id, // preserve original id
        }))
      );
    }
    if (Array.isArray(backup.shops) && backup.shops.length > 0) {
      await db.insert(shops).values(
        backup.shops.map((s: any) => ({
          ...s,
          userId,
          allocated_at: parseDateField(s.allocated_at),
          createdAt: parseDateField(s.createdAt),
          id: s.id, // preserve original id
        }))
      );
    }
    if (Array.isArray(backup.transactions) && backup.transactions.length > 0) {
      await db.insert(transactions).values(
        backup.transactions.map((tx: any) => ({
          ...tx,
          userId,
          transactionDate: parseDateField(tx.transactionDate),
          createdAt: parseDateField(tx.createdAt),
          id: tx.id, // preserve original id
        }))
      );
    }
    if (Array.isArray(backup.transfers) && backup.transfers.length > 0) {
      await db.insert(transfers).values(
        backup.transfers.map((tr: any) => ({
          ...tr,
          userId,
          transferDate: parseDateField(tr.transferDate),
          createdAt: parseDateField(tr.createdAt),
          id: tr.id, // preserve original id
        }))
      );
    }
    if (Array.isArray(backup.rentPayments) && backup.rentPayments.length > 0) {
      await db.insert(rentPayments).values(
        backup.rentPayments.map((rp: any) => ({
          ...rp,
          userId,
          paymentDate: parseDateField(rp.paymentDate),
          createdAt: parseDateField(rp.createdAt),
          id: rp.id, // preserve original id
        }))
      );
    }
    // After import, recalculate all pending rents for this user
    await this.recalculateAllPendingRents(userId);

    // --- Reset all PK sequences to avoid duplicate key errors ---
    await this.resetAllSequences();
  }

  /**
   * Resets all serial primary key sequences to max(id)+1 for all tables after manual inserts.
   */
  async resetAllSequences() {
    // List of tables and their PK columns
    const tables = [
      { table: 'users', column: 'id' },
      { table: 'bank_accounts', column: 'id' },
      { table: 'categories', column: 'id' },
      { table: 'buildings', column: 'id' },
      { table: 'tenants', column: 'id' },
      { table: 'shops', column: 'id' },
      { table: 'tenant_shops', column: 'id' },
      { table: 'transactions', column: 'id' },
      { table: 'transfers', column: 'id' },
      { table: 'rent_payments', column: 'id' },
    ];
    for (const { table, column } of tables) {
      try {
        await db.execute(
          `SELECT setval(pg_get_serial_sequence('${table}', '${column}'), COALESCE((SELECT MAX(${column}) FROM ${table}), 0) + 1, false);`
        );
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error(`Failed to reset sequence for ${table}:`, e);
      }
    }
  }
  // --- Add this method to auto-create pending rent records for all allocated shops ---
  async createMissingRentPaymentsForAllocatedShops() {
    // Get all shops with tenantId and allocated_at in the past or today
    const allShops = await db.select().from(shops).where(eq(shops.id, shops.id));
    const now = new Date();
    let currentYear = now.getFullYear();
    let currentMonth = now.getMonth() + 1;
    // Move back to previous month
    let lastYear = currentYear;
    let lastMonth = currentMonth - 1;
    if (lastMonth === 0) {
      lastMonth = 12;
      lastYear = currentYear - 1;
    }
    for (const shop of allShops) {
      if (!shop.tenantId || !shop.allocated_at) continue;
      const allocDate = new Date(shop.allocated_at);
      if (isNaN(allocDate.getTime()) || allocDate > now) continue;
      let y = allocDate.getFullYear();
      let m = allocDate.getMonth() + 1;
      // Only create up to previous month (lastYear, lastMonth)
      while (y < lastYear || (y === lastYear && m <= lastMonth)) {
        // Check if rent_payment exists for this shop/tenant/month/year
        const existing = await db.select().from(rentPayments).where(
          and(
            eq(rentPayments.userId, shop.userId),
            eq(rentPayments.tenantId, shop.tenantId),
            eq(rentPayments.shopId, shop.id),
            eq(rentPayments.month, m),
            eq(rentPayments.year, y)
          )
        );
        if (existing.length === 0) {
          await db.insert(rentPayments).values({
            userId: shop.userId,
            tenantId: shop.tenantId,
            shopId: shop.id,
            month: m,
            year: y,
            amount: shop.monthlyRent,
            paidAmount: "0.00",
            pendingAmount: shop.monthlyRent,
            status: "pending"
          });
        }
        m++;
        if (m > 12) {
          m = 1;
          y++;
        }
      }
    }
  }
}


// --- Add background job to auto-create pending rent records ---
async function startRentPaymentScheduler() {
  const storage = new DatabaseStorage();
  // Run once on startup
  await storage.createMissingRentPaymentsForAllocatedShops();
  // As a safety net, reset all sequences on startup
  await storage.resetAllSequences();
  // Then run every day at midnight (or every hour for demo)
  setInterval(async () => {
    try {
      await storage.createMissingRentPaymentsForAllocatedShops();
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error("Error in rent payment scheduler:", e);
    }
  }, 1000 * 60 * 60 * 24); // every 24 hours
}
startRentPaymentScheduler().catch(console.error);

export const storage = new DatabaseStorage();

export function getUserByUsername(username: string) {
    return storage.getUserByUsername(username);
}

export function getUser(id: number) {
    return storage.getUser(id);
}

export function createUser(arg0: { password: string; username: string; }) {
    return storage.createUser(arg0);
}

export function getPersonalDashboardData(arg0: number) {
    return storage.getPersonalDashboardData(arg0);
}

export function getPropertyDashboardData(arg0: number) {
    return storage.getPropertyDashboardData(arg0);
}

export function getBankAccounts(arg0: number) {
    return storage.getBankAccounts(arg0);
}

export function createBankAccount(accountData: { name: string; userId: number; accountNumber: string; accountType: string; initialBalance?: string | null | undefined; isActive?: boolean | null | undefined; }) {
    return storage.createBankAccount(accountData);
}

export function updateBankAccount(id: number, body: any) {
    return storage.updateBankAccount(id, body);
}

export function deleteBankAccount(id: number) {
    return storage.deleteBankAccount(id);
}

export function getCategories(arg0: number, arg1: string) {
    return storage.getCategories(arg0, arg1);
}

export function createCategory(categoryData: { name: string; type: string; userId: number; context: string; isActive?: boolean | null | undefined; color?: string | null | undefined; }) {
    return storage.createCategory(categoryData);
}

export function deleteCategory(id: number, userId: number) {
  return storage.deleteCategory(id, userId);
}

export function updateCategory(id: number, userId: number, body: any) {
  return storage.updateCategory(id, userId, body);
}

export function getBuildings(arg0: number) {
    return storage.getBuildings(arg0);
}

export function createBuilding(buildingData: { name: string; userId: number; isActive?: boolean | null | undefined; address?: string | null | undefined; totalShops?: number | null | undefined; }) {
    return storage.createBuilding(buildingData);
}

// updateBuilding, updateShop, deleteTenant, deleteShop, deleteBuilding already delegate to storage

export function getShops(arg0: number, arg1: number | undefined) {
    return storage.getShops(arg0, arg1);
}

export function createShop(shopData: { userId: number; buildingId: number; shopNumber: string; monthlyRent: string; name?: string | null | undefined; isActive?: boolean | null | undefined; advance?: string | null | undefined; isOccupied?: boolean | null | undefined; }) {
    return storage.createShop(shopData);
}

export function getTenants(arg0: number) {
    return storage.getTenants(arg0);
}

export function createTenant(tenantData: { name: string; userId: number; isActive?: boolean | null | undefined; address?: string | null | undefined; phone?: string | null | undefined; email?: string | null | undefined; aadhaarNumber?: string | null | undefined; }) {
    return storage.createTenant(tenantData);
}

export function deleteTenant(id: number, userId: number) {
  return storage.deleteTenant(id, userId);
}

export function updateTenant(id: number, userId: number, body: any) {
  return storage.updateTenant(id, userId, body);
}

export function getTransactions(arg0: number, arg1: string, limitNum: number | undefined) {
    return storage.getTransactions(arg0, arg1, limitNum);
}

export function createTransaction(transactionData: { type: string; userId: number; context: string; accountId: number; description: string; amount: string; categoryId?: number | null | undefined; tenantId?: number | null | undefined; shopId?: number | null | undefined; transactionDate?: Date | null | undefined; notes?: string | null | undefined; }) {
    // Ensure transactionDate is Date or undefined (not null)
    const { transactionDate, ...rest } = transactionData;
    return storage.createTransaction({
        ...rest,
        transactionDate: transactionDate ?? undefined
    });
}

export function deleteTransaction(id: number) {
    return storage.deleteTransaction(id);
}

export function getTransfers(arg0: number) {
    return storage.getTransfers(arg0);
}

export function createTransfer(transferData: { userId: number; amount: string; fromAccountId: number; toAccountId: number; description?: string | null | undefined; transferDate?: Date | null | undefined; }) {
    // Ensure transferDate is Date or undefined (never null)
    const { transferDate, ...rest } = transferData;
    return storage.createTransfer({
        ...rest,
        transferDate: transferDate ?? undefined
    });
}

export function getRentPayments(arg0: number) {
    return storage.getRentPayments(arg0);
}

export function createRentPayment(rentPaymentData: { userId: number; tenantId: number; shopId: number; amount: string; year: number; month: number; status?: string | null | undefined; notes?: string | null | undefined; paymentDate?: Date | null | undefined; }) {
    // Ensure paymentDate is Date or undefined (never null)
    const { paymentDate, ...rest } = rentPaymentData;
    return storage.createRentPayment({
        ...rest,
        paymentDate: paymentDate ?? undefined
    });
}

export function updateRentPayment(id: number, body: any) {
    return storage.updateRentPayment(id, body);
}



export function deleteShop(id: number, userId: number) {
    return storage.deleteShop(id, userId);
}

export function deleteBuilding(id: number, userId: number) {
    return storage.deleteBuilding(id, userId);
}
