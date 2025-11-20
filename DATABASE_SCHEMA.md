# PropertyFinance Pro - Database Schema Documentation

This document provides comprehensive documentation of the PostgreSQL database schema used by PropertyFinance Pro, including table structures, relationships, constraints, and business rules.

## 📊 Overview

**Database Management System**: PostgreSQL 12+  
**ORM Framework**: Drizzle ORM  
**Schema Definition**: TypeScript (shared/schema.ts)  
**Migration Tool**: Drizzle Kit  
**Design Pattern**: Relational with referential integrity  

## 🎯 Design Principles

### Core Design Philosophy

1. **Data Integrity**: Strong foreign key relationships ensure referential integrity
2. **Separation of Concerns**: Personal and property finances tracked separately but cohesively
3. **Flexibility**: String types for non-calculative fields to prevent type conversion errors
4. **Extensibility**: Schema designed to accommodate future feature additions
5. **Soft Deletes**: `is_active` flags preserve historical data while hiding deleted records
6. **Audit Trail**: Creation timestamps on all entities for tracking purposes

### Multi-Context Architecture

The schema supports dual operational contexts:
- **Personal Finance**: Individual expense and income tracking
- **Property Management**: Real estate income, expenses, and tenant management

## 📋 Table Inventory

| Table Name | Primary Purpose | Record Count (Typical) | Key Relationships |
|------------|-----------------|------------------------|-------------------|
| `users` | Authentication & user profiles | 1-10 | Parent to all tables |
| `bank_accounts` | Financial account management | 3-10 per user | Core to all transactions |
| `categories` | Transaction classification | 20-50 per user | Links to transactions |
| `buildings` | Property building records | 1-20 per user | Parent to shops |
| `shops` | Individual rental units | 10-200 per user | Child of buildings<br>Has `allocated_at` for tenant allocation date |
| `tenants` | Tenant personal information | 5-100 per user | Links to shops & payments |
| `tenant_shops` | Tenant-shop assignments | 5-100 per user | Many-to-many junction |
| `transactions` | All financial transactions | 100-10,000 per user | Core financial data |
| `transfers` | Inter-account money movements | 10-500 per user | Account relationships |
| `rent_payments` | Monthly rent tracking | 60-2,400 per user | Property income tracking (FK: tenant_id → tenants.id, shop_id → shops.id) |

## 🔍 Detailed Schema Documentation

### 1. Users Table

**Table Name**: `users`  
**Purpose**: Central authentication and user profile management  
**Row Estimate**: 1-10 per installation (single/family use)  

```sql
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);
```

### 2. Bank Accounts Table

**Table Name**: `bank_accounts`  
**Purpose**: Management of user financial accounts  
**Row Estimate**: 3-10 per user  

```sql
CREATE TABLE bank_accounts (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    account_name TEXT NOT NULL,
    balance DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMP DEFAULT NOW()
);
```

### 3. Categories Table

**Table Name**: `categories`  
**Purpose**: Classification of transactions for reporting and analysis  
**Row Estimate**: 20-50 per user  

```sql
CREATE TABLE categories (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    category_name TEXT NOT NULL,
    is_income BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW()
);
```

### 4. Buildings Table

**Table Name**: `buildings`  
**Purpose**: Records of property buildings for management and reporting  
**Row Estimate**: 1-20 per user  

```sql
CREATE TABLE buildings (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    building_name TEXT NOT NULL,
    address TEXT NOT NULL,
    purchase_date DATE,
    sale_date DATE,
    created_at TIMESTAMP DEFAULT NOW()
);
```

### 5. Shops Table

**Table Name**: `shops`  
**Purpose**: Rental unit details, allocation, and rent tracking  
**Key Columns**:  
- `id`: Primary key  
- `building_id`: Foreign key to `buildings`  
- `tenant_id`: Foreign key to `tenants` (nullable)  
- `allocated_at`: Timestamp when tenant was allocated (used for rent calculation)  
- `monthly_rent`: Rent amount  

```sql
CREATE TABLE shops (
    id SERIAL PRIMARY KEY,
    building_id INTEGER REFERENCES buildings(id) ON DELETE CASCADE,
    tenant_id INTEGER REFERENCES tenants(id) ON DELETE SET NULL,
    allocated_at TIMESTAMP,
    monthly_rent DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMP DEFAULT NOW()
);
```

### 6. Tenants Table

**Table Name**: `tenants`  
**Purpose**: Storage of tenant personal information and rental history  
**Row Estimate**: 5-100 per user  

```sql
CREATE TABLE tenants (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    phone TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);
```

### 7. Tenant Shops Table

**Table Name**: `tenant_shops`  
**Purpose**: Junction table for many-to-many relationship between tenants and shops  
**Row Estimate**: 5-100 per user  

```sql
CREATE TABLE tenant_shops (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
    shop_id INTEGER REFERENCES shops(id) ON DELETE CASCADE,
    allocated_at TIMESTAMP,
    PRIMARY KEY (tenant_id, shop_id)
);
```

### 8. Transactions Table

**Table Name**: `transactions`  
**Purpose**: Recording of all financial transactions including income and expenses  
**Row Estimate**: 100-10,000 per user  

```sql
CREATE TABLE transactions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    account_id INTEGER REFERENCES bank_accounts(id) ON DELETE CASCADE,
    category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
    amount DECIMAL(10, 2) NOT NULL,
    transaction_date TIMESTAMP DEFAULT NOW(),
    description TEXT,
    is_recurring BOOLEAN NOT NULL DEFAULT FALSE,
    recurrence_interval TEXT,
    next_occurrence TIMESTAMP
);
```

### 9. Transfers Table

**Table Name**: `transfers`  
**Purpose**: Management of money movements between different bank accounts of the user  
**Row Estimate**: 10-500 per user  

```sql
CREATE TABLE transfers (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    from_account_id INTEGER REFERENCES bank_accounts(id) ON DELETE CASCADE,
    to_account_id INTEGER REFERENCES bank_accounts(id) ON DELETE CASCADE,
    amount DECIMAL(10, 2) NOT NULL,
    transfer_date TIMESTAMP DEFAULT NOW(),
    description TEXT
);
```

### 10. Rent Payments Table

**Table Name**: `rent_payments`  
**Purpose**: Tracking of monthly rent payments from tenants  
**Row Estimate**: 60-2,400 per user  

```sql
CREATE TABLE rent_payments (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
    shop_id INTEGER REFERENCES shops(id) ON DELETE CASCADE,
    payment_date TIMESTAMP DEFAULT NOW(),
    amount DECIMAL(10, 2) NOT NULL,
    is_late BOOLEAN NOT NULL DEFAULT FALSE,
    late_fee DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    payment_method TEXT,
    transaction_id INTEGER REFERENCES transactions(id) ON DELETE SET NULL
);
```
