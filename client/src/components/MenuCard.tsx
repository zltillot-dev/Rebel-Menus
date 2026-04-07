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
        <h4 className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground">{title}</h4>
        {onFeedbackClick && meals.length > 0 ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => onFeedbackClick(menuId, day, title)}
            className="h-7 rounded-full px-3 text-xs border-amber-300/50 text-amber-700 hover:bg-amber-50 hover:border-amber-400 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md active:scale-[0.98]"
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
            <div key={item.id} className="group rounded-lg p-2 -mx-2 transition-colors duration-200 hover:bg-neutral-50">
              <div className="flex justify-between items-start mb-1">
                <p className="font-semibold text-foreground text-base leading-tight">{item.description}</p>
                {item.calories && item.calories > 0 ? (
                  <div className="flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-200/60 px-2 py-0.5 rounded-full shrink-0 ml-3">
                    <Flame className="w-3 h-3" />
                    {item.calories} kcal
                  </div>
                ) : null}
              </div>

              {((item as any).side1 || (item as any).side2 || (item as any).side3) && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {(item as any).side1 && (
                    <span className="text-xs text-muted-foreground bg-neutral-100 border border-border px-2 py-0.5 rounded-md">{(item as any).side1}</span>
                  )}
                  {(item as any).side2 && (
                    <span className="text-xs text-muted-foreground bg-neutral-100 border border-border px-2 py-0.5 rounded-md">{(item as any).side2}</span>
                  )}
                  {(item as any).side3 && (
                    <span className="text-xs text-muted-foreground bg-neutral-100 border border-border px-2 py-0.5 rounded-md">{(item as any).side3}</span>
                  )}
                </div>
              )}

              {hasMacros(item) ? (
                <div className="flex flex-wrap gap-3 mt-2 opacity-70 group-hover:opacity-100 transition-opacity">
                  {item.calories && item.calories > 0 ? (
                    <MacroBadge icon={Flame} value={item.calories} label="Calories" color="text-amber-500" />
                  ) : null}
                  <MacroBadge icon={Wheat} value={item.carbs} label="Carbs" color="text-blue-500" />
                  <MacroBadge icon={Zap} value={item.protein} label="Protein" color="text-red-500" />
                  <MacroBadge icon={Droplets} value={item.fats} label="Fats" color="text-yellow-600" />
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
      <Card className={`h-full border-border shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${isToday ? "border-amber-400/50 ring-1 ring-amber-400/20 bg-amber-50/20" : "bg-white"}`}>
        <CardHeader className="bg-neutral-50 border-b border-border pb-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <CardTitle className="text-lg font-display font-black">{day}</CardTitle>
              {isToday ? <Badge className="bg-amber-500 text-black font-semibold border-none text-[10px] px-2">Today</Badge> : null}
            </div>
            <Badge variant="outline" className="text-[11px] font-medium">{items.length} meal{items.length === 1 ? "" : "s"}</Badge>
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
