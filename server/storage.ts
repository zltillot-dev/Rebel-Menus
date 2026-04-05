import { db, pool } from "./db";
import { users, menus, menuItems, feedback, requests, chefTasks, menuCritiques, menuWorkflowHistory, type User, type InsertUser, type Menu, type InsertMenu, type MenuItem, type Feedback, type Request, type InsertRequest, type InsertFeedback, type ChefTask, type InsertChefTask, type MenuCritique, type InsertMenuCritique, type MenuWorkflowHistory, type InsertMenuWorkflowHistory } from "@shared/schema";
import { eq, and, desc, inArray } from "drizzle-orm";

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
  deleteChef(id: number): Promise<void>;
  updateUserPhone(id: number, phoneNumber: string): Promise<User>;
  updateUser(id: number, updates: Partial<{ name: string; email: string; password: string }>): Promise<User>;

  // Menus
  getMenus(fraternity?: string, status?: string): Promise<(Menu & { items: MenuItem[] })[]>;
  getMenu(id: number): Promise<(Menu & { items: MenuItem[] }) | undefined>;
  createMenu(menu: InsertMenu, items: any[]): Promise<Menu>;
  updateMenuStatus(id: number, status: string, adminNotes?: string): Promise<Menu>;
  updateMenu(id: number, menu: InsertMenu, items: any[]): Promise<Menu & { items: MenuItem[] }>;
  deleteMenu(id: number): Promise<void>;
  createMenuWorkflowHistory(entry: InsertMenuWorkflowHistory): Promise<MenuWorkflowHistory>;
  getMenuWorkflowHistory(menuId: number): Promise<MenuWorkflowHistory[]>;
  getMenuWorkflowHistoryForMenus(menuIds: number[]): Promise<Record<number, MenuWorkflowHistory[]>>;

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
  updateRequestStatus(id: number, status: string): Promise<Request>;
  deleteRequest(id: number): Promise<void>;

  // Chef Tasks
  getChefTasks(chefId: number): Promise<ChefTask[]>;
  getAllChefTasks(): Promise<(ChefTask & { chef: User })[]>;
  createChefTask(task: InsertChefTask): Promise<ChefTask>;
  updateChefTask(id: number, updates: Partial<ChefTask>): Promise<ChefTask>;
  deleteChefTask(id: number): Promise<void>;

  // Menu Critiques (House Directors)
  getCritiques(fraternity?: string): Promise<(MenuCritique & { houseDirector: User; menu: Menu })[]>;
  getCritiquesByHouseDirector(houseDirectorId: number): Promise<(MenuCritique & { menu: Menu })[]>;
  getCritique(id: number): Promise<(MenuCritique & { houseDirector: User; menu: Menu }) | undefined>;
  createCritique(critique: InsertMenuCritique): Promise<MenuCritique>;
  acknowledgeCritiqueByChef(id: number): Promise<MenuCritique>;
  acknowledgeCritiqueByAdmin(id: number): Promise<MenuCritique>;
  getHouseDirectors(): Promise<User[]>;
  getHouseDirectorByFraternity(fraternity: string): Promise<User | undefined>;
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

  async deleteChef(id: number): Promise<void> {
    await db.delete(chefTasks).where(eq(chefTasks.chefId, id));
    await db.delete(users).where(and(eq(users.id, id), eq(users.role, "chef")));
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
    if (menuList.length === 0) return [];
    const menuIds = menuList.map(m => m.id);
    const allItems = await db.select().from(menuItems).where(inArray(menuItems.menuId, menuIds));
    const itemsByMenu = new Map<number, typeof allItems>();
    for (const item of allItems) {
      const arr = itemsByMenu.get(item.menuId) ?? [];
      arr.push(item);
      itemsByMenu.set(item.menuId, arr);
    }
    return menuList.map(menu => ({ ...menu, items: itemsByMenu.get(menu.id) ?? [] }));
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
    await db.delete(menuWorkflowHistory).where(eq(menuWorkflowHistory.menuId, id));
    // Delete menu items (foreign key constraint)
    await db.delete(menuItems).where(eq(menuItems.menuId, id));
    // Delete the menu
    await db.delete(menus).where(eq(menus.id, id));
  }

  async createMenuWorkflowHistory(entry: InsertMenuWorkflowHistory): Promise<MenuWorkflowHistory> {
    const [created] = await db.insert(menuWorkflowHistory).values(entry).returning();
    return created;
  }

  async getMenuWorkflowHistory(menuId: number): Promise<MenuWorkflowHistory[]> {
    return db.select().from(menuWorkflowHistory)
      .where(eq(menuWorkflowHistory.menuId, menuId))
      .orderBy(desc(menuWorkflowHistory.createdAt), desc(menuWorkflowHistory.id));
  }

  async getMenuWorkflowHistoryForMenus(menuIds: number[]): Promise<Record<number, MenuWorkflowHistory[]>> {
    const historyByMenu: Record<number, MenuWorkflowHistory[]> = {};
    if (menuIds.length === 0) return historyByMenu;
    const rows = await db.select().from(menuWorkflowHistory)
      .where(inArray(menuWorkflowHistory.menuId, menuIds))
      .orderBy(desc(menuWorkflowHistory.createdAt), desc(menuWorkflowHistory.id));
    for (const row of rows) {
      if (!historyByMenu[row.menuId]) historyByMenu[row.menuId] = [];
      historyByMenu[row.menuId].push(row);
    }
    return historyByMenu;
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
    const conditions = userId ? [eq(requests.userId, userId)] : [];
    const reqs = conditions.length > 0
      ? await db.select().from(requests).where(conditions[0])
      : await db.select().from(requests);

    if (reqs.length === 0) return [];

    const userIds = Array.from(new Set(reqs.map(r => r.userId)));
    const userList = await db.select().from(users).where(inArray(users.id, userIds));
    const userMap = new Map(userList.map(u => [u.id, u]));

    return reqs
      .filter(r => userMap.has(r.userId)) // skip orphaned requests (BUG-009 defense in depth)
      .map(r => ({ ...r, user: userMap.get(r.userId)! }));
  }

  async getRequest(id: number): Promise<Request | undefined> {
    const [request] = await db.select().from(requests).where(eq(requests.id, id));
    return request;
  }

  async updateRequestRead(id: number, isRead: boolean): Promise<Request> {
    const [updated] = await db.update(requests).set({ isRead }).where(eq(requests.id, id)).returning();
    return updated;
  }

  async updateRequestStatus(id: number, status: string): Promise<Request> {
    const [updated] = await db.update(requests).set({ status }).where(eq(requests.id, id)).returning();
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

  // Menu Critiques (House Directors)
  async getCritiques(fraternity?: string): Promise<(MenuCritique & { houseDirector: User; menu: Menu })[]> {
    let conditions = [];
    if (fraternity) conditions.push(eq(menuCritiques.fraternity, fraternity as any));
    
    let query = db.select().from(menuCritiques);
    if (conditions.length > 0) {
      // @ts-ignore
      query = query.where(and(...conditions));
    }
    
    const critiques = await query.orderBy(desc(menuCritiques.createdAt));
    const result = [];
    for (const critique of critiques) {
      const [houseDirector] = await db.select().from(users).where(eq(users.id, critique.houseDirectorId));
      const [menu] = await db.select().from(menus).where(eq(menus.id, critique.menuId));
      if (houseDirector && menu) {
        result.push({ ...critique, houseDirector, menu });
      }
    }
    return result;
  }

  async getCritiquesByHouseDirector(houseDirectorId: number): Promise<(MenuCritique & { menu: Menu })[]> {
    const critiques = await db.select().from(menuCritiques)
      .where(eq(menuCritiques.houseDirectorId, houseDirectorId))
      .orderBy(desc(menuCritiques.createdAt));
    
    const result = [];
    for (const critique of critiques) {
      const [menu] = await db.select().from(menus).where(eq(menus.id, critique.menuId));
      if (menu) {
        result.push({ ...critique, menu });
      }
    }
    return result;
  }

  async getCritique(id: number): Promise<(MenuCritique & { houseDirector: User; menu: Menu }) | undefined> {
    const [critique] = await db.select().from(menuCritiques).where(eq(menuCritiques.id, id));
    if (!critique) return undefined;
    
    const [houseDirector] = await db.select().from(users).where(eq(users.id, critique.houseDirectorId));
    const [menu] = await db.select().from(menus).where(eq(menus.id, critique.menuId));
    
    if (!houseDirector || !menu) return undefined;
    return { ...critique, houseDirector, menu };
  }

  async createCritique(critique: InsertMenuCritique): Promise<MenuCritique> {
    const [created] = await db.insert(menuCritiques).values(critique).returning();
    return created;
  }

  async acknowledgeCritiqueByChef(id: number): Promise<MenuCritique> {
    const now = new Date().toISOString().split('T')[0];
    const [updated] = await db.update(menuCritiques)
      .set({ acknowledgedByChef: true, acknowledgedByChefAt: now, status: 'acknowledged' as any })
      .where(eq(menuCritiques.id, id))
      .returning();
    return updated;
  }

  async acknowledgeCritiqueByAdmin(id: number): Promise<MenuCritique> {
    const now = new Date().toISOString().split('T')[0];
    const [updated] = await db.update(menuCritiques)
      .set({ acknowledgedByAdmin: true, acknowledgedByAdminAt: now, status: 'acknowledged' as any })
      .where(eq(menuCritiques.id, id))
      .returning();
    return updated;
  }

  async getHouseDirectors(): Promise<User[]> {
    return db.select().from(users).where(eq(users.role, "house_director"));
  }

  async getHouseDirectorByFraternity(fraternity: string): Promise<User | undefined> {
    const [hd] = await db.select().from(users)
      .where(and(eq(users.role, "house_director"), eq(users.fraternity, fraternity as any)));
    return hd;
  }
}

export const storage = new DatabaseStorage();
