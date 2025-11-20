import { useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/useAuth";
import { User } from "lucide-react";

interface TopBarProps {
  user: ReturnType<typeof useAuth>;
  title?: React.ReactNode;
  onModeChange?: (mode: string) => void;
  currentMode?: string;
  showModeSelector?: boolean;
  rightContent?: React.ReactNode;
}

export default function TopBar({
  user = useAuth(),
  title = `Welcome ${user.user?.username || 'User'}`,
  onModeChange,
  currentMode = "personal",
  showModeSelector = false,
  rightContent
}: TopBarProps) {
  
  const currentDate = new Date().toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });

  return (
    <header className="bg-white shadow-sm border-b border-gray-200 px-6 py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <h1 className="text-xl font-bold text-gray-900">{title}</h1>
          {showModeSelector && onModeChange && (
            <Select value={currentMode} onValueChange={onModeChange}>
              <SelectTrigger className="w-64">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="personal">Personal Expense Tracker</SelectItem>
                <SelectItem value="property">Property Management</SelectItem>
              </SelectContent>
            </Select>
          )}
          {rightContent && (
            <div className="ml-2">{rightContent}</div>
          )}
        </div>
        <div className="flex items-center space-x-3">
          <span className="text-sm text-gray-600">{currentDate}</span>
          <Avatar className="h-8 w-8">
            <AvatarFallback className="bg-primary text-primary-foreground">
              <User className="h-4 w-4" />
            </AvatarFallback>
          </Avatar>
        </div>
      </div>
    </header>
  );
}
