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
    mutationFn: async (data: { name: string; email: string; fraternity: string; phoneNumber?: string }) => {
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
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="flex-1 md:pl-64 min-h-screen bg-background">
        <header className="pt-8 pb-6 px-8 border-b border-white/[0.10] flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="font-display font-black text-3xl uppercase tracking-wide text-white">Admin Dashboard</h1>
            <p className="text-sm text-neutral-500 mt-1 font-sans">Manage chefs and approve weekly menus</p>
          </div>
          <Button variant="outline" size="sm" className="border-white/[0.14] text-neutral-400 hover:text-white hover:border-white/[0.2] rounded-sm font-display font-bold uppercase tracking-wider" onClick={() => setProfileDialogOpen(true)} data-testid="button-account-settings">
            <Settings className="w-4 h-4 mr-2" />
            Account Settings
          </Button>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-8 p-8">
          {/* Main Content Area */}
          <div className="lg:col-span-2 space-y-8">
            
            {/* Menu Management */}
            <section>
              <h2 className="font-display font-bold text-xl uppercase tracking-wide text-white mb-4 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-amber-500" />
                Menu Management
              </h2>
              
              <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
                <TabsList className="h-10 bg-[#1A1A1A] border border-white/[0.10] rounded-sm p-0.5 grid grid-cols-2 w-full mb-4">
                  <TabsTrigger value="pending" className="data-[state=active]:bg-[#222222] data-[state=active]:text-white rounded-sm font-display font-bold uppercase tracking-wide text-xs" data-testid="tab-pending">
                    Pending ({pendingMenus.length})
                  </TabsTrigger>
                  <TabsTrigger value="all" className="data-[state=active]:bg-[#222222] data-[state=active]:text-white rounded-sm font-display font-bold uppercase tracking-wide text-xs" data-testid="tab-all">
                    All Menus ({menus?.length || 0})
                  </TabsTrigger>
                </TabsList>

                {/* Pending Approvals Tab */}
                <TabsContent value="pending">
                  {pendingMenus.length === 0 ? (
                    <Card className="bg-[#1A1A1A] border border-white/[0.10] border-dashed rounded-sm">
                      <CardContent className="py-8 text-center text-neutral-500">
                        <CheckCircle className="w-10 h-10 mx-auto mb-3 opacity-50" />
                        <p className="font-medium text-white">No menus pending approval</p>
                        <p className="text-sm mt-1">New chef submissions will appear here as soon as they are sent for review.</p>
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="space-y-4">
                      {pendingMenus.map((menu) => (
                        <Card key={menu.id} className="bg-[#1A1A1A] border border-white/[0.10] rounded-sm hover:border-white/[0.1] transition-colors">
                          <CardHeader className="pb-3 bg-[#161616] border-b border-white/[0.10]">
                            <div className="flex justify-between items-start gap-2">
                              <div>
                                <CardTitle className="font-display font-bold uppercase tracking-wide text-white">Week of {format(new Date(menu.weekOf), "MMMM d, yyyy")}</CardTitle>
                                <CardDescription className="mt-1 font-medium text-amber-500">
                                  {menu.fraternity} • {menu.items.length} items
                                </CardDescription>
                              </div>
                              <Badge variant="outline" className="bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-sm uppercase text-[10px] tracking-wider font-bold">
                                Pending Review
                              </Badge>
                            </div>
                          </CardHeader>
                          <CardContent className="space-y-3">
                            <Button
                              variant="outline"
                              className="w-full border-white/[0.14] text-neutral-400 hover:text-white hover:border-white/[0.2] rounded-sm font-display font-bold uppercase tracking-wider"
                              onClick={() => setViewMenu(menu)}
                              data-testid={`button-view-menu-${menu.id}`}
                            >
                              <Eye className="w-4 h-4 mr-2" /> View Full Menu
                            </Button>
                            <div className="flex gap-3">
                              <Button
                                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-display font-bold uppercase tracking-wider rounded-sm shadow-sm"
                                onClick={() => {
                                  updateStatus({ id: menu.id, status: 'approved' });
                                  if (notificationsEnabled) {
                                    notifyMenuApproved(format(new Date(menu.weekOf), "MMMM d"));
                                  }
                                }}
                                disabled={isUpdating}
                                data-testid={`button-approve-menu-${menu.id}`}
                              >
                                {isUpdating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle className="w-4 h-4 mr-2" />} Approve
                              </Button>
                              <Button
                                variant="outline"
                                className="flex-1 border-white/[0.14] text-neutral-400 hover:text-white hover:border-white/[0.2] rounded-sm font-display font-bold uppercase tracking-wider"
                                onClick={() => { setReviewMenu(menu); setAdminNotes(""); }}
                                data-testid={`button-request-changes-${menu.id}`}
                              >
                                <MessageSquare className="w-4 h-4 mr-2" /> Request Changes
                              </Button>
                            </div>
                            {menu.status === "draft" && (
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="destructive" size="sm" className="w-full rounded-sm font-display font-bold uppercase tracking-wider" data-testid={`button-delete-menu-${menu.id}`}>
                                    <Trash2 className="w-4 h-4 mr-2" /> Delete Draft
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent className="bg-[#1A1A1A] border border-white/[0.1] rounded-sm">
                                  <AlertDialogHeader>
                                    <AlertDialogTitle className="font-display font-bold uppercase tracking-wide text-white">Delete Draft Menu</AlertDialogTitle>
                                    <AlertDialogDescription className="text-neutral-400">
                                      Only draft menus can be deleted. Submitted menus are retained to preserve operational history.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel className="border-white/[0.14] text-neutral-400 hover:text-white hover:border-white/[0.2] rounded-sm">Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => deleteMenu(menu.id)} disabled={isDeleting}>
                                      Delete
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            )}
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </TabsContent>

                {/* All Menus Tab */}
                <TabsContent value="all">
                  {!menus || menus.length === 0 ? (
                    <Card className="bg-[#1A1A1A] border border-white/[0.10] border-dashed rounded-sm">
                      <CardContent className="py-8 text-center text-neutral-500">
                        <Calendar className="w-10 h-10 mx-auto mb-3 opacity-50" />
                        <p className="font-medium text-white">No menus created yet</p>
                        <p className="text-sm mt-1">Published, pending, and revision-needed menus will all appear here.</p>
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="space-y-4">
                      {menus.map((menu) => (
                        <Card key={menu.id} className="bg-[#1A1A1A] border border-white/[0.10] rounded-sm hover:border-white/[0.1] transition-colors">
                          <CardHeader className="pb-3 bg-[#161616] border-b border-white/[0.10]">
                            <div className="flex justify-between items-start gap-2">
                              <div>
                                <CardTitle className="font-display font-bold uppercase tracking-wide text-white">Week of {format(new Date(menu.weekOf), "MMMM d, yyyy")}</CardTitle>
                                <CardDescription className="mt-1 font-medium text-amber-500">
                                  {menu.fraternity} • {menu.items.length} items
                                </CardDescription>
                              </div>
                              <Badge variant="outline" className={
                                menu.status === 'approved' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-sm uppercase text-[10px] tracking-wider font-bold' :
                                menu.status === 'pending' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-sm uppercase text-[10px] tracking-wider font-bold' :
                                menu.status === 'needs_revision' ? 'bg-red-500/10 text-red-400 border border-red-500/20 rounded-sm uppercase text-[10px] tracking-wider font-bold' :
                                'bg-neutral-500/10 text-neutral-400 border border-neutral-500/20 rounded-sm uppercase text-[10px] tracking-wider font-bold'
                              }>
                                {menu.status === 'needs_revision' ? 'Needs Revision' : menu.status}
                              </Badge>
                            </div>
                          </CardHeader>
                          <CardContent className="space-y-3">
                            <Button
                              variant="outline"
                              className="w-full border-white/[0.14] text-neutral-400 hover:text-white hover:border-white/[0.2] rounded-sm font-display font-bold uppercase tracking-wider"
                              onClick={() => setViewMenu(menu)}
                              data-testid={`button-view-all-menu-${menu.id}`}
                            >
                              <Eye className="w-4 h-4 mr-2" /> View Full Menu
                            </Button>
                            {menu.status === "draft" && (
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="destructive" size="sm" className="w-full rounded-sm font-display font-bold uppercase tracking-wider" data-testid={`button-delete-all-menu-${menu.id}`}>
                                    <Trash2 className="w-4 h-4 mr-2" /> Delete Draft
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent className="bg-[#1A1A1A] border border-white/[0.1] rounded-sm">
                                  <AlertDialogHeader>
                                    <AlertDialogTitle className="font-display font-bold uppercase tracking-wide text-white">Delete Draft Menu</AlertDialogTitle>
                                    <AlertDialogDescription className="text-neutral-400">
                                      Only draft menus can be deleted. Submitted menus are retained to preserve operational history.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel className="border-white/[0.14] text-neutral-400 hover:text-white hover:border-white/[0.2] rounded-sm">Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => deleteMenu(menu.id)} disabled={isDeleting}>
                                      Delete
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            )}
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
                <h2 className="font-display font-bold text-xl uppercase tracking-wide text-white flex items-center gap-2">
                  <UserPlus className="w-5 h-5 text-amber-500" />
                  Manage Chefs
                </h2>
                <Dialog open={createChefOpen} onOpenChange={setCreateChefOpen}>
                  <DialogTrigger asChild>
                    <Button className="bg-amber-500 hover:bg-amber-400 text-black font-display font-bold uppercase tracking-wider rounded-sm shadow-sm">Add New Chef</Button>
                  </DialogTrigger>
                  <DialogContent className="bg-[#1A1A1A] border border-white/[0.1] rounded-sm">
                    <DialogHeader>
                      <DialogTitle className="font-display font-bold uppercase tracking-wide text-white text-xl">Add New Chef</DialogTitle>
                      <DialogDescription className="text-neutral-400">Create a chef profile and assign them to a fraternity.</DialogDescription>
                    </DialogHeader>
                    <form onSubmit={form.handleSubmit(handleCreateChef)} className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label className="text-xs font-bold uppercase tracking-wider text-neutral-500 font-display">Full Name</Label>
                        <Input {...form.register("name")} className="bg-[#1A1A1A] border-white/[0.14] text-white rounded-sm placeholder:text-neutral-500" />
                        {form.formState.errors.name && <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>}
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs font-bold uppercase tracking-wider text-neutral-500 font-display">Email</Label>
                        <Input type="email" {...form.register("email")} className="bg-[#1A1A1A] border-white/[0.14] text-white rounded-sm placeholder:text-neutral-500" />
                        {form.formState.errors.email && <p className="text-xs text-destructive">{form.formState.errors.email.message}</p>}
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs font-bold uppercase tracking-wider text-neutral-500 font-display">Password</Label>
                        <Input type="password" {...form.register("password")} className="bg-[#1A1A1A] border-white/[0.14] text-white rounded-sm placeholder:text-neutral-500" />
                        {form.formState.errors.password && <p className="text-xs text-destructive">{form.formState.errors.password.message}</p>}
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs font-bold uppercase tracking-wider text-neutral-500 font-display">Fraternity Assignment</Label>
                        <Select onValueChange={(val) => form.setValue("fraternity", val as any)} defaultValue={form.getValues("fraternity")}>
                          <SelectTrigger className="bg-[#1A1A1A] border-white/[0.14] text-white rounded-sm h-10">
                            <SelectValue placeholder="Select fraternity" />
                          </SelectTrigger>
                          <SelectContent className="bg-[#1E1E1E] border-white/[0.1] rounded-sm">
                            {FRATERNITIES.map((frat) => (
                              <SelectItem key={frat} value={frat} className="hover:bg-white/[0.06] focus:bg-white/[0.06] text-neutral-300 rounded-sm">{frat}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <DialogFooter>
                        <Button type="submit" disabled={isCreatingChef} className="bg-amber-500 hover:bg-amber-400 text-black font-display font-bold uppercase tracking-wider rounded-sm">
                          {isCreatingChef ? "Creating..." : "Create Chef Account"}
                        </Button>
                      </DialogFooter>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                {activeChefs.map((chef) => (
                  <Card key={chef.id} data-testid={`card-chef-${chef.id}`} className="bg-[#1A1A1A] border border-white/[0.10] rounded-sm">
                    <CardHeader className="p-4 bg-[#161616] border-b border-white/[0.10]">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-amber-500/15 flex items-center justify-center text-amber-600 font-bold">
                            {chef.name.charAt(0)}
                          </div>
                          <div>
                            <h4 className="font-display font-bold text-white">{chef.name}</h4>
                            <p className="text-xs text-neutral-500">{chef.fraternity}</p>
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
                            <AlertDialogContent className="bg-[#1A1A1A] border border-white/[0.1] rounded-sm">
                              <AlertDialogHeader>
                                <AlertDialogTitle className="font-display font-bold uppercase tracking-wide text-white">Delete Chef</AlertDialogTitle>
                                <AlertDialogDescription className="text-neutral-400">
                                  Are you sure you want to delete {chef.name}? This will also delete all tasks assigned to this chef. This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel className="border-white/[0.14] text-neutral-400 hover:text-white hover:border-white/[0.2] rounded-sm">Cancel</AlertDialogCancel>
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
                <h2 className="font-display font-bold text-xl uppercase tracking-wide text-white flex items-center gap-2">
                  <ListTodo className="w-5 h-5 text-amber-500" />
                  Chef Tasks & Reminders
                </h2>
                <Dialog open={createTaskOpen} onOpenChange={setCreateTaskOpen}>
                  <DialogTrigger asChild>
                    <Button className="bg-amber-500 hover:bg-amber-400 text-black font-display font-bold uppercase tracking-wider rounded-sm shadow-sm" data-testid="button-add-task">
                      <Plus className="w-4 h-4 mr-2" /> Add Task
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="bg-[#1A1A1A] border border-white/[0.1] rounded-sm">
                    <DialogHeader>
                      <DialogTitle className="font-display font-bold uppercase tracking-wide text-white text-xl">Create Task for Chef</DialogTitle>
                      <DialogDescription className="text-neutral-400">Assign a task or reminder to a specific chef.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label className="text-xs font-bold uppercase tracking-wider text-neutral-500 font-display">Chef</Label>
                        <Select value={newTaskChefId} onValueChange={setNewTaskChefId}>
                          <SelectTrigger data-testid="select-task-chef" className="bg-[#1A1A1A] border-white/[0.14] text-white rounded-sm h-10">
                            <SelectValue placeholder="Select a chef" />
                          </SelectTrigger>
                          <SelectContent className="bg-[#1E1E1E] border-white/[0.1] rounded-sm">
                            {activeChefs.map((chef) => (
                              <SelectItem key={chef.id} value={String(chef.id)} className="hover:bg-white/[0.06] focus:bg-white/[0.06] text-neutral-300 rounded-sm">
                                {chef.name} ({chef.fraternity})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs font-bold uppercase tracking-wider text-neutral-500 font-display">Task Title</Label>
                        <Input
                          value={newTaskTitle}
                          onChange={(e) => setNewTaskTitle(e.target.value)}
                          placeholder="e.g., Update weekly menu"
                          data-testid="input-task-title"
                          className="bg-[#1A1A1A] border-white/[0.14] text-white rounded-sm placeholder:text-neutral-500"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs font-bold uppercase tracking-wider text-neutral-500 font-display">Description (optional)</Label>
                        <Textarea
                          value={newTaskDescription}
                          onChange={(e) => setNewTaskDescription(e.target.value)}
                          placeholder="Additional details..."
                          data-testid="input-task-description"
                          className="bg-[#1A1A1A] border-white/[0.14] text-white rounded-sm placeholder:text-neutral-500 resize-none"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label className="text-xs font-bold uppercase tracking-wider text-neutral-500 font-display">Priority</Label>
                          <Select value={newTaskPriority} onValueChange={setNewTaskPriority}>
                            <SelectTrigger data-testid="select-task-priority" className="bg-[#1A1A1A] border-white/[0.14] text-white rounded-sm h-10">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-[#1E1E1E] border-white/[0.1] rounded-sm">
                              <SelectItem value="low" className="hover:bg-white/[0.06] focus:bg-white/[0.06] text-neutral-300 rounded-sm">Low</SelectItem>
                              <SelectItem value="medium" className="hover:bg-white/[0.06] focus:bg-white/[0.06] text-neutral-300 rounded-sm">Medium</SelectItem>
                              <SelectItem value="high" className="hover:bg-white/[0.06] focus:bg-white/[0.06] text-neutral-300 rounded-sm">High</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs font-bold uppercase tracking-wider text-neutral-500 font-display">Due Date (optional)</Label>
                          <Input
                            type="date"
                            value={newTaskDueDate}
                            onChange={(e) => setNewTaskDueDate(e.target.value)}
                            data-testid="input-task-due-date"
                            className="bg-[#1A1A1A] border-white/[0.14] text-white rounded-sm"
                          />
                        </div>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setCreateTaskOpen(false)} className="border-white/[0.14] text-neutral-400 hover:text-white hover:border-white/[0.2] rounded-sm">Cancel</Button>
                      <Button
                        onClick={handleCreateTask}
                        disabled={isCreatingTask || !newTaskChefId || !newTaskTitle.trim()}
                        data-testid="button-submit-task"
                        className="bg-amber-500 hover:bg-amber-400 text-black font-display font-bold uppercase tracking-wider rounded-sm"
                      >
                        {isCreatingTask ? "Creating..." : "Create Task"}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>

              {isLoadingChefs || isLoadingTasks ? (
                <Card className="bg-[#1A1A1A] border border-white/[0.10] border-dashed rounded-sm">
                  <CardContent className="py-8 text-center text-neutral-500">
                    Loading...
                  </CardContent>
                </Card>
              ) : activeChefs.length === 0 ? (
                <Card className="bg-[#1A1A1A] border border-white/[0.10] border-dashed rounded-sm">
                  <CardContent className="py-8 text-center text-neutral-500">
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
                      <Card key={chef.id} data-testid={`card-chef-tasks-${chef.id}`} className="bg-[#1A1A1A] border border-white/[0.10] rounded-sm">
                        <CardHeader className="pb-2 bg-[#161616] border-b border-white/[0.10]">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-amber-500/15 flex items-center justify-center text-amber-600 font-bold text-sm">
                                {chef.name.charAt(0)}
                              </div>
                              <div>
                                <CardTitle className="font-display font-bold uppercase tracking-wide text-white text-base">{chef.name}</CardTitle>
                                <CardDescription className="text-neutral-500">{chef.fraternity}</CardDescription>
                              </div>
                            </div>
                            <Badge variant="outline" className="bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-sm uppercase text-[10px] tracking-wider font-bold">
                              {incompleteTasks.length} active task{incompleteTasks.length !== 1 ? 's' : ''}
                            </Badge>
                          </div>
                        </CardHeader>
                        <CardContent>
                          {chefTasks.length === 0 ? (
                            <p className="text-sm text-neutral-500">No tasks assigned</p>
                          ) : (
                            <div className="space-y-2">
                              {incompleteTasks.map((task: any) => (
                                <div key={task.id} className="flex items-start justify-between gap-2 p-2 bg-white/[0.03] rounded-sm" data-testid={`task-admin-${task.id}`}>
                                  <div className="flex-1">
                                    <div className="font-medium text-sm text-white">{task.title}</div>
                                    {task.description && <p className="text-xs text-neutral-500">{task.description}</p>}
                                    <div className="flex gap-2 mt-1">
                                      <Badge variant="outline" className={
                                        task.priority === 'high' ? 'bg-red-500/10 text-red-400 border border-red-500/20 rounded-sm uppercase text-[10px] tracking-wider font-bold' :
                                        task.priority === 'medium' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-sm uppercase text-[10px] tracking-wider font-bold' :
                                        'bg-neutral-500/10 text-neutral-400 border border-neutral-500/20 rounded-sm uppercase text-[10px] tracking-wider font-bold'
                                      }>
                                        {task.priority}
                                      </Badge>
                                      {task.dueDate && (
                                        <Badge variant="outline" className="bg-neutral-500/10 text-neutral-400 border border-neutral-500/20 rounded-sm uppercase text-[10px] tracking-wider font-bold">
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
                                    <AlertDialogContent className="bg-[#1A1A1A] border border-white/[0.1] rounded-sm">
                                      <AlertDialogHeader>
                                        <AlertDialogTitle className="font-display font-bold uppercase tracking-wide text-white">Delete Task?</AlertDialogTitle>
                                        <AlertDialogDescription className="text-neutral-400">
                                          Are you sure you want to delete this task? This action cannot be undone.
                                        </AlertDialogDescription>
                                      </AlertDialogHeader>
                                      <AlertDialogFooter>
                                        <AlertDialogCancel className="border-white/[0.14] text-neutral-400 hover:text-white hover:border-white/[0.2] rounded-sm">Cancel</AlertDialogCancel>
                                        <AlertDialogAction onClick={() => deleteTask(task.id)}>Delete</AlertDialogAction>
                                      </AlertDialogFooter>
                                    </AlertDialogContent>
                                  </AlertDialog>
                                </div>
                              ))}
                              {completedTasks.length > 0 && (
                                <div className="pt-2 border-t border-white/[0.10]">
                                  <p className="text-xs text-neutral-500 mb-2">{completedTasks.length} completed</p>
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
                <h2 className="font-display font-bold text-xl uppercase tracking-wide text-white flex items-center gap-2">
                  <Home className="w-5 h-5 text-amber-500" />
                  House Directors
                </h2>
                <Dialog open={createHDOpen} onOpenChange={setCreateHDOpen}>
                  <DialogTrigger asChild>
                    <Button className="bg-amber-500 hover:bg-amber-400 text-black font-display font-bold uppercase tracking-wider rounded-sm shadow-sm" data-testid="button-add-house-director">
                      <Plus className="w-4 h-4 mr-2" /> Add House Director
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="bg-[#1A1A1A] border border-white/[0.1] rounded-sm">
                    <DialogHeader>
                      <DialogTitle className="font-display font-bold uppercase tracking-wide text-white text-xl">Add House Director</DialogTitle>
                      <DialogDescription className="text-neutral-400">Create a house director profile. A temporary password will be generated automatically and sent via email.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label htmlFor="hd-name" className="text-xs font-bold uppercase tracking-wider text-neutral-500 font-display">Name</Label>
                        <Input
                          id="hd-name"
                          value={hdName}
                          onChange={(e) => setHDName(e.target.value)}
                          placeholder="John Smith"
                          data-testid="input-hd-name"
                          className="bg-[#1A1A1A] border-white/[0.14] text-white rounded-sm placeholder:text-neutral-500"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="hd-email" className="text-xs font-bold uppercase tracking-wider text-neutral-500 font-display">Email</Label>
                        <Input
                          id="hd-email"
                          type="email"
                          value={hdEmail}
                          onChange={(e) => setHDEmail(e.target.value)}
                          placeholder="john@university.edu"
                          data-testid="input-hd-email"
                          className="bg-[#1A1A1A] border-white/[0.14] text-white rounded-sm placeholder:text-neutral-500"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs font-bold uppercase tracking-wider text-neutral-500 font-display">Fraternity</Label>
                        <Select value={hdFraternity} onValueChange={setHDFraternity}>
                          <SelectTrigger data-testid="select-hd-fraternity" className="bg-[#1A1A1A] border-white/[0.14] text-white rounded-sm h-10">
                            <SelectValue placeholder="Select fraternity" />
                          </SelectTrigger>
                          <SelectContent className="bg-[#1E1E1E] border-white/[0.1] rounded-sm">
                            {FRATERNITIES.map(f => (
                              <SelectItem key={f} value={f} className="hover:bg-white/[0.06] focus:bg-white/[0.06] text-neutral-300 rounded-sm">{f}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="hd-phone" className="text-xs font-bold uppercase tracking-wider text-neutral-500 font-display">Phone Number (optional)</Label>
                        <Input
                          id="hd-phone"
                          type="tel"
                          value={hdPhone}
                          onChange={(e) => setHDPhone(e.target.value)}
                          placeholder="+1 555 123 4567"
                          data-testid="input-hd-phone"
                          className="bg-[#1A1A1A] border-white/[0.14] text-white rounded-sm placeholder:text-neutral-500"
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button
                        onClick={() => {
                          if (!hdName || !hdEmail || !hdFraternity) return;
                          createHouseDirectorMutation.mutate({
                            name: hdName,
                            email: hdEmail,
                            fraternity: hdFraternity,
                            phoneNumber: hdPhone || undefined,
                          }, {
                            onSuccess: () => {
                              toast({ title: "House director created", description: "A welcome email with login credentials has been sent." });
                              setCreateHDOpen(false);
                              setHDName("");
                              setHDEmail("");
                              setHDPhone("");
                            }
                          });
                        }}
                        disabled={createHouseDirectorMutation.isPending || !hdName || !hdEmail}
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
                <Card className="bg-[#1A1A1A] border border-white/[0.10] rounded-sm">
                  <CardContent className="py-8 text-center text-neutral-500">
                    No house directors yet. Click "Add House Director" to create one.
                  </CardContent>
                </Card>
              ) : (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {houseDirectors.map((hd: any) => (
                    <Card key={hd.id} data-testid={`hd-card-${hd.id}`} className="bg-[#1A1A1A] border border-white/[0.10] rounded-sm relative overflow-visible">
                      <CardHeader className="pb-2 bg-[#161616] border-b border-white/[0.10]">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <CardTitle className="font-display font-bold uppercase tracking-wide text-white text-lg truncate">{hd.name}</CardTitle>
                            <CardDescription className="text-neutral-500 truncate">{hd.email}</CardDescription>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <Badge variant="outline" className="bg-neutral-500/10 text-neutral-400 border border-neutral-500/20 rounded-sm uppercase text-[10px] tracking-wider font-bold">{hd.fraternity}</Badge>
                            <Button size="icon" variant="ghost" data-testid={`button-edit-hd-${hd.id}`} onClick={() => openEditHD(hd)}>
                              <Pencil className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="text-sm text-neutral-500">
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
                <h2 className="font-display font-bold text-xl uppercase tracking-wide text-white flex items-center gap-2">
                  <ClipboardList className="w-5 h-5 text-amber-500" />
                  House Director Notes
                  {unacknowledgedCritiques.length > 0 && (
                    <Badge variant="outline" className="bg-red-500/10 text-red-400 border border-red-500/20 rounded-sm uppercase text-[10px] tracking-wider font-bold">{unacknowledgedCritiques.length} pending</Badge>
                  )}
                </h2>
              </div>
              
              {isLoadingCritiques ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                </div>
              ) : !critiques || critiques.length === 0 ? (
                <Card className="bg-[#1A1A1A] border border-white/[0.10] rounded-sm">
                  <CardContent className="py-8 text-center text-neutral-500">
                    No house director notes yet.
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-4">
                  {critiques.map((critique: any) => {
                    const menu = menus?.find((m: any) => m.id === critique.menuId);
                    return (
                      <Card key={critique.id} className={`bg-[#1A1A1A] border border-white/[0.10] rounded-sm ${!critique.acknowledgedByAdmin ? "border-l-4 border-l-amber-500" : ""}`} data-testid={`critique-card-${critique.id}`}>
                        <CardHeader className="pb-2 bg-[#161616] border-b border-white/[0.10]">
                          <div className="flex items-center justify-between flex-wrap gap-2">
                            <div>
                              <CardTitle className="font-display font-bold uppercase tracking-wide text-white text-base">
                                {menu ? `Week of ${format(parseISO(menu.weekOf), "MMM d, yyyy")}` : `Menu #${critique.menuId}`}
                              </CardTitle>
                              <CardDescription className="text-neutral-500">
                                {critique.fraternity} | Submitted {format(parseISO(critique.createdAt), "MMM d 'at' h:mm a")}
                              </CardDescription>
                            </div>
                            <div className="flex items-center gap-2">
                              {critique.acknowledgedByAdmin ? (
                                <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-sm uppercase text-[10px] tracking-wider font-bold">
                                  <CheckCircle className="w-3 h-3 mr-1" /> Reviewed
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
                                      Mark Reviewed
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
                              <p className="text-sm font-medium text-white">Note:</p>
                              <p className="text-sm text-neutral-400">{critique.critiqueText}</p>
                            </div>
                          )}
                          {critique.suggestedEdits && (
                            <div>
                              <p className="text-sm font-medium text-white">Suggested Edits:</p>
                              <p className="text-sm text-neutral-400">{critique.suggestedEdits}</p>
                            </div>
                          )}
                          <div className="mt-3 text-xs text-neutral-500">
                            Admin review: {critique.acknowledgedByAdmin ? "Reviewed" : "Pending"}
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
            <Card className="bg-[#1A1A1A] border border-white/[0.10] rounded-sm relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-px bg-amber-500/40" />
              <CardHeader className="bg-[#161616] border-b border-white/[0.10]">
                <CardTitle className="font-display font-bold uppercase tracking-wide text-white text-lg">System Status</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-neutral-400">Active Chefs</span>
                  <span className="font-black text-2xl text-amber-400">{activeChefs.length}</span>
                </div>
                <div className="h-px bg-white/10" />
                <div className="flex justify-between items-center">
                  <span className="text-neutral-400">Pending Menus</span>
                  <span className="font-black text-2xl text-amber-400">{pendingMenus.length}</span>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-[#1A1A1A] border border-white/[0.10] rounded-sm">
              <CardHeader className="bg-[#161616] border-b border-white/[0.10]">
                <CardTitle className="font-display font-bold uppercase tracking-wide text-white text-lg">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-2">
                <Button
                  variant="outline"
                  className="justify-start border-white/[0.14] text-neutral-400 hover:text-white hover:border-white/[0.2] rounded-sm font-display font-bold uppercase tracking-wider"
                  onClick={() => setFeedbackDialogOpen(true)}
                  data-testid="button-view-all-feedback"
                >
                  <Star className="w-4 h-4 mr-2" /> View All Feedback
                </Button>
                <Button
                  variant="outline"
                  className="justify-start border-white/[0.14] text-neutral-400 hover:text-white hover:border-white/[0.2] rounded-sm font-display font-bold uppercase tracking-wider"
                  onClick={() => setRequestsDialogOpen(true)}
                  data-testid="button-request-history"
                >
                  <FileText className="w-4 h-4 mr-2" /> Request History
                </Button>
                <Button
                  variant="outline"
                  className="justify-start border-white/[0.14] text-neutral-400 hover:text-white hover:border-white/[0.2] rounded-sm font-display font-bold uppercase tracking-wider"
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
          <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto bg-[#1A1A1A] border border-white/[0.1] rounded-sm">
            <DialogHeader>
              <DialogTitle className="font-display font-bold uppercase tracking-wide text-white text-xl flex items-center gap-2">
                <Eye className="w-5 h-5" />
                Menu for {viewMenu && format(new Date(viewMenu.weekOf), "MMMM d, yyyy")}
              </DialogTitle>
              <DialogDescription className="text-neutral-400">
                {viewMenu?.fraternity} - Status: {viewMenu?.status}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              {DAYS.map(day => {
                const dayItems = viewMenu?.items?.filter((item: any) => item.day === day) || [];
                if (dayItems.length === 0) return null;
                return (
                  <div key={day} className="border border-white/[0.10] rounded-sm p-4">
                    <h3 className="font-display font-bold text-lg text-white uppercase tracking-wide mb-3">{day}</h3>
                    <div className="space-y-3">
                      {dayItems.map((item: any) => (
                        <div key={item.id} className="bg-white/[0.03] rounded-sm p-3">
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <span className="font-medium text-white">{item.meal}</span>
                              <p className="text-sm mt-1 text-neutral-400">{item.description}</p>
                              {(item.side1 || item.side2 || item.side3) && (
                                <div className="flex flex-wrap gap-1 mt-2">
                                  {item.side1 && <Badge variant="outline" className="bg-neutral-500/10 text-neutral-400 border border-neutral-500/20 rounded-sm text-[10px] tracking-wider font-bold">{item.side1}</Badge>}
                                  {item.side2 && <Badge variant="outline" className="bg-neutral-500/10 text-neutral-400 border border-neutral-500/20 rounded-sm text-[10px] tracking-wider font-bold">{item.side2}</Badge>}
                                  {item.side3 && <Badge variant="outline" className="bg-neutral-500/10 text-neutral-400 border border-neutral-500/20 rounded-sm text-[10px] tracking-wider font-bold">{item.side3}</Badge>}
                                </div>
                              )}
                            </div>
                            <Badge variant="outline" className="bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-sm uppercase text-[10px] tracking-wider font-bold">{item.calories} cal</Badge>
                          </div>
                          <div className="flex gap-4 text-xs text-neutral-500 mt-2">
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
              <Button variant="outline" onClick={() => setViewMenu(null)} data-testid="button-close-view-menu" className="border-white/[0.14] text-neutral-400 hover:text-white hover:border-white/[0.2] rounded-sm">Close</Button>
              <Button
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-display font-bold uppercase tracking-wider rounded-sm shadow-sm"
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
          <DialogContent className="max-w-lg bg-[#1A1A1A] border border-white/[0.1] rounded-sm">
            <DialogHeader>
              <DialogTitle className="font-display font-bold uppercase tracking-wide text-white text-xl flex items-center gap-2">
                <MessageSquare className="w-5 h-5" />
                Request Menu Changes
              </DialogTitle>
              <DialogDescription className="text-neutral-400">
                Send feedback to the chef for: Week of {reviewMenu && format(new Date(reviewMenu.weekOf), "MMMM d, yyyy")}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-neutral-500 font-display">Notes & Suggestions for the Chef</Label>
                <Textarea
                  placeholder="Enter your feedback, suggestions, or required changes here..."
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  rows={6}
                  data-testid="input-admin-notes"
                  className="bg-[#1A1A1A] border-white/[0.14] text-white rounded-sm placeholder:text-neutral-500 resize-none"
                />
                <p className="text-xs text-neutral-500">
                  The chef will see these notes and can make corrections before resubmitting.
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setReviewMenu(null)} data-testid="button-cancel-revision" className="border-white/[0.14] text-neutral-400 hover:text-white hover:border-white/[0.2] rounded-sm">Cancel</Button>
              <Button
                className="bg-amber-500 hover:bg-amber-400 text-black font-display font-bold uppercase tracking-wider rounded-sm"
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
          <DialogContent className="max-w-md bg-[#1A1A1A] border border-white/[0.1] rounded-sm">
            <DialogHeader>
              <DialogTitle className="font-display font-bold uppercase tracking-wide text-white text-xl flex items-center gap-2">
                <Eye className="w-5 h-5" />
                Chef Profile
              </DialogTitle>
              <DialogDescription className="text-neutral-400">
                View chef account details
              </DialogDescription>
            </DialogHeader>
            {viewChef && (
              <div className="space-y-4 py-4">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-full bg-amber-500/15 flex items-center justify-center text-amber-600 font-bold text-2xl">
                    {viewChef.name?.charAt(0) || "?"}
                  </div>
                  <div>
                    <h3 className="text-lg font-display font-bold text-white" data-testid="text-chef-name">{viewChef.name}</h3>
                    <p className="text-sm text-neutral-500">{viewChef.fraternity}</p>
                  </div>
                </div>
                <div className="grid gap-3 pt-4 border-t border-white/[0.10]">
                  <div className="flex justify-between">
                    <span className="text-neutral-500">Email</span>
                    <span className="font-medium text-white" data-testid="text-chef-email">{viewChef.email}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-500">Role</span>
                    <Badge variant="outline" className="bg-neutral-500/10 text-neutral-400 border border-neutral-500/20 rounded-sm uppercase text-[10px] tracking-wider font-bold">{viewChef.role}</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-500">Phone</span>
                    <span className="font-medium text-white" data-testid="text-chef-phone">{viewChef.phoneNumber || "Not set"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-500">Assigned Tasks</span>
                    <span className="font-medium text-white">{tasksByChef[viewChef.id]?.length || 0}</span>
                  </div>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setViewChef(null)} data-testid="button-close-chef-dialog" className="border-white/[0.14] text-neutral-400 hover:text-white hover:border-white/[0.2] rounded-sm">Close</Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" data-testid="button-delete-chef-from-dialog">
                    <Trash2 className="w-4 h-4 mr-2" /> Delete Chef
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="bg-[#1A1A1A] border border-white/[0.1] rounded-sm">
                  <AlertDialogHeader>
                    <AlertDialogTitle className="font-display font-bold uppercase tracking-wide text-white">Delete Chef</AlertDialogTitle>
                    <AlertDialogDescription className="text-neutral-400">
                      Are you sure you want to delete {viewChef?.name}? This will also delete all tasks assigned to this chef. This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel className="border-white/[0.14] text-neutral-400 hover:text-white hover:border-white/[0.2] rounded-sm">Cancel</AlertDialogCancel>
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
          <DialogContent className="max-w-2xl max-h-[80vh] bg-[#1A1A1A] border border-white/[0.1] rounded-sm">
            <DialogHeader>
              <DialogTitle className="font-display font-bold uppercase tracking-wide text-white text-xl flex items-center gap-2">
                <Star className="w-5 h-5" />
                All Feedback
              </DialogTitle>
              <DialogDescription className="text-neutral-400">
                View all user feedback across fraternities
              </DialogDescription>
            </DialogHeader>
            <div className="mb-4">
              <Select value={selectedFraternity} onValueChange={setSelectedFraternity}>
                <SelectTrigger data-testid="select-feedback-fraternity" className="bg-[#1A1A1A] border-white/[0.14] text-white rounded-sm h-10">
                  <SelectValue placeholder="Filter by fraternity" />
                </SelectTrigger>
                <SelectContent className="bg-[#1E1E1E] border-white/[0.1] rounded-sm">
                  <SelectItem value="all" className="hover:bg-white/[0.06] focus:bg-white/[0.06] text-neutral-300 rounded-sm">All Fraternities</SelectItem>
                  {FRATERNITIES.map((frat) => (
                    <SelectItem key={frat} value={frat} className="hover:bg-white/[0.06] focus:bg-white/[0.06] text-neutral-300 rounded-sm">{frat}</SelectItem>
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
                <div className="text-center py-8 text-neutral-500">
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
                        <div key={fb.id} className="p-3 border border-white/[0.10] rounded-sm" data-testid={`feedback-item-${fb.id}`}>
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <span className="font-medium text-white">{fb.userName || 'Anonymous'}</span>
                              <Badge variant="outline" className="ml-2 bg-neutral-500/10 text-neutral-400 border border-neutral-500/20 rounded-sm uppercase text-[10px] tracking-wider font-bold">{menu?.fraternity}</Badge>
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
                          <div className="text-sm text-neutral-500 mb-1">
                            {fb.mealDay} {fb.mealType} - Week of {menu?.weekOf ? format(parseISO(menu.weekOf), "MMM d") : 'Unknown'}
                          </div>
                          {fb.comment && <p className="text-sm text-neutral-300">{fb.comment}</p>}
                        </div>
                      );
                    })}
                </div>
              )}
            </ScrollArea>
            <DialogFooter>
              <Button variant="outline" onClick={() => setFeedbackDialogOpen(false)} data-testid="button-close-feedback-dialog" className="border-white/[0.14] text-neutral-400 hover:text-white hover:border-white/[0.2] rounded-sm">Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Request History Dialog */}
        <Dialog open={requestsDialogOpen} onOpenChange={setRequestsDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[80vh] bg-[#1A1A1A] border border-white/[0.1] rounded-sm">
            <DialogHeader>
              <DialogTitle className="font-display font-bold uppercase tracking-wide text-white text-xl flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Request History
              </DialogTitle>
              <DialogDescription className="text-neutral-400">
                View all user requests (substitutions, menu suggestions)
              </DialogDescription>
            </DialogHeader>
            <div className="mb-4">
              <Select value={selectedFraternity} onValueChange={setSelectedFraternity}>
                <SelectTrigger data-testid="select-requests-fraternity" className="bg-[#1A1A1A] border-white/[0.14] text-white rounded-sm h-10">
                  <SelectValue placeholder="Filter by fraternity" />
                </SelectTrigger>
                <SelectContent className="bg-[#1E1E1E] border-white/[0.1] rounded-sm">
                  <SelectItem value="all" className="hover:bg-white/[0.06] focus:bg-white/[0.06] text-neutral-300 rounded-sm">All Fraternities</SelectItem>
                  {FRATERNITIES.map((frat) => (
                    <SelectItem key={frat} value={frat} className="hover:bg-white/[0.06] focus:bg-white/[0.06] text-neutral-300 rounded-sm">{frat}</SelectItem>
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
                <div className="text-center py-8 text-neutral-500">
                  No requests yet
                </div>
              ) : (
                <div className="space-y-3">
                  {allRequests
                    .filter((req: any) => req.type === 'substitution' || req.type === 'menu_suggestion')
                    .filter((req: any) => selectedFraternity === "all" || req.fraternity === selectedFraternity)
                    .map((req: any) => (
                      <div key={req.id} className="p-3 border border-white/[0.10] rounded-sm" data-testid={`request-item-${req.id}`}>
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-white">{req.user?.name || 'Unknown'}</span>
                            <Badge variant="outline" className={req.type === 'substitution' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-sm uppercase text-[10px] tracking-wider font-bold' : 'bg-neutral-500/10 text-neutral-400 border border-neutral-500/20 rounded-sm uppercase text-[10px] tracking-wider font-bold'}>
                              {req.type === 'substitution' ? 'Substitution' : 'Menu Suggestion'}
                            </Badge>
                            {req.status && req.status !== 'pending' && (
                              <Badge variant="outline" className={req.status === 'approved' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-sm uppercase text-[10px] tracking-wider font-bold' : 'bg-red-500/10 text-red-400 border border-red-500/20 rounded-sm uppercase text-[10px] tracking-wider font-bold'}>
                                {req.status}
                              </Badge>
                            )}
                          </div>
                          <Badge variant="outline" className="bg-neutral-500/10 text-neutral-400 border border-neutral-500/20 rounded-sm uppercase text-[10px] tracking-wider font-bold">{req.fraternity}</Badge>
                        </div>
                        <p className="text-sm text-neutral-500 mb-1">
                          {req.date ? format(parseISO(req.date), "MMM d, yyyy") : 'Unknown date'}
                        </p>
                        <p className="text-sm text-neutral-300">{req.details}</p>
                      </div>
                    ))}
                </div>
              )}
            </ScrollArea>
            <DialogFooter>
              <Button variant="outline" onClick={() => setRequestsDialogOpen(false)} data-testid="button-close-requests-dialog" className="border-white/[0.14] text-neutral-400 hover:text-white hover:border-white/[0.2] rounded-sm">Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Late Plates Dialog */}
        <Dialog open={latePlatesDialogOpen} onOpenChange={setLatePlatesDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[80vh] bg-[#1A1A1A] border border-white/[0.1] rounded-sm">
            <DialogHeader>
              <DialogTitle className="font-display font-bold uppercase tracking-wide text-white text-xl flex items-center gap-2">
                <Clock className="w-5 h-5" />
                Late Plates
              </DialogTitle>
              <DialogDescription className="text-neutral-400">
                View late plate requests by fraternity
              </DialogDescription>
            </DialogHeader>
            <div className="mb-4">
              <Select value={selectedFraternity} onValueChange={setSelectedFraternity}>
                <SelectTrigger data-testid="select-lateplates-fraternity" className="bg-[#1A1A1A] border-white/[0.14] text-white rounded-sm h-10">
                  <SelectValue placeholder="Filter by fraternity" />
                </SelectTrigger>
                <SelectContent className="bg-[#1E1E1E] border-white/[0.1] rounded-sm">
                  <SelectItem value="all" className="hover:bg-white/[0.06] focus:bg-white/[0.06] text-neutral-300 rounded-sm">All Fraternities</SelectItem>
                  {FRATERNITIES.map((frat) => (
                    <SelectItem key={frat} value={frat} className="hover:bg-white/[0.06] focus:bg-white/[0.06] text-neutral-300 rounded-sm">{frat}</SelectItem>
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
                <div className="text-center py-8 text-neutral-500">
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
                        <div className="text-center py-8 text-neutral-500">
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
                        <div key={key} className="p-3 border border-white/[0.10] rounded-sm" data-testid={`late-plate-group-${key}`}>
                          <div className="flex justify-between items-center mb-2">
                            <div className="font-medium text-white">
                              {format(parseISO(dateStr), "EEEE, MMM d")} - {mealType}
                            </div>
                            <div className="flex gap-2">
                              <Badge variant="outline" className="bg-neutral-500/10 text-neutral-400 border border-neutral-500/20 rounded-sm uppercase text-[10px] tracking-wider font-bold">{fraternity}</Badge>
                              {isCurrentWeek && <Badge variant="outline" className="bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-sm uppercase text-[10px] tracking-wider font-bold">This Week</Badge>}
                              {isPreviousWeek && <Badge variant="outline" className="bg-neutral-500/10 text-neutral-400 border border-neutral-500/20 rounded-sm uppercase text-[10px] tracking-wider font-bold">Last Week</Badge>}
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
              <Button variant="outline" onClick={() => setLatePlatesDialogOpen(false)} data-testid="button-close-lateplates-dialog" className="border-white/[0.14] text-neutral-400 hover:text-white hover:border-white/[0.2] rounded-sm">Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={profileDialogOpen} onOpenChange={setProfileDialogOpen}>
          <DialogContent className="bg-[#1A1A1A] border border-white/[0.1] rounded-sm">
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
                  data-testid="input-profile-name"
                  className="bg-[#1A1A1A] border-white/[0.14] text-white rounded-sm placeholder:text-neutral-500"
                />
              </div>
              <div>
                <Label className="text-xs font-bold uppercase tracking-wider text-neutral-500 font-display">Email</Label>
                <Input
                  type="email"
                  value={profileEmail}
                  onChange={(e) => setProfileEmail(e.target.value)}
                  data-testid="input-profile-email"
                  className="bg-[#1A1A1A] border-white/[0.14] text-white rounded-sm placeholder:text-neutral-500"
                />
              </div>
              <div className="border-t border-white/[0.10] pt-4">
                <h4 className="font-display font-bold uppercase tracking-wide text-white mb-2">Change Password</h4>
                <div className="space-y-2">
                  <div>
                    <Label className="text-xs font-bold uppercase tracking-wider text-neutral-500 font-display">Current Password</Label>
                    <Input
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      data-testid="input-current-password"
                      className="bg-[#1A1A1A] border-white/[0.14] text-white rounded-sm placeholder:text-neutral-500"
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-bold uppercase tracking-wider text-neutral-500 font-display">New Password</Label>
                    <Input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      data-testid="input-new-password"
                      className="bg-[#1A1A1A] border-white/[0.14] text-white rounded-sm placeholder:text-neutral-500"
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-bold uppercase tracking-wider text-neutral-500 font-display">Confirm New Password</Label>
                    <Input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      data-testid="input-confirm-password"
                      className="bg-[#1A1A1A] border-white/[0.14] text-white rounded-sm placeholder:text-neutral-500"
                    />
                  </div>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setProfileDialogOpen(false)} className="border-white/[0.14] text-neutral-400 hover:text-white hover:border-white/[0.2] rounded-sm">Cancel</Button>
              <Button onClick={handleProfileUpdate} disabled={updateProfileMutation.isPending} data-testid="button-save-profile" className="bg-amber-500 hover:bg-amber-400 text-black font-display font-bold uppercase tracking-wider rounded-sm">
                {updateProfileMutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={editHDOpen} onOpenChange={setEditHDOpen}>
          <DialogContent className="bg-[#1A1A1A] border border-white/[0.1] rounded-sm">
            <DialogHeader>
              <DialogTitle className="font-display font-bold uppercase tracking-wide text-white text-xl">Edit House Director</DialogTitle>
              <DialogDescription className="text-neutral-400">
                Update the house director's profile information.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4 space-y-4">
              <div>
                <Label className="text-xs font-bold uppercase tracking-wider text-neutral-500 font-display">Name</Label>
                <Input
                  value={editHDName}
                  onChange={(e) => setEditHDName(e.target.value)}
                  data-testid="input-edit-hd-name"
                  className="bg-[#1A1A1A] border-white/[0.14] text-white rounded-sm placeholder:text-neutral-500"
                />
              </div>
              <div>
                <Label className="text-xs font-bold uppercase tracking-wider text-neutral-500 font-display">Email</Label>
                <Input
                  type="email"
                  value={editHDEmail}
                  onChange={(e) => setEditHDEmail(e.target.value)}
                  data-testid="input-edit-hd-email"
                  className="bg-[#1A1A1A] border-white/[0.14] text-white rounded-sm placeholder:text-neutral-500"
                />
              </div>
              <div>
                <Label className="text-xs font-bold uppercase tracking-wider text-neutral-500 font-display">Phone Number</Label>
                <Input
                  type="tel"
                  value={editHDPhone}
                  onChange={(e) => setEditHDPhone(e.target.value)}
                  data-testid="input-edit-hd-phone"
                  className="bg-[#1A1A1A] border-white/[0.14] text-white rounded-sm placeholder:text-neutral-500"
                />
              </div>
              <div className="border-t border-white/[0.10] pt-4">
                <h4 className="font-display font-bold uppercase tracking-wide text-white mb-2">Reset Password</h4>
                <div>
                  <Label className="text-xs font-bold uppercase tracking-wider text-neutral-500 font-display">New Password (leave blank to keep current)</Label>
                  <Input
                    type="password"
                    value={editHDPassword}
                    onChange={(e) => setEditHDPassword(e.target.value)}
                    placeholder="Enter new password"
                    data-testid="input-edit-hd-password"
                    className="bg-[#1A1A1A] border-white/[0.14] text-white rounded-sm placeholder:text-neutral-500"
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditHDOpen(false)} data-testid="button-cancel-edit-hd" className="border-white/[0.14] text-neutral-400 hover:text-white hover:border-white/[0.2] rounded-sm">Cancel</Button>
              <Button onClick={handleEditHD} disabled={updateHDMutation.isPending} data-testid="button-save-edit-hd" className="bg-amber-500 hover:bg-amber-400 text-black font-display font-bold uppercase tracking-wider rounded-sm">
                {updateHDMutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}
