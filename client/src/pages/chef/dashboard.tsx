import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useMenus, useCreateMenu, useUpdateMenuStatus, useUpdateMenu, useDeleteMenu } from "@/hooks/use-menus";
import { Sidebar } from "@/components/Sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Plus, Calendar as CalendarIcon, FileEdit, AlertCircle, Send, Pencil, Trash2 } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { format, startOfWeek, addWeeks } from "date-fns";
import { DAYS, MEAL_TYPES } from "@shared/schema";

export default function ChefDashboard() {
  const { user } = useAuth();
  const { data: menus } = useMenus({ fraternity: user?.fraternity || undefined });
  const { mutate: createMenu, isPending: isCreating } = useCreateMenu();
  const { mutate: updateStatus, isPending: isUpdating } = useUpdateMenuStatus();
  const { mutate: updateMenu, isPending: isUpdatingMenu } = useUpdateMenu();
  const { mutate: deleteMenu, isPending: isDeleting } = useDeleteMenu();
  const [createOpen, setCreateOpen] = useState(false);
  const [viewMenu, setViewMenu] = useState<any>(null);
  const [editMenu, setEditMenu] = useState<any>(null);

  // Filter menus that need revision
  const menusNeedingRevision = menus?.filter(m => m.status === 'needs_revision') || [];
  const otherMenus = menus?.filter(m => m.status !== 'needs_revision') || [];

  // New Menu State
  const [weekOf, setWeekOf] = useState(format(addWeeks(startOfWeek(new Date(), { weekStartsOn: 1 }), 1), "yyyy-MM-dd"));
  const [menuItems, setMenuItems] = useState<any[]>([]);
  
  // Edit Menu State
  const [editWeekOf, setEditWeekOf] = useState("");
  const [editMenuItems, setEditMenuItems] = useState<any[]>([]);

  // Initialize empty items structure
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

  // Initialize edit menu from existing menu
  const initializeEditMenu = (menu: any) => {
    setEditWeekOf(menu.weekOf);
    // Create full structure for all days/meals
    const items = [];
    for (const day of DAYS) {
      const lunchItem = menu.items.find((i: any) => i.day === day && i.meal === "Lunch");
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
        const dinnerItem = menu.items.find((i: any) => i.day === day && i.meal === "Dinner");
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
    setEditMenu(menu);
  };

  const handleSubmit = () => {
    if (!user?.fraternity) return;
    
    // Filter out items without a description (Main Protein)
    const activeItems = menuItems.filter(item => item.description.trim() !== "");
    
    if (activeItems.length === 0) {
      alert("Please enter at least one meal description.");
      return;
    }

    createMenu({
      fraternity: user.fraternity,
      weekOf: weekOf,
      status: "pending",
      chefId: user.id,
      items: activeItems.map(item => ({
        ...item,
        calories: Number(item.calories) || 0,
        carbs: Number(item.carbs) || 0,
        fats: Number(item.fats) || 0,
        protein: Number(item.protein) || 0,
        sugar: Number(item.sugar) || 0,
      }))
    }, {
      onSuccess: () => setCreateOpen(false)
    });
  };

  const handleEditSubmit = () => {
    if (!user?.fraternity || !editMenu) return;
    
    // Filter out items without a description (Main Protein)
    const activeItems = editMenuItems.filter(item => item.description.trim() !== "");
    
    if (activeItems.length === 0) {
      alert("Please enter at least one meal description.");
      return;
    }

    updateMenu({
      id: editMenu.id,
      data: {
        fraternity: user.fraternity,
        weekOf: editWeekOf,
        status: "pending", // Resubmit as pending after edit
        chefId: user.id,
        items: activeItems.map(item => ({
          day: item.day,
          meal: item.meal,
          description: item.description,
          side1: item.side1 || "",
          side2: item.side2 || "",
          side3: item.side3 || "",
          calories: Number(item.calories) || 0,
          carbs: Number(item.carbs) || 0,
          fats: Number(item.fats) || 0,
          protein: Number(item.protein) || 0,
          sugar: Number(item.sugar) || 0,
        }))
      }
    }, {
      onSuccess: () => setEditMenu(null)
    });
  };

  const handleDelete = (menuId: number) => {
    deleteMenu(menuId);
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex">
      <Sidebar />
      <main className="ml-64 flex-1 p-8 max-w-7xl mx-auto">
        <header className="mb-8 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-display font-bold">Chef Dashboard</h1>
            <p className="text-muted-foreground">Manage your weekly menus for {user?.fraternity}</p>
          </div>
          <Dialog open={createOpen} onOpenChange={(open) => {
            if (open) initializeMenu();
            setCreateOpen(open);
          }}>
            <DialogTrigger asChild>
              <Button size="lg" className="bg-primary hover:bg-primary/90">
                <Plus className="w-5 h-5 mr-2" /> Create New Menu
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create Weekly Menu</DialogTitle>
                <DialogDescription>Input meals and macro information for the upcoming week.</DialogDescription>
              </DialogHeader>
              
              <div className="py-4">
                <div className="mb-6">
                  <Label>Week Of (Monday)</Label>
                  <Input 
                    type="date" 
                    value={weekOf} 
                    onChange={(e) => setWeekOf(e.target.value)} 
                    className="w-full sm:w-64"
                  />
                </div>

                <Tabs defaultValue="Monday" className="w-full">
                  <TabsList className="grid grid-cols-5 mb-6">
                    {DAYS.map(day => (
                      <TabsTrigger key={day} value={day}>{day}</TabsTrigger>
                    ))}
                  </TabsList>
                  
                  {DAYS.map(day => (
                    <TabsContent key={day} value={day} className="space-y-6">
                      {menuItems
                        .map((item, idx) => ({ item, idx })) // keep original index
                        .filter(({ item }) => item.day === day)
                        .map(({ item, idx }) => (
                          <Card key={`${day}-${item.meal}`}>
                            <CardHeader className="bg-muted/50 pb-3">
                              <CardTitle className="text-lg">{item.meal}</CardTitle>
                            </CardHeader>
                            <CardContent className="pt-4 space-y-4">
                              <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                  <Label>Main Protein / Item</Label>
                                  <Input 
                                    placeholder="e.g. Grilled Chicken" 
                                    value={item.description}
                                    onChange={(e) => handleItemChange(idx, "description", e.target.value)}
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label>Side 1</Label>
                                  <Input 
                                    placeholder="e.g. Quinoa" 
                                    value={item.side1}
                                    onChange={(e) => handleItemChange(idx, "side1", e.target.value)}
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label>Side 2</Label>
                                  <Input 
                                    placeholder="e.g. Steamed Broccoli" 
                                    value={item.side2}
                                    onChange={(e) => handleItemChange(idx, "side2", e.target.value)}
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label>Side 3 / Details</Label>
                                  <Input 
                                    placeholder="e.g. Garlic Butter Sauce" 
                                    value={item.side3}
                                    onChange={(e) => handleItemChange(idx, "side3", e.target.value)}
                                  />
                                </div>
                              </div>
                              <div className="grid grid-cols-5 gap-3">
                                <div>
                                  <Label className="text-xs">Calories</Label>
                                  <Input type="number" value={item.calories} onChange={(e) => handleItemChange(idx, "calories", e.target.value)} />
                                </div>
                                <div>
                                  <Label className="text-xs">Carbs (g)</Label>
                                  <Input type="number" value={item.carbs} onChange={(e) => handleItemChange(idx, "carbs", e.target.value)} />
                                </div>
                                <div>
                                  <Label className="text-xs">Fats (g)</Label>
                                  <Input type="number" value={item.fats} onChange={(e) => handleItemChange(idx, "fats", e.target.value)} />
                                </div>
                                <div>
                                  <Label className="text-xs">Protein (g)</Label>
                                  <Input type="number" value={item.protein} onChange={(e) => handleItemChange(idx, "protein", e.target.value)} />
                                </div>
                                <div>
                                  <Label className="text-xs">Sugar (g)</Label>
                                  <Input type="number" value={item.sugar} onChange={(e) => handleItemChange(idx, "sugar", e.target.value)} />
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                    </TabsContent>
                  ))}
                </Tabs>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
                <Button onClick={handleSubmit} disabled={isCreating}>
                  {isCreating ? "Submitting..." : "Submit Menu for Approval"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </header>

        {/* Menus Needing Revision */}
        {menusNeedingRevision.length > 0 && (
          <section className="grid gap-6 mb-8">
            <h2 className="text-xl font-bold flex items-center gap-2 text-amber-600">
              <AlertCircle className="w-5 h-5" />
              Menus Needing Revision
            </h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {menusNeedingRevision.map((menu: any) => (
                <Card key={menu.id} className="border-amber-300 bg-amber-50/50 hover:shadow-md transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex justify-between items-start">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <CalendarIcon className="w-4 h-4 text-muted-foreground" />
                        {format(new Date(menu.weekOf), "MMM d, yyyy")}
                      </CardTitle>
                      <Badge variant="outline" className="bg-amber-100 text-amber-700 border-amber-300">
                        Needs Revision
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {menu.adminNotes && (
                      <div className="bg-white rounded-md p-3 border border-amber-200">
                        <p className="text-xs font-medium text-amber-700 mb-1">Admin Feedback:</p>
                        <p className="text-sm text-muted-foreground">{menu.adminNotes}</p>
                      </div>
                    )}
                    <div className="flex gap-2">
                      <Button variant="outline" className="flex-1" onClick={() => setViewMenu(menu)} data-testid={`button-view-revision-${menu.id}`}>
                        <FileEdit className="w-4 h-4 mr-2" /> View
                      </Button>
                      <Button 
                        variant="default"
                        className="flex-1" 
                        onClick={() => initializeEditMenu(menu)}
                        data-testid={`button-edit-revision-${menu.id}`}
                      >
                        <Pencil className="w-4 h-4 mr-2" /> Edit
                      </Button>
                    </div>
                    <div className="flex gap-2">
                      <Button 
                        className="flex-1" 
                        onClick={() => updateStatus({ id: menu.id, status: 'pending' })}
                        disabled={isUpdating}
                        data-testid={`button-resubmit-${menu.id}`}
                      >
                        <Send className="w-4 h-4 mr-2" /> Resubmit
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="destructive" size="icon" data-testid={`button-delete-revision-${menu.id}`}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Menu</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to delete this menu? This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDelete(menu.id)} disabled={isDeleting}>
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        )}

        {/* Recent Menus */}
        <section className="grid gap-6">
          <h2 className="text-xl font-bold">Recent Menus</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {otherMenus.map((menu: any) => (
              <Card key={menu.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-start">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <CalendarIcon className="w-4 h-4 text-muted-foreground" />
                      {format(new Date(menu.weekOf), "MMM d, yyyy")}
                    </CardTitle>
                    <Badge variant={
                      menu.status === 'approved' ? 'default' : 
                      menu.status === 'pending' ? 'secondary' : 'outline'
                    }>
                      {menu.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="text-sm text-muted-foreground">
                    {menu.items.length} items scheduled
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" className="flex-1" onClick={() => setViewMenu(menu)} data-testid={`button-view-menu-${menu.id}`}>
                      <FileEdit className="w-4 h-4 mr-2" /> View
                    </Button>
                    {menu.status === 'pending' && (
                      <Button 
                        variant="default"
                        className="flex-1" 
                        onClick={() => initializeEditMenu(menu)}
                        data-testid={`button-edit-menu-${menu.id}`}
                      >
                        <Pencil className="w-4 h-4 mr-2" /> Edit
                      </Button>
                    )}
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="destructive" size="icon" data-testid={`button-delete-menu-${menu.id}`}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Menu</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to delete this menu? This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDelete(menu.id)} disabled={isDeleting}>
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <Dialog open={!!viewMenu} onOpenChange={(open) => !open && setViewMenu(null)}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CalendarIcon className="w-5 h-5" />
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
            <DialogFooter>
              <Button variant="outline" onClick={() => setViewMenu(null)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Menu Dialog */}
        <Dialog open={!!editMenu} onOpenChange={(open) => !open && setEditMenu(null)}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Menu - {editMenu && format(new Date(editMenu.weekOf), "MMMM d, yyyy")}</DialogTitle>
              <DialogDescription>
                Update meal information and resubmit for approval.
                {editMenu?.adminNotes && (
                  <span className="block mt-2 p-2 bg-amber-50 border border-amber-200 rounded text-amber-700">
                    Admin Feedback: {editMenu.adminNotes}
                  </span>
                )}
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
                />
              </div>

              <Tabs defaultValue="Monday" className="w-full">
                <TabsList className="grid grid-cols-5 mb-6">
                  {DAYS.map(day => (
                    <TabsTrigger key={day} value={day}>{day}</TabsTrigger>
                  ))}
                </TabsList>
                
                {DAYS.map(day => (
                  <TabsContent key={day} value={day} className="space-y-6">
                    {editMenuItems
                      .map((item, idx) => ({ item, idx }))
                      .filter(({ item }) => item.day === day)
                      .map(({ item, idx }) => (
                        <Card key={`${day}-${item.meal}`}>
                          <CardHeader className="bg-muted/50 pb-3">
                            <CardTitle className="text-lg">{item.meal}</CardTitle>
                          </CardHeader>
                          <CardContent className="pt-4 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <Label>Main Protein / Item</Label>
                                <Input 
                                  placeholder="e.g. Grilled Chicken" 
                                  value={item.description}
                                  onChange={(e) => handleEditItemChange(idx, "description", e.target.value)}
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>Side 1</Label>
                                <Input 
                                  placeholder="e.g. Quinoa" 
                                  value={item.side1 || ""}
                                  onChange={(e) => handleEditItemChange(idx, "side1", e.target.value)}
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>Side 2</Label>
                                <Input 
                                  placeholder="e.g. Steamed Broccoli" 
                                  value={item.side2 || ""}
                                  onChange={(e) => handleEditItemChange(idx, "side2", e.target.value)}
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>Side 3 / Details</Label>
                                <Input 
                                  placeholder="e.g. Garlic Butter Sauce" 
                                  value={item.side3 || ""}
                                  onChange={(e) => handleEditItemChange(idx, "side3", e.target.value)}
                                />
                              </div>
                            </div>
                            <div className="grid grid-cols-5 gap-3">
                              <div>
                                <Label className="text-xs">Calories</Label>
                                <Input type="number" value={item.calories} onChange={(e) => handleEditItemChange(idx, "calories", e.target.value)} />
                              </div>
                              <div>
                                <Label className="text-xs">Carbs (g)</Label>
                                <Input type="number" value={item.carbs} onChange={(e) => handleEditItemChange(idx, "carbs", e.target.value)} />
                              </div>
                              <div>
                                <Label className="text-xs">Fats (g)</Label>
                                <Input type="number" value={item.fats} onChange={(e) => handleEditItemChange(idx, "fats", e.target.value)} />
                              </div>
                              <div>
                                <Label className="text-xs">Protein (g)</Label>
                                <Input type="number" value={item.protein} onChange={(e) => handleEditItemChange(idx, "protein", e.target.value)} />
                              </div>
                              <div>
                                <Label className="text-xs">Sugar (g)</Label>
                                <Input type="number" value={item.sugar} onChange={(e) => handleEditItemChange(idx, "sugar", e.target.value)} />
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                  </TabsContent>
                ))}
              </Tabs>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setEditMenu(null)}>Cancel</Button>
              <Button onClick={handleEditSubmit} disabled={isUpdatingMenu} data-testid="button-save-edit">
                {isUpdatingMenu ? "Saving..." : "Save & Resubmit"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}
