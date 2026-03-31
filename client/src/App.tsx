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
import type { User } from "@shared/routes";
import type { ReactNode } from "react";

type AllowedRole = User["role"];

function RoleRoute({
  user,
  allowedRoles,
  children,
}: {
  user: User | null | undefined;
  allowedRoles: AllowedRole[];
  children: ReactNode;
}) {
  if (!user) {
    return <Redirect to="/auth" />;
  }

  if (!allowedRoles.includes(user.role)) {
    return <Redirect to="/" />;
  }

  return <>{children}</>;
}

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

      <Route path="/admin/chefs">
        <RoleRoute user={user} allowedRoles={["admin"]}>
          <AdminDashboard />
        </RoleRoute>
      </Route>
      <Route path="/admin/menus">
        <RoleRoute user={user} allowedRoles={["admin"]}>
          <AdminDashboard />
        </RoleRoute>
      </Route>
      <Route path="/admin">
        <RoleRoute user={user} allowedRoles={["admin"]}>
          <AdminDashboard />
        </RoleRoute>
      </Route>
      
      <Route path="/chef/menus">
        <RoleRoute user={user} allowedRoles={["chef"]}>
          <ChefDashboard />
        </RoleRoute>
      </Route>
      <Route path="/chef">
        <RoleRoute user={user} allowedRoles={["chef"]}>
          <ChefDashboard />
        </RoleRoute>
      </Route>

      <Route path="/dashboard">
        <RoleRoute user={user} allowedRoles={["user"]}>
          <UserDashboard />
        </RoleRoute>
      </Route>
      <Route path="/requests">
        <RoleRoute user={user} allowedRoles={["user"]}>
          <UserDashboard />
        </RoleRoute>
      </Route>
      <Route path="/feedback">
        <RoleRoute user={user} allowedRoles={["user"]}>
          <UserDashboard />
        </RoleRoute>
      </Route>

      <Route path="/house-director/critiques">
        <RoleRoute user={user} allowedRoles={["house_director"]}>
          <HouseDirectorDashboard />
        </RoleRoute>
      </Route>
      <Route path="/house-director">
        <RoleRoute user={user} allowedRoles={["house_director"]}>
          <HouseDirectorDashboard />
        </RoleRoute>
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
