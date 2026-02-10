import type { Express } from "express";
import { type Server } from "http";
import { setupAuth, hashPassword } from "./auth";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { insertMenuSchema, users } from "@shared/schema";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "./db";
import OpenAI from "openai";
import { sendSMS } from "./twilio";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  setupAuth(app);

  // Menus
  app.get(api.menus.list.path, async (req, res) => {
    if (!req.user) return res.status(401).send("Unauthorized");
    
    const userRole = (req.user as any).role;
    const userFraternity = (req.user as any).fraternity;
    
    // Admins see all, Chefs see their fraternity, Users see their fraternity
    let fraternity = userFraternity;
    if (userRole === 'admin') {
        fraternity = req.query.fraternity as string | undefined;
    }
    const status = req.query.status as string | undefined;

    let menus = await storage.getMenus(fraternity, status);
    
    // House directors only see previous, current, and upcoming week
    if (userRole === 'house_director') {
      const now = new Date();
      const dayOfWeek = now.getDay();
      const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Monday is start of week
      
      const currentWeekStart = new Date(now);
      currentWeekStart.setDate(now.getDate() - diff);
      currentWeekStart.setHours(0, 0, 0, 0);
      
      const previousWeekStart = new Date(currentWeekStart);
      previousWeekStart.setDate(previousWeekStart.getDate() - 7);
      
      const nextWeekEnd = new Date(currentWeekStart);
      nextWeekEnd.setDate(nextWeekEnd.getDate() + 14); // Current + next week
      
      menus = menus.filter((menu: any) => {
        const menuWeekOf = new Date(menu.weekOf);
        return menuWeekOf >= previousWeekStart && menuWeekOf < nextWeekEnd;
      });
    }
    
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
      const chefId = (req.user as any).id;
      const fraternity = (req.user as any).fraternity || menuData.fraternity;
      
      const validatedMenu = insertMenuSchema.parse({ 
        ...menuData, 
        chefId,
        fraternity
      });
      
      const menu = await storage.createMenu(validatedMenu, items);
      
      // Send SMS notifications for new menu submission (if status is pending)
      if ((req.user as any).role === 'chef' && validatedMenu.status === 'pending') {
        const chefUser = await storage.getUser(chefId);
        const chefName = chefUser?.name || 'A chef';
        
        // Notify house director
        try {
          const houseDirector = await storage.getHouseDirectorByFraternity(fraternity);
          if (houseDirector?.phoneNumber) {
            const message = `New menu submitted by ${chefName} for ${fraternity}. Please review it in the Rebel Chefs app.`;
            await sendSMS(houseDirector.phoneNumber, message);
            console.log(`[SMS] Notified house director ${houseDirector.name} about new menu`);
          }
        } catch (smsError) {
          console.error("Failed to send SMS to house director:", smsError);
        }
        
        // Notify admin
        try {
          const admins = await db.select().from(users).where(eq(users.role, 'admin'));
          for (const admin of admins) {
            if (admin.phoneNumber) {
              const message = `New menu submitted by ${chefName} (${fraternity}). Please review for approval in Rebel Chefs.`;
              await sendSMS(admin.phoneNumber, message);
              console.log(`[SMS] Notified admin ${admin.name} about new menu`);
            }
          }
        } catch (smsError) {
          console.error("Failed to send SMS to admin:", smsError);
        }
      }
      
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

  // Update menu (chef can edit their own menus that need revision or are pending)
  app.put(api.menus.update.path, async (req, res) => {
    if (!req.user) return res.status(401).send("Unauthorized");
    
    const userRole = (req.user as any).role;
    const userId = (req.user as any).id;
    const menuId = Number(req.params.id);
    
    const existingMenu = await storage.getMenu(menuId);
    if (!existingMenu) {
      return res.status(404).json({ message: "Menu not found" });
    }
    
    // Only chefs can edit their own menus (needs_revision or pending)
    if (userRole === 'chef') {
      if (existingMenu.chefId !== userId) {
        return res.status(403).send("Forbidden - not your menu");
      }
      if (existingMenu.status !== 'needs_revision' && existingMenu.status !== 'pending') {
        return res.status(403).send("Forbidden - can only edit pending or needs_revision menus");
      }
    } else if (userRole !== 'admin') {
      return res.status(403).send("Forbidden");
    }
    
    try {
      const { items, ...menuData } = req.body;
      
      // Chefs can only set status to pending when editing - never approved
      if (userRole === 'chef') {
        menuData.status = 'pending';
      }
      
      const menu = await storage.updateMenu(menuId, menuData, items);
      return res.json(menu);
    } catch (e) {
      return res.status(400).json({ message: "Invalid input" });
    }
  });

  // Delete menu (chef can delete their own menus)
  app.delete(api.menus.delete.path, async (req, res) => {
    if (!req.user) return res.status(401).send("Unauthorized");
    
    const userRole = (req.user as any).role;
    const userId = (req.user as any).id;
    const menuId = Number(req.params.id);
    
    const existingMenu = await storage.getMenu(menuId);
    if (!existingMenu) {
      return res.status(404).json({ message: "Menu not found" });
    }
    
    // Chefs can only delete their own menus
    if (userRole === 'chef') {
      if (existingMenu.chefId !== userId) {
        return res.status(403).send("Forbidden - not your menu");
      }
    } else if (userRole !== 'admin') {
      return res.status(403).send("Forbidden");
    }
    
    await storage.deleteMenu(menuId);
    return res.json({ message: "Menu deleted successfully" });
  });

  // Feedback
  app.post(api.feedback.create.path, async (req, res) => {
    if (!req.user) return res.status(401).send("Unauthorized");
    
    // Validate required fields for per-meal feedback
    const { menuId, mealDay, mealType, rating, comment, isAnonymous } = req.body;
    
    if (!menuId || typeof menuId !== 'number') {
      return res.status(400).json({ error: "menuId is required" });
    }
    if (!mealDay || !["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"].includes(mealDay)) {
      return res.status(400).json({ error: "Valid mealDay is required (Monday-Friday)" });
    }
    if (!mealType || !["Lunch", "Dinner"].includes(mealType)) {
      return res.status(400).json({ error: "Valid mealType is required (Lunch or Dinner)" });
    }
    if (!rating || typeof rating !== 'number' || rating < 1 || rating > 5) {
      return res.status(400).json({ error: "Rating must be between 1 and 5" });
    }
    
    const feedback = await storage.createFeedback({
      menuId,
      mealDay,
      mealType,
      rating,
      comment: comment || null,
      isAnonymous: isAnonymous || false,
      userId: (req.user as any).id
    });
    res.status(201).json(feedback);
  });

  app.get(api.feedback.list.path, async (req, res) => {
    if (!req.user) return res.status(401).send("Unauthorized");
    
    const userRole = (req.user as any).role;
    const userId = (req.user as any).id;
    
    // Users can only see their own feedback, admins/chefs can see all
    if (userRole === 'user') {
      const feedback = await storage.getFeedback();
      const userFeedback = feedback.filter(f => f.userId === userId);
      return res.json(userFeedback);
    }
    
    const feedback = await storage.getFeedback();
    res.json(feedback);
  });

  // Requests
  app.post(api.requests.create.path, async (req, res) => {
    if (!req.user) return res.status(401).send("Unauthorized");
    
    const userFraternity = (req.user as any).fraternity;
    const userName = (req.user as any).name;
    const userEmail = (req.user as any).email;
    const requestType = req.body.type;
    
    const request = await storage.createRequest({
      ...req.body,
      userId: (req.user as any).id,
      fraternity: userFraternity || req.body.fraternity
    });
    
    // Send SMS notification to chef for substitutions and menu suggestions
    if (requestType === 'substitution' || requestType === 'menu_suggestion') {
      try {
        // Find the chef for this fraternity
        if (userFraternity) {
          const chefs = await storage.getChefs();
          const fraternityChef = chefs.find(c => c.fraternity === userFraternity && c.phoneNumber);
          
          if (fraternityChef && fraternityChef.phoneNumber) {
            const typeLabel = requestType === 'substitution' ? 'Substitution Request' : 'Menu Suggestion';
            const now = new Date();
            const timeStr = now.toLocaleString('en-US', { 
              weekday: 'long', 
              month: 'long', 
              day: 'numeric',
              hour: 'numeric',
              minute: '2-digit',
              hour12: true 
            });
            
            const smsBody = `REBEL CHEFS - New ${typeLabel}\n` +
              `From: ${userName} (${userEmail})\n` +
              `Time: ${timeStr}\n` +
              `Details: ${req.body.details || 'No details provided'}`;
            
            await sendSMS(fraternityChef.phoneNumber, smsBody);
            console.log(`SMS sent to chef for ${typeLabel} from ${userEmail}`);
          }
        }
      } catch (smsError) {
        console.error('Failed to send SMS notification:', smsError);
        // Don't fail the request if SMS fails
      }
    }
    
    res.status(201).json(request);
  });

  app.get(api.requests.list.path, async (req, res) => {
    if (!req.user) return res.status(401).send("Unauthorized");
    
    const userRole = (req.user as any).role;
    const userId = (req.user as any).id;
    const userFraternity = (req.user as any).fraternity;
    
    // Users can only see their own requests
    const allRequests = await storage.getRequests();
    if (userRole === 'user') {
      const userRequests = allRequests.filter(r => r.userId === userId);
      return res.json(userRequests);
    }
    
    // Chefs can see late plates for their fraternity
    if (userRole === 'chef' && userFraternity) {
      const fraternityRequests = allRequests.filter(r => 
        r.fraternity === userFraternity || r.userId === userId
      );
      return res.json(fraternityRequests);
    }
    
    // Admins can see all
    res.json(allRequests);
  });

  // Late plates for chef dashboard - organized by meal service
  app.get("/api/late-plates", async (req, res) => {
    if (!req.user) return res.status(401).send("Unauthorized");
    
    const userRole = (req.user as any).role;
    const userFraternity = (req.user as any).fraternity;
    
    if (userRole !== 'chef' && userRole !== 'admin') {
      return res.status(403).send("Forbidden");
    }
    
    const allRequests = await storage.getRequests();
    
    // Filter to late plate requests only
    let latePlates = allRequests.filter(r => r.type === 'late_plate');
    
    // Chefs only see their fraternity's late plates
    if (userRole === 'chef' && userFraternity) {
      latePlates = latePlates.filter(r => r.fraternity === userFraternity);
    }
    
    // Get user names for the late plates
    const latePlatesWithUsers = await Promise.all(
      latePlates.map(async (lp) => {
        const user = await storage.getUser(lp.userId);
        return {
          ...lp,
          userName: user?.name || 'Unknown User',
          userEmail: user?.email || ''
        };
      })
    );
    
    res.json(latePlatesWithUsers);
  });

  // Feedback for chef dashboard - filtered by fraternity menus
  app.get("/api/chef-feedback", async (req, res) => {
    if (!req.user) return res.status(401).send("Unauthorized");
    
    const userRole = (req.user as any).role;
    const userFraternity = (req.user as any).fraternity;
    
    if (userRole !== 'chef' && userRole !== 'admin') {
      return res.status(403).send("Forbidden");
    }
    
    const allFeedback = await storage.getFeedback();
    const allMenus = await storage.getMenus();
    
    // Get menu IDs for the chef's fraternity
    let fraternityMenuIds: number[] = [];
    if (userRole === 'chef' && userFraternity) {
      fraternityMenuIds = allMenus
        .filter(m => m.fraternity === userFraternity)
        .map(m => m.id);
    } else {
      fraternityMenuIds = allMenus.map(m => m.id);
    }
    
    // Filter feedback to only show feedback for fraternity menus
    const fraternityFeedback = allFeedback.filter(f => 
      fraternityMenuIds.includes(f.menuId)
    );
    
    // Get user names and menu info
    const feedbackWithDetails = await Promise.all(
      fraternityFeedback.map(async (fb) => {
        const user = await storage.getUser(fb.userId);
        const menu = allMenus.find(m => m.id === fb.menuId);
        return {
          ...fb,
          userName: fb.isAnonymous ? 'Anonymous' : (user?.name || 'Unknown User'),
          userEmail: fb.isAnonymous ? null : (user?.email || ''),
          menuWeek: menu?.weekOf || ''
        };
      })
    );
    
    res.json(feedbackWithDetails);
  });

  // Substitutions and menu suggestions for chef dashboard
  app.get("/api/chef-requests", async (req, res) => {
    if (!req.user) return res.status(401).send("Unauthorized");
    
    const userRole = (req.user as any).role;
    const userFraternity = (req.user as any).fraternity;
    
    if (userRole !== 'chef' && userRole !== 'admin') {
      return res.status(403).send("Forbidden");
    }
    
    const allRequests = await storage.getRequests();
    
    // Filter to substitutions and menu suggestions only
    let chefRequests = allRequests.filter(r => 
      r.type === 'substitution' || r.type === 'menu_suggestion'
    );
    
    // Chefs only see their fraternity's requests
    if (userRole === 'chef' && userFraternity) {
      chefRequests = chefRequests.filter(r => r.fraternity === userFraternity);
    }
    
    // Filter to last 60 days
    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
    chefRequests = chefRequests.filter(r => {
      const requestDate = new Date(r.date || '');
      return requestDate >= sixtyDaysAgo;
    });
    
    // Get user names for the requests
    const requestsWithUsers = await Promise.all(
      chefRequests.map(async (req) => {
        const user = await storage.getUser(req.userId);
        return {
          ...req,
          userName: user?.name || 'Unknown User',
          userEmail: user?.email || ''
        };
      })
    );
    
    res.json(requestsWithUsers);
  });

  app.delete(api.requests.delete.path, async (req, res) => {
    if (!req.user) return res.status(401).send("Unauthorized");
    
    const userId = (req.user as any).id;
    const userRole = (req.user as any).role;
    const requestId = Number(req.params.id);
    
    const existingRequest = await storage.getRequest(requestId);
    if (!existingRequest) {
      return res.status(404).json({ message: "Request not found" });
    }
    
    // Users can only delete their own requests, admins can delete any
    if (userRole === 'user' && existingRequest.userId !== userId) {
      return res.status(403).send("Forbidden - not your request");
    }
    
    await storage.deleteRequest(requestId);
    return res.json({ message: "Request deleted successfully" });
  });

  // Mark request as read (chef only - substitutions and menu suggestions)
  app.patch(api.requests.markRead.path, async (req, res) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });
    
    const userRole = (req.user as any).role;
    const userFraternity = (req.user as any).fraternity;
    
    if (userRole !== 'chef' && userRole !== 'admin') {
      return res.status(403).json({ message: "Only chefs can mark requests as read" });
    }
    
    // Validate input
    const parseResult = api.requests.markRead.input.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ message: parseResult.error.errors[0]?.message || "Invalid input" });
    }
    
    const requestId = Number(req.params.id);
    const existingRequest = await storage.getRequest(requestId);
    
    if (!existingRequest) {
      return res.status(404).json({ message: "Request not found" });
    }
    
    // Chefs can only mark their fraternity's requests
    if (userRole === 'chef' && existingRequest.fraternity !== userFraternity) {
      return res.status(403).json({ message: "Not your fraternity's request" });
    }
    
    const updated = await storage.updateRequestRead(requestId, parseResult.data.isRead);
    return res.json(updated);
  });

  // Update request status (chef can approve/reject substitution requests for their fraternity)
  app.patch(api.requests.updateStatus.path, async (req, res) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });
    
    const userRole = (req.user as any).role;
    const userFraternity = (req.user as any).fraternity;
    
    if (userRole !== 'chef' && userRole !== 'admin') {
      return res.status(403).json({ message: "Only chefs can update request status" });
    }
    
    // Validate input
    const parseResult = api.requests.updateStatus.input.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ message: parseResult.error.errors[0]?.message || "Invalid input" });
    }
    
    const requestId = Number(req.params.id);
    const existingRequest = await storage.getRequest(requestId);
    
    if (!existingRequest) {
      return res.status(404).json({ message: "Request not found" });
    }
    
    // Only substitution requests can be approved/rejected
    if (existingRequest.type !== 'substitution') {
      return res.status(400).json({ message: "Only substitution requests can be approved or rejected" });
    }
    
    // Chefs can only update their fraternity's requests
    if (userRole === 'chef' && existingRequest.fraternity !== userFraternity) {
      return res.status(403).json({ message: "Not your fraternity's request" });
    }
    
    const updated = await storage.updateRequestStatus(requestId, parseResult.data.status);
    
    // Also mark as read when updating status
    await storage.updateRequestRead(requestId, true);
    
    return res.json(updated);
  });

  // Mark feedback as read (chef only)
  app.patch(api.chefFeedback.markRead.path, async (req, res) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });
    
    const userRole = (req.user as any).role;
    const userFraternity = (req.user as any).fraternity;
    
    if (userRole !== 'chef' && userRole !== 'admin') {
      return res.status(403).json({ message: "Only chefs can mark feedback as read" });
    }
    
    // Validate input
    const parseResult = api.chefFeedback.markRead.input.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ message: parseResult.error.errors[0]?.message || "Invalid input" });
    }
    
    const feedbackId = Number(req.params.id);
    const existingFeedback = await storage.getFeedbackById(feedbackId);
    
    if (!existingFeedback) {
      return res.status(404).json({ message: "Feedback not found" });
    }
    
    // Chefs can only mark their fraternity's feedback
    // Get the menu to check fraternity
    const menu = await storage.getMenu(existingFeedback.menuId);
    if (userRole === 'chef' && menu?.fraternity !== userFraternity) {
      return res.status(403).json({ message: "Not your fraternity's feedback" });
    }
    
    const updated = await storage.updateFeedbackRead(feedbackId, parseResult.data.isRead);
    return res.json(updated);
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

  // Delete chef (admin only)
  app.delete(api.admin.deleteChef.path, async (req, res) => {
    if (!req.user || (req.user as any).role !== 'admin') return res.status(403).send("Forbidden");
    const chefId = Number(req.params.id);
    const chef = await storage.getUser(chefId);
    if (!chef || chef.role !== 'chef') {
      return res.status(404).json({ message: "Chef not found" });
    }
    await storage.deleteChef(chefId);
    res.json({ message: "Chef deleted successfully" });
  });

  app.get(api.admin.listChefs.path, async (req, res) => {
    if (!req.user || (req.user as any).role !== 'admin') return res.status(403).send("Forbidden");
    const chefs = await storage.getChefs();
    res.json(chefs);
  });

  // AI Macro Estimation
  app.post("/api/estimate-macros", async (req, res) => {
    if (!req.user) return res.status(401).send("Unauthorized");
    
    // Only chefs and admins can use this feature
    const userRole = (req.user as any).role;
    if (userRole !== 'chef' && userRole !== 'admin') {
      return res.status(403).send("Forbidden");
    }
    
    const { description, side1, side2, side3 } = req.body;
    
    if (!description) {
      return res.status(400).json({ message: "Main item description is required" });
    }
    
    try {
      const foodItems = [description, side1, side2, side3].filter(Boolean).join(", ");
      
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `You are a nutritionist assistant. Given a meal description, estimate the nutritional information for a typical serving. Return ONLY a JSON object with these fields: calories (number), protein (number in grams), carbs (number in grams), fats (number in grams), sugar (number in grams). Be reasonable with estimates for typical fraternity house portion sizes (generous but not excessive). Return only valid JSON, no markdown or explanation.`
          },
          {
            role: "user",
            content: `Estimate the nutritional information for this meal: ${foodItems}`
          }
        ],
        response_format: { type: "json_object" },
        max_tokens: 200,
      });
      
      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error("No response from AI");
      }
      
      const macros = JSON.parse(content);
      
      // Ensure all fields are numbers and within reasonable bounds
      const result = {
        calories: Math.min(Math.max(Math.round(Number(macros.calories) || 0), 0), 3000),
        protein: Math.min(Math.max(Math.round(Number(macros.protein) || 0), 0), 200),
        carbs: Math.min(Math.max(Math.round(Number(macros.carbs) || 0), 0), 500),
        fats: Math.min(Math.max(Math.round(Number(macros.fats) || 0), 0), 200),
        sugar: Math.min(Math.max(Math.round(Number(macros.sugar) || 0), 0), 200),
      };
      
      return res.json(result);
    } catch (error) {
      console.error("Error estimating macros:", error);
      return res.status(500).json({ message: "Failed to estimate nutritional information" });
    }
  });

  // Profile update schema
  const profileUpdateSchema = z.object({
    name: z.string().min(2, "Name must be at least 2 characters").optional(),
    email: z.string().email("Invalid email address").optional(),
    currentPassword: z.string().optional(),
    newPassword: z.string().min(6, "Password must be at least 6 characters").optional(),
  }).refine(data => {
    // If changing password, current password is required
    if (data.newPassword && !data.currentPassword) {
      return false;
    }
    return true;
  }, { message: "Current password is required to set a new password" });

  // Update user profile (chefs can update their own credentials)
  app.patch("/api/user/profile", async (req, res) => {
    if (!req.user) return res.status(401).send("Unauthorized");
    
    const userId = (req.user as any).id;
    const userRole = (req.user as any).role;
    
    if (!['chef', 'admin', 'house_director'].includes(userRole)) {
      return res.status(403).send("Forbidden");
    }
    
    const parseResult = profileUpdateSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ 
        message: parseResult.error.errors[0]?.message || "Invalid input" 
      });
    }
    
    const { name, email, currentPassword, newPassword } = parseResult.data;
    
    try {
      const updates: Partial<{ name: string; email: string; password: string }> = {};
      
      // Update name if provided
      if (name) {
        updates.name = name;
      }
      
      // Update email if provided (check for conflicts)
      if (email && email !== (req.user as any).email) {
        const existingUser = await storage.getUserByEmail(email);
        if (existingUser && existingUser.id !== userId) {
          return res.status(400).json({ message: "Email already in use" });
        }
        updates.email = email;
      }
      
      // Update password if provided
      if (newPassword && currentPassword) {
        // Verify current password
        const user = await storage.getUser(userId);
        if (!user) {
          return res.status(404).json({ message: "User not found" });
        }
        
        const { scrypt, timingSafeEqual } = await import("crypto");
        const { promisify } = await import("util");
        const scryptAsync = promisify(scrypt);
        
        const [storedHash, salt] = user.password.split(".");
        const storedBuf = Buffer.from(storedHash, "hex");
        const suppliedBuf = (await scryptAsync(currentPassword, salt, 64)) as Buffer;
        
        if (!timingSafeEqual(storedBuf, suppliedBuf)) {
          return res.status(400).json({ message: "Current password is incorrect" });
        }
        
        // Hash and set new password
        updates.password = await hashPassword(newPassword);
      }
      
      if (Object.keys(updates).length === 0) {
        return res.status(400).json({ message: "No changes provided" });
      }
      
      const updatedUser = await storage.updateUser(userId, updates);
      res.json({ 
        success: true,
        user: {
          id: updatedUser.id,
          name: updatedUser.name,
          email: updatedUser.email,
          role: updatedUser.role,
          fraternity: updatedUser.fraternity
        }
      });
    } catch (error) {
      console.error("Error updating profile:", error);
      res.status(500).json({ message: "Failed to update profile" });
    }
  });

  // Phone number update schema
  const phoneUpdateSchema = z.object({
    phoneNumber: z.string()
      .min(10, "Phone number must be at least 10 digits")
      .transform(val => val.replace(/[^\d+]/g, ''))
      .refine(val => val.length >= 10, "Invalid phone number format")
  });

  // Update user phone number (for SMS notifications)
  app.patch("/api/user/phone", async (req, res) => {
    if (!req.user) return res.status(401).send("Unauthorized");
    
    const userId = (req.user as any).id;
    
    const parseResult = phoneUpdateSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ 
        message: parseResult.error.errors[0]?.message || "Invalid phone number" 
      });
    }
    
    const { phoneNumber: cleanedPhone } = parseResult.data;
    
    try {
      const user = await storage.updateUserPhone(userId, cleanedPhone);
      res.json({ 
        success: true, 
        phoneNumber: user.phoneNumber 
      });
    } catch (error) {
      console.error("Error updating phone:", error);
      res.status(500).json({ message: "Failed to update phone number" });
    }
  });

  // Chef Tasks API
  // Get tasks for the logged-in chef
  app.get(api.chefTasks.list.path, async (req, res) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });
    const userId = (req.user as any).id;
    const userRole = (req.user as any).role;
    
    if (userRole !== 'chef') {
      return res.status(403).json({ message: "Forbidden - only chefs can view their tasks" });
    }
    
    const tasks = await storage.getChefTasks(userId);
    res.json(tasks);
  });

  // Get all tasks (admin only)
  app.get(api.admin.listChefTasks.path, async (req, res) => {
    if (!req.user || (req.user as any).role !== 'admin') {
      return res.status(403).json({ message: "Forbidden" });
    }
    const tasks = await storage.getAllChefTasks();
    res.json(tasks);
  });

  // Create task for a chef (admin only)
  app.post(api.admin.createChefTask.path, async (req, res) => {
    if (!req.user || (req.user as any).role !== 'admin') {
      return res.status(403).json({ message: "Forbidden" });
    }
    try {
      const { insertChefTaskSchema } = await import("@shared/schema");
      const validated = insertChefTaskSchema.parse(req.body);
      const task = await storage.createChefTask(validated);
      res.status(201).json(task);
    } catch (error: any) {
      console.error("Error creating task:", error);
      if (error.name === 'ZodError') {
        return res.status(400).json({ message: error.errors[0]?.message || "Invalid input" });
      }
      res.status(400).json({ message: "Failed to create task" });
    }
  });

  // Update task (admin can update any, chef can only mark complete)
  app.patch(api.chefTasks.update.path, async (req, res) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });
    
    const taskId = Number(req.params.id);
    const userRole = (req.user as any).role;
    const userId = (req.user as any).id;
    
    // Validate input using the shared schema
    const parseResult = api.chefTasks.update.input.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ message: parseResult.error.errors[0]?.message || "Invalid input" });
    }
    const validatedData = parseResult.data;
    
    if (userRole === 'admin') {
      const task = await storage.updateChefTask(taskId, validatedData);
      return res.json(task);
    }
    
    if (userRole === 'chef') {
      // Chefs can only update isCompleted on their own tasks
      const tasks = await storage.getChefTasks(userId);
      const ownTask = tasks.find(t => t.id === taskId);
      if (!ownTask) {
        return res.status(403).json({ message: "Forbidden - not your task" });
      }
      const task = await storage.updateChefTask(taskId, { isCompleted: validatedData.isCompleted });
      return res.json(task);
    }
    
    return res.status(403).json({ message: "Forbidden" });
  });

  // Delete task (admin only)
  app.delete(api.admin.deleteChefTask.path, async (req, res) => {
    if (!req.user || (req.user as any).role !== 'admin') {
      return res.status(403).json({ message: "Forbidden" });
    }
    await storage.deleteChefTask(Number(req.params.id));
    res.json({ message: "Task deleted successfully" });
  });

  // ==================== Menu Critiques (House Directors) ====================

  // Get critiques - house directors see their own, chefs/admins see their fraternity's
  app.get("/api/critiques", async (req, res) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });
    
    const userRole = (req.user as any).role;
    const userId = (req.user as any).id;
    const userFraternity = (req.user as any).fraternity;
    
    if (userRole === 'house_director') {
      const critiques = await storage.getCritiquesByHouseDirector(userId);
      return res.json(critiques);
    }
    
    if (userRole === 'chef') {
      const critiques = await storage.getCritiques(userFraternity);
      return res.json(critiques);
    }
    
    if (userRole === 'admin') {
      const fraternity = req.query.fraternity as string | undefined;
      const critiques = await storage.getCritiques(fraternity);
      return res.json(critiques);
    }
    
    return res.status(403).json({ message: "Forbidden" });
  });

  // Create critique - house directors only
  app.post("/api/critiques", async (req, res) => {
    if (!req.user || (req.user as any).role !== 'house_director') {
      return res.status(403).json({ message: "Only house directors can submit critiques" });
    }
    
    try {
      const userId = (req.user as any).id;
      const userFraternity = (req.user as any).fraternity;
      
      const { menuId, critiqueText, suggestedEdits } = req.body;
      
      if (!menuId) {
        return res.status(400).json({ message: "menuId is required" });
      }
      
      // Verify menu exists and belongs to house director's fraternity
      const menu = await storage.getMenu(Number(menuId));
      if (!menu) {
        return res.status(404).json({ message: "Menu not found" });
      }
      if (menu.fraternity !== userFraternity) {
        return res.status(403).json({ message: "Can only critique menus for your fraternity" });
      }
      
      const critique = await storage.createCritique({
        menuId: Number(menuId),
        houseDirectorId: userId,
        fraternity: userFraternity,
        critiqueText: critiqueText || null,
        suggestedEdits: suggestedEdits || null,
        status: 'pending',
        acknowledgedByChef: false,
        acknowledgedByAdmin: false,
      });
      
      res.status(201).json(critique);
    } catch (error) {
      console.error("Error creating critique:", error);
      res.status(400).json({ message: "Failed to create critique" });
    }
  });

  // Acknowledge critique by chef
  app.patch("/api/critiques/:id/acknowledge-chef", async (req, res) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });
    
    const userRole = (req.user as any).role;
    const userFraternity = (req.user as any).fraternity;
    
    if (userRole !== 'chef') {
      return res.status(403).json({ message: "Only chefs can acknowledge critiques" });
    }
    
    const critiqueId = Number(req.params.id);
    const critique = await storage.getCritique(critiqueId);
    
    if (!critique) {
      return res.status(404).json({ message: "Critique not found" });
    }
    
    if (critique.fraternity !== userFraternity) {
      return res.status(403).json({ message: "Can only acknowledge critiques for your fraternity" });
    }
    
    const updated = await storage.acknowledgeCritiqueByChef(critiqueId);
    
    // Send SMS notification to house director
    try {
      const houseDirector = await storage.getHouseDirectorByFraternity(critique.fraternity);
      if (houseDirector?.phoneNumber) {
        const chefUser = await storage.getUser((req.user as any).id);
        const message = `Your menu critique for ${critique.fraternity} has been acknowledged by ${chefUser?.name || 'the chef'}. - Rebel Chefs`;
        await sendSMS(houseDirector.phoneNumber, message);
      }
    } catch (smsError) {
      console.error("Failed to send SMS to house director:", smsError);
    }
    
    res.json(updated);
  });

  // Acknowledge critique by admin
  app.patch("/api/critiques/:id/acknowledge-admin", async (req, res) => {
    if (!req.user || (req.user as any).role !== 'admin') {
      return res.status(403).json({ message: "Only admins can acknowledge critiques" });
    }
    
    const critiqueId = Number(req.params.id);
    const critique = await storage.getCritique(critiqueId);
    
    if (!critique) {
      return res.status(404).json({ message: "Critique not found" });
    }
    
    const updated = await storage.acknowledgeCritiqueByAdmin(critiqueId);
    
    // Send SMS notification to house director
    try {
      const houseDirector = await storage.getHouseDirectorByFraternity(critique.fraternity);
      if (houseDirector?.phoneNumber) {
        const message = `Your menu critique for ${critique.fraternity} has been acknowledged by the admin. - Rebel Chefs`;
        await sendSMS(houseDirector.phoneNumber, message);
      }
    } catch (smsError) {
      console.error("Failed to send SMS to house director:", smsError);
    }
    
    res.json(updated);
  });

  // Get house directors (admin only)
  app.get("/api/admin/house-directors", async (req, res) => {
    if (!req.user || (req.user as any).role !== 'admin') {
      return res.status(403).json({ message: "Forbidden" });
    }
    const houseDirectors = await storage.getHouseDirectors();
    res.json(houseDirectors);
  });

  // Create house director (admin only)
  app.post("/api/admin/house-directors", async (req, res) => {
    if (!req.user || (req.user as any).role !== 'admin') {
      return res.status(403).json({ message: "Forbidden" });
    }
    
    try {
      const { name, email, password, fraternity, phoneNumber } = req.body;
      
      if (!name || !email || !password || !fraternity) {
        return res.status(400).json({ message: "Name, email, password, and fraternity are required" });
      }
      
      // Check if email already exists
      const existing = await storage.getUserByEmail(email);
      if (existing) {
        return res.status(400).json({ message: "Email already exists" });
      }
      
      const hashedPassword = await hashPassword(password);
      const user = await storage.createUser({
        name,
        email,
        password: hashedPassword,
        role: 'house_director',
        fraternity,
        phoneNumber: phoneNumber || null
      } as any);
      
      // Don't return password
      const { password: _, ...userWithoutPassword } = user;
      res.status(201).json(userWithoutPassword);
    } catch (error) {
      console.error("Error creating house director:", error);
      res.status(400).json({ message: "Failed to create house director" });
    }
  });

  app.patch("/api/admin/house-directors/:id", async (req, res) => {
    if (!req.user || (req.user as any).role !== 'admin') {
      return res.status(403).json({ message: "Forbidden" });
    }

    try {
      const hdId = parseInt(req.params.id);
      if (isNaN(hdId)) {
        return res.status(400).json({ message: "Invalid house director ID" });
      }

      const hdUpdateSchema = z.object({
        name: z.string().min(2).optional(),
        email: z.string().email().optional(),
        password: z.string().min(6).optional(),
        phoneNumber: z.string().optional(),
      });

      const parseResult = hdUpdateSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ message: "Invalid input", errors: parseResult.error.flatten().fieldErrors });
      }

      const targetUser = await storage.getUser(hdId);
      if (!targetUser || targetUser.role !== 'house_director') {
        return res.status(404).json({ message: "House director not found" });
      }

      const { name, email, password, phoneNumber } = parseResult.data;
      const updates: Partial<{ name: string; email: string; password: string }> = {};

      if (name) updates.name = name;
      if (email && email !== targetUser.email) {
        const existing = await storage.getUserByEmail(email);
        if (existing && existing.id !== hdId) {
          return res.status(400).json({ message: "Email already in use" });
        }
        updates.email = email;
      }
      if (password) {
        updates.password = await hashPassword(password);
      }

      let updatedUser = targetUser;
      if (Object.keys(updates).length > 0) {
        updatedUser = await storage.updateUser(hdId, updates);
      }

      if (phoneNumber !== undefined) {
        updatedUser = await storage.updateUserPhone(hdId, phoneNumber || "");
      }

      const { password: _, ...userWithoutPassword } = updatedUser;
      res.json(userWithoutPassword);
    } catch (error) {
      console.error("Error updating house director:", error);
      res.status(400).json({ message: "Failed to update house director" });
    }
  });

  // Manual trigger for late plate SMS (for testing - admin only)
  app.post("/api/admin/trigger-late-plate-sms", async (req, res) => {
    if (!req.user || (req.user as any).role !== 'admin') {
      return res.status(403).send("Forbidden");
    }
    
    const { mealType } = req.body;
    if (mealType !== 'Lunch' && mealType !== 'Dinner') {
      return res.status(400).json({ message: "mealType must be 'Lunch' or 'Dinner'" });
    }
    
    try {
      const { triggerLatePlateNotification } = await import('./scheduler');
      await triggerLatePlateNotification(mealType);
      res.json({ success: true, message: `Triggered ${mealType} late plate notifications` });
    } catch (error) {
      console.error("Error triggering SMS:", error);
      res.status(500).json({ message: "Failed to trigger SMS notifications" });
    }
  });

  // Seed Data - runs in all environments to ensure admin account exists
  (async () => {
      try {
          // Primary admin account - always ensure this exists
          const adminEmail = "chefzak@rebelchefs.net";
          const adminPassword = await hashPassword("Drum14me!!");
          const admin = await storage.getUserByEmail(adminEmail);
          
          if (admin) {
              console.log("Updating existing admin password...");
              await db.update(users).set({ password: adminPassword }).where(eq(users.id, admin.id));
          } else {
              console.log("Seeding admin user...");
              await storage.createUser({
                  name: "Chef Zak",
                  email: adminEmail,
                  password: adminPassword,
                  role: "admin",
                  fraternity: null
              } as any);
          }
          
          // Test accounts only in development
          if (process.env.NODE_ENV !== 'production') {
              const testPassword = await hashPassword("password123");
              const chefEmail = "chef.dtd@rebelchefs.com";
              const chef = await storage.getUserByEmail(chefEmail);
              if (chef) {
                  console.log("Updating existing chef password...");
                  await db.update(users).set({ password: testPassword }).where(eq(users.id, chef.id));
              } else {
                  console.log("Seeding chef user...");
                  await storage.createUser({
                      name: "Head Chef DTD",
                      email: chefEmail,
                      password: testPassword,
                      role: "chef",
                      fraternity: "Delta Tau Delta"
                  } as any);
              }
              
              // Seed test user account
              const userEmail = "testuser@olemiss.edu";
              const testUser = await storage.getUserByEmail(userEmail);
              if (testUser) {
                  console.log("Updating existing test user password...");
                  await db.update(users).set({ password: testPassword }).where(eq(users.id, testUser.id));
              } else {
                  console.log("Seeding test user...");
                  await storage.createUser({
                      name: "Test Member",
                      email: userEmail,
                      password: testPassword,
                      role: "user",
                      fraternity: "Delta Tau Delta"
                  } as any);
              }
              
              // Seed test house director accounts
              const hdDtdEmail = "hd.dtd@olemiss.edu";
              const hdDtd = await storage.getUserByEmail(hdDtdEmail);
              if (hdDtd) {
                  console.log("Updating existing DTD house director password...");
                  await db.update(users).set({ password: testPassword }).where(eq(users.id, hdDtd.id));
              } else {
                  console.log("Seeding DTD house director...");
                  await storage.createUser({
                      name: "House Director DTD",
                      email: hdDtdEmail,
                      password: testPassword,
                      role: "house_director",
                      fraternity: "Delta Tau Delta"
                  } as any);
              }
              
              const hdSigmaEmail = "hd.sigma@k-state.edu";
              const hdSigma = await storage.getUserByEmail(hdSigmaEmail);
              if (hdSigma) {
                  console.log("Updating existing Sigma Chi house director password...");
                  await db.update(users).set({ password: testPassword }).where(eq(users.id, hdSigma.id));
              } else {
                  console.log("Seeding Sigma Chi house director...");
                  await storage.createUser({
                      name: "House Director Sigma Chi",
                      email: hdSigmaEmail,
                      password: testPassword,
                      role: "house_director",
                      fraternity: "Sigma Chi"
                  } as any);
              }
          }
          console.log("Seeding complete. Admin: chefzak@rebelchefs.net / Drum14me!!");
      } catch (err) {
          console.error("Seeding failed:", err);
      }
  })();

  return httpServer;
}
