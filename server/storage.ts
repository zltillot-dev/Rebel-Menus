import { db, pool } from "./db";
import { users, menus, menuItems, feedback, requests, type User, type InsertUser, type Menu, type InsertMenu, type MenuItem, type Feedback, type Request, type InsertRequest, type InsertFeedback } from "@shared/schema";
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
  getChefs(): Promise<User[]>;

  // Menus
  getMenus(fraternity?: string, status?: string): Promise<(Menu & { items: MenuItem[] })[]>;
  getMenu(id: number): Promise<(Menu & { items: MenuItem[] }) | undefined>;
  createMenu(menu: InsertMenu, items: any[]): Promise<Menu>;
  updateMenuStatus(id: number, status: string): Promise<Menu>;

  // Feedback
  createFeedback(feedback: InsertFeedback): Promise<Feedback>;
  getFeedback(menuId?: number): Promise<Feedback[]>;

  // Requests
  createRequest(request: InsertRequest): Promise<Request>;
  getRequests(userId?: number): Promise<(Request & { user: User })[]>;
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

  async getChefs(): Promise<User[]> {
    return db.select().from(users).where(eq(users.role, "chef"));
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

  async updateMenuStatus(id: number, status: string): Promise<Menu> {
    const [menu] = await db.update(menus).set({ status: status as any }).where(eq(menus.id, id)).returning();
    return menu;
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
}

export const storage = new DatabaseStorage();
