import passport from 'passport';
import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import { type RequestHandler, type Express } from 'express';
import { db } from './db';
import { users, type SelectUser } from '@shared/schema';
import { eq } from 'drizzle-orm';

// Extend Express User type
declare global {
  namespace Express {
    interface User extends SelectUser {}
  }
}

/**
 * Setup authentication middleware for the Express app
 * This configures session handling and Passport integration
 */
export function setupAuth(app: Express) {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 7 days
  const PgSession = connectPgSimple(session);
  
  const sessionStore = new PgSession({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: false,
    ttl: sessionTtl / 1000, // Convert to seconds for pg-session
    tableName: "sessions",
  });
  
  app.use(session({
    secret: process.env.SESSION_SECRET!,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      domain: process.env.NODE_ENV === "production" ? ".framesbox.com" : undefined,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: sessionTtl,
    },
  }));
  
  app.use(passport.initialize());
  app.use(passport.session());
  
  // Deserialize user from shared session
  passport.deserializeUser(async (id: string, done) => {
    try {
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, id))
        .limit(1);

      if (!user) {
        return done(null, false);
      }

      // Check if user is active
      if (!user.active) {
        return done(null, false);
      }

      done(null, user);
    } catch (error) {
      done(error, false);
    }
  });
  
  passport.serializeUser((user: any, done) => {
    done(null, user.id);
  });
}

/**
 * Authentication middleware - requires user to be logged in
 * Returns 401 if not authenticated
 */
export const requireAuth: RequestHandler = (req, res, next) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ 
      message: "Please log in at https://framesbox.com to access Order Entry"
    });
  }
  
  const user = req.user as any;
  
  // Check if user is active
  if (!user.active) {
    return res.status(403).json({ 
      message: "Your account has been deactivated. Contact your administrator." 
    });
  }
  
  next();
};

/**
 * Authorization middleware - requires user to have order_entry permission
 * Returns 403 if authenticated but lacks permission
 */
export const requireOrderEntryAccess: RequestHandler = (req, res, next) => {
  const user = req.user as SelectUser;

  // Super admins and admins have access to all apps
  if (user.role === 'super_admin' || user.role === 'admin') {
    return next();
  }

  // Check if user has order_entry in their accessibleApps array
  if (!user.accessibleApps?.includes('order_entry')) {
    return res.status(403).json({
      message: "You don't have access to Order Entry. Contact your administrator for access.",
    });
  }

  next();
};

/**
 * Combined middleware - checks both authentication and authorization
 * Use this on all protected routes
 */
export const protect: RequestHandler[] = [requireAuth, requireOrderEntryAccess];

export default passport;
