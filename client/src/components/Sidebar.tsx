import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useNotifications } from "@/hooks/use-notifications";
import {
  LayoutDashboard,
  UtensilsCrossed,
  CalendarDays,
  MessageSquarePlus,
  LogOut,
  Users,
  Menu,
  X,
  Bell,
  BellOff,
  ClipboardList
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export function Sidebar() {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { permission, isSupported, isGranted, isRequesting, requestPermission } = useNotifications();

  if (!user) return null;
  const roleLabel = user.role === "house_director" ? "House Director" : user.role.replace("_", " ");

  const NavItem = ({ href, icon: Icon, label }: { href: string; icon: any; label: string }) => {
    const isActive = location === href;
    return (
      <Link href={href}>
        <Button
          variant="ghost"
          className={cn(
            "w-full justify-start gap-3 px-4 py-3 h-auto rounded-lg text-neutral-400 hover:text-white hover:bg-white/[0.08] transition-colors",
            isActive && "bg-amber-500/15 text-amber-400 hover:bg-amber-500/20 hover:text-amber-400 font-semibold"
          )}
          onClick={() => setMobileOpen(false)}
          data-testid={`nav-item-${label.toLowerCase().replace(/\s+/g, '-')}`}
        >
          <Icon className={cn("w-5 h-5", isActive && "text-amber-400")} />
          <span className="font-medium text-sm">{label}</span>
        </Button>
      </Link>
    );
  };

  const SidebarContent = () => (
    <>
      <div className="p-6">
        <div className="mb-10 flex items-center justify-between">
          <div>
            <h1 className="font-display font-black text-2xl tracking-tight text-white">REBEL CHEFS</h1>
            <div className="mt-1 h-0.5 w-12 bg-amber-500 rounded-full" />
            <p className="text-[11px] text-neutral-500 mt-2">
              {user.fraternity || "Admin Portal"}
            </p>
            <p className="text-[10px] uppercase tracking-[0.25em] text-neutral-600 mt-1 font-semibold">
              {roleLabel}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden text-neutral-400 hover:text-white hover:bg-white/10"
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

          {user.role === 'house_director' && (
            <>
              <NavItem href="/house-director" icon={LayoutDashboard} label="Dashboard" />
              <NavItem href="/house-director/critiques" icon={ClipboardList} label="My Critiques" />
            </>
          )}
        </nav>
      </div>

      <div className="mt-auto p-6 border-t border-white/[0.06]">
        <div className="flex items-center gap-3 mb-4 px-2">
          <div className="w-8 h-8 rounded-full bg-amber-500 flex items-center justify-center text-black font-bold text-sm">
            {user.name.charAt(0)}
          </div>
          <div className="flex-1 overflow-hidden">
            <p className="text-sm font-medium truncate text-white">{user.name}</p>
            <p className="text-[11px] text-neutral-500 capitalize">{roleLabel}</p>
          </div>
        </div>

        {isSupported && (
          <Button
            variant="ghost"
            className={cn(
              "w-full justify-start mb-2 text-neutral-400 hover:text-white hover:bg-white/[0.08]",
              isGranted && "text-emerald-400 hover:text-emerald-400",
              permission === 'denied' && "opacity-40 cursor-not-allowed"
            )}
            onClick={() => requestPermission()}
            disabled={isRequesting || permission === 'denied'}
            data-testid="button-notifications"
          >
            {isGranted ? (
              <>
                <Bell className="w-4 h-4 mr-2" />
                Notifications On
              </>
            ) : permission === 'denied' ? (
              <>
                <BellOff className="w-4 h-4 mr-2" />
                Notifications Blocked
              </>
            ) : (
              <>
                <Bell className="w-4 h-4 mr-2" />
                {isRequesting ? 'Requesting...' : 'Enable Notifications'}
              </>
            )}
          </Button>
        )}

        <Button
          variant="ghost"
          className="w-full justify-start text-red-400/80 hover:text-red-400 hover:bg-red-500/10"
          onClick={() => logout()}
          data-testid="button-logout"
        >
          <LogOut className="w-4 h-4 mr-2" />
          Sign Out
        </Button>
      </div>
    </>
  );

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="fixed top-4 left-4 z-50 md:hidden bg-neutral-900/95 text-white border border-white/10 shadow-lg hover:bg-neutral-800"
        onClick={() => setMobileOpen(true)}
        data-testid="button-open-sidebar"
      >
        <Menu className="w-6 h-6" />
      </Button>

      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <div className={cn(
        "h-screen w-64 bg-neutral-900 border-r border-white/[0.06] fixed left-0 top-0 flex flex-col z-50 transition-transform duration-300",
        "md:translate-x-0",
        mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
      )}>
        <SidebarContent />
      </div>
    </>
  );
}
