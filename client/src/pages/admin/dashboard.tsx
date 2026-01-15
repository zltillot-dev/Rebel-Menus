import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useMenus, useUpdateMenuStatus, useDeleteMenu } from "@/hooks/use-menus";
import { useChefs, useCreateChef } from "@/hooks/use-admin";
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
import { CheckCircle, XCircle, Clock, UserPlus, FileText, Eye, MessageSquare, Trash2, Calendar } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { format } from "date-fns";
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
  const { data: chefs } = useChefs();
  const { mutate: updateStatus, isPending: isUpdating } = useUpdateMenuStatus();
  const { mutate: deleteMenu, isPending: isDeleting } = useDeleteMenu();
  const { mutate: createChef, isPending: isCreatingChef } = useCreateChef();
  const [createChefOpen, setCreateChefOpen] = useState(false);
  const [viewMenu, setViewMenu] = useState<any>(null);
  const [reviewMenu, setReviewMenu] = useState<any>(null);
  const [adminNotes, setAdminNotes] = useState("");
  const [activeTab, setActiveTab] = useState<"pending" | "all">("pending");

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
                  <Card key={chef.id}>
                    <CardHeader className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                          {chef.name.charAt(0)}
                        </div>
                        <div>
                          <h4 className="font-bold">{chef.name}</h4>
                          <p className="text-xs text-muted-foreground">{chef.fraternity}</p>
                        </div>
                      </div>
                    </CardHeader>
                  </Card>
                ))}
              </div>
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
      </main>
    </div>
  );
}
