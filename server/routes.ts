import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage, pricingConfigStorage } from "./storage";
import { insertOrderSchema } from "@shared/schema";
import { calculatePricing } from "./pricing";
import { z } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {
  // Get all orders
  app.get("/api/orders", async (req, res) => {
    try {
      const orders = await storage.getAllOrders();
      res.json(orders);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch orders" });
    }
  });

  // Get single order by ID
  app.get("/api/orders/:id", async (req, res) => {
    try {
      const order = await storage.getOrderById(req.params.id);
      if (!order) {
        return res.status(404).json({ error: "Order not found" });
      }
      res.json(order);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch order" });
    }
  });

  // Create new order
  app.post("/api/orders", async (req, res) => {
    try {
      const validatedData = insertOrderSchema.parse(req.body);
      
      // Calculate pricing server-side
      const pricing = calculatePricing(validatedData);
      
      // Merge validated data with calculated pricing
      const orderData = {
        ...validatedData,
        ...pricing,
      };
      
      const order = await storage.createOrder(orderData);
      res.status(201).json(order);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation error", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create order" });
    }
  });

  // Update order
  app.patch("/api/orders/:id", async (req, res) => {
    try {
      const partialSchema = insertOrderSchema.partial();
      const validatedData = partialSchema.parse(req.body);
      
      // Fetch existing order to merge with updates
      const existingOrder = await storage.getOrderById(req.params.id);
      if (!existingOrder) {
        return res.status(404).json({ error: "Order not found" });
      }
      
      // Merge existing order data with updates for complete data
      const mergedData = {
        ...existingOrder,
        ...validatedData,
      };
      
      // Recalculate pricing with complete order data
      const pricing = calculatePricing(mergedData as any);
      
      const updateData = {
        ...validatedData,
        ...pricing,
      };
      
      const order = await storage.updateOrder(req.params.id, updateData);
      if (!order) {
        return res.status(404).json({ error: "Order not found" });
      }
      res.json(order);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation error", details: error.errors });
      }
      res.status(500).json({ error: "Failed to update order" });
    }
  });

  // Delete order
  app.delete("/api/orders/:id", async (req, res) => {
    try {
      const success = await storage.deleteOrder(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "Order not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete order" });
    }
  });

  // Calculate pricing preview (without saving order)
  app.post("/api/pricing", async (req, res) => {
    try {
      const pricing = calculatePricing(req.body);
      res.json(pricing);
    } catch (error) {
      res.status(500).json({ error: "Failed to calculate pricing" });
    }
  });

  // Control Panel APIs
  app.post("/api/control-panel/verify", async (req, res) => {
    try {
      const { password } = req.body;
      const isValid = pricingConfigStorage.verifyPassword(password);
      res.json({ valid: isValid });
    } catch (error) {
      res.status(500).json({ error: "Verification failed" });
    }
  });

  app.get("/api/control-panel/config", async (req, res) => {
    try {
      const config = pricingConfigStorage.getConfig();
      // Don't send the password hash to client
      const { passwordHash, ...safeConfig } = config;
      res.json(safeConfig);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch configuration" });
    }
  });

  app.post("/api/control-panel/config", async (req, res) => {
    try {
      const { password, ...updates } = req.body;
      
      // Verify password first
      if (!pricingConfigStorage.verifyPassword(password)) {
        return res.status(401).json({ error: "Invalid password" });
      }
      
      // Update configuration
      pricingConfigStorage.updateConfig(updates);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to update configuration" });
    }
  });

  // Get moulding data
  app.get("/api/control-panel/mouldings", async (req, res) => {
    try {
      const { loadPricingData } = await import("./pricing-data");
      const data = loadPricingData();
      const mouldings = Array.from(data.mouldings.entries()).map(([sku, mouldingData]) => ({
        sku,
        joinCost: mouldingData.joinCost,
        width: mouldingData.width,
      }));
      res.json(mouldings);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch moulding data" });
    }
  });

  // Get supply data
  app.get("/api/control-panel/supplies", async (req, res) => {
    try {
      const { loadPricingData } = await import("./pricing-data");
      const data = loadPricingData();
      const supplies = Array.from(data.supplies.entries()).map(([sku, supplyData]) => ({
        sku,
        price: supplyData.price,
      }));
      res.json(supplies);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch supply data" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
