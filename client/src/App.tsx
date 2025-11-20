import { Switch, Route, Redirect, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import LoginPage from "@/pages/login";
import Layout from "@/components/Layout";
import Dashboard from "@/pages/dashboard";
import Transactions from "@/pages/transactions";
import Transfers from "@/pages/transfers";
import Accounts from "@/pages/accounts";
import Analytics from "@/pages/analytics";
import Properties from "@/pages/properties";
import Tenants from "@/pages/tenants";
import Categories from "@/pages/categories";
import Backup from "@/pages/backup";
import NotFound from "@/pages/not-found";

function AuthenticatedRoutes() {
  return (
    <Layout>
      <Switch>
        <Route path="/" component={() => <Redirect to="/dashboard" />} />
        <Route path="/dashboard" component={Dashboard} />
        <Route path="/transactions" component={Transactions} />
        <Route path="/transfers" component={Transfers} />
        <Route path="/accounts" component={Accounts} />
        <Route path="/analytics" component={Analytics} />
        <Route path="/properties" component={Properties} />
        <Route path="/tenants" component={() => <Tenants />} />
        <Route path="/categories" component={Categories} />
        <Route path="/backup" component={Backup} />
        {/* NotFound fallback must be last */}
        <Route>{() => <NotFound />}</Route>
      </Switch>
    </Layout>
  );
}

function Router() {
  const { user, isLoading } = useAuth();
  const [location, setLocation] = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  // If authenticated and on an /auth route, redirect to /dashboard
  if (user && location.startsWith("/auth")) {
    setLocation("/dashboard");
    return null;
  }

  return user ? <AuthenticatedRoutes /> : <LoginPage />;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
