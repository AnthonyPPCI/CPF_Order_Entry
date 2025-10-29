import passport from 'passport';
import { type RequestHandler } from 'express';
import { db } from './db';
import { users, type SelectUser } from '@shared/schema';
import { eq } from 'drizzle-orm';

// Extend Express User type
declare global {
  namespace Express {
    interface User extends SelectUser {}
  }
}

// Configure Passport to deserialize users from session
// Note: User sessions are created by the main FrameBox platform
// This app only needs to deserialize the user from the session
passport.serializeUser((user, done) => {
  done(null, user.id);
});

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

/**
 * Authentication middleware - requires user to be logged in
 * Returns 401 if not authenticated
 */
export const requireAuth: RequestHandler = (req, res, next) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ 
      message: "Please log in at framebox.com",
      redirectUrl: process.env.NODE_ENV === 'production' 
        ? 'https://framebox.com/login'
        : 'http://localhost:3000/login'
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
      message: "You don't have access to Order Entry. Contact your administrator.",
      requiredPermission: 'order_entry',
      userRole: user.role
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
