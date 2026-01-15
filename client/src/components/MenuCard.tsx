import { MenuItem, Menu } from "@shared/routes";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Flame, Wheat, Droplets, Candy, Zap } from "lucide-react";
import { motion } from "framer-motion";
import { format } from "date-fns";

interface MenuCardProps {
  day: string;
  items: MenuItem[];
  onFeedbackClick?: (menuId: number) => void;
  menuId: number;
}

export function MenuCard({ day, items, onFeedbackClick, menuId }: MenuCardProps) {
  const lunch = items.filter(i => i.meal === "Lunch");
  const dinner = items.filter(i => i.meal === "Dinner");

  const MacroBadge = ({ icon: Icon, value, label, color }: any) => (
    <div className="flex items-center gap-1 text-xs text-muted-foreground" title={label}>
      <Icon className={`w-3 h-3 ${color}`} />
      <span>{value}g</span>
    </div>
  );

  const MealSection = ({ title, meals }: { title: string, meals: MenuItem[] }) => (
    <div className="mb-6 last:mb-0">
      <h4 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-3">{title}</h4>
      {meals.length === 0 ? (
        <p className="text-sm text-muted-foreground italic">No meal scheduled</p>
      ) : (
        <div className="space-y-4">
          {meals.map((item) => (
            <div key={item.id} className="group">
              <div className="flex justify-between items-start mb-1">
                <p className="font-medium text-foreground text-lg leading-tight">{item.description}</p>
                <div className="flex items-center gap-1 text-xs font-medium text-amber-600 bg-amber-50 px-2 py-1 rounded-full">
                  <Flame className="w-3 h-3" />
                  {item.calories} kcal
                </div>
              </div>
              
              <div className="flex gap-3 mt-2 opacity-60 group-hover:opacity-100 transition-opacity">
                <MacroBadge icon={Wheat} value={item.carbs} label="Carbs" color="text-blue-500" />
                <MacroBadge icon={Zap} value={item.protein} label="Protein" color="text-red-500" />
                <MacroBadge icon={Droplets} value={item.fats} label="Fats" color="text-yellow-500" />
                <MacroBadge icon={Candy} value={item.sugar} label="Sugar" color="text-pink-500" />
              </div>
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
      <Card className="h-full border-border shadow-sm hover:shadow-md transition-all duration-300">
        <CardHeader className="bg-muted/30 border-b border-border pb-4">
          <div className="flex justify-between items-center">
            <CardTitle className="text-xl font-display">{day}</CardTitle>
            {onFeedbackClick && (
              <button 
                onClick={() => onFeedbackClick(menuId)}
                className="text-xs font-medium text-primary hover:underline"
              >
                Rate Meal
              </button>
            )}
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
