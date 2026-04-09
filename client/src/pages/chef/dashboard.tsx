import { useState, useMemo, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useMenus, useCreateMenu, useUpdateMenuStatus, useUpdateMenu, useDeleteMenu } from "@/hooks/use-menus";
import { useLatePlates, useChefRequests, useChefFeedback, useChefTasks, useUpdateChefTask, useMarkRequestRead, useMarkFeedbackRead, useUpdateRequestStatus } from "@/hooks/use-requests";
import { useNotifications } from "@/hooks/use-notifications";
import { Sidebar } from "@/components/Sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Plus, Calendar as CalendarIcon, AlertCircle, Send, Pencil, Trash2, Sparkles, Loader2, Clock, User, Phone, Settings, UserCog, RefreshCcw, Lightbulb, MessageSquare, Star, ChefHat, ChevronDown, ChevronRight, CheckSquare, ListTodo, CheckCircle, XCircle, FileDown, ArrowRight, ClipboardCheck } from "lucide-react";
import { exportMenuToPDF } from "@/lib/pdf-export";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { format, startOfWeek, addWeeks, parseISO, isSameDay, isBefore, isAfter } from "date-fns";
import { DAYS, MEAL_TYPES } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { ScrollArea } from "@/components/ui/scroll-area";

export default function ChefDashboard() {
  const [location, setLocation] = useLocation();
  const isManageMenusView = location === "/chef/menus";
  
  const { user } = useAuth();
  const { data: menus } = useMenus({ fraternity: user?.fraternity || undefined });
  const { data: latePlates, isLoading: isLoadingLatePlates } = useLatePlates();
  const { data: chefRequests, isLoading: isLoadingChefRequests } = useChefRequests();
  const { data: chefFeedback, isLoading: isLoadingFeedback } = useChefFeedback();
  const { data: chefTasks, isLoading: isLoadingTasks } = useChefTasks();
  const { mutate: updateTask } = useUpdateChefTask();
  const { mutate: markRequestRead } = useMarkRequestRead();
  const { mutate: markFeedbackRead } = useMarkFeedbackRead();
  const { mutate: updateRequestStatus, isPending: isUpdatingRequestStatus } = useUpdateRequestStatus();
  const { notifySubstitutionDecision, notifyMenuApproved, notifyMenuRejected, isGranted: notificationsEnabled } = useNotifications();
  
  // Track previous menu statuses to detect changes from admin
  const prevMenuStatuses = useRef<Map<number, string>>(new Map());
  const { mutate: createMenu, isPending: isCreating } = useCreateMenu();
  
  // Detect menu status changes (when admin approves/rejects) and notify chef
  useEffect(() => {
    if (!menus || !notificationsEnabled) return;
    
    menus.forEach((menu: any) => {
      const prevStatus = prevMenuStatuses.current.get(menu.id);
      const currentStatus = menu.status;
      
      // Notify if status changed from pending to approved/needs_revision
      if (prevStatus === 'pending') {
        const weekOf = format(new Date(menu.weekOf), "MMMM d");
        if (currentStatus === 'approved') {
          notifyMenuApproved(weekOf);
        } else if (currentStatus === 'needs_revision') {
          notifyMenuRejected(weekOf);
        }
      }
      
      prevMenuStatuses.current.set(menu.id, currentStatus);
    });
  }, [menus, notificationsEnabled, notifyMenuApproved, notifyMenuRejected]);
  const { mutate: updateStatus, isPending: isUpdating } = useUpdateMenuStatus();
  const { mutate: updateMenu, isPending: isUpdatingMenu } = useUpdateMenu();
  const { mutate: deleteMenu } = useDeleteMenu();
  
  const [createOpen, setCreateOpen] = useState(false);
  const [editMenu, setEditMenu] = useState<any>(null);
  const [phoneDialogOpen, setPhoneDialogOpen] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [profileDialogOpen, setProfileDialogOpen] = useState(false);
  const [profileName, setProfileName] = useState("");
  const [profileEmail, setProfileEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [latePlatesOpen, setLatePlatesOpen] = useState(true);
  const [substitutionsOpen, setSubstitutionsOpen] = useState(false);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  useEffect(() => {
    if (user?.phoneNumber) {
      setPhoneNumber(user.phoneNumber);
    }
  }, [user?.phoneNumber]);

  useEffect(() => {
    if (phoneDialogOpen && user?.phoneNumber) {
      setPhoneNumber(user.phoneNumber);
    }
  }, [phoneDialogOpen, user?.phoneNumber]);

  useEffect(() => {
    if (profileDialogOpen && user) {
      setProfileName(user.name || "");
      setProfileEmail(user.email || "");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    }
  }, [profileDialogOpen, user]);

  const updatePhoneMutation = useMutation({
    mutationFn: async (phone: string) => {
      const res = await apiRequest("PATCH", "/api/user/phone", { phoneNumber: phone });
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Phone number updated",
        description: "You will receive late plate SMS notifications at the cutoff times.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/user'] });
      setPhoneDialogOpen(false);
    },
    onError: (error: any) => {
      toast({
        title: "Failed to update phone number",
        description: error.message || "Please try again.",
        variant: "destructive"
      });
    }
  });

  const updateProfileMutation = useMutation({
    mutationFn: async (data: { name?: string; email?: string; currentPassword?: string; newPassword?: string }) => {
      const res = await apiRequest("PATCH", "/api/user/profile", data);
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || "Failed to update profile");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Profile updated",
        description: "Your account details have been saved successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/user'] });
      setProfileDialogOpen(false);
    },
    onError: (error: any) => {
      toast({
        title: "Failed to update profile",
        description: error.message || "Please try again.",
        variant: "destructive"
      });
    }
  });

  const handleProfileUpdate = () => {
    if (newPassword && newPassword !== confirmPassword) {
      toast({
        title: "Passwords don't match",
        description: "Please make sure your new password and confirmation match.",
        variant: "destructive"
      });
      return;
    }

    const updates: { name?: string; email?: string; currentPassword?: string; newPassword?: string } = {};
    
    if (profileName && profileName !== user?.name) {
      updates.name = profileName;
    }
    if (profileEmail && profileEmail !== user?.email) {
      updates.email = profileEmail;
    }
    if (newPassword && currentPassword) {
      updates.currentPassword = currentPassword;
      updates.newPassword = newPassword;
    }

    if (Object.keys(updates).length === 0) {
      toast({
        title: "No changes",
        description: "No changes were made to your profile.",
      });
      return;
    }

    updateProfileMutation.mutate(updates);
  };

  const currentWeekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const currentWeekFormatted = format(currentWeekStart, "yyyy-MM-dd");

  const currentWeekMenu = useMemo(() => {
    if (!menus) return null;
    return menus.find(m => {
      const menuWeek = format(parseISO(m.weekOf), "yyyy-MM-dd");
      return menuWeek === currentWeekFormatted && (m.status === 'approved' || m.status === 'pending');
    });
  }, [menus, currentWeekFormatted]);

  const pastMenus = useMemo(() => {
    if (!menus) return [];
    return menus.filter(m => {
      const menuDate = parseISO(m.weekOf);
      return isBefore(menuDate, currentWeekStart);
    }).sort((a, b) => new Date(b.weekOf).getTime() - new Date(a.weekOf).getTime());
  }, [menus, currentWeekStart]);

  const futureMenus = useMemo(() => {
    if (!menus) return [];
    return menus.filter(m => {
      const menuDate = parseISO(m.weekOf);
      return isAfter(menuDate, currentWeekStart);
    }).sort((a, b) => new Date(a.weekOf).getTime() - new Date(b.weekOf).getTime());
  }, [menus, currentWeekStart]);

  const menusNeedingRevision = menus?.filter(m => m.status === 'needs_revision') || [];
  const pendingMenus = menus?.filter(m => m.status === 'pending') || [];

  const latePlatesByMealService = useMemo(() => {
    if (!latePlates) return {};
    
    const grouped: Record<string, any[]> = {};
    
    for (const lp of latePlates) {
      if (lp.mealDay && lp.mealType) {
        const key = `${lp.mealDay}|${lp.mealType}`;
        if (!grouped[key]) {
          grouped[key] = [];
        }
        grouped[key].push(lp);
      }
    }
    
    const sortedKeys = Object.keys(grouped).sort((a, b) => {
      const [dateA] = a.split("|");
      const [dateB] = b.split("|");
      return new Date(dateA).getTime() - new Date(dateB).getTime();
    });
    
    const sorted: Record<string, any[]> = {};
    for (const key of sortedKeys) {
      sorted[key] = grouped[key];
    }
    
    return sorted;
  }, [latePlates]);

  const todaysLatePlates = useMemo(() => {
    const today = new Date();
    const result: Record<string, any[]> = {};
    
    for (const [key, plates] of Object.entries(latePlatesByMealService)) {
      const [dateStr] = key.split("|");
      if (isSameDay(parseISO(dateStr), today)) {
        result[key] = plates;
      }
    }
    
    return result;
  }, [latePlatesByMealService]);

  const substitutions = useMemo(() => {
    return chefRequests?.filter((r: any) => r.type === 'substitution') || [];
  }, [chefRequests]);

  const unreadSubstitutions = useMemo(() => {
    return substitutions.filter((r: any) => !r.isRead).length;
  }, [substitutions]);

  const menuSuggestions = useMemo(() => {
    return chefRequests?.filter((r: any) => r.type === 'menu_suggestion') || [];
  }, [chefRequests]);

  const unreadSuggestions = useMemo(() => {
    return menuSuggestions.filter((r: any) => !r.isRead).length;
  }, [menuSuggestions]);

  const unreadFeedback = useMemo(() => {
    return chefFeedback?.filter((fb: any) => !fb.isRead).length || 0;
  }, [chefFeedback]);

  const incompleteTasks = chefTasks?.filter((t: any) => !t.isCompleted) || [];
  const completedTasks = chefTasks?.filter((t: any) => t.isCompleted) || [];

  const totalUnreadInbox = unreadSubstitutions + unreadSuggestions + unreadFeedback;
  const totalMealSlots = useMemo(() => DAYS.length + (DAYS.length - 1), []);

  const getMenuFilledCount = (items: any[]) => items.filter((item) => item.description?.trim()).length;

  const menuDraftProgress = useMemo(() => {
    const completed = getMenuFilledCount(menuItems);
    return { completed, remaining: Math.max(totalMealSlots - completed, 0) };
  }, [menuItems, totalMealSlots]);

  const editMenuProgress = useMemo(() => {
    const completed = getMenuFilledCount(editMenuItems);
    return { completed, remaining: Math.max(totalMealSlots - completed, 0) };
  }, [editMenuItems, totalMealSlots]);

  const getStatusMeta = (status: string) => {
    switch (status) {
      case "approved":
        return {
          label: "Approved",
          badgeClass: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-sm uppercase tracking-wider font-bold text-[10px]",
          summary: "Posted and visible to members.",
          action: "No action needed.",
        };
      case "pending":
        return {
          label: "Submitted",
          badgeClass: "bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-sm uppercase tracking-wider font-bold text-[10px]",
          summary: "Waiting on admin review.",
          action: "Hold until admin responds.",
        };
      case "needs_revision":
        return {
          label: "Needs Revision",
          badgeClass: "bg-red-500/10 text-red-400 border border-red-500/20 rounded-sm uppercase tracking-wider font-bold text-[10px]",
          summary: "Admin sent this back for edits.",
          action: "Open it, fix notes, and resubmit.",
        };
      default:
        return {
          label: "Draft",
          badgeClass: "bg-neutral-500/10 text-neutral-400 border border-neutral-500/20 rounded-sm uppercase tracking-wider font-bold text-[10px]",
          summary: "Not yet submitted.",
          action: "Finish meals and submit for approval.",
        };
    }
  };

  const sortedIncompleteTasks = useMemo(() => {
    const priorityWeight: Record<string, number> = { high: 0, medium: 1, low: 2 };
    return [...incompleteTasks].sort((a: any, b: any) => {
      const priorityDiff = (priorityWeight[a.priority] ?? 3) - (priorityWeight[b.priority] ?? 3);
      if (priorityDiff !== 0) return priorityDiff;
      if (a.dueDate && b.dueDate) return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      if (a.dueDate) return -1;
      if (b.dueDate) return 1;
      return 0;
    });
  }, [incompleteTasks]);

  const sortedFeedback = useMemo(() => {
    return [...(chefFeedback || [])].sort((a: any, b: any) => Number(a.isRead) - Number(b.isRead));
  }, [chefFeedback]);

  const sortedSubstitutions = useMemo(() => {
    return [...substitutions].sort((a: any, b: any) => {
      if (a.status === "pending" && b.status !== "pending") return -1;
      if (a.status !== "pending" && b.status === "pending") return 1;
      return Number(a.isRead) - Number(b.isRead);
    });
  }, [substitutions]);

  const sortedSuggestions = useMemo(() => {
    return [...menuSuggestions].sort((a: any, b: any) => Number(a.isRead) - Number(b.isRead));
  }, [menuSuggestions]);

  const nextActionMenu = menusNeedingRevision[0] || pendingMenus[0] || currentWeekMenu || futureMenus[0] || null;

  const nextActionSummary = useMemo(() => {
    if (menusNeedingRevision.length > 0) {
      return {
        title: "Revision needed",
        description: `${menusNeedingRevision.length} menu${menusNeedingRevision.length === 1 ? "" : "s"} waiting on edits from you.`,
        cta: "Open menus",
      };
    }
    if (!currentWeekMenu) {
      return {
        title: "No current-week menu",
        description: "Create or submit a menu so this week is covered.",
        cta: "Create menu",
      };
    }
    if (pendingMenus.length > 0) {
      return {
        title: "Awaiting review",
        description: `${pendingMenus.length} submitted menu${pendingMenus.length === 1 ? "" : "s"} currently with admin.`,
        cta: "Review status",
      };
    }
    return {
      title: "Kitchen is caught up",
      description: "Use this dashboard to manage tasks, inbox items, and today's late plates.",
      cta: "Manage menus",
    };
  }, [currentWeekMenu, menusNeedingRevision, pendingMenus]);

  const [weekOf, setWeekOf] = useState(format(addWeeks(startOfWeek(new Date(), { weekStartsOn: 1 }), 1), "yyyy-MM-dd"));
  const [menuItems, setMenuItems] = useState<any[]>([]);
  const [editWeekOf, setEditWeekOf] = useState("");
  const [editMenuItems, setEditMenuItems] = useState<any[]>([]);

  const initializeMenu = () => {
    const items = [];
    for (const day of DAYS) {
      items.push({ 
        day, 
        meal: "Lunch", 
        description: "", 
        side1: "", 
        side2: "", 
        side3: "", 
        calories: 0, 
        carbs: 0, 
        fats: 0, 
        protein: 0, 
        sugar: 0 
      });
      if (day !== "Friday") {
        items.push({ 
          day, 
          meal: "Dinner", 
          description: "", 
          side1: "", 
          side2: "", 
          side3: "", 
          calories: 0, 
          carbs: 0, 
          fats: 0, 
          protein: 0, 
          sugar: 0 
        });
      }
    }
    setMenuItems(items);
  };

  const handleItemChange = (index: number, field: string, value: any) => {
    const newItems = [...menuItems];
    newItems[index] = { ...newItems[index], [field]: value };
    setMenuItems(newItems);
  };

  const handleEditItemChange = (index: number, field: string, value: any) => {
    const newItems = [...editMenuItems];
    newItems[index] = { ...newItems[index], [field]: value };
    setEditMenuItems(newItems);
  };

  const handleCreateMenu = () => {
    const validItems = menuItems.filter(item => item.description.trim() !== "");
    if (validItems.length === 0) {
      toast({ title: "Error", description: "Please add at least one menu item", variant: "destructive" });
      return;
    }
    
    createMenu({
      weekOf,
      status: "pending",
      fraternity: user?.fraternity || "Delta Tau Delta",
      items: validItems,
    }, {
      onSuccess: () => {
        setCreateOpen(false);
        setMenuItems([]);
      }
    });
  };

  const handleStartEdit = (menu: any) => {
    setEditMenu(menu);
    setEditWeekOf(menu.weekOf);
    
    const items = [];
    for (const day of DAYS) {
      const lunchItem = menu.items?.find((i: any) => i.day === day && i.meal === "Lunch");
      items.push(lunchItem || { 
        day, 
        meal: "Lunch", 
        description: "", 
        side1: "", 
        side2: "", 
        side3: "", 
        calories: 0, 
        carbs: 0, 
        fats: 0, 
        protein: 0, 
        sugar: 0 
      });
      
      if (day !== "Friday") {
        const dinnerItem = menu.items?.find((i: any) => i.day === day && i.meal === "Dinner");
        items.push(dinnerItem || { 
          day, 
          meal: "Dinner", 
          description: "", 
          side1: "", 
          side2: "", 
          side3: "", 
          calories: 0, 
          carbs: 0, 
          fats: 0, 
          protein: 0, 
          sugar: 0 
        });
      }
    }
    setEditMenuItems(items);
  };

  const handleSaveEdit = () => {
    if (!editMenu) return;
    
    const validItems = editMenuItems.filter(item => item.description.trim() !== "");
    if (validItems.length === 0) {
      toast({ title: "Error", description: "Please add at least one menu item", variant: "destructive" });
      return;
    }
    
    updateMenu({
      id: editMenu.id,
      data: {
        weekOf: editWeekOf,
        status: "pending",
        fraternity: user?.fraternity || "Delta Tau Delta",
        items: validItems,
      }
    }, {
      onSuccess: () => {
        setEditMenu(null);
        setEditMenuItems([]);
      }
    });
  };

  const handleDelete = (id: number) => {
    deleteMenu(id);
  };

  const handleTaskComplete = (taskId: number, isCompleted: boolean) => {
    updateTask({ id: taskId, isCompleted });
  };

  const renderMenuCard = (menu: any, showActions = false) => {
    const statusMeta = getStatusMeta(menu.status);
    const filledCount = getMenuFilledCount(menu.items || []);
    const latestHistory = menu.workflowHistory?.[0];

    return (
      <Card key={menu.id} className={`bg-[#111111] border rounded-sm ${menu.status === 'needs_revision' ? "border-amber-500/30" : "border-white/[0.06]"}`}>
        <CardHeader className="bg-[#0D0D0D] border-b border-white/[0.06] pb-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <CardTitle className="font-display font-bold uppercase tracking-wide text-white text-lg">Week of {format(parseISO(menu.weekOf), "MMM d, yyyy")}</CardTitle>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Badge className={statusMeta.badgeClass}>{statusMeta.label}</Badge>
                <Badge variant="outline" className="border-white/[0.08] text-neutral-400 rounded-sm">{filledCount}/{totalMealSlots} meals planned</Badge>
                <Button
                  size="sm"
                  variant="ghost"
                  className="border-white/[0.08] text-neutral-400 hover:text-white hover:border-white/[0.2] rounded-sm"
                  onClick={() => exportMenuToPDF({
                    id: menu.id,
                    weekOf: menu.weekOf,
                    fraternity: menu.fraternity,
                    status: menu.status,
                    items: menu.items?.map((item: any) => ({
                      day: item.day,
                      mealType: item.meal,
                      description: item.description,
                      side1: item.side1,
                      side2: item.side2,
                      side3: item.side3,
                      calories: item.calories,
                      protein: item.protein,
                      carbs: item.carbs,
                      fats: item.fats,
                      sugar: item.sugar,
                    })),
                  })}
                  data-testid={`button-export-pdf-${menu.id}`}
                >
                  <FileDown className="w-4 h-4 mr-1" />
                  PDF
                </Button>
              </div>
              <p className="mt-2 text-sm text-neutral-500">{statusMeta.summary}</p>
              <p className="text-xs text-neutral-500">{statusMeta.action}</p>
            </div>
            {showActions && (menu.status === 'pending' || menu.status === 'needs_revision') && (
              <div className="flex gap-2">
                <Button size="sm" variant="outline" className="border-white/[0.08] text-neutral-400 hover:text-white hover:border-white/[0.2] rounded-sm font-display font-bold uppercase tracking-wider" onClick={() => handleStartEdit(menu)} data-testid={`button-edit-menu-${menu.id}`}>
                  <Pencil className="w-4 h-4 mr-1" /> Edit
                </Button>
                {menu.status === "draft" && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="sm" variant="destructive" data-testid={`button-delete-menu-${menu.id}`}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent className="bg-[#111111] border border-white/[0.1] rounded-sm">
                      <AlertDialogHeader>
                        <AlertDialogTitle className="font-display font-bold uppercase tracking-wide text-white">Delete Draft Menu?</AlertDialogTitle>
                        <AlertDialogDescription className="text-neutral-400">
                          Only draft menus can be deleted. Submitted menus are preserved to keep operational history intact.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel className="border-white/[0.08] text-neutral-400 hover:text-white hover:border-white/[0.2] rounded-sm">Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleDelete(menu.id)}>Delete</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </div>
            )}
          </div>
          {menu.adminNotes && (
            <div className="mt-3 rounded-sm border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
              <div className="mb-1 flex items-center gap-2 font-medium text-amber-400">
                <AlertCircle className="h-4 w-4" />
                Admin revision notes
              </div>
              <p className="text-amber-400/90">{menu.adminNotes}</p>
            </div>
          )}
          {latestHistory && (
            <div className="mt-3 rounded-sm bg-white/[0.03] p-3 text-xs text-neutral-500">
              Last workflow update: {latestHistory.action.replace(/_/g, " ")} on {format(new Date(latestHistory.createdAt), "MMM d 'at' h:mm a")}
              {latestHistory.notes ? ` • ${latestHistory.notes}` : ""}
            </div>
          )}
        </CardHeader>
        <CardContent>
          {menu.items && menu.items.length > 0 ? (
            <div className="space-y-2">
              {DAYS.map(day => {
                const dayItems = menu.items.filter((item: any) => item.day === day);
                if (dayItems.length === 0) return null;
                return (
                  <div key={day} className="border-b border-white/[0.06] pb-2 last:border-b-0">
                    <div className="font-display font-bold text-sm text-neutral-500 uppercase tracking-wide">{day}</div>
                    {dayItems.map((item: any) => (
                      <div key={`${item.day}-${item.meal}`} className="ml-2 text-sm text-neutral-300">
                        <span className="font-medium text-white">{item.meal}:</span> {item.description}
                        {(item.side1 || item.side2 || item.side3) && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {item.side1 && <Badge variant="outline" className="text-xs border-white/[0.08] text-neutral-400 rounded-sm">{item.side1}</Badge>}
                            {item.side2 && <Badge variant="outline" className="text-xs border-white/[0.08] text-neutral-400 rounded-sm">{item.side2}</Badge>}
                            {item.side3 && <Badge variant="outline" className="text-xs border-white/[0.08] text-neutral-400 rounded-sm">{item.side3}</Badge>}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-neutral-500 text-sm">No items in this menu</p>
          )}
        </CardContent>
      </Card>
    );
  };

  const renderMenuForm = (items: any[], onChange: (idx: number, field: string, value: any) => void) => (
    <Tabs defaultValue="Monday" className="w-full">
      <TabsList className="h-10 bg-[#111111] border border-white/[0.06] rounded-sm p-0.5 grid grid-cols-5 mb-6">
        {DAYS.map(day => (
          <TabsTrigger key={day} value={day} className="data-[state=active]:bg-[#1A1A1A] data-[state=active]:text-white rounded-sm font-display font-bold uppercase tracking-wide text-xs" data-testid={`tab-day-${day}`}>{day}</TabsTrigger>
        ))}
      </TabsList>
      
      {DAYS.map(day => (
        <TabsContent key={day} value={day} className="space-y-6">
          {items
            .map((item, idx) => ({ item, idx }))
            .filter(({ item }) => item.day === day)
            .map(({ item, idx }) => (
              <Card key={idx} className="bg-[#111111] border border-white/[0.06] rounded-sm p-4">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-display font-bold uppercase tracking-wide text-white text-lg">{item.meal}</h4>
                  <div className="flex items-center gap-1 text-xs text-neutral-500">
                    <Sparkles className="w-3 h-3" />
                    <span>Macros auto-estimated on save</span>
                  </div>
                </div>
                
                <div className="grid gap-4">
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs font-bold uppercase tracking-wider text-neutral-500 font-display">Main Protein/Item</Label>
                      <Input
                        placeholder="e.g., Grilled Chicken"
                        value={item.description}
                        onChange={(e) => onChange(idx, "description", e.target.value)}
                        className="bg-[#111111] border-white/[0.08] text-white rounded-sm placeholder:text-neutral-600"
                        data-testid={`input-description-${idx}`}
                      />
                    </div>
                    <div>
                      <Label className="text-xs font-bold uppercase tracking-wider text-neutral-500 font-display">Side 1</Label>
                      <Input
                        placeholder="e.g., Rice"
                        value={item.side1}
                        onChange={(e) => onChange(idx, "side1", e.target.value)}
                        className="bg-[#111111] border-white/[0.08] text-white rounded-sm placeholder:text-neutral-600"
                        data-testid={`input-side1-${idx}`}
                      />
                    </div>
                  </div>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs font-bold uppercase tracking-wider text-neutral-500 font-display">Side 2</Label>
                      <Input
                        placeholder="e.g., Vegetables"
                        value={item.side2}
                        onChange={(e) => onChange(idx, "side2", e.target.value)}
                        className="bg-[#111111] border-white/[0.08] text-white rounded-sm placeholder:text-neutral-600"
                        data-testid={`input-side2-${idx}`}
                      />
                    </div>
                    <div>
                      <Label className="text-xs font-bold uppercase tracking-wider text-neutral-500 font-display">Side 3 / Details</Label>
                      <Input
                        placeholder="e.g., Gravy"
                        value={item.side3}
                        onChange={(e) => onChange(idx, "side3", e.target.value)}
                        className="bg-[#111111] border-white/[0.08] text-white rounded-sm placeholder:text-neutral-600"
                        data-testid={`input-side3-${idx}`}
                      />
                    </div>
                  </div>
                </div>
              </Card>
            ))}
        </TabsContent>
      ))}
    </Tabs>
  );

  return (
    <div className="flex min-h-screen bg-[#0A0A0A]" data-testid="chef-dashboard">
      <Sidebar />
      <div className="flex-1 pl-64 min-h-screen bg-[#0A0A0A]">
        <ScrollArea className="h-screen">
          <div className="p-4 pt-16 md:pt-6 md:p-6">
            <header className="pt-8 pb-6 px-8 border-b border-white/[0.06] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
              <div>
                <h1 className="font-display font-black text-3xl uppercase tracking-wide text-white" data-testid="text-dashboard-title">
                  {isManageMenusView ? "Manage Menus" : "Chef Dashboard"}
                </h1>
                <p className="text-neutral-500 text-sm">{user?.fraternity}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" className="border-white/[0.08] text-neutral-400 hover:text-white hover:border-white/[0.2] rounded-sm font-display font-bold uppercase tracking-wider" onClick={() => setPhoneDialogOpen(true)} data-testid="button-sms-settings">
                  <Phone className="w-4 h-4 mr-1 md:mr-2" /> <span className="hidden xs:inline">SMS</span>
                </Button>
                <Button variant="outline" size="sm" className="border-white/[0.08] text-neutral-400 hover:text-white hover:border-white/[0.2] rounded-sm font-display font-bold uppercase tracking-wider" onClick={() => setProfileDialogOpen(true)} data-testid="button-account-settings">
                  <UserCog className="w-4 h-4 mr-1 md:mr-2" /> <span className="hidden xs:inline">Account</span>
                </Button>
                {isManageMenusView && (
                  <Dialog open={createOpen} onOpenChange={(open) => {
                    setCreateOpen(open);
                    if (open) initializeMenu();
                  }}>
                    <DialogTrigger asChild>
                      <Button className="bg-amber-500 hover:bg-amber-400 text-black font-display font-bold uppercase tracking-wider rounded-sm" data-testid="button-create-menu">
                        <Plus className="w-4 h-4 mr-2" /> Create Menu
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="bg-[#111111] border border-white/[0.1] rounded-sm max-w-4xl max-h-[90vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle className="font-display font-bold uppercase tracking-wide text-white text-xl">Create Weekly Menu</DialogTitle>
                        <DialogDescription className="text-neutral-400">
                          Build the full week in one pass, then send it to admin for approval when it is ready.
                        </DialogDescription>
                      </DialogHeader>
                      
                      <div className="py-4">
                        <div className="mb-6">
                          <Label className="text-xs font-bold uppercase tracking-wider text-neutral-500 font-display">Week Of (Monday)</Label>
                          <Input
                            type="date"
                            value={weekOf}
                            onChange={(e) => setWeekOf(e.target.value)}
                            className="bg-[#111111] border-white/[0.08] text-white rounded-sm placeholder:text-neutral-600 w-full sm:w-64"
                            data-testid="input-week-of"
                          />
                          <p className="text-xs text-neutral-500 mt-2">Choose the Monday for the service week you are planning.</p>
                        </div>

                        <div className="mb-6 rounded-sm border border-white/[0.06] bg-[#161616] p-4">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <div className="text-sm font-medium text-white">Menu progress</div>
                              <div className="text-sm text-neutral-500">
                                {menuDraftProgress.completed} of {totalMealSlots} meal slots filled
                              </div>
                            </div>
                            <Badge variant="outline" className="border-white/[0.08] text-neutral-400 rounded-sm">{menuDraftProgress.remaining} left</Badge>
                          </div>
                        </div>

                        {renderMenuForm(menuItems, handleItemChange)}
                      </div>
                      
                      <DialogFooter>
                        <Button variant="outline" className="border-white/[0.08] text-neutral-400 hover:text-white hover:border-white/[0.2] rounded-sm" onClick={() => setCreateOpen(false)}>Cancel</Button>
                        <Button className="bg-amber-500 hover:bg-amber-400 text-black font-display font-bold uppercase tracking-wider rounded-sm" onClick={handleCreateMenu} disabled={isCreating} data-testid="button-submit-menu">
                          {isCreating ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Creating...</> : <><Send className="w-4 h-4 mr-2" /> Submit for Approval</>}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                )}
              </div>
            </header>

            {!isManageMenusView ? (
              /* DASHBOARD VIEW */
              <div className="space-y-6">
                <Card className="bg-[#111111] border border-white/[0.06] rounded-sm">
                  <CardHeader className="bg-[#0D0D0D] border-b border-white/[0.06] pb-4">
                    <CardTitle className="font-display font-bold uppercase tracking-wide text-white flex items-center gap-2">
                      <ChefHat className="h-5 w-5 text-amber-500" />
                      Daily Workspace
                    </CardTitle>
                    <CardDescription className="text-neutral-500">
                      Start with what needs action now, then clear the inbox.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-5">
                    <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
                      <div className="rounded-sm border border-white/[0.06] bg-[#161616] p-3">
                        <div className="text-[10px] uppercase tracking-widest text-neutral-500 font-display font-semibold">Revision</div>
                        <div className="mt-1 text-2xl font-black text-white">{menusNeedingRevision.length}</div>
                        <div className="text-xs text-neutral-500">menus need edits</div>
                      </div>
                      <div className="rounded-sm border border-white/[0.06] bg-[#161616] p-3">
                        <div className="text-[10px] uppercase tracking-widest text-neutral-500 font-display font-semibold">Submitted</div>
                        <div className="mt-1 text-2xl font-black text-white">{pendingMenus.length}</div>
                        <div className="text-xs text-neutral-500">awaiting admin</div>
                      </div>
                      <div className="rounded-sm border border-white/[0.06] bg-[#161616] p-3">
                        <div className="text-[10px] uppercase tracking-widest text-neutral-500 font-display font-semibold">Tasks</div>
                        <div className="mt-1 text-2xl font-black text-white">{incompleteTasks.length}</div>
                        <div className="text-xs text-neutral-500">open reminders</div>
                      </div>
                      <div className="rounded-sm border border-white/[0.06] bg-[#161616] p-3">
                        <div className="text-[10px] uppercase tracking-widest text-neutral-500 font-display font-semibold">Late Plates</div>
                        <div className="mt-1 text-2xl font-black text-white">{Object.keys(todaysLatePlates).length}</div>
                        <div className="text-xs text-neutral-500">today's services</div>
                      </div>
                      <div className="rounded-sm border border-white/[0.06] bg-[#161616] p-3">
                        <div className="text-[10px] uppercase tracking-widest text-neutral-500 font-display font-semibold">Inbox</div>
                        <div className="mt-1 text-2xl font-black text-white">{totalUnreadInbox}</div>
                        <div className="text-xs text-neutral-500">unread items</div>
                      </div>
                    </div>

                    <div className="flex flex-col gap-3 rounded-sm border border-white/[0.06] bg-[#161616] p-4 md:flex-row md:items-center md:justify-between">
                      <div>
                        <div className="text-sm font-medium text-white">{nextActionSummary.title}</div>
                        <div className="text-sm text-neutral-500">{nextActionSummary.description}</div>
                        {nextActionMenu && (
                          <div className="mt-2 text-xs text-neutral-500">
                            Focus menu: week of {format(parseISO(nextActionMenu.weekOf), "MMMM d, yyyy")}
                          </div>
                        )}
                      </div>
                      <Button className="bg-amber-500 hover:bg-amber-400 text-black font-display font-bold uppercase tracking-wider rounded-sm" onClick={() => setLocation("/chef/menus")} data-testid="button-next-action">
                        {nextActionSummary.cta}
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {/* Current Week's Menu */}
                <Card className="bg-[#111111] border border-white/[0.06] rounded-sm">
                  <CardHeader className="bg-[#0D0D0D] border-b border-white/[0.06]">
                    <CardTitle className="font-display font-bold uppercase tracking-wide text-white flex items-center gap-2">
                      <CalendarIcon className="w-5 h-5" />
                      This Week's Menu
                    </CardTitle>
                    <CardDescription className="text-neutral-500">Week of {format(currentWeekStart, "MMMM d, yyyy")}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {currentWeekMenu ? (
                      <div className="space-y-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge className={getStatusMeta(currentWeekMenu.status).badgeClass}>
                            {getStatusMeta(currentWeekMenu.status).label}
                          </Badge>
                          <Badge variant="outline" className="border-white/[0.08] text-neutral-400 rounded-sm">{getMenuFilledCount(currentWeekMenu.items || [])}/{totalMealSlots} meals planned</Badge>
                          <span className="text-sm text-neutral-500">{getStatusMeta(currentWeekMenu.status).action}</span>
                        </div>
                        {currentWeekMenu.adminNotes && (
                          <div className="rounded-sm border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
                            <div className="mb-1 font-medium text-amber-400">Admin notes</div>
                            <p className="text-amber-400/90">{currentWeekMenu.adminNotes}</p>
                          </div>
                        )}
                        {currentWeekMenu.items && currentWeekMenu.items.length > 0 ? (
                          <div className="grid md:grid-cols-5 gap-4">
                            {DAYS.map(day => {
                              const dayItems = currentWeekMenu.items.filter((item: any) => item.day === day);
                              return (
                                <div key={day} className="border border-white/[0.06] rounded-sm bg-[#161616] p-3">
                                  <div className="font-display font-bold text-sm mb-2 text-white uppercase tracking-wide">{day}</div>
                                  {dayItems.length > 0 ? dayItems.map((item: any) => (
                                    <div key={`${item.day}-${item.meal}`} className="text-sm mb-2 text-neutral-300">
                                      <span className="font-medium text-amber-400">{item.meal}</span>
                                      <div>{item.description}</div>
                                      {(item.side1 || item.side2 || item.side3) && (
                                        <div className="flex flex-wrap gap-1 mt-1">
                                          {item.side1 && <Badge variant="outline" className="text-xs border-white/[0.08] text-neutral-400 rounded-sm">{item.side1}</Badge>}
                                          {item.side2 && <Badge variant="outline" className="text-xs border-white/[0.08] text-neutral-400 rounded-sm">{item.side2}</Badge>}
                                          {item.side3 && <Badge variant="outline" className="text-xs border-white/[0.08] text-neutral-400 rounded-sm">{item.side3}</Badge>}
                                        </div>
                                      )}
                                    </div>
                                  )) : (
                                    <div className="text-xs text-neutral-500">No meals</div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <p className="text-neutral-500">No items in this menu</p>
                        )}
                        <div className="flex flex-wrap gap-2">
                          <Button variant="outline" className="border-white/[0.08] text-neutral-400 hover:text-white hover:border-white/[0.2] rounded-sm font-display font-bold uppercase tracking-wider" onClick={() => setLocation("/chef/menus")}>
                            Manage Menus
                          </Button>
                          {currentWeekMenu.status === "needs_revision" && (
                            <Button className="bg-amber-500 hover:bg-amber-400 text-black font-display font-bold uppercase tracking-wider rounded-sm" onClick={() => setLocation("/chef/menus")}>
                              Fix and Resubmit
                            </Button>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-8 text-neutral-500">
                        <CalendarIcon className="w-12 h-12 mx-auto mb-2 opacity-50" />
                        <p>No menu for this week yet.</p>
                        <p className="text-sm mt-1">Create it once, submit it, and track approval from Manage Menus.</p>
                        <Button className="mt-4 bg-amber-500 hover:bg-amber-400 text-black font-display font-bold uppercase tracking-wider rounded-sm" onClick={() => setLocation('/chef/menus')}>
                          Create Menu
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Tasks & Reminders */}
                <Card className="bg-[#111111] border border-white/[0.06] rounded-sm">
                  <CardHeader className="bg-[#0D0D0D] border-b border-white/[0.06]">
                    <CardTitle className="font-display font-bold uppercase tracking-wide text-white flex items-center gap-2">
                      <ListTodo className="w-5 h-5" />
                      Tasks & Reminders
                    </CardTitle>
                    <CardDescription className="text-neutral-500">Tasks assigned by the administrator</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {isLoadingTasks ? (
                      <div className="flex justify-center py-4">
                        <Loader2 className="w-6 h-6 animate-spin" />
                      </div>
                    ) : incompleteTasks.length === 0 && completedTasks.length === 0 ? (
                      <div className="text-center py-8 text-neutral-500">
                        <CheckSquare className="w-12 h-12 mx-auto mb-2 opacity-50" />
                        <p>No tasks assigned</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {sortedIncompleteTasks.length > 0 && (
                          <div>
                            <h4 className="font-display font-bold uppercase tracking-wide text-white mb-2">To Do</h4>
                            <div className="space-y-2">
                              {sortedIncompleteTasks.map((task: any) => (
                                <div key={task.id} className="flex items-start gap-3 p-3 border border-white/[0.06] rounded-sm bg-[#161616]" data-testid={`task-${task.id}`}>
                                  <Checkbox
                                    checked={task.isCompleted}
                                    onCheckedChange={(checked) => handleTaskComplete(task.id, checked as boolean)}
                                    data-testid={`checkbox-task-${task.id}`}
                                  />
                                  <div className="flex-1">
                                    <div className="font-medium text-white">{task.title}</div>
                                    {task.description && <p className="text-sm text-neutral-500">{task.description}</p>}
                                    <div className="flex flex-wrap gap-2 mt-1">
                                      <Badge className={`rounded-sm uppercase text-[10px] tracking-wider font-bold ${task.priority === 'high' ? 'bg-red-500/10 text-red-400 border border-red-500/20' : task.priority === 'medium' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'bg-neutral-500/10 text-neutral-400 border border-neutral-500/20'}`}>
                                        {task.priority} priority
                                      </Badge>
                                      {task.dueDate && (
                                        <Badge variant="outline" className="text-xs border-white/[0.08] text-neutral-400 rounded-sm">
                                          Due: {format(parseISO(task.dueDate), "MMM d")}
                                        </Badge>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        
                        {completedTasks.length > 0 && (
                          <Collapsible>
                            <CollapsibleTrigger className="flex items-center gap-2 text-sm text-neutral-500 hover:text-white font-display font-bold uppercase tracking-wide">
                              <ChevronRight className="w-4 h-4" />
                              {completedTasks.length} completed task{completedTasks.length !== 1 ? 's' : ''}
                            </CollapsibleTrigger>
                            <CollapsibleContent className="mt-2 space-y-2">
                              {completedTasks.map((task: any) => (
                                <div key={task.id} className="flex items-start gap-3 p-3 border border-white/[0.06] rounded-sm bg-[#161616] opacity-60" data-testid={`task-completed-${task.id}`}>
                                  <Checkbox
                                    checked={task.isCompleted}
                                    onCheckedChange={(checked) => handleTaskComplete(task.id, checked as boolean)}
                                  />
                                  <div className="flex-1">
                                    <div className="font-medium line-through text-neutral-500">{task.title}</div>
                                  </div>
                                </div>
                              ))}
                            </CollapsibleContent>
                          </Collapsible>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Inbox Sections */}
                <div className="grid md:grid-cols-2 gap-4">
                  {/* Late Plates */}
                  <Collapsible open={latePlatesOpen} onOpenChange={setLatePlatesOpen}>
                    <Card className="bg-[#111111] border border-white/[0.06] rounded-sm">
                      <CollapsibleTrigger asChild>
                        <CardHeader className="cursor-pointer hover:bg-white/[0.03] bg-[#0D0D0D] border-b border-white/[0.06]">
                          <CardTitle className="font-display font-bold uppercase tracking-wide text-white flex items-center justify-between">
                            <span className="flex items-center gap-2">
                              <Clock className="w-5 h-5" />
                              Late Plates
                              {latePlates && latePlates.length > 0 && (
                                <Badge className="bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-sm font-bold">{latePlates.length}</Badge>
                              )}
                            </span>
                            {latePlatesOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                          </CardTitle>
                        </CardHeader>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <CardContent>
                          {isLoadingLatePlates ? (
                            <div className="flex justify-center py-4">
                              <Loader2 className="w-6 h-6 animate-spin" />
                            </div>
                          ) : !latePlates || latePlates.length === 0 ? (
                            <p className="text-neutral-500 text-sm">No late plate requests</p>
                          ) : (
                            <div className="space-y-3 max-h-64 overflow-y-auto">
                              {Object.entries(latePlatesByMealService).map(([key, plates]) => {
                                const [dateStr, mealType] = key.split("|");
                                const isTodays = isSameDay(parseISO(dateStr), new Date());
                                return (
                                  <div key={key} className={`p-3 rounded-sm ${isTodays ? 'bg-amber-500/10 border border-amber-500/20' : 'bg-white/[0.03]'}`}>
                                    <div className="font-medium text-sm mb-2 flex flex-wrap items-center gap-2 text-white">
                                      {format(parseISO(dateStr), "EEEE, MMM d")} - {mealType}
                                      {isTodays && <Badge className="ml-2 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-sm font-bold">Today</Badge>}
                                      <Badge variant="outline" className="border-white/[0.08] text-neutral-400 rounded-sm">{plates.length} request{plates.length === 1 ? "" : "s"}</Badge>
                                    </div>
                                    <div className="space-y-1">
                                      {plates.map((plate: any) => (
                                        <div key={plate.id} className="flex items-center gap-2 text-sm text-neutral-300">
                                          <User className="w-3 h-3" />
                                          <span>{plate.userName || plate.userEmail}</span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                          <p className="mt-3 text-xs text-neutral-500">
                            Late plates are grouped by service so you can prep each pickup window quickly.
                          </p>
                        </CardContent>
                      </CollapsibleContent>
                    </Card>
                  </Collapsible>

                  {/* Substitutions */}
                  <Collapsible open={substitutionsOpen} onOpenChange={setSubstitutionsOpen}>
                    <Card className="bg-[#111111] border border-white/[0.06] rounded-sm">
                      <CollapsibleTrigger asChild>
                        <CardHeader className="cursor-pointer hover:bg-white/[0.03] bg-[#0D0D0D] border-b border-white/[0.06]">
                          <CardTitle className="font-display font-bold uppercase tracking-wide text-white flex items-center justify-between">
                            <span className="flex items-center gap-2">
                              <RefreshCcw className="w-5 h-5" />
                              Substitutions
                              {unreadSubstitutions > 0 && <Badge className="bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-sm font-bold">{unreadSubstitutions}</Badge>}
                              {substitutions.length > 0 && unreadSubstitutions === 0 && <Badge variant="outline" className="border-white/[0.08] text-neutral-400 rounded-sm">{substitutions.length}</Badge>}
                            </span>
                            {substitutionsOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                          </CardTitle>
                        </CardHeader>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <CardContent>
                          {isLoadingChefRequests ? (
                            <div className="flex justify-center py-4">
                              <Loader2 className="w-6 h-6 animate-spin" />
                            </div>
                          ) : substitutions.length === 0 ? (
                            <p className="text-neutral-500 text-sm">No substitution requests</p>
                          ) : (
                            <div className="space-y-2 max-h-64 overflow-y-auto">
                              {sortedSubstitutions.map((req: any) => (
                                <div key={req.id} className={`p-3 rounded-sm ${req.isRead ? 'bg-white/[0.03] opacity-60' : 'bg-[#161616]'}`} data-testid={`substitution-item-${req.id}`}>
                                  <div className="flex items-start gap-3">
                                    <Checkbox
                                      checked={req.isRead || false}
                                      onCheckedChange={(checked) => markRequestRead({ id: req.id, isRead: !!checked })}
                                      data-testid={`checkbox-substitution-${req.id}`}
                                    />
                                    <div className="flex-1">
                                      <div className="flex items-center gap-2 mb-1">
                                        <span className="font-medium text-sm text-white">{req.userName || req.userEmail}</span>
                                        {req.status && req.status !== 'pending' && (
                                          <Badge className={`rounded-sm uppercase text-[10px] tracking-wider font-bold ${req.status === 'approved' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
                                            {req.status}
                                          </Badge>
                                        )}
                                      </div>
                                      <p className="text-sm text-neutral-500">{req.details}</p>
                                      {(req.mealDay || req.mealType) && (
                                        <p className="mt-1 text-xs text-neutral-500">
                                          {req.mealDay || "Meal date not provided"} {req.mealType || ""}
                                        </p>
                                      )}
                                      {req.status === 'pending' && (
                                        <div className="flex gap-2 mt-2">
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            className="text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10 font-display font-bold uppercase tracking-wider rounded-sm"
                                            onClick={() => {
                                              updateRequestStatus({ id: req.id, status: 'approved' });
                                              if (notificationsEnabled) {
                                                notifySubstitutionDecision(true, `${req.mealDay} ${req.mealType}`);
                                              }
                                            }}
                                            disabled={isUpdatingRequestStatus}
                                            data-testid={`button-approve-substitution-${req.id}`}
                                          >
                                            <CheckCircle className="w-4 h-4 mr-1" /> Approve
                                          </Button>
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            className="text-red-400 border-red-500/30 hover:bg-red-500/10 font-display font-bold uppercase tracking-wider rounded-sm"
                                            onClick={() => {
                                              updateRequestStatus({ id: req.id, status: 'rejected' });
                                              if (notificationsEnabled) {
                                                notifySubstitutionDecision(false, `${req.mealDay} ${req.mealType}`);
                                              }
                                            }}
                                            disabled={isUpdatingRequestStatus}
                                            data-testid={`button-reject-substitution-${req.id}`}
                                          >
                                            <XCircle className="w-4 h-4 mr-1" /> Reject
                                          </Button>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </CardContent>
                      </CollapsibleContent>
                    </Card>
                  </Collapsible>

                  {/* Menu Suggestions */}
                  <Collapsible open={suggestionsOpen} onOpenChange={setSuggestionsOpen}>
                    <Card className="bg-[#111111] border border-white/[0.06] rounded-sm">
                      <CollapsibleTrigger asChild>
                        <CardHeader className="cursor-pointer hover:bg-white/[0.03] bg-[#0D0D0D] border-b border-white/[0.06]">
                          <CardTitle className="font-display font-bold uppercase tracking-wide text-white flex items-center justify-between">
                            <span className="flex items-center gap-2">
                              <Lightbulb className="w-5 h-5" />
                              Meal Suggestions
                              {unreadSuggestions > 0 && <Badge className="bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-sm font-bold">{unreadSuggestions}</Badge>}
                              {menuSuggestions.length > 0 && unreadSuggestions === 0 && <Badge variant="outline" className="border-white/[0.08] text-neutral-400 rounded-sm">{menuSuggestions.length}</Badge>}
                            </span>
                            {suggestionsOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                          </CardTitle>
                        </CardHeader>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <CardContent>
                          {isLoadingChefRequests ? (
                            <div className="flex justify-center py-4">
                              <Loader2 className="w-6 h-6 animate-spin" />
                            </div>
                          ) : menuSuggestions.length === 0 ? (
                            <p className="text-neutral-500 text-sm">No menu suggestions</p>
                          ) : (
                            <div className="space-y-2 max-h-64 overflow-y-auto">
                              {sortedSuggestions.map((req: any) => (
                                <div key={req.id} className={`p-3 rounded-sm flex items-start gap-3 ${req.isRead ? 'bg-white/[0.03] opacity-60' : 'bg-[#161616]'}`} data-testid={`suggestion-item-${req.id}`}>
                                  <Checkbox
                                    checked={req.isRead || false}
                                    onCheckedChange={(checked) => markRequestRead({ id: req.id, isRead: !!checked })}
                                    data-testid={`checkbox-suggestion-${req.id}`}
                                  />
                                  <div className="flex-1">
                                    <div className="font-medium text-sm text-white">{req.userName || req.userEmail}</div>
                                    <p className="text-sm text-neutral-500">{req.details}</p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </CardContent>
                      </CollapsibleContent>
                    </Card>
                  </Collapsible>

                  {/* Feedback */}
                  <Collapsible open={feedbackOpen} onOpenChange={setFeedbackOpen}>
                    <Card className="bg-[#111111] border border-white/[0.06] rounded-sm">
                      <CollapsibleTrigger asChild>
                        <CardHeader className="cursor-pointer hover:bg-white/[0.03] bg-[#0D0D0D] border-b border-white/[0.06]">
                          <CardTitle className="font-display font-bold uppercase tracking-wide text-white flex items-center justify-between">
                            <span className="flex items-center gap-2">
                              <MessageSquare className="w-5 h-5" />
                              Feedback
                              {unreadFeedback > 0 && <Badge className="bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-sm font-bold">{unreadFeedback}</Badge>}
                              {chefFeedback && chefFeedback.length > 0 && unreadFeedback === 0 && <Badge variant="outline" className="border-white/[0.08] text-neutral-400 rounded-sm">{chefFeedback.length}</Badge>}
                            </span>
                            {feedbackOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                          </CardTitle>
                        </CardHeader>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <CardContent>
                          {isLoadingFeedback ? (
                            <div className="flex justify-center py-4">
                              <Loader2 className="w-6 h-6 animate-spin" />
                            </div>
                          ) : !chefFeedback || chefFeedback.length === 0 ? (
                            <p className="text-neutral-500 text-sm">No feedback yet</p>
                          ) : (
                            <div className="space-y-2 max-h-64 overflow-y-auto">
                              {sortedFeedback.map((fb: any) => (
                                <div key={fb.id} className={`p-3 rounded-sm flex items-start gap-3 ${fb.isRead ? 'bg-white/[0.03] opacity-60' : 'bg-[#161616]'}`} data-testid={`feedback-item-${fb.id}`}>
                                  <Checkbox
                                    checked={fb.isRead || false}
                                    onCheckedChange={(checked) => markFeedbackRead({ id: fb.id, isRead: !!checked })}
                                    data-testid={`checkbox-feedback-${fb.id}`}
                                  />
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                      <div className="flex">
                                        {[1, 2, 3, 4, 5].map((star) => (
                                          <Star key={star} className={`w-3 h-3 ${star <= fb.rating ? 'text-amber-400 fill-amber-400' : 'text-neutral-700'}`} />
                                        ))}
                                      </div>
                                      <span className="text-xs text-neutral-500">{fb.mealDay} {fb.mealType}</span>
                                    </div>
                                    {fb.comment && <p className="text-sm text-neutral-300">{fb.comment}</p>}
                                    <div className="text-xs text-neutral-500 mt-1">
                                      {fb.userName || "Anonymous"}
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                          <p className="mt-3 text-xs text-neutral-500">
                            Member identity is hidden from chefs. Only admins can view who submitted feedback.
                          </p>
                        </CardContent>
                      </CollapsibleContent>
                    </Card>
                  </Collapsible>
                </div>
              </div>
            ) : (
              /* MANAGE MENUS VIEW */
              <div className="space-y-6">
                {/* Menus Needing Revision */}
                {menusNeedingRevision.length > 0 && (
                  <div>
                    <h2 className="font-display font-bold uppercase tracking-wide text-amber-400 flex items-center gap-2 mb-3 text-lg">
                      <AlertCircle className="w-5 h-5" />
                      Needs Revision ({menusNeedingRevision.length})
                    </h2>
                    <p className="mb-3 text-sm text-neutral-500">
                      Fix these first. Admin notes are shown inside each menu card.
                    </p>
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {menusNeedingRevision.map((menu: any) => renderMenuCard(menu, true))}
                    </div>
                  </div>
                )}

                {/* Current Week */}
                <div>
                  <h2 className="font-display font-bold uppercase tracking-wide text-white mb-3 text-lg">Current Week</h2>
                  {currentWeekMenu ? (
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {renderMenuCard(currentWeekMenu, true)}
                    </div>
                  ) : (
                    <Card className="bg-[#111111] border border-white/[0.06] rounded-sm">
                      <CardContent className="py-8 text-center text-neutral-500">
                        No menu for this week. Click "Create Menu" to get started.
                      </CardContent>
                    </Card>
                  )}
                </div>

                {/* Future Menus */}
                {futureMenus.length > 0 && (
                  <div>
                    <h2 className="font-display font-bold uppercase tracking-wide text-white mb-3 text-lg">Upcoming Menus</h2>
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {futureMenus.map((menu: any) => renderMenuCard(menu, true))}
                    </div>
                  </div>
                )}

                {/* Past Menus */}
                {pastMenus.length > 0 && (
                  <div>
                    <h2 className="font-display font-bold uppercase tracking-wide text-white mb-3 text-lg">Past Menus</h2>
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {pastMenus.map((menu: any) => renderMenuCard(menu, false))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Edit Menu Dialog */}
      <Dialog open={!!editMenu} onOpenChange={(open) => { if (!open) setEditMenu(null); }}>
        <DialogContent className="bg-[#111111] border border-white/[0.1] rounded-sm max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display font-bold uppercase tracking-wide text-white text-xl">Edit Menu</DialogTitle>
            <DialogDescription className="text-neutral-400">
              Update menu items and resubmit for approval.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <div className="mb-6">
              <Label className="text-xs font-bold uppercase tracking-wider text-neutral-500 font-display">Week Of (Monday)</Label>
              <Input
                type="date"
                value={editWeekOf}
                onChange={(e) => setEditWeekOf(e.target.value)}
                className="bg-[#111111] border-white/[0.08] text-white rounded-sm placeholder:text-neutral-600 w-full sm:w-64"
                data-testid="input-edit-week-of"
              />
            </div>

            <div className="mb-6 rounded-sm border border-white/[0.06] bg-[#161616] p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-medium text-white">Edit progress</div>
                  <div className="text-sm text-neutral-500">
                    {editMenuProgress.completed} of {totalMealSlots} meal slots filled
                  </div>
                </div>
                <Badge variant="outline" className="border-white/[0.08] text-neutral-400 rounded-sm">{editMenuProgress.remaining} left</Badge>
              </div>
              {editMenu?.adminNotes && (
                <div className="mt-3 rounded-sm border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
                  <div className="mb-1 flex items-center gap-2 font-medium text-amber-400">
                    <ClipboardCheck className="h-4 w-4" />
                    Admin notes to resolve
                  </div>
                  <p className="text-amber-400/90">{editMenu.adminNotes}</p>
                </div>
              )}
            </div>

            {renderMenuForm(editMenuItems, handleEditItemChange)}
          </div>

          <DialogFooter>
            <Button variant="outline" className="border-white/[0.08] text-neutral-400 hover:text-white hover:border-white/[0.2] rounded-sm" onClick={() => setEditMenu(null)}>Cancel</Button>
            <Button className="bg-amber-500 hover:bg-amber-400 text-black font-display font-bold uppercase tracking-wider rounded-sm" onClick={handleSaveEdit} disabled={isUpdatingMenu} data-testid="button-save-edit">
              {isUpdatingMenu ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...</> : <><Send className="w-4 h-4 mr-2" /> Save & Resubmit</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Phone Dialog */}
      <Dialog open={phoneDialogOpen} onOpenChange={setPhoneDialogOpen}>
        <DialogContent className="bg-[#111111] border border-white/[0.1] rounded-sm">
          <DialogHeader>
            <DialogTitle className="font-display font-bold uppercase tracking-wide text-white text-xl">SMS Settings</DialogTitle>
            <DialogDescription className="text-neutral-400">
              Enter your phone number to receive late plate SMS notifications at cutoff times (12:45 PM for lunch, 5:45 PM for dinner).
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label className="text-xs font-bold uppercase tracking-wider text-neutral-500 font-display">Phone Number</Label>
            <Input
              type="tel"
              placeholder="+1 (555) 123-4567"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              className="bg-[#111111] border-white/[0.08] text-white rounded-sm placeholder:text-neutral-600"
              data-testid="input-phone-number"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" className="border-white/[0.08] text-neutral-400 hover:text-white hover:border-white/[0.2] rounded-sm" onClick={() => setPhoneDialogOpen(false)}>Cancel</Button>
            <Button className="bg-amber-500 hover:bg-amber-400 text-black font-display font-bold uppercase tracking-wider rounded-sm" onClick={() => updatePhoneMutation.mutate(phoneNumber)} disabled={updatePhoneMutation.isPending} data-testid="button-save-phone">
              {updatePhoneMutation.isPending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Profile Dialog */}
      <Dialog open={profileDialogOpen} onOpenChange={setProfileDialogOpen}>
        <DialogContent className="bg-[#111111] border border-white/[0.1] rounded-sm">
          <DialogHeader>
            <DialogTitle className="font-display font-bold uppercase tracking-wide text-white text-xl">Account Settings</DialogTitle>
            <DialogDescription className="text-neutral-400">
              Update your profile information and password.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div>
              <Label className="text-xs font-bold uppercase tracking-wider text-neutral-500 font-display">Name</Label>
              <Input
                value={profileName}
                onChange={(e) => setProfileName(e.target.value)}
                className="bg-[#111111] border-white/[0.08] text-white rounded-sm placeholder:text-neutral-600"
                data-testid="input-profile-name"
              />
            </div>
            <div>
              <Label className="text-xs font-bold uppercase tracking-wider text-neutral-500 font-display">Email</Label>
              <Input
                type="email"
                value={profileEmail}
                onChange={(e) => setProfileEmail(e.target.value)}
                className="bg-[#111111] border-white/[0.08] text-white rounded-sm placeholder:text-neutral-600"
                data-testid="input-profile-email"
              />
            </div>
            <div className="border-t border-white/[0.06] pt-4">
              <h4 className="font-display font-bold uppercase tracking-wide text-white mb-2">Change Password</h4>
              <div className="space-y-2">
                <div>
                  <Label className="text-xs font-bold uppercase tracking-wider text-neutral-500 font-display">Current Password</Label>
                  <Input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="bg-[#111111] border-white/[0.08] text-white rounded-sm placeholder:text-neutral-600"
                    data-testid="input-current-password"
                  />
                </div>
                <div>
                  <Label className="text-xs font-bold uppercase tracking-wider text-neutral-500 font-display">New Password</Label>
                  <Input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="bg-[#111111] border-white/[0.08] text-white rounded-sm placeholder:text-neutral-600"
                    data-testid="input-new-password"
                  />
                </div>
                <div>
                  <Label className="text-xs font-bold uppercase tracking-wider text-neutral-500 font-display">Confirm New Password</Label>
                  <Input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="bg-[#111111] border-white/[0.08] text-white rounded-sm placeholder:text-neutral-600"
                    data-testid="input-confirm-password"
                  />
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="border-white/[0.08] text-neutral-400 hover:text-white hover:border-white/[0.2] rounded-sm" onClick={() => setProfileDialogOpen(false)}>Cancel</Button>
            <Button className="bg-amber-500 hover:bg-amber-400 text-black font-display font-bold uppercase tracking-wider rounded-sm" onClick={handleProfileUpdate} disabled={updateProfileMutation.isPending} data-testid="button-save-profile">
              {updateProfileMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
