import { db, pool } from "./db";
import { users, menus, menuItems, feedback, requests, chefTasks, type User, type InsertUser, type Menu, type InsertMenu, type MenuItem, type Feedback, type Request, type InsertRequest, type InsertFeedback, type ChefTask, type InsertChefTask } from "@shared/schema";
import { eq, and, desc } from "drizzle-orm";

import session from "express-session";
import connectPgSimple from "connect-pg-simple";

const PgStore = connectPgSimple(session);

export interface IStorage {
  sessionStore: session.Store;
  // Users
  getUser(id: number): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getUsers(): Promise<User[]>;
  getChefs(): Promise<User[]>;
  updateUserPhone(id: number, phoneNumber: string): Promise<User>;
  updateUser(id: number, updates: Partial<{ name: string; email: string; password: string }>): Promise<User>;

  // Menus
  getMenus(fraternity?: string, status?: string): Promise<(Menu & { items: MenuItem[] })[]>;
  getMenu(id: number): Promise<(Menu & { items: MenuItem[] }) | undefined>;
  createMenu(menu: InsertMenu, items: any[]): Promise<Menu>;
  updateMenuStatus(id: number, status: string, adminNotes?: string): Promise<Menu>;
  updateMenu(id: number, menu: InsertMenu, items: any[]): Promise<Menu & { items: MenuItem[] }>;
  deleteMenu(id: number): Promise<void>;

  // Feedback
  createFeedback(feedback: InsertFeedback): Promise<Feedback>;
  getFeedback(menuId?: number): Promise<Feedback[]>;
  getFeedbackById(id: number): Promise<Feedback | undefined>;
  updateFeedbackRead(id: number, isRead: boolean): Promise<Feedback>;

  // Requests
  createRequest(request: InsertRequest): Promise<Request>;
  getRequests(userId?: number): Promise<(Request & { user: User })[]>;
  getRequest(id: number): Promise<Request | undefined>;
  updateRequestRead(id: number, isRead: boolean): Promise<Request>;
  deleteRequest(id: number): Promise<void>;

  // Chef Tasks
  getChefTasks(chefId: number): Promise<ChefTask[]>;
  getAllChefTasks(): Promise<(ChefTask & { chef: User })[]>;
  createChefTask(task: InsertChefTask): Promise<ChefTask>;
  updateChefTask(id: number, updates: Partial<ChefTask>): Promise<ChefTask>;
  deleteChefTask(id: number): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  sessionStore: session.Store;

  constructor() {
    this.sessionStore = new PgStore({
      pool,
      createTableIfMissing: true,
    });
  }

  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async getUsers(): Promise<User[]> {
    return db.select().from(users);
  }

  async getChefs(): Promise<User[]> {
    return db.select().from(users).where(eq(users.role, "chef"));
  }

  async updateUserPhone(id: number, phoneNumber: string): Promise<User> {
    const [user] = await db.update(users).set({ phoneNumber }).where(eq(users.id, id)).returning();
    return user;
  }

  async updateUser(id: number, updates: Partial<{ name: string; email: string; password: string }>): Promise<User> {
    const [user] = await db.update(users).set(updates).where(eq(users.id, id)).returning();
    return user;
  }

  async getMenus(fraternity?: string, status?: string): Promise<(Menu & { items: MenuItem[] })[]> {
    const conditions = [];
    if (fraternity) conditions.push(eq(menus.fraternity, fraternity as any));
    if (status) conditions.push(eq(menus.status, status as any));
    
    let query = db.select().from(menus);
    if (conditions.length > 0) {
      // @ts-ignore
      query = query.where(and(...conditions));
    }

    const menuList = await query.orderBy(desc(menus.weekOf));
    
    const result = [];
    for (const menu of menuList) {
      const items = await db.select().from(menuItems).where(eq(menuItems.menuId, menu.id));
      result.push({ ...menu, items });
    }
    return result;
  }

  async getMenu(id: number): Promise<(Menu & { items: MenuItem[] }) | undefined> {
    const [menu] = await db.select().from(menus).where(eq(menus.id, id));
    if (!menu) return undefined;
    const items = await db.select().from(menuItems).where(eq(menuItems.menuId, id));
    return { ...menu, items };
  }

  async createMenu(insertMenu: InsertMenu, items: any[]): Promise<Menu> {
    const [menu] = await db.insert(menus).values(insertMenu).returning();
    for (const item of items) {
      await db.insert(menuItems).values({ ...item, menuId: menu.id });
    }
    return menu;
  }

  async updateMenuStatus(id: number, status: string, adminNotes?: string): Promise<Menu> {
    const updateData: any = { status: status as any };
    if (adminNotes !== undefined) {
      updateData.adminNotes = adminNotes;
    }
    // Clear admin notes when approved
    if (status === 'approved') {
      updateData.adminNotes = null;
    }
    const [menu] = await db.update(menus).set(updateData).where(eq(menus.id, id)).returning();
    return menu;
  }

  async updateMenu(id: number, menuData: InsertMenu, items: any[]): Promise<Menu & { items: MenuItem[] }> {
    // Update menu
    const [menu] = await db.update(menus).set({
      weekOf: menuData.weekOf,
      status: menuData.status as any,
    }).where(eq(menus.id, id)).returning();
    
    // Delete existing items and insert new ones
    await db.delete(menuItems).where(eq(menuItems.menuId, id));
    const insertedItems: MenuItem[] = [];
    for (const item of items) {
      const [insertedItem] = await db.insert(menuItems).values({ ...item, menuId: id }).returning();
      insertedItems.push(insertedItem);
    }
    
    return { ...menu, items: insertedItems };
  }

  async deleteMenu(id: number): Promise<void> {
    // Delete feedback first (foreign key constraint)
    await db.delete(feedback).where(eq(feedback.menuId, id));
    // Delete menu items (foreign key constraint)
    await db.delete(menuItems).where(eq(menuItems.menuId, id));
    // Delete the menu
    await db.delete(menus).where(eq(menus.id, id));
  }

  async createFeedback(insertFeedback: InsertFeedback): Promise<Feedback> {
    const [item] = await db.insert(feedback).values(insertFeedback).returning();
    return item;
  }

  async getFeedback(menuId?: number): Promise<Feedback[]> {
    if (menuId) {
      return db.select().from(feedback).where(eq(feedback.menuId, menuId));
    }
    return db.select().from(feedback);
  }

  async getFeedbackById(id: number): Promise<Feedback | undefined> {
    const [item] = await db.select().from(feedback).where(eq(feedback.id, id));
    return item;
  }

  async updateFeedbackRead(id: number, isRead: boolean): Promise<Feedback> {
    const [updated] = await db.update(feedback).set({ isRead }).where(eq(feedback.id, id)).returning();
    return updated;
  }

  async createRequest(insertRequest: InsertRequest): Promise<Request> {
    const [item] = await db.insert(requests).values(insertRequest).returning();
    return item;
  }

  async getRequests(userId?: number): Promise<(Request & { user: User })[]> {
    // In a real app, we'd join. Drizzle's query builder or relations are better here.
    // For simplicity in this fast implementation, we'll fetch and map manually or use relations if I set them up fully in db.ts queries
    // Let's just do a basic join logic
    const reqs = await db.select().from(requests);
    const result = [];
    for (const r of reqs) {
      const [u] = await db.select().from(users).where(eq(users.id, r.userId));
      if (!userId || r.userId === userId) {
        result.push({ ...r, user: u });
      }
    }
    return result;
  }

  async getRequest(id: number): Promise<Request | undefined> {
    const [request] = await db.select().from(requests).where(eq(requests.id, id));
    return request;
  }

  async updateRequestRead(id: number, isRead: boolean): Promise<Request> {
    const [updated] = await db.update(requests).set({ isRead }).where(eq(requests.id, id)).returning();
    return updated;
  }

  async deleteRequest(id: number): Promise<void> {
    await db.delete(requests).where(eq(requests.id, id));
  }

  async getChefTasks(chefId: number): Promise<ChefTask[]> {
    return db.select().from(chefTasks).where(eq(chefTasks.chefId, chefId)).orderBy(desc(chefTasks.createdAt));
  }

  async getAllChefTasks(): Promise<(ChefTask & { chef: User })[]> {
    const tasks = await db.select().from(chefTasks).orderBy(desc(chefTasks.createdAt));
    const result = [];
    for (const task of tasks) {
      const [chef] = await db.select().from(users).where(eq(users.id, task.chefId));
      result.push({ ...task, chef });
    }
    return result;
  }

  async createChefTask(task: InsertChefTask): Promise<ChefTask> {
    const [created] = await db.insert(chefTasks).values(task).returning();
    return created;
  }

  async updateChefTask(id: number, updates: Partial<ChefTask>): Promise<ChefTask> {
    const [updated] = await db.update(chefTasks).set(updates).where(eq(chefTasks.id, id)).returning();
    return updated;
  }

  async deleteChefTask(id: number): Promise<void> {
    await db.delete(chefTasks).where(eq(chefTasks.id, id));
  }
}

export const storage = new DatabaseStorage();
