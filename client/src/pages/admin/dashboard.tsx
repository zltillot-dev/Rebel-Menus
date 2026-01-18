import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useMenus, useUpdateMenuStatus, useDeleteMenu } from "@/hooks/use-menus";
import { useChefs, useCreateChef, useDeleteChef, useAllChefTasks, useCreateChefTask, useDeleteChefTask } from "@/hooks/use-admin";
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
import { CheckCircle, XCircle, Clock, UserPlus, FileText, Eye, MessageSquare, Trash2, Calendar, ListTodo, Plus } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { format, parseISO } from "date-fns";
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
  const { data: menus } = useMenus();
  const { data: chefs, isLoading: isLoadingChefs } = useChefs();
  const { data: allTasks, isLoading: isLoadingTasks } = useAllChefTasks();
  const { mutate: updateStatus, isPending: isUpdating } = useUpdateMenuStatus();
  const { mutate: deleteMenu, isPending: isDeleting } = useDeleteMenu();
  const { mutate: createChef, isPending: isCreatingChef } = useCreateChef();
  const { mutate: createTask, isPending: isCreatingTask } = useCreateChefTask();
  const { mutate: deleteTask, isPending: isDeletingTask } = useDeleteChefTask();
  const { mutate: deleteChef, isPending: isDeletingChef } = useDeleteChef();
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
      <main className="ml-64 flex-1 p-8">
        <header className="mb-8">
          <h1 className="text-3xl font-display font-bold">Admin Dashboard</h1>
          <p className="text-muted-foreground">Manage chefs and approve weekly menus</p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
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
                                className="flex-1 bg-green-600 hover:bg-green-700"
                                onClick={() => updateStatus({ id: menu.id, status: 'approved' })}
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
                <Button variant="outline" className="justify-start">
                  <FileText className="w-4 h-4 mr-2" /> View All Feedback
                </Button>
                <Button variant="outline" className="justify-start">
                  <FileText className="w-4 h-4 mr-2" /> Request History
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
              <Button variant="outline" onClick={() => setViewMenu(null)}>Close</Button>
              <Button 
                className="bg-green-600 hover:bg-green-700"
                onClick={() => {
                  updateStatus({ id: viewMenu.id, status: 'approved' });
                  setViewMenu(null);
                }}
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
              <Button variant="outline" onClick={() => setReviewMenu(null)}>Cancel</Button>
              <Button 
                onClick={() => {
                  updateStatus({ id: reviewMenu.id, status: 'needs_revision', adminNotes });
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
      </main>
    </div>
  );
}
