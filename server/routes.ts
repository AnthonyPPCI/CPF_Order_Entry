import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage, pricingConfigStorage } from "./storage";
import { insertOrderSchema, insertOrderHeaderSchema, insertOrderItemSchema } from "@shared/schema";
import { calculatePricing, calculateMultiItemPricing } from "./pricing";
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
      console.error("Pricing calculation error:", error);
      res.status(500).json({ error: "Failed to calculate pricing", details: error instanceof Error ? error.message : String(error) });
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
      const mouldings = Array.from(data.mouldings.entries()).map(([sku, mouldingData]) => mouldingData);
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
      const supplies = Array.from(data.supplies.entries()).map(([sku, supplyData]) => supplyData);
      res.json(supplies);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch supply data" });
    }
  });

  // Get all supplies for mat autocomplete (return all since mat items aren't specifically labeled)
  app.get("/api/supplies", async (req, res) => {
    try {
      const { loadPricingData } = await import("./pricing-data");
      const data = loadPricingData();
      const supplies = Array.from(data.supplies.entries()).map(([sku, supplyData]) => supplyData);
      res.json(supplies);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch supplies" });
    }
  });

  // Multi-item Order Routes
  
  // Get all multi-item orders
  app.get("/api/multi-orders", async (req, res) => {
    try {
      const orders = await storage.getAllMultiItemOrders();
      res.json(orders);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch orders" });
    }
  });

  // Get single multi-item order by ID
  app.get("/api/multi-orders/:id", async (req, res) => {
    try {
      const order = await storage.getMultiItemOrderById(req.params.id);
      if (!order) {
        return res.status(404).json({ error: "Order not found" });
      }
      res.json(order);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch order" });
    }
  });

  // Create new multi-item order
  app.post("/api/multi-orders", async (req, res) => {
    try {
      const { header, items } = req.body;
      
      // Validate header and items
      const validatedHeader = insertOrderHeaderSchema.parse(header);
      const validatedItems = z.array(insertOrderItemSchema).parse(items);
      
      // Calculate multi-item pricing server-side
      const pricing = calculateMultiItemPricing({
        items: validatedItems,
        customerAddress: {
          cityStateZip: validatedHeader.cityStateZip || undefined,
        },
        deliveryMethod: validatedHeader.deliveryMethod,
        discount: validatedHeader.discount || undefined,
        deposit: validatedHeader.deposit || undefined,
      });
      
      // Merge header data with calculated pricing
      const headerData = {
        ...validatedHeader,
        shipping: pricing.shipping,
        salesTax: pricing.salesTax,
        total: pricing.total,
        balance: pricing.balance,
      };
      
      // Merge items with their calculated pricing
      const itemsData = validatedItems.map((item, index) => ({
        ...item,
        itemTotal: pricing.items[index].itemTotal,
      }));
      
      const order = await storage.createMultiItemOrder(headerData, itemsData);
      res.status(201).json(order);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation error", details: error.errors });
      }
      console.error("Create multi-item order error:", error);
      res.status(500).json({ error: "Failed to create order" });
    }
  });

  // Update multi-item order
  app.patch("/api/multi-orders/:id", async (req, res) => {
    try {
      const { header, items } = req.body;
      
      // Validate header (partial) and items if provided
      const partialHeaderSchema = insertOrderHeaderSchema.partial();
      const validatedHeader = header ? partialHeaderSchema.parse(header) : {};
      const validatedItems = items ? z.array(insertOrderItemSchema).parse(items) : undefined;
      
      // Fetch existing order to merge with updates
      const existingOrder = await storage.getMultiItemOrderById(req.params.id);
      if (!existingOrder) {
        return res.status(404).json({ error: "Order not found" });
      }
      
      // Merge existing header with updates
      const mergedHeader = {
        ...existingOrder,
        ...validatedHeader,
      };
      
      // Use updated items or existing items for pricing calculation
      const itemsForPricing = validatedItems || existingOrder.items;
      
      // Recalculate pricing with complete order data
      const pricing = calculateMultiItemPricing({
        items: itemsForPricing,
        customerAddress: {
          cityStateZip: mergedHeader.cityStateZip || undefined,
        },
        deliveryMethod: mergedHeader.deliveryMethod,
        discount: mergedHeader.discount || undefined,
        deposit: mergedHeader.deposit || undefined,
      });
      
      // Prepare updated header with recalculated pricing
      const headerData = {
        ...validatedHeader,
        shipping: pricing.shipping,
        salesTax: pricing.salesTax,
        total: pricing.total,
        balance: pricing.balance,
      };
      
      // Prepare updated items with recalculated pricing (if items were provided)
      const itemsData = validatedItems ? validatedItems.map((item, index) => ({
        ...item,
        itemTotal: pricing.items[index].itemTotal,
      })) : undefined;
      
      const order = await storage.updateMultiItemOrder(req.params.id, headerData, itemsData);
      if (!order) {
        return res.status(404).json({ error: "Order not found" });
      }
      res.json(order);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation error", details: error.errors });
      }
      console.error("Update multi-item order error:", error);
      res.status(500).json({ error: "Failed to update order" });
    }
  });

  // Delete multi-item order
  app.delete("/api/multi-orders/:id", async (req, res) => {
    try {
      const success = await storage.deleteMultiItemOrder(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "Order not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete order" });
    }
  });

  // Calculate multi-item pricing preview (without saving order)
  app.post("/api/multi-pricing", async (req, res) => {
    try {
      const { items, customerAddress, deliveryMethod, discount, deposit } = req.body;
      const pricing = calculateMultiItemPricing({
        items,
        customerAddress,
        deliveryMethod,
        discount,
        deposit,
      });
      res.json(pricing);
    } catch (error) {
      console.error("Multi-item pricing calculation error:", error);
      res.status(500).json({ error: "Failed to calculate pricing", details: error instanceof Error ? error.message : String(error) });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
