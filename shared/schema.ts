import { pgTable, text, serial, integer, boolean, date, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

// Enums
export const ROLES = ["user", "chef", "admin"] as const;
export const FRATERNITIES = ["Delta Tau Delta", "Sigma Chi"] as const;
export const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"] as const;
export const MEAL_TYPES = ["Lunch", "Dinner"] as const;
export const MENU_STATUS = ["draft", "pending", "approved"] as const;
export const REQUEST_TYPES = ["late_plate", "substitution", "future_request"] as const;

// Tables
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  role: text("role", { enum: ROLES }).notNull().default("user"),
  name: text("name").notNull(),
  fraternity: text("fraternity", { enum: FRATERNITIES }), // Nullable for admins
});

export const menus = pgTable("menus", {
  id: serial("id").primaryKey(),
  fraternity: text("fraternity", { enum: FRATERNITIES }).notNull(),
  weekOf: date("week_of").notNull(), // Start date of the week
  status: text("status", { enum: MENU_STATUS }).notNull().default("draft"),
  chefId: integer("chef_id").references(() => users.id),
});

export const menuItems = pgTable("menu_items", {
  id: serial("id").primaryKey(),
  menuId: integer("menu_id").notNull().references(() => menus.id),
  day: text("day", { enum: DAYS }).notNull(),
  meal: text("meal", { enum: MEAL_TYPES }).notNull(),
  description: text("description").notNull(),
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
  rating: integer("rating").notNull(),
  comment: text("comment"),
  isAnonymous: boolean("is_anonymous").default(false),
});

export const requests = pgTable("requests", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  type: text("type", { enum: REQUEST_TYPES }).notNull(),
  details: text("details").notNull(),
  status: text("status").default("pending"),
  date: date("date").defaultNow(),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  menus: many(menus),
  feedback: many(feedback),
  requests: many(requests),
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

// Schemas & Types
export const insertUserSchema = createInsertSchema(users);
export const insertMenuSchema = createInsertSchema(menus);
export const insertMenuItemSchema = createInsertSchema(menuItems);
export const insertFeedbackSchema = createInsertSchema(feedback);
export const insertRequestSchema = createInsertSchema(requests);

export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Menu = typeof menus.$inferSelect;
export type MenuItem = typeof menuItems.$inferSelect;
export type Feedback = typeof feedback.$inferSelect;
export type Request = typeof requests.$inferSelect;
