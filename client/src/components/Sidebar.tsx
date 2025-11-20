import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import {
  Building,
  ChartLine,
  ArrowLeftRight,
  University,
  BarChart3,
  Users,
  Tags,
  Download,
  LogOut,
  Receipt
} from "lucide-react";

const navigationItems = [
  { href: "/dashboard", label: "Dashboard", icon: ChartLine },
  { href: "/transactions", label: "Transactions", icon: Receipt },
  { href: "/transfers", label: "Transfers", icon: ArrowLeftRight },
  { href: "/accounts", label: "Bank Accounts", icon: University },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/properties", label: "Properties", icon: Building },
  { href: "/tenants", label: "Tenants", icon: Users },
  { href: "/categories", label: "Categories", icon: Tags },
  { href: "/backup", label: "Backup & Restore", icon: Download },
];

export default function Sidebar() {
  const [location] = useLocation();
  const { logout } = useAuth();

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  return (
    <div className="w-64 bg-white shadow-lg flex flex-col">
      <div className="flex items-center justify-center h-16 border-b border-gray-200">
        <div className="flex items-center space-x-2">
          <div className="h-8 w-8 bg-primary rounded-lg flex items-center justify-center">
            <Building className="text-primary-foreground text-sm" />
          </div>
          <span className="text-xl font-bold text-gray-900">RentyFi</span>
        </div>
      </div>
      
      <nav className="flex-1 px-4 py-6 space-y-2">
        {navigationItems.map((item) => {
          const Icon = item.icon;
          const isActive = location === item.href || (location === "/" && item.href === "/dashboard");
          
          return (
            <Link key={item.href} href={item.href}>
              <a
                className={cn(
                  "flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-gray-700 hover:bg-gray-100"
                )}
              >
                <Icon className="mr-3 h-4 w-4" />
                {item.label}
              </a>
            </Link>
          );
        })}
      </nav>
      
      <div className="px-4 py-4 border-t border-gray-200">
        <Button
          variant="ghost"
          className="w-full justify-start text-gray-700 hover:bg-gray-100"
          onClick={handleLogout}
        >
          <LogOut className="mr-3 h-4 w-4" />
          Logout
        </Button>
      </div>
    </div>
  );
}
