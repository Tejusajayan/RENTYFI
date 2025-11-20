import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ShoppingCart, Wallet, Car, Edit, Trash2 } from "lucide-react";
import { Transaction } from "@shared/schema";
import { useNavigate } from "react-router-dom";

interface TransactionsListProps {
  transactions: Transaction[];
  onEdit?: (transaction: Transaction) => void;
  onDelete?: (transactionId: number) => void;
  showActions?: boolean;
}

function getTransactionIcon(description: string) {
  const lower = description.toLowerCase();
  if (lower.includes('grocery') || lower.includes('shopping')) {
    return <ShoppingCart className="text-amber-600 text-sm" />;
  } else if (lower.includes('salary') || lower.includes('income')) {
    return <Wallet className="text-emerald-600 text-sm" />;
  } else if (lower.includes('fuel') || lower.includes('gas')) {
    return <Car className="text-cyan-600 text-sm" />;
  }
  return <Wallet className="text-gray-600 text-sm" />;
}

function getTransactionColor(type: string) {
  return type === 'income' ? 'text-emerald-600' : 'text-red-600';
}

export default function TransactionsList({ 
  transactions, 
  onEdit, 
  onDelete, 
  showActions = false 
}: TransactionsListProps) {
  const navigate = useNavigate();

  if (transactions.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <p className="text-gray-500">No transactions found</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          Recent Transactions
          {!showActions && (
            <Button variant="link" size="sm" onClick={() => navigate('/transactions')}>
              View all
            </Button>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y divide-gray-200">
          {transactions.map((transaction) => (
            <div key={transaction.id} className="p-4 hover:bg-gray-50 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${
                  transaction.type === 'income' ? 'bg-green-100' : 'bg-red-100'
                }`}>
                  {getTransactionIcon(transaction.description)}
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">{transaction.description}</p>
                  <p className="text-xs text-gray-500">
                    {transaction.transactionDate
                      ? new Date(transaction.transactionDate).toLocaleDateString()
                      : ""}
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <span className={`text-sm font-medium ${getTransactionColor(transaction.type)}`}>
                  {transaction.type === 'income' ? '+' : '-'}₹{Number(transaction.amount).toLocaleString()}
                </span>
                {showActions && (
                  <div className="flex space-x-1">
                    {onEdit && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onEdit(transaction)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                    )}
                    {onDelete && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onDelete(transaction.id)}
                      >
                        <Trash2 className="h-4 w-4 text-red-600" />
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
