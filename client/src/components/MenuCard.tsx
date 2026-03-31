import { MenuItem } from "@shared/routes";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Flame, Wheat, Droplets, Candy, Zap, Star } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";

interface MenuCardProps {
  day: string;
  items: MenuItem[];
  onFeedbackClick?: (menuId: number, day: string, mealType: "Lunch" | "Dinner") => void;
  menuId: number;
  isToday?: boolean;
}

export function MenuCard({ day, items, onFeedbackClick, menuId, isToday = false }: MenuCardProps) {
  const lunch = items.filter(i => i.meal === "Lunch");
  const dinner = items.filter(i => i.meal === "Dinner");

  const MacroBadge = ({ icon: Icon, value, label, color }: any) => (
    <div className="flex items-center gap-1 text-xs text-muted-foreground" title={label}>
      <Icon className={`w-3 h-3 ${color}`} />
      <span>{label === "Calories" ? value : `${value}g`}</span>
    </div>
  );

  const hasMacros = (item: MenuItem) => {
    return (item.calories && item.calories > 0) || 
           (item.carbs && item.carbs > 0) || 
           ((item as any).fats && (item as any).fats > 0) || 
           (item.protein && item.protein > 0) || 
           (item.sugar && item.sugar > 0);
  };

  const MealSection = ({ title, meals }: { title: "Lunch" | "Dinner", meals: MenuItem[] }) => (
    <div className="mb-6 last:mb-0">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h4 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">{title}</h4>
        {onFeedbackClick && meals.length > 0 ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => onFeedbackClick(menuId, day, title)}
            className="h-8 rounded-full px-3 text-xs shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md active:scale-[0.98]"
          >
            <Star className="mr-1 h-3 w-3" />
            Rate {title.toLowerCase()}
          </Button>
        ) : null}
      </div>
      {meals.length === 0 ? (
        <p className="text-sm text-muted-foreground italic">No meal scheduled</p>
      ) : (
        <div className="space-y-4">
          {meals.map((item) => (
            <div key={item.id} className="group rounded-xl transition-colors duration-200 hover:bg-muted/20">
              <div className="flex justify-between items-start mb-1">
                <p className="font-medium text-foreground text-lg leading-tight">{item.description}</p>
                {item.calories && item.calories > 0 ? (
                  <div className="flex items-center gap-1 text-xs font-medium text-amber-600 bg-amber-50 dark:bg-amber-950 px-2 py-1 rounded-full shrink-0">
                    <Flame className="w-3 h-3" />
                    {item.calories} kcal
                  </div>
                ) : null}
              </div>
              
              {((item as any).side1 || (item as any).side2 || (item as any).side3) && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {(item as any).side1 && (
                    <span className="text-sm text-muted-foreground bg-muted/50 px-2 py-0.5 rounded">{(item as any).side1}</span>
                  )}
                  {(item as any).side2 && (
                    <span className="text-sm text-muted-foreground bg-muted/50 px-2 py-0.5 rounded">{(item as any).side2}</span>
                  )}
                  {(item as any).side3 && (
                    <span className="text-sm text-muted-foreground bg-muted/50 px-2 py-0.5 rounded">{(item as any).side3}</span>
                  )}
                </div>
              )}
              
              {hasMacros(item) ? (
                <div className="flex flex-wrap gap-3 mt-2 opacity-80 group-hover:opacity-100 transition-opacity">
                  {item.calories && item.calories > 0 ? (
                    <MacroBadge icon={Flame} value={item.calories} label="Calories" color="text-amber-500" />
                  ) : null}
                  <MacroBadge icon={Wheat} value={item.carbs} label="Carbs" color="text-blue-500" />
                  <MacroBadge icon={Zap} value={item.protein} label="Protein" color="text-red-500" />
                  <MacroBadge icon={Droplets} value={item.fats} label="Fats" color="text-yellow-500" />
                  <MacroBadge icon={Candy} value={item.sugar} label="Sugar" color="text-pink-500" />
                </div>
              ) : (
                <p className="text-xs text-muted-foreground mt-2 italic">Nutritional info not yet estimated</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card className={`h-full border-border shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md ${isToday ? "border-primary/40 bg-primary/5" : ""}`}>
        <CardHeader className="bg-muted/30 border-b border-border pb-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <CardTitle className="text-xl font-display">{day}</CardTitle>
              {isToday ? <Badge>Today</Badge> : null}
            </div>
            <Badge variant="outline">{items.length} meal{items.length === 1 ? "" : "s"}</Badge>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <MealSection title="Lunch" meals={lunch} />
          {day !== "Friday" && (
            <>
              <div className="h-px bg-border my-6" />
              <MealSection title="Dinner" meals={dinner} />
            </>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
