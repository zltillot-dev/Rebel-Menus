import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import { insertMenuSchema } from "@shared/schema";
import { hashPassword } from "./auth";

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
    if (!req.user || (req.user as any).role === 'user') return res.status(403).send("Forbidden");
    try {
      const { items, ...menuData } = req.body;
      const validatedMenu = insertMenuSchema.parse({ 
        ...menuData, 
        chefId: (req.user as any).id,
        fraternity: (req.user as any).fraternity // Chef's fraternity
      });
      
      const menu = await storage.createMenu(validatedMenu, items);
      res.status(201).json(menu);
    } catch (e) {
      res.status(400).json({ message: "Invalid input" });
    }
  });

  app.patch(api.menus.updateStatus.path, async (req, res) => {
    if (!req.user || (req.user as any).role !== 'admin') return res.status(403).send("Forbidden");
    const menu = await storage.updateMenuStatus(Number(req.params.id), req.body.status);
    res.json(menu);
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
          const chefs = await storage.getChefs();
          const admin = await storage.getUserByEmail("admin@rebelchefs.com");
          if (!admin || chefs.length === 0) {
              console.log("Seeding database...");
              const password = await hashPassword("password123");
              
              if (admin) {
                  // Re-seed admin if it exists but login failed (likely due to no hash)
                  // Actually safer to just update the password if we suspect it's plain text
                  await db.update(users).set({ password }).where(eq(users.id, admin.id));
              } else {
                  await storage.createUser({
                      name: "Admin User",
                      email: "admin@rebelchefs.com",
                      password,
                      role: "admin",
                      fraternity: null
                  } as any);
              }
              
              if (chefs.length === 0) {
                  await storage.createUser({
                      name: "Head Chef DTD",
                      email: "chef.dtd@rebelchefs.com",
                      password,
                      role: "chef",
                      fraternity: "Delta Tau Delta"
                  } as any);
              } else {
                  // Update existing chefs too just in case
                  for (const chef of chefs) {
                      await db.update(users).set({ password }).where(eq(users.id, chef.id));
                  }
              }
              console.log("Seeding complete. Accounts updated with hashed passwords.");
          }
      })();
  }

  return httpServer;
}
