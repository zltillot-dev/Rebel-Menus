import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useMenus, useUpdateMenuStatus, useDeleteMenu } from "@/hooks/use-menus";
import { useChefs, useCreateChef, useDeleteChef, useAllChefTasks, useCreateChefTask, useDeleteChefTask } from "@/hooks/use-admin";
import { useNotifications } from "@/hooks/use-notifications";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Sidebar } from "@/components/Sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CheckCircle, XCircle, Clock, UserPlus, FileText, Eye, MessageSquare, Trash2, Calendar, ListTodo, Plus, Star, Loader2, ClipboardList, Home, Settings, Pencil } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { format, parseISO, startOfWeek, subWeeks } from "date-fns";
import { FRATERNITIES, DAYS } from "@shared/schema";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertUserSchema } from "@shared/routes";

const createChefSchema = insertUserSchema.extend({
  email: z.string().email(),
  name: z.string().min(2),
  password: z.string().min(6),
  fraternity: z.enum(["Delta Tau Delta", "Sigma Chi"]),
});

export default function AdminDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { data: menus } = useMenus();
  const { data: chefs, isLoading: isLoadingChefs } = useChefs();
  const { data: allTasks, isLoading: isLoadingTasks } = useAllChefTasks();
  const { mutate: updateStatus, isPending: isUpdating } = useUpdateMenuStatus();
  const { mutate: deleteMenu, isPending: isDeleting } = useDeleteMenu();
  const { mutate: createChef, isPending: isCreatingChef } = useCreateChef();
  const { mutate: createTask, isPending: isCreatingTask } = useCreateChefTask();
  const { mutate: deleteTask, isPending: isDeletingTask } = useDeleteChefTask();
  const { mutate: deleteChef, isPending: isDeletingChef } = useDeleteChef();
  const { notifyMenuApproved, notifyMenuRejected, notifyMenuSubmitted, isGranted: notificationsEnabled } = useNotifications();
  
  // Track known pending menu IDs to detect new submissions
  const knownPendingMenuIds = useRef<Set<number>>(new Set());
  const hasInitializedPendingMenus = useRef(false);
  
  // Detect when new pending menus appear (chef submitted for review)
  useEffect(() => {
    if (!menus || !notificationsEnabled) return;
    
    const pendingMenus = menus.filter((m: any) => m.status === 'pending');
    
    // On first load, just record existing pending menu IDs
    if (!hasInitializedPendingMenus.current) {
      pendingMenus.forEach((menu: any) => knownPendingMenuIds.current.add(menu.id));
      hasInitializedPendingMenus.current = true;
      return;
    }
    
    // Check for new pending menus we haven't seen before
    pendingMenus.forEach((menu: any) => {
      if (!knownPendingMenuIds.current.has(menu.id)) {
        // New pending menu detected - a chef submitted a menu
        const chefName = menu.chefName || 'A chef';
        const fraternity = menu.fraternity || 'Unknown';
        notifyMenuSubmitted(chefName, fraternity);
        knownPendingMenuIds.current.add(menu.id);
      }
    });
  }, [menus, notificationsEnabled, notifyMenuSubmitted]);
  
  // All feedback and requests for admin
  const { data: allFeedback, isLoading: isLoadingFeedback } = useQuery<any[]>({
    queryKey: ["/api/chef-feedback"],
  });
  
  const { data: allRequests, isLoading: isLoadingRequests } = useQuery<any[]>({
    queryKey: ["/api/requests"],
  });
  
  // Late plates for admin (all fraternities)
  const { data: latePlates, isLoading: isLoadingLatePlates } = useQuery<any[]>({
    queryKey: ["/api/late-plates"],
  });
  
  // House Directors
  const { data: houseDirectors, isLoading: isLoadingHouseDirectors } = useQuery<any[]>({
    queryKey: ["/api/admin/house-directors"],
  });
  
  // Critiques from house directors
  const { data: critiques, isLoading: isLoadingCritiques } = useQuery<any[]>({
    queryKey: ["/api/critiques"],
  });
  
  const queryClient = useQueryClient();
  
  const createHouseDirectorMutation = useMutation({
    mutationFn: async (data: { name: string; email: string; password: string; fraternity: string; phoneNumber?: string }) => {
      const res = await fetch('/api/admin/house-directors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
        credentials: 'include',
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Failed to create house director');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/house-directors'] });
    },
  });
  
  const acknowledgeCritiqueAdminMutation = useMutation({
    mutationFn: async (critiqueId: number) => {
      const res = await fetch(`/api/critiques/${critiqueId}/acknowledge-admin`, {
        method: 'PATCH',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to acknowledge critique');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/critiques'] });
    },
  });
  
  const unacknowledgedCritiques = critiques?.filter((c: any) => !c.acknowledgedByAdmin) || [];

  const [createChefOpen, setCreateChefOpen] = useState(false);
  const [createTaskOpen, setCreateTaskOpen] = useState(false);
  const [viewMenu, setViewMenu] = useState<any>(null);
  const [reviewMenu, setReviewMenu] = useState<any>(null);
  const [viewChef, setViewChef] = useState<any>(null);
  const [adminNotes, setAdminNotes] = useState("");
  const [activeTab, setActiveTab] = useState<"pending" | "all">("pending");
  const [newTaskChefId, setNewTaskChefId] = useState<string>("");
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskDescription, setNewTaskDescription] = useState("");
  const [newTaskPriority, setNewTaskPriority] = useState("medium");
  const [newTaskDueDate, setNewTaskDueDate] = useState("");
  
  // Dialog states for quick actions
  const [feedbackDialogOpen, setFeedbackDialogOpen] = useState(false);
  const [requestsDialogOpen, setRequestsDialogOpen] = useState(false);
  const [latePlatesDialogOpen, setLatePlatesDialogOpen] = useState(false);
  const [critiquesDialogOpen, setCritiquesDialogOpen] = useState(false);
  const [selectedFraternity, setSelectedFraternity] = useState<string>("all");
  
  // House Director creation state
  const [createHDOpen, setCreateHDOpen] = useState(false);
  const [hdName, setHDName] = useState("");
  const [hdEmail, setHDEmail] = useState("");
  const [hdPassword, setHDPassword] = useState("");
  const [hdFraternity, setHDFraternity] = useState("Delta Tau Delta");
  const [hdPhone, setHDPhone] = useState("");
  const [viewHDDialogOpen, setViewHDDialogOpen] = useState(false);

  const [editHDOpen, setEditHDOpen] = useState(false);
  const [editingHD, setEditingHD] = useState<any>(null);
  const [editHDName, setEditHDName] = useState("");
  const [editHDEmail, setEditHDEmail] = useState("");
  const [editHDPassword, setEditHDPassword] = useState("");
  const [editHDPhone, setEditHDPhone] = useState("");

  const [profileDialogOpen, setProfileDialogOpen] = useState(false);
  const [profileName, setProfileName] = useState("");
  const [profileEmail, setProfileEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  useEffect(() => {
    if (profileDialogOpen && user) {
      setProfileName(user.name || "");
      setProfileEmail(user.email || "");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    }
  }, [profileDialogOpen, user]);

  const updateProfileMutation = useMutation({
    mutationFn: async (data: { name?: string; email?: string; currentPassword?: string; newPassword?: string }) => {
      const res = await apiRequest("PATCH", "/api/user/profile", data);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Profile updated", description: "Your account details have been saved." });
      queryClient.invalidateQueries({ queryKey: ['/api/user'] });
      setProfileDialogOpen(false);
    },
    onError: (error: any) => {
      toast({ title: "Failed to update profile", description: error.message || "Please try again.", variant: "destructive" });
    }
  });

  const handleProfileUpdate = () => {
    if (newPassword && newPassword !== confirmPassword) {
      toast({ title: "Passwords don't match", description: "Please make sure your new password and confirmation match.", variant: "destructive" });
      return;
    }
    const updates: { name?: string; email?: string; currentPassword?: string; newPassword?: string } = {};
    if (profileName && profileName !== user?.name) updates.name = profileName;
    if (profileEmail && profileEmail !== user?.email) updates.email = profileEmail;
    if (newPassword && currentPassword) {
      updates.currentPassword = currentPassword;
      updates.newPassword = newPassword;
    }
    if (Object.keys(updates).length === 0) {
      toast({ title: "No changes", description: "No changes were made to your profile." });
      return;
    }
    updateProfileMutation.mutate(updates);
  };

  const updateHDMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const res = await apiRequest("PATCH", `/api/admin/house-directors/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "House director updated", description: "Profile has been saved." });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/house-directors'] });
      setEditHDOpen(false);
    },
    onError: (error: any) => {
      toast({ title: "Failed to update", description: error.message || "Please try again.", variant: "destructive" });
    }
  });

  const openEditHD = (hd: any) => {
    setEditingHD(hd);
    setEditHDName(hd.name || "");
    setEditHDEmail(hd.email || "");
    setEditHDPassword("");
    setEditHDPhone(hd.phoneNumber || "");
    setEditHDOpen(true);
  };

  const handleEditHD = () => {
    if (!editingHD) return;
    const data: any = {};
    if (editHDName && editHDName !== editingHD.name) data.name = editHDName;
    if (editHDEmail && editHDEmail !== editingHD.email) data.email = editHDEmail;
    if (editHDPassword) data.password = editHDPassword;
    if (editHDPhone !== (editingHD.phoneNumber || "")) data.phoneNumber = editHDPhone;
    if (Object.keys(data).length === 0) {
      toast({ title: "No changes", description: "No changes were made." });
      return;
    }
    updateHDMutation.mutate({ id: editingHD.id, data });
  };

  const form = useForm({
    resolver: zodResolver(createChefSchema),
    defaultValues: {
      role: "chef",
      name: "",
      email: "",
      password: "",
      fraternity: "Delta Tau Delta" as const,
    }
  });

  const pendingMenus = menus?.filter(m => m.status === 'pending') || [];
  const activeChefs = chefs || [];

  const handleCreateChef = (data: any) => {
    createChef(data, {
      onSuccess: () => {
        setCreateChefOpen(false);
        form.reset();
      }
    });
  };

  const handleCreateTask = () => {
    if (!newTaskChefId || !newTaskTitle.trim()) return;
    createTask({
      chefId: parseInt(newTaskChefId),
      title: newTaskTitle.trim(),
      description: newTaskDescription.trim() || undefined,
      priority: newTaskPriority,
      dueDate: newTaskDueDate || undefined,
    }, {
      onSuccess: () => {
        setCreateTaskOpen(false);
        setNewTaskChefId("");
        setNewTaskTitle("");
        setNewTaskDescription("");
        setNewTaskPriority("medium");
        setNewTaskDueDate("");
      }
    });
  };

  const tasksByChef = (allTasks || []).reduce((acc: Record<number, any[]>, task: any) => {
    if (!acc[task.chefId]) acc[task.chefId] = [];
    acc[task.chefId].push(task);
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-background text-foreground flex">
      <Sidebar />
      <main className="flex-1 p-4 pt-16 md:pt-8 md:ml-64 md:p-8">
        <header className="mb-6 md:mb-8 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-display font-bold">Admin Dashboard</h1>
            <p className="text-sm md:text-base text-muted-foreground">Manage chefs and approve weekly menus</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => setProfileDialogOpen(true)} data-testid="button-account-settings">
            <Settings className="w-4 h-4 mr-2" />
            Account Settings
          </Button>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-8">
          {/* Main Content Area */}
          <div className="lg:col-span-2 space-y-8">
            
            {/* Menu Management */}
            <section>
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-primary" />
                Menu Management
              </h2>
              
              <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
                <TabsList className="grid grid-cols-2 w-full mb-4">
                  <TabsTrigger value="pending" data-testid="tab-pending">
                    Pending ({pendingMenus.length})
                  </TabsTrigger>
                  <TabsTrigger value="all" data-testid="tab-all">
                    All Menus ({menus?.length || 0})
                  </TabsTrigger>
                </TabsList>

                {/* Pending Approvals Tab */}
                <TabsContent value="pending">
                  {pendingMenus.length === 0 ? (
                    <Card className="bg-muted/30 border-dashed">
                      <CardContent className="py-8 text-center text-muted-foreground">
                        No menus pending approval
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="space-y-4">
                      {pendingMenus.map((menu) => (
                        <Card key={menu.id} className="hover:shadow-md transition-shadow">
                          <CardHeader className="pb-3">
                            <div className="flex justify-between items-start gap-2">
                              <div>
                                <CardTitle>Week of {format(new Date(menu.weekOf), "MMMM d, yyyy")}</CardTitle>
                                <CardDescription className="mt-1 font-medium text-primary">
                                  {menu.fraternity} • {menu.items.length} items
                                </CardDescription>
                              </div>
                              <Badge variant="outline" className="bg-amber-50 text-amber-600 border-amber-200">
                                Pending Review
                              </Badge>
                            </div>
                          </CardHeader>
                          <CardContent className="space-y-3">
                            <Button 
                              variant="outline" 
                              className="w-full"
                              onClick={() => setViewMenu(menu)}
                              data-testid={`button-view-menu-${menu.id}`}
                            >
                              <Eye className="w-4 h-4 mr-2" /> View Full Menu
                            </Button>
                            <div className="flex gap-3">
                              <Button 
                                className="flex-1 bg-green-600"
                                onClick={() => {
                                  updateStatus({ id: menu.id, status: 'approved' });
                                  if (notificationsEnabled) {
                                    notifyMenuApproved(format(new Date(menu.weekOf), "MMMM d"));
                                  }
                                }}
                                disabled={isUpdating}
                                data-testid={`button-approve-menu-${menu.id}`}
                              >
                                <CheckCircle className="w-4 h-4 mr-2" /> Approve
                              </Button>
                              <Button 
                                variant="outline" 
                                className="flex-1"
                                onClick={() => { setReviewMenu(menu); setAdminNotes(""); }}
                                data-testid={`button-request-changes-${menu.id}`}
                              >
                                <MessageSquare className="w-4 h-4 mr-2" /> Request Changes
                              </Button>
                            </div>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="destructive" size="sm" className="w-full" data-testid={`button-delete-menu-${menu.id}`}>
                                  <Trash2 className="w-4 h-4 mr-2" /> Delete Menu
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete Menu</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to delete this menu? This will also delete all associated feedback. This action cannot be undone.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => deleteMenu(menu.id)} disabled={isDeleting}>
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </TabsContent>

                {/* All Menus Tab */}
                <TabsContent value="all">
                  {!menus || menus.length === 0 ? (
                    <Card className="bg-muted/30 border-dashed">
                      <CardContent className="py-8 text-center text-muted-foreground">
                        No menus created yet
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="space-y-4">
                      {menus.map((menu) => (
                        <Card key={menu.id} className="hover:shadow-md transition-shadow">
                          <CardHeader className="pb-3">
                            <div className="flex justify-between items-start gap-2">
                              <div>
                                <CardTitle>Week of {format(new Date(menu.weekOf), "MMMM d, yyyy")}</CardTitle>
                                <CardDescription className="mt-1 font-medium text-primary">
                                  {menu.fraternity} • {menu.items.length} items
                                </CardDescription>
                              </div>
                              <Badge variant={
                                menu.status === 'approved' ? 'default' : 
                                menu.status === 'pending' ? 'secondary' : 
                                menu.status === 'needs_revision' ? 'outline' : 'outline'
                              } className={
                                menu.status === 'needs_revision' ? 'bg-amber-50 text-amber-600 border-amber-200' : ''
                              }>
                                {menu.status === 'needs_revision' ? 'Needs Revision' : menu.status}
                              </Badge>
                            </div>
                          </CardHeader>
                          <CardContent className="space-y-3">
                            <Button 
                              variant="outline" 
                              className="w-full"
                              onClick={() => setViewMenu(menu)}
                              data-testid={`button-view-all-menu-${menu.id}`}
                            >
                              <Eye className="w-4 h-4 mr-2" /> View Full Menu
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="destructive" size="sm" className="w-full" data-testid={`button-delete-all-menu-${menu.id}`}>
                                  <Trash2 className="w-4 h-4 mr-2" /> Delete Menu
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete Menu</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to delete this menu? This will also delete all associated feedback. This action cannot be undone.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => deleteMenu(menu.id)} disabled={isDeleting}>
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </section>

            {/* Chef Management */}
            <section>
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <UserPlus className="w-5 h-5 text-primary" />
                  Manage Chefs
                </h2>
                <Dialog open={createChefOpen} onOpenChange={setCreateChefOpen}>
                  <DialogTrigger asChild>
                    <Button>Add New Chef</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add New Chef</DialogTitle>
                      <DialogDescription>Create a chef profile and assign them to a fraternity.</DialogDescription>
                    </DialogHeader>
                    <form onSubmit={form.handleSubmit(handleCreateChef)} className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label>Full Name</Label>
                        <Input {...form.register("name")} />
                        {form.formState.errors.name && <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>}
                      </div>
                      <div className="space-y-2">
                        <Label>Email</Label>
                        <Input type="email" {...form.register("email")} />
                        {form.formState.errors.email && <p className="text-xs text-destructive">{form.formState.errors.email.message}</p>}
                      </div>
                      <div className="space-y-2">
                        <Label>Password</Label>
                        <Input type="password" {...form.register("password")} />
                        {form.formState.errors.password && <p className="text-xs text-destructive">{form.formState.errors.password.message}</p>}
                      </div>
                      <div className="space-y-2">
                        <Label>Fraternity Assignment</Label>
                        <Select onValueChange={(val) => form.setValue("fraternity", val as any)} defaultValue={form.getValues("fraternity")}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select fraternity" />
                          </SelectTrigger>
                          <SelectContent>
                            {FRATERNITIES.map((frat) => (
                              <SelectItem key={frat} value={frat}>{frat}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <DialogFooter>
                        <Button type="submit" disabled={isCreatingChef}>
                          {isCreatingChef ? "Creating..." : "Create Chef Account"}
                        </Button>
                      </DialogFooter>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                {activeChefs.map((chef) => (
                  <Card key={chef.id} data-testid={`card-chef-${chef.id}`}>
                    <CardHeader className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                            {chef.name.charAt(0)}
                          </div>
                          <div>
                            <h4 className="font-bold">{chef.name}</h4>
                            <p className="text-xs text-muted-foreground">{chef.fraternity}</p>
                          </div>
                        </div>
                        <div className="flex gap-1">
                          <Button 
                            size="icon" 
                            variant="ghost" 
                            onClick={() => setViewChef(chef)}
                            data-testid={`button-view-chef-${chef.id}`}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button 
                                size="icon" 
                                variant="ghost" 
                                data-testid={`button-delete-chef-${chef.id}`}
                              >
                                <Trash2 className="w-4 h-4 text-destructive" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete Chef</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to delete {chef.name}? This will also delete all tasks assigned to this chef. This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction 
                                  onClick={() => deleteChef(chef.id)} 
                                  disabled={isDeletingChef}
                                  data-testid={`button-confirm-delete-chef-${chef.id}`}
                                >
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>
                    </CardHeader>
                  </Card>
                ))}
              </div>
            </section>

            {/* Chef Tasks Management */}
            <section>
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <ListTodo className="w-5 h-5 text-primary" />
                  Chef Tasks & Reminders
                </h2>
                <Dialog open={createTaskOpen} onOpenChange={setCreateTaskOpen}>
                  <DialogTrigger asChild>
                    <Button data-testid="button-add-task">
                      <Plus className="w-4 h-4 mr-2" /> Add Task
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Create Task for Chef</DialogTitle>
                      <DialogDescription>Assign a task or reminder to a specific chef.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label>Chef</Label>
                        <Select value={newTaskChefId} onValueChange={setNewTaskChefId}>
                          <SelectTrigger data-testid="select-task-chef">
                            <SelectValue placeholder="Select a chef" />
                          </SelectTrigger>
                          <SelectContent>
                            {activeChefs.map((chef) => (
                              <SelectItem key={chef.id} value={String(chef.id)}>
                                {chef.name} ({chef.fraternity})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Task Title</Label>
                        <Input 
                          value={newTaskTitle} 
                          onChange={(e) => setNewTaskTitle(e.target.value)}
                          placeholder="e.g., Update weekly menu"
                          data-testid="input-task-title"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Description (optional)</Label>
                        <Textarea 
                          value={newTaskDescription} 
                          onChange={(e) => setNewTaskDescription(e.target.value)}
                          placeholder="Additional details..."
                          data-testid="input-task-description"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Priority</Label>
                          <Select value={newTaskPriority} onValueChange={setNewTaskPriority}>
                            <SelectTrigger data-testid="select-task-priority">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="low">Low</SelectItem>
                              <SelectItem value="medium">Medium</SelectItem>
                              <SelectItem value="high">High</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Due Date (optional)</Label>
                          <Input 
                            type="date" 
                            value={newTaskDueDate} 
                            onChange={(e) => setNewTaskDueDate(e.target.value)}
                            data-testid="input-task-due-date"
                          />
                        </div>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setCreateTaskOpen(false)}>Cancel</Button>
                      <Button 
                        onClick={handleCreateTask} 
                        disabled={isCreatingTask || !newTaskChefId || !newTaskTitle.trim()}
                        data-testid="button-submit-task"
                      >
                        {isCreatingTask ? "Creating..." : "Create Task"}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>

              {isLoadingChefs || isLoadingTasks ? (
                <Card className="bg-muted/30 border-dashed">
                  <CardContent className="py-8 text-center text-muted-foreground">
                    Loading...
                  </CardContent>
                </Card>
              ) : activeChefs.length === 0 ? (
                <Card className="bg-muted/30 border-dashed">
                  <CardContent className="py-8 text-center text-muted-foreground">
                    No chefs available. Add a chef first to assign tasks.
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-4">
                  {activeChefs.map((chef) => {
                    const chefTasks = tasksByChef[chef.id] || [];
                    const incompleteTasks = chefTasks.filter((t: any) => !t.isCompleted);
                    const completedTasks = chefTasks.filter((t: any) => t.isCompleted);
                    
                    return (
                      <Card key={chef.id} data-testid={`card-chef-tasks-${chef.id}`}>
                        <CardHeader className="pb-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                                {chef.name.charAt(0)}
                              </div>
                              <div>
                                <CardTitle className="text-base">{chef.name}</CardTitle>
                                <CardDescription>{chef.fraternity}</CardDescription>
                              </div>
                            </div>
                            <Badge variant="outline">
                              {incompleteTasks.length} active task{incompleteTasks.length !== 1 ? 's' : ''}
                            </Badge>
                          </div>
                        </CardHeader>
                        <CardContent>
                          {chefTasks.length === 0 ? (
                            <p className="text-sm text-muted-foreground">No tasks assigned</p>
                          ) : (
                            <div className="space-y-2">
                              {incompleteTasks.map((task: any) => (
                                <div key={task.id} className="flex items-start justify-between gap-2 p-2 bg-muted/50 rounded-md" data-testid={`task-admin-${task.id}`}>
                                  <div className="flex-1">
                                    <div className="font-medium text-sm">{task.title}</div>
                                    {task.description && <p className="text-xs text-muted-foreground">{task.description}</p>}
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
                                  <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                      <Button size="sm" variant="ghost" className="text-destructive" disabled={isDeletingTask} data-testid={`button-delete-task-${task.id}`}>
                                        <Trash2 className="w-4 h-4" />
                                      </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                      <AlertDialogHeader>
                                        <AlertDialogTitle>Delete Task?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                          Are you sure you want to delete this task? This action cannot be undone.
                                        </AlertDialogDescription>
                                      </AlertDialogHeader>
                                      <AlertDialogFooter>
                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                        <AlertDialogAction onClick={() => deleteTask(task.id)}>Delete</AlertDialogAction>
                                      </AlertDialogFooter>
                                    </AlertDialogContent>
                                  </AlertDialog>
                                </div>
                              ))}
                              {completedTasks.length > 0 && (
                                <div className="pt-2 border-t">
                                  <p className="text-xs text-muted-foreground mb-2">{completedTasks.length} completed</p>
                                  {completedTasks.slice(0, 2).map((task: any) => (
                                    <div key={task.id} className="flex items-center justify-between p-2 opacity-60">
                                      <span className="text-sm line-through">{task.title}</span>
                                      <Button size="sm" variant="ghost" className="text-destructive" onClick={() => deleteTask(task.id)}>
                                        <Trash2 className="w-3 h-3" />
                                      </Button>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </section>
            
            {/* House Director Management */}
            <section>
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <Home className="w-5 h-5 text-primary" />
                  House Directors
                </h2>
                <Dialog open={createHDOpen} onOpenChange={setCreateHDOpen}>
                  <DialogTrigger asChild>
                    <Button data-testid="button-add-house-director">
                      <Plus className="w-4 h-4 mr-2" /> Add House Director
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add House Director</DialogTitle>
                      <DialogDescription>Create a house director profile for a fraternity.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label htmlFor="hd-name">Name</Label>
                        <Input 
                          id="hd-name"
                          value={hdName} 
                          onChange={(e) => setHDName(e.target.value)}
                          placeholder="John Smith"
                          data-testid="input-hd-name"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="hd-email">Email</Label>
                        <Input 
                          id="hd-email"
                          type="email"
                          value={hdEmail} 
                          onChange={(e) => setHDEmail(e.target.value)}
                          placeholder="john@university.edu"
                          data-testid="input-hd-email"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="hd-password">Password</Label>
                        <Input 
                          id="hd-password"
                          type="password"
                          value={hdPassword} 
                          onChange={(e) => setHDPassword(e.target.value)}
                          placeholder="At least 6 characters"
                          data-testid="input-hd-password"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Fraternity</Label>
                        <Select value={hdFraternity} onValueChange={setHDFraternity}>
                          <SelectTrigger data-testid="select-hd-fraternity">
                            <SelectValue placeholder="Select fraternity" />
                          </SelectTrigger>
                          <SelectContent>
                            {FRATERNITIES.map(f => (
                              <SelectItem key={f} value={f}>{f}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="hd-phone">Phone Number (optional)</Label>
                        <Input 
                          id="hd-phone"
                          type="tel"
                          value={hdPhone} 
                          onChange={(e) => setHDPhone(e.target.value)}
                          placeholder="+1 555 123 4567"
                          data-testid="input-hd-phone"
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button
                        onClick={() => {
                          if (!hdName || !hdEmail || !hdPassword || !hdFraternity) return;
                          createHouseDirectorMutation.mutate({
                            name: hdName,
                            email: hdEmail,
                            password: hdPassword,
                            fraternity: hdFraternity,
                            phoneNumber: hdPhone || undefined,
                          }, {
                            onSuccess: () => {
                              setCreateHDOpen(false);
                              setHDName("");
                              setHDEmail("");
                              setHDPassword("");
                              setHDPhone("");
                            }
                          });
                        }}
                        disabled={createHouseDirectorMutation.isPending || !hdName || !hdEmail || !hdPassword}
                        data-testid="button-submit-hd"
                      >
                        {createHouseDirectorMutation.isPending ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Creating...
                          </>
                        ) : (
                          "Create House Director"
                        )}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
              
              {isLoadingHouseDirectors ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                </div>
              ) : !houseDirectors || houseDirectors.length === 0 ? (
                <Card>
                  <CardContent className="py-8 text-center text-muted-foreground">
                    No house directors yet. Click "Add House Director" to create one.
                  </CardContent>
                </Card>
              ) : (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {houseDirectors.map((hd: any) => (
                    <Card key={hd.id} data-testid={`hd-card-${hd.id}`}>
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <CardTitle className="text-lg">{hd.name}</CardTitle>
                            <CardDescription>{hd.email}</CardDescription>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary">{hd.fraternity}</Badge>
                            <Button size="icon" variant="ghost" data-testid={`button-edit-hd-${hd.id}`} onClick={() => openEditHD(hd)}>
                              <Pencil className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="text-sm text-muted-foreground">
                          {hd.phoneNumber ? (
                            <p>Phone: {hd.phoneNumber}</p>
                          ) : (
                            <p className="italic">No phone number</p>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </section>
            
            {/* House Director Critiques */}
            <section>
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <ClipboardList className="w-5 h-5 text-primary" />
                  Menu Critiques
                  {unacknowledgedCritiques.length > 0 && (
                    <Badge variant="destructive">{unacknowledgedCritiques.length} pending</Badge>
                  )}
                </h2>
              </div>
              
              {isLoadingCritiques ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                </div>
              ) : !critiques || critiques.length === 0 ? (
                <Card>
                  <CardContent className="py-8 text-center text-muted-foreground">
                    No critiques from house directors yet.
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-4">
                  {critiques.map((critique: any) => {
                    const menu = menus?.find((m: any) => m.id === critique.menuId);
                    return (
                      <Card key={critique.id} className={!critique.acknowledgedByAdmin ? "border-l-4 border-l-amber-500" : ""} data-testid={`critique-card-${critique.id}`}>
                        <CardHeader className="pb-2">
                          <div className="flex items-center justify-between flex-wrap gap-2">
                            <div>
                              <CardTitle className="text-base">
                                {menu ? `Week of ${format(parseISO(menu.weekOf), "MMM d, yyyy")}` : `Menu #${critique.menuId}`}
                              </CardTitle>
                              <CardDescription>
                                {critique.fraternity} | Submitted {format(parseISO(critique.createdAt), "MMM d 'at' h:mm a")}
                              </CardDescription>
                            </div>
                            <div className="flex items-center gap-2">
                              {critique.acknowledgedByAdmin ? (
                                <Badge variant="outline">
                                  <CheckCircle className="w-3 h-3 mr-1" /> Acknowledged
                                </Badge>
                              ) : (
                                <Button
                                  size="sm"
                                  onClick={() => acknowledgeCritiqueAdminMutation.mutate(critique.id)}
                                  disabled={acknowledgeCritiqueAdminMutation.isPending}
                                  data-testid={`button-acknowledge-critique-${critique.id}`}
                                >
                                  {acknowledgeCritiqueAdminMutation.isPending ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                  ) : (
                                    <>
                                      <CheckCircle className="w-4 h-4 mr-1" />
                                      Acknowledge
                                    </>
                                  )}
                                </Button>
                              )}
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent>
                          {critique.critiqueText && (
                            <div className="mb-2">
                              <p className="text-sm font-medium">Critique:</p>
                              <p className="text-sm text-muted-foreground">{critique.critiqueText}</p>
                            </div>
                          )}
                          {critique.suggestedEdits && (
                            <div>
                              <p className="text-sm font-medium">Suggested Edits:</p>
                              <p className="text-sm text-muted-foreground">{critique.suggestedEdits}</p>
                            </div>
                          )}
                          <div className="mt-3 flex gap-4 text-xs text-muted-foreground">
                            <span>Chef: {critique.acknowledgedByChef ? "Acknowledged" : "Pending"}</span>
                            <span>Admin: {critique.acknowledgedByAdmin ? "Acknowledged" : "Pending"}</span>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </section>
          </div>

          {/* Sidebar Stats */}
          <div className="space-y-6">
            <Card className="bg-primary text-primary-foreground border-none">
              <CardHeader>
                <CardTitle className="text-lg">System Status</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-primary-foreground/80">Active Chefs</span>
                  <span className="font-bold text-2xl">{activeChefs.length}</span>
                </div>
                <div className="h-px bg-primary-foreground/20" />
                <div className="flex justify-between items-center">
                  <span className="text-primary-foreground/80">Pending Menus</span>
                  <span className="font-bold text-2xl">{pendingMenus.length}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-2">
                <Button 
                  variant="outline" 
                  className="justify-start" 
                  onClick={() => setFeedbackDialogOpen(true)}
                  data-testid="button-view-all-feedback"
                >
                  <Star className="w-4 h-4 mr-2" /> View All Feedback
                </Button>
                <Button 
                  variant="outline" 
                  className="justify-start"
                  onClick={() => setRequestsDialogOpen(true)}
                  data-testid="button-request-history"
                >
                  <FileText className="w-4 h-4 mr-2" /> Request History
                </Button>
                <Button 
                  variant="outline" 
                  className="justify-start"
                  onClick={() => setLatePlatesDialogOpen(true)}
                  data-testid="button-view-late-plates"
                >
                  <Clock className="w-4 h-4 mr-2" /> View Late Plates
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* View Menu Dialog */}
        <Dialog open={!!viewMenu} onOpenChange={(open) => !open && setViewMenu(null)}>
          <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Eye className="w-5 h-5" />
                Menu for {viewMenu && format(new Date(viewMenu.weekOf), "MMMM d, yyyy")}
              </DialogTitle>
              <DialogDescription>
                {viewMenu?.fraternity} - Status: {viewMenu?.status}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              {DAYS.map(day => {
                const dayItems = viewMenu?.items?.filter((item: any) => item.day === day) || [];
                if (dayItems.length === 0) return null;
                return (
                  <div key={day} className="border rounded-lg p-4">
                    <h3 className="font-semibold text-lg mb-3">{day}</h3>
                    <div className="space-y-3">
                      {dayItems.map((item: any) => (
                        <div key={item.id} className="bg-muted/50 rounded-md p-3">
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <span className="font-medium">{item.meal}</span>
                              <p className="text-sm mt-1">{item.description}</p>
                              {(item.side1 || item.side2 || item.side3) && (
                                <div className="flex flex-wrap gap-1 mt-2">
                                  {item.side1 && <Badge variant="outline" className="text-xs">{item.side1}</Badge>}
                                  {item.side2 && <Badge variant="outline" className="text-xs">{item.side2}</Badge>}
                                  {item.side3 && <Badge variant="outline" className="text-xs">{item.side3}</Badge>}
                                </div>
                              )}
                            </div>
                            <Badge variant="secondary">{item.calories} cal</Badge>
                          </div>
                          <div className="flex gap-4 text-xs text-muted-foreground mt-2">
                            <span>Carbs: {item.carbs}g</span>
                            <span>Fats: {item.fats}g</span>
                            <span>Protein: {item.protein}g</span>
                            <span>Sugar: {item.sugar}g</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" onClick={() => setViewMenu(null)} data-testid="button-close-view-menu">Close</Button>
              <Button 
                className="bg-green-600"
                onClick={() => {
                  updateStatus({ id: viewMenu.id, status: 'approved' });
                  if (notificationsEnabled) {
                    notifyMenuApproved(format(new Date(viewMenu.weekOf), "MMMM d"));
                  }
                  setViewMenu(null);
                }}
                data-testid="button-approve-menu-dialog"
              >
                <CheckCircle className="w-4 h-4 mr-2" /> Approve Menu
              </Button>
              <Button 
                variant="outline"
                onClick={() => {
                  setReviewMenu(viewMenu);
                  setAdminNotes("");
                  setViewMenu(null);
                }}
              >
                <MessageSquare className="w-4 h-4 mr-2" /> Request Changes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Request Changes Dialog */}
        <Dialog open={!!reviewMenu} onOpenChange={(open) => !open && setReviewMenu(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5" />
                Request Menu Changes
              </DialogTitle>
              <DialogDescription>
                Send feedback to the chef for: Week of {reviewMenu && format(new Date(reviewMenu.weekOf), "MMMM d, yyyy")}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Notes & Suggestions for the Chef</Label>
                <Textarea 
                  placeholder="Enter your feedback, suggestions, or required changes here..."
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  rows={6}
                  data-testid="input-admin-notes"
                />
                <p className="text-xs text-muted-foreground">
                  The chef will see these notes and can make corrections before resubmitting.
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setReviewMenu(null)} data-testid="button-cancel-revision">Cancel</Button>
              <Button 
                onClick={() => {
                  updateStatus({ id: reviewMenu.id, status: 'needs_revision', adminNotes });
                  if (notificationsEnabled) {
                    notifyMenuRejected(format(new Date(reviewMenu.weekOf), "MMMM d"));
                  }
                  setReviewMenu(null);
                }}
                disabled={!adminNotes.trim() || isUpdating}
                data-testid="button-submit-revision-request"
              >
                Send to Chef for Revision
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* View Chef Details Dialog */}
        <Dialog open={!!viewChef} onOpenChange={(open) => !open && setViewChef(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Eye className="w-5 h-5" />
                Chef Profile
              </DialogTitle>
              <DialogDescription>
                View chef account details
              </DialogDescription>
            </DialogHeader>
            {viewChef && (
              <div className="space-y-4 py-4">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-2xl">
                    {viewChef.name?.charAt(0) || "?"}
                  </div>
                  <div>
                    <h3 className="text-lg font-bold" data-testid="text-chef-name">{viewChef.name}</h3>
                    <p className="text-sm text-muted-foreground">{viewChef.fraternity}</p>
                  </div>
                </div>
                <div className="grid gap-3 pt-4 border-t">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Email</span>
                    <span className="font-medium" data-testid="text-chef-email">{viewChef.email}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Role</span>
                    <Badge variant="secondary">{viewChef.role}</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Phone</span>
                    <span className="font-medium" data-testid="text-chef-phone">{viewChef.phoneNumber || "Not set"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Assigned Tasks</span>
                    <span className="font-medium">{tasksByChef[viewChef.id]?.length || 0}</span>
                  </div>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setViewChef(null)} data-testid="button-close-chef-dialog">Close</Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" data-testid="button-delete-chef-from-dialog">
                    <Trash2 className="w-4 h-4 mr-2" /> Delete Chef
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete Chef</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to delete {viewChef?.name}? This will also delete all tasks assigned to this chef. This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction 
                      onClick={() => {
                        deleteChef(viewChef.id);
                        setViewChef(null);
                      }} 
                      disabled={isDeletingChef}
                    >
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* View All Feedback Dialog */}
        <Dialog open={feedbackDialogOpen} onOpenChange={setFeedbackDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[80vh]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Star className="w-5 h-5" />
                All Feedback
              </DialogTitle>
              <DialogDescription>
                View all user feedback across fraternities
              </DialogDescription>
            </DialogHeader>
            <div className="mb-4">
              <Select value={selectedFraternity} onValueChange={setSelectedFraternity}>
                <SelectTrigger data-testid="select-feedback-fraternity">
                  <SelectValue placeholder="Filter by fraternity" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Fraternities</SelectItem>
                  {FRATERNITIES.map((frat) => (
                    <SelectItem key={frat} value={frat}>{frat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <ScrollArea className="max-h-[50vh]">
              {isLoadingFeedback ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin" />
                </div>
              ) : !allFeedback || allFeedback.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No feedback received yet
                </div>
              ) : (
                <div className="space-y-3">
                  {allFeedback
                    .filter((fb: any) => {
                      if (selectedFraternity === "all") return true;
                      const menu = menus?.find(m => m.id === fb.menuId);
                      return menu?.fraternity === selectedFraternity;
                    })
                    .map((fb: any) => {
                      const menu = menus?.find(m => m.id === fb.menuId);
                      return (
                        <div key={fb.id} className="p-3 border rounded-lg" data-testid={`feedback-item-${fb.id}`}>
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <span className="font-medium">{fb.userName || 'Anonymous'}</span>
                              <Badge variant="outline" className="ml-2">{menu?.fraternity}</Badge>
                            </div>
                            <div className="flex items-center">
                              {[1, 2, 3, 4, 5].map((star) => (
                                <Star 
                                  key={star} 
                                  className={`w-4 h-4 ${star <= fb.rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`} 
                                />
                              ))}
                            </div>
                          </div>
                          <div className="text-sm text-muted-foreground mb-1">
                            {fb.mealDay} {fb.mealType} - Week of {menu?.weekOf ? format(parseISO(menu.weekOf), "MMM d") : 'Unknown'}
                          </div>
                          {fb.comment && <p className="text-sm">{fb.comment}</p>}
                        </div>
                      );
                    })}
                </div>
              )}
            </ScrollArea>
            <DialogFooter>
              <Button variant="outline" onClick={() => setFeedbackDialogOpen(false)} data-testid="button-close-feedback-dialog">Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Request History Dialog */}
        <Dialog open={requestsDialogOpen} onOpenChange={setRequestsDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[80vh]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Request History
              </DialogTitle>
              <DialogDescription>
                View all user requests (substitutions, menu suggestions)
              </DialogDescription>
            </DialogHeader>
            <div className="mb-4">
              <Select value={selectedFraternity} onValueChange={setSelectedFraternity}>
                <SelectTrigger data-testid="select-requests-fraternity">
                  <SelectValue placeholder="Filter by fraternity" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Fraternities</SelectItem>
                  {FRATERNITIES.map((frat) => (
                    <SelectItem key={frat} value={frat}>{frat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <ScrollArea className="max-h-[50vh]">
              {isLoadingRequests ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin" />
                </div>
              ) : !allRequests || allRequests.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No requests yet
                </div>
              ) : (
                <div className="space-y-3">
                  {allRequests
                    .filter((req: any) => req.type === 'substitution' || req.type === 'menu_suggestion')
                    .filter((req: any) => selectedFraternity === "all" || req.fraternity === selectedFraternity)
                    .map((req: any) => (
                      <div key={req.id} className="p-3 border rounded-lg" data-testid={`request-item-${req.id}`}>
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{req.user?.name || 'Unknown'}</span>
                            <Badge variant={req.type === 'substitution' ? 'default' : 'secondary'}>
                              {req.type === 'substitution' ? 'Substitution' : 'Menu Suggestion'}
                            </Badge>
                            {req.status && req.status !== 'pending' && (
                              <Badge variant={req.status === 'approved' ? 'default' : 'destructive'}>
                                {req.status}
                              </Badge>
                            )}
                          </div>
                          <Badge variant="outline">{req.fraternity}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mb-1">
                          {req.date ? format(parseISO(req.date), "MMM d, yyyy") : 'Unknown date'}
                        </p>
                        <p className="text-sm">{req.details}</p>
                      </div>
                    ))}
                </div>
              )}
            </ScrollArea>
            <DialogFooter>
              <Button variant="outline" onClick={() => setRequestsDialogOpen(false)} data-testid="button-close-requests-dialog">Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Late Plates Dialog */}
        <Dialog open={latePlatesDialogOpen} onOpenChange={setLatePlatesDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[80vh]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5" />
                Late Plates
              </DialogTitle>
              <DialogDescription>
                View late plate requests by fraternity
              </DialogDescription>
            </DialogHeader>
            <div className="mb-4">
              <Select value={selectedFraternity} onValueChange={setSelectedFraternity}>
                <SelectTrigger data-testid="select-lateplates-fraternity">
                  <SelectValue placeholder="Filter by fraternity" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Fraternities</SelectItem>
                  {FRATERNITIES.map((frat) => (
                    <SelectItem key={frat} value={frat}>{frat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <ScrollArea className="max-h-[50vh]">
              {isLoadingLatePlates ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin" />
                </div>
              ) : !latePlates || latePlates.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No late plate requests
                </div>
              ) : (
                <div className="space-y-4">
                  {(() => {
                    const filtered = latePlates.filter((lp: any) => 
                      selectedFraternity === "all" || lp.fraternity === selectedFraternity
                    );
                    
                    // Group by date and meal
                    const grouped: Record<string, any[]> = {};
                    for (const lp of filtered) {
                      if (lp.mealDay && lp.mealType) {
                        const key = `${lp.mealDay}|${lp.mealType}|${lp.fraternity}`;
                        if (!grouped[key]) grouped[key] = [];
                        grouped[key].push(lp);
                      }
                    }
                    
                    const sortedKeys = Object.keys(grouped).sort((a, b) => {
                      const [dateA] = a.split("|");
                      const [dateB] = b.split("|");
                      return new Date(dateB).getTime() - new Date(dateA).getTime();
                    });
                    
                    if (sortedKeys.length === 0) {
                      return (
                        <div className="text-center py-8 text-muted-foreground">
                          No late plates for selected fraternity
                        </div>
                      );
                    }
                    
                    return sortedKeys.map((key) => {
                      const [dateStr, mealType, fraternity] = key.split("|");
                      const plates = grouped[key];
                      const currentWeek = startOfWeek(new Date(), { weekStartsOn: 1 });
                      const previousWeek = subWeeks(currentWeek, 1);
                      const plateDate = parseISO(dateStr);
                      const isCurrentWeek = plateDate >= currentWeek;
                      const isPreviousWeek = plateDate >= previousWeek && plateDate < currentWeek;
                      
                      return (
                        <div key={key} className="p-3 border rounded-lg" data-testid={`late-plate-group-${key}`}>
                          <div className="flex justify-between items-center mb-2">
                            <div className="font-medium">
                              {format(parseISO(dateStr), "EEEE, MMM d")} - {mealType}
                            </div>
                            <div className="flex gap-2">
                              <Badge variant="outline">{fraternity}</Badge>
                              {isCurrentWeek && <Badge>This Week</Badge>}
                              {isPreviousWeek && <Badge variant="secondary">Last Week</Badge>}
                            </div>
                          </div>
                          <div className="space-y-1">
                            {plates.map((plate: any) => (
                              <div key={plate.id} className="flex items-center gap-2 text-sm">
                                <span>{plate.userName || plate.userEmail}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              )}
            </ScrollArea>
            <DialogFooter>
              <Button variant="outline" onClick={() => setLatePlatesDialogOpen(false)} data-testid="button-close-lateplates-dialog">Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

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

        <Dialog open={editHDOpen} onOpenChange={setEditHDOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit House Director</DialogTitle>
              <DialogDescription>
                Update the house director's profile information.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4 space-y-4">
              <div>
                <Label>Name</Label>
                <Input
                  value={editHDName}
                  onChange={(e) => setEditHDName(e.target.value)}
                  data-testid="input-edit-hd-name"
                />
              </div>
              <div>
                <Label>Email</Label>
                <Input
                  type="email"
                  value={editHDEmail}
                  onChange={(e) => setEditHDEmail(e.target.value)}
                  data-testid="input-edit-hd-email"
                />
              </div>
              <div>
                <Label>Phone Number</Label>
                <Input
                  type="tel"
                  value={editHDPhone}
                  onChange={(e) => setEditHDPhone(e.target.value)}
                  data-testid="input-edit-hd-phone"
                />
              </div>
              <div className="border-t pt-4">
                <h4 className="font-medium mb-2">Reset Password</h4>
                <div>
                  <Label>New Password (leave blank to keep current)</Label>
                  <Input
                    type="password"
                    value={editHDPassword}
                    onChange={(e) => setEditHDPassword(e.target.value)}
                    placeholder="Enter new password"
                    data-testid="input-edit-hd-password"
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditHDOpen(false)} data-testid="button-cancel-edit-hd">Cancel</Button>
              <Button onClick={handleEditHD} disabled={updateHDMutation.isPending} data-testid="button-save-edit-hd">
                {updateHDMutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}
