import { pgTable, text, serial, integer, boolean, timestamp, decimal, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Users Table
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Bank Accounts Table
export const bankAccounts = pgTable("bank_accounts", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  name: text("name").notNull(),
  accountNumber: text("account_number").notNull(),
  accountType: text("account_type").notNull(), // 'savings', 'current', 'credit_card'
  initialBalance: decimal("initial_balance", { precision: 12, scale: 2 }).default("0"),
  currentBalance: decimal("current_balance", { precision: 12, scale: 2 }).default("0"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// Categories Table
export const categories = pgTable("categories", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  name: text("name").notNull(),
  type: text("type").notNull(), // 'income', 'expense'
  context: text("context").notNull(), // 'personal', 'property'
  color: text("color").default("#3B82F6"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// Buildings Table
export const buildings = pgTable("buildings", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  name: text("name").notNull(),
  address: text("address"),
  totalShops: integer("total_shops").default(0),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// Tenants Table
export const tenants = pgTable("tenants", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  name: text("name").notNull(),
  phone: text("phone"),
  email: text("email"),
  address: text("address"),
  aadhaarNumber: text("aadhaar_number"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// Shops Table
export const shops = pgTable("shops", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  buildingId: integer("building_id").references(() => buildings.id).notNull(),
  shopNumber: text("shop_number").notNull(),
  name: text("name"),
  monthlyRent: decimal("monthly_rent", { precision: 10, scale: 2 }).notNull(),
  advance: decimal("advance", { precision: 10, scale: 2 }).default("0"),
  isOccupied: boolean("is_occupied").default(false),
  isAdvancePaid: boolean("is_advance_paid").default(false),
  isActive: boolean("is_active").default(true),
  tenantId: integer("tenant_id").references(() => tenants.id),
  allocated_at: timestamp("allocated_at"), // <-- use snake_case for DB and types
  createdAt: timestamp("created_at").defaultNow(),
});

// Tenant Shop Assignments
export const tenantShops = pgTable("tenant_shops", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").references(() => tenants.id).notNull(),
  shopId: integer("shop_id").references(() => shops.id).notNull(),
  startDate: timestamp("start_date").defaultNow(),
  endDate: timestamp("end_date"),
  isActive: boolean("is_active").default(true),
});

// Transactions Table
export const transactions = pgTable("transactions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  accountId: integer("account_id")
    .references(() => bankAccounts.id, { onDelete: "set null" }), // allow null and set null on delete
  categoryId: integer("category_id").references(() => categories.id),
  tenantId: integer("tenant_id").references(() => tenants.id),
  shopId: integer("shop_id").references(() => shops.id),
  buildingId: integer("building_id").references(() => buildings.id), // <-- add this line
  description: text("description").notNull(),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  type: text("type").notNull(), // 'income', 'expense'
  context: text("context").notNull(), // 'personal', 'property'
  transactionDate: timestamp("transaction_date").defaultNow(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Transfers Table
export const transfers = pgTable("transfers", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  fromAccountId: integer("from_account_id").references(() => bankAccounts.id).notNull(),
  toAccountId: integer("to_account_id").references(() => bankAccounts.id).notNull(),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  description: text("description"),
  transferDate: timestamp("transfer_date").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Rent Payments Table
export const rentPayments = pgTable("rent_payments", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  tenantId: integer("tenant_id").references(() => tenants.id).notNull(),
  shopId: integer("shop_id").references(() => shops.id).notNull(),
  month: integer("month").notNull(), // 1-12
  year: integer("year").notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  paidAmount: decimal("paid_amount", { precision: 10, scale: 2 }).default("0"), // new
  pendingAmount: decimal("pending_amount", { precision: 10, scale: 2 }).default("0"), // new
  paymentDate: timestamp("payment_date"),
  status: text("status").default("pending"), // 'paid', 'pending', 'overdue'
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Insert Schemas
export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true });
export const insertBankAccountSchema = createInsertSchema(bankAccounts).omit({ id: true, createdAt: true, currentBalance: true });
export const insertCategorySchema = createInsertSchema(categories).omit({ id: true, createdAt: true });
export const insertBuildingSchema = createInsertSchema(buildings).omit({ id: true, createdAt: true });
export const insertShopSchema = createInsertSchema(shops)
  .omit({ id: true, createdAt: true })
  .extend({
    allocated_at: z
      .union([z.string(), z.date()])
      .optional()
      .transform(val => {
        if (!val) return undefined;
        if (val instanceof Date) return val;
        if (typeof val === "string" && /^\d{4}-\d{2}-\d{2}$/.test(val)) {
          const [year, month, day] = val.split('-').map(Number);
          return new Date(Date.UTC(year, month - 1, day)); // Use UTC
        }
        const d = new Date(val);
        return isNaN(d.getTime()) ? undefined : d;
      }),
  });
export const insertTenantSchema = createInsertSchema(tenants).omit({ id: true, createdAt: true });
export const insertTenantShopSchema = createInsertSchema(tenantShops).omit({ id: true });

// Allow string or Date for transactionDate and transform to Date
export const insertTransactionSchema = createInsertSchema(transactions)
  .omit({ id: true, createdAt: true })
  .extend({
    transactionDate: z
      .union([z.string(), z.date()])
      .optional()
      .transform(val => {
        if (!val) return undefined;
        if (val instanceof Date) return val;
        const d = new Date(val);
        return isNaN(d.getTime()) ? undefined : d;
      }),
  });

// Allow string or Date for transferDate and transform to Date
export const insertTransferSchema = createInsertSchema(transfers)
  .omit({ id: true, createdAt: true })
  .extend({
    transferDate: z
      .union([z.string(), z.date()])
      .optional()
      .transform(val => {
        if (!val) return undefined;
        if (val instanceof Date) return val;
        const d = new Date(val);
        return isNaN(d.getTime()) ? undefined : d;
      }),
  });

// Allow string or Date for paymentDate and transform to Date
export const insertRentPaymentSchema = createInsertSchema(rentPayments)
  .omit({ id: true, createdAt: true })
  .extend({
    paymentDate: z
      .union([z.string(), z.date()])
      .optional()
      .transform(val => {
        if (!val) return undefined;
        if (val instanceof Date) return val;
        const d = new Date(val);
        return isNaN(d.getTime()) ? undefined : d;
      }),
  });

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type BankAccount = typeof bankAccounts.$inferSelect;
export type InsertBankAccount = z.infer<typeof insertBankAccountSchema>;
export type Category = typeof categories.$inferSelect;
export type InsertCategory = z.infer<typeof insertCategorySchema>;
export type Building = typeof buildings.$inferSelect;
export type InsertBuilding = z.infer<typeof insertBuildingSchema>;
export type Shop = typeof shops.$inferSelect;
export type InsertShop = z.infer<typeof insertShopSchema>;
export type Tenant = typeof tenants.$inferSelect;
export type InsertTenant = z.infer<typeof insertTenantSchema>;
export type TenantShop = typeof tenantShops.$inferSelect;
export type InsertTenantShop = z.infer<typeof insertTenantShopSchema>;
export type Transaction = typeof transactions.$inferSelect;
export type InsertTransaction = z.infer<typeof insertTransactionSchema>;
export type Transfer = typeof transfers.$inferSelect;
export type InsertTransfer = z.infer<typeof insertTransferSchema>;
export type RentPayment = typeof rentPayments.$inferSelect;
export type InsertRentPayment = z.infer<typeof insertRentPaymentSchema>;

