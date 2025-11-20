import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import TopBar from "@/components/TopBar";
import { useAuth } from "@/hooks/useAuth";
import AddAccountModal from "@/components/AddAccountModal";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Plus, Edit, Trash2, University, CreditCard, PiggyBank, Landmark, Banknote, HandCoins } from "lucide-react";
import { BankAccount } from "@shared/schema";
export default function Accounts() {
  const [showAddModal, setShowAddModal] = useState(false);
  const [editAccount, setEditAccount] = useState<BankAccount | null>(null);
  const user = useAuth();

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: accounts = [], isLoading } = useQuery<BankAccount[]>({
    queryKey: ['/api/accounts']
  });

  const deleteAccountMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest('DELETE', `/api/accounts/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/accounts'] });
      toast({
        title: "Success",
        description: "Account deleted successfully!",
      });
    },
    onError: (error: any) => {
      // Try to extract backend error message
      let msg = error?.message;
      if (error?.response?.data?.message) {
        msg = error.response.data.message;
      }
      toast({
        title: "Error",
        description: msg || "Failed to delete account",
        variant: "destructive",
      });
    }
  });

  const handleDelete = (id: number) => {
    if (confirm("Are you sure you want to delete this account? This action cannot be undone.")) {
      deleteAccountMutation.mutate(id);
    }
  };

  const getAccountIcon = (accountType: string) => {
    switch (accountType) {
      case 'savings':
        return <PiggyBank className="h-6 w-6 text-green-600" />;
      case 'current':
        return <University className="h-6 w-6 text-green-600" />;
      case 'credit_card':
        return <CreditCard className="h-6 w-6 text-green-600" />;
      case 'fixed_deposit':
        return <Landmark className="h-6 w-6 text-green-600" />;
      case 'cash':
        return <Banknote className="h-6 w-6 text-green-600" />;
      case 'investment':
        return <HandCoins className="h-6 w-6 text-green-600" />;
      case 'chitfund':
        return <PiggyBank className="h-6 w-6 text-green-600" />;
      default:
        return <University className="h-6 w-6 text-green-600" />;
    }
  };

  const getAccountTypeLabel = (accountType: string) => {
    switch (accountType) {
      case 'savings':
        return 'Savings Account';
      case 'current':
        return 'Current Account';
      case 'credit_card':
        return 'Credit Card';
      case 'fixed_deposit':
        return 'Fixed Deposit';
      case 'cash':
        return 'Cash';
      case 'investment':
        return 'Investment';
      case 'chitfund':
        return 'Chit Fund';
      default:
        return accountType;
    }
  };

  const getBalanceColor = (balance: string, accountType: string) => {
    const numBalance = Number(balance);
    if (accountType === 'credit_card') {
      return numBalance < 0 ? 'text-red-600' : 'text-green-600';
    }
    return numBalance >= 0 ? 'text-green-600' : 'text-red-600';
  };

  const totalBalance = accounts.reduce((sum, account) => {
    if (account.accountType === 'credit_card') {
      return sum - Number(account.currentBalance); // Credit card balance is negative
    }
    return sum + Number(account.currentBalance);
  }, 0);

  return (
    <>
      <TopBar title="Bank Accounts" user={user} />
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Bank Accounts</h2>
            <p className="text-gray-600">Total Net Worth: ₹{totalBalance.toLocaleString()}</p>
          </div>
          <Button onClick={() => setShowAddModal(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Account
          </Button>
        </div>
        
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(3)].map((_, i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-6">
                  <div className="h-20 bg-gray-200 rounded"></div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : accounts.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <University className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No bank accounts found</h3>
              <p className="text-gray-600 mb-4">Add your first bank account to start tracking your finances</p>
              <Button onClick={() => setShowAddModal(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Add Your First Account
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {accounts.map((account) => (
              <Card key={account.id} className="shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                  {/* Move icons closer to the top */}
                  <div className="flex justify-center -mt-4 mb-2">
                    <div className="flex space-x-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setEditAccount(account);
                          setShowAddModal(true);
                        }}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => handleDelete(account.id)}
                        disabled={deleteAccountMutation.isPending}
                      >
                        <Trash2 className="h-4 w-4 text-red-600" />
                      </Button>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3 mb-4">
                    <div className="flex-shrink-0 h-10 w-10 bg-gray-100 rounded-lg flex items-center justify-center">
                      {getAccountIcon(account.accountType)}
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">{account.name}</h3>
                      <Badge variant="secondary" className="text-xs whitespace-nowrap">
                        {getAccountTypeLabel(account.accountType)}
                      </Badge>
                    </div>
                  </div>
                  
                  <div className="space-y-3">
                    <div>
                      <p className="text-sm text-gray-600">Account Number</p>
                      <p className="font-medium text-gray-900">
                        {account.accountNumber}
                      </p>
                    </div>
                    
                    <div>
                      <p className="text-sm text-gray-600">Current Balance</p>
                      <p className={`text-2xl font-bold ${getBalanceColor(account.currentBalance ?? '', account.accountType)}`}>
                        {account.accountType === 'credit_card' && Number(account.currentBalance) > 0 ? '-' : ''}
                        ₹{Number(account.currentBalance).toLocaleString()}
                      </p>
                    </div>
                    
                    <div>
                      <p className="text-sm text-gray-600">Initial Balance</p>
                      <p className="text-sm font-medium text-gray-900">
                        ₹{Number(account.initialBalance).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <p className="text-xs text-gray-500">
                      Added {account.createdAt ? new Date(account.createdAt).toLocaleDateString() : "Unknown date"}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
      <AddAccountModal
        isOpen={showAddModal}
        onClose={() => {
          setShowAddModal(false);
          setEditAccount(null);
        }}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['/api/accounts'] });
          setEditAccount(null);
        }}
        account={editAccount}
      />
    </>
  );
}
