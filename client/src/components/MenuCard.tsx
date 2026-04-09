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
        <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-500">{title}</h4>
        {onFeedbackClick && meals.length > 0 ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => onFeedbackClick(menuId, day, title)}
            className="h-7 rounded-sm px-3 text-xs border-amber-500/30 text-amber-500 hover:bg-amber-500/10 hover:border-amber-500/50 uppercase tracking-wide font-bold transition-all"
          >
            <Star className="mr-1 h-3 w-3" />
            Rate {title.toLowerCase()}
          </Button>
        ) : null}
      </div>
      {meals.length === 0 ? (
        <p className="text-sm text-neutral-500 italic">No meal scheduled</p>
      ) : (
        <div className="space-y-4">
          {meals.map((item) => (
            <div key={item.id} className="group rounded-sm p-2 -mx-2 transition-colors duration-150 hover:bg-white/[0.03]">
              <div className="flex justify-between items-start mb-1">
                <p className="font-semibold text-white/90 text-base leading-tight">{item.description}</p>
                {item.calories && item.calories > 0 ? (
                  <div className="flex items-center gap-1 text-[11px] font-bold text-amber-500 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-sm shrink-0 ml-3">
                    <Flame className="w-3 h-3" />
                    {item.calories} kcal
                  </div>
                ) : null}
              </div>

              {((item as any).side1 || (item as any).side2 || (item as any).side3) && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {(item as any).side1 && (
                    <span className="text-xs text-neutral-500 bg-white/[0.04] border border-white/[0.10] px-2 py-0.5 rounded-sm">{(item as any).side1}</span>
                  )}
                  {(item as any).side2 && (
                    <span className="text-xs text-neutral-500 bg-white/[0.04] border border-white/[0.10] px-2 py-0.5 rounded-sm">{(item as any).side2}</span>
                  )}
                  {(item as any).side3 && (
                    <span className="text-xs text-neutral-500 bg-white/[0.04] border border-white/[0.10] px-2 py-0.5 rounded-sm">{(item as any).side3}</span>
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
                <p className="text-xs text-neutral-600 mt-2 italic">Nutritional info not yet estimated</p>
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
      <Card className={`h-full border border-white/[0.10] rounded-sm transition-all duration-200 hover:border-amber-500/20 bg-[#1A1A1A] ${isToday ? "border-amber-500/30 bg-[#1A1A1A]" : ""}`}>
        <CardHeader className="bg-[#161616] border-b border-white/[0.10] pb-4 rounded-t-sm">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <CardTitle className="text-xl font-black tracking-wide uppercase font-display">{day}</CardTitle>
              {isToday ? <Badge className="bg-amber-500 text-black font-black border-none text-[10px] px-2.5 uppercase tracking-wider rounded-sm">Today</Badge> : null}
            </div>
            <Badge variant="outline" className="border-white/[0.1] text-neutral-500 text-[11px] font-medium rounded-sm bg-transparent">{items.length} meal{items.length === 1 ? "" : "s"}</Badge>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <MealSection title="Lunch" meals={lunch} />
          {day !== "Friday" && (
            <>
              <div className="h-px bg-white/[0.06] my-5" />
              <MealSection title="Dinner" meals={dinner} />
            </>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
