import { Card, CardContent } from "@/components/ui/card";
import { ArrowUp, ArrowDown, PiggyBank, Percent, Building, Wrench, ChartLine, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

interface DashboardCardProps {
  title: string;
  value: string;
  subtitle?: React.ReactNode;
  icon: React.ReactNode;
  trend?: "up" | "down" | "neutral";
  colorClass: string;
}

function DashboardCard({ title, value, subtitle, icon, trend, colorClass }: DashboardCardProps) {
  return (
    <Card className="shadow-sm border border-gray-200">
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600">{title}</p>
            <p className={cn("text-2xl font-bold", colorClass)}>{value}</p>
          </div>
          <div className={cn("h-12 w-12 rounded-lg flex items-center justify-center", `${colorClass.replace('text-', 'bg-')}-100`)}>
            {icon}
          </div>
        </div>
        {subtitle && (
          <p className="text-xs text-gray-500 mt-2">{subtitle}</p>
        )}
      </CardContent>
    </Card>
  );
}

interface PersonalDashboardCardsProps {
  data: {
    totalIncome: number;
    rentalIncome?: number;
    advanceIncome?: number;
    totalExpenses: number;
    netSavings: number;
    savingsRate: number;
    initialBalance?: number;
    propertyExpenses?: number;
    netIncome?: number; // <-- Add this line
    netIncomePercent?: number; // <-- Add this line
  };
}

// Remove getDelta and previous month logic
export function PersonalDashboardCards({ data }: PersonalDashboardCardsProps) {
  // Use netSavings and savingsRate from data (already calculated)
  const netSavings = data.netSavings ?? 0;
  const savingsRate = data.savingsRate ?? 0;
  const netIncome = data.netIncome ?? 0; // <-- Add this line
  const netIncomePercent = data.netIncomePercent ?? 0; // <-- Add this line

  return (
    <div className="grid grid-cols-1 md:grid-cols-6 gap-6 mb-8">
      {/* Total Income */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col items-center">
            <div className="mb-2">
              <PiggyBank className="h-7 w-7 text-emerald-600" />
            </div>
            <p className="text-sm text-gray-600">Total Income</p>
            <p className="text-2xl font-bold text-emerald-600">₹{data.totalIncome.toLocaleString()}</p>
          </div>
        </CardContent>
      </Card>
      {/* Personal Expenses */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col items-center">
            <div className="mb-2">
              <ArrowDown className="h-7 w-7 text-red-600" />
            </div>
            <p className="text-sm font-medium text-gray-600">Personal Expenses</p>
            <p className="text-2xl font-bold text-red-600">₹{data.totalExpenses.toLocaleString()}</p>
          </div>
        </CardContent>
      </Card>
      {/* Net Savings */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col items-center">
            <div className="mb-2">
              <PiggyBank className="h-7 w-7 text-cyan-600" />
            </div>
            <p className="text-sm font-medium text-gray-600">Net Savings</p>
            <p className="text-2xl font-bold text-cyan-600">₹{data.netSavings.toLocaleString()}</p>
          </div>
        </CardContent>
      </Card>
      {/* Savings Rate (Personal) */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col items-center">
            <div className="mb-2">
              <Percent className="h-7 w-7 text-violet-600" />
            </div>
            <p className="text-sm font-medium text-gray-600">Savings Rate (Pers)</p>
            <p className="text-2xl font-bold text-violet-600">{savingsRate.toFixed(1)}%</p>
          </div>
        </CardContent>
      </Card>
      {/* Net Income */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col items-center">
            <div className="mb-2">
              <ArrowUp className="h-7 w-7 text-blue-600" />
            </div>
            <p className="text-sm font-medium text-gray-600">Net Income</p>
            <p className="text-2xl font-bold text-blue-600">₹{netIncome.toLocaleString()}</p>
          </div>
        </CardContent>
      </Card>
      {/* Net Income % */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col items-center">
            <div className="mb-2">
              <Percent className="h-7 w-7 text-indigo-600" />
            </div>
            <p className="text-sm font-medium text-gray-600">Net Income %</p>
            <p className="text-2xl font-bold text-indigo-600">{netIncomePercent.toFixed(1)}%</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

interface PropertyDashboardCardsProps {
  data: {
    totalIncome: number;
    totalExpenses: number;
    netIncome: number;
    pendingRent: number;
    rentPayments?: any[];
    shops?: any[];
    tenants?: any[];
    categories?: any[];
    transactions?: any[];
  };
}

export function PropertyDashboardCards({ data }: PropertyDashboardCardsProps) {
  // Defensive: ensure all values are numbers and fallback to 0 if missing
  // --- Filter out Advance Amount from totalIncome and netIncome ---
  let totalIncome = 0;
  let netIncome = 0;
  let totalExpenses = Number(data.totalExpenses) || 0;

  // If rentPayments, shops, tenants, and categories are provided, compute income properly
  // Otherwise, fallback to provided values
  let advanceIncome = 0;
  if (Array.isArray(data.rentPayments) && Array.isArray(data.shops) && Array.isArray(data.tenants) && Array.isArray(data.categories)) {
    // Only sum transactions that are "Advance Amount" (case-insensitive, context: property)
    const incomeTxns = Array.isArray(data.transactions) ? data.transactions : [];
    // Find advance category ids
    const advanceCatIds = data.categories
      .filter((c: any) =>
        (c.name?.toLowerCase() === "advance amount" || c.name?.toLowerCase() === "advance payment") &&
        c.context === "property"
      )
      .map((c: any) => c.id);

    // Sum all property income (including advance)
    const totalPropertyIncome = incomeTxns
      .filter((t: any) => t.type === "income")
      .reduce((sum: number, t: any) => sum + Number(t.amount), 0);

    // Sum advance income
    advanceIncome = incomeTxns
      .filter((t: any) => t.type === "income" && advanceCatIds.includes(t.categoryId))
      .reduce((sum: number, t: any) => sum + Number(t.amount), 0);

    totalIncome = totalPropertyIncome;
    netIncome = totalIncome - totalExpenses;
  } else {
    // fallback to provided values, but try to include advance if possible
    totalIncome = Number(data.totalIncome) || 0;
    netIncome = Number(data.netIncome) || (totalIncome - totalExpenses);
    advanceIncome = 0;
  }

  // --- Pending Rent Logic: sum all unpaid rents for all months before current month ---
  let pendingRent = 0;
  // --- Sum all pendingAmount from rentPayments with pendingAmount > 0, EXCLUDING current month ---
  if (Array.isArray(data.rentPayments)) {
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();
    pendingRent = data.rentPayments.reduce(
      (sum: number, p: any) => {
        // Exclude current month
        if (
          Number(p.pendingAmount) > 0 &&
          (p.year < currentYear || (p.year === currentYear && p.month < currentMonth))
        ) {
          return sum + Number(p.pendingAmount);
        }
        return sum;
      },
      0
    );
  } else {
    pendingRent = Number(data.pendingRent) || 0;
  }
  const profitMargin = totalIncome > 0 ? ((netIncome / totalIncome) * 100) : 0;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      <DashboardCard
        title="Total Property Income"
        value={`₹${totalIncome.toLocaleString()}`}
        subtitle="From active tenants"
        icon={<Building className="text-green-600" />}
        colorClass="text-green-600"
      />
      <DashboardCard
        title="Property Expenses"
        value={`₹${totalExpenses.toLocaleString()}`}
        subtitle="Maintenance & utilities"
        icon={<Wrench className="text-red-600" />}
        colorClass="text-red-600"
      />
      <DashboardCard
        title="Net Property Income"
        value={`₹${netIncome.toLocaleString()}`}
        subtitle={`${profitMargin.toFixed(1)}% profit margin`}
        icon={<ChartLine className="text-blue-600" />}
        colorClass="text-blue-600"
      />
      <DashboardCard
        title="Pending Rent"
        value={`₹${pendingRent.toLocaleString()}`}
        subtitle="Total pending rent (excluding current month)"
        icon={<AlertTriangle className="text-orange-600" />}
        colorClass="text-orange-600"
      />
    </div>
  );
}