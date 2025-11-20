# PropertyFinance Pro

A comprehensive offline-capable real estate and personal finance management application built with modern web technologies. Manage rental income/expenses from multiple buildings and shops while tracking personal finances - all from your personal laptop.

## 🌟 Features

### 🔐 Authentication
- Simple username/password authentication
- Secure session management
- User-specific data isolation

### 📊 Dual-Mode Dashboard
- **Personal Expense Tracker**: Income, expenses, net savings, spending analysis
- **Property Management**: Rental income, property expenses, tenant management

### 💰 Financial Management
- Multi-account banking support (Savings, Current, Credit Card)
- Comprehensive transaction tracking with categories
- Inter-account transfers
- Real-time balance updates

### 🏢 Property Management
- Multiple building and shop management
- Tenant information and contact management
- Rent payment tracking with 12-month grid view
- Occupancy status monitoring

### 📈 Analytics & Reports
- Spending trends by category and account
- Income vs expenses visualization
- Property performance analytics
- Customizable date range filtering

### 💾 Data Management
- Complete data backup/export functionality
- Offline-first design
- Local PostgreSQL database
- No external dependencies or paid services

## 🏗️ Tech Stack

### Frontend
- **React 18** with TypeScript
- **Tailwind CSS** for styling
- **Wouter** for routing
- **TanStack Query** for state management
- **Recharts** for data visualization
- **Radix UI** components via shadcn/ui

### Backend
- **Node.js** with Express.js
- **PostgreSQL** database
- **Drizzle ORM** for database operations
- **Passport.js** for authentication
- **bcrypt** for password hashing

### Development Tools
- **Vite** for build tooling
- **TypeScript** for type safety
- **Drizzle Kit** for database migrations
- **ESBuild** for production builds

## 📋 Prerequisites

Before setting up PropertyFinance Pro, ensure you have the following installed:

### Required Software
- **Node.js**: Version 18.0 or higher ([Download here](https://nodejs.org))
- **PostgreSQL**: Version 12.0 or higher ([Download here](https://postgresql.org/download))
- **npm**: Version 8.0+ (included with Node.js)

### System Requirements
- **Operating System**: Windows 10+, macOS 10.15+, or Linux (Ubuntu 18.04+)
- **RAM**: Minimum 4GB (8GB recommended)
- **Storage**: At least 2GB free space
- **Network**: Internet connection for initial setup only

## 🚀 Installation & Setup

### 1. Verify Prerequisites

```bash
# Check Node.js version
node --version
# Should output v18.0.0 or higher

# Check npm version
npm --version
# Should output 8.0.0 or higher

# Check PostgreSQL installation
psql --version
# Should output PostgreSQL version info
```
