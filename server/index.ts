import express, { type Request, Response, NextFunction } from "express";
import { setupAuth, requireAuth } from "./auth";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";

const app = express();

// Trust proxy for secure cookies (required for session sharing across subdomains)
app.set("trust proxy", 1);

declare module 'http' {
  interface IncomingMessage {
    rawBody: unknown
  }
}

// Parse JSON and URL-encoded bodies
app.use(express.json({
  verify: (req, _res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: false }));

// CRITICAL: Setup authentication BEFORE registering routes
setupAuth(app);

// Register webhook routes BEFORE global authentication middleware
// (webhooks must be publicly accessible for external services)
app.post("/api/webhooks/paypal", async (req, res) => {
  try {
    const { verifyWebhookSignature } = await import("./paypal.js");
    
    // Verify webhook signature for security
    const webhookId = process.env.PAYPAL_WEBHOOK_ID;
    if (!webhookId) {
      console.error("[PayPal Webhook] PAYPAL_WEBHOOK_ID not configured");
      return res.status(500).json({ error: "Webhook not configured" });
    }
    
    const headers = {
      'paypal-transmission-id': req.headers['paypal-transmission-id'] as string,
      'paypal-transmission-time': req.headers['paypal-transmission-time'] as string,
      'paypal-transmission-sig': req.headers['paypal-transmission-sig'] as string,
      'paypal-cert-url': req.headers['paypal-cert-url'] as string,
      'paypal-auth-algo': req.headers['paypal-auth-algo'] as string,
    };
    
    // Verify the webhook signature
    const isValid = await verifyWebhookSignature(webhookId, headers, req.body);
    if (!isValid) {
      console.error("[PayPal Webhook] SECURITY ALERT: Invalid webhook signature detected");
      console.error(`[PayPal Webhook] Transmission ID:`, headers['paypal-transmission-id']);
      return res.status(401).json({ error: "Invalid signature" });
    }
    
    const { event_type, resource } = req.body;
    
    console.log(`[PayPal Webhook] Verified event: ${event_type}`);
    
    // Handle invoice paid event
    if (event_type === "INVOICING.INVOICE.PAID") {
      const invoiceId = resource.id;
      const paidAmount = resource.amount?.value || resource.payments?.paid_amount?.value || "0";
      
      // Find order with this invoice ID
      const { storage } = await import("./storage.js");
      const { syncOrderToShipStation, syncMultiItemOrderToShipStation } = await import("./shipstation.js");
      
      const allOrders = await storage.getAllOrders();
      const order = allOrders.find((o: any) => o.paypalInvoiceId === invoiceId);
      
      if (order) {
        // Update order payment status
        const newPaidToDate = parseFloat(order.paidToDate || "0") + parseFloat(paidAmount);
        const newBalance = parseFloat(order.total) - newPaidToDate;
        
        await storage.updateOrder(order.id, {
          paypalInvoiceStatus: "PAID",
          paidToDate: newPaidToDate.toFixed(2),
          balance: Math.max(0, newBalance).toFixed(2),
        });
        
        console.log(`[PayPal Webhook] Updated order ${order.id} - Paid: $${paidAmount}`);
        
        // Now sync to ShipStation if it was deferred during order creation
        if (order.syncToShipstation) {
          try {
            console.log(`[ShipStation] PayPal payment confirmed, syncing order ${order.id} to ShipStation...`);
            await syncOrderToShipStation(order);
            console.log(`[ShipStation] Successfully synced PayPal order ${order.id} to ShipStation`);
          } catch (shipStationError: any) {
            console.error(`[ShipStation] Failed to sync PayPal order ${order.id}:`, shipStationError.message);
            // Don't fail the webhook processing if ShipStation sync fails
          }
        }
      }
      
      // Check multi-item orders
      const allMultiOrders = await storage.getAllMultiItemOrders();
      const multiOrder = allMultiOrders.find((o: any) => o.paypalInvoiceId === invoiceId);
      
      if (multiOrder) {
        const newPaidToDate = parseFloat(multiOrder.paidToDate || "0") + parseFloat(paidAmount);
        const newBalance = parseFloat(multiOrder.total) - newPaidToDate;
        
        await storage.updateMultiItemOrder(multiOrder.id, {
          paypalInvoiceStatus: "PAID",
          paidToDate: newPaidToDate.toFixed(2),
          balance: Math.max(0, newBalance).toFixed(2),
        });
        
        console.log(`[PayPal Webhook] Updated multi-order ${multiOrder.id} - Paid: $${paidAmount}`);
        
        // Now sync to ShipStation if it was deferred during order creation
        if (multiOrder.syncToShipstation) {
          try {
            console.log(`[ShipStation] PayPal payment confirmed, syncing multi-order ${multiOrder.id} to ShipStation...`);
            await syncMultiItemOrderToShipStation(multiOrder, multiOrder.items);
            console.log(`[ShipStation] Successfully synced PayPal multi-order ${multiOrder.id} to ShipStation`);
          } catch (shipStationError: any) {
            console.error(`[ShipStation] Failed to sync PayPal multi-order ${multiOrder.id}:`, shipStationError.message);
            // Don't fail the webhook processing if ShipStation sync fails
          }
        }
      }
    }
    
    // Acknowledge webhook
    res.status(200).send();
  } catch (error: any) {
    console.error("[PayPal Webhook] Error processing webhook:", error);
    res.status(500).json({ error: error.message });
  }
});

// Protect all API routes with authentication (except webhooks registered above)
app.use('/api', requireAuth);

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
  });
})();
