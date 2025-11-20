import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

interface AddTenantModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialData?: {
    id?: number;
    name: string;
    phone?: string;
    email?: string;
    address?: string;
    aadhaarNumber?: string;
  };
  onSave?: (data: any) => Promise<void> | void;
}

export default function AddTenantModal({ isOpen, onClose, initialData, onSave }: AddTenantModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    address: '',
    aadhaarNumber: ''
  });

  // Only reset form when modal is opened for a new tenant or when initialData changes (not on every open/close)
  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setFormData({
          name: initialData.name || '',
          phone: initialData.phone || '',
          email: initialData.email || '',
          address: initialData.address || '',
          aadhaarNumber: initialData.aadhaarNumber || ''
        });
      } else {
        setFormData({
          name: '',
          phone: '',
          email: '',
          address: '',
          aadhaarNumber: ''
        });
      }
    }
    // Do not reset formData on every isOpen change, only when opening
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialData, isOpen]);

  const { toast } = useToast();

  const [isPending, setIsPending] = useState(false);

  const handleClose = () => {
    setFormData({
      name: '',
      phone: '',
      email: '',
      address: '',
      aadhaarNumber: ''
    });
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) {
      toast({
        title: "Error",
        description: "Please enter tenant name",
        variant: "destructive",
      });
      return;
    }
    setIsPending(true);
    try {
      if (onSave) {
        await onSave(formData);
        handleClose();
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error?.message || "Failed to save tenant",
        variant: "destructive",
      });
    } finally {
      setIsPending(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{initialData?.id ? "Edit Tenant" : "Add Tenant"}</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="name">Name *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="Enter tenant name"
              required
            />
          </div>

          <div>
            <Label htmlFor="phone">Phone Number</Label>
            <Input
              id="phone"
              value={formData.phone}
              onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
              placeholder="Enter phone number"
            />
          </div>

          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
              placeholder="Enter email address"
            />
          </div>

          <div>
            <Label htmlFor="aadhaarNumber">Aadhaar Number</Label>
            <Input
              id="aadhaarNumber"
              value={formData.aadhaarNumber}
              onChange={(e) => setFormData(prev => ({ ...prev, aadhaarNumber: e.target.value }))}
              placeholder="Enter Aadhaar number"
              maxLength={12}
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
            <Button type="submit" disabled={isPending}>
              {isPending
                ? (initialData?.id ? "Saving..." : "Adding...")
                : (initialData?.id ? "Save Changes" : "Add Tenant")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
