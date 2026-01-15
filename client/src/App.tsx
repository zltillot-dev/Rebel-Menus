import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import AuthPage from "@/pages/auth";
import UserDashboard from "@/pages/user/dashboard";
import AdminDashboard from "@/pages/admin/dashboard";
import ChefDashboard from "@/pages/chef/dashboard";
import { useAuth } from "@/hooks/use-auth";

function ProtectedRoute({ component: Component, allowedRoles }: { component: any, allowedRoles: string[] }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  if (!user) {
    return <Redirect to="/auth" />;
  }

  if (!allowedRoles.includes(user.role)) {
    // Redirect to correct dashboard based on role
    if (user.role === 'admin') return <Redirect to="/admin" />;
    if (user.role === 'chef') return <Redirect to="/chef" />;
    return <Redirect to="/" />;
  }

  return <Component />;
}

function Router() {
  return (
    <Switch>
      <Route path="/auth" component={AuthPage} />
      
      {/* User Routes */}
      <Route path="/">
        <ProtectedRoute component={UserDashboard} allowedRoles={['user']} />
      </Route>
      <Route path="/requests">
        <ProtectedRoute component={UserDashboard} allowedRoles={['user']} />
      </Route>
      <Route path="/feedback">
        <ProtectedRoute component={UserDashboard} allowedRoles={['user']} />
      </Route>

      {/* Admin Routes */}
      <Route path="/admin">
        <ProtectedRoute component={AdminDashboard} allowedRoles={['admin']} />
      </Route>
      <Route path="/admin/chefs">
        <ProtectedRoute component={AdminDashboard} allowedRoles={['admin']} />
      </Route>
      <Route path="/admin/menus">
        <ProtectedRoute component={AdminDashboard} allowedRoles={['admin']} />
      </Route>

      {/* Chef Routes */}
      <Route path="/chef">
        <ProtectedRoute component={ChefDashboard} allowedRoles={['chef']} />
      </Route>
      <Route path="/chef/menus">
        <ProtectedRoute component={ChefDashboard} allowedRoles={['chef']} />
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
