import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";
import NotFound from "@/pages/not-found";
import AuthPage from "@/pages/auth";
import UserDashboard from "@/pages/user/dashboard";
import ChefDashboard from "@/pages/chef/dashboard";
import AdminDashboard from "@/pages/admin/dashboard";
import HouseDirectorDashboard from "@/pages/house-director/dashboard";

function Router() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <Switch>
      <Route path="/auth">
        {user ? <Redirect to="/" /> : <AuthPage />}
      </Route>
      
      <Route path="/">
        {!user ? <Redirect to="/auth" /> : (
          user.role === 'admin' ? <AdminDashboard /> : 
          user.role === 'chef' ? <ChefDashboard /> : 
          user.role === 'house_director' ? <HouseDirectorDashboard /> :
          <UserDashboard />
        )}
      </Route>

      <Route path="/admin" component={AdminDashboard} />
      <Route path="/admin/chefs" component={AdminDashboard} />
      <Route path="/admin/menus" component={AdminDashboard} />
      
      <Route path="/chef" component={ChefDashboard} />
      <Route path="/chef/menus" component={ChefDashboard} />

      <Route path="/dashboard" component={UserDashboard} />
      <Route path="/requests" component={UserDashboard} />
      <Route path="/feedback" component={UserDashboard} />

      <Route path="/house-director" component={HouseDirectorDashboard} />
      <Route path="/house-director/critiques" component={HouseDirectorDashboard} />

      <Route component={NotFound} />
    </Switch>
  );
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
