import passport from 'passport';
import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import { type RequestHandler, type Express } from 'express';
import { db } from './db';
import { users, type SelectUser } from '@shared/schema';
import { eq } from 'drizzle-orm';

// Session user type (excludes password for security)
export type SessionUser = Omit<SelectUser, 'password'>;

// Extend Express User type
declare global {
  namespace Express {
    interface User extends SessionUser {}
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
      // Explicitly select only the columns we need (exclude password for security)
      const [user] = await db
        .select({
          id: users.id,
          email: users.email,
          role: users.role,
          accessibleApps: users.accessibleApps,
          active: users.active,
          requirePasswordChange: users.requirePasswordChange,
          createdAt: users.createdAt,
          updatedAt: users.updatedAt,
        })
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
 * Middleware to protect routes - checks authentication and authorization
 * Use this on all API routes
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
  
  // Super admin and admin roles have access to all apps
  if (user.role === 'super_admin' || user.role === 'admin') {
    return next();
  }
  
  // Check if user has order_entry permission
  if (!user.accessibleApps?.includes('order_entry')) {
    return res.status(403).json({ 
      message: "You don't have access to Order Entry. Contact your administrator for access." 
    });
  }
  
  next();
};

// Export protect as array for backward compatibility with existing routes
export const protect = [requireAuth];

export default passport;
