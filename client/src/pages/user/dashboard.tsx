import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useMenus } from "@/hooks/use-menus";
import { useCreateRequest, useCreateFeedback } from "@/hooks/use-requests";
import { Sidebar } from "@/components/Sidebar";
import { MenuCard } from "@/components/MenuCard";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Clock, RefreshCcw, Star, Calendar } from "lucide-react";
import { DAYS } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { format, startOfWeek, addDays } from "date-fns";

export default function UserDashboard() {
  const { user } = useAuth();
  const { data: menus, isLoading } = useMenus({ status: 'approved', fraternity: user?.fraternity || undefined });
  const { mutate: createRequest, isPending: isRequesting } = useCreateRequest();
  const { mutate: createFeedback, isPending: isFeedbacking } = useCreateFeedback();
  
  const [requestModalOpen, setRequestModalOpen] = useState(false);
  const [requestType, setRequestType] = useState<"late_plate" | "substitution" | "future_request">("late_plate");
  const [requestDetails, setRequestDetails] = useState("");
  
  const [feedbackModalOpen, setFeedbackModalOpen] = useState(false);
  const [selectedMenuId, setSelectedMenuId] = useState<number | null>(null);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");

  // Get current menu (most recent approved menu for this week)
  // Simplified logic: just grab the first one returned
  const currentMenu = menus?.[0];

  const handleRequestSubmit = () => {
    if (!user) return;
    createRequest({
      userId: user.id,
      type: requestType,
      details: requestDetails,
      status: "pending",
      date: new Date().toISOString(),
    }, {
      onSuccess: () => {
        setRequestModalOpen(false);
        setRequestDetails("");
      }
    });
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
    setRequestModalOpen(true);
  };

  const currentWeekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const weekRange = `${format(currentWeekStart, "MMM d")} - ${format(addDays(currentWeekStart, 4), "MMM d, yyyy")}`;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Sidebar />
      
      <main className="ml-64 p-8 max-w-7xl mx-auto">
        {/* Header */}
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
            >
              <Clock className="w-4 h-4 mr-2 text-primary" />
              Late Plate
            </Button>
            <Button 
              onClick={() => openRequestModal("substitution")}
              className="bg-white text-foreground border border-border hover:bg-muted shadow-sm"
            >
              <RefreshCcw className="w-4 h-4 mr-2 text-primary" />
              Substitution
            </Button>
          </div>
        </header>

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

        {/* Request Dialog */}
        <Dialog open={requestModalOpen} onOpenChange={setRequestModalOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>
                {requestType === "late_plate" ? "Request Late Plate" : "Request Substitution"}
              </DialogTitle>
              <DialogDescription>
                Please provide details for your request. All requests are sent to the chef.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Details</Label>
                <Textarea 
                  placeholder={requestType === "late_plate" ? "I will pick up at 7 PM..." : "I have a gluten allergy, can I get..."}
                  value={requestDetails}
                  onChange={(e) => setRequestDetails(e.target.value)}
                  className="min-h-[100px]"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setRequestModalOpen(false)}>Cancel</Button>
              <Button onClick={handleRequestSubmit} disabled={isRequesting || !requestDetails}>
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
