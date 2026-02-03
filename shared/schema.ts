import { pgTable, text, serial, integer, boolean, date, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

// Enums
export const ROLES = ["user", "chef", "admin", "house_director"] as const;
export const FRATERNITIES = ["Delta Tau Delta", "Sigma Chi"] as const;
export const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"] as const;
export const MEAL_TYPES = ["Lunch", "Dinner"] as const;
export const MENU_STATUS = ["draft", "pending", "approved", "needs_revision"] as const;
export const REQUEST_TYPES = ["late_plate", "substitution", "menu_suggestion", "future_request"] as const;
export const CRITIQUE_STATUS = ["pending", "acknowledged"] as const;

// Tables
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  role: text("role", { enum: ROLES }).notNull().default("user"),
  name: text("name").notNull(),
  fraternity: text("fraternity", { enum: FRATERNITIES }), // Nullable for admins
  phoneNumber: text("phone_number"), // For SMS notifications (chefs)
});

export const menus = pgTable("menus", {
  id: serial("id").primaryKey(),
  fraternity: text("fraternity", { enum: FRATERNITIES }).notNull(),
  weekOf: date("week_of").notNull(), // Start date of the week
  status: text("status", { enum: MENU_STATUS }).notNull().default("draft"),
  chefId: integer("chef_id").references(() => users.id),
  adminNotes: text("admin_notes"), // Notes/suggestions from admin when requesting revisions
});

export const menuItems = pgTable("menu_items", {
  id: serial("id").primaryKey(),
  menuId: integer("menu_id").notNull().references(() => menus.id),
  day: text("day", { enum: DAYS }).notNull(),
  meal: text("meal", { enum: MEAL_TYPES }).notNull(),
  description: text("description").notNull(),
  side1: text("side1"),
  side2: text("side2"),
  side3: text("side3"),
  calories: integer("calories"),
  carbs: integer("carbs"),
  fats: integer("fats"),
  protein: integer("protein"),
  sugar: integer("sugar"),
});

export const feedback = pgTable("feedback", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  menuId: integer("menu_id").notNull().references(() => menus.id),
  mealDay: text("meal_day", { enum: DAYS }).notNull(), // Day of the meal being rated (required)
  mealType: text("meal_type", { enum: MEAL_TYPES }).notNull(), // Lunch or Dinner (required)
  rating: integer("rating").notNull(),
  comment: text("comment"),
  isAnonymous: boolean("is_anonymous").default(false),
  isRead: boolean("is_read").default(false), // Chef has read this feedback
});

export const requests = pgTable("requests", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  type: text("type", { enum: REQUEST_TYPES }).notNull(),
  details: text("details").notNull(),
  status: text("status").default("pending"),
  date: date("date").defaultNow(),
  mealDay: date("meal_day"), // The specific date of the meal for late plate requests
  mealType: text("meal_type", { enum: MEAL_TYPES }), // Lunch or Dinner
  fraternity: text("fraternity", { enum: FRATERNITIES }), // Which fraternity the request is for
  isRead: boolean("is_read").default(false), // Chef has read this request
});

// Chef tasks/reminders assigned by admin
export const chefTasks = pgTable("chef_tasks", {
  id: serial("id").primaryKey(),
  chefId: integer("chef_id").notNull().references(() => users.id),
  title: text("title").notNull(),
  description: text("description"),
  priority: text("priority", { enum: ["low", "medium", "high"] }).default("medium"),
  isCompleted: boolean("is_completed").default(false),
  createdAt: date("created_at").defaultNow(),
  dueDate: date("due_date"),
});

// Menu critiques and suggested edits from House Directors
export const menuCritiques = pgTable("menu_critiques", {
  id: serial("id").primaryKey(),
  menuId: integer("menu_id").notNull().references(() => menus.id),
  houseDirectorId: integer("house_director_id").notNull().references(() => users.id),
  fraternity: text("fraternity", { enum: FRATERNITIES }).notNull(),
  critiqueText: text("critique_text"), // General critique/feedback
  suggestedEdits: text("suggested_edits"), // Suggested menu changes
  status: text("status", { enum: CRITIQUE_STATUS }).notNull().default("pending"),
  acknowledgedByChef: boolean("acknowledged_by_chef").default(false),
  acknowledgedByAdmin: boolean("acknowledged_by_admin").default(false),
  acknowledgedByChefAt: date("acknowledged_by_chef_at"),
  acknowledgedByAdminAt: date("acknowledged_by_admin_at"),
  createdAt: date("created_at").defaultNow(),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  menus: many(menus),
  feedback: many(feedback),
  requests: many(requests),
  tasks: many(chefTasks),
  critiques: many(menuCritiques),
}));

export const chefTasksRelations = relations(chefTasks, ({ one }) => ({
  chef: one(users, {
    fields: [chefTasks.chefId],
    references: [users.id],
  }),
}));

export const menusRelations = relations(menus, ({ one, many }) => ({
  chef: one(users, {
    fields: [menus.chefId],
    references: [users.id],
  }),
  items: many(menuItems),
  feedback: many(feedback),
}));

export const menuItemsRelations = relations(menuItems, ({ one }) => ({
  menu: one(menus, {
    fields: [menuItems.menuId],
    references: [menus.id],
  }),
}));

export const feedbackRelations = relations(feedback, ({ one }) => ({
  user: one(users, {
    fields: [feedback.userId],
    references: [users.id],
  }),
  menu: one(menus, {
    fields: [feedback.menuId],
    references: [menus.id],
  }),
}));

export const requestsRelations = relations(requests, ({ one }) => ({
  user: one(users, {
    fields: [requests.userId],
    references: [users.id],
  }),
}));

export const menuCritiquesRelations = relations(menuCritiques, ({ one }) => ({
  menu: one(menus, {
    fields: [menuCritiques.menuId],
    references: [menus.id],
  }),
  houseDirector: one(users, {
    fields: [menuCritiques.houseDirectorId],
    references: [users.id],
  }),
}));

// Schemas & Types
export const insertUserSchema = createInsertSchema(users);
export const insertMenuSchema = createInsertSchema(menus);
export const insertMenuItemSchema = createInsertSchema(menuItems);
export const insertFeedbackSchema = createInsertSchema(feedback);
export const insertRequestSchema = createInsertSchema(requests);
export const insertChefTaskSchema = createInsertSchema(chefTasks).omit({ id: true, createdAt: true });
export const insertMenuCritiqueSchema = createInsertSchema(menuCritiques).omit({ id: true, createdAt: true });

export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Menu = typeof menus.$inferSelect;
export type MenuItem = typeof menuItems.$inferSelect;
export type Feedback = typeof feedback.$inferSelect;
export type Request = typeof requests.$inferSelect;
export type ChefTask = typeof chefTasks.$inferSelect;
export type MenuCritique = typeof menuCritiques.$inferSelect;

export type InsertMenu = z.infer<typeof insertMenuSchema>;
export type InsertMenuItem = z.infer<typeof insertMenuItemSchema>;
export type InsertFeedback = z.infer<typeof insertFeedbackSchema>;
export type InsertRequest = z.infer<typeof insertRequestSchema>;
export type InsertChefTask = z.infer<typeof insertChefTaskSchema>;
export type InsertMenuCritique = z.infer<typeof insertMenuCritiqueSchema>;
