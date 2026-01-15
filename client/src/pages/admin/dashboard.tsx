import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useMenus, useUpdateMenuStatus } from "@/hooks/use-menus";
import { useChefs, useCreateChef } from "@/hooks/use-admin";
import { Sidebar } from "@/components/Sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { CheckCircle, XCircle, Clock, UserPlus, FileText } from "lucide-react";
import { format } from "date-fns";
import { FRATERNITIES } from "@shared/schema";
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
  const { mutate: updateStatus } = useUpdateMenuStatus();
  const { mutate: createChef, isPending: isCreatingChef } = useCreateChef();
  const [createChefOpen, setCreateChefOpen] = useState(false);

  const pendingMenus = menus?.filter(m => m.status === 'pending') || [];
  const activeChefs = chefs || [];

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
            
            {/* Pending Approvals */}
            <section>
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                <Clock className="w-5 h-5 text-amber-500" />
                Pending Approvals
              </h2>
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
                        <div className="flex justify-between items-start">
                          <div>
                            <CardTitle>Week of {format(new Date(menu.weekOf), "MMMM d, yyyy")}</CardTitle>
                            <CardDescription className="mt-1 font-medium text-primary">
                              {menu.fraternity}
                            </CardDescription>
                          </div>
                          <Badge variant="outline" className="bg-amber-50 text-amber-600 border-amber-200">
                            Pending Review
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="flex gap-3 mt-2">
                          <Button 
                            className="w-full bg-green-600 hover:bg-green-700"
                            onClick={() => updateStatus({ id: menu.id, status: 'approved' })}
                          >
                            <CheckCircle className="w-4 h-4 mr-2" /> Approve
                          </Button>
                          <Button 
                            variant="outline" 
                            className="w-full text-destructive border-destructive/20 hover:bg-destructive/5"
                            onClick={() => updateStatus({ id: menu.id, status: 'draft' })}
                          >
                            <XCircle className="w-4 h-4 mr-2" /> Reject
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
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
      </main>
    </div>
  );
}
