import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import TopBar from "@/components/TopBar";
import { useAuth } from "@/hooks/useAuth";
import TenantCard from "@/components/TenantCard";
import AddTenantModal from "@/components/AddTenantModal";
import AddRentPaymentModal from "@/components/AddRentPaymentModal";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Plus, Users } from "lucide-react";
import { Tenant, RentPayment, Shop } from "@shared/schema";

// Define or import RentPaymentModalSubmitData type
type RentPaymentModalSubmitData = {
  tenantId: number;
  shopId?: number;
  amount?: number | string;
  paidAmount?: number | string;
  pendingAmount?: number | string;
  paymentDate?: string;
  month: number;
  year: number;
  status?: string;
};

// Define AddTenantModalSaveData type if not already imported
type AddTenantModalSaveData = {
  id?: number;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  aadhaarNumber?: string;
};
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";

export default function Tenants() {
  const [showAddModal, setShowAddModal] = useState(false);
  const [showRentModal, setShowRentModal] = useState(false);
  const [editTenant, setEditTenant] = useState<Tenant | null>(null);
  const [search, setSearch] = useState("");
  type SortType = "" | "rent" | "advance" | "allocated" | "not_allocated";
  const [sortType, setSortType] = useState<SortType>(""); // Explicitly typed, fixes type narrowing
  const user = useAuth();

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: tenants = [], isLoading } = useQuery<Tenant[]>({
    queryKey: ['/api/tenants']
  });

  const { data: rentPayments = [] } = useQuery<RentPayment[]>({
    queryKey: ['/api/rent-payments']
  });

  const { data: shops = [] } = useQuery<Shop[]>({
    queryKey: ['/api/shops']
  });

  const deleteTenantMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest('DELETE', `/api/tenants/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tenants'] });
      toast({
        title: "Success",
        description: "Tenant deleted successfully!",
      });
    },
    onError: (error: any) => {
      // Show a more user-friendly error if deletion fails due to related records
      toast({
        title: "Error",
        description:
          error?.message?.includes("foreign key") || error?.message?.includes("constraint")
            ? "Cannot delete tenant: Please remove all related rent payments and assignments first."
            : error.message || "Failed to delete tenant",
        variant: "destructive",
      });
    },
  });

  const handleDelete = (id: number) => {
    if (confirm("Are you sure you want to delete this tenant?")) {
      deleteTenantMutation.mutate(id);
    }
  };

  // Edit handler
  const handleEdit = (tenant: Tenant) => {
    setEditTenant(tenant);
    setShowAddModal(true);
  };

  // Helper: get latest payment for a tenant for a given month/year
  function getLatestPayment(tenantId: number, month: number, year: number) {
    const payments = rentPayments.filter(
      p => p.tenantId === tenantId && p.month === month && p.year === year
    );
    if (payments.length === 0) return undefined;
    // Prefer latest by paymentDate, fallback to highest id
    return payments.reduce((latest, curr) => {
      const latestDate = latest.paymentDate && !isNaN(new Date(latest.paymentDate).getTime()) ? new Date(latest.paymentDate) : undefined;
      const currDate = curr.paymentDate && !isNaN(new Date(curr.paymentDate).getTime()) ? new Date(curr.paymentDate) : undefined;
      if (currDate && latestDate && currDate > latestDate) return curr;
      if (!currDate && !latestDate && curr.id > latest.id) return curr;
      return latest;
    }, payments[0]);
  }

  const currentMonth = new Date().getMonth() + 1;
  const currentYear = new Date().getFullYear();

  // --- Get all shops for allocation check ---
  // (shops already fetched above)

  // --- Maintain original tenant order using useRef ---
  const originalOrderRef = useRef<number[]>([]);
  useEffect(() => {
    if (tenants.length && originalOrderRef.current.length === 0) {
      // Store the initial order of tenant IDs
      originalOrderRef.current = tenants.map(t => t.id);
    }
    // If a new tenant is added (not present in ref), append it to the order
    if (tenants.length && originalOrderRef.current.length) {
      const currentIds = tenants.map(t => t.id);
      currentIds.forEach(id => {
        if (!originalOrderRef.current.includes(id)) {
          originalOrderRef.current.push(id);
        }
      });
    }
  }, [tenants]);

  // --- Get the earliest allocation date for a tenant (from their allocated shops) ---
  function getTenantAllocationDate(tenantId: number): Date | null {
    const allocatedShops = shops.filter(shop => shop.tenantId === tenantId && shop.allocated_at);
    if (allocatedShops.length === 0) return null;
    // Find the earliest allocatedAt date among allocated shops
    const times = allocatedShops
      .map(shop => shop.allocated_at)
      .filter((allocatedAt) => allocatedAt !== null && allocatedAt !== undefined)
      .map(allocatedAt => new Date(allocatedAt).getTime())
      .filter(time => !isNaN(time));
    if (times.length === 0) return null;
    return new Date(Math.min(...times));
  }

  // Helper: get the first rent month (1st of next month after allocation)
  function getFirstRentMonth(allocationDate: Date): { month: number; year: number } {
    let m = allocationDate.getMonth() + 1;
    let y = allocationDate.getFullYear();
    return { month: m, year: y };
  }

  // Helper: get all overdue months (as {month, year}) for a tenant (across all shops, count each month only once)
  function getTenantOverdueMonths(tenant: Tenant): { month: number; year: number }[] {
    const allocatedShops = shops.filter(
      shop => shop.tenantId === tenant.id && shop.allocated_at && new Date(shop.allocated_at) <= new Date()
    );
    if (allocatedShops.length === 0) return [];

    const allocationDate = getTenantAllocationDate(tenant.id);
    if (!allocationDate) return [];

    const { month: firstRentMonth, year: firstRentYear } = getFirstRentMonth(allocationDate);

    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();

    const overdueMonths: { month: number; year: number }[] = [];
    let y = firstRentYear;
    let m = firstRentMonth;
    while (y < currentYear || (y === currentYear && m < currentMonth)) {
      let anyShopPending = false;
      for (const shop of allocatedShops) {
        // Find all payments for this shop/month/year
        const payments = rentPayments.filter(
          p => p.tenantId === tenant.id && p.shopId === shop.id && p.month === m && p.year === y
        );
        // If there is a payment with status 'paid' OR pendingAmount === 0, this month is NOT overdue for this shop
        const isPaid = payments.some(
          p => (p.status && p.status.toLowerCase() === 'paid') || Number(p.pendingAmount ?? 0) === 0
        );
        if (!isPaid) {
          anyShopPending = true;
          break;
        }
      }
      if (anyShopPending) {
        overdueMonths.push({ month: m, year: y });
      }
      m++;
      if (m > 12) {
        m = 1;
        y++;
      }
    }
    return overdueMonths;
  }

  // Helper: check if a tenant is overdue (has any overdue month)
  function isTenantOverdue(tenant: Tenant): boolean {
    return getTenantOverdueMonths(tenant).length > 0;
  }

  // --- Only count tenants as overdue if they are allocated to at least one shop and have not paid rent for previous months (not current month) ---
  const overdueTenants = tenants.filter(isTenantOverdue).length;

  // Optionally, if you want to show total overdue months (across all tenants, but unique per tenant per month):
  // const totalOverdueMonths = tenants.reduce((acc, t) => acc + getTenantOverdueMonths(t).length, 0);

  // --- Paid tenants for current month (unchanged logic) ---
  const tenantHasAllocatedShop = (tenantId: number) =>
    shops.some(shop => shop.tenantId === tenantId);

  const currentMonthPaid = tenants.filter(tenant => {
    if (!tenantHasAllocatedShop(tenant.id)) return false;
    const payment = getLatestPayment(tenant.id, currentMonth, currentYear);
    return payment && payment.status === 'paid' && Number(payment.pendingAmount) === 0;
  }).length;

  // --- Render tenants in original order ---
  const orderedTenants = originalOrderRef.current.length
    ? originalOrderRef.current
        .map(id => tenants.find(t => t.id === id))
        .filter(Boolean) as Tenant[]
    : tenants;

  // --- Filter tenants by search ---
  const filteredTenants = orderedTenants.filter(t => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      t.name?.toLowerCase().includes(q) ||
      t.phone?.toLowerCase().includes(q) ||
      t.email?.toLowerCase().includes(q) ||
      t.aadhaarNumber?.toLowerCase().includes(q)
    );
  });

  // --- Sort/Filter tenants by sortType ---
  let sortedAndFilteredTenants = filteredTenants;
  if (sortType === "rent") {
    // Show tenants with any pending rent (previous months only, exclude current month)
    sortedAndFilteredTenants = filteredTenants.filter(tenant => {
      // 1. Get all shops allocated to this tenant
      const tenantShops = shops.filter(shop => shop.tenantId === tenant.id);
      // 2. For each shop, check if any previous month (not current) has pending rent
      for (const shop of tenantShops) {
        // Get all payments for this shop/tenant
        const payments = rentPayments.filter(
          p => p.tenantId === tenant.id && p.shopId === shop.id
        );
        // Group by year/month
        const paidMap = new Map<string, { paid: number, amount: number }>();
        payments.forEach(p => {
          const key = `${p.year}-${p.month}`;
          const prev = paidMap.get(key) ?? { paid: 0, amount: Number(p.amount ?? shop.monthlyRent) };
          paidMap.set(key, {
            paid: prev.paid + Number(p.paidAmount ?? 0),
            amount: Number(p.amount ?? shop.monthlyRent)
          });
        });
        // Check previous months only (exclude current month)
        const now = new Date();
        const currentMonth = now.getMonth() + 1;
        const currentYear = now.getFullYear();
        // For each payment period, if it's before current month/year and paid < amount, return true
        for (const [key, { paid, amount }] of Array.from(paidMap.entries())) {
          const [year, month] = key.split('-').map(Number);
          if (
            (year < currentYear || (year === currentYear && month < currentMonth)) &&
            paid < amount
          ) {
            return true;
          }
        }
        // Also, check for missing payments for previous months (no payment at all)
        // Find allocation date
        const allocDateStr = shop.allocated_at ?? shop.allocated_at;
        if (allocDateStr) {
          let y = new Date(allocDateStr).getFullYear();
          let m = new Date(allocDateStr).getMonth() + 1;
          while (y < currentYear || (y === currentYear && m < currentMonth)) {
            const key = `${y}-${m}`;
            const entry = paidMap.get(key);
            const amount = entry ? entry.amount : Number(shop.monthlyRent);
            const paid = entry ? entry.paid : 0;
            if (paid < amount) return true;
            m++;
            if (m > 12) {
              m = 1;
              y++;
            }
          }
        }
      }
      return false;
    });
  } else if (sortType === "advance") {
    // Show tenants who have at least one allocated shop with advance not paid
    sortedAndFilteredTenants = filteredTenants.filter(tenant => {
      return shops.some(shop => shop.tenantId === tenant.id && !shop.isAdvancePaid);
    });
  } else if (sortType === "allocated") {
    // Show tenants allocated to at least one shop (with allocation date in the past or today)
    sortedAndFilteredTenants = filteredTenants.filter(tenant =>
      shops.some(shop =>
        shop.tenantId === tenant.id &&
        (shop.allocated_at ?? shop.allocated_at) &&
        new Date(shop.allocated_at ?? shop.allocated_at) <= new Date()
      )
    );
  } else if (sortType === "not_allocated") {
    // Show tenants not allocated to any shop (with allocation date in the past or today)
    sortedAndFilteredTenants = filteredTenants.filter(tenant =>
      !shops.some(shop =>
        shop.tenantId === tenant.id &&
        (shop.allocated_at ?? shop.allocated_at) &&
        new Date(shop.allocated_at ?? shop.allocated_at) <= new Date()
      )
    );
  }

  // --- Add Tenant Mutation with Optimistic Update (for ADD only) ---
  const addTenantMutation = useMutation({
    mutationFn: async (tenantData: any) => {
      return await apiRequest("POST", "/api/tenants", tenantData).then(res => res.json());
    },
    onMutate: async (newTenant) => {
      await queryClient.cancelQueries({ queryKey: ["/api/tenants"] });
      const previousTenants = queryClient.getQueryData<Tenant[]>(["/api/tenants"]);
      // Assign a unique temporary id (negative timestamp)
      const tempId = -Date.now();
      if (previousTenants) {
        queryClient.setQueryData(["/api/tenants"], [
          ...previousTenants,
          { ...newTenant, id: tempId, __isTemp: true },
        ]);
      }
      return { previousTenants, tempId };
    },
    onSuccess: (createdTenant, _newTenant, context) => {
      // Remove the temp tenant by tempId, add the real one
      const previousTenants = queryClient.getQueryData<Tenant[]>(["/api/tenants"]);
      if (previousTenants && context?.tempId) {
        const filtered = previousTenants.filter(t => t.id !== context.tempId);
        queryClient.setQueryData(["/api/tenants"], [...filtered, createdTenant]);
      }
      toast({
        title: "Success",
        description: "Tenant added successfully!",
      });
    },
    onError: (_err, _newTenant, context) => {
      if (context?.previousTenants) {
        queryClient.setQueryData(["/api/tenants"], context.previousTenants);
      }
    },
  });

  // --- Edit Tenant Mutation (PUT, no optimistic update) ---
  const editTenantMutation = useMutation({
    mutationFn: async (tenantData: AddTenantModalSaveData) => {
      if (!tenantData.id) throw new Error("Missing tenant id");
      // Change PATCH to PUT
      return await apiRequest("PUT", `/api/tenants/${tenantData.id}`, tenantData).then(res => res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tenants'] });
      toast({
        title: "Success",
        description: "Tenant updated successfully!",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update tenant",
        variant: "destructive",
      });
    },
  });

  // --- Handlers ---
  const handleAddTenant = (data: AddTenantModalSaveData) => {
    addTenantMutation.mutate(data);
    setShowAddModal(false);
  };

  const handleEditTenant = async (data: AddTenantModalSaveData) => {
    // Ensure id is present
    if (!editTenant?.id) return;
    await editTenantMutation.mutateAsync({ ...data, id: editTenant.id });
    setShowAddModal(false);
    setEditTenant(null);
  };

  return (
    <>
      <TopBar title="Tenant Management" user={user} />
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Tenant Management</h2>
            <p className="text-gray-600">
              {tenants.length} total tenants • {currentMonthPaid} paid this month • {overdueTenants} overdue
            </p>
          </div>
          <div className="flex space-x-2">
            <Button variant="outline" onClick={() => setShowRentModal(true)}>
              Rent
            </Button>
            <Button onClick={() => setShowAddModal(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Tenant
            </Button>
          </div>
        </div>
        {/* Search bar and Sort button */}
        <div className="mb-4 flex items-center justify-between">
          <Input
            placeholder="Search tenants by name, phone, email, or Aadhaar..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="max-w-xs"
          />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="ml-2">
                Sort
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => setSortType("rent")}
                className={sortType === "rent" ? "font-bold bg-accent" : ""}
              >
                Rent Not Paid
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setSortType("advance")}
                className={sortType === "advance" ? "font-bold bg-accent" : ""}
              >
                Advance Not Paid
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setSortType("allocated")}
                className={sortType === "allocated" ? "font-bold bg-accent" : ""}
              >
                Allocated to Shop
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setSortType("not_allocated")}
                className={sortType === "not_allocated" ? "font-bold bg-accent" : ""}
              >
                Not Allocated to Any Shop
              </DropdownMenuItem>
              {(sortType === "rent" || sortType === "advance" || sortType === "allocated" || sortType === "not_allocated") && (
                <DropdownMenuItem
                  onClick={() => setSortType("")}
                  className="text-muted-foreground"
                >
                  Clear Sort
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        {isLoading ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {[...Array(4)].map((_, i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-6">
                  <div className="h-48 bg-gray-200 rounded"></div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : tenants.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No tenants found</h3>
              <p className="text-gray-600 mb-4">Add your first tenant to start managing rentals</p>
              <Button onClick={() => setShowAddModal(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Add Your First Tenant
              </Button>
            </CardContent>
          </Card>
        ) : sortedAndFilteredTenants.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No tenants found</h3>
              <p className="text-gray-600 mb-4">
                {search || sortType
                  ? "No tenants match your search or sort."
                  : "Add your first tenant to start managing rentals"}
              </p>
              {!search && !sortType && (
                <Button onClick={() => setShowAddModal(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Your First Tenant
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {sortedAndFilteredTenants.map((tenant) => {
              const overdueMonths = getTenantOverdueMonths(tenant);
              return (
                <TenantCard
                  key={tenant.id}
                  tenant={tenant}
                  rentPayments={rentPayments.filter(p => p.tenantId === tenant.id)}
                  onDelete={handleDelete}
                  onEdit={handleEdit}
                  shops={shops.map(shop => ({
                    ...shop,
                    name: shop.name ?? "",
                    monthlyRent: Number(shop.monthlyRent),
                    tenantId: shop.tenantId === null ? undefined : shop.tenantId,
                    isAdvancePaid: !!shop.isAdvancePaid,
                    allocatedAt: shop.allocated_at
                      ? new Date(shop.allocated_at).toISOString()
                      : undefined,
                    allocated_at: shop.allocated_at
                      ? new Date(shop.allocated_at).toISOString()
                      : undefined
                  }))}
                  overdueMonths={overdueMonths}
                />
              );
            })}
          </div>
        )}
      </div>
      <AddTenantModal
        isOpen={showAddModal}
        onClose={() => {
          setShowAddModal(false);
          setEditTenant(null);
        }}
        initialData={
          editTenant
            ? {
                id: editTenant.id,
                name: editTenant.name,
                phone: editTenant.phone ?? undefined,
                email: editTenant.email ?? undefined,
                address: editTenant.address ?? undefined,
                aadhaarNumber: editTenant.aadhaarNumber ?? undefined,
              }
            : undefined
        }
        onSave={editTenant ? handleEditTenant : handleAddTenant}
      />
      <AddRentPaymentModal
        isOpen={showRentModal}
        onClose={() => setShowRentModal(false)}
        tenants={tenants}
        rentPayments={rentPayments}
        onSubmitTransform={(data: RentPaymentModalSubmitData) => {
          // Remove paymentDate so DB default is used
          const { paymentDate, ...rest } = data;
          const transformed: any = {
            ...rest,
            amount: data.amount?.toString?.() ?? "",
            paidAmount: data.paidAmount?.toString?.() ?? "",
            pendingAmount: data.pendingAmount?.toString?.() ?? "",
          };
          // Only include paymentDate if it's a valid date
          if (paymentDate && !isNaN(new Date(paymentDate).getTime())) {
            transformed.paymentDate = paymentDate;
          }
          return transformed;
        }}
        onSuccess={() => {
          // Invalidate rent-payments and tenants to refresh UI
          queryClient.invalidateQueries({ queryKey: ['/api/rent-payments'] });
          queryClient.invalidateQueries({ queryKey: ['/api/tenants'] });
        }}
      />
    </>
  );
}