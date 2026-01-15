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
          <UserDashboard />
        )}
      </Route>

      <Route path="/admin">
        {!user ? <Redirect to="/auth" /> : (user.role === 'admin' ? <AdminDashboard /> : <Redirect to="/" />)}
      </Route>

      <Route path="/chef">
        {!user ? <Redirect to="/auth" /> : (user.role === 'chef' ? <ChefDashboard /> : <Redirect to="/" />)}
      </Route>

      <Route path="/dashboard">
        {!user ? <Redirect to="/auth" /> : <UserDashboard />}
      </Route>

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
