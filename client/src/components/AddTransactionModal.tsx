import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { BankAccount, Category, Building } from "@shared/schema";

interface AddTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  context: 'personal' | 'property';
  onSuccess?: () => void;
}

export default function AddTransactionModal({ isOpen, onClose, context, onSuccess }: AddTransactionModalProps) {
  const [formData, setFormData] = useState({
    description: '',
    amount: '',
    type: 'expense' as 'income' | 'expense',
    accountId: '',
    categoryId: '',
    notes: '',
    buildingId: '', // <-- add buildingId
  });

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: accounts = [] } = useQuery<BankAccount[]>({
    queryKey: ['/api/accounts']
  });

  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ['/api/categories', context]
  });

  // Fetch buildings for property context
  const { data: buildings = [] } = useQuery<Building[]>({
    queryKey: ['/api/buildings'],
    enabled: context === 'property',
  });

  const createTransactionMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest('POST', '/api/transactions', {
        ...data,
        context,
        accountId: data.accountId ? parseInt(data.accountId) : undefined,
        categoryId: data.categoryId ? parseInt(data.categoryId) : null,
        buildingId: context === 'property' && data.buildingId ? parseInt(data.buildingId) : undefined, // <-- add
      });
      return res.json();
    },
    onSuccess: () => {
      // Invalidate queries for the correct context/mode
      queryClient.invalidateQueries({ queryKey: ['/api/transactions', context] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/personal'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/property'] });
      queryClient.invalidateQueries({ queryKey: ['/api/accounts'] }); // <-- ensure accounts are refetched
      toast({
        title: "Success",
        description: "Transaction added successfully!",
      });
      handleClose();
      onSuccess?.();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create transaction",
        variant: "destructive",
      });
    }
  });

  const handleClose = () => {
    setFormData({
      description: '',
      amount: '',
      type: 'expense',
      accountId: '',
      categoryId: '',
      notes: '',
      buildingId: '', // <-- reset
    });
    onClose();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.description || !formData.amount || !formData.accountId) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    // Check for insufficient balance for expense
    if (formData.type === "expense") {
      const selectedAccount = accounts.find(acc => acc.id === parseInt(formData.accountId));
      if (selectedAccount) {
        const currentBalance = Number(selectedAccount.currentBalance ?? 0);
        const expenseAmount = Number(formData.amount);
        // For credit cards, allow negative balance; for others, check
        if (selectedAccount.accountType !== "credit_card" && expenseAmount > currentBalance) {
          toast({
            title: "Error",
            description: "Insufficient balance in selected account",
            variant: "destructive",
          });
          return;
        }
      }
    }

    // Save transactionDate and createdAt as system time (local JS Date)
    const now = new Date();

    createTransactionMutation.mutate({
      ...formData,
      transactionDate: now,
      createdAt: now
    });
  };

  const filteredCategories = categories.filter(cat => 
    cat.context === context && cat.type === formData.type
  );

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Transaction</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="description">Description *</Label>
            <Input
              id="description"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Enter transaction description"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="type">Type *</Label>
              <Select 
                value={formData.type} 
                onValueChange={(value: 'income' | 'expense') => 
                  setFormData(prev => ({ ...prev, type: value, categoryId: '' }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="income">Income</SelectItem>
                  <SelectItem value="expense">Expense</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="amount">Amount *</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                value={formData.amount}
                onChange={(e) => setFormData(prev => ({ ...prev, amount: e.target.value }))}
                placeholder="Enter amount"
                required
                onWheel={e => (e.target as HTMLInputElement).blur()}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="accountId">Bank Account *</Label>
            <Select 
              value={formData.accountId} 
              onValueChange={(value) => setFormData(prev => ({ ...prev, accountId: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select account" />
              </SelectTrigger>
              <SelectContent>
                {accounts.map(account => (
                  <SelectItem key={account.id} value={account.id.toString()}>
                    {account.name} ({account.accountType})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="categoryId">Category</Label>
            <Select 
              value={formData.categoryId || ''} 
              onValueChange={(value) => setFormData(prev => ({ ...prev, categoryId: value || '' }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select category (optional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No Category</SelectItem>
                {filteredCategories.map(category => (
                  <SelectItem key={category.id} value={category.id.toString()}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Show building dropdown only for property context */}
          {context === 'property' && (
            <div>
              <Label htmlFor="buildingId">Building *</Label>
              <Select
                value={formData.buildingId}
                onValueChange={value => setFormData(prev => ({ ...prev, buildingId: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select building" />
                </SelectTrigger>
                <SelectContent>
                  {buildings.map(building => (
                    <SelectItem key={building.id} value={building.id.toString()}>
                      {building.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div>
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              placeholder="Additional notes (optional)"
              rows={3}
            />
          </div>

          <div className="flex justify-end space-x-2">
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={createTransactionMutation.isPending}>
              {createTransactionMutation.isPending ? "Adding..." : "Add Transaction"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
          
