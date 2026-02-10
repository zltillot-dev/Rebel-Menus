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
import { Plus, Calendar as CalendarIcon, FileEdit, AlertCircle, Send, Pencil, Trash2, Sparkles, Loader2, Clock, User, Phone, Settings, UserCog, RefreshCcw, Lightbulb, MessageSquare, Star, ChefHat, ChevronDown, ChevronRight, CheckSquare, ListTodo, CheckCircle, XCircle, ClipboardList, FileDown } from "lucide-react";
import { exportMenuToPDF } from "@/lib/pdf-export";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { format, startOfWeek, addWeeks, parseISO, isSameDay, isToday, isBefore, isAfter } from "date-fns";
import { DAYS, MEAL_TYPES } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { ScrollArea } from "@/components/ui/scroll-area";

export default function ChefDashboard() {
  const [location] = useLocation();
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
  const { mutate: deleteMenu, isPending: isDeleting } = useDeleteMenu();
  
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
  const [critiquesOpen, setCritiquesOpen] = useState(false);
  
  const { data: critiques, isLoading: isLoadingCritiques } = useQuery<any[]>({
    queryKey: ['/api/critiques'],
    enabled: !!user,
  });
  
  const acknowledgeCritiqueMutation = useMutation({
    mutationFn: async (critiqueId: number) => {
      const res = await fetch(`/api/critiques/${critiqueId}/acknowledge-chef`, {
        method: 'PATCH',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to acknowledge critique');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/critiques'] });
      toast({ title: "Acknowledged", description: "Critique has been acknowledged." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to acknowledge critique", variant: "destructive" });
    },
  });
  
  const unacknowledgedCritiques = critiques?.filter((c: any) => !c.acknowledgedByChef) || [];
  const acknowledgedCritiques = critiques?.filter((c: any) => c.acknowledgedByChef) || [];

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

  const incompleteTasks = chefTasks?.filter((t: any) => !t.isCompleted) || [];
  const completedTasks = chefTasks?.filter((t: any) => t.isCompleted) || [];

  const renderMenuCard = (menu: any, showActions = false) => {
    const statusColors: Record<string, string> = {
      approved: "bg-green-100 text-green-800",
      pending: "bg-yellow-100 text-yellow-800",
      needs_revision: "bg-red-100 text-red-800",
      draft: "bg-gray-100 text-gray-800",
    };

    return (
      <Card key={menu.id} className={menu.status === 'needs_revision' ? "border-amber-300 bg-amber-50/50" : ""}>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <CardTitle className="text-lg">Week of {format(parseISO(menu.weekOf), "MMM d, yyyy")}</CardTitle>
              <div className="flex items-center gap-2 mt-1">
                <Badge className={statusColors[menu.status] || ""}>{menu.status}</Badge>
                <Button 
                  size="sm" 
                  variant="ghost"
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
            </div>
            {showActions && (menu.status === 'pending' || menu.status === 'needs_revision') && (
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => handleStartEdit(menu)} data-testid={`button-edit-menu-${menu.id}`}>
                  <Pencil className="w-4 h-4 mr-1" /> Edit
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button size="sm" variant="destructive" data-testid={`button-delete-menu-${menu.id}`}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete Menu?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will permanently delete this menu and all its items. This cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={() => handleDelete(menu.id)}>Delete</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            )}
          </div>
          {menu.adminNotes && (
            <div className="mt-2 p-2 bg-amber-100 rounded-md text-sm">
              <strong>Admin Notes:</strong> {menu.adminNotes}
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
                  <div key={day} className="border-b pb-2 last:border-b-0">
                    <div className="font-medium text-sm text-muted-foreground">{day}</div>
                    {dayItems.map((item: any) => (
                      <div key={`${item.day}-${item.meal}`} className="ml-2 text-sm">
                        <span className="font-medium">{item.meal}:</span> {item.description}
                        {(item.side1 || item.side2 || item.side3) && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {item.side1 && <Badge variant="outline" className="text-xs">{item.side1}</Badge>}
                            {item.side2 && <Badge variant="outline" className="text-xs">{item.side2}</Badge>}
                            {item.side3 && <Badge variant="outline" className="text-xs">{item.side3}</Badge>}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">No items in this menu</p>
          )}
        </CardContent>
      </Card>
    );
  };

  const renderMenuForm = (items: any[], onChange: (idx: number, field: string, value: any) => void) => (
    <Tabs defaultValue="Monday" className="w-full">
      <TabsList className="grid grid-cols-5 mb-6">
        {DAYS.map(day => (
          <TabsTrigger key={day} value={day} data-testid={`tab-day-${day}`}>{day}</TabsTrigger>
        ))}
      </TabsList>
      
      {DAYS.map(day => (
        <TabsContent key={day} value={day} className="space-y-6">
          {items
            .map((item, idx) => ({ item, idx }))
            .filter(({ item }) => item.day === day)
            .map(({ item, idx }) => (
              <Card key={idx} className="p-4">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-semibold text-lg">{item.meal}</h4>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Sparkles className="w-3 h-3" />
                    <span>Macros auto-estimated on save</span>
                  </div>
                </div>
                
                <div className="grid gap-4">
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <Label>Main Protein/Item</Label>
                      <Input
                        placeholder="e.g., Grilled Chicken"
                        value={item.description}
                        onChange={(e) => onChange(idx, "description", e.target.value)}
                        data-testid={`input-description-${idx}`}
                      />
                    </div>
                    <div>
                      <Label>Side 1</Label>
                      <Input
                        placeholder="e.g., Rice"
                        value={item.side1}
                        onChange={(e) => onChange(idx, "side1", e.target.value)}
                        data-testid={`input-side1-${idx}`}
                      />
                    </div>
                  </div>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <Label>Side 2</Label>
                      <Input
                        placeholder="e.g., Vegetables"
                        value={item.side2}
                        onChange={(e) => onChange(idx, "side2", e.target.value)}
                        data-testid={`input-side2-${idx}`}
                      />
                    </div>
                    <div>
                      <Label>Side 3 / Details</Label>
                      <Input
                        placeholder="e.g., Gravy"
                        value={item.side3}
                        onChange={(e) => onChange(idx, "side3", e.target.value)}
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
    <div className="flex min-h-screen bg-background" data-testid="chef-dashboard">
      <Sidebar />
      <div className="flex-1 md:ml-64">
        <ScrollArea className="h-screen">
          <div className="p-4 pt-16 md:pt-6 md:p-6">
            <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
              <div>
                <h1 className="text-xl md:text-2xl font-bold" data-testid="text-dashboard-title">
                  {isManageMenusView ? "Manage Menus" : "Chef Dashboard"}
                </h1>
                <p className="text-muted-foreground text-sm">{user?.fraternity}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => setPhoneDialogOpen(true)} data-testid="button-sms-settings">
                  <Phone className="w-4 h-4 mr-1 md:mr-2" /> <span className="hidden xs:inline">SMS</span>
                </Button>
                <Button variant="outline" size="sm" onClick={() => setProfileDialogOpen(true)} data-testid="button-account-settings">
                  <UserCog className="w-4 h-4 mr-1 md:mr-2" /> <span className="hidden xs:inline">Account</span>
                </Button>
                {isManageMenusView && (
                  <Dialog open={createOpen} onOpenChange={(open) => {
                    setCreateOpen(open);
                    if (open) initializeMenu();
                  }}>
                    <DialogTrigger asChild>
                      <Button data-testid="button-create-menu">
                        <Plus className="w-4 h-4 mr-2" /> Create Menu
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle>Create Weekly Menu</DialogTitle>
                        <DialogDescription>
                          Enter meals for the week. Each meal includes a main protein/item plus optional sides.
                        </DialogDescription>
                      </DialogHeader>
                      
                      <div className="py-4">
                        <div className="mb-6">
                          <Label>Week Of (Monday)</Label>
                          <Input 
                            type="date" 
                            value={weekOf} 
                            onChange={(e) => setWeekOf(e.target.value)} 
                            className="w-full sm:w-64"
                            data-testid="input-week-of"
                          />
                        </div>

                        {renderMenuForm(menuItems, handleItemChange)}
                      </div>
                      
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
                        <Button onClick={handleCreateMenu} disabled={isCreating} data-testid="button-submit-menu">
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
                {/* Current Week's Menu */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <CalendarIcon className="w-5 h-5" />
                      This Week's Menu
                    </CardTitle>
                    <CardDescription>Week of {format(currentWeekStart, "MMMM d, yyyy")}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {currentWeekMenu ? (
                      <div className="space-y-4">
                        <div className="flex items-center gap-2">
                          <Badge className={currentWeekMenu.status === 'approved' ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"}>
                            {currentWeekMenu.status}
                          </Badge>
                        </div>
                        {currentWeekMenu.items && currentWeekMenu.items.length > 0 ? (
                          <div className="grid md:grid-cols-5 gap-4">
                            {DAYS.map(day => {
                              const dayItems = currentWeekMenu.items.filter((item: any) => item.day === day);
                              return (
                                <div key={day} className="border rounded-lg p-3">
                                  <div className="font-semibold text-sm mb-2">{day}</div>
                                  {dayItems.length > 0 ? dayItems.map((item: any) => (
                                    <div key={`${item.day}-${item.meal}`} className="text-sm mb-2">
                                      <span className="font-medium text-primary">{item.meal}</span>
                                      <div>{item.description}</div>
                                      {(item.side1 || item.side2 || item.side3) && (
                                        <div className="flex flex-wrap gap-1 mt-1">
                                          {item.side1 && <Badge variant="outline" className="text-xs">{item.side1}</Badge>}
                                          {item.side2 && <Badge variant="outline" className="text-xs">{item.side2}</Badge>}
                                          {item.side3 && <Badge variant="outline" className="text-xs">{item.side3}</Badge>}
                                        </div>
                                      )}
                                    </div>
                                  )) : (
                                    <div className="text-xs text-muted-foreground">No meals</div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <p className="text-muted-foreground">No items in this menu</p>
                        )}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">
                        <CalendarIcon className="w-12 h-12 mx-auto mb-2 opacity-50" />
                        <p>No menu for this week yet.</p>
                        <Button className="mt-4" onClick={() => window.location.href = '/chef/menus'}>
                          Create Menu
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Tasks & Reminders */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <ListTodo className="w-5 h-5" />
                      Tasks & Reminders
                    </CardTitle>
                    <CardDescription>Tasks assigned by the administrator</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {isLoadingTasks ? (
                      <div className="flex justify-center py-4">
                        <Loader2 className="w-6 h-6 animate-spin" />
                      </div>
                    ) : incompleteTasks.length === 0 && completedTasks.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <CheckSquare className="w-12 h-12 mx-auto mb-2 opacity-50" />
                        <p>No tasks assigned</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {incompleteTasks.length > 0 && (
                          <div>
                            <h4 className="font-medium mb-2">To Do</h4>
                            <div className="space-y-2">
                              {incompleteTasks.map((task: any) => (
                                <div key={task.id} className="flex items-start gap-3 p-3 border rounded-lg" data-testid={`task-${task.id}`}>
                                  <Checkbox
                                    checked={task.isCompleted}
                                    onCheckedChange={(checked) => handleTaskComplete(task.id, checked as boolean)}
                                    data-testid={`checkbox-task-${task.id}`}
                                  />
                                  <div className="flex-1">
                                    <div className="font-medium">{task.title}</div>
                                    {task.description && <p className="text-sm text-muted-foreground">{task.description}</p>}
                                    <div className="flex gap-2 mt-1">
                                      <Badge variant={task.priority === 'high' ? 'destructive' : task.priority === 'medium' ? 'default' : 'secondary'} className="text-xs">
                                        {task.priority}
                                      </Badge>
                                      {task.dueDate && (
                                        <Badge variant="outline" className="text-xs">
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
                            <CollapsibleTrigger className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
                              <ChevronRight className="w-4 h-4" />
                              {completedTasks.length} completed task{completedTasks.length !== 1 ? 's' : ''}
                            </CollapsibleTrigger>
                            <CollapsibleContent className="mt-2 space-y-2">
                              {completedTasks.map((task: any) => (
                                <div key={task.id} className="flex items-start gap-3 p-3 border rounded-lg opacity-60" data-testid={`task-completed-${task.id}`}>
                                  <Checkbox
                                    checked={task.isCompleted}
                                    onCheckedChange={(checked) => handleTaskComplete(task.id, checked as boolean)}
                                  />
                                  <div className="flex-1">
                                    <div className="font-medium line-through">{task.title}</div>
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
                    <Card>
                      <CollapsibleTrigger asChild>
                        <CardHeader className="cursor-pointer hover:bg-muted/50">
                          <CardTitle className="flex items-center justify-between">
                            <span className="flex items-center gap-2">
                              <Clock className="w-5 h-5" />
                              Late Plates
                              {latePlates && latePlates.length > 0 && (
                                <Badge>{latePlates.length}</Badge>
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
                            <p className="text-muted-foreground text-sm">No late plate requests</p>
                          ) : (
                            <div className="space-y-3 max-h-64 overflow-y-auto">
                              {Object.entries(latePlatesByMealService).map(([key, plates]) => {
                                const [dateStr, mealType] = key.split("|");
                                const isTodays = isSameDay(parseISO(dateStr), new Date());
                                return (
                                  <div key={key} className={`p-3 rounded-lg ${isTodays ? 'bg-primary/10 border border-primary/20' : 'bg-muted/50'}`}>
                                    <div className="font-medium text-sm mb-2">
                                      {format(parseISO(dateStr), "EEEE, MMM d")} - {mealType}
                                      {isTodays && <Badge className="ml-2" variant="default">Today</Badge>}
                                    </div>
                                    <div className="space-y-1">
                                      {plates.map((plate: any) => (
                                        <div key={plate.id} className="flex items-center gap-2 text-sm">
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
                        </CardContent>
                      </CollapsibleContent>
                    </Card>
                  </Collapsible>

                  {/* Substitutions */}
                  <Collapsible open={substitutionsOpen} onOpenChange={setSubstitutionsOpen}>
                    <Card>
                      <CollapsibleTrigger asChild>
                        <CardHeader className="cursor-pointer hover:bg-muted/50">
                          <CardTitle className="flex items-center justify-between">
                            <span className="flex items-center gap-2">
                              <RefreshCcw className="w-5 h-5" />
                              Substitutions
                              {unreadSubstitutions > 0 && <Badge>{unreadSubstitutions}</Badge>}
                              {substitutions.length > 0 && unreadSubstitutions === 0 && <Badge variant="outline">{substitutions.length}</Badge>}
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
                            <p className="text-muted-foreground text-sm">No substitution requests</p>
                          ) : (
                            <div className="space-y-2 max-h-64 overflow-y-auto">
                              {substitutions.map((req: any) => (
                                <div key={req.id} className={`p-3 rounded-lg ${req.isRead ? 'bg-muted/30 opacity-60' : 'bg-muted/50'}`} data-testid={`substitution-item-${req.id}`}>
                                  <div className="flex items-start gap-3">
                                    <Checkbox
                                      checked={req.isRead || false}
                                      onCheckedChange={(checked) => markRequestRead({ id: req.id, isRead: !!checked })}
                                      data-testid={`checkbox-substitution-${req.id}`}
                                    />
                                    <div className="flex-1">
                                      <div className="flex items-center gap-2 mb-1">
                                        <span className="font-medium text-sm">{req.userName || req.userEmail}</span>
                                        {req.status && req.status !== 'pending' && (
                                          <Badge variant={req.status === 'approved' ? 'default' : 'destructive'} className="text-xs">
                                            {req.status}
                                          </Badge>
                                        )}
                                      </div>
                                      <p className="text-sm text-muted-foreground">{req.details}</p>
                                      {req.status === 'pending' && (
                                        <div className="flex gap-2 mt-2">
                                          <Button 
                                            size="sm" 
                                            variant="outline" 
                                            className="text-green-600 border-green-300 dark:border-green-800"
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
                                            className="text-red-600 border-red-300 dark:border-red-800"
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
                    <Card>
                      <CollapsibleTrigger asChild>
                        <CardHeader className="cursor-pointer hover:bg-muted/50">
                          <CardTitle className="flex items-center justify-between">
                            <span className="flex items-center gap-2">
                              <Lightbulb className="w-5 h-5" />
                              Meal Suggestions
                              {unreadSuggestions > 0 && <Badge>{unreadSuggestions}</Badge>}
                              {menuSuggestions.length > 0 && unreadSuggestions === 0 && <Badge variant="outline">{menuSuggestions.length}</Badge>}
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
                            <p className="text-muted-foreground text-sm">No menu suggestions</p>
                          ) : (
                            <div className="space-y-2 max-h-64 overflow-y-auto">
                              {menuSuggestions.map((req: any) => (
                                <div key={req.id} className={`p-3 rounded-lg flex items-start gap-3 ${req.isRead ? 'bg-muted/30 opacity-60' : 'bg-muted/50'}`} data-testid={`suggestion-item-${req.id}`}>
                                  <Checkbox
                                    checked={req.isRead || false}
                                    onCheckedChange={(checked) => markRequestRead({ id: req.id, isRead: !!checked })}
                                    data-testid={`checkbox-suggestion-${req.id}`}
                                  />
                                  <div className="flex-1">
                                    <div className="font-medium text-sm">{req.userName || req.userEmail}</div>
                                    <p className="text-sm text-muted-foreground">{req.details}</p>
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
                    <Card>
                      <CollapsibleTrigger asChild>
                        <CardHeader className="cursor-pointer hover:bg-muted/50">
                          <CardTitle className="flex items-center justify-between">
                            <span className="flex items-center gap-2">
                              <MessageSquare className="w-5 h-5" />
                              Feedback
                              {unreadFeedback > 0 && <Badge>{unreadFeedback}</Badge>}
                              {chefFeedback && chefFeedback.length > 0 && unreadFeedback === 0 && <Badge variant="outline">{chefFeedback.length}</Badge>}
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
                            <p className="text-muted-foreground text-sm">No feedback yet</p>
                          ) : (
                            <div className="space-y-2 max-h-64 overflow-y-auto">
                              {chefFeedback.map((fb: any) => (
                                <div key={fb.id} className={`p-3 rounded-lg flex items-start gap-3 ${fb.isRead ? 'bg-muted/30 opacity-60' : 'bg-muted/50'}`} data-testid={`feedback-item-${fb.id}`}>
                                  <Checkbox
                                    checked={fb.isRead || false}
                                    onCheckedChange={(checked) => markFeedbackRead({ id: fb.id, isRead: !!checked })}
                                    data-testid={`checkbox-feedback-${fb.id}`}
                                  />
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                      <div className="flex">
                                        {[1, 2, 3, 4, 5].map((star) => (
                                          <Star key={star} className={`w-3 h-3 ${star <= fb.rating ? 'text-yellow-500 fill-yellow-500' : 'text-gray-300'}`} />
                                        ))}
                                      </div>
                                      <span className="text-xs text-muted-foreground">{fb.mealDay} {fb.mealType}</span>
                                    </div>
                                    {fb.comment && <p className="text-sm">{fb.comment}</p>}
                                    <div className="text-xs text-muted-foreground mt-1">
                                      {fb.isAnonymous ? 'Anonymous' : fb.userName || fb.userEmail}
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
                  
                  {/* House Director Critiques */}
                  <Collapsible open={critiquesOpen} onOpenChange={setCritiquesOpen}>
                    <Card>
                      <CollapsibleTrigger asChild>
                        <CardHeader className="cursor-pointer hover:bg-muted/50">
                          <CardTitle className="flex items-center justify-between">
                            <span className="flex items-center gap-2">
                              <ClipboardList className="w-5 h-5" />
                              HD Critiques
                              {unacknowledgedCritiques.length > 0 && <Badge variant="destructive">{unacknowledgedCritiques.length}</Badge>}
                              {critiques && critiques.length > 0 && unacknowledgedCritiques.length === 0 && <Badge variant="outline">{critiques.length}</Badge>}
                            </span>
                            {critiquesOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                          </CardTitle>
                        </CardHeader>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <CardContent>
                          {isLoadingCritiques ? (
                            <div className="flex justify-center py-4">
                              <Loader2 className="w-6 h-6 animate-spin" />
                            </div>
                          ) : !critiques || critiques.length === 0 ? (
                            <p className="text-muted-foreground text-sm">No critiques from house director</p>
                          ) : (
                            <div className="space-y-3 max-h-64 overflow-y-auto">
                              {critiques.map((critique: any) => {
                                const menu = menus?.find((m: any) => m.id === critique.menuId);
                                return (
                                  <div key={critique.id} className={`p-3 rounded-lg ${critique.acknowledgedByChef ? 'bg-muted/30 opacity-60' : 'bg-muted/50 border-l-4 border-amber-500'}`} data-testid={`critique-item-${critique.id}`}>
                                    <div className="flex items-start justify-between gap-2">
                                      <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                          <span className="text-xs font-medium">
                                            {menu ? format(parseISO(menu.weekOf), "MMM d, yyyy") : `Menu #${critique.menuId}`}
                                          </span>
                                          {critique.acknowledgedByChef ? (
                                            <Badge variant="outline" className="text-xs">Acknowledged</Badge>
                                          ) : (
                                            <Badge variant="destructive" className="text-xs">Needs Acknowledgment</Badge>
                                          )}
                                        </div>
                                        {critique.critiqueText && (
                                          <p className="text-sm mb-1"><strong>Critique:</strong> {critique.critiqueText}</p>
                                        )}
                                        {critique.suggestedEdits && (
                                          <p className="text-sm text-muted-foreground"><strong>Suggested Edits:</strong> {critique.suggestedEdits}</p>
                                        )}
                                        <p className="text-xs text-muted-foreground mt-2">
                                          Submitted {format(parseISO(critique.createdAt), "MMM d 'at' h:mm a")}
                                        </p>
                                      </div>
                                      {!critique.acknowledgedByChef && (
                                        <Button
                                          size="sm"
                                          onClick={() => acknowledgeCritiqueMutation.mutate(critique.id)}
                                          disabled={acknowledgeCritiqueMutation.isPending}
                                          data-testid={`button-acknowledge-critique-${critique.id}`}
                                        >
                                          {acknowledgeCritiqueMutation.isPending ? (
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                          ) : (
                                            <CheckCircle className="w-4 h-4" />
                                          )}
                                          <span className="ml-1 hidden sm:inline">Acknowledge</span>
                                        </Button>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
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
                    <h2 className="text-lg font-semibold text-amber-600 flex items-center gap-2 mb-3">
                      <AlertCircle className="w-5 h-5" />
                      Needs Revision ({menusNeedingRevision.length})
                    </h2>
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {menusNeedingRevision.map((menu: any) => renderMenuCard(menu, true))}
                    </div>
                  </div>
                )}

                {/* Current Week */}
                <div>
                  <h2 className="text-lg font-semibold mb-3">Current Week</h2>
                  {currentWeekMenu ? (
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {renderMenuCard(currentWeekMenu, true)}
                    </div>
                  ) : (
                    <Card>
                      <CardContent className="py-8 text-center text-muted-foreground">
                        No menu for this week. Click "Create Menu" to get started.
                      </CardContent>
                    </Card>
                  )}
                </div>

                {/* Future Menus */}
                {futureMenus.length > 0 && (
                  <div>
                    <h2 className="text-lg font-semibold mb-3">Upcoming Menus</h2>
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {futureMenus.map((menu: any) => renderMenuCard(menu, true))}
                    </div>
                  </div>
                )}

                {/* Past Menus */}
                {pastMenus.length > 0 && (
                  <div>
                    <h2 className="text-lg font-semibold mb-3">Past Menus</h2>
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
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Menu</DialogTitle>
            <DialogDescription>
              Update menu items and resubmit for approval.
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4">
            <div className="mb-6">
              <Label>Week Of (Monday)</Label>
              <Input 
                type="date" 
                value={editWeekOf} 
                onChange={(e) => setEditWeekOf(e.target.value)} 
                className="w-full sm:w-64"
                data-testid="input-edit-week-of"
              />
            </div>

            {renderMenuForm(editMenuItems, handleEditItemChange)}
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditMenu(null)}>Cancel</Button>
            <Button onClick={handleSaveEdit} disabled={isUpdatingMenu} data-testid="button-save-edit">
              {isUpdatingMenu ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...</> : <><Send className="w-4 h-4 mr-2" /> Save & Resubmit</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Phone Dialog */}
      <Dialog open={phoneDialogOpen} onOpenChange={setPhoneDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>SMS Settings</DialogTitle>
            <DialogDescription>
              Enter your phone number to receive late plate SMS notifications at cutoff times (12:45 PM for lunch, 5:45 PM for dinner).
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label>Phone Number</Label>
            <Input
              type="tel"
              placeholder="+1 (555) 123-4567"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              data-testid="input-phone-number"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPhoneDialogOpen(false)}>Cancel</Button>
            <Button onClick={() => updatePhoneMutation.mutate(phoneNumber)} disabled={updatePhoneMutation.isPending} data-testid="button-save-phone">
              {updatePhoneMutation.isPending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Profile Dialog */}
      <Dialog open={profileDialogOpen} onOpenChange={setProfileDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Account Settings</DialogTitle>
            <DialogDescription>
              Update your profile information and password.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div>
              <Label>Name</Label>
              <Input
                value={profileName}
                onChange={(e) => setProfileName(e.target.value)}
                data-testid="input-profile-name"
              />
            </div>
            <div>
              <Label>Email</Label>
              <Input
                type="email"
                value={profileEmail}
                onChange={(e) => setProfileEmail(e.target.value)}
                data-testid="input-profile-email"
              />
            </div>
            <div className="border-t pt-4">
              <h4 className="font-medium mb-2">Change Password</h4>
              <div className="space-y-2">
                <div>
                  <Label>Current Password</Label>
                  <Input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    data-testid="input-current-password"
                  />
                </div>
                <div>
                  <Label>New Password</Label>
                  <Input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    data-testid="input-new-password"
                  />
                </div>
                <div>
                  <Label>Confirm New Password</Label>
                  <Input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    data-testid="input-confirm-password"
                  />
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setProfileDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleProfileUpdate} disabled={updateProfileMutation.isPending} data-testid="button-save-profile">
              {updateProfileMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
