import { useState, useMemo, useRef, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Shop, Tenant, RentPayment } from "@shared/schema";

interface AddRentPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  tenants: Tenant[];
  rentPayments: RentPayment[];
  onSubmitTransform?: (data: any) => any; // <-- add this prop
  onSuccess?: () => void;
}

export default function AddRentPaymentModal({ isOpen, onClose, tenants, rentPayments, onSubmitTransform, onSuccess }: AddRentPaymentModalProps) {
  const [selectedTenantId, setSelectedTenantId] = useState<string>("");
  const [selectedShopId, setSelectedShopId] = useState<string>("");
  const [selectedMonth, setSelectedMonth] = useState<string>(`${new Date().getMonth() + 1}`);
  const [selectedYear, setSelectedYear] = useState<string>(`${new Date().getFullYear()}`);
  const [paidAmount, setPaidAmount] = useState<string>("");
  const [selectedAccountId, setSelectedAccountId] = useState<string>("");
  const [paymentDate, setPaymentDate] = useState<string>(() => {
    const today = new Date();
    return today.toISOString().slice(0, 10); // yyyy-mm-dd
  });
  const [tenantSearch, setTenantSearch] = useState(""); // input value
  const [tenantSearchQuery, setTenantSearchQuery] = useState(""); // actual search query
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [tenantDropdownOpen, setTenantDropdownOpen] = useState(false);
  const queryClient = useQueryClient();

  const { toast } = useToast();

  // Fetch all shops for dropdown
  const { data: shops = [] } = useQuery<Shop[]>({
    queryKey: ['/api/shops']
  });

  // Fetch accounts for dropdown
  const { data: accounts = [] } = useQuery<any[]>({
    queryKey: ['/api/accounts']
  });

  // Fetch categories to find "Rent" category
  const { data: categories = [] } = useQuery<any[]>({
    queryKey: ['/api/categories', 'property']
  });

  // Focus search input when dropdown opens
  useEffect(() => {
    if (tenantDropdownOpen) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 0);
    }
  }, [tenantDropdownOpen]);

  // Show all shops assigned to this tenant (not just those with payments)
  const tenantShops = useMemo(() => {
    if (!selectedTenantId) return [];
    // Only show shops where shop.tenantId === selectedTenantId
    return shops.filter(shop => shop.tenantId === Number(selectedTenantId));
  }, [selectedTenantId, shops]);

  // Get shop rent
  const shopRent = useMemo(() => {
    const shop = shops.find(s => s.id === Number(selectedShopId));
    return shop ? Number(shop.monthlyRent) : 0;
  }, [selectedShopId, shops]);

  // Calculate pending rent for this tenant/shop/month/year (sum all payments)
  const pendingRent = useMemo(() => {
    if (!selectedTenantId || !selectedShopId) return 0;
    // Use pendingAmount from rentPayments if present, else fallback to shopRent - paid
    const payments = rentPayments.filter(
      p =>
        p.tenantId === Number(selectedTenantId) &&
        p.shopId === Number(selectedShopId) &&
        p.month === Number(selectedMonth) &&
        p.year === Number(selectedYear)
    );
    if (payments.length > 0) {
      // Use the amount from the rentPayments record for this period
      const periodAmount = Number(payments[0].amount ?? 0);
      const totalPaid = payments.reduce((sum, p) => sum + Number(p.paidAmount ?? 0), 0);
      return Math.max(periodAmount - totalPaid, 0);
    }
    // No payment record: full rent is pending
    return shopRent;
  }, [selectedTenantId, selectedShopId, selectedMonth, selectedYear, rentPayments, shopRent]);

  // Compute all pending months for selected tenant/shop
  const pendingMonths = useMemo(() => {
    if (!selectedTenantId || !selectedShopId) return [];
    const shop = shops.find(s => s.id === Number(selectedShopId));
    if (!shop || !shop.allocated_at) return [];
    let y = new Date(shop.allocated_at).getFullYear();
    let m = new Date(shop.allocated_at).getMonth() + 1;
    const now = new Date();
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
    const result: { month: number; year: number; pending: number }[] = [];
    while (y < lastYear || (y === lastYear && m <= lastMonth)) {
      const payments = rentPayments.filter(
        p =>
          p.tenantId === Number(selectedTenantId) &&
          p.shopId === Number(selectedShopId) &&
          p.month === m &&
          p.year === y
      );
      let pending = 0;
      if (payments.length > 0) {
        // Use the amount from the rentPayments record for this period
        const periodAmount = Number(payments[0].amount ?? 0);
        const totalPaid = payments.reduce((sum, p) => sum + Number(p.paidAmount ?? 0), 0);
        pending = Math.max(periodAmount - totalPaid, 0);
      } else {
        pending = Number(shop.monthlyRent);
      }
      if (pending > 0) {
        result.push({ month: m, year: y, pending });
      }
      m++;
      if (m > 12) {
        m = 1;
        y++;
      }
    }
    return result;
  }, [selectedTenantId, selectedShopId, shops, rentPayments]);

  // Compute last month and year
  const now = new Date();
  let lastMonth = now.getMonth(); // 0-based, so Jan=0
  let lastYear = now.getFullYear();
  if (lastMonth === 0) {
    lastMonth = 12;
    lastYear = now.getFullYear() - 1;
  }

  // Helper: Check if a tenant has pending rent for any shop for any month/year up to last month
  function hasPendingRentUpToLastMonth(tenant: Tenant): boolean {
    // Find all shops assigned to this tenant
    const tenantShops = shops.filter(shop => shop.tenantId === tenant.id);
    for (const shop of tenantShops) {
      // Find all months from allocation up to last month
      if (!shop.allocated_at) continue;
      let y = new Date(shop.allocated_at).getFullYear();
      let m = new Date(shop.allocated_at).getMonth() + 1;
      while (y < lastYear || (y === lastYear && m <= lastMonth)) {
        // Find payments for this shop/tenant/month/year
        const payments = rentPayments.filter(
          p =>
            p.tenantId === tenant.id &&
            p.shopId === shop.id &&
            p.month === m &&
            p.year === y
        );
        let pending = 0;
        if (payments.length > 0) {
          // Use the amount from the rentPayments record for this period
          const periodAmount = Number(payments[0].amount ?? 0);
          const totalPaid = payments.reduce((sum, p) => sum + Number(p.paidAmount ?? 0), 0);
          pending = Math.max(periodAmount - totalPaid, 0);
        } else {
          pending = Number(shop.monthlyRent);
        }
        if (pending > 0) return true;
        m++;
        if (m > 12) {
          m = 1;
          y++;
        }
      }
    }
    return false;
  }

  // Filter tenants by search and by pending rent up to last month
  const filteredTenants = useMemo(() => {
    let base = tenants;
    if (tenantSearchQuery.trim()) {
      const q = tenantSearchQuery.trim().toLowerCase();
      base = base.filter(t =>
        t.name?.toLowerCase().includes(q) ||
        t.phone?.toLowerCase().includes(q) ||
        t.email?.toLowerCase().includes(q) ||
        t.aadhaarNumber?.toLowerCase().includes(q)
      );
    }
    // Only include tenants with pending rent up to last month
    return base.filter(hasPendingRentUpToLastMonth);
  }, [tenantSearchQuery, tenants, shops, rentPayments, lastMonth, lastYear]);

  // On submit, create or update rent payment record and then a transaction record
  const mutation = useMutation({
    mutationFn: async (data: any) => {
      // Use upsert endpoint to avoid duplicate records
      const res = await apiRequest('POST', '/api/rent-payments/upsert', data);
      return res.json();
    },
    onSuccess: async (rentPaymentData) => {
      // After rent payment, create a transaction record for rent income
      if (selectedAccountId && paidAmount) {
        // Find rent category (income, property context)
        let rentCategory = categories.find(
          (c: any) =>
            c.name?.toLowerCase() === "rent" &&
            c.type === "income" &&
            c.context === "property"
        );
        // If not found, fallback to first category or undefined
        const rentCategoryId = rentCategory?.id;

        // --- Get buildingId from shop ---
        const shop = shops.find(s => s.id === Number(selectedShopId));
        const buildingId = shop?.buildingId;

        // --- Always include paid month/year in description ---
        const paidMonth = Number(selectedMonth);
        const paidYear = Number(selectedYear);
        const monthName = new Date(paidYear, paidMonth - 1).toLocaleString('default', { month: 'long' });
        const descMonth = ` for ${monthName} ${paidYear}`;

        // Prepare transaction payload
        const transactionPayload = {
          type: "income",
          context: "property",
          accountId: Number(selectedAccountId),
          description: `Rent received from ${tenants.find(t => t.id === Number(selectedTenantId))?.name || "Tenant"}${descMonth}`,
          amount: paidAmount,
          categoryId: rentCategoryId,
          tenantId: Number(selectedTenantId),
          shopId: Number(selectedShopId),
          buildingId: buildingId,
          transactionDate: new Date().toISOString(),
          notes: `Auto-generated for rent payment`,
        };
        // Create transaction
        await apiRequest('POST', '/api/transactions', transactionPayload);
        queryClient.invalidateQueries({ queryKey: ['/api/transactions'] });
      }
      // Invalidate rent-payments and tenants to refresh UI
      queryClient.invalidateQueries({ queryKey: ['/api/rent-payments'] });
      queryClient.invalidateQueries({ queryKey: ['/api/tenants'] });
      // --- Add this line to refresh dashboard property data ---
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/property'] });
      toast({
        title: "Success",
        description: "Rent payment recorded!",
      });
      handleClose();
      if (onSuccess) onSuccess();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to record rent payment",
        variant: "destructive",
      });
    }
  });

  const handleClose = () => {
    setSelectedTenantId("");
    setSelectedShopId("");
    setSelectedMonth(`${new Date().getMonth() + 1}`);
    setSelectedYear(`${new Date().getFullYear()}`);
    setPaidAmount("");
    setSelectedAccountId("");
    setPaymentDate(new Date().toISOString().slice(0, 10));
    setShowValidation(false);
    onClose();
  };

  // Add a flag for fully paid period
  const isFullyPaidForPeriod = useMemo(() => {
    if (!selectedTenantId || !selectedShopId) return false;
    // Sum all paid amounts for this period
    const payments = rentPayments.filter(
      p =>
        p.tenantId === Number(selectedTenantId) &&
        p.shopId === Number(selectedShopId) &&
        p.month === Number(selectedMonth) &&
        p.year === Number(selectedYear)
    );
    // Use the amount from the rentPayments record for this period
    const periodAmount = payments.length > 0 ? Number(payments[0].amount ?? 0) : shopRent;
    const totalPaid = payments.reduce((sum, p) => sum + Number(p.paidAmount ?? 0), 0);
    return periodAmount > 0 && totalPaid >= periodAmount;
  }, [selectedTenantId, selectedShopId, selectedMonth, selectedYear, rentPayments, shopRent]);

  // Validation flags for missed inputs
  const [showValidation, setShowValidation] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setShowValidation(true);

    // Prevent submission if tenant has no assigned shops
    if (!selectedTenantId || !selectedShopId || !paidAmount || tenantShops.length === 0 || !selectedAccountId || !paymentDate) {
      toast({
        title: "Error",
        description: tenantShops.length === 0 ? "This tenant is not allocated to any shop. Please assign a shop before recording rent payment." : "Please fill all required fields.",
        variant: "destructive",
      });
      return;
    }
    // Prevent submitting for a fully paid period
    if (isFullyPaidForPeriod) {
      toast({
        title: "Already Paid",
        description: "The rent for this shop and month is already fully paid.",
        variant: "default",
      });
      return;
    }
    const paid = Number(paidAmount);

    // --- Calculate total paid so far for this period ---
    const payments = rentPayments.filter(
      p =>
        p.tenantId === Number(selectedTenantId) &&
        p.shopId === Number(selectedShopId) &&
        p.month === Number(selectedMonth) &&
        p.year === Number(selectedYear)
    );
    // Use the amount from the rentPayments record for this period
    const periodAmount = payments.length > 0 ? Number(payments[0].amount ?? 0) : shopRent;
    const totalPaidSoFar = payments.reduce((sum, p) => sum + Number(p.paidAmount ?? 0), 0);

    // --- New validation: total paid (so far + this) should not exceed periodAmount ---
    if (paid + totalPaidSoFar > periodAmount) {
      toast({
        title: "Amount Exceeds Actual Rent",
        description: `The total paid amount for this period (including this payment) cannot exceed the rent for that month (₹${periodAmount}).`,
        variant: "destructive",
      });
      return;
    }
    if (paid <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Amount paid must be greater than zero.",
        variant: "destructive",
      });
      return;
    }

    // Calculate pending after this payment
    const pending = Math.max(periodAmount - (totalPaidSoFar + paid), 0);

    // --- Set paymentDate with current time if date is selected ---
    let paymentDateObj: Date | undefined = undefined;
    if (paymentDate) {
      // Combine selected date with current time
      const [year, month, day] = paymentDate.split('-').map(Number);
      const now = new Date();
      paymentDateObj = new Date(
        year, month - 1, day,
        now.getHours(), now.getMinutes(), now.getSeconds(), now.getMilliseconds()
      );
      // Only keep if valid
      if (isNaN(paymentDateObj.getTime())) paymentDateObj = undefined;
    }

    let data = {
      tenantId: Number(selectedTenantId),
      shopId: Number(selectedShopId),
      month: Number(selectedMonth),
      year: Number(selectedYear),
      amount: shopRent,
      paidAmount: paid,
      pendingAmount: pending,
      status: pending === 0 ? "paid" : "pending",
      ...(paymentDateObj ? { paymentDate: paymentDateObj } : {}),
    };
    if (onSubmitTransform) {
      data = onSubmitTransform(data);
    }
    mutation.mutate(data);
  };

  // Month options
  const months = [
    { value: "1", label: "January" }, { value: "2", label: "February" }, { value: "3", label: "March" },
    { value: "4", label: "April" }, { value: "5", label: "May" }, { value: "6", label: "June" },
    { value: "7", label: "July" }, { value: "8", label: "August" }, { value: "9", label: "September" },
    { value: "10", label: "October" }, { value: "11", label: "November" }, { value: "12", label: "December" },
  ];

  // Year options (current and previous 2 years)
  const currentYear = new Date().getFullYear();
  const years = [currentYear, currentYear - 1, currentYear - 2].map(y => `${y}`);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        className="sm:max-w-md"
        style={{
          maxHeight: "80vh",
          overflowY: "auto"
        }}
      >
        <DialogHeader>
          <DialogTitle>Record Rent Payment</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Tenant *</Label>
            <Select
              value={selectedTenantId}
              onValueChange={setSelectedTenantId}
              open={tenantDropdownOpen}
              onOpenChange={setTenantDropdownOpen}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select tenant" />
              </SelectTrigger>
              <SelectContent>
                {/* Search bar inside dropdown */}
                <div className="px-2 py-1">
                  <input
                    ref={searchInputRef}
                    type="text"
                    placeholder="Search tenants... (press Enter)"
                    value={tenantSearch}
                    onChange={e => setTenantSearch(e.target.value)}
                    onKeyDown={e => {
                      // Prevent dropdown from closing and keep focus
                      e.stopPropagation();
                      if (e.key === "Enter") {
                        setTenantSearchQuery(tenantSearch);
                        e.preventDefault();
                      }
                    }}
                    className="w-full px-2 py-1 border rounded text-sm"
                  />
                </div>
                {filteredTenants.length === 0 ? (
                  <div className="px-2 py-2 text-gray-500 text-sm">No tenants found</div>
                ) : (
                  filteredTenants.map(t => (
                    <SelectItem key={t.id} value={String(t.id)}>
                      {t.name} {t.phone ? `(${t.phone})` : ""}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            {showValidation && !selectedTenantId && (
              <div className="text-red-600 text-xs mt-1">Please select a tenant.</div>
            )}
          </div>
          <div>
            <Label>Shop *</Label>
            <Select value={selectedShopId} onValueChange={setSelectedShopId} disabled={!selectedTenantId || tenantShops.length === 0}>
              <SelectTrigger>
                <SelectValue placeholder={tenantShops.length === 0 ? "No shops assigned" : "Select shop"} />
              </SelectTrigger>
              <SelectContent>
                {tenantShops.length > 0 && tenantShops.map(shop => (
                  <SelectItem key={shop.id} value={shop.id.toString()}>
                    {shop.name || `Shop ${shop.shopNumber}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {showValidation && !selectedShopId && (
              <div className="text-red-600 text-xs mt-1">Please select a shop.</div>
            )}
          </div>
          <div className="flex space-x-2">
            <div className="flex-1">
              <Label>Month *</Label>
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {months.map(m => (
                    <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {showValidation && !selectedMonth && (
                <div className="text-red-600 text-xs mt-1">Please select a month.</div>
              )}
            </div>
            <div className="flex-1">
              <Label>Year *</Label>
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {years.map(y => (
                    <SelectItem key={y} value={y}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {showValidation && !selectedYear && (
                <div className="text-red-600 text-xs mt-1">Please select a year.</div>
              )}
            </div>
          </div>
          <div>
            <Label>Shop Rent</Label>
            <Input value={shopRent ? `₹${shopRent.toLocaleString()}` : ""} readOnly />
          </div>
          <div>
            <Label>Amount Paid *</Label>
            <Input
              type="number"
              min={0}
              max={pendingRent}
              value={paidAmount}
              onChange={e => setPaidAmount(e.target.value)}
              placeholder="Enter amount paid"
              required
              onWheel={e => (e.target as HTMLInputElement).blur()}
              disabled={pendingRent === 0 || isFullyPaidForPeriod}
            />
            {showValidation && !paidAmount && (
              <div className="text-red-600 text-xs mt-1">Please enter the amount paid.</div>
            )}
            {isFullyPaidForPeriod && selectedTenantId && selectedShopId && (
              <div className="text-green-600 text-sm mt-1">
                Full rent has already been paid for this shop and period. You cannot add another payment.
              </div>
            )}
            {pendingRent === 0 && !isFullyPaidForPeriod && selectedTenantId && selectedShopId && (
              <div className="text-green-600 text-sm mt-1">
                Full rent has already been paid for this shop and period.
              </div>
            )}
          </div>
          <div>
            <Label>Pending Rent</Label>
            <Input value={paidAmount ? `₹${Math.max(pendingRent - Number(paidAmount), 0).toLocaleString()}` : pendingRent ? `₹${pendingRent.toLocaleString()}` : ""} readOnly />
          </div>
          <div>
            <Label>Account Received In *</Label>
            <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
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
            {showValidation && !selectedAccountId && (
              <div className="text-red-600 text-xs mt-1">Please select an account.</div>
            )}
          </div>
          <div>
            <Label>Payment Received On *</Label>
            <Input
              type="date"
              value={paymentDate}
              onChange={e => setPaymentDate(e.target.value)}
              required
            />
            {showValidation && !paymentDate && (
              <div className="text-red-600 text-xs mt-1">Please select the payment date.</div>
            )}
          </div>
          <div>
            <Label>Pending Months</Label>
            {pendingMonths.length === 0 ? (
              <div className="text-green-600 text-sm">No pending months</div>
            ) : (
              <ul className="text-sm text-red-700 space-y-1">
                {pendingMonths.map(pm => (
                  <li key={`${pm.year}-${pm.month}`}>
                    {new Date(pm.year, pm.month - 1).toLocaleString('default', { month: 'long' })} {pm.year} - ₹{pm.pending.toLocaleString()}
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="ml-2"
                      onClick={() => {
                        setSelectedMonth(pm.month.toString());
                        setSelectedYear(pm.year.toString());
                        setPaidAmount(pm.pending.toString());
                      }}
                    >
                      Pay Now
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="flex justify-end space-x-2">
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={mutation.isPending || tenantShops.length === 0 || isFullyPaidForPeriod}
            >
              {mutation.isPending ? "Saving..." : "Save"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}