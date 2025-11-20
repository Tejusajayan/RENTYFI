import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import TopBar from "@/components/TopBar";
import AddCategoryModal from "@/components/AddCategoryModal";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Plus, Edit, Trash2, Tags } from "lucide-react";
import { Category } from "@shared/schema";
export default function Categories() {
  const [showAddModal, setShowAddModal] = useState(false);
  const [editCategory, setEditCategory] = useState<Category | null>(null);
  const user = useAuth();

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: categories = [], isLoading } = useQuery<Category[]>({
    queryKey: ['/api/categories']
  });

  const deleteCategoryMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest('DELETE', `/api/categories/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/categories'] });
      toast({
        title: "Success",
        description: "Category deleted successfully!",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete category",
        variant: "destructive",
      });
    }
  });

  const handleDelete = (id: number) => {
    if (confirm("Are you sure you want to delete this category?")) {
      deleteCategoryMutation.mutate(id);
    }
  };

  const handleEdit = (category: Category) => {
    setEditCategory(category);
    setShowAddModal(true);
  };

  const personalCategories = categories.filter(cat => cat.context === 'personal');
  const propertyCategories = categories.filter(cat => cat.context === 'property');

  const CategoryGrid = ({ categories: categoryList }: { categories: Category[] }) => {
    if (categoryList.length === 0) {
      return (
        <Card>
          <CardContent className="p-8 text-center">
            <Tags className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No categories found</h3>
            <p className="text-gray-600 mb-4">Add categories to organize your transactions</p>
            <Button onClick={() => setShowAddModal(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Category
            </Button>
          </CardContent>
        </Card>
      );
    }

    const incomeCategories = categoryList.filter(cat => cat.type === 'income');
    const expenseCategories = categoryList.filter(cat => cat.type === 'expense');

    return (
      <div className="space-y-6">
        {/* Income Categories */}
        {incomeCategories.length > 0 && (
          <div>
            <h4 className="text-lg font-semibold text-gray-900 mb-4">Income Categories</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {incomeCategories.map((category) => (
                <Card key={category.id} className="shadow-sm hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div 
                          className="h-4 w-4 rounded-full" 
                          style={{ backgroundColor: category.color ?? undefined }}
                        ></div>
                        <div>
                          <h3 className="font-medium text-gray-900">{category.name}</h3>
                          <Badge variant="outline" className="text-xs text-green-600">
                            Income
                          </Badge>
                        </div>
                      </div>
                      <div className="flex space-x-1">
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => handleEdit(category)}
                        >
                          <Edit className="h-3 w-3" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => handleDelete(category.id)}
                          disabled={deleteCategoryMutation.isPending}
                        >
                          <Trash2 className="h-3 w-3 text-red-600" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Expense Categories */}
        {expenseCategories.length > 0 && (
          <div>
            <h4 className="text-lg font-semibold text-gray-900 mb-4">Expense Categories</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {expenseCategories.map((category) => (
                <Card key={category.id} className="shadow-sm hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div 
                          className="h-4 w-4 rounded-full" 
                          style={{ backgroundColor: category.color ?? undefined }}
                        ></div>
                        <div>
                          <h3 className="font-medium text-gray-900">{category.name}</h3>
                          <Badge variant="outline" className="text-xs text-red-600">
                            Expense
                          </Badge>
                        </div>
                      </div>
                      <div className="flex space-x-1">
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => handleEdit(category)}
                        >
                          <Edit className="h-3 w-3" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => handleDelete(category.id)}
                          disabled={deleteCategoryMutation.isPending}
                        >
                          <Trash2 className="h-3 w-3 text-red-600" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      <TopBar title="Categories" user={user} />
      
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Categories</h2>
            <p className="text-gray-600">
              Manage income and expense categories for personal and property finances
            </p>
          </div>
          <Button onClick={() => setShowAddModal(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Category
          </Button>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            <div className="h-8 bg-gray-200 rounded w-1/4 animate-pulse"></div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[...Array(6)].map((_, i) => (
                <Card key={i} className="animate-pulse">
                  <CardContent className="p-4">
                    <div className="h-16 bg-gray-200 rounded"></div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        ) : (
          <Tabs defaultValue="personal" className="space-y-6">
            <TabsList>
              <TabsTrigger value="personal">
                Personal Finance ({personalCategories.length})
              </TabsTrigger>
              <TabsTrigger value="property">
                Property Management ({propertyCategories.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="personal">
              <CategoryGrid categories={personalCategories} />
            </TabsContent>

            <TabsContent value="property">
              <CategoryGrid categories={propertyCategories} />
            </TabsContent>
          </Tabs>
        )}
      </div>

      <AddCategoryModal
        isOpen={showAddModal}
        onClose={() => {
          setShowAddModal(false);
          setEditCategory(null);
        }}
        category={editCategory}
      />
    </>
  );
}
