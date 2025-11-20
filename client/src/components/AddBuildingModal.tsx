import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface AddBuildingModalProps {
  isOpen: boolean;
  onClose: () => void;
  building?: {
    id: number;
    name: string;
    address?: string;
    totalShops?: number;
  } | null;
}

export default function AddBuildingModal({ isOpen, onClose, building }: AddBuildingModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    totalShops: ''
  });

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Pre-fill form when editing
  useEffect(() => {
    if (building) {
      setFormData({
        name: building.name || '',
        address: building.address || '',
        totalShops: building.totalShops !== undefined ? String(building.totalShops) : ''
      });
    } else {
      setFormData({
        name: '',
        address: '',
        totalShops: ''
      });
    }
  }, [building, isOpen]);

  const createOrUpdateBuildingMutation = useMutation({
    mutationFn: async (data: any) => {
      if (building && building.id) {
        // Edit
        const res = await apiRequest('PUT', `/api/buildings/${building.id}`, {
          ...data,
          totalShops: data.totalShops ? parseInt(data.totalShops) : 0
        });
        return res.json();
      } else {
        // Add
        const res = await apiRequest('POST', '/api/buildings', {
          ...data,
          totalShops: data.totalShops ? parseInt(data.totalShops) : 0
        });
        return res.json();
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/buildings'] });
      toast({
        title: "Success",
        description: building ? "Building updated successfully!" : "Building added successfully!",
      });
      handleClose();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || `Failed to ${building ? "update" : "create"} building`,
        variant: "destructive",
      });
    }
  });

  const handleClose = () => {
    setFormData({
      name: '',
      address: '',
      totalShops: ''
    });
    onClose();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) {
      toast({
        title: "Error",
        description: "Please enter building name",
        variant: "destructive",
      });
      return;
    }
    createOrUpdateBuildingMutation.mutate(formData);
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{building ? "Edit Building" : "Add Building"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="name">Building Name *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="Enter building name"
              required
            />
          </div>
          <div>
            <Label htmlFor="totalShops">Total Shops</Label>
            <Input
              id="totalShops"
              type="number"
              value={formData.totalShops}
              onChange={(e) => setFormData(prev => ({ ...prev, totalShops: e.target.value }))}
              placeholder="Enter number of shops"
              onWheel={e => (e.target as HTMLInputElement).blur()}
            />
          </div>
          <div>
            <Label htmlFor="address">Address</Label>
            <Textarea
              id="address"
              value={formData.address}
              onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
              placeholder="Enter full address"
              rows={3}
            />
          </div>
          <div className="flex justify-end space-x-2">
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={createOrUpdateBuildingMutation.isPending}>
              {createOrUpdateBuildingMutation.isPending
                ? (building ? "Saving..." : "Adding...")
                : (building ? "Save Changes" : "Add Building")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
