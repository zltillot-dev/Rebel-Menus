import type { Express } from "express";
import { type Server } from "http";
import { setupAuth, hashPassword } from "./auth";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { insertMenuSchema, users } from "@shared/schema";
import { eq } from "drizzle-orm";
import { db } from "./db";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  setupAuth(app);

  // Menus
  app.get(api.menus.list.path, async (req, res) => {
    if (!req.user) return res.status(401).send("Unauthorized");
    
    // Admins see all, Chefs see their fraternity, Users see their fraternity
    let fraternity = (req.user as any).fraternity;
    if ((req.user as any).role === 'admin') {
        fraternity = req.query.fraternity as string | undefined;
    }
    const status = req.query.status as string | undefined;

    const menus = await storage.getMenus(fraternity, status);
    res.json(menus);
  });

  app.get(api.menus.get.path, async (req, res) => {
    if (!req.user) return res.status(401).send("Unauthorized");
    const menu = await storage.getMenu(Number(req.params.id));
    if (!menu) return res.status(404).json({ message: "Menu not found" });
    res.json(menu);
  });

  app.post(api.menus.create.path, async (req, res) => {
    if (!req.user || ((req.user as any).role !== 'chef' && (req.user as any).role !== 'admin')) {
      return res.status(403).send("Forbidden");
    }
    try {
      const { items, ...menuData } = req.body;
      const validatedMenu = insertMenuSchema.parse({ 
        ...menuData, 
        chefId: (req.user as any).id,
        fraternity: (req.user as any).fraternity || menuData.fraternity
      });
      
      const menu = await storage.createMenu(validatedMenu, items);
      res.status(201).json(menu);
    } catch (e) {
      res.status(400).json({ message: "Invalid input" });
    }
  });

  app.patch(api.menus.updateStatus.path, async (req, res) => {
    if (!req.user) return res.status(401).send("Unauthorized");
    
    const userRole = (req.user as any).role;
    const userId = (req.user as any).id;
    const menuId = Number(req.params.id);
    const newStatus = req.body.status;
    
    // Admins can update any menu status
    if (userRole === 'admin') {
      const menu = await storage.updateMenuStatus(menuId, newStatus, req.body.adminNotes);
      return res.json(menu);
    }
    
    // Chefs can only resubmit their own menus from needs_revision to pending
    if (userRole === 'chef') {
      const existingMenu = await storage.getMenu(menuId);
      if (!existingMenu || existingMenu.chefId !== userId) {
        return res.status(403).send("Forbidden - not your menu");
      }
      if (existingMenu.status !== 'needs_revision' || newStatus !== 'pending') {
        return res.status(403).send("Forbidden - can only resubmit menus needing revision");
      }
      const menu = await storage.updateMenuStatus(menuId, newStatus);
      return res.json(menu);
    }
    
    return res.status(403).send("Forbidden");
  });

  // Feedback
  app.post(api.feedback.create.path, async (req, res) => {
    if (!req.user) return res.status(401).send("Unauthorized");
    const feedback = await storage.createFeedback({
      ...req.body,
      userId: (req.user as any).id
    });
    res.status(201).json(feedback);
  });

  app.get(api.feedback.list.path, async (req, res) => {
    if (!req.user || (req.user as any).role === 'user') return res.status(403).send("Forbidden");
    const feedback = await storage.getFeedback();
    res.json(feedback);
  });

  // Requests
  app.post(api.requests.create.path, async (req, res) => {
    if (!req.user) return res.status(401).send("Unauthorized");
    const request = await storage.createRequest({
      ...req.body,
      userId: (req.user as any).id
    });
    res.status(201).json(request);
  });

  app.get(api.requests.list.path, async (req, res) => {
    if (!req.user) return res.status(401).send("Unauthorized");
    const requests = await storage.getRequests();
    res.json(requests);
  });

  // Admin
  app.post(api.admin.createChef.path, async (req, res) => {
    if (!req.user || (req.user as any).role !== 'admin') return res.status(403).send("Forbidden");
    const hashedPassword = await hashPassword(req.body.password);
    const user = await storage.createUser({
      ...req.body,
      password: hashedPassword,
      role: 'chef'
    });
    // In a real app, send onboarding email here
    console.log(`Sending onboarding email to ${user.email}...`);
    res.status(201).json(user);
  });

  app.get(api.admin.listChefs.path, async (req, res) => {
    if (!req.user || (req.user as any).role !== 'admin') return res.status(403).send("Forbidden");
    const chefs = await storage.getChefs();
    res.json(chefs);
  });

  // Seed Data
  if (process.env.NODE_ENV !== 'production') {
      (async () => {
          try {
              const password = await hashPassword("password123");
              const adminEmail = "admin@rebelchefs.com";
              const admin = await storage.getUserByEmail(adminEmail);
              
              if (admin) {
                  console.log("Updating existing admin password...");
                  await db.update(users).set({ password }).where(eq(users.id, admin.id));
              } else {
                  console.log("Seeding admin user...");
                  await storage.createUser({
                      name: "Admin User",
                      email: adminEmail,
                      password,
                      role: "admin",
                      fraternity: null
                  } as any);
              }
              
              const chefEmail = "chef.dtd@rebelchefs.com";
              const chef = await storage.getUserByEmail(chefEmail);
              if (chef) {
                  console.log("Updating existing chef password...");
                  await db.update(users).set({ password }).where(eq(users.id, chef.id));
              } else {
                  console.log("Seeding chef user...");
                  await storage.createUser({
                      name: "Head Chef DTD",
                      email: chefEmail,
                      password,
                      role: "chef",
                      fraternity: "Delta Tau Delta"
                  } as any);
              }
              
              // Seed test user account
              const userEmail = "testuser@olemiss.edu";
              const testUser = await storage.getUserByEmail(userEmail);
              if (testUser) {
                  console.log("Updating existing test user password...");
                  await db.update(users).set({ password }).where(eq(users.id, testUser.id));
              } else {
                  console.log("Seeding test user...");
                  await storage.createUser({
                      name: "Test Member",
                      email: userEmail,
                      password,
                      role: "user",
                      fraternity: "Delta Tau Delta"
                  } as any);
              }
              console.log("Seeding complete. Accounts updated with hashed passwords.");
          } catch (err) {
              console.error("Seeding failed:", err);
          }
      })();
  }

  return httpServer;
}
