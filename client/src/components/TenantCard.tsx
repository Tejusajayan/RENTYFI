import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { User, Edit, Trash2 } from "lucide-react";
import { Tenant, RentPayment } from "@shared/schema";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Shop {
  id: number;
  name: string;
  monthlyRent: number;
  tenantId?: number;
  isAdvancePaid?: boolean;
  allocatedAt?: string; // frontend camelCase
  allocated_at?: string; // backend snake_case
}

// Add tenantShops assignment type
interface TenantShopAssignment {
  shopId: number;
  tenantId: number;
  startDate: string; // ISO string
  endDate?: string | null;
}

export interface TenantCardProps {
  tenant: Tenant;
  rentPayments?: RentPayment[];
  onEdit?: (tenant: Tenant) => void;
  onDelete?: (tenantId: number) => void;
  shops?: Shop[];
  tenantShops?: TenantShopAssignment[];
  overdueMonths?: { month: number; year: number }[]; // <-- changed from overdueMonthsCount
}

export default function TenantCard({ 
  tenant, 
  rentPayments = [], 
  onEdit, 
  onDelete, 
  shops = [],
  tenantShops = [],
  overdueMonths = [],
}: TenantCardProps) {
  const queryClient = useQueryClient();
  const [showPendingModal, setShowPendingModal] = useState(false);
  // --- Add state for rent payment modal ---
  const [rentToPay, setRentToPay] = useState<RentPayment | null>(null);
  const [selectedAccountId, setSelectedAccountId] = useState<string>("");
  const { toast } = useToast();

  // --- Fetch all categories for "Out Tenant Pending Rent" ---
  const { data: categories = [] } = useQuery<any[]>({
    queryKey: ['/api/categories', 'property']
  });
  // --- Fetch all accounts for transaction creation ---
  const { data: accounts = [] } = useQuery<any[]>({
    queryKey: ['/api/accounts']
  });

  // Helper to get shop name by id
  const getShopName = (shopId: number) => {
    const shop = shops.find(s => s.id === shopId);
    return shop ? shop.name : `Shop ${shopId}`;
  };

  // Helper to get shop rent by id
  const getShopRent = (shopId: number) => {
    const shop = shops.find(s => s.id === shopId);
    return shop ? Number(shop.monthlyRent) : 0;
  };

  // Helper to get allocation (start) date for a shop-tenant
  const getAllocationDate = (shopId: number, tenantId: number) => {
    const assign = tenantShops.find(
      t => t.shopId === shopId && t.tenantId === tenantId && (!t.endDate || new Date(t.endDate) > new Date())
    );
    return assign ? new Date(assign.startDate) : null;
  };

  // Group payments by shopId, year, month
  const grouped: Record<string, RentPayment[]> = {};
  rentPayments.forEach(p => {
    const key = `${p.shopId}-${p.year}-${p.month}`;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(p);
  });

  // Define current month and year before use
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  // Calculate previous month and year
  let prevMonth = currentMonth - 1;
  let prevYear = currentYear;
  if (prevMonth === 0) {
    prevMonth = 12;
    prevYear = currentYear - 1;
  }

  // Get all shops currently occupied by this tenant
  const occupiedShops = shops
    .filter(s => {
      if (s.tenantId !== tenant.id) return false;
      const allocDateStr = s.allocatedAt ?? s.allocated_at;
      if (allocDateStr) {
        const allocDate = new Date(allocDateStr);
        return allocDate <= new Date();
      }
      return false;
    })
    .map(s => ({
      ...s,
      isAdvancePaid: !!s.isAdvancePaid
    }));

  // For each occupied shop, enumerate all months from allocation to current month and check for pending rent
  const pendingRents: {
    shopName: string;
    month: number;
    year: number;
    pending: number;
    isPast: boolean;
  }[] = [];

  occupiedShops.forEach(shop => {
    const allocationDateStr = shop.allocatedAt ?? shop.allocated_at;
    const allocationDate = allocationDateStr ? new Date(allocationDateStr) : null;
    if (!allocationDate) return;
    let y = allocationDate.getFullYear();
    let m = allocationDate.getMonth() + 1;
    let lastMonth = now.getMonth() + 1;
    let lastYear = now.getFullYear();
    if (now.getDate() === 1) {
      lastMonth = now.getMonth();
      if (lastMonth === 0) {
        lastMonth = 12;
        lastYear = now.getFullYear() - 1;
      }
    } else {
      lastMonth = now.getMonth();
      if (lastMonth === 0) {
        lastMonth = 12;
        lastYear = now.getFullYear() - 1;
      }
    }
    while (y < lastYear || (y === lastYear && m <= lastMonth)) {
      // --- Calculate pending as rentPayments.amount minus sum of all paid amounts for this period ---
      const payments = rentPayments.filter(
        p =>
          p.tenantId === tenant.id &&
          p.shopId === shop.id &&
          p.month === m &&
          p.year === y
      );
      // Use the amount from the rentPayments record for this month, fallback to shopRent if not present
      const periodAmount = payments.length > 0 ? Number(payments[0].amount ?? 0) : getShopRent(shop.id);
      const totalPaid = payments.reduce((sum, p) => sum + Number(p.paidAmount ?? 0), 0);
      const pending = Math.max(periodAmount - totalPaid, 0);
      if (pending > 0) {
        const isPast = (y < currentYear) || (y === currentYear && m < currentMonth);
        pendingRents.push({
          shopName: shop.name || `Shop ${shop.id}`,
          month: m,
          year: y,
          pending,
          isPast,
        });
      }
      m++;
      if (m > 12) {
        m = 1;
        y++;
      }
    }
  });

  // Only include pending rents for months in overdueMonths
  const pendingRentsPast = pendingRents.filter(
    r =>
      overdueMonths.some(
        om =>
          om.year === r.year &&
          om.month === r.month
      )
  );

  const pendingRentRecords: RentPayment[] = [];
  const seenPeriods = new Set<string>();
  rentPayments
    .filter(p => p.tenantId === tenant.id)
    .forEach(p => {
      const key = `${p.shopId}-${p.year}-${p.month}`;
      if (seenPeriods.has(key)) return;
      const periodPayments = rentPayments.filter(
        pp =>
          pp.tenantId === tenant.id &&
          pp.shopId === p.shopId &&
          pp.month === p.month &&
          pp.year === p.year
      );
      const periodAmount = periodPayments.length > 0 ? Number(periodPayments[0].amount ?? 0) : 0;
      const totalPaid = periodPayments.reduce((sum, pp) => sum + Number(pp.paidAmount ?? 0), 0);
      const pending = Math.max(periodAmount - totalPaid, 0);
      if (pending > 0) {
        // Clone the payment and override pendingAmount to match the real pending for this period
        pendingRentRecords.push({
          ...p,
          pendingAmount: pending.toFixed(2),
          amount: periodAmount.toFixed(2),
        });
      }
      seenPeriods.add(key);
    });

  // --- Find if tenant is currently allocated to any shop ---
  const isCurrentlyAllocated = shops.some(
    s => s.tenantId === tenant.id && s.allocated_at && new Date(s.allocated_at) <= new Date()
  );

  // --- Show badge if there are pending rents, even if not allocated ---
  const hasActualOverdue = pendingRentRecords.length > 0;

  // --- Rent Paid mutation ---
  const rentPaidMutation = useMutation({
    mutationFn: async ({ pending, accountId }: { pending: RentPayment, accountId: number }) => {
      // Find the "Out Tenant Pending Rent" category (must exist)
      const outCat = categories.find(
        (c: any) =>
          c.name?.toLowerCase() === "out tenant pending rent" &&
          c.type === "income" &&
          c.context === "property"
      );
      if (!outCat) throw new Error('Category "Out Tenant Pending Rent" not found. Please create it first.');

      // Find the selected account
      const account = accounts.find((a: any) => a.id === accountId);
      if (!account) throw new Error("No bank account found. Please select an account.");

      // Create transaction for the pending rent
      await apiRequest("POST", "/api/transactions", {
        type: "income",
        context: "property",
        accountId: account.id,
        description: `Pending rent received from ${tenant.name} (Out Tenant) for ${new Date(pending.year, pending.month - 1).toLocaleString('default', { month: 'long' })} ${pending.year}`,
        amount: pending.pendingAmount,
        categoryId: outCat.id,
        tenantId: tenant.id,
        shopId: pending.shopId,
        buildingId: undefined,
        transactionDate: new Date().toISOString(),
        notes: "Auto-generated for out tenant pending rent",
      });

      // Delete the rent payment record
      await apiRequest("DELETE", `/api/rent-payments/${pending.id}`);

      // Invalidate queries to refresh UI
      queryClient.invalidateQueries({ queryKey: ['/api/rent-payments'] });
      queryClient.invalidateQueries({ queryKey: ['/api/transactions'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/property'] });
      queryClient.invalidateQueries({ queryKey: ['/api/tenants'] });
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Pending rent marked as paid and transaction created.",
      });
      setRentToPay(null);
      setSelectedAccountId("");
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to mark rent as paid",
        variant: "destructive",
      });
    }
  });

  return (
    <Card className="shadow-sm border border-gray-200 overflow-hidden">
      <CardContent className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className="h-12 w-12 rounded-full flex items-center justify-center bg-emerald-100">
              <User className="text-emerald-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">{tenant.name}</h3>
              <p className="text-sm text-gray-600">{tenant.phone}</p>
            </div>
          </div>
    {/* Rent overdue badges moved to bottom right */}
        </div>
        
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <p className="text-xs text-gray-500">Contact</p>
            <p className="text-sm font-medium text-gray-900">{tenant.phone || 'N/A'}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Email</p>
            <p className="text-sm font-medium text-gray-900">{tenant.email || 'N/A'}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Aadhaar</p>
            <p className="text-sm font-medium text-gray-900">
              {tenant.aadhaarNumber || 'N/A'}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Address</p>
            <p className="text-sm font-medium text-gray-900">{tenant.address || 'N/A'}</p>
          </div>
        </div>

        {/* Advance Paid/Not Paid Indication for each allocated shop */}
        {occupiedShops.length > 0 && (
          <div className="mb-4">
            <h4 className="text-sm font-medium text-gray-700 mb-2">Advance Amount Status</h4>
            <ul className="space-y-1">
              {occupiedShops.map(shop => (
                <li key={shop.id} className="text-xs font-medium flex items-center space-x-2">
                  <span>{shop.name || `Shop ${shop.id}`}</span>
                  {shop.isAdvancePaid ? (
                    <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-700">Advance Paid</span>
                  ) : (
                    <span className="px-2 py-0.5 rounded bg-red-100 text-red-700">Advance Not Paid</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Pending Rent Modal */}
        {showPendingModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="bg-white rounded-lg shadow-lg max-w-md w-full p-6 relative">
              <button
                className="absolute top-2 right-2 text-gray-400 hover:text-gray-600"
                onClick={() => setShowPendingModal(false)}
                aria-label="Close"
              >
                ×
              </button>
              <h3 className="text-lg font-semibold mb-4 text-gray-900">Pending Rent Records</h3>
              {pendingRentRecords.length === 0 ? (
                <div className="text-gray-600 text-center py-8">No pending rent records.</div>
              ) : (
                <ul className="space-y-2 max-h-64 overflow-y-auto">
                  {pendingRentRecords
                    .sort((a, b) => a.year - b.year || a.month - b.month)
                    .map((p, idx) => (
                      <li
                        key={p.id}
                        className="flex justify-between items-center text-sm border-b last:border-b-0 py-1"
                      >
                        <span>
                          <span className="font-medium">
                            {shops.find(s => s.id === p.shopId)?.name || `Shop ${p.shopId}`}
                          </span>
                          {" — "}
                          {new Date(p.year, p.month - 1).toLocaleString('default', { month: 'long' })} {p.year}
                        </span>
                        <span className="flex items-center space-x-2">
                          <span className="text-red-700 font-semibold">
                            ₹{Number(p.pendingAmount).toLocaleString()}
                          </span>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={rentPaidMutation.isPending}
                            onClick={() => {
                              setRentToPay(p);
                              setSelectedAccountId(""); // reset
                            }}
                          >
                            Rent Paid
                          </Button>
                        </span>
                      </li>
                    ))}
                </ul>
              )}
              <div className="mt-6 flex justify-end">
                <Button variant="outline" onClick={() => setShowPendingModal(false)}>
                  Close
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* --- Modal for selecting account when marking rent as paid --- */}
        {rentToPay && (
          <Dialog open={!!rentToPay} onOpenChange={() => { setRentToPay(null); setSelectedAccountId(""); }}>
            <DialogContent className="sm:max-w-xs">
              <DialogHeader>
                <DialogTitle>Select Account for Rent Payment</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <div className="mb-2 text-sm">
                    Mark rent as paid for <b>{shops.find(s => s.id === rentToPay.shopId)?.name || `Shop ${rentToPay.shopId}`}</b> — {new Date(rentToPay.year, rentToPay.month - 1).toLocaleString('default', { month: 'long' })} {rentToPay.year}
                  </div>
                  <Select
                    value={selectedAccountId}
                    onValueChange={setSelectedAccountId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select account" />
                    </SelectTrigger>
                    <SelectContent>
                      {accounts.map((acc: any) => (
                        <SelectItem key={acc.id} value={acc.id.toString()}>
                          {acc.name} ({acc.accountType})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex justify-end space-x-2">
                  <Button
                    variant="outline"
                    onClick={() => { setRentToPay(null); setSelectedAccountId(""); }}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={() => {
                      if (!selectedAccountId) {
                        toast({
                          title: "Error",
                          description: "Please select an account",
                          variant: "destructive",
                        });
                        return;
                      }
                      rentPaidMutation.mutate({ pending: rentToPay, accountId: Number(selectedAccountId) });
                    }}
                    disabled={rentPaidMutation.isPending || !selectedAccountId}
                  >
                    {rentPaidMutation.isPending ? "Processing..." : "Confirm Paid"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}

        <div className="flex justify-between items-center mt-4">
          {/* Bottom left: Pending Rent button (show if any pending rent, even if not allocated) */}
          <div>
            {hasActualOverdue && (
              <Button
                size="sm"
                // Change color based on out tenant (not currently allocated)
                className={
                  !isCurrentlyAllocated
                    ? "bg-yellow-500 text-white hover:bg-yellow-600"
                    : "bg-blue-600 text-white hover:bg-blue-700"
                }
                onClick={() => setShowPendingModal(true)}
              >
                Pending Rent
              </Button>
            )}
          </div>
          {/* Bottom right: Edit/Delete and vertically stacked rent badges below */}
          <div className="flex flex-col items-end">
            <div className="flex space-x-2 mb-1">
              {onEdit && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onEdit(tenant)}
                >
                  <Edit className="h-4 w-4" />
                </Button>
              )}
              {onDelete && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onDelete(tenant.id)}
                >
                  <Trash2 className="h-4 w-4 text-red-600" />
                </Button>
              )}
            </div>
            <div className="flex flex-col items-end gap-1">
              {/* Show a badge for each shop with overdue rent, stacked vertically */}
              {occupiedShops.map(shop => {
                // Only count unique months with actual pending for this shop
                const overdueCount = pendingRentRecords.filter(p => p.shopId === shop.id).length;
                if (overdueCount === 0) return null;
                return (
                  <Badge key={shop.id} variant="destructive">
                    {shop.name || `Shop ${shop.id}`}: {overdueCount} Month{overdueCount > 1 ? "s" : ""} Overdue
                  </Badge>
                );
              })}
              {/* If there are overdue rents not tied to a current shop (shouldn't happen, but fallback) */}
              {pendingRentRecords.length > 0 && occupiedShops.length === 0 && (
                <Badge variant="destructive">
                  {pendingRentRecords.length} Month{pendingRentRecords.length > 1 ? "s" : ""} Overdue
                </Badge>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}