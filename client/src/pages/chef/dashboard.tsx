import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useMenus, useCreateMenu } from "@/hooks/use-menus";
import { Sidebar } from "@/components/Sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Plus, Calendar as CalendarIcon, FileEdit } from "lucide-react";
import { format, startOfWeek, addWeeks } from "date-fns";
import { DAYS, MEAL_TYPES } from "@shared/schema";

export default function ChefDashboard() {
  const { user } = useAuth();
  const { data: menus } = useMenus({ fraternity: user?.fraternity || undefined });
  const { mutate: createMenu, isPending: isCreating } = useCreateMenu();
  const [createOpen, setCreateOpen] = useState(false);

  // New Menu State
  const [weekOf, setWeekOf] = useState(format(addWeeks(startOfWeek(new Date(), { weekStartsOn: 1 }), 1), "yyyy-MM-dd"));
  const [menuItems, setMenuItems] = useState<any[]>([]);

  // Initialize empty items structure
  const initializeMenu = () => {
    const items = [];
    for (const day of DAYS) {
      items.push({ day, meal: "Lunch", description: "", calories: 0, carbs: 0, fats: 0, protein: 0, sugar: 0 });
      if (day !== "Friday") { // No dinner on Friday
        items.push({ day, meal: "Dinner", description: "", calories: 0, carbs: 0, fats: 0, protein: 0, sugar: 0 });
      }
    }
    setMenuItems(items);
  };

  const handleItemChange = (index: number, field: string, value: any) => {
    const newItems = [...menuItems];
    newItems[index] = { ...newItems[index], [field]: value };
    setMenuItems(newItems);
  };

  const handleSubmit = () => {
    if (!user?.fraternity) return;
    
    // Filter out empty items if needed, or validate all fields
    createMenu({
      fraternity: user.fraternity,
      weekOf: weekOf,
      status: "draft",
      chefId: user.id,
      items: menuItems.map(item => ({
        ...item,
        calories: Number(item.calories),
        carbs: Number(item.carbs),
        fats: Number(item.fats),
        protein: Number(item.protein),
        sugar: Number(item.sugar),
      }))
    }, {
      onSuccess: () => setCreateOpen(false)
    });
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
                              <div>
                                <Label>Description</Label>
                                <Input 
                                  placeholder="e.g. Grilled Chicken with Quinoa" 
                                  value={item.description}
                                  onChange={(e) => handleItemChange(idx, "description", e.target.value)}
                                />
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

        <section className="grid gap-6">
          <h2 className="text-xl font-bold">Recent Menus</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {menus?.map((menu) => (
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
                <CardContent>
                  <div className="text-sm text-muted-foreground mb-4">
                    {menu.items.length} items scheduled
                  </div>
                  <Button variant="outline" className="w-full">
                    <FileEdit className="w-4 h-4 mr-2" /> View Details
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
