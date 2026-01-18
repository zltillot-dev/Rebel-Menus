import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { 
  LayoutDashboard, 
  ChefHat, 
  UtensilsCrossed, 
  CalendarDays, 
  MessageSquarePlus, 
  LogOut,
  Users,
  Settings,
  Menu,
  X
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export function Sidebar() {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  if (!user) return null;

  const fraternityColors = {
    "Delta Tau Delta": "from-purple-600 to-amber-400",
    "Sigma Chi": "from-blue-600 to-amber-400",
    null: "from-primary to-primary/60"
  };

  const gradient = fraternityColors[user.fraternity as keyof typeof fraternityColors] || fraternityColors.null;

  const NavItem = ({ href, icon: Icon, label }: { href: string; icon: any; label: string }) => {
    const isActive = location === href;
    return (
      <Link href={href}>
        <div 
          className={cn(
            "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 cursor-pointer group",
            isActive 
              ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20" 
              : "text-muted-foreground hover:bg-secondary/20 hover:text-foreground"
          )}
          onClick={() => setMobileOpen(false)}
        >
          <Icon className={cn("w-5 h-5", isActive ? "text-primary-foreground" : "text-muted-foreground group-hover:text-primary")} />
          <span className="font-medium">{label}</span>
        </div>
      </Link>
    );
  };

  const SidebarContent = () => (
    <>
      <div className="p-6">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="font-display font-bold text-2xl tracking-tight">REBEL CHEFS</h1>
            <p className="text-xs text-muted-foreground mt-1">
              {user.fraternity || "Admin Portal"}
            </p>
          </div>
          <Button 
            variant="ghost" 
            size="icon" 
            className="md:hidden"
            onClick={() => setMobileOpen(false)}
            data-testid="button-close-sidebar"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        <nav className="space-y-1">
          {user.role === 'user' && (
            <>
              <NavItem href="/" icon={LayoutDashboard} label="This Week's Menu" />
              <NavItem href="/requests" icon={MessageSquarePlus} label="Requests" />
              <NavItem href="/feedback" icon={UtensilsCrossed} label="My Feedback" />
            </>
          )}

          {user.role === 'chef' && (
            <>
              <NavItem href="/chef" icon={LayoutDashboard} label="Dashboard" />
              <NavItem href="/chef/menus" icon={CalendarDays} label="Manage Menus" />
            </>
          )}

          {user.role === 'admin' && (
            <>
              <NavItem href="/admin" icon={LayoutDashboard} label="Dashboard" />
              <NavItem href="/admin/chefs" icon={Users} label="Manage Chefs" />
              <NavItem href="/admin/menus" icon={CalendarDays} label="All Menus" />
            </>
          )}
        </nav>
      </div>

      <div className="mt-auto p-6 border-t border-border">
        <div className="flex items-center gap-3 mb-4 px-2">
          <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-secondary-foreground font-bold text-sm">
            {user.name.charAt(0)}
          </div>
          <div className="flex-1 overflow-hidden">
            <p className="text-sm font-medium truncate">{user.name}</p>
            <p className="text-xs text-muted-foreground capitalize">{user.role}</p>
          </div>
        </div>
        <button 
          onClick={() => logout()}
          className="w-full flex items-center gap-2 px-4 py-2 rounded-lg text-sm text-destructive hover:bg-destructive/10 transition-colors"
          data-testid="button-logout"
        >
          <LogOut className="w-4 h-4" />
          Sign Out
        </button>
      </div>
    </>
  );

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="fixed top-4 left-4 z-50 md:hidden"
        onClick={() => setMobileOpen(true)}
        data-testid="button-open-sidebar"
      >
        <Menu className="w-6 h-6" />
      </Button>

      {mobileOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <div className={cn(
        "h-screen w-64 bg-card border-r border-border fixed left-0 top-0 flex flex-col z-50 transition-transform duration-300",
        "md:translate-x-0",
        mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
      )}>
        <SidebarContent />
      </div>
    </>
  );
}
