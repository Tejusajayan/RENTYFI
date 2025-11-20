import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { BankAccount } from "@shared/schema";

interface AddTransferModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AddTransferModal({ isOpen, onClose }: AddTransferModalProps) {
  const [formData, setFormData] = useState({
    fromAccountId: '',
    toAccountId: '',
    amount: '',
    description: '',
    transferDate: new Date().toISOString().split('T')[0]
  });

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: accounts = [], refetch: refetchAccounts } = useQuery<BankAccount[]>({
    queryKey: ['/api/accounts']
  });

  // Refetch accounts every time the modal is opened to ensure balances are up-to-date
  useEffect(() => {
    if (isOpen) {
      refetchAccounts();
    }
  }, [isOpen, refetchAccounts]);

  const createTransferMutation = useMutation({
    mutationFn: async (data: any) => {
      // Convert transferDate to Date object if present
      let transferDateObj: Date | undefined = undefined;
      if (data.transferDate) {
        if (typeof data.transferDate === "string") {
          // Accept both yyyy-mm-dd and ISO strings
          const d = new Date(data.transferDate);
          transferDateObj = isNaN(d.getTime()) ? undefined : d;
        } else if (data.transferDate instanceof Date) {
          transferDateObj = data.transferDate;
        }
      }
      const res = await apiRequest('POST', '/api/transfers', {
        ...data,
        fromAccountId: parseInt(data.fromAccountId),
        toAccountId: parseInt(data.toAccountId),
        amount: data.amount.toString(), // always string
        transferDate: transferDateObj ?? undefined, // Date object or undefined
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to create transfer");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/transfers'] });
      queryClient.invalidateQueries({ queryKey: ['/api/accounts'] }); // <-- ensure accounts are refetched
      toast({
        title: "Success",
        description: "Transfer completed successfully!",
      });
      handleClose();
    },
    onError: (error: any) => {
      let msg = error.message || "Failed to create transfer";
      if (msg.includes("Insufficient balance")) {
        msg = "Insufficient balance in the source account. Please check your balance.";
      }
      toast({
        title: "Error",
        description: msg,
        variant: "destructive",
      });
    }
  });

  const handleClose = () => {
    setFormData({
      fromAccountId: '',
      toAccountId: '',
      amount: '',
      description: '',
      transferDate: new Date().toISOString().split('T')[0]
    });
    onClose();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.fromAccountId || !formData.toAccountId || !formData.amount) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    if (formData.fromAccountId === formData.toAccountId) {
      toast({
        title: "Error",
        description: "Source and destination accounts must be different",
        variant: "destructive",
      });
      return;
    }

    // Client-side balance check
    const fromAccount = accounts.find(a => a.id.toString() === formData.fromAccountId);
    if (!fromAccount) {
      toast({
        title: "Error",
        description: "Source account not found.",
        variant: "destructive",
      });
      return;
    }
    if (Number(fromAccount.currentBalance ?? 0) < Number(formData.amount)) {
      toast({
        title: "Insufficient Balance",
        description: "The selected account does not have enough balance for this transfer.",
        variant: "destructive",
      });
      return;
    }

    createTransferMutation.mutate(formData);
  };

  const availableToAccounts = accounts.filter(account => account.id.toString() !== formData.fromAccountId);
  const availableFromAccounts = accounts.filter(account => account.id.toString() !== formData.toAccountId);

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Transfer Money</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="fromAccountId">From Account *</Label>
            <Select 
              value={formData.fromAccountId} 
              onValueChange={(value) => setFormData(prev => ({ ...prev, fromAccountId: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select source account" />
              </SelectTrigger>
              <SelectContent>
                {availableFromAccounts.map(account => (
                  <SelectItem key={account.id} value={account.id.toString()}>
                    {account.name} - ₹{Number(account.currentBalance ?? 0).toLocaleString()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="toAccountId">To Account *</Label>
            <Select 
              value={formData.toAccountId} 
              onValueChange={(value) => setFormData(prev => ({ ...prev, toAccountId: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select destination account" />
              </SelectTrigger>
              <SelectContent>
                {availableToAccounts.map(account => (
                  <SelectItem key={account.id} value={account.id.toString()}>
                    {account.name} - ₹{Number(account.currentBalance ?? 0).toLocaleString()}
                  </SelectItem>
                ))}
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
              placeholder="Enter transfer amount"
              required
              onWheel={e => (e.target as HTMLInputElement).blur()}
            />
          </div>

          <div>
            <Label htmlFor="transferDate">Transfer Date</Label>
            <Input
              id="transferDate"
              type="date"
              value={formData.transferDate}
              onChange={(e) => setFormData(prev => ({ ...prev, transferDate: e.target.value }))}
            />
          </div>

          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Transfer description (optional)"
              rows={3}
            />
          </div>

          <div className="flex justify-end space-x-2">
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={createTransferMutation.isPending}>
              {createTransferMutation.isPending ? "Processing..." : "Transfer Money"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
