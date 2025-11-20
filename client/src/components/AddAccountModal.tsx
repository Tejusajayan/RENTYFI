import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface AddAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  account?: any; // BankAccount | null
}

export default function AddAccountModal({ isOpen, onClose, onSuccess, account }: AddAccountModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    accountNumber: '',
    accountType: '',
    initialBalance: '',
  });

  useEffect(() => {
    if (account) {
      setFormData({
        name: account.name || '',
        accountNumber: account.accountNumber || '',
        accountType: account.accountType || '',
        initialBalance: account.initialBalance ? Number(account.initialBalance).toString() : '',
      });
    } else {
      setFormData({
        name: '',
        accountNumber: '',
        accountType: '',
        initialBalance: '',
      });
    }
  }, [account, isOpen]);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const createAccountMutation = useMutation({
    mutationFn: async (data: any) => {
      if (account) {
        // Edit mode: update
        const res = await apiRequest('PUT', `/api/accounts/${account.id}`, {
          ...data,
          initialBalance: data.initialBalance
            ? Number(data.initialBalance).toFixed(2)
            : '0.00',
          includeInTotalIncome: true, // always true, no checkbox
        });
        return res.json();
      } else {
        // Create mode
        const res = await apiRequest('POST', '/api/accounts', {
          ...data,
          initialBalance: data.initialBalance
            ? Number(data.initialBalance).toFixed(2)
            : '0.00',
          includeInTotalIncome: true, // always true, no checkbox
        });
        return res.json();
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/accounts'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/personal'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/property'] });
      toast({
        title: "Success",
        description: account ? "Bank account updated successfully!" : "Bank account added successfully!",
      });
      handleClose();
      onSuccess?.();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || (account ? "Failed to update account" : "Failed to create account"),
        variant: "destructive",
      });
    }
  });

  const handleClose = () => {
    setFormData({
      name: '',
      accountNumber: '',
      accountType: '',
      initialBalance: '',
    });
    onClose();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.accountNumber || !formData.accountType) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }
    createAccountMutation.mutate({
      ...formData,
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{account ? "Edit Bank Account" : "Add Bank Account"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="name">Account Name *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="e.g., HDFC Savings"
              required
            />
          </div>
          <div>
            <Label htmlFor="accountNumber">Account Number *</Label>
            <Input
              id="accountNumber"
              value={formData.accountNumber}
              onChange={(e) => setFormData(prev => ({ ...prev, accountNumber: e.target.value }))}
              placeholder="Enter account number"
              required
            />
          </div>
          <div>
            <Label htmlFor="accountType">Account Type *</Label>
            <Select 
              value={formData.accountType} 
              onValueChange={(value) => setFormData(prev => ({ ...prev, accountType: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select account type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="savings">Savings Account</SelectItem>
                <SelectItem value="current">Current Account</SelectItem>
                <SelectItem value="credit_card">Credit Card</SelectItem>
                <SelectItem value="fixed_deposit">Fixed Deposit</SelectItem>
                <SelectItem value="cash">Cash</SelectItem>
                <SelectItem value="investment">Investment</SelectItem>
                <SelectItem value="chitfund">Chit Fund</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="initialBalance">Initial Balance</Label>
            <Input
              id="initialBalance"
              type="number"
              step="0.01"
              value={formData.initialBalance}
              onChange={(e) => setFormData(prev => ({ ...prev, initialBalance: e.target.value }))}
              placeholder="Enter initial balance (optional)"
              onWheel={e => (e.target as HTMLInputElement).blur()}
            />
          </div>
          <div className="flex justify-end space-x-2">
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={createAccountMutation.isPending}>
              {createAccountMutation.isPending
                ? (account ? "Saving..." : "Adding...")
                : (account ? "Save Changes" : "Add Account")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
