import { pgTable, text, serial, integer, boolean, date, jsonb, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

// Enums
export const ROLES = ["user", "chef", "admin", "house_director"] as const;
export const FRATERNITIES = ["Delta Tau Delta", "Sigma Chi"] as const;
export const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"] as const;
export const MEAL_TYPES = ["Lunch", "Dinner"] as const;
export const MENU_STATUS = ["draft", "pending", "approved", "needs_revision"] as const;
export const MENU_WORKFLOW_ACTIONS = ["submitted", "revision_requested", "approved_posted"] as const;
export const REQUEST_TYPES = ["late_plate", "substitution", "menu_suggestion", "future_request"] as const;
export const CRITIQUE_STATUS = ["pending", "acknowledged"] as const;
export const HEADCOUNT_MEAL_TYPES = ["Lunch", "Dinner", "Both"] as const;
export const QUANTITY_OPTIONS = ["Too Little", "Just Right", "Too Much"] as const;
export const TIMELINESS_OPTIONS = ["On Time", "Late"] as const;
export const EVENT_TYPES = ["Formal Dinner", "Philanthropy Event", "Rush Event", "Homecoming", "Parents Weekend", "Other"] as const;
export const EVENT_HEADCOUNT_OPTIONS = ["10-25", "25-50", "50-75", "75-100", "100+"] as const;
export const ADJUSTED_MEAL_TIME_OPTIONS = ["No Change", "30 min early", "1 hour early", "30 min late", "1 hour late"] as const;

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

export const menuWorkflowHistory = pgTable("menu_workflow_history", {
  id: serial("id").primaryKey(),
  menuId: integer("menu_id").notNull().references(() => menus.id),
  action: text("action", { enum: MENU_WORKFLOW_ACTIONS }).notNull(),
  actorUserId: integer("actor_user_id").notNull().references(() => users.id),
  actorRole: text("actor_role", { enum: ROLES }).notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
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

// House Director: Headcount Reporting
export const hdHeadcounts = pgTable("hd_headcounts", {
  id: serial("id").primaryKey(),
  houseDirectorId: integer("house_director_id").notNull().references(() => users.id),
  fraternity: text("fraternity", { enum: FRATERNITIES }).notNull(),
  mealDate: date("meal_date").notNull(),
  mealType: text("meal_type", { enum: HEADCOUNT_MEAL_TYPES }).notNull(),
  headcount: integer("headcount").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// House Director: Meal Reviews
export const hdMealReviews = pgTable("hd_meal_reviews", {
  id: serial("id").primaryKey(),
  houseDirectorId: integer("house_director_id").notNull().references(() => users.id),
  menuId: integer("menu_id").notNull().references(() => menus.id),
  fraternity: text("fraternity", { enum: FRATERNITIES }).notNull(),
  mealDay: text("meal_day", { enum: DAYS }).notNull(),
  mealType: text("meal_type", { enum: MEAL_TYPES }).notNull(),
  qualityRating: integer("quality_rating").notNull(), // 1-5 stars
  quantityRating: text("quantity_rating", { enum: QUANTITY_OPTIONS }).notNull(),
  timeliness: text("timeliness", { enum: TIMELINESS_OPTIONS }).notNull(),
  comment: text("comment"), // optional, max 100 chars
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// House Director: Event/Special Meal Requests
export const hdEventRequests = pgTable("hd_event_requests", {
  id: serial("id").primaryKey(),
  houseDirectorId: integer("house_director_id").notNull().references(() => users.id),
  fraternity: text("fraternity", { enum: FRATERNITIES }).notNull(),
  eventType: text("event_type", { enum: EVENT_TYPES }).notNull(),
  eventDate: date("event_date").notNull(),
  expectedHeadcount: text("expected_headcount", { enum: EVENT_HEADCOUNT_OPTIONS }).notNull(),
  adjustedMealTime: text("adjusted_meal_time", { enum: ADJUSTED_MEAL_TIME_OPTIONS }).default("No Change"),
  status: text("status").default("pending"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  menus: many(menus),
  feedback: many(feedback),
  requests: many(requests),
  tasks: many(chefTasks),
  critiques: many(menuCritiques),
  hdHeadcounts: many(hdHeadcounts),
  hdMealReviews: many(hdMealReviews),
  hdEventRequests: many(hdEventRequests),
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
  workflowHistory: many(menuWorkflowHistory),
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

export const menuWorkflowHistoryRelations = relations(menuWorkflowHistory, ({ one }) => ({
  menu: one(menus, {
    fields: [menuWorkflowHistory.menuId],
    references: [menus.id],
  }),
  actor: one(users, {
    fields: [menuWorkflowHistory.actorUserId],
    references: [users.id],
  }),
}));

export const hdHeadcountsRelations = relations(hdHeadcounts, ({ one }) => ({
  houseDirector: one(users, {
    fields: [hdHeadcounts.houseDirectorId],
    references: [users.id],
  }),
}));

export const hdMealReviewsRelations = relations(hdMealReviews, ({ one }) => ({
  houseDirector: one(users, {
    fields: [hdMealReviews.houseDirectorId],
    references: [users.id],
  }),
  menu: one(menus, {
    fields: [hdMealReviews.menuId],
    references: [menus.id],
  }),
}));

export const hdEventRequestsRelations = relations(hdEventRequests, ({ one }) => ({
  houseDirector: one(users, {
    fields: [hdEventRequests.houseDirectorId],
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
export const insertMenuWorkflowHistorySchema = createInsertSchema(menuWorkflowHistory).omit({ id: true, createdAt: true });
export const insertHdHeadcountSchema = createInsertSchema(hdHeadcounts).omit({ id: true, createdAt: true });
export const insertHdMealReviewSchema = createInsertSchema(hdMealReviews).omit({ id: true, createdAt: true });
export const insertHdEventRequestSchema = createInsertSchema(hdEventRequests).omit({ id: true, createdAt: true });

export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Menu = typeof menus.$inferSelect;
export type MenuItem = typeof menuItems.$inferSelect;
export type Feedback = typeof feedback.$inferSelect;
export type Request = typeof requests.$inferSelect;
export type ChefTask = typeof chefTasks.$inferSelect;
export type MenuCritique = typeof menuCritiques.$inferSelect;
export type MenuWorkflowHistory = typeof menuWorkflowHistory.$inferSelect;

export type InsertMenu = z.infer<typeof insertMenuSchema>;
export type InsertMenuItem = z.infer<typeof insertMenuItemSchema>;
export type InsertFeedback = z.infer<typeof insertFeedbackSchema>;
export type InsertRequest = z.infer<typeof insertRequestSchema>;
export type InsertChefTask = z.infer<typeof insertChefTaskSchema>;
export type InsertMenuCritique = z.infer<typeof insertMenuCritiqueSchema>;
export type InsertMenuWorkflowHistory = z.infer<typeof insertMenuWorkflowHistorySchema>;
export type HdHeadcount = typeof hdHeadcounts.$inferSelect;
export type HdMealReview = typeof hdMealReviews.$inferSelect;
export type HdEventRequest = typeof hdEventRequests.$inferSelect;
export type InsertHdHeadcount = z.infer<typeof insertHdHeadcountSchema>;
export type InsertHdMealReview = z.infer<typeof insertHdMealReviewSchema>;
export type InsertHdEventRequest = z.infer<typeof insertHdEventRequestSchema>;
