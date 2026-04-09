import { useState, useMemo, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useMenus } from "@/hooks/use-menus";
import { useCreateRequest, useCreateFeedback, useRequests, useFeedback, useDeleteRequest } from "@/hooks/use-requests";
import { useNotifications } from "@/hooks/use-notifications";
import { Sidebar } from "@/components/Sidebar";
import { MenuCard } from "@/components/MenuCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Clock, RefreshCcw, Star, Calendar, FileText, AlertCircle, Trash2, Lightbulb, Loader2, ArrowRight, UtensilsCrossed, CheckCircle2, X, ShieldCheck } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { DAYS, MEAL_TYPES } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { format, startOfWeek, addDays, isBefore, setHours, setMinutes, getDay } from "date-fns";
import type { LucideIcon } from "lucide-react";

type UserRequestType = "late_plate" | "substitution" | "menu_suggestion";

interface InlineMessage {
  title: string;
  description: string;
}

export default function UserDashboard() {
  const [location, setLocation] = useLocation();
  const { user } = useAuth();
  const { data: menus, isLoading } = useMenus({ status: 'approved', fraternity: user?.fraternity || undefined });
  const { data: userRequests, isLoading: isLoadingRequests } = useRequests();
  const { data: userFeedback, isLoading: isLoadingFeedback } = useFeedback();
  const { mutate: createRequest, isPending: isRequesting } = useCreateRequest();
  const { mutate: createFeedback, isPending: isFeedbacking } = useCreateFeedback();
  const { mutate: deleteRequest, isPending: isDeleting } = useDeleteRequest();
  const { notifySubstitutionDecision, notifyNewMenu, isGranted: notificationsEnabled } = useNotifications();
  
  // Track previous request statuses to detect changes
  const prevRequestStatuses = useRef<Map<number, string>>(new Map());
  // Track known menu IDs to detect new menus
  const knownMenuIds = useRef<Set<number>>(new Set());
  const hasInitializedMenus = useRef(false);
  
  // Detect substitution status changes and notify user
  useEffect(() => {
    if (!userRequests || !notificationsEnabled) return;
    
    const currentStatuses = new Map<number, string>();
    userRequests.forEach((req: any) => {
      if (req.type === 'substitution') {
        currentStatuses.set(req.id, req.status);
        
        const prevStatus = prevRequestStatuses.current.get(req.id);
        // Only notify if status changed from pending to approved/rejected
        if (prevStatus === 'pending' && (req.status === 'approved' || req.status === 'rejected')) {
          const mealInfo = req.mealDay && req.mealType ? `${req.mealDay} ${req.mealType}` : 'your request';
          notifySubstitutionDecision(req.status === 'approved', mealInfo);
        }
      }
    });
    
    prevRequestStatuses.current = currentStatuses;
  }, [userRequests, notificationsEnabled, notifySubstitutionDecision]);
  
  // Detect when new approved menus appear (new menu posted for user's fraternity)
  useEffect(() => {
    if (!menus || !notificationsEnabled) return;
    
    // On first load, just record existing menu IDs
    if (!hasInitializedMenus.current) {
      menus.forEach((menu: any) => knownMenuIds.current.add(menu.id));
      hasInitializedMenus.current = true;
      return;
    }
    
    // Check for new menus we haven't seen before
    menus.forEach((menu: any) => {
      if (!knownMenuIds.current.has(menu.id)) {
        // New menu detected
        const weekOf = format(new Date(menu.weekOf), "MMMM d");
        notifyNewMenu(menu.fraternity || user?.fraternity || "your fraternity", weekOf);
        knownMenuIds.current.add(menu.id);
      }
    });
  }, [menus, notificationsEnabled, notifyNewMenu]);
  
  const [requestModalOpen, setRequestModalOpen] = useState(false);
  const [requestType, setRequestType] = useState<UserRequestType>("late_plate");
  const [requestDetails, setRequestDetails] = useState("");
  const [selectedMealDay, setSelectedMealDay] = useState<string>("");
  const [selectedMealType, setSelectedMealType] = useState<"Lunch" | "Dinner" | "">("");
  const { toast } = useToast();
  const [inlineMessage, setInlineMessage] = useState<InlineMessage | null>(null);
  
  const [feedbackModalOpen, setFeedbackModalOpen] = useState(false);
  const [selectedMenuId, setSelectedMenuId] = useState<number | null>(null);
  const [feedbackMealDay, setFeedbackMealDay] = useState<string>("");
  const [feedbackMealType, setFeedbackMealType] = useState<"Lunch" | "Dinner" | "">("");
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");

  useEffect(() => {
    if (!inlineMessage) return;

    const timeout = window.setTimeout(() => {
      setInlineMessage(null);
    }, 4500);

    return () => window.clearTimeout(timeout);
  }, [inlineMessage]);

  // Filter requests to only show user's own
  const myRequests = userRequests?.filter((r: any) => r.userId === user?.id) || [];
  
  // Filter feedback to only show user's own
  const myFeedback = userFeedback?.filter((f: any) => f.userId === user?.id) || [];
  const requestTypeOptions: {
    type: UserRequestType;
    title: string;
    description: string;
    icon: LucideIcon;
  }[] = [
    {
      type: "late_plate",
      title: "Late plate",
      description: "Reserve a meal for later pickup before the cutoff.",
      icon: Clock,
    },
    {
      type: "substitution",
      title: "Substitution",
      description: "Ask for a change based on allergies or dietary needs.",
      icon: RefreshCcw,
    },
    {
      type: "menu_suggestion",
      title: "Meal suggestion",
      description: "Send a future meal idea directly to the chef.",
      icon: Lightbulb,
    },
  ];

  // Generate available meal options for late plate requests
  // Shows meals for the current week (Mon-Fri) that haven't passed their cutoff time
  const availableMealOptions = useMemo(() => {
    const options: { date: Date; day: string; mealType: "Lunch" | "Dinner"; label: string; isAvailable: boolean }[] = [];
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = startOfWeek(now, { weekStartsOn: 1 }); // Monday
    
    for (let i = 0; i < 5; i++) { // Mon-Fri
      const date = addDays(weekStart, i);
      const dayName = format(date, "EEEE");
      const dateStr = format(date, "MMMM d");
      const dateStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      const isFutureDay = dateStart > todayStart;
      const isTodayDate = dateStart.getTime() === todayStart.getTime();
      
      // Add lunch option
      const lunchCutoff = setMinutes(setHours(date, 12), 45); // 12:45 PM
      // For today, check cutoff time. For future days, always available.
      const lunchAvailable = isFutureDay || (isTodayDate && isBefore(now, lunchCutoff));
      options.push({
        date,
        day: dayName,
        mealType: "Lunch",
        label: `${dayName}, ${dateStr} - Lunch`,
        isAvailable: lunchAvailable
      });
      
      // Add dinner option (except Friday and Wednesday)
      if (i < 4) { // No Friday dinner
        const dinnerCutoff = setMinutes(setHours(date, 17), 45); // 5:45 PM
        const isWednesday = getDay(date) === 3;
        // Wednesday dinners are NEVER available
        // For today, check cutoff time. For future days, always available (except Wednesday).
        const dinnerAvailable = !isWednesday && (isFutureDay || (isTodayDate && isBefore(now, dinnerCutoff)));
        
        options.push({
          date,
          day: dayName,
          mealType: "Dinner",
          label: `${dayName}, ${dateStr} - Dinner`,
          isAvailable: dinnerAvailable
        });
      }
    }
    
    return options.filter(opt => opt.isAvailable);
  }, []);

  // Get cutoff time display for selected meal
  const getCutoffTimeDisplay = (mealType: "Lunch" | "Dinner") => {
    return mealType === "Lunch" ? "12:45 PM" : "5:45 PM";
  };

  const currentWeekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const currentWeekKey = format(currentWeekStart, "yyyy-MM-dd");
  const sortedMenus = useMemo(() => {
    return [...(menus || [])].sort((a, b) => new Date(a.weekOf).getTime() - new Date(b.weekOf).getTime());
  }, [menus]);

  const currentMenu = useMemo(() => {
    if (sortedMenus.length === 0) return null;

    const exactCurrentWeek = sortedMenus.find((menu) => format(new Date(menu.weekOf), "yyyy-MM-dd") === currentWeekKey);
    if (exactCurrentWeek) return exactCurrentWeek;

    const upcomingMenu = sortedMenus.find((menu) => new Date(menu.weekOf) > currentWeekStart);
    if (upcomingMenu) return upcomingMenu;

    return sortedMenus[sortedMenus.length - 1];
  }, [currentWeekKey, currentWeekStart, sortedMenus]);
  
  // Determine current view based on location
  const currentView = location === '/requests' ? 'requests' : location === '/feedback' ? 'feedback' : 'menu';
  const selectedFeedbackMenu = menus?.find((menu) => menu.id === selectedMenuId) || currentMenu;

  const getRequestStatusBadge = (status: string) => {
    if (status === "approved") {
      return <Badge className="rounded-sm uppercase tracking-wider font-bold text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/10 font-display">Approved</Badge>;
    }

    if (status === "rejected" || status === "denied") {
      return <Badge className="rounded-sm uppercase tracking-wider font-bold text-[10px] bg-red-500/10 text-red-400 border border-red-500/20 font-display">Not approved</Badge>;
    }

    return <Badge className="rounded-sm uppercase tracking-wider font-bold text-[10px] bg-amber-500/10 text-amber-400 border border-amber-500/20 font-display">Pending review</Badge>;
  };

  const getRequestSummary = (request: any) => {
    if (request.type === "late_plate" && request.mealDay && request.mealType) {
      return `${format(new Date(request.mealDay), "EEEE, MMM d")} · ${request.mealType}`;
    }

    if (request.type === "substitution") {
      return "Sent to the chef for review";
    }

    if (request.type === "menu_suggestion") {
      return "Saved as a future menu idea";
    }

    return "Request details";
  };

  const handleRequestSubmit = () => {
    if (!user) return;
    
    // For late plate requests, validate meal selection
    if (requestType === "late_plate") {
      if (!selectedMealDay || !selectedMealType) {
        toast({
          title: "Please select a meal",
          description: "Choose which day and meal you need a late plate for.",
          variant: "destructive"
        });
        return;
      }
      
      // Find the selected option to get the date
      const selectedOption = availableMealOptions.find(
        opt => format(opt.date, "yyyy-MM-dd") === selectedMealDay && opt.mealType === selectedMealType
      );
      
      if (!selectedOption) {
        toast({
          title: "Invalid selection",
          description: "The cutoff time for this meal has passed.",
          variant: "destructive"
        });
        return;
      }
      
      createRequest({
        userId: user.id,
        type: requestType,
        details: requestDetails.trim(),
        status: "pending",
        date: new Date().toISOString(),
        mealDay: selectedMealDay,
        mealType: selectedMealType,
        fraternity: user.fraternity || undefined,
      }, {
        onSuccess: () => {
          setRequestModalOpen(false);
          setRequestDetails("");
          setSelectedMealDay("");
          setSelectedMealType("");
          setInlineMessage({
            title: "Late plate request sent",
            description: `You're set for ${selectedOption.label}. You can track the request from the Requests screen.`,
          });
          toast({
            title: "Late Plate Request Submitted",
            description: `Your request for ${selectedOption.label} has been submitted.`
          });
        }
      });
    } else {
      // Substitutions and menu suggestions
      createRequest({
        userId: user.id,
        type: requestType,
        details: requestDetails.trim(),
        status: "pending",
        date: new Date().toISOString(),
        fraternity: user.fraternity || undefined,
      }, {
        onSuccess: () => {
          setRequestModalOpen(false);
          setRequestDetails("");
          const typeLabel = requestType === 'substitution' ? 'Substitution' : 'Menu Suggestion';
          setInlineMessage({
            title: `${typeLabel} sent`,
            description: requestType === "substitution"
              ? "The chef has your request and can review it from the kitchen dashboard."
              : "Your idea was sent to the chef for future menu planning.",
          });
          toast({
            title: `${typeLabel} Submitted`,
            description: `Your ${typeLabel.toLowerCase()} has been sent to the chef.`
          });
        }
      });
    }
  };

  const handleFeedbackSubmit = () => {
    if (!user || !selectedMenuId || !feedbackMealDay || !feedbackMealType) return;
    createFeedback({
      userId: user.id,
      menuId: selectedMenuId,
      mealDay: feedbackMealDay as typeof DAYS[number],
      mealType: feedbackMealType as typeof MEAL_TYPES[number],
      rating,
      comment,
      isAnonymous: false,
    }, {
      onSuccess: () => {
        setFeedbackModalOpen(false);
        setComment("");
        setRating(5);
        setFeedbackMealDay("");
        setFeedbackMealType("");
        setInlineMessage({
          title: "Feedback recorded",
          description: `Thanks for rating ${feedbackMealDay} ${feedbackMealType}. Your input helps the chef improve the menu.`,
        });
        toast({
          title: "Feedback Submitted",
          description: `Your rating for ${feedbackMealDay} ${feedbackMealType} has been recorded.`
        });
      }
    });
  };

  const openRequestModal = (type: typeof requestType) => {
    setRequestType(type);
    setSelectedMealDay("");
    setSelectedMealType("");
    setRequestDetails("");
    setRequestModalOpen(true);
  };

  const weekRange = `${format(currentWeekStart, "MMM d")} - ${format(addDays(currentWeekStart, 4), "MMM d, yyyy")}`;
  const menuContextLabel = !currentMenu
    ? `Week of ${weekRange}`
    : format(new Date(currentMenu.weekOf), "yyyy-MM-dd") === currentWeekKey
    ? "This week's menu"
    : new Date(currentMenu.weekOf) > currentWeekStart
    ? "Next available menu"
    : "Most recent published menu";

  const canSubmitRequest = requestType === "late_plate"
    ? Boolean(selectedMealDay && selectedMealType)
    : requestDetails.trim().length > 0;

  const weeklyMenuByDay = useMemo(() => {
    if (!currentMenu) return [];
    return DAYS.map((day) => ({
      day,
      items: currentMenu.items.filter((item) => item.day === day),
    }));
  }, [currentMenu]);

  const todayName = format(new Date(), "EEEE");
  const todaysMenu = weeklyMenuByDay.find((entry) => entry.day === todayName && entry.items.length > 0) || null;
  const firstAvailableMeal = availableMealOptions[0] || null;
  const totalMealsThisWeek = currentMenu?.items.length || 0;

  const handleOpenLatePlate = () => {
    setRequestType("late_plate");
    setRequestDetails("");
    if (firstAvailableMeal) {
      setSelectedMealDay(format(firstAvailableMeal.date, "yyyy-MM-dd"));
      setSelectedMealType(firstAvailableMeal.mealType);
    } else {
      setSelectedMealDay("");
      setSelectedMealType("");
    }
    setRequestModalOpen(true);
  };

  const handleOpenFeedback = (menuId?: number, day?: string, mealType?: "Lunch" | "Dinner") => {
    setSelectedMenuId(menuId || currentMenu?.id || null);
    setFeedbackMealDay(day || "");
    setFeedbackMealType(mealType || "");
    setComment("");
    setRating(5);
    setFeedbackModalOpen(true);
  };

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      
      <main className="flex-1 md:pl-64 min-h-screen bg-background p-4 pt-16 md:pt-8 md:p-8 max-w-7xl mx-auto">
        {inlineMessage ? (
          <Alert className="relative mb-6 bg-[#1A1A1A] border border-white/[0.10] text-white shadow-sm transition-all rounded-sm">
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            <div className="pr-8">
              <AlertTitle>{inlineMessage.title}</AlertTitle>
              <AlertDescription>{inlineMessage.description}</AlertDescription>
            </div>
            <button
              type="button"
              onClick={() => setInlineMessage(null)}
              className="absolute right-3 top-3 rounded-full p-1 text-neutral-500 transition-colors hover:bg-white/[0.06] hover:text-white"
              aria-label="Dismiss message"
            >
              <X className="h-4 w-4" />
            </button>
          </Alert>
        ) : null}

        {/* Header - only show for menu view */}
        {currentView === 'menu' && (
          <header className="mb-6 md:mb-8">
            <div>
              <h2 className="text-2xl md:text-3xl font-display font-black uppercase tracking-wide text-white">Weekly Menu</h2>
              <p className="text-neutral-500 mt-1 md:mt-2 flex items-center gap-2 text-sm md:text-base font-sans">
                <Calendar className="w-4 h-4" />
                {menuContextLabel}: {currentMenu ? format(new Date(currentMenu.weekOf), "MMMM d, yyyy") : weekRange}
              </p>
            </div>
          </header>
        )}

        {/* Menu View */}
        {currentView === 'menu' && (
          <>
            {isLoading ? (
              <div className="space-y-4">
                <div className="grid gap-3 md:grid-cols-3">
                  {[1, 2, 3].map((card) => (
                    <Card key={card} className="bg-[#1A1A1A] border border-white/[0.10] rounded-sm">
                      <CardContent className="space-y-3 p-4">
                        <div className="h-3 w-24 animate-pulse rounded-sm bg-white/[0.03]" />
                        <div className="h-5 w-40 animate-pulse rounded-sm bg-white/[0.03]" />
                      </CardContent>
                    </Card>
                  ))}
                </div>
                <div className="flex h-64 flex-col items-center justify-center gap-3 rounded-sm border border-white/[0.10] bg-[#1A1A1A] text-neutral-500">
                  <Loader2 className="h-10 w-10 animate-spin text-amber-500" />
                  <p className="text-sm font-medium font-sans">Loading the latest published menu...</p>
                  <p className="text-xs text-neutral-500 font-sans">This usually takes just a moment.</p>
                </div>
              </div>
            ) : !currentMenu ? (
              <div className="bg-[#1A1A1A] rounded-sm p-12 text-center border border-white/[0.10] border-dashed">
                <Calendar className="w-10 h-10 mx-auto text-neutral-500 mb-3" />
                <h3 className="text-xl font-display font-bold uppercase tracking-wide text-white mb-2">No menu has been published yet</h3>
                <p className="text-neutral-500 max-w-md mx-auto font-sans">Your house menu will appear here as soon as it is approved and posted.</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid gap-3 md:grid-cols-3">
                  <Card className="bg-[#1A1A1A] border border-white/[0.10] rounded-sm transition-all duration-200 hover:-translate-y-0.5">
                    <CardContent className="p-4">
                      <p className="text-[10px] uppercase tracking-widest text-neutral-500 font-bold font-display">Next action</p>
                      <p className="text-base font-bold mt-1 text-white font-sans">
                        {firstAvailableMeal ? `Late plate for ${firstAvailableMeal.day} ${firstAvailableMeal.mealType}` : "Browse the week"}
                      </p>
                    </CardContent>
                  </Card>
                  <Card className="bg-[#1A1A1A] border border-white/[0.10] rounded-sm transition-all duration-200 hover:-translate-y-0.5">
                    <CardContent className="p-4">
                      <p className="text-[10px] uppercase tracking-widest text-neutral-500 font-bold font-display">Today</p>
                      <p className="text-base font-bold mt-1 text-white font-sans">{todaysMenu ? `${todaysMenu.day} has ${todaysMenu.items.length} meal${todaysMenu.items.length === 1 ? "" : "s"}` : "Check the weekly menu below"}</p>
                    </CardContent>
                  </Card>
                  <Card className="bg-[#1A1A1A] border border-white/[0.10] rounded-sm transition-all duration-200 hover:-translate-y-0.5">
                    <CardContent className="p-4">
                      <p className="text-[10px] uppercase tracking-widest text-neutral-500 font-bold font-display">This week</p>
                      <p className="text-base font-bold mt-1 text-white font-sans">{totalMealsThisWeek} published meals</p>
                    </CardContent>
                  </Card>
                </div>

                <Card className="bg-[#1A1A1A] border border-white/[0.10] rounded-sm">
                  <CardContent className="p-4 md:p-5">
                    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                      <div>
                        <p className="text-sm text-neutral-500 font-sans">Quick actions</p>
                        <h3 className="text-lg font-display font-bold uppercase tracking-wide text-white">See your meals, then act fast</h3>
                        <p className="mt-1 text-sm text-neutral-500 font-sans">
                          Request a late plate, ask for a substitution, or rate a meal from here.
                        </p>
                      </div>
                      <div className="grid gap-2 sm:grid-cols-3 md:w-auto">
                        <Button onClick={handleOpenLatePlate} className="justify-between shadow-sm transition-all duration-200 active:scale-[0.99] bg-amber-500 hover:bg-amber-400 text-black font-display font-bold uppercase tracking-wider rounded-sm">
                          Late plate
                          <ArrowRight className="h-4 w-4" />
                        </Button>
                        <Button variant="outline" onClick={() => openRequestModal("substitution")} className="justify-between transition-all duration-200 active:scale-[0.99] border-white/[0.14] text-neutral-400 hover:text-white hover:border-white/[0.2] rounded-sm font-display font-bold uppercase tracking-wider">
                          Substitution
                          <ArrowRight className="h-4 w-4" />
                        </Button>
                        <Button variant="outline" onClick={() => openRequestModal("menu_suggestion")} className="justify-between transition-all duration-200 active:scale-[0.99] border-white/[0.14] text-neutral-400 hover:text-white hover:border-white/[0.2] rounded-sm font-display font-bold uppercase tracking-wider">
                          Suggest meal
                          <ArrowRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    {firstAvailableMeal ? (
                      <div className="mt-4 rounded-sm border border-white/[0.10] bg-background p-3 text-sm">
                        <span className="font-medium text-white">Next late plate:</span> <span className="text-neutral-400">{firstAvailableMeal.label}</span>
                      </div>
                    ) : null}
                    <div className="mt-3 flex items-start gap-2 rounded-sm bg-white/[0.03] p-3 text-sm text-neutral-500 font-sans">
                      <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                      <p>Everything here is for your house only. Only admins can see who sent feedback.</p>
                    </div>
                  </CardContent>
                </Card>

                {todaysMenu ? (
                  <Card className="bg-[#1A1A1A] border border-white/[0.10] rounded-sm">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2">
                        <UtensilsCrossed className="h-4 w-4 text-amber-500" />
                        <h3 className="font-display font-bold uppercase tracking-wide text-white">Today&apos;s meals</h3>
                      </div>
                      <div className="mt-3 grid gap-3 md:grid-cols-2">
                        {todaysMenu.items.map((item) => (
                          <div key={item.id} className="rounded-sm border border-white/[0.10] bg-[#1E1E1E] p-3 transition-colors duration-200 hover:bg-white/[0.06]">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="text-sm font-semibold text-amber-500">{item.meal}</p>
                                <p className="text-base font-semibold leading-tight text-white">{item.description}</p>
                              </div>
                              {item.calories ? <Badge className="rounded-sm border-white/[0.14] text-neutral-400 font-display text-[10px] uppercase tracking-wider">{item.calories} kcal</Badge> : null}
                            </div>
                            {(item.side1 || item.side2 || item.side3) && (
                              <p className="mt-2 text-sm text-neutral-500 font-sans">
                                {[item.side1, item.side2, item.side3].filter(Boolean).join(" • ")}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ) : null}

                <div className="space-y-4">
                  {weeklyMenuByDay.map(({ day, items }) => (
                    <MenuCard
                      key={day}
                      day={day}
                      items={items}
                      menuId={currentMenu.id}
                      isToday={day === todayName}
                      onFeedbackClick={handleOpenFeedback}
                    />
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* Requests View */}
        {currentView === 'requests' && (
          <div className="space-y-4 md:space-y-6">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
              <div>
                <h2 className="text-xl md:text-2xl font-display font-bold uppercase tracking-wide text-white">My Requests</h2>
                <p className="text-sm text-neutral-500 font-sans">Track requests and send a new one from this screen.</p>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              {requestTypeOptions.map(({ type, title, description, icon: Icon }) => (
                <Button
                  key={type}
                  variant="outline"
                  className="h-auto items-start justify-start rounded-sm p-4 text-left transition-all duration-200 hover:-translate-y-0.5 active:scale-[0.99] border-white/[0.14] text-neutral-400 hover:text-white hover:border-white/[0.2] bg-[#1A1A1A]"
                  onClick={() => openRequestModal(type)}
                >
                  <div className="flex items-start gap-3">
                    <div className="rounded-sm bg-amber-500/10 p-2 text-amber-500">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="font-display font-bold text-white">{title}</div>
                      <div className="mt-1 text-xs text-neutral-500 whitespace-normal font-sans">{description}</div>
                    </div>
                  </div>
                </Button>
              ))}
            </div>
            
            {isLoadingRequests ? (
              <div className="h-48 flex flex-col items-center justify-center gap-3 text-neutral-500">
                <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
                <p className="text-sm font-sans">Loading your requests...</p>
              </div>
            ) : myRequests.length === 0 ? (
              <Card className="bg-[#1A1A1A] border border-white/[0.10] rounded-sm">
                <CardContent className="p-12 text-center">
                  <FileText className="w-12 h-12 mx-auto text-neutral-500 mb-4" />
                  <h3 className="text-lg font-display font-bold uppercase tracking-wide text-white mb-2">No Requests Yet</h3>
                  <p className="text-neutral-500 mb-4 font-sans">Need a late plate or substitution? Start here.</p>
                  <Button onClick={handleOpenLatePlate} className="shadow-sm transition-all duration-200 active:scale-[0.99] bg-amber-500 hover:bg-amber-400 text-black font-display font-bold uppercase tracking-wider rounded-sm">Submit Your First Request</Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {myRequests.map((request: any) => (
                  <Card key={request.id} data-testid={`card-request-${request.id}`} className="bg-[#1A1A1A] border border-white/[0.10] rounded-sm">
                    <CardHeader className="pb-3 bg-[#161616] border-b border-white/[0.10]">
                      <div className="flex justify-between items-start gap-4">
                        <div className="flex items-center gap-3">
                          {request.type === 'late_plate' ? (
                            <Clock className="w-5 h-5 text-blue-500" />
                          ) : request.type === 'substitution' ? (
                            <RefreshCcw className="w-5 h-5 text-green-500" />
                          ) : request.type === 'menu_suggestion' ? (
                            <Lightbulb className="w-5 h-5 text-amber-500" />
                          ) : (
                            <AlertCircle className="w-5 h-5 text-purple-500" />
                          )}
                          <div>
                            <CardTitle className="text-base capitalize font-display font-bold uppercase tracking-wide text-white">
                              {request.type.replace('_', ' ')}
                            </CardTitle>
                            <p className="text-xs text-neutral-500 font-sans">
                              {format(new Date(request.date), "MMM d, yyyy 'at' h:mm a")}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {getRequestStatusBadge(request.status)}
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="text-neutral-500 transition-colors hover:bg-white/[0.06] hover:text-white rounded-sm"
                                data-testid={`button-delete-request-${request.id}`}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent className="bg-[#1A1A1A] border border-white/[0.1] rounded-sm">
                              <AlertDialogHeader>
                                <AlertDialogTitle className="font-display font-bold uppercase tracking-wide text-white">Delete Request</AlertDialogTitle>
                                <AlertDialogDescription className="text-neutral-400">
                                  Are you sure you want to delete this {request.type.replace('_', ' ')} request? This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel data-testid="button-cancel-delete" className="border-white/[0.14] text-neutral-400 hover:text-white hover:border-white/[0.2] rounded-sm">Cancel</AlertDialogCancel>
                                <AlertDialogAction 
                                  onClick={() => deleteRequest(request.id)}
                                  disabled={isDeleting}
                                  data-testid="button-confirm-delete"
                                >
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm font-medium text-white mb-2 font-sans">{getRequestSummary(request)}</p>
                      <p className="text-sm text-neutral-500 font-sans">{request.details || "No extra details provided."}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Feedback View */}
        {currentView === 'feedback' && (
          <div className="space-y-4 md:space-y-6">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
              <div>
                <h2 className="text-xl md:text-2xl font-display font-bold uppercase tracking-wide text-white">My Feedback</h2>
                <p className="text-sm text-neutral-500 font-sans">See past ratings or return to the weekly menu to leave feedback.</p>
              </div>
            </div>
            
            {isLoadingFeedback ? (
              <div className="h-48 flex flex-col items-center justify-center gap-3 text-neutral-500">
                <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
                <p className="text-sm font-sans">Loading your feedback history...</p>
              </div>
            ) : myFeedback.length === 0 ? (
              <Card className="bg-[#1A1A1A] border border-white/[0.10] rounded-sm">
                <CardContent className="p-12 text-center">
                  <Star className="w-12 h-12 mx-auto text-neutral-500 mb-4" />
                  <h3 className="text-lg font-display font-bold uppercase tracking-wide text-white mb-2">No Feedback Yet</h3>
                  <p className="text-neutral-500 mb-4 font-sans">After you try a meal, you can rate it in a few seconds from the weekly menu.</p>
                  <Button onClick={() => setLocation("/")} className="shadow-sm transition-all duration-200 active:scale-[0.99] bg-amber-500 hover:bg-amber-400 text-black font-display font-bold uppercase tracking-wider rounded-sm">Go to Weekly Menu</Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {myFeedback.map((fb: any) => (
                  <Card key={fb.id} data-testid={`card-feedback-${fb.id}`} className="bg-[#1A1A1A] border border-white/[0.10] rounded-sm">
                    <CardHeader className="pb-3 bg-[#161616] border-b border-white/[0.10]">
                      <div className="flex justify-between items-start">
                        <div>
                          <CardTitle className="text-base font-display font-bold uppercase tracking-wide text-white">{fb.mealDay} {fb.mealType}</CardTitle>
                          <p className="text-xs text-neutral-500 font-sans">
                            {fb.createdAt ? format(new Date(fb.createdAt), "MMM d, yyyy") : "Recently"}
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <Star 
                              key={star}
                              className={`w-4 h-4 ${fb.rating >= star ? "fill-yellow-400 text-yellow-400" : "text-neutral-500/30"}`}
                            />
                          ))}
                        </div>
                      </div>
                    </CardHeader>
                    {fb.comment && (
                      <CardContent>
                        <p className="text-xs uppercase tracking-wide text-neutral-500 mb-2 font-display">Your comment</p>
                        <p className="text-sm text-neutral-500 font-sans">{fb.comment}</p>
                      </CardContent>
                    )}
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Request Dialog */}
        <Dialog open={requestModalOpen} onOpenChange={setRequestModalOpen}>
          <DialogContent className="sm:max-w-md bg-[#1A1A1A] border border-white/[0.1] rounded-sm">
            <DialogHeader>
              <DialogTitle className="font-display font-bold uppercase tracking-wide text-white text-xl">
                {requestType === "late_plate"
                  ? "Request Late Plate"
                  : requestType === "substitution"
                  ? "Request Substitution"
                  : "Menu Suggestion"}
              </DialogTitle>
              <DialogDescription className="text-neutral-400">
                {requestType === "late_plate" 
                  ? "Choose a meal for your late plate. Cutoff is 12:45 PM for lunch and 5:45 PM for dinner."
                  : requestType === "substitution"
                  ? "Share any allergy or dietary details. This goes directly to the chef."
                  : "Share a dish or meal idea for a future menu. This goes directly to the chef."
                }
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {requestType === "late_plate" && (
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase tracking-wider text-neutral-500 font-display">Select Meal</Label>
                  {availableMealOptions.length === 0 ? (
                    <div className="p-4 bg-[#1A1A1A] rounded-sm text-center border border-white/[0.10]">
                      <AlertCircle className="w-8 h-8 mx-auto text-neutral-500 mb-2" />
                      <p className="text-sm text-neutral-500 font-sans">
                        No meals available for late plate requests at this time.
                        Cutoff times have passed for all remaining meals this week.
                      </p>
                    </div>
                  ) : (
                    <div className="grid gap-2">
                      {availableMealOptions.map((option) => {
                        const value = `${format(option.date, "yyyy-MM-dd")}|${option.mealType}`;
                        const isSelected = selectedMealDay && selectedMealType
                          ? value === `${selectedMealDay}|${selectedMealType}`
                          : false;

                        return (
                          <button
                            key={value}
                            type="button"
                            onClick={() => {
                              setSelectedMealDay(format(option.date, "yyyy-MM-dd"));
                              setSelectedMealType(option.mealType);
                            }}
                            className={`rounded-sm border px-4 py-3 text-left transition-all duration-200 active:scale-[0.99] ${
                              isSelected
                                ? "border-amber-500 bg-amber-500/10 text-white ring-2 ring-amber-500/20"
                                : "border-white/[0.14] bg-[#1E1E1E] hover:border-amber-500/30 hover:bg-white/[0.06] text-neutral-300"
                            }`}
                            data-testid={`select-item-${format(option.date, "yyyy-MM-dd")}-${option.mealType}`}
                          >
                            <div className="font-medium text-white">{option.label}</div>
                            <div className="mt-1 text-xs text-neutral-500 font-sans">
                              Submit before {getCutoffTimeDisplay(option.mealType)}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                  {selectedMealType && (
                    <p className="text-xs text-neutral-500 font-sans">
                      Request must be submitted before {getCutoffTimeDisplay(selectedMealType)}
                    </p>
                  )}
                  {!selectedMealType && availableMealOptions.length > 0 ? (
                    <p className="text-xs text-neutral-500 font-sans">
                      Tap a meal to continue. The next available option is shown first.
                    </p>
                  ) : null}
                </div>
              )}
              {requestType !== "late_plate" ? (
                <div className="rounded-sm border border-white/[0.10] bg-white/[0.03] p-3 text-sm text-neutral-500 font-sans">
                  {requestType === "substitution"
                    ? "Be specific so the chef can act quickly. Include allergies, dietary restrictions, or the replacement you need."
                    : "Keep it short and specific. Dish ideas and favorite meals work best."}
                </div>
              ) : null}
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-neutral-500 font-display">
                  {requestType === "late_plate"
                    ? "Pickup Details (Optional)"
                    : requestType === "substitution"
                    ? "Substitution Details"
                    : "Your Suggestion"}
                </Label>
                <Textarea 
                  placeholder={
                    requestType === "late_plate" 
                      ? "I will pick up at 7 PM..." 
                      : requestType === "substitution"
                      ? "I have a gluten allergy, can I get..." 
                      : "I'd love to see chicken alfredo on the menu..."
                  }
                  value={requestDetails}
                  onChange={(e) => setRequestDetails(e.target.value)}
                  className="min-h-[100px] bg-[#1A1A1A] border-white/[0.14] text-white rounded-sm placeholder:text-neutral-500 resize-none"
                  data-testid="input-request-details"
                />
                <p className="text-xs text-neutral-500 font-sans">
                  {requestType === "late_plate"
                    ? "Optional details help the kitchen plan pickup."
                    : "Your request goes straight to the kitchen team."}
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setRequestModalOpen(false)} className="w-full sm:w-auto transition-all duration-200 active:scale-[0.99] border-white/[0.14] text-neutral-400 hover:text-white hover:border-white/[0.2] rounded-sm font-display font-bold uppercase tracking-wider">Cancel</Button>
              <Button 
                onClick={handleRequestSubmit} 
                disabled={isRequesting || !canSubmitRequest}
                className="w-full sm:w-auto sm:min-w-[170px] shadow-sm transition-all duration-200 active:scale-[0.99] bg-amber-500 hover:bg-amber-400 text-black font-display font-bold uppercase tracking-wider rounded-sm"
                data-testid="button-submit-request"
              >
                {isRequesting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Submitting...
                  </>
                )
                  : requestType === "late_plate"
                  ? "Send Late Plate Request"
                  : requestType === "substitution"
                  ? "Send to Chef"
                  : "Submit Suggestion"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Feedback Dialog */}
        <Dialog open={feedbackModalOpen} onOpenChange={setFeedbackModalOpen}>
          <DialogContent className="sm:max-w-md bg-[#1A1A1A] border border-white/[0.1] rounded-sm">
            <DialogHeader>
              <DialogTitle className="font-display font-bold uppercase tracking-wide text-white text-xl">Rate a Meal</DialogTitle>
              <DialogDescription className="text-neutral-400">
                Choose the meal you'd like to rate. Only admins can see who submitted feedback.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-6 py-4">
              {selectedFeedbackMenu ? (
                <div className="rounded-sm border border-white/[0.10] bg-white/[0.03] p-3 text-sm text-neutral-500 font-sans">
                  Rating menu for the week of {format(new Date(selectedFeedbackMenu.weekOf), "MMMM d, yyyy")}.
                </div>
              ) : null}
              {(feedbackMealDay || feedbackMealType) ? (
                <div className="rounded-sm border border-amber-500/20 bg-amber-500/10 p-3 text-sm">
                  <span className="font-medium text-white">Selected meal:</span>{" "}
                  <span className="text-neutral-400">
                    {[feedbackMealDay, feedbackMealType].filter(Boolean).join(" ")}
                  </span>
                </div>
              ) : null}
              {/* Meal Selection */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase tracking-wider text-neutral-500 font-display">Day</Label>
                  <Select value={feedbackMealDay} onValueChange={setFeedbackMealDay}>
                    <SelectTrigger data-testid="select-feedback-day" className="bg-[#1A1A1A] border-white/[0.14] text-white rounded-sm h-10">
                      <SelectValue placeholder="Select day" />
                    </SelectTrigger>
                    <SelectContent className="bg-[#1E1E1E] border-white/[0.1] rounded-sm">
                      {DAYS.map((day) => (
                        <SelectItem key={day} value={day} className="hover:bg-white/[0.06] focus:bg-white/[0.06] text-neutral-300 rounded-sm">{day}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase tracking-wider text-neutral-500 font-display">Meal</Label>
                  <Select
                    value={feedbackMealType}
                    onValueChange={(value: "Lunch" | "Dinner") => setFeedbackMealType(value)}
                  >
                    <SelectTrigger data-testid="select-feedback-meal" className="bg-[#1A1A1A] border-white/[0.14] text-white rounded-sm h-10">
                      <SelectValue placeholder="Select meal" />
                    </SelectTrigger>
                    <SelectContent className="bg-[#1E1E1E] border-white/[0.1] rounded-sm">
                      {MEAL_TYPES.map((meal) => (
                        <SelectItem key={meal} value={meal} className="hover:bg-white/[0.06] focus:bg-white/[0.06] text-neutral-300 rounded-sm">{meal}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Star Rating */}
              <div className="space-y-2">
                <Label className="text-center block text-xs font-bold uppercase tracking-wider text-neutral-500 font-display">Your Rating</Label>
                <div className="flex justify-center gap-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button 
                      key={star}
                      type="button"
                      onClick={() => setRating(star)}
                      className="rounded-full p-1 focus:outline-none transition-transform duration-150 hover:scale-110 active:scale-95"
                      data-testid={`button-rating-${star}`}
                    >
                      <Star 
                        className={`w-8 h-8 ${rating >= star ? "fill-yellow-400 text-yellow-400" : "text-neutral-500/30"}`} 
                      />
                    </button>
                  ))}
                </div>
                <p className="text-center text-xs text-neutral-500 font-sans">
                  Quick ratings help improve future meals.
                </p>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-neutral-500 font-display">Comments (Optional)</Label>
                <Textarea
                  placeholder="The chicken was great, but the rice was a bit dry..."
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  className="bg-[#1A1A1A] border-white/[0.14] text-white rounded-sm placeholder:text-neutral-500 resize-none"
                  data-testid="textarea-feedback-comment"
                />
                <p className="text-xs text-neutral-500 font-sans">
                  Keep comments short. Focus on what worked or what should change.
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setFeedbackModalOpen(false)} className="w-full sm:w-auto transition-all duration-200 active:scale-[0.99] border-white/[0.14] text-neutral-400 hover:text-white hover:border-white/[0.2] rounded-sm font-display font-bold uppercase tracking-wider">Cancel</Button>
              <Button 
                onClick={handleFeedbackSubmit} 
                disabled={isFeedbacking || !feedbackMealDay || !feedbackMealType}
                className="w-full sm:w-auto sm:min-w-[150px] shadow-sm transition-all duration-200 active:scale-[0.99] bg-amber-500 hover:bg-amber-400 text-black font-display font-bold uppercase tracking-wider rounded-sm"
                data-testid="button-submit-feedback"
              >
                {isFeedbacking ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Submitting...
                  </>
                ) : "Submit Feedback"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}
