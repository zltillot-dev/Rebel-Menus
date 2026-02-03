import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useMenus } from "@/hooks/use-menus";
import { Sidebar } from "@/components/Sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Calendar, ClipboardList, Send, Loader2, FileText, Download, FileDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format, startOfWeek, addDays, parseISO } from "date-fns";
import { exportMenuToPDF } from "@/lib/pdf-export";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

interface Critique {
  id: number;
  menuId: number;
  houseDirectorId: number;
  fraternity: string;
  critiqueText: string | null;
  suggestedEdits: string | null;
  status: string;
  acknowledgedByChef: boolean;
  acknowledgedByAdmin: boolean;
  createdAt: string;
}

export default function HouseDirectorDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: menus, isLoading: isLoadingMenus } = useMenus({ fraternity: user?.fraternity || undefined });
  
  const { data: critiques, isLoading: isLoadingCritiques } = useQuery<Critique[]>({
    queryKey: ['/api/critiques'],
    enabled: !!user,
  });
  
  const [critiqueModalOpen, setCritiqueModalOpen] = useState(false);
  const [selectedMenuId, setSelectedMenuId] = useState<number | null>(null);
  const [critiqueText, setCritiqueText] = useState("");
  const [suggestedEdits, setSuggestedEdits] = useState("");
  
  const createCritiqueMutation = useMutation({
    mutationFn: async (data: { menuId: number; critiqueText: string; suggestedEdits: string }) => {
      const res = await fetch('/api/critiques', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to create critique');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/critiques'] });
      toast({ title: "Critique submitted", description: "Your critique has been sent to the chef and admin." });
      setCritiqueModalOpen(false);
      setCritiqueText("");
      setSuggestedEdits("");
      setSelectedMenuId(null);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to submit critique", variant: "destructive" });
    },
  });
  
  const now = new Date();
  const currentWeekStart = startOfWeek(now, { weekStartsOn: 1 });
  const previousWeekStart = addDays(currentWeekStart, -7);
  const nextWeekStart = addDays(currentWeekStart, 7);
  
  const getMenuWeekLabel = (weekOf: string) => {
    const menuDate = parseISO(weekOf);
    if (menuDate >= previousWeekStart && menuDate < currentWeekStart) return "Previous Week";
    if (menuDate >= currentWeekStart && menuDate < nextWeekStart) return "Current Week";
    if (menuDate >= nextWeekStart) return "Upcoming Week";
    return "Other";
  };
  
  const categorizedMenus = {
    previous: menus?.filter((m: any) => getMenuWeekLabel(m.weekOf) === "Previous Week") || [],
    current: menus?.filter((m: any) => getMenuWeekLabel(m.weekOf) === "Current Week") || [],
    upcoming: menus?.filter((m: any) => getMenuWeekLabel(m.weekOf) === "Upcoming Week") || [],
  };
  
  const openCritiqueModal = (menuId: number) => {
    setSelectedMenuId(menuId);
    setCritiqueModalOpen(true);
  };
  
  const handleSubmitCritique = () => {
    if (!selectedMenuId) return;
    if (!critiqueText.trim() && !suggestedEdits.trim()) {
      toast({ title: "Error", description: "Please provide a critique or suggested edits", variant: "destructive" });
      return;
    }
    createCritiqueMutation.mutate({
      menuId: selectedMenuId,
      critiqueText: critiqueText.trim(),
      suggestedEdits: suggestedEdits.trim(),
    });
  };
  
  const getStatusBadge = (critique: Critique) => {
    if (critique.acknowledgedByChef && critique.acknowledgedByAdmin) {
      return <Badge variant="default" className="bg-green-600">Fully Acknowledged</Badge>;
    }
    if (critique.acknowledgedByChef) {
      return <Badge variant="secondary">Chef Acknowledged</Badge>;
    }
    if (critique.acknowledgedByAdmin) {
      return <Badge variant="secondary">Admin Acknowledged</Badge>;
    }
    return <Badge variant="outline">Pending</Badge>;
  };
  
  const MenuSection = ({ title, menuList, icon: Icon }: { title: string; menuList: any[]; icon: any }) => (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Icon className="w-5 h-5 text-muted-foreground" />
        <h2 className="text-lg font-semibold">{title}</h2>
        <Badge variant="outline">{menuList.length}</Badge>
      </div>
      
      {menuList.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No menus available for this period
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {menuList.map((menu: any) => (
            <Card key={menu.id}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <CardTitle className="text-lg">
                      Week of {format(parseISO(menu.weekOf), "MMMM d, yyyy")}
                    </CardTitle>
                    <CardDescription>{menu.fraternity}</CardDescription>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <Badge variant={menu.status === 'approved' ? 'default' : 'secondary'}>
                      {menu.status}
                    </Badge>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => openCritiqueModal(menu.id)}
                      data-testid={`button-critique-menu-${menu.id}`}
                    >
                      <ClipboardList className="w-4 h-4 mr-1" />
                      <span className="hidden sm:inline">Submit Critique</span>
                      <span className="sm:hidden">Critique</span>
                    </Button>
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
                      <span className="hidden sm:inline">Export PDF</span>
                      <span className="sm:hidden">PDF</span>
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {menu.items && menu.items.length > 0 ? (
                  <div className="grid gap-4 sm:grid-cols-2">
                    {['Lunch', 'Dinner'].map(mealType => {
                      const mealItems = menu.items.filter((item: any) => item.meal === mealType);
                      if (mealItems.length === 0) return null;
                      return (
                        <div key={mealType}>
                          <h4 className="text-sm font-semibold text-muted-foreground mb-2">{mealType}</h4>
                          <div className="space-y-2">
                            {mealItems.map((item: any) => (
                              <div key={item.id} className="text-sm">
                                <p className="font-medium">{item.description}</p>
                                {(item.side1 || item.side2 || item.side3) && (
                                  <p className="text-muted-foreground text-xs">
                                    {[item.side1, item.side2, item.side3].filter(Boolean).join(' | ')}
                                  </p>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No menu items</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      
      <main className="flex-1 md:ml-64">
        <div className="p-4 md:p-8 pt-16 md:pt-8">
          <div className="mb-6">
            <h1 className="text-2xl md:text-3xl font-bold">House Director Dashboard</h1>
            <p className="text-muted-foreground mt-1">{user?.fraternity}</p>
          </div>

          <Tabs defaultValue="menus" className="space-y-6">
            <TabsList className="grid w-full max-w-md grid-cols-2">
              <TabsTrigger value="menus" data-testid="tab-menus">
                <Calendar className="w-4 h-4 mr-2" />
                Menus
              </TabsTrigger>
              <TabsTrigger value="my-critiques" data-testid="tab-critiques">
                <ClipboardList className="w-4 h-4 mr-2" />
                My Critiques
              </TabsTrigger>
            </TabsList>

            <TabsContent value="menus" className="space-y-8">
              {isLoadingMenus ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <>
                  <MenuSection title="Current Week" menuList={categorizedMenus.current} icon={Calendar} />
                  <MenuSection title="Upcoming Week" menuList={categorizedMenus.upcoming} icon={Calendar} />
                  <MenuSection title="Previous Week" menuList={categorizedMenus.previous} icon={Calendar} />
                </>
              )}
            </TabsContent>

            <TabsContent value="my-critiques" className="space-y-4">
              {isLoadingCritiques ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                </div>
              ) : critiques && critiques.length > 0 ? (
                <div className="grid gap-4">
                  {critiques.map((critique) => {
                    const menu = menus?.find((m: any) => m.id === critique.menuId);
                    return (
                      <Card key={critique.id}>
                        <CardHeader className="pb-2">
                          <div className="flex items-center justify-between flex-wrap gap-2">
                            <div>
                              <CardTitle className="text-base">
                                Critique for {menu ? format(parseISO(menu.weekOf), "MMMM d, yyyy") : `Menu #${critique.menuId}`}
                              </CardTitle>
                              <CardDescription>
                                Submitted {format(parseISO(critique.createdAt), "MMM d, yyyy 'at' h:mm a")}
                              </CardDescription>
                            </div>
                            {getStatusBadge(critique)}
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          {critique.critiqueText && (
                            <div>
                              <Label className="text-xs text-muted-foreground">Critique</Label>
                              <p className="text-sm mt-1">{critique.critiqueText}</p>
                            </div>
                          )}
                          {critique.suggestedEdits && (
                            <div>
                              <Label className="text-xs text-muted-foreground">Suggested Edits</Label>
                              <p className="text-sm mt-1">{critique.suggestedEdits}</p>
                            </div>
                          )}
                          <div className="flex gap-2 pt-2 text-xs text-muted-foreground">
                            <span>Chef: {critique.acknowledgedByChef ? "Acknowledged" : "Pending"}</span>
                            <span>|</span>
                            <span>Admin: {critique.acknowledgedByAdmin ? "Acknowledged" : "Pending"}</span>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              ) : (
                <Card>
                  <CardContent className="py-12 text-center">
                    <ClipboardList className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">No critiques submitted yet</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      View menus and submit critiques from the Menus tab
                    </p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </main>

      <Dialog open={critiqueModalOpen} onOpenChange={setCritiqueModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Submit Menu Critique</DialogTitle>
            <DialogDescription>
              Provide feedback and suggested edits for this menu. The chef and admin will be notified.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="critique">Critique / Feedback</Label>
              <Textarea
                id="critique"
                placeholder="Share your thoughts on this menu..."
                value={critiqueText}
                onChange={(e) => setCritiqueText(e.target.value)}
                rows={3}
                data-testid="input-critique-text"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="suggested-edits">Suggested Edits</Label>
              <Textarea
                id="suggested-edits"
                placeholder="Suggest specific changes to the menu..."
                value={suggestedEdits}
                onChange={(e) => setSuggestedEdits(e.target.value)}
                rows={3}
                data-testid="input-suggested-edits"
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setCritiqueModalOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleSubmitCritique}
              disabled={createCritiqueMutation.isPending}
              data-testid="button-submit-critique"
            >
              {createCritiqueMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Submit Critique
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
