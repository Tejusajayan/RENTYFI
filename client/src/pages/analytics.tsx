import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import TopBar from "@/components/TopBar";
import { useAuth } from "@/hooks/useAuth";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, BarChart, Bar, PieChart, Pie, Cell } from 'recharts';
import { Transaction, BankAccount, Category } from "@shared/schema";
import { PiggyBank, ArrowDownCircle, Wallet, Percent, ArrowUp } from "lucide-react";

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316'];

// Helper function to get date range for analytics
function getAnalyticsDateRange(
  dateRange: 'current' | 'lastmonth' | '3months' | '6months' | 'uptodate' | 'custom' | 'currentyear', // <-- add currentyear
  customFrom: string,
  customTo: string
): { from?: Date; to?: Date } {
  const now = new Date();
  let from: Date | undefined, to: Date | undefined;
  switch (dateRange) {
    case 'current':
      from = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      to = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      break;
    case 'lastmonth':
      from = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
      to = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
      break;
    case '3months': {
      // Last 3 completed months (e.g. if today is Oct 1, 2023: July 1 - Sep 30, 2023)
      const prevMonth = new Date(now.getFullYear(), now.getMonth(), 0); // last day of previous month
      to = new Date(prevMonth.getFullYear(), prevMonth.getMonth(), prevMonth.getDate(), 23, 59, 59, 999);
      const fromMonth = new Date(prevMonth.getFullYear(), prevMonth.getMonth() - 2, 1, 0, 0, 0, 0);
      from = fromMonth;
      break;
    }
    case '6months': {
      // Last 6 completed months
      const prevMonth = new Date(now.getFullYear(), now.getMonth(), 0);
      to = new Date(prevMonth.getFullYear(), prevMonth.getMonth(), prevMonth.getDate(), 23, 59, 59, 999);
      const fromMonth = new Date(prevMonth.getFullYear(), prevMonth.getMonth() - 5, 1, 0, 0, 0, 0);
      from = fromMonth;
      break;
    }
    case 'currentyear':
      from = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
      to = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
      break;
    case 'uptodate':
      from = new Date(2000, 0, 1, 0, 0, 0, 0);
      to = now;
      break;
    case 'custom':
      if (customFrom) from = new Date(customFrom);
      if (customTo) to = new Date(customTo);
      break;
  }
  return { from, to };
}

export default function Analytics() {
  // Change default to 'current'
  const [dateRange, setDateRange] = useState<'current' | 'lastmonth' | '3months' | '6months' | 'uptodate' | 'custom' | 'currentyear'>('current'); // <-- add currentyear
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [categoryContext, setCategoryContext] = useState<'personal' | 'property'>('personal');
  const user = useAuth();

  // --- Fetch all-time/cumulative data for summary cards ---
  const { data: personalData = {} } = useQuery<any>({
    queryKey: ['/api/dashboard/personal', 'alltime'],
    queryFn: async () => {
      const res = await fetch(`/api/dashboard/personal`, { credentials: 'include' });
      return res.json();
    }
  });

  const { data: transactions = [] } = useQuery<Transaction[]>({
    queryKey: ['/api/transactions', 'personal', dateRange, customFrom, customTo],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append('context', 'personal');

      // Set date range
      const now = new Date();
      let dateFrom: Date | undefined, dateTo: Date | undefined;

      switch (dateRange) {
        case 'current':
          dateFrom = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
          dateTo = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
          break;
        case 'lastmonth':
          dateFrom = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
          dateTo = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
          break;
        case '3months':
          dateFrom = new Date(now.getFullYear(), now.getMonth() - 2, 1, 0, 0, 0, 0);
          dateTo = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
          break;
        case '6months':
          dateFrom = new Date(now.getFullYear(), now.getMonth() - 5, 1, 0, 0, 0, 0);
          dateTo = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
          break;
        case 'currentyear':
          dateFrom = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
          dateTo = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
          break;
        case 'uptodate':
          dateFrom = new Date(2000, 0, 1, 0, 0, 0, 0); // Arbitrary early date
          // FIX: Set dateTo to end of today, not just now
          dateTo = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
          break;
        case 'custom':
          if (customFrom) dateFrom = new Date(customFrom);
          if (customTo) dateTo = new Date(customTo);
          break;
      }

      if (dateFrom) params.append('dateFrom', dateFrom.toISOString());
      if (dateTo) params.append('dateTo', dateTo.toISOString());

      const res = await fetch(`/api/transactions?${params}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch transactions');
      return res.json();
    }
  });

  const { data: accounts = [] } = useQuery<BankAccount[]>({
    queryKey: ['/api/accounts']
  });

  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ['/api/categories', 'personal']
  });

  // --- Fetch all income transactions for analytics (no context filter) ---
  const { data: allIncomeTransactions = [] } = useQuery<Transaction[]>({
    queryKey: ['/api/transactions', 'all-income', dateRange, customFrom, customTo],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append('type', 'income');
      // Set date range
      const now = new Date();
      let dateFrom: Date | undefined, dateTo: Date | undefined;
      switch (dateRange) {
        case 'current':
          dateFrom = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
          dateTo = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
          break;
        case 'lastmonth':
          dateFrom = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
          dateTo = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
          break;
        case '3months':
          dateFrom = new Date(now.getFullYear(), now.getMonth() - 2, 1, 0, 0, 0, 0);
          dateTo = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
          break;
        case '6months':
          dateFrom = new Date(now.getFullYear(), now.getMonth() - 5, 1, 0, 0, 0, 0);
          dateTo = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
          break;
        case 'currentyear':
          dateFrom = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
          dateTo = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
          break;
        case 'uptodate':
          dateFrom = new Date(2000, 0, 1, 0, 0, 0, 0);
          // FIX: Set dateTo to end of today
          dateTo = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
          break;
        case 'custom':
          if (customFrom) dateFrom = new Date(customFrom);
          if (customTo) dateTo = new Date(customTo);
          break;
      }
      if (dateFrom) params.append('dateFrom', dateFrom.toISOString());
      if (dateTo) params.append('dateTo', dateTo.toISOString());
      const res = await fetch(`/api/transactions?${params}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch income transactions');
      return res.json();
    }
  });

  // --- Fetch all property expense transactions for analytics ---
  const { data: allPropertyExpenseTransactions = [] } = useQuery<Transaction[]>({
    queryKey: ['/api/transactions', 'property-expense', dateRange, customFrom, customTo],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append('context', 'property');
      params.append('type', 'expense');
      // Set date range
      const now = new Date();
      let dateFrom: Date | undefined, dateTo: Date | undefined;
      switch (dateRange) {
        case 'current':
          dateFrom = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
          dateTo = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
          break;
        case 'lastmonth':
          dateFrom = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
          dateTo = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
          break;
        case '3months':
          dateFrom = new Date(now.getFullYear(), now.getMonth() - 2, 1, 0, 0, 0, 0);
          dateTo = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
          break;
        case '6months':
          dateFrom = new Date(now.getFullYear(), now.getMonth() - 5, 1, 0, 0, 0, 0);
          dateTo = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
          break;
        case 'currentyear':
          dateFrom = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
          dateTo = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
          break;
        case 'uptodate':
          dateFrom = new Date(2000, 0, 1, 0, 0, 0, 0);
          // FIX: Set dateTo to end of today
          dateTo = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
          break;
        case 'custom':
          if (customFrom) dateFrom = new Date(customFrom);
          if (customTo) dateTo = new Date(customTo);
          break;
      }
      if (dateFrom) params.append('dateFrom', dateFrom.toISOString());
      if (dateTo) params.append('dateTo', dateTo.toISOString());
      const res = await fetch(`/api/transactions?${params}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch property expense transactions');
      return res.json();
    }
  });

  // --- Fetch all-time transactions for net savings calculation (must be at the top level) ---
  const { data: allPersonalTxnsAllTime = [] } = useQuery<any[]>({
    queryKey: ['/api/transactions', 'personal', 'alltime'],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append('context', 'personal');
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
      const res = await fetch(`/api/transactions?${params}`, { credentials: 'include' });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: true,
  });

  // --- Use the same date range for charts as for dashboard cards ---
  let analyticsDateRange = getAnalyticsDateRange(dateRange, customFrom, customTo);

  // --- Fix: For custom range, include the entire "to" day ---
  if (dateRange === "custom" && customTo) {
    const toDate = new Date(customTo);
    analyticsDateRange.to = new Date(
      toDate.getFullYear(),
      toDate.getMonth(),
      toDate.getDate(),
      23, 59, 59, 999
    );
  }
  // FIX: For uptodate, include the entire current day
  if (dateRange === "uptodate") {
    const now = new Date();
    analyticsDateRange.to = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      23, 59, 59, 999
    );
  }

  const filterFrom = analyticsDateRange.from;
  const filterTo = analyticsDateRange.to;

  // Use all personal and property transactions for the selected range for charts
  // Move these declarations ABOVE all usages of filteredPersonalTxns/filteredPropertyTxns!
  const filteredPersonalTxns = allPersonalTxnsAllTime.filter((t: any) => {
    if (!t.transactionDate) return false;
    const d = new Date(t.transactionDate);
    if (filterFrom && d < filterFrom) return false;
    if (filterTo && d > filterTo) return false;
    return true;
  });
  const filteredPropertyTxns = allPropertyTxnsAllTime.filter((t: any) => {
    if (!t.transactionDate) return false;
    const d = new Date(t.transactionDate);
    if (filterFrom && d < filterFrom) return false;
    if (filterTo && d > filterTo) return false;
    return true;
  });

  // Debug: Print filtered transactions for the selected range
  console.log("DEBUG filteredPersonalTxns", filteredPersonalTxns);
  console.log("DEBUG filteredPropertyTxns", filteredPropertyTxns);

  // Calculate total expenses: sum of all expense transactions in the selected range
  const totalPersonalExpenses = filteredPersonalTxns
    .filter((t: any) => t.type === 'expense')
    .reduce((sum: number, t: any) => sum + Number(t.amount), 0);

  const totalPropertyExpenses = filteredPropertyTxns
    .filter((t: any) => t.type === 'expense')
    .reduce((sum: number, t: any) => sum + Number(t.amount), 0);

  const totalExpenses = totalPersonalExpenses + totalPropertyExpenses;

  // Debug: Print calculated total expenses
  console.log("DEBUG totalPersonalExpenses", totalPersonalExpenses);
  console.log("DEBUG totalPropertyExpenses", totalPropertyExpenses);
  console.log("DEBUG totalExpenses", totalExpenses);

  // --- Corrected: Calculate total income for the selected range using allPersonalTxnsAllTime/allPropertyTxnsAllTime ---
  const totalPersonalIncome = filteredPersonalTxns
    .filter((t: any) => t.type === 'income')
    .reduce((sum: number, t: any) => sum + Number(t.amount), 0);

  const totalPropertyIncome = filteredPropertyTxns
    .filter((t: any) => t.type === 'income')
    .reduce((sum: number, t: any) => sum + Number(t.amount), 0);

  const totalIncome = totalPersonalIncome + totalPropertyIncome;

  // Debug: Print calculated total income
  console.log("DEBUG totalPersonalIncome", totalPersonalIncome);
  console.log("DEBUG totalPropertyIncome", totalPropertyIncome);
  console.log("DEBUG totalIncome", totalIncome);

  // --- Net savings calculation (dashboard logic) ---
  // Helper function to calculate account balance as of a specific date
  function getAccountBalanceAsOf(
    account: BankAccount,
    allPersonalTxns: Transaction[],
    allPropertyTxns: Transaction[],
    asOfDate: Date
  ): number {
    if (!account.createdAt || new Date(account.createdAt) > asOfDate) {
      return 0;
    }
    // Only include transactions for this account up to asOfDate
    const txns = [
      ...allPersonalTxns,
      ...allPropertyTxns
    ].filter(
      (t) =>
        t.accountId === account.id &&
        t.transactionDate &&
        new Date(t.transactionDate) <= asOfDate
    );
    const txnSum = txns.reduce((sum, t) => {
      if (t.type === "income") {
        return sum + Number(t.amount);
      } else if (t.type === "expense") {
        return sum - Number(t.amount);
      }
      return sum;
    }, 0);
    return Number(account.initialBalance || 0) + txnSum;
  }

  let netSavings: number;
  if (dateRange === "current") {
    netSavings = accounts
      // Remove accountType filter: include all accounts for transaction activity,
      // but exclude initialBalance for investment/chitfund/fixed_deposit
      .filter(
        acc =>
          acc.currentBalance !== null && acc.currentBalance !== undefined
      )
      .reduce((sum, acc: any) => {
        const type = (acc.accountType || '').toLowerCase();
        if (
          (type === "investment" || type === "chitfund" || type === "fixed_deposit" || type === "fixed deposit") &&
          acc.initialBalance
        ) {
          // Subtract initialBalance from currentBalance for these types
          return sum + (Number(acc.currentBalance || 0) - Number(acc.initialBalance || 0));
        }
        return sum + Number(acc.currentBalance || 0);
      }, 0);
  } else if (filterTo) {
    netSavings = accounts
      // Remove accountType filter: include all accounts for transaction activity,
      // but exclude initialBalance for investment/chitfund/fixed_deposit
      .filter(
        acc =>
          acc.createdAt &&
          new Date(acc.createdAt) <= filterTo
      )
      .reduce(
        (sum, acc: any) => {
          const type = (acc.accountType || '').toLowerCase();
          if (
            (type === "investment" || type === "chitfund" || type === "fixed_deposit" || type === "fixed deposit") &&
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
  } else {
    netSavings = 0;
  }

  // Debug: Print calculated net savings
  console.log("DEBUG netSavings", netSavings);

  // Savings Rate: (netSavings / (netSavings + totalExpenses)) * 100
  const savingsRate = (netSavings + totalExpenses) > 0
    ? (netSavings / (netSavings + totalExpenses)) * 100
    : 0;

  // --- Net Income and Net Income % calculation ---
  const netIncome = totalIncome - totalExpenses;
  const netIncomePercent = totalIncome > 0 ? (netIncome / totalIncome) * 100 : 0;

  // Helper function to format currency with rupee symbol and commas
  function formatCurrencyDetailed(value: number): string {
    return `₹${Number(value).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
  }

  // Use filteredPersonalTxns and filteredPropertyTxns for chart data instead of just `transactions`
  function processMonthlyData() {
    // Combine both personal and property transactions
    const allTxns = [...filteredPersonalTxns, ...filteredPropertyTxns];
    const monthlyData: { [key: string]: { income: number; expenses: number; month: string } } = {};
    allTxns.forEach(transaction => {
      if (!transaction.transactionDate) return;
      const date = new Date(transaction.transactionDate);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const monthName = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = { income: 0, expenses: 0, month: monthName };
      }
      if (transaction.type === 'income') {
        monthlyData[monthKey].income += Number(transaction.amount);
      } else if (transaction.type === 'expense') {
        monthlyData[monthKey].expenses += Number(transaction.amount);
      }
    });
    // Sort by year and month, not by string
    return Object.values(monthlyData).sort((a, b) => {
      const [aMonthStr, aYearStr] = a.month.split(' ');
      const [bMonthStr, bYearStr] = b.month.split(' ');
      const aDate = new Date(`${aMonthStr} 1, ${aYearStr}`);
      const bDate = new Date(`${bMonthStr} 1, ${bYearStr}`);
      return aDate.getTime() - bDate.getTime();
    });
  }

  // --- Category Data Processing for Pie Chart (based on selected context) ---
  function processCategoryDataForContext(context: 'personal' | 'property') {
    const txns = context === 'personal' ? filteredPersonalTxns : filteredPropertyTxns;
    const categoryData: { [key: string]: number } = {};
    txns
      .filter((t: any) => t.type === 'expense')
      .forEach(transaction => {
        const category = categories.find(c => c.id === transaction.categoryId);
        const categoryName = category?.name || 'Uncategorized';
        categoryData[categoryName] = (categoryData[categoryName] || 0) + Number(transaction.amount);
      });
    return Object.entries(categoryData)
      .map(([name, value], index) => ({
        name,
        value,
        fill: COLORS[index % COLORS.length]
      }))
      .sort((a, b) => b.value - a.value);
  }

  // Use selected context for category data and total expenses
  const categoryData = processCategoryDataForContext(categoryContext);
  const totalCategoryExpenses = categoryContext === 'personal'
    ? totalPersonalExpenses
    : totalPropertyExpenses;

  // Compute accountData for "Spending by Account" chart
  const accountData = accounts.map(account => {
    // Sum all expense transactions for this account in the selected range
    const expenses = [
      ...filteredPersonalTxns,
      ...filteredPropertyTxns
    ].filter((t: any) => t.accountId === account.id && t.type === 'expense')
      .reduce((sum: number, t: any) => sum + Number(t.amount), 0);

    return {
      name: account.name,
      value: expenses
    };
  }).filter(acc => acc.value > 0);

  // --- FIX: Ensure these are function calls, not variable declarations ---
  const monthlyData = processMonthlyData();

  return (
    <>
      <TopBar title="Analytics" user={user} />
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Financial Analytics</h2>
          <div className="flex items-center gap-4">
            <Select value={dateRange} onValueChange={v => setDateRange(v as any)}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="current">Current Month</SelectItem>
                <SelectItem value="lastmonth">Last Month</SelectItem>
                <SelectItem value="3months">Last 3 Months</SelectItem>
                <SelectItem value="6months">Last 6 Months</SelectItem>
                <SelectItem value="currentyear">Current Year</SelectItem> {/* <-- add this line */}
                <SelectItem value="uptodate">Upto Date</SelectItem>
                <SelectItem value="custom">Custom Range</SelectItem>
              </SelectContent>
            </Select>
            {dateRange === "custom" && (
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  className="border rounded px-2 py-1 text-sm"
                  value={customFrom}
                  onChange={e => setCustomFrom(e.target.value)}
                  placeholder="From"
                />
                <span className="text-gray-500">to</span>
                <input
                  type="date"
                  className="border rounded px-2 py-1 text-sm"
                  value={customTo}
                  onChange={e => setCustomTo(e.target.value)}
                  placeholder="To"
                />
              </div>
            )}
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-6 gap-6 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex flex-col items-center">
                <div className="mb-2">
                  <PiggyBank className="h-7 w-7 text-emerald-600" />
                </div>
                <p className="text-sm text-gray-600">Total Income</p>
                <p className="text-2xl font-bold text-emerald-600">₹{totalIncome.toLocaleString()}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex flex-col items-center">
                <div className="mb-2">
                  <ArrowDownCircle className="h-7 w-7 text-red-600" />
                </div>
                <p className="text-sm text-gray-600">Total Expenses</p>
                <p className="text-2xl font-bold text-red-600">₹{totalExpenses.toLocaleString()}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex flex-col items-center">
                <div className="mb-2">
                  <Wallet className={`h-7 w-7 ${netSavings >= 0 ? 'text-cyan-600' : 'text-red-600'}`} />
                </div>
                <p className="text-sm text-gray-600">Net Savings</p>
                <p className={`text-2xl font-bold ${netSavings >= 0 ? 'text-cyan-600' : 'text-red-600'}`}>
                  ₹{netSavings.toLocaleString()}
                </p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex flex-col items-center">
                <div className="mb-2">
                  <Percent className={`h-7 w-7 ${savingsRate >= 0 ? 'text-violet-600' : 'text-red-600'}`} />
                </div>
                <p className="text-sm text-gray-600">Savings Rate</p>
                <p className={`text-2xl font-bold ${savingsRate >= 0 ? 'text-violet-600' : 'text-red-600'}`}>
                  {savingsRate.toFixed(1)}%
                </p>
              </div>
            </CardContent>
          </Card>
          {/* --- New Card: Net Income --- */}
          <Card>
            <CardContent className="p-6">
              <div className="flex flex-col items-center">
                <div className="mb-2">
                  <ArrowUp className="h-7 w-7 text-blue-600" />
                </div>
                <p className="text-sm text-gray-600">Net Income</p>
                <p className="text-2xl font-bold text-blue-600">₹{netIncome.toLocaleString()}</p>
              </div>
            </CardContent>
          </Card>
          {/* --- New Card: Net Income % --- */}
          <Card>
            <CardContent className="p-6">
              <div className="flex flex-col items-center">
                <div className="mb-2">
                  <Percent className="h-7 w-7 text-indigo-600" />
                </div>
                <p className="text-sm text-gray-600">Net Income %</p>
                <p className={`text-2xl font-bold text-indigo-600`}>
                  {netIncomePercent.toFixed(1)}%
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Income vs Expenses Trend */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Income vs Expenses Trend</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={monthlyData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis tickFormatter={formatCurrencyDetailed} />
                    <Tooltip formatter={(value: number) => [formatCurrencyDetailed(value), '']} />
                    <Legend />
                    <Line type="monotone" dataKey="income" stroke="#10B981" strokeWidth={3} name="Income" />
                    <Line type="monotone" dataKey="expenses" stroke="#EF4444" strokeWidth={3} name="Expenses" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Category Breakdown */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Spending by Category</CardTitle>
                {/* Dropdown for selecting context */}
                <Select value={categoryContext} onValueChange={v => setCategoryContext(v as any)}>
                  <SelectTrigger className="w-44 h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="personal">Personal Expense</SelectItem>
                    <SelectItem value="property">Property Expense</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              <div className="h-96 flex flex-col items-center justify-center">
                {categoryData.length > 0 ? (
                  <div className="flex flex-col items-center w-full">
                    <ResponsiveContainer width={400} height={300}>
                      <PieChart>
                        <Pie
                          data={categoryData}
                          cx="50%"
                          cy="50%"
                          outerRadius={120}
                          dataKey="value"
                          label={false}
                          minAngle={2} // <-- Ensures even small slices (like 0.1%) are visible
                        >
                          {categoryData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.fill} />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(value: number, name: string, props: any) => [
                            `₹${Number(value).toLocaleString()}`,
                            categoryData[props.dataIndex]?.name || name
                          ]}
                          contentStyle={{ fontSize: '14px' }}
                          labelFormatter={() => ""}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    {/* Custom Legend below the pie chart */}
                    <div className="flex flex-wrap justify-center mt-4 w-full">
                      {categoryData.map((entry, idx) => {
                        const percent = totalCategoryExpenses > 0 ? (entry.value / totalCategoryExpenses) * 100 : 0;
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
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <p className="text-gray-500">No expense data available</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Account Usage */}
          <Card>
            <CardHeader>
              <CardTitle>Spending by Account</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                {accountData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={accountData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis tickFormatter={formatCurrencyDetailed} />
                      <Tooltip formatter={(value: number) => [formatCurrencyDetailed(value), 'Amount']} />
                      <Bar dataKey="value" fill="#3B82F6" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <p className="text-gray-500">No account data available</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Category Details Table */}
        {categoryData.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Category Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {categoryData.map((category, index) => {
                  const percentage = totalCategoryExpenses > 0 ? (category.value / totalCategoryExpenses) * 100 : 0;
                  return (
                    <div key={category.name} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center space-x-3">
                        <div 
                          className="h-4 w-4 rounded-full" 
                          style={{ backgroundColor: category.fill }}
                        ></div>
                        <span className="font-medium text-gray-900">{category.name}</span>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-gray-900">₹{category.value.toLocaleString()}</p>
                        <p className="text-sm text-gray-600">{percentage.toFixed(1)}%</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );
}