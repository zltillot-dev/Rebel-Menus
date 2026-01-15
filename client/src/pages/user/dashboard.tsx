import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useMenus } from "@/hooks/use-menus";
import { useCreateRequest, useCreateFeedback, useRequests, useFeedback, useDeleteRequest } from "@/hooks/use-requests";
import { Sidebar } from "@/components/Sidebar";
import { MenuCard } from "@/components/MenuCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Clock, RefreshCcw, Star, Calendar, MessageSquare, FileText, AlertCircle, Trash2, Lightbulb } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { DAYS, MEAL_TYPES } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { format, startOfWeek, addDays, isAfter, isBefore, setHours, setMinutes, getDay, isToday, isSameDay } from "date-fns";

export default function UserDashboard() {
  const [location] = useLocation();
  const { user } = useAuth();
  const { data: menus, isLoading } = useMenus({ status: 'approved', fraternity: user?.fraternity || undefined });
  const { data: userRequests, isLoading: isLoadingRequests } = useRequests();
  const { data: userFeedback, isLoading: isLoadingFeedback } = useFeedback();
  const { mutate: createRequest, isPending: isRequesting } = useCreateRequest();
  const { mutate: createFeedback, isPending: isFeedbacking } = useCreateFeedback();
  const { mutate: deleteRequest, isPending: isDeleting } = useDeleteRequest();
  
  const [requestModalOpen, setRequestModalOpen] = useState(false);
  const [requestType, setRequestType] = useState<"late_plate" | "substitution" | "menu_suggestion" | "future_request">("late_plate");
  const [requestDetails, setRequestDetails] = useState("");
  const [selectedMealDay, setSelectedMealDay] = useState<string>("");
  const [selectedMealType, setSelectedMealType] = useState<"Lunch" | "Dinner" | "">("");
  const { toast } = useToast();
  
  const [feedbackModalOpen, setFeedbackModalOpen] = useState(false);
  const [selectedMenuId, setSelectedMenuId] = useState<number | null>(null);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");

  // Filter requests to only show user's own
  const myRequests = userRequests?.filter((r: any) => r.userId === user?.id) || [];
  
  // Filter feedback to only show user's own
  const myFeedback = userFeedback?.filter((f: any) => f.userId === user?.id) || [];

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

  // Get current menu (most recent approved menu for this week)
  // Simplified logic: just grab the first one returned
  const currentMenu = menus?.[0];
  
  // Determine current view based on location
  const currentView = location === '/requests' ? 'requests' : location === '/feedback' ? 'feedback' : 'menu';

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
        details: requestDetails,
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
        details: requestDetails,
        status: "pending",
        date: new Date().toISOString(),
        fraternity: user.fraternity || undefined,
      }, {
        onSuccess: () => {
          setRequestModalOpen(false);
          setRequestDetails("");
          const typeLabel = requestType === 'substitution' ? 'Substitution' : 'Menu Suggestion';
          toast({
            title: `${typeLabel} Submitted`,
            description: `Your ${typeLabel.toLowerCase()} has been sent to the chef.`
          });
        }
      });
    }
  };

  const handleFeedbackSubmit = () => {
    if (!user || !selectedMenuId) return;
    createFeedback({
      userId: user.id,
      menuId: selectedMenuId,
      rating,
      comment,
      isAnonymous: false,
    }, {
      onSuccess: () => {
        setFeedbackModalOpen(false);
        setComment("");
        setRating(5);
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

  const currentWeekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const weekRange = `${format(currentWeekStart, "MMM d")} - ${format(addDays(currentWeekStart, 4), "MMM d, yyyy")}`;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Sidebar />
      
      <main className="ml-64 p-8 max-w-7xl mx-auto">
        {/* Header - only show for menu view */}
        {currentView === 'menu' && (
          <header className="mb-8 flex justify-between items-end">
            <div>
              <h2 className="text-3xl font-display font-bold text-foreground">Weekly Menu</h2>
              <p className="text-muted-foreground mt-2 flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Week of {currentMenu ? format(new Date(currentMenu.weekOf), "MMMM d, yyyy") : weekRange}
              </p>
            </div>
            
            <div className="flex gap-3">
              <Button 
                onClick={() => openRequestModal("late_plate")}
                className="bg-white text-foreground border border-border hover:bg-muted shadow-sm"
                data-testid="button-late-plate"
              >
                <Clock className="w-4 h-4 mr-2 text-primary" />
                Late Plate
              </Button>
              <Button 
                onClick={() => openRequestModal("substitution")}
                className="bg-white text-foreground border border-border hover:bg-muted shadow-sm"
                data-testid="button-substitution"
              >
                <RefreshCcw className="w-4 h-4 mr-2 text-primary" />
                Substitution
              </Button>
              <Button 
                onClick={() => openRequestModal("menu_suggestion")}
                className="bg-white text-foreground border border-border hover:bg-muted shadow-sm"
                data-testid="button-menu-suggestion"
              >
                <Lightbulb className="w-4 h-4 mr-2 text-primary" />
                Menu Suggestion
              </Button>
            </div>
          </header>
        )}

        {/* Menu View */}
        {currentView === 'menu' && (
          <>
            {isLoading ? (
              <div className="h-96 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
              </div>
            ) : !currentMenu ? (
              <div className="bg-muted/30 rounded-2xl p-12 text-center border border-border border-dashed">
                <h3 className="text-xl font-medium mb-2">No Menu Published Yet</h3>
                <p className="text-muted-foreground">Check back later for this week's meals.</p>
              </div>
            ) : (
              <Tabs defaultValue="Monday" className="w-full">
                <TabsList className="grid grid-cols-5 w-full mb-8 h-12 bg-muted/50 p-1">
                  {DAYS.map((day) => (
                    <TabsTrigger 
                      key={day} 
                      value={day}
                      className="rounded-md data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-primary font-medium"
                    >
                      {day}
                    </TabsTrigger>
                  ))}
                </TabsList>

                {DAYS.map((day) => {
                  const dayItems = currentMenu.items.filter(item => item.day === day);
                  return (
                    <TabsContent key={day} value={day} className="mt-0">
                      <div className="grid md:grid-cols-1 gap-6">
                        <MenuCard 
                          day={day} 
                          items={dayItems} 
                          menuId={currentMenu.id}
                          onFeedbackClick={(id) => {
                            setSelectedMenuId(id);
                            setFeedbackModalOpen(true);
                          }}
                        />
                      </div>
                    </TabsContent>
                  );
                })}
              </Tabs>
            )}
          </>
        )}

        {/* Requests View */}
        {currentView === 'requests' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-bold">My Requests</h2>
                <p className="text-muted-foreground">View and manage your late plate and substitution requests</p>
              </div>
              <Button onClick={() => setRequestModalOpen(true)} data-testid="button-new-request">
                <MessageSquare className="w-4 h-4 mr-2" /> New Request
              </Button>
            </div>
            
            {isLoadingRequests ? (
              <div className="h-48 flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
              </div>
            ) : myRequests.length === 0 ? (
              <Card>
                <CardContent className="p-12 text-center">
                  <FileText className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
                  <h3 className="text-lg font-medium mb-2">No Requests Yet</h3>
                  <p className="text-muted-foreground mb-4">You haven't submitted any requests yet.</p>
                  <Button onClick={() => setRequestModalOpen(true)}>Submit Your First Request</Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {myRequests.map((request: any) => (
                  <Card key={request.id} data-testid={`card-request-${request.id}`}>
                    <CardHeader className="pb-3">
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
                            <CardTitle className="text-base capitalize">
                              {request.type.replace('_', ' ')}
                            </CardTitle>
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(request.date), "MMM d, yyyy 'at' h:mm a")}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={
                            request.status === 'approved' ? 'default' :
                            request.status === 'denied' ? 'destructive' : 'secondary'
                          }>
                            {request.status}
                          </Badge>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="text-muted-foreground"
                                data-testid={`button-delete-request-${request.id}`}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete Request</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to delete this {request.type.replace('_', ' ')} request? This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
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
                      <p className="text-sm text-muted-foreground">{request.details}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Feedback View */}
        {currentView === 'feedback' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-bold">My Feedback</h2>
                <p className="text-muted-foreground">View your submitted meal ratings and comments</p>
              </div>
            </div>
            
            {isLoadingFeedback ? (
              <div className="h-48 flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
              </div>
            ) : myFeedback.length === 0 ? (
              <Card>
                <CardContent className="p-12 text-center">
                  <Star className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
                  <h3 className="text-lg font-medium mb-2">No Feedback Yet</h3>
                  <p className="text-muted-foreground">You haven't submitted any feedback yet. Rate a meal from the weekly menu!</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {myFeedback.map((fb: any) => (
                  <Card key={fb.id} data-testid={`card-feedback-${fb.id}`}>
                    <CardHeader className="pb-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <CardTitle className="text-base">Menu #{fb.menuId}</CardTitle>
                          <p className="text-xs text-muted-foreground">
                            {fb.createdAt ? format(new Date(fb.createdAt), "MMM d, yyyy") : "Recently"}
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <Star 
                              key={star}
                              className={`w-4 h-4 ${fb.rating >= star ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`}
                            />
                          ))}
                        </div>
                      </div>
                    </CardHeader>
                    {fb.comment && (
                      <CardContent>
                        <p className="text-sm text-muted-foreground">{fb.comment}</p>
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
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>
                {requestType === "late_plate" 
                  ? "Request Late Plate" 
                  : requestType === "substitution" 
                  ? "Request Substitution"
                  : "Menu Suggestion"}
              </DialogTitle>
              <DialogDescription>
                {requestType === "late_plate" 
                  ? "Select the meal you need a late plate for. Cutoff is 12:45 PM for lunch and 5:45 PM for dinner."
                  : requestType === "substitution"
                  ? "Provide details for your substitution request (e.g., allergies, dietary restrictions). This will be sent to the chef."
                  : "Suggest a dish or meal idea for future menus. Your suggestion will be sent to the chef."
                }
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {requestType === "late_plate" && (
                <div className="space-y-2">
                  <Label>Select Meal</Label>
                  {availableMealOptions.length === 0 ? (
                    <div className="p-4 bg-muted rounded-lg text-center">
                      <AlertCircle className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                      <p className="text-sm text-muted-foreground">
                        No meals available for late plate requests at this time.
                        Cutoff times have passed for all remaining meals this week.
                      </p>
                    </div>
                  ) : (
                    <Select
                      value={selectedMealDay && selectedMealType ? `${selectedMealDay}|${selectedMealType}` : ""}
                      onValueChange={(value) => {
                        const [day, type] = value.split("|");
                        setSelectedMealDay(day);
                        setSelectedMealType(type as "Lunch" | "Dinner");
                      }}
                    >
                      <SelectTrigger data-testid="select-meal-trigger">
                        <SelectValue placeholder="Choose a meal..." />
                      </SelectTrigger>
                      <SelectContent>
                        {availableMealOptions.map((option) => (
                          <SelectItem 
                            key={`${format(option.date, "yyyy-MM-dd")}|${option.mealType}`}
                            value={`${format(option.date, "yyyy-MM-dd")}|${option.mealType}`}
                            data-testid={`select-item-${format(option.date, "yyyy-MM-dd")}-${option.mealType}`}
                          >
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  {selectedMealType && (
                    <p className="text-xs text-muted-foreground">
                      Request must be submitted before {getCutoffTimeDisplay(selectedMealType)}
                    </p>
                  )}
                </div>
              )}
              <div className="space-y-2">
                <Label>
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
                  className="min-h-[100px]"
                  data-testid="input-request-details"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setRequestModalOpen(false)}>Cancel</Button>
              <Button 
                onClick={handleRequestSubmit} 
                disabled={isRequesting || (requestType === "late_plate" ? (!selectedMealDay || !selectedMealType) : !requestDetails)}
                data-testid="button-submit-request"
              >
                {isRequesting ? "Submitting..." : "Submit Request"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Feedback Dialog */}
        <Dialog open={feedbackModalOpen} onOpenChange={setFeedbackModalOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Rate this Meal</DialogTitle>
              <DialogDescription>
                Let the chefs know what you thought about today's menu.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-6 py-4">
              <div className="flex justify-center gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button 
                    key={star}
                    onClick={() => setRating(star)}
                    className="focus:outline-none transition-transform hover:scale-110"
                  >
                    <Star 
                      className={`w-8 h-8 ${rating >= star ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`} 
                    />
                  </button>
                ))}
              </div>
              <div className="space-y-2">
                <Label>Comments (Optional)</Label>
                <Textarea 
                  placeholder="The chicken was great, but the rice was a bit dry..."
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setFeedbackModalOpen(false)}>Cancel</Button>
              <Button onClick={handleFeedbackSubmit} disabled={isFeedbacking}>
                {isFeedbacking ? "Submitting..." : "Submit Feedback"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}
