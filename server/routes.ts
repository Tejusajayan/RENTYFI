import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import bcrypt from "bcrypt";

// Extend express-session types to include userId
declare module "express-session" {
  interface SessionData {
    userId?: number;
  }
}
import session from "express-session";
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { insertUserSchema, insertBankAccountSchema, insertCategorySchema, insertBuildingSchema, insertShopSchema, insertTenantSchema, insertTransactionSchema, insertTransferSchema, insertRentPaymentSchema } from "@shared/schema";
import { z } from "zod";
import multer from "multer";

// Define the User type expected by Passport
type User = {
  id: number;
  username: string;
  password: string;
};

// Initialize multer for file uploads
const upload = multer();

// Session configuration
passport.use(new LocalStrategy(
  async (username, password, done) => {
    try {
      const user = await storage.getUserByUsername(username) as unknown as User | null;
      if (user == null) {
        return done(null, false, { message: 'Incorrect username.' });
      }
      
      const isValid = await bcrypt.compare(password, user.password);
      if (!isValid) {
        return done(null, false, { message: 'Incorrect password.' });
      }
      
      return done(null, user as User);
    } catch (error) {
      return done(error);
    }
  }
));

passport.serializeUser((user: any, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id: number, done) => {
  try {
    const user = await storage.getUser(id) ?? null;
    done(null, user);
  } catch (error) {
    done(error);
  }
});

// Middleware to check authentication
const requireAuth = (req: any, res: any, next: any) => {
  if (req.session.userId) {
    return next();
  }
  res.status(401).json({ message: 'Authentication required' });
};

export async function registerRoutes(app: Express): Promise<Server> {
  // Session and passport middleware
  app.use(session({
    secret: process.env.SESSION_SECRET || 'your-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false }
  }));
  
  app.use(passport.initialize());
  app.use(passport.session());

  // Auth routes
  app.post('/api/auth/register', async (req, res) => {
    try {
      const userData = insertUserSchema.parse(req.body);
      const hashedPassword = await bcrypt.hash(userData.password, 10);
      
      await storage.createUser({
        ...userData,
        password: hashedPassword
      });

      // Fetch the user after creation
      const user = await storage.getUserByUsername(userData.username) as { id: number; username: string } | null | undefined;

      if (!user) {
        return res.status(500).json({ message: 'User creation failed' });
      }

      req.session.userId = user.id;
      res.json({ user: { id: user.id, username: user.username } });
    } catch (error) {
      res.status(400).json({ message: 'Registration failed', error });
    }
  });

  app.post('/api/auth/login', (req, res, next) => {
    passport.authenticate('local', (err: any, user: any, info: any) => {
      if (err) {
        return res.status(500).json({ message: 'Authentication error' });
      }
      if (!user) {
        return res.status(401).json({ message: info?.message || 'Login failed' });
      }
      
      req.session.userId = user.id;
      res.json({ user: { id: user.id, username: user.username } });
    })(req, res, next);
  });

  app.post('/api/auth/logout', (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ message: 'Logout failed' });
      }
      res.json({ message: 'Logged out successfully' });
    });
  });

  app.get('/api/auth/me', async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: 'Not authenticated' });
    }
    
    const user = await storage.getUser(req.session.userId) as unknown as { id: number; username: string } | null;
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    res.json({ user: { id: user.id, username: user.username } });
  });

  // Dashboard routes
  app.get('/api/dashboard/personal', requireAuth, async (req, res) => {
    try {
      // Remove dateFrom/dateTo for main dashboard
      const data = await storage.getPersonalDashboardData(req.session.userId!);
      res.json(data);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch dashboard data', error });
    }
  });

  app.get('/api/dashboard/property', requireAuth, async (req, res) => {
    try {
      // Remove dateFrom/dateTo for main dashboard
      const data = await storage.getPropertyDashboardData(req.session.userId!);
      res.json(data);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch dashboard data', error });
    }
  });

  // Bank Accounts routes
  app.get('/api/accounts', requireAuth, async (req, res) => {
    try {
      const accounts = await storage.getBankAccounts(req.session.userId!);
      res.json(accounts);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch accounts', error });
    }
  });

  app.post('/api/accounts', requireAuth, async (req, res) => {
    try {
      const accountData = insertBankAccountSchema.parse({
        ...req.body,
        userId: req.session.userId
      });
      const account = await storage.createBankAccount(accountData);
      res.json(account);
    } catch (error) {
      res.status(400).json({ message: 'Failed to create account', error });
    }
  });

  app.put('/api/accounts/:id', requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const account = await storage.updateBankAccount(id, req.body);
      res.json(account);
    } catch (error) {
      res.status(400).json({ message: 'Failed to update account', error });
    }
  });

  app.delete('/api/accounts/:id', requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteBankAccount(id);
      res.json({ message: 'Account deleted successfully' });
    } catch (error: any) {
      // Add user-friendly error for FK constraint
      if (
        error.message &&
        (error.message.includes("referenced by one or more transactions") ||
         error.message.includes("referenced by one or more transfers"))
      ) {
        return res.status(400).json({ message: error.message });
      }
      res.status(400).json({ message: 'Failed to delete account', error });
    }
  });

  // Categories routes
  app.get('/api/categories', requireAuth, async (req, res) => {
    try {
      const { context } = req.query;
      const categories = await storage.getCategories(req.session.userId!, context as string);
      res.json(categories);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch categories', error });
    }
  });

  app.post('/api/categories', requireAuth, async (req, res) => {
    try {
      const categoryData = insertCategorySchema.parse({
        ...req.body,
        userId: req.session.userId
      });
      const category = await storage.createCategory(categoryData);
      res.json(category);
    } catch (error) {
      res.status(400).json({ message: 'Failed to create category', error });
    }
  });

  // Add this PUT endpoint for editing categories
  app.put('/api/categories/:id', requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const updates = req.body;
      const category = await storage.updateCategory(id, req.session.userId!, updates);
      res.json(category);
    } catch (error: any) {
      if (error.message && error.message.includes("not owned")) {
        return res.status(404).json({ message: error.message });
      }
      res.status(400).json({ message: 'Failed to update category', error });
    }
  });

  // Add this DELETE endpoint for categories
  app.delete('/api/categories/:id', requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteCategory(id, req.session.userId!);
      res.json({ message: 'Category deleted successfully' });
    } catch (error: any) {
      if (error.message && error.message.includes("not owned")) {
        return res.status(404).json({ message: error.message });
      }
      res.status(400).json({ message: 'Failed to delete category', error });
    }
  });

  // Buildings routes
  app.get('/api/buildings', requireAuth, async (req, res) => {
    try {
      const buildings = await storage.getBuildings(req.session.userId!);
      res.json(buildings);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch buildings', error });
    }
  });

  app.post('/api/buildings', requireAuth, async (req, res) => {
    try {
      const buildingData = insertBuildingSchema.parse({
        ...req.body,
        userId: req.session.userId
      });
      const building = await storage.createBuilding(buildingData);
      res.json(building);
    } catch (error) {
      res.status(400).json({ message: 'Failed to create building', error });
    }
  });

  // Add this PUT endpoint for editing buildings
  app.put('/api/buildings/:id', requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const updates = req.body;
      const building = await storage.updateBuilding(id, req.session.userId!, updates);
      res.json(building);
    } catch (error: any) {
      if (error.message && error.message.includes("not owned")) {
        return res.status(404).json({ message: error.message });
      }
      res.status(400).json({ message: 'Failed to update building', error });
    }
  });

  app.delete('/api/buildings/:id', requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteBuilding(id, req.session.userId!);
      res.json({ message: 'Building deleted successfully' });
    } catch (error: any) {
      if (error.message && error.message.includes("not owned")) {
        return res.status(404).json({ message: error.message });
      }
      res.status(400).json({ message: 'Failed to delete building', error });
    }
  });

  // Shops routes
  app.get('/api/shops', requireAuth, async (req, res) => {
    try {
      const { buildingId } = req.query;
      const shops = await storage.getShops(req.session.userId!, buildingId ? parseInt(buildingId as string) : undefined);
      res.json(shops);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch shops', error });
    }
  });

  app.post('/api/shops', requireAuth, async (req, res) => {
    try {
      const shopData = insertShopSchema.parse({
        ...req.body,
        userId: req.session.userId
      });
      const shop = await storage.createShop(shopData);
      res.json(shop);
    } catch (error) {
      res.status(400).json({ message: 'Failed to create shop', error });
    }
  });

  // Add this PUT endpoint for editing shops
  app.put('/api/shops/:id', requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const updates = req.body;
      const shop = await storage.updateShop(id, req.session.userId!, updates);
      res.json(shop);
    } catch (error: any) {
      if (error.message && error.message.includes("not owned")) {
        return res.status(404).json({ message: error.message });
      }
      res.status(400).json({ message: 'Failed to update shop', error });
    }
  });

  app.delete('/api/shops/:id', requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteShop(id, req.session.userId!);
      res.json({ message: 'Shop deleted successfully' });
    } catch (error: any) {
      if (error.message && error.message.includes("not owned")) {
        return res.status(404).json({ message: error.message });
      }
      res.status(400).json({ message: 'Failed to delete shop', error });
    }
  });

  // Tenants routes
  app.get('/api/tenants', requireAuth, async (req, res) => {
    try {
      const tenants = await storage.getTenants(req.session.userId!);
      res.json(tenants);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch tenants', error });
    }
  });

  app.post('/api/tenants', requireAuth, async (req, res) => {
    try {
      const tenantData = insertTenantSchema.parse({
        ...req.body,
        userId: req.session.userId
      });
      const tenant = await storage.createTenant(tenantData);
      res.json(tenant);
    } catch (error) {
      res.status(400).json({ message: 'Failed to create tenant', error });
    }
  });

  // Add this PUT endpoint for editing tenants
  app.put('/api/tenants/:id', requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const updates = req.body;
      const tenant = await storage.updateTenant(id, req.session.userId!, updates);
      res.json(tenant);
    } catch (error: any) {
      if (error.message && error.message.includes("not owned")) {
        return res.status(404).json({ message: error.message });
      }
      res.status(400).json({ message: 'Failed to update tenant', error });
    }
  });

  app.delete('/api/tenants/:id', requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteTenant(id, req.session.userId!);
      res.json({ message: 'Tenant deleted successfully' });
    } catch (error: any) {
      if (error.message && error.message.includes("not owned")) {
        return res.status(404).json({ message: error.message });
      }
      res.status(400).json({ message: 'Failed to delete tenant', error });
    }
  });

  // Transactions routes
  app.get('/api/transactions', requireAuth, async (req, res) => {
    try {
      const { context, categoryId, accountId, dateFrom, dateTo, limit } = req.query;
      const filters: any = {};

      if (categoryId && categoryId !== 'all') filters.categoryId = parseInt(categoryId as string);
      if (accountId && accountId !== 'all') filters.accountId = parseInt(accountId as string);
      if (dateFrom) filters.dateFrom = new Date(dateFrom as string);
      if (dateTo) filters.dateTo = new Date(dateTo as string);

      // Pass limit to storage if provided
      const limitNum = limit ? parseInt(limit as string) : undefined;

      // Fetch all transactions and filter in-memory (for now)
      let transactions = await storage.getTransactions(
        req.session.userId!,
        context as string,
        limitNum
      );

      if (filters.categoryId) {
        transactions = transactions.filter(t => t.categoryId === filters.categoryId);
      }
      if (filters.accountId) {
        transactions = transactions.filter(t => t.accountId === filters.accountId);
      }
      if (filters.dateFrom) {
        transactions = transactions.filter(t => t.transactionDate && new Date(t.transactionDate) >= filters.dateFrom);
      }
      if (filters.dateTo) {
        // Make dateTo exclusive (matches frontend logic: to = first day of next month or next day for custom)
        const nextDay = new Date(filters.dateTo);
        transactions = transactions.filter(t => t.transactionDate && new Date(t.transactionDate) < nextDay);
      }

      res.json(transactions);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch transactions', error });
    }
  });

  app.post('/api/transactions', requireAuth, async (req, res) => {
    try {
      // Accept transactionDate and createdAt as provided by client (system time)
      const transactionData = insertTransactionSchema.parse({
        ...req.body,
        userId: req.session.userId
      });
      const transaction = await storage.createTransaction(transactionData);
      res.json(transaction);
    } catch (error) {
      res.status(400).json({ message: 'Failed to create transaction', error });
    }
  });

  app.delete('/api/transactions/:id', requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      // Fetch the transaction before deleting
      // Find the transaction by ID from all transactions
      const allTransactions = await storage.getTransactions(req.session.userId!);
      const transaction = allTransactions.find((t: any) => t.id === id);

      await storage.deleteTransaction(id);

      // If this was a rent transaction, update rent_payments
      if (
        transaction &&
        transaction.type === 'income' &&
        transaction.context === 'property' &&
        transaction.tenantId &&
        transaction.shopId &&
        transaction.transactionDate
      ) {
        // Find the rent payment for this tenant/shop/month/year
        const date = new Date(transaction.transactionDate);
        const month = date.getMonth() + 1;
        const year = date.getFullYear();
        // --- Fallback: If not implemented, add a no-op to avoid crash ---
        if (typeof storage.updateRentPaymentAfterTransactionDelete !== "function") {
          // @ts-ignore
          storage.updateRentPaymentAfterTransactionDelete = async () => {};
        }
        await storage.updateRentPaymentAfterTransactionDelete({
          userId: req.session.userId!,
          tenantId: transaction.tenantId,
          shopId: transaction.shopId,
          month,
          year,
          amount: Number(transaction.amount)
        });
      }
      res.json({ message: 'Transaction deleted successfully' });
    } catch (error) {
      res.status(400).json({ message: 'Failed to delete transaction', error });
    }
  });

  // Transfers routes
  app.get('/api/transfers', requireAuth, async (req, res) => {
    try {
      const { dateFrom, dateTo } = req.query;
      let transfers = await storage.getTransfers(req.session.userId!);

      if (dateFrom) {
        const fromDate = new Date(dateFrom as string);
        transfers = transfers.filter(t => t.transferDate && new Date(t.transferDate) >= fromDate);
      }
      if (dateTo) {
        const toDate = new Date(dateTo as string);
        transfers = transfers.filter(t => t.transferDate && new Date(t.transferDate) <= toDate);
      }

      res.json(transfers);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch transfers', error });
    }
  });

  app.post('/api/transfers', requireAuth, async (req, res) => {
    try {
      // Convert transferDate to Date if present and is a string
      let transferDate = req.body.transferDate;
      if (transferDate && typeof transferDate === "string") {
        transferDate = new Date(transferDate);
        if (isNaN(transferDate.getTime())) transferDate = undefined;
      }
      const transferData = insertTransferSchema.parse({
        ...req.body,
        userId: req.session.userId,
        transferDate, // always Date or undefined
      });
      const transfer = await storage.createTransfer(transferData);
      res.json(transfer);
    } catch (error) {
      res.status(400).json({ message: 'Failed to create transfer', error });
    }
  });

  app.delete('/api/transfers/:id', requireAuth, async (req, res) => {
    const id = Number(req.params.id);
    try {
      await storage.deleteTransfer(id, req.session.userId!);
      res.status(204).send();
    } catch (e: any) {
      if (e.message === "Transfer not found") {
        res.status(404).json({ error: "Transfer not found" });
      } else if (e.message === "Unauthorized to delete this transfer") {
        res.status(403).json({ error: "Unauthorized" });
      } else {
        res.status(500).json({ error: "Failed to delete transfer" });
      }
    }
  });

  // Rent Payments routes
  app.get('/api/rent-payments', requireAuth, async (req, res) => {
    try {
      const { tenantId, year } = req.query;
      let rentPayments = await storage.getRentPayments(req.session.userId!);
      res.json(rentPayments);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch rent payments', error: {} });
    }
  });

  app.post('/api/rent-payments', requireAuth, async (req, res) => {
    try {
      // Do not set paymentDate, let DB default handle it unless valid
      const body: any = {
        ...req.body,
        amount: req.body.amount?.toString?.() ?? "",
        paidAmount: req.body.paidAmount?.toString?.() ?? "",
        pendingAmount: req.body.pendingAmount?.toString?.() ?? "",
        userId: req.session.userId
      };
      // Only set paymentDate if it's a valid Date
      if (body.paymentDate) {
        let dt = body.paymentDate;
        if (typeof dt === "string" || typeof dt === "number") {
          dt = new Date(dt);
        }
        if (dt instanceof Date && !isNaN(dt.getTime())) {
          body.paymentDate = dt;
        } else {
          delete body.paymentDate;
        }
      } else {
        delete body.paymentDate;
      }
      const rentPaymentData = insertRentPaymentSchema.parse(body);
      const rentPayment = await storage.createRentPayment(rentPaymentData);
      res.json(rentPayment);
    } catch (error) {
      res.status(400).json({ message: 'Failed to create rent payment', error });
    }
  });

  // --- Add upsert endpoint for rent payments ---
  app.post('/api/rent-payments/upsert', requireAuth, async (req, res) => {
    try {
      const body: any = {
        ...req.body,
        amount: req.body.amount?.toString?.() ?? "",
        paidAmount: req.body.paidAmount?.toString?.() ?? "",
        pendingAmount: req.body.pendingAmount?.toString?.() ?? "",
        userId: req.session.userId
      };
      // Only set paymentDate if it's a valid Date
      if (body.paymentDate) {
        let dt = body.paymentDate;
        if (typeof dt === "string" || typeof dt === "number") {
          dt = new Date(dt);
        }
        if (dt instanceof Date && !isNaN(dt.getTime())) {
          body.paymentDate = dt;
        } else {
          delete body.paymentDate;
        }
      } else {
        delete body.paymentDate;
      }
      // Upsert logic
      const upserted = await storage.upsertRentPayment(body);
      res.json(upserted);
    } catch (error) {
      res.status(400).json({ message: 'Failed to upsert rent payment', error });
    }
  });

  // --- ADD THIS: DELETE endpoint for rent payments ---
  app.delete('/api/rent-payments/:id', requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      // Only allow deleting rent payments belonging to the user
      const rentPayments = await storage.getRentPayments(req.session.userId!);
      const rentPayment = rentPayments.find((p: any) => p.id === id);
      if (!rentPayment) {
        return res.status(404).json({ message: "Rent payment not found" });
      }
      // Actually delete the rent payment
      await storage.deleteRentPayment(id, req.session.userId!);
      res.json({ message: "Rent payment deleted successfully" });
    } catch (error: any) {
      res.status(400).json({ message: "Failed to delete rent payment", error: error.message || error });
    }
  });

  // Move the backup routes BEFORE the return statement
  app.get('/api/backup/export', requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const backup = await storage.getFullBackup(userId);

      // Set headers for file download
      const filename = `propertyfinance-backup-${new Date().toISOString().split('T')[0]}.json`;
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      
      // Ensure data is properly stringified
      const backupString = JSON.stringify(backup, null, 2);
      res.status(200).send(backupString);
    } catch (error) {
      res.status(500).json({ 
        message: "Failed to export data",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  app.post('/api/backup/import', requireAuth, upload.single("backup"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      let backup;
      try {
        const fileContent = req.file.buffer.toString('utf-8');
        backup = JSON.parse(fileContent);
      } catch (e) {
        return res.status(400).json({ 
          message: "Invalid JSON file format",
          error: e instanceof Error ? e.message : "JSON parse error"
        });
      }

      const userId = req.session.userId!;

      // Validate backup structure
      if (!backup || typeof backup !== 'object') {
        return res.status(400).json({ message: "Invalid backup format: not a JSON object" });
      }

      // Store current data as temporary backup
      const currentData = await storage.getFullBackup(userId);

      try {
        // Validate the backup data structure
        await storage.validateBackupData(backup);

        // If validation passes, proceed with import in a transaction
        await storage.deleteAllUserData(userId);
        await storage.importBackupData(userId, backup);

        res.json({ message: "Data imported successfully" });
      } catch (error) {
        // If anything fails during import, restore the previous data
        let restoreErrorMsg = "";
        try {
          await storage.deleteAllUserData(userId);
          await storage.importBackupData(userId, currentData);
        } catch (restoreError) {
          restoreErrorMsg = restoreError instanceof Error ? restoreError.message : "Unknown restore error";
        }
        return res.status(400).json({ 
          message: restoreErrorMsg
            ? "Import failed and data restoration failed. Please contact support."
            : "Import failed, previous data has been restored",
          error: error instanceof Error ? error.message : "Unknown error",
          restoreError: restoreErrorMsg || undefined
        });
      }
    } catch (error) {
      res.status(500).json({ 
        message: "Failed to process import request",
        error: error instanceof Error ? error.message : "Unknown error" 
      });
    }
  });

  // No changes needed for dashboard snapshot creation logic.

  return createServer(app);
}