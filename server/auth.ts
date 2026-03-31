import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express } from "express";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { storage } from "./storage";
import { FRATERNITIES, User } from "@shared/schema";
import { z } from "zod";

const scryptAsync = promisify(scrypt);
const supportedDomains = new Map<string, (typeof FRATERNITIES)[number]>([
  ["olemiss.edu", "Delta Tau Delta"],
  ["k-state.edu", "Sigma Chi"],
]);

const registerSchema = z.object({
  name: z.string().trim().min(2, "Full name is required"),
  email: z.string().trim().email("A valid school email is required"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

type PublicUser = Pick<User, "id" | "email" | "role" | "name" | "fraternity" | "phoneNumber">;

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

export function sanitizeUser(user: User): PublicUser {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    name: user.name,
    fraternity: user.fraternity,
    phoneNumber: user.phoneNumber,
  };
}

async function comparePasswords(supplied: string, stored: string) {
  if (!stored || !stored.includes(".")) {
    return false;
  }
  const [hashed, salt] = stored.split(".");
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  return timingSafeEqual(hashedBuf, suppliedBuf);
}

export function setupAuth(app: Express) {
  // Trust proxy for Replit's environment
  app.set("trust proxy", 1);

  const sessionSecret = process.env.SESSION_SECRET;
  if (!sessionSecret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("SESSION_SECRET must be set in production");
    }
    console.warn("[Auth] SESSION_SECRET is not set. Using an insecure development fallback.");
  }
  
  const sessionSettings: session.SessionOptions = {
    secret: sessionSecret || "development-only-session-secret",
    resave: false,
    saveUninitialized: false,
    store: storage.sessionStore,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      sameSite: "lax",
    },
  };

  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(
    new LocalStrategy(async (username, password, done) => {
      try {
        const user = await storage.getUserByEmail(username);
        if (!user || !(await comparePasswords(password, user.password))) {
          return done(null, false);
        } else {
          return done(null, user);
        }
      } catch (err) {
        return done(err);
      }
    }),
  );

  passport.serializeUser((user, done) => done(null, (user as User).id));
  passport.deserializeUser(async (id: number, done) => {
    try {
      const user = await storage.getUser(id);
      done(null, user);
    } catch (err) {
      done(err);
    }
  });

  app.post("/api/register", async (req, res, next) => {
    try {
      const parsed = registerSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.errors[0]?.message || "Invalid registration details" });
      }

      const email = parsed.data.email.toLowerCase();
      const emailDomain = email.split("@")[1];
      const fraternity = emailDomain ? supportedDomains.get(emailDomain) : undefined;

      if (!fraternity) {
        const supportedList = Array.from(supportedDomains.keys()).join(" or ");
        return res.status(400).json({ message: `Use a supported school email (${supportedList})` });
      }

      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({ message: "Email already exists" });
      }

      const hashedPassword = await hashPassword(parsed.data.password);
      const user = await storage.createUser({
        name: parsed.data.name,
        email,
        password: hashedPassword,
        fraternity,
        role: "user",
      });

      req.login(user, (err) => {
        if (err) return next(err);
        res.status(201).json(sanitizeUser(user));
      });
    } catch (err) {
      next(err);
    }
  });

  app.post("/api/login", passport.authenticate("local"), (req, res) => {
    // Explicitly save the session to ensure cookie is set
    req.session.save((err) => {
      if (err) {
        console.error("Session save error:", err);
        return res.status(500).send("Session error");
      }
      console.log(`[Login Success] Session ID: ${req.sessionID?.slice(0, 8)}, User: ${(req.user as any)?.email}`);
      res.status(200).json(sanitizeUser(req.user as User));
    });
  });

  app.post("/api/logout", (req, res, next) => {
    req.logout((err) => {
      if (err) return next(err);
      res.sendStatus(200);
    });
  });

  app.get("/api/user", (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    res.json(sanitizeUser(req.user as User));
  });
}
