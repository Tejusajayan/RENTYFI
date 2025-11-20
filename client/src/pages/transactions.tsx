import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import TopBar from "@/components/TopBar";
import AddTransactionModal from "@/components/AddTransactionModal";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Plus, Edit, Trash2, ShoppingCart, Wallet, Car, Info } from "lucide-react";
import { Transaction, BankAccount, Category, Building } from "@shared/schema";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import jsPDF from "jspdf";
// @ts-ignore
import autoTable from "jspdf-autotable";

export default function Transactions() {
  const user = useAuth();
  const [mode, setMode] = useState<'personal' | 'property'>('personal');
  const [showAddModal, setShowAddModal] = useState(false);
  const [filters, setFilters] = useState({
    categoryId: '',
    accountId: '',
    dateRange: 'month', // default can be changed if needed
    dateFrom: '',
    dateTo: ''
  });
  const [showStatementDialog, setShowStatementDialog] = useState(false);
  const [statementCriteria, setStatementCriteria] = useState({
    dateFrom: '',
    dateTo: '',
    accountId: '',
    categoryId: '',
    includeTransfers: false,
  });
  const [downloading, setDownloading] = useState(false);
  const [notesModal, setNotesModal] = useState<{ open: boolean, notes: string }>({ open: false, notes: '' });

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: transactions = [], isLoading } = useQuery<Transaction[]>({
    queryKey: ['/api/transactions', mode, JSON.stringify(filters)],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append('context', mode);

      // Only append if not "all" and not empty
      if (filters.categoryId && filters.categoryId !== 'all') params.append('categoryId', filters.categoryId);
      if (filters.accountId && filters.accountId !== 'all') params.append('accountId', filters.accountId);

      // Set date range based on selection
      const now = new Date();
      let dateFrom, dateTo;

      switch (filters.dateRange) {
        case 'today':
          dateFrom = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
          dateTo = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
          break;
        case 'week': {
          // Last 7 days: include today and previous 6 days (local time)
          const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
          dateFrom = new Date(todayMidnight.getTime() - 6 * 24 * 60 * 60 * 1000);
          dateTo = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
          // Debug log for filter range
          console.log('[DEBUG] Last 7 Days Filter:', {
            today: now,
            dateFrom,
            dateTo
          });
          break;
        }
        case 'month':
          dateFrom = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
          dateTo = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
          break;
        case 'lastmonth': {
          // Correct calculation for previous month range (1st to last day of previous month)
          const prevMonth = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
          const prevMonthYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
          dateFrom = new Date(prevMonthYear, prevMonth, 1, 0, 0, 0, 0);
          dateTo = new Date(prevMonthYear, prevMonth + 1, 0, 23, 59, 59, 999);
          break;
        }
        case '3months': {
          // Fix: Show last 3 *completed* months (e.g. if today is Oct 1, 2023: July 1 - Sep 30, 2023)
          const prevMonth = new Date(now.getFullYear(), now.getMonth(), 0); // last day of previous month
          dateTo = new Date(prevMonth.getFullYear(), prevMonth.getMonth(), prevMonth.getDate(), 23, 59, 59, 999);
          dateFrom = new Date(prevMonth.getFullYear(), prevMonth.getMonth() - 2, 1, 0, 0, 0, 0);
          break;
        }
        case '6months': {
          const prevMonth = new Date(now.getFullYear(), now.getMonth(), 0);
          dateTo = new Date(prevMonth.getFullYear(), prevMonth.getMonth(), prevMonth.getDate(), 23, 59, 59, 999);
          dateFrom = new Date(prevMonth.getFullYear(), prevMonth.getMonth() - 5, 1, 0, 0, 0, 0);
          break;
        }
        case 'custom':
          if (filters.dateFrom) dateFrom = new Date(filters.dateFrom);
          if (filters.dateTo) {
            const d = new Date(filters.dateTo);
            dateTo = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
          }
          break;
      }

      if (dateFrom instanceof Date && !isNaN(dateFrom.getTime())) params.append('dateFrom', dateFrom.toISOString());
      if (dateTo instanceof Date && !isNaN(dateTo.getTime())) params.append('dateTo', dateTo.toISOString());

      const res = await fetch(`/api/transactions?${params}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch transactions');
      let data = await res.json();

      // --- Extra frontend filter for lastmonth to ensure strict date range (fixes backend bug) ---
      if (filters.dateRange === 'lastmonth') {
        // Use the same prevMonth/prevMonthYear logic as above
        const prevMonth = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
        const prevMonthYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
        const filterFrom = new Date(prevMonthYear, prevMonth, 1, 0, 0, 0, 0);
        const filterTo = new Date(prevMonthYear, prevMonth + 1, 0, 23, 59, 59, 999);
        data = data.filter((t: any) => {
          if (!t.transactionDate) return false;
          const d = new Date(t.transactionDate);
          return d >= filterFrom && d <= filterTo;
        });
      }

      // --- Extra frontend filter for "week" to ensure correct inclusion of all 7 days ---
      if (filters.dateRange === 'week') {
        const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
        const filterFrom = new Date(todayMidnight.getTime() - 6 * 24 * 60 * 60 * 1000);
        const filterTo = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
        // Debug log for each transaction
        data = data.filter((t: any) => {
          if (!t.transactionDate) return false;
          const d = new Date(t.transactionDate);
          // Compare India local time
          const included = d.getTime() >= filterFrom.getTime() && d.getTime() <= filterTo.getTime();
          console.log('[DEBUG] txn', {
            id: t.id,
            transactionDate: t.transactionDate,
            parsedDate: d,
            included,
            filterFrom,
            filterTo
          });
          return included;
        });
      }

      return data;
    },
    refetchOnWindowFocus: true,
  });

  const { data: accounts = [] } = useQuery<BankAccount[]>({
    queryKey: ['/api/accounts']
  });

  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ['/api/categories', mode]
  });

  const { data: buildings = [] } = useQuery<Building[]>({
    queryKey: ['/api/buildings'],
    enabled: mode === 'property',
  });

  const deleteTransactionMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest('DELETE', `/api/transactions/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/transactions'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['/api/accounts'] });
      toast({
        title: "Success",
        description: "Transaction deleted successfully!",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete transaction",
        variant: "destructive",
      });
    }
  });

  const handleDelete = (id: number) => {
    if (confirm("Are you sure you want to delete this transaction?")) {
      deleteTransactionMutation.mutate(id);
    }
  };

  const getTransactionIcon = (description: string) => {
    const lower = description.toLowerCase();
    if (lower.includes('grocery') || lower.includes('shopping')) {
      return <ShoppingCart className="h-4 w-4 text-red-600" />;
    } else if (lower.includes('salary') || lower.includes('income')) {
      return <Wallet className="h-4 w-4 text-green-600" />;
    } else if (lower.includes('fuel') || lower.includes('gas')) {
      return <Car className="h-4 w-4 text-blue-600" />;
    }
    return <Wallet className="h-4 w-4 text-gray-600" />;
  };

  const getCategoryName = (categoryId: number | null) => {
    if (!categoryId) return 'Uncategorized';
    const category = categories.find(c => c.id === categoryId);
    return category?.name || 'Unknown';
  };

  const getAccountName = (accountId: number | null) => {
    if (accountId == null) return 'Unknown Account';
    const account = accounts.find(a => a.id === accountId);
    return account?.name || 'Unknown Account';
  };

  const getBuildingName = (buildingId: number | null | undefined) => {
    if (!buildingId) return '';
    const building = buildings.find(b => b.id === buildingId);
    return building ? building.name : '';
  };

  // Sort transactions by createdAt (descending: newest first)
  const sortedTransactions = [...transactions].sort((a, b) => {
    const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return dateB - dateA;
  });

  // Fetch all categories (both modes) for statement dialog
  const { data: allCategories = [] } = useQuery<Category[]>({
    queryKey: ["/api/categories", "all"],
  });

  // Helper to format date as dd-mm-yyyy HH:MM (system local time)
  function formatDateDMY(dateStr: string | Date | undefined): string {
    if (!dateStr) return '';
    const d = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
    if (isNaN(d.getTime())) return '';
    // Format as system local time
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${day}-${month}-${year} ${hours}:${minutes}`;
  }

  // Statement PDF generation logic
  const handleDownloadStatement = async () => {
    // --- Guard: Wait for accounts and allCategories to be loaded ---
    if (!accounts || accounts.length === 0 || !allCategories || allCategories.length === 0) {
      toast({ title: 'Error', description: 'Accounts or categories not loaded yet.', variant: 'destructive' });
      return;
    }
    setDownloading(true);
    try {
      // Fetch transactions for both contexts
      const paramsPersonal = new URLSearchParams();
      const paramsProperty = new URLSearchParams();
      if (statementCriteria.dateFrom) {
        paramsPersonal.append('dateFrom', statementCriteria.dateFrom);
        paramsProperty.append('dateFrom', statementCriteria.dateFrom);
      }
      if (statementCriteria.dateTo) {
        // Ensure dateTo is set to the end of the day (23:59:59.999)
        const d = new Date(statementCriteria.dateTo);
        d.setHours(23, 59, 59, 999);
        const dateToIso = d.toISOString();
        paramsPersonal.append('dateTo', dateToIso);
        paramsProperty.append('dateTo', dateToIso);
      }
      if (statementCriteria.accountId && statementCriteria.accountId !== 'all') {
        paramsPersonal.append('accountId', statementCriteria.accountId);
        paramsProperty.append('accountId', statementCriteria.accountId);
      }
      if (statementCriteria.categoryId && statementCriteria.categoryId !== 'all') {
        paramsPersonal.append('categoryId', statementCriteria.categoryId);
        paramsProperty.append('categoryId', statementCriteria.categoryId);
      }
      paramsPersonal.append('context', 'personal');
      paramsProperty.append('context', 'property');
      // Fetch both personal and property transactions
      const [txResPersonal, txResProperty] = await Promise.all([
        fetch(`/api/transactions?${paramsPersonal}`, { credentials: 'include' }),
        fetch(`/api/transactions?${paramsProperty}`, { credentials: 'include' })
      ]);
      if (!txResPersonal.ok) throw new Error('Failed to fetch personal transactions');
      if (!txResProperty.ok) throw new Error('Failed to fetch property transactions');
      const txDataPersonal = await txResPersonal.json();
      const txDataProperty = await txResProperty.json();
      const txData = [...txDataPersonal, ...txDataProperty];
      // Optionally fetch transfers
      let transferData = [];
      if (statementCriteria.includeTransfers) {
        const tParams = new URLSearchParams();
        if (statementCriteria.dateFrom) tParams.append('dateFrom', statementCriteria.dateFrom);
        if (statementCriteria.dateTo) {
          const d = new Date(statementCriteria.dateTo);
          d.setHours(23, 59, 59, 999);
          tParams.append('dateTo', d.toISOString());
        }
        const trRes = await fetch(`/api/transfers?${tParams}`, { credentials: 'include' });
        if (!trRes.ok) throw new Error('Failed to fetch transfer records');
        transferData = await trRes.json();
      }
      // --- Calculate total income and expense for the filtered transactions ---
      let totalIncome = 0;
      let totalExpense = 0;
      txData.forEach((t: any) => {
        if (t.type === 'income') totalIncome += Number(t.amount);
        else if (t.type === 'expense') totalExpense += Number(t.amount);
      });

      // --- Sort txData by transactionDate (ascending) before generating PDF ---
      txData.sort((a: any, b: any) => {
        const dateA = a.transactionDate ? new Date(a.transactionDate).getTime() : 0;
        const dateB = b.transactionDate ? new Date(b.transactionDate).getTime() : 0;
        return dateA - dateB;
      });
      // Generate PDF
      const doc = new jsPDF();
      doc.setFontSize(16);
      doc.text('Account Statement', 14, 18);
      doc.setFontSize(10);
      doc.text(`Period: ${statementCriteria.dateFrom || '...'} to ${statementCriteria.dateTo || '...'}`, 14, 26);
      // Add details about selected category and account
      let detailsY = 32;
      let details = '';
      if (statementCriteria.accountId && statementCriteria.accountId !== 'all') {
        const acc = accounts.find((a: any) => a.id.toString() === statementCriteria.accountId);
        details += `Account: ${acc ? acc.name + ' (' + acc.accountType + ')' : 'Unknown'}`;
      } else {
        details += 'Account: All Accounts';
      }
      if (statementCriteria.categoryId && statementCriteria.categoryId !== 'all') {
        const cat = allCategories.find((c: any) => c.id.toString() === statementCriteria.categoryId);
        details += ` | Category: ${cat ? cat.name : 'Unknown'}`;
      } else {
        details += ' | Category: All Categories';
      }
      doc.text(details, 14, detailsY);
      // Transactions Table
      autoTable(doc, {
        startY: detailsY + 8,
        head: [["Date", "Type", "Description", "Category", "Account", "Amount"]],
        body: txData.map((t: any) => [
          t.transactionDate ? formatDateDMY(t.transactionDate) : '',
          t.type,
          t.description,
          allCategories.find((c: any) => c.id === t.categoryId)?.name || 'Uncategorized',
          accounts.find((a: any) => a.id === t.accountId)?.name || 'Unknown',
          (t.type === 'income' ? '+' : '-') + Number(t.amount).toLocaleString()
        ]),
        theme: 'grid',
        headStyles: { fillColor: [22, 101, 52] }
      });

      // --- Add totals below the table, only if there are transactions ---
      if (txData.length > 0 && (doc as any).lastAutoTable) {
        const finalY = (doc as any).lastAutoTable.finalY;
        doc.setFontSize(11);
        doc.setTextColor(22, 101, 52);
        doc.text(
          `Total Income: ${totalIncome.toLocaleString()}    Total Expense: ${totalExpense.toLocaleString()}`,
          14,
          finalY + 14
        );
        doc.setTextColor(0, 0, 0);

        // --- Net Savings Section ---
        doc.setFontSize(12);
        doc.setTextColor(30, 64, 175);
        const netSavings = totalIncome - totalExpense;
        const netPrefix = netSavings >= 0 ? '+' : '-';
        doc.text(
          `Net Savings: ${netPrefix}${Math.abs(netSavings).toLocaleString()}`,
          14,
          finalY + 24
        );
        doc.setTextColor(0, 0, 0);
      }
      // Transfers Table (if included)
      if (statementCriteria.includeTransfers && transferData.length > 0) {
        // Add heading for Transfer Records
        const lastTable = (doc as any).lastAutoTable;
        // Increased Y offset for better spacing below totals and initial balance
        let transferHeadingY = lastTable ? lastTable.finalY + 36 : 70; // was +22, now +36
        doc.setFontSize(12);
        doc.text('Transfer Records', 14, transferHeadingY);
        doc.setFontSize(10);
        autoTable(doc, {
          startY: transferHeadingY + 4,
          head: [["Date", "From Account", "To Account", "Amount", "Description"]],
          body: transferData.map((tr: any) => [
            tr.transferDate ? formatDateDMY(tr.transferDate) : '',
            accounts.find((a: any) => a.id === tr.fromAccountId)?.name || 'Unknown',
            accounts.find((a: any) => a.id === tr.toAccountId)?.name || 'Unknown',
            Number(tr.amount).toLocaleString(),
            tr.description || ''
          ]),
          theme: 'grid',
          headStyles: { fillColor: [30, 64, 175] },
        });
      }
      doc.save('statement.pdf');
      setShowStatementDialog(false);
    } catch (e: any) {
      // --- Log error for debugging ---
      console.error('Statement PDF generation error:', e);
      toast({ title: 'Error', description: e?.message || 'Failed to generate statement', variant: 'destructive' });
    } finally {
      setDownloading(false);
    }
  };

return (
  <>
    <TopBar 
      user={user}
      title="Transactions" 
      showModeSelector={true}
      currentMode={mode}
      onModeChange={(newMode) => setMode(newMode as 'personal' | 'property')}
      // Add Statement Button to TopBar
      rightContent={
        <Button variant="outline" onClick={() => setShowStatementDialog(true)} className="ml-2">
          Statement
        </Button>
      }
    />
    
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Transactions</h2>
        <Button onClick={() => setShowAddModal(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add Transaction
        </Button>
      </div>
      
      {/* Filters */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <Label>Category</Label>
              <Select 
                value={filters.categoryId} 
                onValueChange={(value) => setFilters(prev => ({ ...prev, categoryId: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories.filter(c => c.context === mode).map(category => (
                    <SelectItem key={category.id} value={category.id.toString()}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label>Date Range</Label>
              <Select 
                value={filters.dateRange} 
                onValueChange={(value) => setFilters(prev => ({ ...prev, dateRange: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="week">Last 7 Days</SelectItem>
                  <SelectItem value="month">This Month</SelectItem>
                  <SelectItem value="lastmonth">Last Month</SelectItem>
                  <SelectItem value="3months">Last 3 Months</SelectItem>
                  <SelectItem value="6months">Last 6 Months</SelectItem>
                  <SelectItem value="custom">Custom Range</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label>Bank Account</Label>
              <Select 
                value={filters.accountId} 
                onValueChange={(value) => setFilters(prev => ({ ...prev, accountId: value }))
              }>
                <SelectTrigger>
                  <SelectValue placeholder="All Accounts" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Accounts</SelectItem>
                  {accounts.map(account => (
                    <SelectItem key={account.id} value={account.id.toString()}>
                      {account.name} ({account.accountType})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex items-end space-x-2">
              <Button className="w-full">
                Apply Filters
              </Button>
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() =>
                  setFilters({
                    categoryId: '',
                    accountId: '',
                    dateRange: 'month',
                    dateFrom: '',
                    dateTo: ''
                  })
                }
              >
                Clear Filters
              </Button>
            </div>
          </div>
          
          {filters.dateRange === 'custom' && (
            <div className="grid grid-cols-2 gap-4 mt-4">
              <div>
                <Label>From Date</Label>
                <Input
                  type="date"
                  value={filters.dateFrom}
                  onChange={(e) => setFilters(prev => ({ ...prev, dateFrom: e.target.value }))}
                />
              </div>
              <div>
                <Label>To Date</Label>
                <Input
                  type="date"
                  value={filters.dateTo}
                  onChange={(e) => setFilters(prev => ({ ...prev, dateTo: e.target.value }))}
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Transactions Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
              <p className="mt-2 text-gray-600">Loading transactions...</p>
            </div>
          ) : sortedTransactions.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-gray-600">No transactions found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Account</TableHead>
                    {mode === 'property' && <TableHead>Building</TableHead>}
                    <TableHead>Amount</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedTransactions.map((transaction) => (
                    <TableRow key={transaction.id} className="hover:bg-gray-50">
                      <TableCell className="text-sm text-gray-900">
                        {transaction.transactionDate ? formatDateDMY(transaction.transactionDate) : ''}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-3">
                          <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${
                            transaction.type === 'income' ? 'bg-green-100' : 'bg-red-100'
                          }`}>
                            {getTransactionIcon(transaction.description)}
                          </div>
                          <div className="font-medium text-gray-900">
                            {transaction.description}
                          </div>
                          {(transaction.notes && transaction.notes.trim() !== '') && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="p-1"
                              onClick={() => setNotesModal({ open: true, notes: transaction.notes ?? '' })}
                              title="Show Notes"
                            >
                              <Info className="h-4 w-4 text-blue-600" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {getCategoryName(transaction.categoryId)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-gray-500">
                        {getAccountName(transaction.accountId)}
                      </TableCell>
                      {mode === 'property' && (
                        <TableCell className="text-sm text-gray-900">
                          {getBuildingName(transaction.buildingId)}
                        </TableCell>
                      )}
                      <TableCell>
                        <span className={`font-medium ${
                          transaction.type === 'income' ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {transaction.type === 'income' ? '+' : '-'}₹{Number(transaction.amount).toLocaleString()}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex space-x-2">
                          <Button variant="ghost" size="sm">
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => handleDelete(transaction.id)}
                            disabled={deleteTransactionMutation.isPending}
                          >
                            <Trash2 className="h-4 w-4 text-red-600" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>

    <AddTransactionModal
      isOpen={showAddModal}
      onClose={() => setShowAddModal(false)}
      context={mode}
    />

    <Dialog open={showStatementDialog} onOpenChange={setShowStatementDialog}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Download Statement</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>From Date</Label>
            <Input type="date" value={statementCriteria.dateFrom} onChange={e => setStatementCriteria(c => ({ ...c, dateFrom: e.target.value }))} />
          </div>
          <div>
            <Label>To Date</Label>
            <Input type="date" value={statementCriteria.dateTo} onChange={e => setStatementCriteria(c => ({ ...c, dateTo: e.target.value }))} />
          </div>
          <div>
            <Label>Account</Label>
            <Select value={statementCriteria.accountId} onValueChange={v => setStatementCriteria(c => ({ ...c, accountId: v }))}>
              <SelectTrigger><SelectValue placeholder="All Accounts" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Accounts</SelectItem>
                {accounts.map(account => (
                  <SelectItem key={account.id} value={account.id.toString()}>{account.name} ({account.accountType})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Category</Label>
            <Select value={statementCriteria.categoryId} onValueChange={v => setStatementCriteria(c => ({ ...c, categoryId: v }))}>
              <SelectTrigger><SelectValue placeholder="All Categories" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {allCategories.map(category => (
                  <SelectItem key={category.id} value={category.id.toString()}>{category.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox id="includeTransfers" checked={statementCriteria.includeTransfers} onCheckedChange={v => setStatementCriteria(c => ({ ...c, includeTransfers: !!v }))} />
            <Label htmlFor="includeTransfers">Include Transfer Records Too?</Label>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={handleDownloadStatement} disabled={downloading}>
            {downloading ? 'Generating...' : 'Download'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {/* Notes Modal */}
    <Dialog open={notesModal.open} onOpenChange={open => setNotesModal({ open, notes: notesModal.notes ?? '' })}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Transaction Notes</DialogTitle>
        </DialogHeader>
        <div className="whitespace-pre-wrap text-gray-800 text-sm max-h-64 overflow-y-auto">
          {notesModal.notes}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setNotesModal({ open: false, notes: '' })}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </>
)}