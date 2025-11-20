import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import TopBar from "@/components/TopBar";
import { useAuth } from "@/hooks/useAuth";
import AddTransferModal from "@/components/AddTransferModal";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Plus, ArrowRight } from "lucide-react";
import { Transfer, BankAccount } from "@shared/schema";
export default function Transfers() {
  const [showAddModal, setShowAddModal] = useState(false);
  const [dateFilter, setDateFilter] = useState({
    dateFrom: '',
    dateTo: ''
  });
  const user = useAuth();

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: transfers = [], isLoading } = useQuery<Transfer[]>({
    queryKey: ['/api/transfers', JSON.stringify(dateFilter)],
    queryFn: async () => {
      const params = new URLSearchParams();

      if (dateFilter.dateFrom) params.append('dateFrom', dateFilter.dateFrom);
      if (dateFilter.dateTo) params.append('dateTo', dateFilter.dateTo);

      const res = await fetch(`/api/transfers?${params}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch transfers');
      return res.json();
    }
  });

  const { data: accounts = [], isLoading: isAccountsLoading } = useQuery<BankAccount[]>({
    queryKey: ['/api/accounts']
  });

  const getAccountName = (accountId: number) => {
    const account = accounts.find(a => a.id === accountId);
    return account?.name || 'Unknown Account';
  };

  // When you call the API to create a transfer, ensure transferDate is a Date object:
  const createTransfer = async (data: any) => {
    // Check if accounts are loaded
    if (!accounts || accounts.length === 0) {
      toast({
        title: "Error",
        description: "Accounts not loaded. Please try again.",
        variant: "destructive",
      });
      throw new Error("Accounts not loaded");
    }

    // Find the from account
    const fromAccount = accounts.find(a => a.id === data.fromAccountId);
    if (!fromAccount) {
      toast({
        title: "Error",
        description: "From account not found.",
        variant: "destructive",
      });
      throw new Error("From account not found");
    }

    // Check if balance is sufficient (support both currentBalance and balance)
    const balance = Number(fromAccount.currentBalance ?? 0);
    if (balance < Number(data.amount)) {
      toast({
        title: "Insufficient Balance",
        description: "The selected account does not have enough balance for this transfer.",
        variant: "destructive",
      });
      throw new Error("Insufficient balance");
    }

    const payload = {
      ...data,
      transferDate: data.transferDate ? new Date(data.transferDate) : undefined,
    };
    return apiRequest('POST', '/api/transfers', payload);
  };

  // Add delete mutation
  const deleteTransferMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest('DELETE', `/api/transfers/${id}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to delete transfer");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/transfers'] });
      toast({
        title: "Success",
        description: "Transfer deleted successfully!",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete transfer",
        variant: "destructive",
      });
    }
  });

  const handleDelete = (id: number) => {
    if (confirm("Are you sure you want to delete this transfer? This action cannot be undone.")) {
      deleteTransferMutation.mutate(id);
    }
  };

  // Sort transfers by createdAt (descending: newest first)
  const sortedTransfers = [...transfers].sort((a, b) => {
    const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return dateB - dateA;
  });

  return (
    <>
      <TopBar title="Transfers" user={user} />
      
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Money Transfers</h2>
          <Button onClick={() => setShowAddModal(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Transfer Money
          </Button>
        </div>
        
        {/* Date Filter */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Filter by Date</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label>From Date</Label>
                <Input
                  type="date"
                  value={dateFilter.dateFrom}
                  onChange={(e) => setDateFilter(prev => ({ ...prev, dateFrom: e.target.value }))}
                />
              </div>
              <div>
                <Label>To Date</Label>
                <Input
                  type="date"
                  value={dateFilter.dateTo}
                  onChange={(e) => setDateFilter(prev => ({ ...prev, dateTo: e.target.value }))}
                />
              </div>
              <div className="flex items-end">
                <Button 
                  variant="outline"
                  onClick={() => setDateFilter({ dateFrom: '', dateTo: '' })}
                  className="w-full"
                >
                  Clear Filters
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
        
        {/* Transfers Table */}
        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-8 text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                <p className="mt-2 text-gray-600">Loading transfers...</p>
              </div>
            ) : transfers.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-gray-600">No transfers found</p>
                <p className="text-sm text-gray-500 mt-1">
                  {dateFilter.dateFrom || dateFilter.dateTo 
                    ? "Try adjusting your date filters" 
                    : "Create your first transfer to get started"}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>From Account</TableHead>
                      <TableHead>To Account</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead></TableHead> {/* Actions column */}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedTransfers.map((transfer) => (
                      <TableRow key={transfer.id} className="hover:bg-gray-50">
                        <TableCell className="text-sm text-gray-900">
                          {transfer.transferDate ? new Date(transfer.transferDate).toLocaleDateString() : ''}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            <div className="h-8 w-8 bg-red-100 rounded-lg flex items-center justify-center">
                              <span className="text-red-600 text-xs">-</span>
                            </div>
                            <span className="font-medium text-gray-900">
                              {getAccountName(transfer.fromAccountId)}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            <ArrowRight className="h-4 w-4 text-gray-400" />
                            <div className="h-8 w-8 bg-green-100 rounded-lg flex items-center justify-center">
                              <span className="text-green-600 text-xs">+</span>
                            </div>
                            <span className="font-medium text-gray-900">
                              {getAccountName(transfer.toAccountId)}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="font-medium text-cyan-600">
                            ₹{Number(transfer.amount).toLocaleString()}
                          </span>
                        </TableCell>
                        <TableCell className="text-sm text-gray-600">
                          {transfer.description || 'No description'}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(transfer.id)}
                            disabled={deleteTransferMutation.isPending}
                          >
                            <span className="sr-only">Delete</span>
                            <svg
                              className="h-4 w-4 text-red-600"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth={2}
                              viewBox="0 0 24 24"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </Button>
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

      <AddTransferModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        // Optionally, you can pass accounts as a prop if needed
      />
    </>
  );
}
