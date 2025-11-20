import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import TopBar from "@/components/TopBar";
import { useAuth } from "@/hooks/useAuth";
import { PersonalDashboardCards, PropertyDashboardCards } from "@/components/DashboardCards";
import TransactionsList from "@/components/TransactionsList";
import AddTransactionModal from "@/components/AddTransactionModal";
import AddAccountModal from "@/components/AddAccountModal";
import { Plus, University, ArrowLeftRight, Download } from "lucide-react";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from 'recharts';
import { Category, Transaction as BaseTransaction } from "@shared/schema";

// Extend Transaction type to include optional buildingName and runningBalance for dashboard usage
type Transaction = BaseTransaction & {
  buildingName?: string;
  runningBalance?: number | null;
};

// Extend BankAccount type to include includeInTotalIncome
type BankAccount = {
  id: number;
  createdAt: Date | null;
  name: string;
  userId: number;
  isActive: boolean | null;
  accountNumber: string;
  accountType: string;
  initialBalance: string | null;
  currentBalance: string | null;
  includeInTotalIncome?: boolean; // <-- Add this line
};
import { useNavigate } from "react-router-dom";
import { addMonths } from "date-fns";
import { Input } from "@/components/ui/input";

export default function Dashboard() {
  const [mode, setMode] = useState<'personal' | 'property'>('personal');
  const [showAddTransactionModal, setShowAddTransactionModal] = useState(false);
  const user = useAuth();
  const [showAddAccountModal, setShowAddAccountModal] = useState(false);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [showNotifications, setShowNotifications] = useState(false);

  // --- FIX: Fetch all transactions for all time for net savings calculation ---
  // Move these hooks to the very top of the component, before any other logic or function
  const { data: allPersonalTxnsAllTime = [] } = useQuery<any[]>({
    queryKey: ['/api/transactions', 'personal', 'alltime'],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append('context', 'personal');
      // Do NOT add dateFrom/dateTo
      const res = await fetch(`/api/transactions?${params}`, { credentials: 'include' });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: true,
  });
  const { data: allPropertyTxnsAllTime = [] } = useQuery<any[]>({
    queryKey: ['/api/transactions', 'property', 'alltime'],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append('context', 'property');
      // Do NOT add dateFrom/dateTo
      const res = await fetch(`/api/transactions?${params}`, { credentials: 'include' });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: true,
  });

  type PersonalDashboardData = {
    totalIncome: number;
    totalExpenses: number;
    netSavings: number;
    savingsRate: number;
    recentTransactions: any[]; // Replace 'any' with your transaction type if available
  };

  type PropertyDashboardData = {
    // Define the shape of your property dashboard data here if needed
    buildingIncomeMap?: { [buildingId: string]: number };
    [key: string]: any;
  };

  // Fetch all-time personal dashboard data (for main cards)
  const { data: personalData, isLoading: personalLoading } = useQuery<any>({
    queryKey: ['/api/dashboard/personal', 'alltime'],
    queryFn: async () => {
      // Always fetch cumulative totals (no date filter)
      const res = await fetch(`/api/dashboard/personal`, { credentials: 'include' });
      return res.json();
    },
    enabled: mode === 'personal',
  });

  // Fetch all-time property dashboard data (for main cards)
  const { data: propertyData, isLoading: propertyLoading } = useQuery<any>({
    queryKey: ['/api/dashboard/property', 'alltime'],
    queryFn: async () => {
      // Always fetch cumulative totals (no date filter)
      const res = await fetch(`/api/dashboard/property`, { credentials: 'include' });
      return res.json();
    },
    enabled: mode === 'property',
  });

  // Add state for date range and custom dates (personal)
  const [dateRange, setDateRange] = useState<'current' | 'lastmonth' | '3months' | '6months' | 'currentyear' | 'custom'>('current');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  // Add state for date range and custom dates (property)
  const [propertyDateRange, setPropertyDateRange] = useState<'current' | 'lastmonth' | '3months' | '6months' | 'currentyear' | 'custom'>('current');
  const [propertyCustomFrom, setPropertyCustomFrom] = useState('');
  const [propertyCustomTo, setPropertyCustomTo] = useState('');

  // Helper to get date range for personal
  function getPersonalDateRange(range: string) {
    const now = new Date();
    let from: Date | undefined, to: Date | undefined;
    switch (range) {
      case 'current':
        from = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
        to = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999); // inclusive last day of month
        break;
      case 'lastmonth':
        from = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
        to = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
        break;
      case '3months': {
        // Fix: Show last 3 *completed* months (e.g. if today is Oct 1, 2023: July 1 - Sep 30, 2023)
        const prevMonth = new Date(now.getFullYear(), now.getMonth(), 0); // last day of previous month
        from = new Date(prevMonth.getFullYear(), prevMonth.getMonth() - 2, 1, 0, 0, 0, 0);
        to = new Date(prevMonth.getFullYear(), prevMonth.getMonth(), prevMonth.getDate(), 23, 59, 59, 999);
        break;
      }
      case '6months': {
        const prevMonth = new Date(now.getFullYear(), now.getMonth(), 0);
        from = new Date(prevMonth.getFullYear(), prevMonth.getMonth() - 5, 1, 0, 0, 0, 0);
        to = new Date(prevMonth.getFullYear(), prevMonth.getMonth(), prevMonth.getDate(), 23, 59, 59, 999);
        break;
      }
      case 'currentyear':
        from = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
        to = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
        break;
      case 'custom':
        if (customFrom) from = new Date(customFrom);
        if (customTo) {
          const d = new Date(customTo);
          to = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
        }
        break;
    }
    return { from, to };
  }

  // Helper to get date range for property
  function getPropertyDateRange(range: string) {
    const now = new Date();
    let from: Date | undefined, to: Date | undefined;
    switch (range) {
      case 'current':
        from = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
        to = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
        break;
      case 'lastmonth':
        from = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
        to = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
        break;
      case '3months': {
        // --- DEBUG: Log how 3 months range is calculated ---
        const prevMonth = new Date(now.getFullYear(), now.getMonth(), 0); // last day of previous month
        from = new Date(prevMonth.getFullYear(), prevMonth.getMonth() - 2, 1, 0, 0, 0, 0);
        to = new Date(prevMonth.getFullYear(), prevMonth.getMonth(), prevMonth.getDate(), 23, 59, 59, 999);
        break;
      }
      case '6months': {
        // --- FIX: Use last 6 *completed* months, not including current month ---
        const prevMonth = new Date(now.getFullYear(), now.getMonth(), 0); // last day of previous month
        from = new Date(prevMonth.getFullYear(), prevMonth.getMonth() - 5, 1, 0, 0, 0, 0);
        to = new Date(prevMonth.getFullYear(), prevMonth.getMonth(), prevMonth.getDate(), 23, 59, 59, 999);
        break;
      }
      case 'currentyear':
        from = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
        to = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
        break;
      case 'custom':
        if (propertyCustomFrom) from = new Date(propertyCustomFrom);
        if (propertyCustomTo) {
          const d = new Date(propertyCustomTo);
          to = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
        }
        break;
    }
    return { from, to };
  }

  // Fetch all transactions for the current mode and date range (for chart)
  const { data: allTransactions = [] } = useQuery<any[]>({
    queryKey: ['/api/transactions', mode, 'all', dateRange, customFrom, customTo],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append('context', mode);
      const { from, to } = getPersonalDateRange(dateRange);
      if (from) params.append('dateFrom', from.toISOString());
      if (to) params.append('dateTo', to.toISOString());
      const res = await fetch(`/api/transactions?${params}`, { credentials: 'include' });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!mode,
  });

  // --- Add: Fetch all property expenses for personal dashboard calculations ---
  const { data: allPropertyTransactions = [] } = useQuery<any[]>({
    queryKey: ['/api/transactions', 'property', 'all', dateRange, customFrom, customTo],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append('context', 'property');
      // Always append both dateFrom and dateTo for all ranges
      const { from, to } = getPersonalDateRange(dateRange);
      if (from) params.append('dateFrom', from.toISOString());
      if (to) params.append('dateTo', to.toISOString());
      const res = await fetch(`/api/transactions?${params}`, { credentials: 'include' });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: mode === 'personal',
  });

  // Fetch recent transactions for the current mode (for list)
  const { data: recentTransactions = [] } = useQuery<any[]>({
    queryKey: ['/api/transactions', mode, { limit: 5 }],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append('context', mode);
      params.append('limit', '5');
      const res = await fetch(`/api/transactions?${params}`, { credentials: 'include' });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!mode,
  });

  // Fetch categories and accounts for dynamic breakdowns
  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ['/api/categories', mode],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (mode) params.append('context', mode);
      const res = await fetch(`/api/categories?${params}`, { credentials: 'include' });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!mode,
  });

  const { data: accounts = [] } = useQuery<BankAccount[]>({
    queryKey: ['/api/accounts']
  });

  // Filter allTransactions for chart based on dateRange/custom dates
  const { from: filterFrom, to: filterTo } = getPersonalDateRange(dateRange);
  const filteredTransactions = allTransactions.filter((t: Transaction) => {
    if (!t.transactionDate) return false;
    const d = new Date(t.transactionDate);
    if (filterFrom && d < filterFrom) return false;
    if (filterTo && d > filterTo) return false; // inclusive upper bound
    return true;
  });

  // Compute spending by category and by account from filteredTransactions
  const COLORS = [
    '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316',
    '#6366F1', '#A21CAF', '#F43F5E', '#22D3EE', '#EAB308', '#84CC16', '#D97706', '#0EA5E9',
    '#F87171', '#A3E635', '#FACC15', '#FBBF24', '#6EE7B7', '#FDE68A', '#C026D3', '#F472B6',
    '#FCD34D', '#64748B', '#94A3B8', '#D1D5DB', '#E5E7EB', '#000000', '#FFFFFF'
  ];

  const categoryTotals: { [key: string]: number } = {};
  let chartTotalExpenses = 0;
  filteredTransactions
    .filter((t: Transaction) => t.type === 'expense')
    .forEach((t: Transaction) => {
      const cat = categories.find((c) => c.id === t.categoryId);
      const name = cat?.name || 'Uncategorized';
      categoryTotals[name] = (categoryTotals[name] || 0) + Number(t.amount);
      chartTotalExpenses += Number(t.amount);
    });
  const chartData = Object.entries(categoryTotals).map(([name, value], idx) => ({
    name,
    value,
    fill: COLORS[idx % COLORS.length]
  }));

  // --- Merge personal and property expenses for account breakdown ---
  const allExpenseTransactions = [
    ...filteredTransactions.filter((t: Transaction) => t.type === 'expense'),
    ...allPropertyTransactions.filter((t: Transaction) => t.type === 'expense')
  ];

  // Fetch buildings, shops, and tenants for property dashboard calculations
  const { data: buildings = [], isLoading: buildingsLoading } = useQuery<any[]>({
    queryKey: ['/api/buildings'],
    queryFn: async () => {
      const res = await fetch('/api/buildings', { credentials: 'include' });
      if (!res.ok) return [];
      return res.json();
    }
  });

  const { data: shops = [] } = useQuery<any[]>({
    queryKey: ['/api/shops'],
    queryFn: async () => {
      const res = await fetch('/api/shops', { credentials: 'include' });
      if (!res.ok) return [];
      return res.json();
    }
  });

  const { data: tenants = [] } = useQuery<any[]>({
    queryKey: ['/api/tenants'],
    queryFn: async () => {
      const res = await fetch('/api/tenants', { credentials: 'include' });
      if (!res.ok) return [];
      return res.json();
    }
  });
  const accountTotals: { [key: string]: number } = {};
  let accountTotalExpenses = 0;
  allExpenseTransactions.forEach((t: Transaction) => {
    const acc = accounts.find((a) => a.id === t.accountId);
    const name = acc?.name || 'Unknown Account';
    accountTotals[name] = (accountTotals[name] || 0) + Number(t.amount);
    accountTotalExpenses += Number(t.amount);
  });
  const accountBreakdown = Object.entries(accountTotals).map(([name, value], idx) => ({
    name,
    percent: accountTotalExpenses > 0 ? Math.round((value / accountTotalExpenses) * 100) : 0,
    fill: COLORS[idx % COLORS.length]
  }));

  const isLoading = mode === 'personal' ? personalLoading : propertyLoading;
  const data = mode === 'personal' ? personalData : propertyData;

  // Fetch all income transactions for the selected date range, regardless of context (for Total Income card)
  const { data: allIncomeTransactions = [] } = useQuery<any[]>({
    queryKey: ['/api/transactions', 'all-income', dateRange, customFrom, customTo],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append('type', 'income');
      // For chart, fetch all transactions in the selected date range
      if (dateRange !== 'custom') {
        const { from, to } = getPersonalDateRange(dateRange);
        if (from) params.append('dateFrom', from.toISOString());
        if (to) params.append('dateTo', to.toISOString());
      } else {
        // For custom range, always append both dateFrom and dateTo
        if (customFrom) params.append('dateFrom', new Date(customFrom).toISOString());
        if (customTo) {
          // --- Fix: set customTo to end of day for inclusive filtering ---
          const d = new Date(customTo);
          // Use UTC toISOString for backend comparison
          const endOfDay = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999));
          params.append('dateTo', endOfDay.toISOString());
        }
      }
      const res = await fetch(`/api/transactions?${params}`, { credentials: 'include' });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: mode === 'personal',
  });

  // Calculate total initial balances for all accounts (exclude chitfund/investment)
  // Only include accounts whose creation date is within or before the selected date range
  const totalInitialBalance = accounts
    .filter(acc =>
      acc.accountType !== 'chitfund' &&
      acc.accountType !== 'investment' &&
      acc.createdAt &&
      (
        // Only include if filterTo is defined and account was created before or on filterTo (match analytics logic)
        filterTo ? new Date(acc.createdAt) <= filterTo : true
      )
    )
    .reduce((sum, acc) => sum + Number(acc.initialBalance || 0), 0);


  // Calculate totalIncome for personal dashboard: sum of all income transactions (do not add initial balance)
  let totalIncome = 0;
  let rentalIncome = 0;
  let advanceIncome = 0;
  let computedTotalIncome = 0;
  if (mode === 'personal' && allIncomeTransactions.length && categories.length) {
    // --- Fix: For custom range, ensure filterTo is end of day in UTC ---
    let effectiveFilterTo = filterTo;
    if (dateRange === "custom" && customTo) {
      const d = new Date(customTo);
      effectiveFilterTo = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999));
    }

    // Filter income transactions by selected date range
    const filteredIncomeTransactions = allIncomeTransactions.filter((t: Transaction) => {
      if (!t.transactionDate) return false;
      const d = new Date(t.transactionDate);
      if (filterFrom && d < filterFrom) return false;
      if (effectiveFilterTo && d > effectiveFilterTo) return false;
      return true;
    });

    // Find advance category ids
    const advanceCatIds = categories
      .filter((c) =>
        (c.name?.toLowerCase() === "advance amount" || c.name?.toLowerCase() === "advance payment") &&
        c.context === "property"
      )
      .map((c) => c.id);

    rentalIncome = filteredIncomeTransactions.reduce((sum, t) => {
      if (t.type !== 'income') return sum;
      const cat = categories.find((c) => c.id === t.categoryId);
      const catName = cat?.name?.trim().toLowerCase() || '';
      const catCont = cat?.context?.trim().toLowerCase() || '';
      if (catName === 'rent' && catCont === 'property') {
        return sum + Number(t.amount);
      }
      return sum;
    }, 0);

    advanceIncome = filteredIncomeTransactions.reduce((sum, t) => {
      if (t.type !== 'income') return sum;
      if (advanceCatIds.includes(t.categoryId)) {
        return sum + Number(t.amount);
      }
      return sum;
    }, 0);

    const otherIncome = filteredIncomeTransactions.reduce((sum, t) => {
      if (t.type !== 'income') return sum;
      const cat = categories.find((c) => c.id === t.categoryId);
      const catName = cat?.name?.trim().toLowerCase() || '';
      if (
        catName !== 'rent' &&
        catName !== 'advance amount' &&
        catName !== 'advance payment'
      ) {
        return sum + Number(t.amount);
      }
      return sum;
    }, 0);

    computedTotalIncome = rentalIncome + advanceIncome + otherIncome;
    totalIncome = computedTotalIncome;
  } 

  // Calculate totalExpenses for personal dashboard: sum of all expense transactions only
  let totalExpenses = 0;
  if (mode === 'personal' && allTransactions.length) {
    // Always use filteredTransactions for selected date range
    totalExpenses = filteredTransactions
      .filter((t: Transaction) => t.type === 'expense')
      .reduce((sum, t) => sum + Number(t.amount), 0);
  }

  // Calculate netIncome and netIncomePercent for personal dashboard
  let netIncome = 0;
  let netIncomePercent = 0;
  if (mode === 'personal') {
    netIncome = totalIncome - totalExpenses;
    netIncomePercent = totalIncome > 0 ? (netIncome / totalIncome) * 100 : 0;
  }

  // Fetch all property income transactions for the selected date range (for Income by Building)
  const { data: propertyIncomeTransactions = [] } = useQuery<any[]>({
    queryKey: ['/api/transactions', 'property-income', propertyDateRange, propertyCustomFrom, propertyCustomTo],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append('context', 'property');
      params.append('type', 'income');
      const { from, to } = getPropertyDateRange(propertyDateRange);
      if (from) params.append('dateFrom', from.toISOString());
      if (to) params.append('dateTo', to.toISOString());
      const res = await fetch(`/api/transactions?${params}`, { credentials: 'include' });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: mode === 'property',
  });

  // --- Add: Fetch all property expense transactions for the selected date range ---
  const { data: propertyExpenseTransactions = [] } = useQuery<any[]>({
    queryKey: ['/api/transactions', 'property-expense', propertyDateRange, propertyCustomFrom, propertyCustomTo],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append('context', 'property');
      params.append('type', 'expense');
      const { from, to } = getPropertyDateRange(propertyDateRange);
      if (from) params.append('dateFrom', from.toISOString());
      if (to) params.append('dateTo', to.toISOString());
      const res = await fetch(`/api/transactions?${params}`, { credentials: 'include' });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: mode === 'property',
  });

  // --- Filter propertyIncomeTransactions by selected date range to ensure correct calculation ---
  const { from: propertyFilterFrom, to: propertyFilterTo } = getPropertyDateRange(propertyDateRange);
  const filteredPropertyIncomeTransactions = propertyIncomeTransactions.filter((t: Transaction) => {
    if (!t.transactionDate) return false;
    const d = new Date(t.transactionDate);
    let include = true;
    if (typeof propertyFilterFrom !== "undefined" && propertyFilterFrom !== undefined && d < propertyFilterFrom) include = false;
    if (propertyFilterTo && d > propertyFilterTo) include = false;
    return include;
  });

  // --- Filter propertyExpenseTransactions by selected date range ---
  const filteredPropertyExpenseTransactions = propertyExpenseTransactions.filter((t: Transaction) => {
    if (!t.transactionDate) return false;
    const d = new Date(t.transactionDate);
    if (typeof propertyFilterFrom !== "undefined" && propertyFilterFrom !== undefined && d < propertyFilterFrom) return false;
    if (propertyFilterTo && d > propertyFilterTo) return false;
    return true;
  });

  // State for Building Expenses Breakdown Pie Chart filter
  const [propertyExpenseRange, setPropertyExpenseRange] = useState<'thismonth' | 'lastmonth' | '3months' | '6months' | 'currentyear' | 'custom'>('thismonth');
  const [propertyExpenseCustomFrom, setPropertyExpenseCustomFrom] = useState('');
  const [propertyExpenseCustomTo, setPropertyExpenseCustomTo] = useState('');

  // Calculate totalIncome for property dashboard: sum of all filtered property income transactions
  let propertyModeTotalIncome = 0;
  if (mode === 'property' && filteredPropertyIncomeTransactions.length) {
    propertyModeTotalIncome = filteredPropertyIncomeTransactions
      .filter((t: Transaction) => t.type === 'income')
      .reduce((sum, t) => sum + Number(t.amount), 0);
  } 

  // Calculate totalExpenses for property dashboard: sum of all filtered property expense transactions only
  let propertyModeTotalExpenses = 0;
  if (mode === 'property' && filteredPropertyExpenseTransactions.length) {
    propertyModeTotalExpenses = filteredPropertyExpenseTransactions
      .filter((t: Transaction) => t.type === 'expense')
      .reduce((sum, t) => sum + Number(t.amount), 0);
  }

  // --- Use filteredPropertyIncomeTransactions for all property calculations below ---
  // Compute buildingIncomeMap, EXCLUDING Advance Amount unless transferred to an account
  let buildingIncomeMap: { [buildingId: string]: number } = {};
  if (mode === 'property' && Array.isArray(filteredPropertyIncomeTransactions) && categories.length && buildings.length) {
    // Find advance category ids
    const advanceCatIds = categories
      .filter((c) =>
        (c.name?.toLowerCase() === "advance amount" || c.name?.toLowerCase() === "advance payment") &&
        c.context === "property"
      )
      .map((c) => c.id);

    buildingIncomeMap = {};
    filteredPropertyIncomeTransactions.forEach((txn) => {
      // Only include income transactions
      if (txn.type !== 'income') return;
      let buildingId = txn.buildingId;
      if (!buildingId && txn.shopId && shops.length) {
        const shop = shops.find(s => Number(s.id) === Number(txn.shopId));
        buildingId = shop?.buildingId;
      }
      if (!buildingId && txn.buildingName && buildings.length) {
        const building = buildings.find(b => b.name === txn.buildingName);
        buildingId = building?.id;
      }
      if (!buildingId) return;
      // For advance amount, only include if transferred to an account
      if (advanceCatIds.includes(txn.categoryId)) {
        if (!txn.accountId) return;
      }
      buildingIncomeMap[buildingId] = (buildingIncomeMap[buildingId] || 0) + Number(txn.amount);
    });
  } else if (mode === 'property' && data && typeof (data as any).buildingIncomeMap === 'object') {
    buildingIncomeMap = (data as any).buildingIncomeMap ?? {};
  }

  // --- Compute buildingExpenseChartData for Building Expenses Breakdown Pie Chart ---
  let buildingExpenseChartData: { name: string; value: number; fill: string }[] = [];
  if (mode === 'property' && Array.isArray(filteredPropertyIncomeTransactions) && buildings.length) {
    // Fetch all property expense transactions for the selected date range
    const expenseTransactions = filteredPropertyIncomeTransactions.filter(
      (t: Transaction) => t.type === 'expense'
    );
    // Aggregate expenses by building
    const expenseTotals: { [buildingId: string]: number } = {};
    expenseTransactions.forEach((t: Transaction) => {
      let buildingId = t.buildingId;
      if (!buildingId && t.shopId && shops.length) {
        const shop = shops.find(s => Number(s.id) === Number(t.shopId));
        buildingId = shop?.buildingId;
      }
      if (!buildingId && t.buildingName && buildings.length) {
        const building = buildings.find(b => b.name === t.buildingName);
        buildingId = building?.id;
      }
      if (!buildingId) return;
      expenseTotals[buildingId] = (expenseTotals[buildingId] || 0) + Number(t.amount);
    });
    // Prepare chart data
    buildingExpenseChartData = Object.entries(expenseTotals).map(([buildingId, value], idx) => {
      const building = buildings.find(b => String(b.id) === String(buildingId));
      return {
        name: building?.name || `Building ${buildingId}`,
        value,
        fill: COLORS[idx % COLORS.length]
      };
    });
  }

  // Callback to refresh dashboard data after transaction/account add
  const handleRefresh = () => {
    if (mode === 'personal') {
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/personal'] });
      queryClient.invalidateQueries({ queryKey: ['/api/transactions', 'personal'] });
    } else {
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/property'] });
      queryClient.invalidateQueries({ queryKey: ['/api/transactions', 'property'] });
      queryClient.invalidateQueries({ queryKey: ['/api/accounts'] });
    }
  };

  // Fetch all transactions for property mode (for recent rent collections)
  const { data: propertyTransactions = [] } = useQuery<any[]>({
    queryKey: ['/api/transactions', 'property', 'all'],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append('context', 'property');
      params.append('type', 'income');
      // Optionally, you can limit or sort on backend, but we'll sort/filter below
      const res = await fetch(`/api/transactions?${params}`, { credentials: 'include' });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: mode === 'property',
  });

  // Compute recent rent collections (latest 5, partial or fully paid, from transactions)
  const recentRent = mode === 'property'
    ? (() => {
        // Find rent category ids (case-insensitive)
        const rentCategoryIds = categories
          .filter(c => c.name?.toLowerCase() === "rent")
          .map(c => c.id);

        return (propertyTransactions || [])
          .filter(
            (t) =>
              t.type === "income" &&
              rentCategoryIds.includes(t.categoryId)
          )
          .sort((a, b) => {
            // Sort descending: latest transactionDate first
            const timeA = a.transactionDate ? new Date(a.transactionDate).getTime() : 0;
            const timeB = b.transactionDate ? new Date(b.transactionDate).getTime() : 0;
            return timeB - timeA;
          })
          .slice(0, 5)
          .map((t) => {
            // --- Robust shop/building lookup: try by ID, fallback by name if needed ---
            let shop = shops.find(s => Number(s.id) === Number(t.shopId));
            let shopName = shop?.name;
            if (!shopName) {
              shopName = shop?.shopNumber ? `Shop ${shop.shopNumber}` : undefined;
            }
            if (!shopName && t.shopName) shopName = t.shopName;
            if (!shopName) shopName = "Unknown Shop";
            let building: any = undefined;
            if (shop && shop.buildingId) {
              building = buildings.find(b => Number(b.id) === Number(shop.buildingId));
            }
            let buildingName = building?.name;
            if (!buildingName && t.buildingName) buildingName = t.buildingName;
            if (!buildingName) buildingName = "Unknown Building";
            const tenant = t.tenantId ? tenants.find(tt => tt.id === t.tenantId) : undefined;
            return {
              id: t.id,
              tenantName: tenant?.name || "Unassigned",
              shopName,
              buildingName,
              amount: Number(t.amount ?? 0),
              date: t.transactionDate,
              status: t.status || (t.amount && shop && shop.monthlyRent && Number(t.amount) < Number(shop.monthlyRent) ? 'partial' : 'paid'),
              emoji: '🏪',
            };
          });
      })()
    : [];

  // Add this state for current date (for header display)
  const [currentDate, setCurrentDate] = useState(new Date());
  useEffect(() => {
    // Update every 2 seconds to keep date fresh
    const interval = setInterval(() => setCurrentDate(new Date()), 2000);
    return () => clearInterval(interval);
  }, []);

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="grid grid-cols-4 gap-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-32 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Calculate propertyExpenses for personal dashboard: sum of all property expense transactions in selected date range
  let propertyExpenses = 0;
  if (mode === 'personal' && allPropertyTransactions.length) {
    propertyExpenses = allPropertyTransactions
      .filter((t: Transaction) => {
        if (t.type !== 'expense' || !t.transactionDate) return false;
        const d = new Date(t.transactionDate);
        if (filterFrom && d < filterFrom) return false;
        if (filterTo && d > filterTo) return false;
        return true;
      })
      .reduce((sum, t) => sum + Number(t.amount), 0);
  }

  // Helper: For a given account, find its balance as of a given date (using transactions or initialBalance)
// Use all transactions (personal + property) up to the given date, regardless of context or selected range
function getAccountBalanceAsOf(
  account: BankAccount,
  personalTxns: Transaction[],
  propertyTxns: Transaction[],
  asOf: Date
): number {
  if (
    personalTxns.length > 0 &&
    personalTxns.some(
      t =>
        t.accountId === account.id &&
        t.transactionDate &&
        new Date(t.transactionDate) > asOf
    )
  ) {
    // ...
  }
  if (
    propertyTxns.length > 0 &&
    propertyTxns.some(
      t =>
        t.accountId === account.id &&
        t.transactionDate &&
        new Date(t.transactionDate) > asOf
    )
  ) {
    // ...
  }

  const txns = [...personalTxns, ...propertyTxns]
    .filter(
      t =>
        t.accountId === account.id &&
        t.transactionDate &&
        new Date(t.transactionDate) <= asOf
    )
    .sort(
      (a, b) =>
        new Date(a.transactionDate ?? '').getTime() -
        new Date(b.transactionDate ?? '').getTime()
    );
  if (txns.length > 0) {
    const lastTxn = txns[txns.length - 1];
    if (
      typeof lastTxn.runningBalance !== "undefined" &&
      lastTxn.runningBalance !== null
    ) {
      return Number(lastTxn.runningBalance);
    }
    let sum = Number(account.initialBalance || 0);
    txns.forEach(t => {
      sum += t.type === "income" ? Number(t.amount) : -Number(t.amount);
    });
    return sum;
  } else if (account.createdAt && new Date(account.createdAt) <= asOf) {
    return Number(account.initialBalance || 0);
  }
  return 0;
}

// (Removed duplicate declaration of allPersonalTxnsAllTime and allPropertyTxnsAllTime)

  return (
    <>
      {/* --- AddTransactionModal for personal mode --- */}
      <AddTransactionModal
        isOpen={showAddTransactionModal}
        onClose={() => setShowAddTransactionModal(false)}
        context={mode}
        onSuccess={handleRefresh}
      />
      {/* --- AddAccountModal (if needed) --- */}
      <AddAccountModal
        isOpen={showAddAccountModal}
        onClose={() => setShowAddAccountModal(false)}
        onSuccess={handleRefresh}
      />
      <TopBar 
        user={user}
        title="Dashboard"
        rightContent={
          undefined
        }
        showModeSelector={true}
        currentMode={mode}
        onModeChange={(newMode) => setMode(newMode as 'personal' | 'property')}
      />
      <div className="p-6">
        {mode === 'personal' && personalData && (
          <>
          {(() => {
            // Debug block for netSavings calculation
            if (dateRange !== "current" && filterTo) {
              accounts
                .filter(
                  acc =>
                    acc.accountType !== "chitfund" &&
                    acc.accountType !== "investment" &&
                    acc.createdAt &&
                    new Date(acc.createdAt) <= filterTo
                )
                .forEach(acc => {
                  const bal = getAccountBalanceAsOf(
                    acc,
                    allPersonalTxnsAllTime,
                    allPropertyTxnsAllTime,
                    filterTo
                  );
                });
            }
            return null;
          })()}
            <PersonalDashboardCards
              data={{
                totalIncome,
                rentalIncome,
                advanceIncome,
                totalExpenses,
                netSavings:
                  dateRange === "current"
                    ? accounts
                        // Remove accountType filter: include all accounts for transaction activity,
                        // but exclude initialBalance for investment/chitfund/fixed deposit
                        .filter(
                          acc =>
                            acc.currentBalance !== null &&
                            acc.currentBalance !== undefined
                        )
                        .reduce(
                          (sum, acc) => {
                            // Exclude initialBalance for investment/chitfund/fixed deposit
                            const type = (acc.accountType || '').toLowerCase();
                            if (
                              (type === "investment" || type === "chitfund" || type === "fixed_deposit") &&
                              acc.initialBalance
                            ) {
                              // Subtract initialBalance from currentBalance for these types
                              return sum + (Number(acc.currentBalance || 0) - Number(acc.initialBalance || 0));
                            }
                            return sum + Number(acc.currentBalance || 0);
                          },
                          0
                        )
                    : (() => {
                        if (!filterTo) return 0;
                        const result = accounts
                          // Remove accountType filter: include all accounts for transaction activity,
                          // but exclude initialBalance for investment/chitfund/fixed deposit
                          .filter(
                            acc =>
                              acc.createdAt &&
                              new Date(acc.createdAt) <= filterTo
                          )
                          .reduce(
                            (sum, acc) => {
                              const type = (acc.accountType || '').toLowerCase();
                              if (
                                (type === "investment" || type === "chitfund" || type === "fixed deposit") &&
                                acc.initialBalance
                              ) {
                                // Subtract initialBalance from computed balance for these types
                                return sum +
                                  (getAccountBalanceAsOf(
                                    acc,
                                    allPersonalTxnsAllTime,
                                    allPropertyTxnsAllTime,
                                    filterTo
                                  ) - Number(acc.initialBalance || 0));
                              }
                              return sum +
                                getAccountBalanceAsOf(
                                  acc,
                                  allPersonalTxnsAllTime,
                                  allPropertyTxnsAllTime,
                                  filterTo
                                );
                            },
                            0
                          );
                        return result;
                    })(),
                savingsRate:
                  dateRange === "current"
                    ? (() => {
                        // Use the same logic as netSavings above for consistency
                        const netSavings = accounts
                          .filter(
                            acc =>
                              acc.currentBalance !== null &&
                              acc.currentBalance !== undefined
                          )
                          .reduce(
                            (sum, acc) => {
                              const type = (acc.accountType || '').toLowerCase();
                              if (
                                (type === "investment" || type === "chitfund" || type === "fixed deposit") &&
                                acc.initialBalance
                              ) {
                                return sum + (Number(acc.currentBalance || 0) - Number(acc.initialBalance || 0));
                              }
                              return sum + Number(acc.currentBalance || 0);
                            },
                            0
                          );
                        const denominator = netSavings + totalExpenses;
                        return denominator === 0
                          ? 0
                          : (netSavings / denominator) * 100;
                    })()
                    : (() => {
                        if (!filterTo) return 0;
                        const netSavings = accounts
                          .filter(
                            acc =>
                              acc.createdAt &&
                              new Date(acc.createdAt) <= filterTo
                          )
                          .reduce(
                            (sum, acc) => {
                              const type = (acc.accountType || '').toLowerCase();
                              if (
                                (type === "investment" || type === "chitfund" || type === "fixed deposit") &&
                                acc.initialBalance
                              ) {
                                return sum +
                                  (getAccountBalanceAsOf(
                                    acc,
                                    allPersonalTxnsAllTime,
                                    allPropertyTxnsAllTime,
                                    filterTo
                                  ) - Number(acc.initialBalance || 0));
                              }
                              return sum +
                                getAccountBalanceAsOf(
                                  acc,
                                  allPersonalTxnsAllTime,
                                  allPropertyTxnsAllTime,
                                  filterTo
                                );
                            },
                            0
                          );
                        const denominator = netSavings + totalExpenses;
                        return denominator === 0
                          ? 0
                          : (netSavings / denominator) * 100;
                    })(),
                propertyExpenses,
                netIncome, // <-- Add this line
                netIncomePercent // <-- Add this line
              }}
            />

            {/* Sorting dropdown for personal expense tracker */}
            <div className="flex flex-col gap-2 mb-6">
              <div className="flex items-center">
                <span className="font-medium mr-3">Filter by Date:</span>
                <Select value={dateRange} onValueChange={v => setDateRange(v as any)}>
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="current">Current Month</SelectItem>
                    <SelectItem value="lastmonth">Last Month</SelectItem>
                    <SelectItem value="3months">Last 3 Months</SelectItem>
                    <SelectItem value="6months">Last 6 Months</SelectItem>
                    <SelectItem value="currentyear">Current Year</SelectItem>
                    <SelectItem value="custom">Custom</SelectItem>
                  </SelectContent>
                </Select>
                {dateRange === 'custom' && (
                  <div className="flex gap-2 ml-4">
                    <div className="w-32">
                      <Input
                        type="date"
                        value={customFrom}
                        onChange={e => setCustomFrom(e.target.value)}
                        placeholder="From"
                      />
                    </div>
                    <div className="w-32">
                      <Input
                        type="date"
                        value={customTo}
                        onChange={e => setCustomTo(e.target.value)}
                        placeholder="To"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
              {/* Spending Chart */}
              <div className="lg:col-span-2">
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle>Spending by Category</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {/* --- Updated Pie Chart to match analytics style --- */}
                    <div className="h-96 flex flex-col items-center justify-center">
                      {chartData.length === 0 ? (
                        <div className="flex items-center justify-center h-full text-gray-500 text-lg">
                          No Data Found For The Selected Dates
                        </div>
                      ) : (
                        <div className="flex flex-col items-center w-full">
                          <ResponsiveContainer width={400} height={300}>
                            <PieChart>
                              <Pie
                                data={chartData}
                                cx="50%"
                                cy="50%"
                                outerRadius={120}
                                dataKey="value"
                                label={false}
                                minAngle={2} // <-- Ensures even small slices (like 0.1%) are visible
                              >
                                {chartData.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={entry.fill} />
                                ))}
                              </Pie>
                              <Tooltip
                                formatter={(value: number, name: string, props: any) => [
                                  `₹${Number(value).toLocaleString()}`,
                                  chartData[props.dataIndex]?.name || name
                                ]}
                                contentStyle={{ fontSize: '14px' }}
                                labelFormatter={() => ""}
                              />
                            </PieChart>
                          </ResponsiveContainer>
                          {/* Custom Legend below the pie chart */}
                          <div className="flex flex-wrap justify-center mt-4 w-full">
                            {chartData.map((entry, idx) => {
                              const percent = chartTotalExpenses > 0 ? (entry.value / chartTotalExpenses) * 100 : 0;
                              return (
                                <div
                                  key={entry.name}
                                  className="flex items-center mx-3 mb-2 text-xs"
                                >
                                  <span
                                    className="inline-block w-3 h-3 rounded-full mr-1"
                                    style={{ backgroundColor: entry.fill }}
                                  ></span>
                                  <span className="font-medium text-gray-900 mr-1">{entry.name}</span>
                                  <span className="text-gray-600">{percent.toFixed(1)}%</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Account Breakdown */}
              <Card>
                <CardHeader>
                  <CardTitle>Account Breakdown</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {accountBreakdown.length === 0 ? (
                    <div className="text-gray-500 text-center py-8">No expense data available</div>
                  ) : (
                    accountBreakdown.map((acc, idx) => (
                      <div key={acc.name} className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className="h-3 w-3 rounded-full" style={{ backgroundColor: acc.fill }}></div>
                          <span className="text-sm text-gray-700">{acc.name}</span>
                        </div>
                        <span className="text-sm font-medium">{acc.percent}%</span>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Recent Transactions */}
              <TransactionsList 
                transactions={recentTransactions}
              />

              {/* Quick Actions */}
              <Card>
                <CardHeader>
                  <CardTitle>Quick Actions</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                    <Button
                      variant="outline"
                      className="flex flex-col items-center justify-center p-4 h-auto space-y-2"
                      onClick={() => setShowAddTransactionModal(true)}
                    >
                      <div className="h-12 w-12 bg-primary rounded-lg flex items-center justify-center">
                        <Plus className="text-primary-foreground" />
                      </div>
                      <span className="text-sm font-medium">Add Transaction</span>
                    </Button>
                    
                    <Button
                      variant="outline"
                      className="flex flex-col items-center justify-center p-4 h-auto space-y-2"
                      onClick={() => setShowAddAccountModal(true)}
                    >
                      <div className="h-12 w-12 bg-green-600 rounded-lg flex items-center justify-center">
                        <University className="text-white" />
                      </div>
                      <span className="text-sm font-medium">Add Account</span>
                    </Button>
                    
                    <Button
                      variant="outline"
                      className="flex flex-col items-center justify-center p-4 h-auto space-y-2"
                      onClick={() => navigate('/transfers')}
                    >
                      <div className="h-12 w-12 bg-orange-600 rounded-lg flex items-center justify-center">
                        <ArrowLeftRight className="text-white" />
                      </div>
                      <span className="text-sm font-medium">Transfer Money</span>
                    </Button>
                    
                    <Button
                      variant="outline"
                      className="flex flex-col items-center justify-center p-4 h-auto space-y-2"
                      onClick={() => navigate('/backup')}
                    >
                      <div className="h-12 w-12 bg-gray-600 rounded-lg flex items-center justify-center">
                        <Download className="text-white" />
                      </div>
                      <span className="text-sm font-medium">Backup Data</span>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </>
        )}

        {mode === 'property' && propertyData && (
          <>
            <PropertyDashboardCards data={{
              // Only pass filtered/calculated values for the selected date range
              totalIncome: propertyModeTotalIncome,
              totalExpenses: propertyModeTotalExpenses,
              netIncome: propertyModeTotalIncome - propertyModeTotalExpenses,
              pendingRent: propertyData?.pendingRent ?? 0, // <-- Use backend value if available
              shops,
              tenants,
              categories,
              transactions: filteredPropertyIncomeTransactions,
              // buildingIncomeMap, // <-- Remove this line
            }} />

            {/* Sorting dropdown for property management */}
            <div className="flex flex-col gap-2 mb-6">
              <div className="flex items-center">
                <span className="font-medium mr-3">Filter by Date:</span>
                <Select value={propertyDateRange} onValueChange={v => setPropertyDateRange(v as any)}>
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="current">Current Month</SelectItem>
                    <SelectItem value="lastmonth">Last Month</SelectItem>
                    <SelectItem value="3months">Last 3 Months</SelectItem>
                    <SelectItem value="6months">Last 6 Months</SelectItem>
                    <SelectItem value="currentyear">Current Year</SelectItem>
                    <SelectItem value="custom">Custom</SelectItem>
                  </SelectContent>
                </Select>
                {propertyDateRange === 'custom' && (
                  <div className="flex gap-2 ml-4">
                    <div className="w-32">
                      <Input
                        type="date"
                        value={propertyCustomFrom}
                        onChange={e => setPropertyCustomFrom(e.target.value)}
                        placeholder="From"
                      />
                    </div>
                    <div className="w-32">
                      <Input
                        type="date"
                        value={propertyCustomTo}
                        onChange={e => setPropertyCustomTo(e.target.value)}
                        placeholder="To"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Income by Building */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>Income by Building</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {buildingsLoading ? (
                    <div className="text-gray-500 text-center py-8">Loading...</div>
                  ) : buildings.length === 0 ? (
                    <div className="text-gray-500 text-center py-8">No building data available</div>
                  ) : (
                    buildings.map((b) => {
                      // --- Fix: Ensure buildingIncomeMap keys are compared as numbers and fallback by name if needed ---
                      let income = 0;
                      if (buildingIncomeMap && Object.keys(buildingIncomeMap).length > 0) {
                        income = buildingIncomeMap[b.id] || 0;
                        // Fallback: try to sum by building name if id not found
                        if (!income && b.name) {
                          // Try to find a key in buildingIncomeMap where building name matches
                          const altKey = Object.keys(buildingIncomeMap).find(key => {
                            const building = buildings.find(bb => bb.id === Number(key));
                            return building && building.name === b.name;
                          });
                          if (altKey) income = buildingIncomeMap[altKey];
                        }
                      }
                      return (
                        <div key={b.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <div>
                            <span className="font-medium text-gray-900">{b.name}</span>
                            <span className="block text-xs text-gray-500">
                              {/* Use currentDate for header date */}
                              {currentDate.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })}
                            </span>
                          </div>
                          <span className="font-bold text-green-600">
                            ₹{Number(income).toLocaleString()}
                          </span>
                        </div>
                      );
                    })
                  )}
                </CardContent>
              </Card>

              {/* Recent Rent Collections */}
              <Card>
                <CardHeader>
                  <CardTitle>Recent Rent Collections</CardTitle>
                </CardHeader>
                <CardContent>
                  {/* Define rentLoading as propertyLoading */}
                  {(() => { const rentLoading = propertyLoading; return (
                  <div className="space-y-4">
                    {rentLoading ? (
                      <div className="text-gray-500 text-center py-8">Loading...</div>
                    ) : recentRent.length === 0 ? (
                      <div className="text-gray-500 text-center py-8">No rent collections found</div>
                    ) : (
                      recentRent.map((r) => (
                        <div key={r.id} className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${
                              r.status === 'partial' ? 'bg-orange-100' : 'bg-green-100'
                            }`}>
                              <span className={`text-sm ${
                                r.status === 'partial' ? 'text-orange-600' : 'text-green-600'
                              }`}>{r.emoji || '🏪'}</span>
                            </div>
                            <div>
                              <p className="text-sm font-medium text-gray-900">
                                {r.tenantName} - {r.shopName}
                              </p>
                              <p className="text-xs text-gray-500">
                                {r.buildingName} • {r.date && !isNaN(new Date(r.date).getTime())
                                  ? new Date(r.date).toLocaleDateString()
                                  : "Unknown Date"}
                              </p>
                            </div>
                          </div>
                          <span className={`text-sm font-medium ${
                            r.status === 'partial' ? 'text-orange-600' : 'text-green-600'
                          }`}>
                            ₹{r.amount.toLocaleString()}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                  ); })()}
                </CardContent>
              </Card>
            </div>

            {/* --- Building Expenses Breakdown Pie Chart --- */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>Building Expenses Breakdown</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="h-64">
                    {buildingExpenseChartData.length === 0 ? (
                      <div className="flex items-center justify-center h-full text-gray-500 text-lg">
                        No Expense Data Found For The Selected Dates
                      </div>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={buildingExpenseChartData}
                            cx="50%"
                            cy="50%"
                            outerRadius={80}
                            dataKey="value"
                            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(1)}%`}
                            minAngle={2} // <-- Ensures even small slices are visible
                          >
                            {buildingExpenseChartData.map((entry, index) => (
                              <Cell key={`cell-expense-${index}`} fill={entry.fill} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(value) => [`₹${Number(value).toLocaleString()}`, 'Amount']} />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </CardContent>
              </Card>
              {/* Optionally, add another card or leave blank for layout symmetry */}
              <div></div>
            </div>
          </>
        )}
      </div>
    </>
  );
}
