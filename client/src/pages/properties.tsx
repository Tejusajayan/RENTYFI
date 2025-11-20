import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import TopBar from "@/components/TopBar";
import { useAuth } from "@/hooks/useAuth";
import AddBuildingModal from "@/components/AddBuildingModal";
import AddShopModal from "@/components/AddShopModal";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Plus, Edit, Trash2, Building2, Store, Users, ChevronDown } from "lucide-react";
import { Building, Shop, Tenant } from "@shared/schema";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Input } from "@/components/ui/input";

export default function Properties() {
  const [showAddBuildingModal, setShowAddBuildingModal] = useState(false);
  const [showAddShopModal, setShowAddShopModal] = useState(false);

  // Add state for editing
  const [editingBuilding, setEditingBuilding] = useState<Building | null>(null);
  const [editingShop, setEditingShop] = useState<Shop | null>(null);

  const [buildingSearch, setBuildingSearch] = useState("");
  const [shopSearch, setShopSearch] = useState("");
  const [shopSort, setShopSort] = useState<string>("");

  const user = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: buildings = [], isLoading: buildingsLoading } = useQuery<Building[]>({
    queryKey: ['/api/buildings']
  });

  const { data: shops = [], isLoading: shopsLoading } = useQuery<Shop[]>({
    queryKey: ['/api/shops']
  });

  const { data: tenants = [] } = useQuery<Tenant[]>({
    queryKey: ['/api/tenants']
  });

  const deleteBuildingMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest('DELETE', `/api/buildings/${id}`);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['/api/buildings'] });
      await queryClient.invalidateQueries({ queryKey: ['/api/shops'] });
      toast({
        title: "Success",
        description: "Building deleted successfully!",
      });
    },
    onError: (error: any) => {
      // Try to parse error and show a user-friendly message
      let msg = "Failed to delete building";
      // Try to extract error message from backend
      let backendMsg = "";
      if (typeof error === "object") {
        if (error?.message && typeof error.message === "string") {
          backendMsg = error.message;
        } else if (error?.response?.data?.message) {
          backendMsg = error.response.data.message;
        }
      }
      // Try to parse JSON error if present
      if (!backendMsg && typeof error?.toString === "function") {
        try {
          const parsed = JSON.parse(error.toString());
          backendMsg = parsed.message || "";
        } catch {}
      }
      // Check for FK/constraint/transactions/rent_payments/tenant/shop keywords
      if (
        backendMsg.includes("foreign key") ||
        backendMsg.includes("constraint") ||
        backendMsg.includes("referenced") ||
        backendMsg.includes("transactions") ||
        backendMsg.includes("rent_payments") ||
        backendMsg.includes("shop") ||
        backendMsg.includes("tenant")
      ) {
        msg =
          "Cannot delete building: Please ensure there are no shops, tenants, rent payments, or transactions linked to this building before deleting.";
      }
      toast({
        title: "Error",
        description: msg,
        variant: "destructive",
      });
    }
  });

  const deleteShopMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest('DELETE', `/api/shops/${id}`);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['/api/shops'] });
      toast({
        title: "Success",
        description: "Shop deleted successfully!",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete shop",
        variant: "destructive",
      });
    }
  });

  const handleDeleteBuilding = (id: number) => {
    if (confirm("Are you sure you want to delete this building? All associated shops will also be deleted.")) {
      deleteBuildingMutation.mutate(id);
    }
  };

  const handleDeleteShop = (id: number) => {
    if (confirm("Are you sure you want to delete this shop?")) {
      deleteShopMutation.mutate(id);
    }
  };

  const getBuildingName = (buildingId: number) => {
    // --- Robust: Try by id, fallback by name, fallback by shop mapping ---
    const building = buildings.find(b => Number(b.id) === Number(buildingId));
    if (building?.name) return building.name;
    // Fallback: try to find a shop with this buildingId and get its building name
    const shop = shops.find(s => Number(s.buildingId) === Number(buildingId));
    if (shop) {
      const b = buildings.find(bb => Number(bb.id) === Number(shop.buildingId));
      if (b?.name) return b.name;
    }
    // Fallback: try to find by building name in shops
    const shopWithBuilding = shops.find(s => s.buildingId === buildingId && s.name);
    if (shopWithBuilding?.name) return shopWithBuilding.name;
    return `Building #${buildingId}`;
  };

  const getShopsForBuilding = (buildingId: number) => {
    return shops.filter(shop => shop.buildingId === buildingId);
  };

  const getOccupiedShopsCount = (buildingId: number) => {
    return shops.filter(shop => {
      if (shop.buildingId !== buildingId) return false;
      const allocDateStr = shop.allocated_at;
      if (shop.tenantId && allocDateStr) {
        return new Date(allocDateStr) <= new Date();
      }
      return false;
    }).length;
  };

  const totalShops = shops.length;
  const occupiedShops = shops.filter(
    shop => shop.tenantId && shop.allocated_at && new Date(shop.allocated_at) <= new Date()
  ).length;
  const totalRent = shops.reduce((sum, shop) => sum + Number(shop.monthlyRent), 0);

  // Add handlers for edit
  const handleEditBuilding = (building: Building) => {
    setEditingBuilding(building);
    setShowAddBuildingModal(true);
  };

  const handleEditShop = (shop: Shop) => {
    setEditingShop(shop);
    setShowAddShopModal(true);
  };

  const getTenantName = (tenantId: number | null | undefined) => {
    if (!tenantId) return null;
    const tenant = tenants.find(t => t.id === tenantId);
    return tenant ? tenant.name : null;
  };

  // Always ensure isAdvancePaid is boolean for all shops
  const normalizedShops = shops.map(shop => ({
    ...shop,
    isAdvancePaid: !!shop.isAdvancePaid,
    isOccupied: shop.tenantId && shop.allocated_at && new Date(shop.allocated_at) <= new Date() ? true : false,
  }));

  // Helper: Check if a building has reached its shop limit
  const isBuildingAtShopLimit = (building: Building) => {
    if (typeof building.totalShops !== "number" || building.totalShops <= 0) return false;
    return getShopsForBuilding(building.id).length >= building.totalShops;
  };

  // --- Filtered buildings by search ---
  const filteredBuildings = buildings.filter(b =>
    b.name?.toLowerCase().includes(buildingSearch.trim().toLowerCase())
  );

  // --- Filtered shops by search (shop number, shop name, or building name) ---
  let filteredShops = normalizedShops.filter(shop => {
    const shopNumber = shop.shopNumber?.toLowerCase() ?? "";
    const shopName = shop.name?.toLowerCase() ?? "";
    const buildingName = getBuildingName(shop.buildingId).toLowerCase();
    const search = shopSearch.trim().toLowerCase();
    return (
      shopNumber.includes(search) ||
      shopName.includes(search) ||
      buildingName.includes(search)
    );
  });

  // Sort shops based on allocation status
  if (shopSort === "not-allocated") {
    filteredShops = filteredShops.filter(shop => !shop.tenantId);
  } else if (shopSort === "allocated") {
    filteredShops = filteredShops.filter(shop => !!shop.tenantId);
  }

  return (
    <>
      <TopBar title="Properties & Buildings" user={user} />
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Properties & Buildings</h2>
            <p className="text-gray-600">
              {buildings.length} buildings • {totalShops} shops • {occupiedShops} occupied
            </p>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Buildings</p>
                  <p className="text-2xl font-bold text-emerald-600">{buildings.length}</p>
                </div>
                <Building2 className="h-8 w-8 text-emerald-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Shops</p>
                  <p className="text-2xl font-bold text-amber-600">{totalShops}</p>
                </div>
                <Store className="h-8 w-8 text-amber-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Occupied Shops</p>
                  <p className="text-2xl font-bold text-violet-600">{occupiedShops}</p>
                </div>
                <Users className="h-8 w-8 text-violet-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Rent</p>
                  <p className="text-2xl font-bold text-cyan-600">₹{totalRent.toLocaleString()}</p>
                </div>
                <span className="text-2xl">💰</span>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="buildings" className="space-y-6">
          <TabsList>
            <TabsTrigger value="buildings">Buildings</TabsTrigger>
            <TabsTrigger value="shops">Shops</TabsTrigger>
          </TabsList>

          <TabsContent value="buildings" className="space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold">Buildings</h3>
              <Button onClick={() => { setEditingBuilding(null); setShowAddBuildingModal(true); }}>
                <Plus className="mr-2 h-4 w-4" />
                Add Building
              </Button>
            </div>

            {/* Search bar for buildings */}
            <div className="mb-4">
              <Input
                placeholder="Search buildings by name..."
                value={buildingSearch}
                onChange={e => setBuildingSearch(e.target.value)}
                className="max-w-xs"
              />
            </div>

            {buildingsLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[...Array(3)].map((_, i) => (
                  <Card key={i} className="animate-pulse">
                    <CardContent className="p-6">
                      <div className="h-32 bg-gray-200 rounded"></div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : filteredBuildings.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <Building2 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No buildings found</h3>
                  <p className="text-gray-600 mb-4">
                    {buildingSearch
                      ? "No buildings match your search."
                      : "Add your first building to start managing properties"}
                  </p>
                  {!buildingSearch && (
                    <Button onClick={() => setShowAddBuildingModal(true)}>
                      <Plus className="mr-2 h-4 w-4" />
                      Add Your First Building
                    </Button>
                  )}
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredBuildings.map((building) => {
                  const buildingShops = getShopsForBuilding(building.id);
                  const occupiedCount = getOccupiedShopsCount(building.id);
                  const occupancyRate = buildingShops.length > 0 ? (occupiedCount / buildingShops.length) * 100 : 0;

                  return (
                    <Card key={building.id} className="shadow-sm hover:shadow-md transition-shadow">
                      <CardContent className="p-6">
                        {/* Move edit/delete buttons to top center and reduce top margin */}
                        <div className="flex justify-center mb-2" style={{ marginTop: '-16px' }}>
                          <div className="flex space-x-1">
                            <Button variant="ghost" size="sm" onClick={() => handleEditBuilding(building)}>
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => handleDeleteBuilding(building.id)}
                              disabled={deleteBuildingMutation.isPending}
                            >
                              <Trash2 className="h-4 w-4 text-red-600" />
                            </Button>
                          </div>
                        </div>
                        <div className="flex items-center space-x-3 mb-4">
                          <div className="h-12 w-12 bg-blue-100 rounded-lg flex items-center justify-center">
                            <Building2 className="h-6 w-6 text-blue-600" />
                          </div>
                          <div>
                            <h3 className="text-lg font-semibold text-gray-900">{building.name}</h3>
                            <Badge variant="outline">{buildingShops.length} shops</Badge>
                          </div>
                        </div>
                        <div className="space-y-3">
                          <div>
                            <p className="text-sm text-gray-600">Address</p>
                            <p className="text-sm font-medium text-gray-900">
                              {building.address || 'No address provided'}
                            </p>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <p className="text-sm text-gray-600">Occupancy</p>
                              <p className="text-sm font-medium text-gray-900">
                                {occupiedCount}/{buildingShops.length} ({occupancyRate.toFixed(0)}%)
                              </p>
                            </div>
                            <div>
                              <p className="text-sm text-gray-600">Monthly Rent</p>
                              <p className="text-sm font-medium text-green-600">
                                ₹{buildingShops.reduce((sum, shop) => sum + Number(shop.monthlyRent), 0).toLocaleString()}
                              </p>
                            </div>
                          </div>
                        </div>
                        
                        <div className="mt-4 pt-4 border-t border-gray-200">
                          <p className="text-xs text-gray-500">
                            Added {building.createdAt ? new Date(building.createdAt).toLocaleDateString() : 'Unknown date'}
                          </p>
                        </div>

                        <div className="flex justify-end mt-4">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span>
                                  <Button
                                    size="sm"
                                    onClick={() => {
                                      setEditingShop(null);
                                      setShowAddShopModal(true);
                                      // Optionally, pre-select this building in AddShopModal
                                    }}
                                    disabled={isBuildingAtShopLimit(building)}
                                  >
                                    <Plus className="mr-2 h-4 w-4" />
                                    Add Shop
                                  </Button>
                                </span>
                              </TooltipTrigger>
                              {isBuildingAtShopLimit(building) && (
                                <TooltipContent>
                                  Maximum number of shops created for this building
                                </TooltipContent>
                              )}
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="shops" className="space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold">Shops</h3>
              <div className="flex gap-2 items-center">
                <Button onClick={() => { setEditingShop(null); setShowAddShopModal(true); }}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Shop
                </Button>
                {/* Custom styled sort dropdown */}
                <div className="relative">
                  <Button
                    variant="outline"
                    size="default"
                    className="pr-6 min-w-[55px] text-left flex items-center justify-between h-10"
                  >
                    <span>{shopSort === '' ? 'Sort' : shopSort === 'not-allocated' ? 'Not Allocated' : 'Allocated'}</span>
                    <ChevronDown className="ml-1 w-3 h-3 text-gray-500" />
                  </Button>
                  <select
                    className="absolute left-0 top-0 w-full h-full opacity-0 cursor-pointer"
                    value={shopSort}
                    onChange={e => setShopSort(e.target.value)}
                  >
                    <option value="">Sort By</option>
                    <option value="not-allocated">Not Allocated</option>
                    <option value="allocated">Allocated</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Search bar for shops */}
            <div className="mb-4">
              <Input
                placeholder="Search shops by number, name, or building..."
                value={shopSearch}
                onChange={e => setShopSearch(e.target.value)}
                className="max-w-xs"
              />
            </div>

            {shopsLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[...Array(6)].map((_, i) => (
                  <Card key={i} className="animate-pulse">
                    <CardContent className="p-6">
                      <div className="h-24 bg-gray-200 rounded"></div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : filteredShops.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <Store className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No shops found</h3>
                  <p className="text-gray-600 mb-4">
                    {shopSearch
                      ? "No shops match your search."
                      : "Add shops to your buildings to start renting"}
                  </p>
                  {!shopSearch && (
                    <Button onClick={() => setShowAddShopModal(true)}>
                      <Plus className="mr-2 h-4 w-4" />
                      Add Your First Shop
                    </Button>
                  )}
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredShops.map((shop) => (
                  <Card key={shop.id} className="shadow-sm hover:shadow-md transition-shadow">
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center space-x-3">
                          <div className={`h-12 w-12 rounded-lg flex items-center justify-center ${
                            shop.isOccupied ? 'bg-green-100' : 'bg-gray-100'
                          }`}>
                            <Store className={`h-6 w-6 ${
                              shop.isOccupied ? 'text-green-600' : 'text-gray-600'
                            }`} />
                          </div>
                          <div>
                            <h3 className="text-lg font-semibold text-gray-900">
                              {/* --- Fix: fallback to shopNumber if name is missing --- */}
                              {shop.name || (shop.shopNumber ? `Shop ${shop.shopNumber}` : "Unknown Shop")}
                            </h3>
                            <p className="text-sm text-gray-600">{getBuildingName(shop.buildingId)}</p>
                            {/* Show tenant if allocated */}
                            {shop.tenantId && (
                              <p  className="text-md font-semibold text-gray-900">
                               <i className="text-sm font-semibold text-green-900">Allocated to</i>  {getTenantName(shop.tenantId)}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex space-x-1">
                          <Button variant="ghost" size="sm" onClick={() => handleEditShop(shop)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => handleDeleteShop(shop.id)}
                            disabled={deleteShopMutation.isPending}
                          >
                            <Trash2 className="h-4 w-4 text-red-600" />
                          </Button>
                        </div>
                      </div>
                      
                      <div className="space-y-3">
                        {shop.name && (
                          <div>
                            <p className="text-sm text-gray-600">Shop Number</p>
                            <p className="text-sm font-medium text-gray-900">{shop.shopNumber}</p>
                          </div>
                        )}
                        
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-sm text-gray-600">Monthly Rent</p>
                            <p className="text-sm font-medium text-green-600">
                              ₹{Number(shop.monthlyRent).toLocaleString()}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-600">Advance</p>
                            <p className="text-sm font-medium text-blue-600">
                              ₹{Number(shop.advance).toLocaleString()}
                            </p>
                          </div>
                        </div>
                        
                        <div className="flex items-center justify-between">
                          <Badge variant={shop.isOccupied ? "default" : "secondary"}>
                            {shop.isOccupied ? "Occupied" : "Available"}
                          </Badge>
                          <p className="text-xs text-gray-500">
                            Added {shop.createdAt ? new Date(shop.createdAt).toLocaleDateString() : 'Unknown date'}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Pass editingBuilding and editingShop to modals */}
      <AddBuildingModal
        isOpen={showAddBuildingModal}
        onClose={() => { setShowAddBuildingModal(false); setEditingBuilding(null); }}
        building={
          editingBuilding
            ? {
                id: editingBuilding.id,
                name: editingBuilding.name,
                address: editingBuilding.address ?? undefined,
                totalShops: editingBuilding.totalShops ?? undefined,
              }
            : null
        }
      />

      <AddShopModal
        isOpen={showAddShopModal}
        onClose={() => { setShowAddShopModal(false); setEditingShop(null); }}
        shop={
          editingShop
            ? {
                ...editingShop,
                // Ensure tenantId is null if null, undefined, or empty string
                tenantId:
                  editingShop.tenantId === null ||
                  editingShop.tenantId === undefined
                    ? null
                    : editingShop.tenantId,
                // Pass allocated_at as Date | null, not string
                allocated_at: editingShop.allocated_at ?? null,
              }
            : null
        }
      />
    </>
  );
}
