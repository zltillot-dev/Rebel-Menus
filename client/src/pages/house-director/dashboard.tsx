import { useState, useEffect } from "react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar, ClipboardList, Send, Loader2, FileDown, Settings, Star, Users, MessageSquare, CalendarPlus, UtensilsCrossed } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { format, startOfWeek, addDays, parseISO } from "date-fns";
import { exportMenuToPDF } from "@/lib/pdf-export";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import {
  DAYS,
  MEAL_TYPES,
  HEADCOUNT_MEAL_TYPES,
  QUANTITY_OPTIONS,
  TIMELINESS_OPTIONS,
  EVENT_TYPES,
  EVENT_HEADCOUNT_OPTIONS,
  ADJUSTED_MEAL_TIME_OPTIONS,
} from "@shared/schema";

interface Critique {
  id: number;
  menuId: number;
  houseDirectorId: number;
  fraternity: string;
  critiqueText: string | null;
  suggestedEdits: string | null;
  status: string;
  acknowledgedByAdmin: boolean;
  createdAt: string;
}

interface HdHeadcount {
  id: number;
  houseDirectorId: number;
  fraternity: string;
  mealDate: string;
  mealType: string;
  headcount: number;
  createdAt: string;
}

interface HdMealReview {
  id: number;
  houseDirectorId: number;
  menuId: number;
  fraternity: string;
  mealDay: string;
  mealType: string;
  qualityRating: number;
  quantityRating: string;
  timeliness: string;
  comment: string | null;
  createdAt: string;
}

interface HdEventRequest {
  id: number;
  houseDirectorId: number;
  fraternity: string;
  eventType: string;
  eventDate: string;
  expectedHeadcount: string;
  adjustedMealTime: string;
  status: string;
  createdAt: string;
}

interface FeedbackItem {
  id: number;
  menuId: number;
  userId: null;
  mealDay: string;
  mealType: string;
  rating: number;
  comment: string | null;
  isAnonymous: boolean;
  isRead: boolean;
}

interface LatePlate {
  id: number;
  userId: number;
  type: string;
  details: string;
  status: string;
  date: string;
  mealDay: string | null;
  mealType: string | null;
  fraternity: string;
  userName: string;
  userEmail: string;
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

  const { data: headcounts } = useQuery<HdHeadcount[]>({
    queryKey: ['/api/hd/headcounts'],
    enabled: !!user,
  });

  const { data: mealReviews } = useQuery<HdMealReview[]>({
    queryKey: ['/api/hd/meal-reviews'],
    enabled: !!user,
  });

  const { data: eventRequests } = useQuery<HdEventRequest[]>({
    queryKey: ['/api/hd/event-requests'],
    enabled: !!user,
  });

  const { data: memberFeedback } = useQuery<FeedbackItem[]>({
    queryKey: ['/api/feedback'],
    enabled: !!user,
  });

  const { data: latePlates } = useQuery<LatePlate[]>({
    queryKey: ['/api/late-plates'],
    enabled: !!user,
  });

  // Critique modal state
  const [critiqueModalOpen, setCritiqueModalOpen] = useState(false);
  const [selectedMenuId, setSelectedMenuId] = useState<number | null>(null);
  const [critiqueText, setCritiqueText] = useState("");
  const [suggestedEdits, setSuggestedEdits] = useState("");

  // Meal review modal state
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [reviewMenuId, setReviewMenuId] = useState<number | null>(null);
  const [reviewMealDay, setReviewMealDay] = useState<string>("");
  const [reviewMealType, setReviewMealType] = useState<string>("");
  const [reviewQuality, setReviewQuality] = useState<number>(0);
  const [reviewQuantity, setReviewQuantity] = useState<string>("");
  const [reviewTimeliness, setReviewTimeliness] = useState<string>("");
  const [reviewComment, setReviewComment] = useState("");

  // Headcount form state
  const [hcMealDate, setHcMealDate] = useState("");
  const [hcMealType, setHcMealType] = useState<string>("");
  const [hcCount, setHcCount] = useState<string>("");

  // Event request modal state
  const [eventModalOpen, setEventModalOpen] = useState(false);
  const [eventType, setEventType] = useState<string>("");
  const [eventDate, setEventDate] = useState("");
  const [eventHeadcount, setEventHeadcount] = useState<string>("");
  const [eventMealTime, setEventMealTime] = useState<string>("No Change");

  // Profile dialog state
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

  // Mutations
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
      toast({ title: "Note submitted", description: "Your note has been sent to the admin only." });
      setCritiqueModalOpen(false);
      setCritiqueText("");
      setSuggestedEdits("");
      setSelectedMenuId(null);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to submit note", variant: "destructive" });
    },
  });

  const createHeadcountMutation = useMutation({
    mutationFn: async (data: { mealDate: string; mealType: string; headcount: number }) => {
      const res = await apiRequest("POST", "/api/hd/headcount", data);
      if (!res.ok) throw new Error("Failed to submit headcount");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/hd/headcounts'] });
      toast({ title: "Headcount reported", description: "Your headcount has been recorded." });
      setHcMealDate("");
      setHcMealType("");
      setHcCount("");
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to report headcount", variant: "destructive" });
    },
  });

  const createMealReviewMutation = useMutation({
    mutationFn: async (data: { menuId: number; mealDay: string; mealType: string; qualityRating: number; quantityRating: string; timeliness: string; comment: string | null }) => {
      const res = await apiRequest("POST", "/api/hd/meal-review", data);
      if (!res.ok) throw new Error("Failed to submit review");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/hd/meal-reviews'] });
      toast({ title: "Review submitted", description: "Your meal review has been recorded." });
      setReviewModalOpen(false);
      resetReviewForm();
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to submit review", variant: "destructive" });
    },
  });

  const createEventRequestMutation = useMutation({
    mutationFn: async (data: { eventType: string; eventDate: string; expectedHeadcount: string; adjustedMealTime: string }) => {
      const res = await apiRequest("POST", "/api/hd/event-request", data);
      if (!res.ok) throw new Error("Failed to submit event request");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/hd/event-requests'] });
      toast({ title: "Event request submitted", description: "Your event request has been sent." });
      setEventModalOpen(false);
      setEventType("");
      setEventDate("");
      setEventHeadcount("");
      setEventMealTime("No Change");
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to submit event request", variant: "destructive" });
    },
  });

  const resetReviewForm = () => {
    setReviewMenuId(null);
    setReviewMealDay("");
    setReviewMealType("");
    setReviewQuality(0);
    setReviewQuantity("");
    setReviewTimeliness("");
    setReviewComment("");
  };

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

  // Week categorization
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
      toast({ title: "Error", description: "Please provide a note or suggested edits", variant: "destructive" });
      return;
    }
    createCritiqueMutation.mutate({
      menuId: selectedMenuId,
      critiqueText: critiqueText.trim(),
      suggestedEdits: suggestedEdits.trim(),
    });
  };

  const openReviewModal = (menuId: number, mealDay: string, mealType: string) => {
    setReviewMenuId(menuId);
    setReviewMealDay(mealDay);
    setReviewMealType(mealType);
    setReviewQuality(0);
    setReviewQuantity("");
    setReviewTimeliness("");
    setReviewComment("");
    setReviewModalOpen(true);
  };

  const handleSubmitReview = () => {
    if (!reviewMenuId || !reviewMealDay || !reviewMealType) return;
    if (reviewQuality < 1 || reviewQuality > 5) {
      toast({ title: "Error", description: "Please select a quality rating", variant: "destructive" });
      return;
    }
    if (!reviewQuantity) {
      toast({ title: "Error", description: "Please select a quantity rating", variant: "destructive" });
      return;
    }
    if (!reviewTimeliness) {
      toast({ title: "Error", description: "Please select timeliness", variant: "destructive" });
      return;
    }
    createMealReviewMutation.mutate({
      menuId: reviewMenuId,
      mealDay: reviewMealDay,
      mealType: reviewMealType,
      qualityRating: reviewQuality,
      quantityRating: reviewQuantity,
      timeliness: reviewTimeliness,
      comment: reviewComment.trim() || null,
    });
  };

  const handleSubmitHeadcount = () => {
    if (!hcMealDate || !hcMealType || !hcCount) {
      toast({ title: "Error", description: "Please fill in all fields", variant: "destructive" });
      return;
    }
    const count = parseInt(hcCount);
    if (isNaN(count) || count < 0) {
      toast({ title: "Error", description: "Headcount must be a positive number", variant: "destructive" });
      return;
    }
    createHeadcountMutation.mutate({
      mealDate: hcMealDate,
      mealType: hcMealType,
      headcount: count,
    });
  };

  const handleSubmitEventRequest = () => {
    if (!eventType || !eventDate || !eventHeadcount) {
      toast({ title: "Error", description: "Please fill in all required fields", variant: "destructive" });
      return;
    }
    createEventRequestMutation.mutate({
      eventType,
      eventDate,
      expectedHeadcount: eventHeadcount,
      adjustedMealTime: eventMealTime,
    });
  };

  const getStatusBadge = (critique: Critique) => {
    if (critique.acknowledgedByAdmin) {
      return <Badge variant="secondary">Reviewed by Admin</Badge>;
    }
    return <Badge variant="outline">Awaiting Admin Review</Badge>;
  };

  // Star rating component
  const StarRating = ({ value, onChange }: { value: number; onChange: (v: number) => void }) => (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => onChange(star)}
          className="focus:outline-none"
        >
          <Star
            className={`w-6 h-6 transition-colors ${star <= value ? "fill-amber-500 text-amber-500" : "text-neutral-300"}`}
          />
        </button>
      ))}
    </div>
  );

  // Active late plates (pending, for the current week)
  const activeLatePlates = latePlates?.filter((lp) => lp.status === "pending") || [];

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
                    <CardDescription>
                      {menu.fraternity}
                      {menu.chefName && (
                        <span className="ml-2 text-amber-600 font-medium">
                          Chef: {menu.chefName}
                        </span>
                      )}
                    </CardDescription>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <Badge className={menu.status === 'approved' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200 font-semibold' : 'bg-amber-100 text-amber-800 border border-amber-200 font-semibold'}>
                      {menu.status}
                    </Badge>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openCritiqueModal(menu.id)}
                      data-testid={`button-critique-menu-${menu.id}`}
                    >
                      <ClipboardList className="w-4 h-4 mr-1" />
                      <span className="hidden sm:inline">Send Admin Note</span>
                      <span className="sm:hidden">Note</span>
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
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="text-sm font-semibold text-muted-foreground">{mealType}</h4>
                            {menu.status === 'approved' && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 rounded-full px-3 text-xs border-amber-300/50 text-amber-700 hover:bg-amber-50 hover:border-amber-400"
                                onClick={() => {
                                  // Find what day items are for - use the first item's day
                                  const day = mealItems[0]?.day || "Monday";
                                  openReviewModal(menu.id, day, mealType);
                                }}
                              >
                                <Star className="mr-1 h-3 w-3" />
                                Rate
                              </Button>
                            )}
                          </div>
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
          <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-black tracking-tight">House Director Dashboard</h1>
              <p className="text-muted-foreground mt-1">{user?.fraternity}</p>
            </div>
            <div className="flex gap-2">
              <Button
                className="bg-amber-500 hover:bg-amber-600 text-black font-semibold shadow-sm"
                size="sm"
                onClick={() => setEventModalOpen(true)}
              >
                <CalendarPlus className="w-4 h-4 mr-2" />
                Event Request
              </Button>
              <Button variant="outline" size="sm" className="border-border hover:bg-neutral-100 font-medium" onClick={() => setProfileDialogOpen(true)} data-testid="button-account-settings">
                <Settings className="w-4 h-4 mr-2" />
                Account Settings
              </Button>
            </div>
          </div>

          <Tabs defaultValue="menus" className="space-y-6">
            <TabsList className="grid w-full max-w-2xl grid-cols-4">
              <TabsTrigger value="menus" data-testid="tab-menus">
                <Calendar className="w-4 h-4 mr-2" />
                Menus
              </TabsTrigger>
              <TabsTrigger value="headcount" data-testid="tab-headcount">
                <Users className="w-4 h-4 mr-2" />
                Headcount
              </TabsTrigger>
              <TabsTrigger value="feedback" data-testid="tab-feedback">
                <MessageSquare className="w-4 h-4 mr-2" />
                Feedback
              </TabsTrigger>
              <TabsTrigger value="my-critiques" data-testid="tab-critiques">
                <ClipboardList className="w-4 h-4 mr-2" />
                My Notes
              </TabsTrigger>
            </TabsList>

            {/* ===== MENUS TAB ===== */}
            <TabsContent value="menus" className="space-y-8">
              {isLoadingMenus ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <>
                  {/* Late Plate Visibility */}
                  {activeLatePlates.length > 0 && (
                    <Card className="border-amber-200/60 bg-amber-50/30">
                      <CardHeader className="pb-2">
                        <div className="flex items-center gap-2">
                          <UtensilsCrossed className="w-5 h-5 text-amber-500" />
                          <CardTitle className="text-base">Late Plate Requests</CardTitle>
                          <Badge className="bg-amber-100 text-amber-800 border border-amber-200 font-semibold">{activeLatePlates.length} pending</Badge>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="grid gap-2">
                          {activeLatePlates.map((lp) => (
                            <div key={lp.id} className="flex items-center justify-between bg-white rounded-lg px-3 py-2 border text-sm">
                              <div>
                                <span className="font-medium">{lp.userName}</span>
                                <span className="text-muted-foreground ml-2">
                                  {lp.mealType && `${lp.mealType}`}
                                  {lp.mealDay && ` - ${format(parseISO(lp.mealDay), "MMM d")}`}
                                </span>
                              </div>
                              <Badge variant="outline" className="text-amber-700 border-amber-300">{lp.status}</Badge>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  <MenuSection title="Current Week" menuList={categorizedMenus.current} icon={Calendar} />
                  <MenuSection title="Upcoming Week" menuList={categorizedMenus.upcoming} icon={Calendar} />
                  <MenuSection title="Previous Week" menuList={categorizedMenus.previous} icon={Calendar} />
                </>
              )}
            </TabsContent>

            {/* ===== HEADCOUNT TAB ===== */}
            <TabsContent value="headcount" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg font-black tracking-tight">Report Headcount</CardTitle>
                  <CardDescription>Report expected meal attendance for your house</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label>Meal Date</Label>
                      <Input
                        type="date"
                        value={hcMealDate}
                        onChange={(e) => setHcMealDate(e.target.value)}
                        data-testid="input-hc-date"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Meal Type</Label>
                      <Select value={hcMealType} onValueChange={setHcMealType}>
                        <SelectTrigger data-testid="select-hc-meal-type">
                          <SelectValue placeholder="Select meal" />
                        </SelectTrigger>
                        <SelectContent>
                          {HEADCOUNT_MEAL_TYPES.map((type) => (
                            <SelectItem key={type} value={type}>{type}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Headcount</Label>
                      <Input
                        type="number"
                        min="0"
                        placeholder="0"
                        value={hcCount}
                        onChange={(e) => setHcCount(e.target.value)}
                        data-testid="input-hc-count"
                      />
                    </div>
                  </div>
                  <Button
                    className="bg-amber-500 hover:bg-amber-600 text-black font-semibold shadow-sm"
                    onClick={handleSubmitHeadcount}
                    disabled={createHeadcountMutation.isPending}
                    data-testid="button-submit-headcount"
                  >
                    {createHeadcountMutation.isPending ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Submitting...</>
                    ) : (
                      <><Send className="w-4 h-4 mr-2" />Report Headcount</>
                    )}
                  </Button>
                </CardContent>
              </Card>

              {/* Recent headcount entries */}
              <div className="space-y-4">
                <h2 className="text-lg font-semibold">Recent Reports</h2>
                {headcounts && headcounts.length > 0 ? (
                  <div className="grid gap-3">
                    {headcounts.slice(0, 20).map((hc) => (
                      <Card key={hc.id}>
                        <CardContent className="py-3 flex items-center justify-between">
                          <div>
                            <span className="font-medium">{format(parseISO(hc.mealDate), "MMM d, yyyy")}</span>
                            <Badge variant="outline" className="ml-2">{hc.mealType}</Badge>
                          </div>
                          <div className="text-right">
                            <span className="text-2xl font-black text-amber-600">{hc.headcount}</span>
                            <span className="text-xs text-muted-foreground ml-1">people</span>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <Card>
                    <CardContent className="py-8 text-center text-muted-foreground">
                      <Users className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                      No headcount reports yet
                    </CardContent>
                  </Card>
                )}
              </div>
            </TabsContent>

            {/* ===== FEEDBACK TAB ===== */}
            <TabsContent value="feedback" className="space-y-6">
              <div>
                <h2 className="text-lg font-black tracking-tight mb-1">Member Feedback Summary</h2>
                <p className="text-sm text-muted-foreground mb-4">Anonymous feedback from members for your fraternity&apos;s menus</p>
              </div>

              {memberFeedback && memberFeedback.length > 0 ? (
                <div className="grid gap-3">
                  {memberFeedback.map((fb) => {
                    const menu = menus?.find((m: any) => m.id === fb.menuId);
                    return (
                      <Card key={fb.id}>
                        <CardContent className="py-4">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-medium text-sm">
                                  {menu ? format(parseISO(menu.weekOf), "MMM d") : `Menu #${fb.menuId}`}
                                </span>
                                <Badge variant="outline" className="text-xs">{fb.mealDay} {fb.mealType}</Badge>
                              </div>
                              {fb.comment && (
                                <p className="text-sm text-muted-foreground mt-1">{fb.comment}</p>
                              )}
                            </div>
                            <div className="flex items-center gap-0.5 shrink-0">
                              {[1, 2, 3, 4, 5].map((s) => (
                                <Star key={s} className={`w-4 h-4 ${s <= fb.rating ? "fill-amber-500 text-amber-500" : "text-neutral-200"}`} />
                              ))}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              ) : (
                <Card>
                  <CardContent className="py-12 text-center">
                    <MessageSquare className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">No member feedback yet</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Feedback will appear here once members rate meals
                    </p>
                  </CardContent>
                </Card>
              )}

              {/* HD's own meal reviews section */}
              {mealReviews && mealReviews.length > 0 && (
                <div className="space-y-4 mt-8">
                  <h2 className="text-lg font-semibold">Your Meal Reviews</h2>
                  <div className="grid gap-3">
                    {mealReviews.map((review) => {
                      const menu = menus?.find((m: any) => m.id === review.menuId);
                      return (
                        <Card key={review.id}>
                          <CardContent className="py-4">
                            <div className="flex items-start justify-between gap-4">
                              <div>
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="font-medium text-sm">
                                    {menu ? format(parseISO(menu.weekOf), "MMM d") : `Menu #${review.menuId}`}
                                  </span>
                                  <Badge variant="outline" className="text-xs">{review.mealDay} {review.mealType}</Badge>
                                </div>
                                <div className="flex gap-3 text-xs text-muted-foreground mt-1">
                                  <span>Quantity: {review.quantityRating}</span>
                                  <span>Timeliness: {review.timeliness}</span>
                                </div>
                                {review.comment && <p className="text-sm text-muted-foreground mt-1">{review.comment}</p>}
                              </div>
                              <div className="flex items-center gap-0.5 shrink-0">
                                {[1, 2, 3, 4, 5].map((s) => (
                                  <Star key={s} className={`w-4 h-4 ${s <= review.qualityRating ? "fill-amber-500 text-amber-500" : "text-neutral-200"}`} />
                                ))}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              )}
            </TabsContent>

            {/* ===== MY NOTES TAB ===== */}
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
                                Note for {menu ? format(parseISO(menu.weekOf), "MMMM d, yyyy") : `Menu #${critique.menuId}`}
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
                              <Label className="text-xs text-muted-foreground">Note</Label>
                              <p className="text-sm mt-1">{critique.critiqueText}</p>
                            </div>
                          )}
                          {critique.suggestedEdits && (
                            <div>
                              <Label className="text-xs text-muted-foreground">Suggested Edits</Label>
                              <p className="text-sm mt-1">{critique.suggestedEdits}</p>
                            </div>
                          )}
                          <div className="pt-2 text-xs text-muted-foreground">
                            Admin review: {critique.acknowledgedByAdmin ? "Reviewed" : "Pending"}
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
                    <p className="text-muted-foreground">No notes submitted yet</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      View menus and send admin notes from the Menus tab
                    </p>
                  </CardContent>
                </Card>
              )}

              {/* Event Requests Section within My Notes */}
              {eventRequests && eventRequests.length > 0 && (
                <div className="space-y-4 mt-8">
                  <h2 className="text-lg font-semibold">Your Event Requests</h2>
                  <div className="grid gap-3">
                    {eventRequests.map((er) => (
                      <Card key={er.id}>
                        <CardContent className="py-4">
                          <div className="flex items-center justify-between flex-wrap gap-2">
                            <div>
                              <span className="font-medium">{er.eventType}</span>
                              <span className="text-muted-foreground ml-2">{format(parseISO(er.eventDate), "MMM d, yyyy")}</span>
                              <div className="text-xs text-muted-foreground mt-1">
                                Expected: {er.expectedHeadcount} people
                                {er.adjustedMealTime && er.adjustedMealTime !== "No Change" && ` | Meal time: ${er.adjustedMealTime}`}
                              </div>
                            </div>
                            <Badge className={er.status === 'approved' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200 font-semibold' : 'bg-amber-100 text-amber-800 border border-amber-200 font-semibold'}>
                              {er.status}
                            </Badge>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </main>

      {/* ===== CRITIQUE MODAL ===== */}
      <Dialog open={critiqueModalOpen} onOpenChange={setCritiqueModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Send Note to Admin</DialogTitle>
            <DialogDescription>
              Provide notes or suggested edits for this menu. These notes go only to the admin. Chefs cannot see or acknowledge them.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="critique">Note / Feedback</Label>
              <Textarea
                id="critique"
                placeholder="Share your notes for the admin..."
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
                placeholder="Suggest specific changes for admin review..."
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
              className="bg-amber-500 hover:bg-amber-600 text-black font-semibold shadow-sm"
              onClick={handleSubmitCritique}
              disabled={createCritiqueMutation.isPending}
              data-testid="button-submit-critique"
            >
              {createCritiqueMutation.isPending ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Submitting...</>
              ) : (
                <><Send className="w-4 h-4 mr-2" />Submit Note</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== MEAL REVIEW MODAL ===== */}
      <Dialog open={reviewModalOpen} onOpenChange={(open) => { if (!open) { setReviewModalOpen(false); resetReviewForm(); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Rate Meal</DialogTitle>
            <DialogDescription>
              {reviewMealDay} {reviewMealType}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Quality (1-5 stars)</Label>
              <StarRating value={reviewQuality} onChange={setReviewQuality} />
            </div>

            <div className="space-y-2">
              <Label>Quantity</Label>
              <Select value={reviewQuantity} onValueChange={setReviewQuantity}>
                <SelectTrigger data-testid="select-review-quantity">
                  <SelectValue placeholder="Select quantity" />
                </SelectTrigger>
                <SelectContent>
                  {QUANTITY_OPTIONS.map((opt) => (
                    <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Timeliness</Label>
              <Select value={reviewTimeliness} onValueChange={setReviewTimeliness}>
                <SelectTrigger data-testid="select-review-timeliness">
                  <SelectValue placeholder="Select timeliness" />
                </SelectTrigger>
                <SelectContent>
                  {TIMELINESS_OPTIONS.map((opt) => (
                    <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Comment (optional, max 100 chars)</Label>
              <Input
                placeholder="Brief comment..."
                value={reviewComment}
                onChange={(e) => setReviewComment(e.target.value.slice(0, 100))}
                maxLength={100}
                data-testid="input-review-comment"
              />
              <p className="text-xs text-muted-foreground">{reviewComment.length}/100</p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setReviewModalOpen(false); resetReviewForm(); }}>Cancel</Button>
            <Button
              className="bg-amber-500 hover:bg-amber-600 text-black font-semibold shadow-sm"
              onClick={handleSubmitReview}
              disabled={createMealReviewMutation.isPending}
              data-testid="button-submit-review"
            >
              {createMealReviewMutation.isPending ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Submitting...</>
              ) : (
                <><Star className="w-4 h-4 mr-2" />Submit Review</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== EVENT REQUEST MODAL ===== */}
      <Dialog open={eventModalOpen} onOpenChange={setEventModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Event / Special Meal Request</DialogTitle>
            <DialogDescription>
              Request a special meal arrangement for an upcoming event.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Event Type</Label>
              <Select value={eventType} onValueChange={setEventType}>
                <SelectTrigger data-testid="select-event-type">
                  <SelectValue placeholder="Select event type" />
                </SelectTrigger>
                <SelectContent>
                  {EVENT_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>{type}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Event Date</Label>
              <Input
                type="date"
                value={eventDate}
                onChange={(e) => setEventDate(e.target.value)}
                data-testid="input-event-date"
              />
            </div>

            <div className="space-y-2">
              <Label>Expected Headcount</Label>
              <Select value={eventHeadcount} onValueChange={setEventHeadcount}>
                <SelectTrigger data-testid="select-event-headcount">
                  <SelectValue placeholder="Select headcount range" />
                </SelectTrigger>
                <SelectContent>
                  {EVENT_HEADCOUNT_OPTIONS.map((opt) => (
                    <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Adjusted Meal Time (optional)</Label>
              <Select value={eventMealTime} onValueChange={setEventMealTime}>
                <SelectTrigger data-testid="select-event-meal-time">
                  <SelectValue placeholder="No Change" />
                </SelectTrigger>
                <SelectContent>
                  {ADJUSTED_MEAL_TIME_OPTIONS.map((opt) => (
                    <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEventModalOpen(false)}>Cancel</Button>
            <Button
              className="bg-amber-500 hover:bg-amber-600 text-black font-semibold shadow-sm"
              onClick={handleSubmitEventRequest}
              disabled={createEventRequestMutation.isPending}
              data-testid="button-submit-event-request"
            >
              {createEventRequestMutation.isPending ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Submitting...</>
              ) : (
                <><CalendarPlus className="w-4 h-4 mr-2" />Submit Request</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== PROFILE DIALOG ===== */}
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
