import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Building, Shop, Tenant } from "@shared/schema";
import { useAuth } from "@/hooks/useAuth";

interface AddShopModalProps {
  isOpen: boolean;
  onClose: () => void;
  shop?: Shop | null;
}

export default function AddShopModal({ isOpen, onClose, shop }: AddShopModalProps) {
  const [formData, setFormData] = useState({
    buildingId: '',
    shopNumber: '',
    name: '',
    monthlyRent: '',
    advance: '',
    tenantId: '',
    isAdvancePaid: false,
    allocated_at: '', // <-- use snake_case
    advanceAccountId: '',
  });
  const [advancePaidAccountId, setAdvancePaidAccountId] = useState<string>("");

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const user = useAuth();

  const { data: buildings = [] } = useQuery<Building[]>({
    queryKey: ['/api/buildings']
  });

  // Fetch tenants for allocation dropdown
  const { data: tenants = [] } = useQuery<Tenant[]>({
    queryKey: ['/api/tenants']
  });

  // Fetch bank accounts for advance dropdown
  const { data: accounts = [] } = useQuery<any[]>({
    queryKey: ['/api/accounts']
  });

  // Fetch all shops (for shop limit checks)
  const { data: shops = [] } = useQuery<Shop[]>({
    queryKey: ['/api/shops']
  });

  // Add this helper to get the advance account name
  function getAdvanceAccountName(accountId: string, accounts: any[]) {
    const acc = accounts.find(a => String(a.id) === accountId);
    return acc ? `${acc.name} (${acc.accountType})` : "";
  }

  // Fetch advance transaction for this shop, tenant, and account (if set)
  const selectedTenantId = formData.tenantId && formData.tenantId !== 'none' ? formData.tenantId : (shop?.tenantId ? String(shop.tenantId) : null);
  const selectedAdvanceAccountId = formData.advanceAccountId || null;
  const { data: advanceTransaction } = useQuery<any | null>({
    queryKey: shop && shop.id && selectedTenantId
      ? ['/api/transactions', 'advance', shop.id, selectedTenantId, selectedAdvanceAccountId]
      : [],
    queryFn: async () => {
      if (!shop?.id || !selectedTenantId) return null;
      // Find "Advance Amount" category id
      const categoriesRes = await apiRequest('GET', '/api/categories?context=property');
      const categories = await categoriesRes.json();
      const advanceCat = categories.find(
        (c: any) =>
          c.name?.toLowerCase() === "advance amount" &&
          c.type === "income" &&
          c.context === "property"
      );
      if (!advanceCat) return null;
      // Build query string
      let url = `/api/transactions?categoryId=${advanceCat.id}&shopId=${shop.id}&tenantId=${selectedTenantId}`;
      const res = await apiRequest('GET', url);
      const txns = await res.json();
      // Filter for accountId if selected, else use all
      let filtered = txns;
      if (selectedAdvanceAccountId) {
        filtered = txns.filter((t: any) => String(t.accountId) === String(selectedAdvanceAccountId));
      }
      // Only keep transactions for this shop, tenant, and advance category
      filtered = filtered.filter(
        (t: any) =>
          String(t.shopId) === String(shop.id) &&
          String(t.tenantId) === String(selectedTenantId) &&
          t.categoryId === advanceCat.id
      );
      // Sort by transactionDate or createdAt descending (latest first)
      filtered.sort((a: any, b: any) => {
        const dateA = new Date(a.transactionDate || a.createdAt || 0).getTime();
        const dateB = new Date(b.transactionDate || b.createdAt || 0).getTime();
        return dateB - dateA;
      });
      // Return the latest matching transaction, or null
      return filtered.length > 0 ? filtered[0] : null;
    },
    enabled: !!shop && !!shop.id && !!selectedTenantId && isOpen,
  });

  // Pre-fill form when editing or opening modal
  useEffect(() => {
    if (shop && isOpen) {
      // Always use advanceTransaction.accountId if present
      let advanceAccountId = '';
      if (advanceTransaction && advanceTransaction.accountId) {
        advanceAccountId = String(advanceTransaction.accountId);
      }
      setFormData({
        buildingId: shop.buildingId ? String(shop.buildingId) : '',
        shopNumber: shop.shopNumber || '',
        name: shop.name || '',
        monthlyRent: shop.monthlyRent ? String(shop.monthlyRent) : '',
        advance: shop.advance ? String(shop.advance) : '',
        tenantId: shop.tenantId ? String(shop.tenantId) : 'none',
        isAdvancePaid: !!shop.isAdvancePaid,
        allocated_at: shop.allocated_at
          ? (typeof shop.allocated_at === 'string'
              ? (shop.allocated_at as string).slice(0, 10)
              : new Date(shop.allocated_at as Date).toISOString().slice(0, 10))
          : '',
        advanceAccountId: advanceAccountId,
      });
      setAdvancePaidAccountId(advanceAccountId);
    } else if (isOpen) {
      setFormData({
        buildingId: '',
        shopNumber: '',
        name: '',
        monthlyRent: '',
        advance: '',
        tenantId: 'none',
        isAdvancePaid: false,
        allocated_at: '',
        advanceAccountId: '',
      });
      setAdvancePaidAccountId("");
    }
  // Only depend on shop and isOpen, NOT advanceTransaction!
  }, [shop, isOpen]);

  // When advanceTransaction changes, update advanceAccountId in formData if needed
  useEffect(() => {
    if (
      formData.isAdvancePaid &&
      advanceTransaction &&
      advanceTransaction.accountId &&
      String(formData.advanceAccountId) !== String(advanceTransaction.accountId)
    ) {
      setFormData(prev => ({
        ...prev,
        advanceAccountId: String(advanceTransaction.accountId),
      }));
    }
  // Only run when advanceTransaction or isAdvancePaid changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [advanceTransaction, formData.isAdvancePaid]);

  const createOrUpdateShopMutation = useMutation({
    mutationFn: async (data: any) => {
      // Convert allocated_at to Date if present and valid, otherwise undefined
      let allocatedDate: Date | undefined;
      if (data.tenantId && data.tenantId !== 'none') {
        if (data.allocated_at && /^\d{4}-\d{2}-\d{2}$/.test(data.allocated_at)) {
          const [year, month, day] = data.allocated_at.split('-').map(Number);
          allocatedDate = new Date(Date.UTC(year, month - 1, day));
        } else if (data.allocated_at) {
          const parsed = new Date(data.allocated_at);
          allocatedDate = !isNaN(parsed.getTime()) ? parsed : new Date();
        } else {
          allocatedDate = new Date();
        }
      } else {
        allocatedDate = undefined; // <-- use undefined, not null
      }
      const payload = {
        ...data,
        userId: user.user?.id,
        buildingId: parseInt(data.buildingId),
        monthlyRent: data.monthlyRent || '0',
        advance: data.advance || '0',
        tenantId: data.tenantId && data.tenantId !== 'none' ? parseInt(data.tenantId) : null,
        isAdvancePaid: !!data.isAdvancePaid,
        isOccupied: data.tenantId && data.tenantId !== 'none' ? true : false,
        allocated_at: allocatedDate,
      };
      delete payload.allocatedAt;
      if (shop && shop.id) {
        const res = await apiRequest('PUT', `/api/shops/${shop.id}`, payload);
        return res.json();
      } else {
        const res = await apiRequest('POST', '/api/shops', payload);
        return res.json();
      }
    },
    onSuccess: async (shopResult) => {
      // Only create a transaction if advance is paid AND advanceAccountId is present
      // Prevent duplicate advance transaction for the same shop and tenant
      const isSameTenant = shop && shop.tenantId && String(shop.tenantId) === String(formData.tenantId);
      const hasAdvanceTxn = !!advanceTransaction && advanceTransaction.tenantId && String(advanceTransaction.tenantId) === String(formData.tenantId);

      // --- NEW LOGIC: Check for existing advance transaction for this shop and tenant ---
      let shouldCreateAdvanceTxn = false;
      if (
        formData.isAdvancePaid &&
        formData.advance &&
        Number(formData.advance) > 0 &&
        formData.advanceAccountId && // Only if account is selected
        formData.tenantId &&
        formData.tenantId !== 'none'
      ) {
        // If editing, only create if:
        // - No advanceTransaction exists for this shop+tenant
        // - Or, tenant changed (i.e., new tenant assigned)
        if (!advanceTransaction) {
          shouldCreateAdvanceTxn = true;
        } else if (
          // If tenant changed, allow new advance
          shop && String(shop.tenantId) !== String(formData.tenantId)
        ) {
          shouldCreateAdvanceTxn = true;
        } else {
          // If advanceTransaction exists for this shop+tenant, do NOT create again
          shouldCreateAdvanceTxn = false;
        }
      }

      if (shouldCreateAdvanceTxn) {
        // Find "Advance Amount" category (type: income, context: property)
        const categoriesRes = await apiRequest('GET', '/api/categories?context=property');
        const categories = await categoriesRes.json();
        const advanceCat = categories.find(
          (c: any) =>
            c.name?.toLowerCase() === "advance amount" &&
            c.type === "income" &&
            c.context === "property"
        );
        const advanceCategoryId = advanceCat?.id;

        // Find tenant name
        const tenantsRes = await apiRequest('GET', '/api/tenants');
        const tenants = await tenantsRes.json();
        const tenant = tenants.find((t: any) => t.id === Number(formData.tenantId));

        // --- Get buildingId from shopResult ---
        const buildingId = shopResult.buildingId;

        // Create transaction
        await apiRequest('POST', '/api/transactions', {
          type: "income",
          context: "property",
          accountId: Number(formData.advanceAccountId),
          description: `Advance received from ${tenant?.name || "Tenant"}`,
          amount: formData.advance,
          categoryId: advanceCategoryId,
          tenantId: Number(formData.tenantId),
          shopId: shopResult.id,
          buildingId: buildingId,
          transactionDate: new Date().toISOString(),
          notes: "Auto-generated for advance payment",
        });
      }
      queryClient.invalidateQueries({ queryKey: ['/api/shops'] });
      toast({
        title: "Success",
        description: shop ? "Shop updated successfully!" : "Shop added successfully!",
      });
      handleClose();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || `Failed to ${shop ? "update" : "create"} shop`,
        variant: "destructive",
      });
    }
  });

  // Function to close modal and reset form
  const handleClose = () => {
    setFormData({
      buildingId: '',
      shopNumber: '',
      name: '',
      monthlyRent: '',
      advance: '',
      tenantId: 'none',
      isAdvancePaid: false,
      allocated_at: '',
      advanceAccountId: '',
    });
    onClose();
  };

  // Add a function to clear the form
  const handleClear = () => {
    setFormData({
      buildingId: '',
      shopNumber: '',
      name: '',
      monthlyRent: '',
      advance: '',
      tenantId: 'none',
      isAdvancePaid: false,
      allocated_at: '',
      advanceAccountId: '',
    });
  };

  // Helper: Get number of shops for a building
  const getShopsForBuilding = (buildingId: number) => {
    return shops.filter(shop => shop.buildingId === Number(buildingId));
  };

  // Helper: Get totalShops for a building
  const getBuildingTotalShops = (buildingId: string) => {
    const b = buildings.find(b => b.id === Number(buildingId));
    return b?.totalShops ?? undefined;
  };

  // Helper: Is selected building at shop limit?
  const isSelectedBuildingAtShopLimit = () => {
    if (!formData.buildingId) return false;
    const total = getBuildingTotalShops(formData.buildingId);
    if (!total || total <= 0) return false;
    return getShopsForBuilding(Number(formData.buildingId)).length >= total;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.buildingId || !formData.shopNumber) {
      return;
    }
    if (!shop && isSelectedBuildingAtShopLimit()) {
      toast({
        title: "Maximum Shops Reached",
        description: "Maximum number of shops created for this building",
        variant: "destructive",
      });
      return;
    }
    // Convert allocated_at to Date if present and valid, otherwise undefined/null
    let allocationDate: Date | undefined | null;
    if (formData.tenantId && formData.tenantId !== 'none') {
      if (formData.allocated_at && /^\d{4}-\d{2}-\d{2}$/.test(formData.allocated_at)) {
        const [year, month, day] = formData.allocated_at.split('-').map(Number);
        allocationDate = new Date(Date.UTC(year, month - 1, day));
      } else if (formData.allocated_at) {
        const parsed = new Date(formData.allocated_at);
        allocationDate = !isNaN(parsed.getTime()) ? parsed : new Date();
      } else {
        allocationDate = new Date();
      }
    } else {
      // If deallocated (None), set allocationDate to null and clear allocated_at in payload
      allocationDate = null;
    }
    const payload = {
      ...formData,
      userId: user.user?.id,
      allocated_at: (formData.tenantId && formData.tenantId !== 'none') ? allocationDate : null,
      tenantId: formData.tenantId && formData.tenantId !== 'none' ? formData.tenantId : null,
    };
    // Ensure allocated_at is null if tenantId is null/none
    if (!payload.tenantId) {
      payload.allocated_at = null;
    }
    createOrUpdateShopMutation.mutate(payload);
  };

  // --- Reset allocated_at and isAdvancePaid if selected tenant is deleted ---
  useEffect(() => {
    if (
      formData.tenantId &&
      formData.tenantId !== 'none' &&
      !tenants.some(t => String(t.id) === String(formData.tenantId))
    ) {
      setFormData(prev => ({
        ...prev,
        tenantId: 'none',
        allocated_at: '',
        isAdvancePaid: false,
        advanceAccountId: '',
      }));
    }
  }, [tenants, formData.tenantId]);

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{shop ? "Edit Shop" : "Add Shop"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="buildingId">Building *</Label>
            <Select 
              value={formData.buildingId} 
              onValueChange={(value) => setFormData(prev => ({ ...prev, buildingId: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select building" />
              </SelectTrigger>
              <SelectContent>
                {/* No SelectItem with empty value */}
                {buildings.map(building => {
                  const shopCount = shops.filter(s => s.buildingId === building.id).length;
                  const isFull = typeof building.totalShops === "number" && building.totalShops > 0 && shopCount >= building.totalShops;
                  return (
                    <SelectItem
                      key={building.id}
                      value={building.id.toString()}
                      disabled={isFull}
                    >
                      {building.name}
                      {isFull ? " (Full)" : ""}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
            {/* Show warning if selected building is full */}
            {!shop && isSelectedBuildingAtShopLimit() && (
              <div className="text-red-600 text-sm mt-1">
                Maximum number of shops created for this building
              </div>
            )}
          </div>
          <div>
            <Label htmlFor="shopNumber">Shop Number *</Label>
            <Input
              id="shopNumber"
              value={formData.shopNumber}
              onChange={(e) => setFormData(prev => ({ ...prev, shopNumber: e.target.value }))}
              placeholder="e.g., A1, B2, 101"
              required
            />
          </div>
          <div>
            <Label htmlFor="name">Shop Name</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="Enter shop name (optional)"
            />
          </div>
          <div>
            <Label htmlFor="monthlyRent">Monthly Rent</Label>
            <Input
              id="monthlyRent"
              type="number"
              step="0.01"
              value={formData.monthlyRent}
              onChange={(e) => setFormData(prev => ({ ...prev, monthlyRent: e.target.value }))}
              placeholder="Enter monthly rent"
              onWheel={e => (e.target as HTMLInputElement).blur()}
            />
          </div>
          <div>
            <Label htmlFor="advance">Advance Amount</Label>
            <Input
              id="advance"
              type="number"
              step="0.01"
              value={formData.advance}
              onChange={(e) => setFormData(prev => ({ ...prev, advance: e.target.value }))}
              placeholder="Enter advance amount"
              onWheel={e => (e.target as HTMLInputElement).blur()}
            />
          </div>
          {/* Advance Paid Checkbox */}
          <div className="flex items-center space-x-2">
            <input
              id="isAdvancePaid"
              type="checkbox"
              checked={formData.isAdvancePaid}
              onChange={e => {
                setFormData(prev => ({
                  ...prev,
                  isAdvancePaid: e.target.checked,
                  advanceAccountId: e.target.checked ? prev.advanceAccountId : '',
                }));
              }}
            />
            <Label htmlFor="isAdvancePaid">
              Advance Paid
            </Label>
          </div>
          {/* Show account dropdown if advance is paid */}
          {formData.isAdvancePaid && (
            <div>
              <Label htmlFor="advanceAccountId">
                Advance Credited To Account (optional)
                {/* If editing and there is an advance transaction, show the credited account name */}
                {advanceTransaction && advanceTransaction.accountId && (
                  <span className="ml-2 text-xs text-green-700">
                    (Already credited to: {
                      (() => {
                        const acc = accounts.find(a => String(a.id) === String(advanceTransaction.accountId));
                        return acc ? `${acc.name} (${acc.accountType})` : "Account";
                      })()
                    })
                  </span>
                )}
              </Label>
              <Select
                value={formData.advanceAccountId}
                onValueChange={value => setFormData(prev => ({ ...prev, advanceAccountId: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select account (optional)" />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map(acc => (
                    <SelectItem key={acc.id} value={acc.id.toString()}>
                      {acc.name} ({acc.accountType})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div>
            <Label htmlFor="tenantId">Allocate to Tenant</Label>
            <Select
              value={formData.tenantId || 'none'}
              onValueChange={(value) => {
                console.log("onValueChange (tenantId):", value);
                setFormData(prev => ({ ...prev, tenantId: value }));
              }}
            >
              <SelectTrigger>
                <SelectValue
                  placeholder="Select tenant (optional)"
                  // @ts-ignore
                  children={
                    formData.tenantId && formData.tenantId !== 'none'
                      ? tenants.find(t => String(t.id) === String(formData.tenantId))?.name
                      : 'None'
                  }
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">
                  None
                </SelectItem>
                {tenants.map(tenant => (
                  <SelectItem key={tenant.id} value={tenant.id.toString()}>
                    {tenant.name} {tenant.phone ? `(${tenant.phone})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {/* Allocated At Date Input */}
          <div>
            <Label htmlFor="allocated_at">Pending From</Label>
            <Input
              id="allocated_at"
              type="date"
              value={formData.allocated_at}
              onChange={e => setFormData(prev => ({ ...prev, allocated_at: e.target.value }))}
              placeholder="Select allocation date"
            />
            <div className="text-xs text-gray-500 mt-1">
              Rent calculation will start from this date.
            </div>
          </div>
          <div className="flex justify-end space-x-2">
            <Button type="button" variant="outline" onClick={handleClear}>
              Clear
            </Button>
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={createOrUpdateShopMutation.isPending}>
              {createOrUpdateShopMutation.isPending
                ? (shop ? "Saving..." : "Adding...")
                : (shop ? "Save Changes" : "Add Shop")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

