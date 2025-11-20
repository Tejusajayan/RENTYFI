import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface AddCategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  category?: any; // NEW: category to edit, if any
}

export default function AddCategoryModal({ isOpen, onClose, category }: AddCategoryModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    type: '',
    context: '',
    color: '#3B82F6'
  });

  // Populate form when editing
  useEffect(() => {
    if (category) {
      setFormData({
        name: category.name || '',
        type: category.type || '',
        context: category.context || '',
        color: category.color || '#3B82F6'
      });
    } else {
      setFormData({
        name: '',
        type: '',
        context: '',
        color: '#3B82F6'
      });
    }
  }, [category, isOpen]);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const createCategoryMutation = useMutation({
    mutationFn: async (data: any) => {
      if (category && category.id) {
        // Edit mode
        const res = await apiRequest('PUT', `/api/categories/${category.id}`, data);
        return res.json();
      } else {
        // Add mode
        const res = await apiRequest('POST', '/api/categories', data);
        return res.json();
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/categories'] });
      toast({
        title: "Success",
        description: category ? "Category updated successfully!" : "Category added successfully!",
      });
      handleClose();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || (category ? "Failed to update category" : "Failed to create category"),
        variant: "destructive",
      });
    }
  });

  const handleClose = () => {
    setFormData({
      name: '',
      type: '',
      context: '',
      color: '#3B82F6'
    });
    onClose();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.type || !formData.context) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }
    createCategoryMutation.mutate(formData);
  };

  const colorOptions = [
    { value: '#3B82F6', label: 'Blue' },
    { value: '#10B981', label: 'Green' },
    { value: '#F59E0B', label: 'Yellow' },
    { value: '#EF4444', label: 'Red' },
    { value: '#8B5CF6', label: 'Purple' },
    { value: '#EC4899', label: 'Pink' },
    { value: '#14B8A6', label: 'Teal' },
    { value: '#F97316', label: 'Orange' },
    { value: '#6366F1', label: 'Indigo' },
    { value: '#A21CAF', label: 'Violet' },
    { value: '#F43F5E', label: 'Rose' },
    { value: '#22D3EE', label: 'Cyan' },
    { value: '#EAB308', label: 'Amber' },
    { value: '#84CC16', label: 'Lime' },
    { value: '#D97706', label: 'Gold' },
    { value: '#0EA5E9', label: 'Sky Blue' },
    { value: '#F87171', label: 'Light Red' },
    { value: '#A3E635', label: 'Light Green' },
    { value: '#FACC15', label: 'Light Yellow' },
    { value: '#FBBF24', label: 'Light Orange' },
    { value: '#6EE7B7', label: 'Mint' },
    { value: '#FDE68A', label: 'Light Amber' },
    { value: '#C026D3', label: 'Fuchsia' },
    { value: '#F472B6', label: 'Light Pink' },
    { value: '#FCD34D', label: 'Light Gold' },
    { value: '#64748B', label: 'Slate' },
    { value: '#94A3B8', label: 'Light Slate' },
    { value: '#D1D5DB', label: 'Gray' },
    { value: '#E5E7EB', label: 'Light Gray' },
    { value: '#000000', label: 'Black' },
    { value: '#FFFFFF', label: 'White' },
    // Additional distinct colors
    { value: '#FFB300', label: 'Vivid Yellow' },
    { value: '#803E75', label: 'Strong Purple' },
    { value: '#FF6800', label: 'Vivid Orange' },
    { value: '#A6BDD7', label: 'Very Light Blue' },
    { value: '#C10020', label: 'Vivid Red' },
    { value: '#CEA262', label: 'Grayish Yellow' },
    { value: '#817066', label: 'Medium Gray' },
    { value: '#007D34', label: 'Vivid Green' },
    { value: '#F6768E', label: 'Strong Purplish Pink' },
    { value: '#00538A', label: 'Strong Blue' },
    { value: '#FF7A5C', label: 'Strong Salmon' },
    { value: '#53377A', label: 'Deep Purple' },
    { value: '#FF8E00', label: 'Bright Orange' },
    { value: '#B32851', label: 'Strong Purplish Red' },
    { value: '#F4C800', label: 'Bright Yellow' },
    { value: '#7F180D', label: 'Strong Red Brown' },
    { value: '#93AA00', label: 'Vivid Yellow Green' },
    { value: '#593315', label: 'Deep Yellow Brown' },
    { value: '#F13A13', label: 'Vivid Reddish Orange' },
    { value: '#232C16', label: 'Dark Olive Green' },
  ];

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {category ? "Edit Category" : "Add Category"}
          </DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="name">Category Name *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="Enter category name"
              required
            />
          </div>

          <div>
            <Label htmlFor="type">Type *</Label>
            <Select 
              value={formData.type} 
              onValueChange={(value) => setFormData(prev => ({ ...prev, type: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="income">Income</SelectItem>
                <SelectItem value="expense">Expense</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="context">Context *</Label>
            <Select 
              value={formData.context} 
              onValueChange={(value) => setFormData(prev => ({ ...prev, context: value }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select context" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="personal">Personal Finance</SelectItem>
                <SelectItem value="property">Property Management</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="color">Color</Label>
            <Select 
              value={formData.color} 
              onValueChange={(value) => setFormData(prev => ({ ...prev, color: value }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {colorOptions.map(color => (
                  <SelectItem key={color.value} value={color.value}>
                    <div className="flex items-center space-x-2">
                      <div 
                        className="h-4 w-4 rounded-full" 
                        style={{ backgroundColor: color.value }}
                      ></div>
                      <span>{color.label}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex justify-end space-x-2">
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={createCategoryMutation.isPending}>
              {createCategoryMutation.isPending
                ? (category ? "Saving..." : "Adding...")
                : (category ? "Save Changes" : "Add Category")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
