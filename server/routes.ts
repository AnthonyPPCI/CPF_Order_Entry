import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage, pricingConfigStorage } from "./storage";
import { insertOrderSchema, insertOrderHeaderSchema, insertOrderItemSchema } from "@shared/schema";
import { calculatePricing, calculateMultiItemPricing } from "./pricing";
import { z } from "zod";
import { Resend } from "resend";
import { generateOrderPDF } from "./pdf-generator";
import { SquareClient, SquareEnvironment } from "square";
import { randomUUID } from "crypto";

// Initialize Resend for email sending
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

// Initialize Square client
const squareClient = process.env.SQUARE_ACCESS_TOKEN ? new SquareClient({
  bearerAuthCredentials: {
    accessToken: process.env.SQUARE_ACCESS_TOKEN,
  },
  environment: process.env.SQUARE_ACCESS_TOKEN?.startsWith('EAAAl') ? SquareEnvironment.Production : SquareEnvironment.Sandbox,
}) : null;

export async function registerRoutes(app: Express): Promise<Server> {
  // Send order email (to Brian or customer)
  app.post("/api/send-order-email", async (req, res) => {
    try {
      if (!resend) {
        return res.status(500).json({ error: "Email service not configured. Please add RESEND_API_KEY." });
      }

      const { 
        to, 
        subject, 
        orderId, 
        customerName, 
        isMultiItem, 
        itemsCount, 
        total, 
        balance, 
        orderUrl,
        isCustomer,
        orderData
      } = req.body;

      // Validate required fields
      if (!to || !subject || !orderId) {
        return res.status(400).json({ error: "Missing required fields: to, subject, orderId" });
      }

      let emailHtml = '';
      let emailText = '';
      let attachments: any[] = [];

      // Build customer email with beautiful formatting and PDF
      if (isCustomer && orderData) {
        // Generate PDF attachment
        const pdfBuffer = await generateOrderPDF({
          orderId,
          customerName,
          email: orderData.email,
          phone: orderData.phone,
          frameSku: orderData.frameSku,
          width: orderData.width,
          height: orderData.height,
          quantity: orderData.quantity,
          mat1Sku: orderData.mat1Sku,
          mat2Sku: orderData.mat2Sku,
          mat3Sku: orderData.mat3Sku,
          mat4Sku: orderData.mat4Sku,
          acrylic: orderData.acrylic,
          backing: orderData.backing,
          description: orderData.description,
          total,
          balance,
          orderDate: orderData.orderDate,
          isMultiItem,
          itemsCount,
          items: orderData.items
        });

        attachments.push({
          filename: `Order-${orderId}.pdf`,
          content: pdfBuffer,
        });

        // Beautiful HTML email for customer
        emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: #1a5490; color: white; padding: 30px 20px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background-color: #ffffff; padding: 30px; border: 1px solid #e0e0e0; border-top: none; }
    .total { background-color: #f5f5f5; padding: 15px; border-radius: 6px; margin: 20px 0; font-size: 18px; font-weight: 600; }
    .footer { margin-top: 30px; padding-top: 20px; border-top: 2px solid #e0e0e0; color: #666; font-size: 14px; text-align: center; }
    .footer a { color: #1a5490; text-decoration: none; }
  </style>
</head>
<body>
  <div class="header">
    <h1 style="margin: 0; font-size: 28px;">Custom Picture Frames</h1>
    <p style="margin: 10px 0 0 0; opacity: 0.9;">Your order is confirmed!</p>
  </div>
  <div class="content">
    <p>Hi ${customerName || 'there'},</p>
    
    <p>Your frame is officially in the works — thanks for choosing Custom Picture Frames!</p>
    
    <p>We've attached your order sheet as a PDF for your records. It outlines exactly what we'll be crafting for you.</p>
    
    <div class="total">
      • Order Total: $${total || 'N/A'}
    </div>
    
    <p>Every piece we build is custom-made with care, so you can expect the perfect fit for your artwork or keepsake.</p>
    
    <p>We'll send you a note as soon as your frame is ready for pickup. In the meantime, feel free to reach out if you have any questions or last-minute tweaks.</p>
    
    <p>Thanks again for trusting us with what you love most — we can't wait to see how it looks hanging on your wall!</p>
    
    <p style="margin-top: 30px;">Warmly,<br>
    <strong>The Custom Picture Frames Team</strong></p>
  </div>
  <div class="footer">
    <p><strong>6 Shirley Ave | Somerset, NJ | (800) 916-8770</strong></p>
    <p><a href="https://custompictureframes.com">CustomPictureFrames.com</a></p>
  </div>
</body>
</html>`;

        // Plain text version for email clients that don't support HTML
        emailText = [
          `Hi ${customerName || 'there'},`,
          "",
          "Your frame is officially in the works — thanks for choosing Custom Picture Frames!",
          "",
          "We've attached your order sheet as a PDF for your records. It outlines exactly what we'll be crafting for you.",
          "",
          `• Order Total: $${total || 'N/A'}`,
          "",
          "Every piece we build is custom-made with care, so you can expect the perfect fit for your artwork or keepsake.",
          "",
          "We'll send you a note as soon as your frame is ready for pickup. In the meantime, feel free to reach out if you have any questions or last-minute tweaks.",
          "",
          "Thanks again for trusting us with what you love most — we can't wait to see how it looks hanging on your wall!",
          "",
          "Warmly,",
          "The Custom Picture Frames Team",
          "6 Shirley Ave | Somerset, NJ | (800) 916-8770 | CustomPictureFrames.com"
        ].join('\n');
      } else {
        // Simple text email for Brian (internal)
        emailText = `Order Details:\n\n`;
        emailText += `Order #: ${orderId}\n`;
        emailText += `Customer: ${customerName || 'N/A'}\n`;
        
        if (isMultiItem) {
          emailText += `Items: ${itemsCount || 0}\n`;
        }
        
        emailText += `Total: $${total || '0.00'}\n`;
        emailText += `Balance Due: $${balance || '0.00'}\n\n`;
        emailText += `View order: ${orderUrl || 'N/A'}\n`;
      }

      // Send email using verified custom domain
      const emailOptions: any = {
        from: 'CustomPictureFrames <hello@custompictureframes.com>',
        to: [to],
        subject: subject,
        text: emailText,
      };

      if (emailHtml) {
        emailOptions.html = emailHtml;
      }

      if (attachments.length > 0) {
        emailOptions.attachments = attachments;
      }

      const data = await resend.emails.send(emailOptions);

      res.json({ success: true, emailId: data.id });
    } catch (error: any) {
      console.error('Email send error:', error);
      res.status(500).json({ error: "Failed to send email", details: error.message });
    }
  });

  // Process Square payment
  app.post("/api/process-payment", async (req, res) => {
    try {
      if (!squareClient) {
        return res.status(500).json({ error: "Square payment not configured. Please add SQUARE_ACCESS_TOKEN." });
      }

      const { orderId, amount, sourceId } = req.body;

      // Validate required fields
      if (!orderId || !amount || !sourceId) {
        return res.status(400).json({ error: "Missing required fields: orderId, amount, sourceId" });
      }

      // Convert amount to cents (Square uses smallest currency unit)
      const amountInCents = Math.round(parseFloat(amount) * 100);

      // Create payment using Square API
      const { result } = await squareClient.paymentsApi.createPayment({
        sourceId,
        idempotencyKey: randomUUID(),
        amountMoney: {
          amount: BigInt(amountInCents),
          currency: 'USD',
        },
        locationId: process.env.SQUARE_LOCATION_ID,
      });

      if (result.payment?.status === 'COMPLETED') {
        // Fetch the order to update balance
        let order = await storage.getOrderById(orderId);
        let isMultiItem = false;
        
        if (!order) {
          // Try multi-item order
          const multiOrder = await storage.getMultiItemOrderById(orderId);
          if (multiOrder) {
            order = multiOrder as any;
            isMultiItem = true;
          }
        }

        if (order) {
          const currentBalance = parseFloat(order.balance);
          const newBalance = Math.max(0, currentBalance - parseFloat(amount));
          
          // Update order balance
          const updateData = { balance: newBalance.toFixed(2) };
          
          if (isMultiItem) {
            await storage.updateMultiItemOrder(orderId, updateData);
          } else {
            await storage.updateOrder(orderId, updateData);
          }
        }

        res.json({ 
          success: true, 
          paymentId: result.payment.id,
          newBalance: order ? Math.max(0, parseFloat(order.balance) - parseFloat(amount)).toFixed(2) : '0.00'
        });
      } else {
        res.status(400).json({ error: "Payment failed", status: result.payment?.status });
      }
    } catch (error: any) {
      console.error('Square payment error:', error);
      res.status(500).json({ error: "Failed to process payment", details: error.message });
    }
  });

  // Get all orders (both single-item and multi-item)
  app.get("/api/orders", async (req, res) => {
    try {
      const singleOrders = await storage.getAllOrders();
      const multiOrders = await storage.getAllMultiItemOrders();
      
      // Merge both types into a single array
      // Multi-item orders have 'items' array, single-item orders don't
      const allOrders = [...singleOrders, ...multiOrders].sort((a, b) => {
        const dateA = new Date(a.orderDate).getTime();
        const dateB = new Date(b.orderDate).getTime();
        return dateB - dateA; // Most recent first
      });
      
      res.json(allOrders);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch orders" });
    }
  });

  // Get single order by ID
  app.get("/api/orders/:id", async (req, res) => {
    try {
      // Try to fetch from multi-item orders first
      const multiOrder = await storage.getMultiItemOrderById(req.params.id);
      if (multiOrder) {
        return res.json(multiOrder);
      }
      
      // Fall back to single-item orders
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

  // Margin Analysis Routes
  
  // Run scenario analysis
  app.post("/api/margin-analysis/scenarios", async (req, res) => {
    try {
      const { runScenarioAnalysis } = await import("./margin-analysis");
      const { laborConfig, businessMetrics } = req.body;
      
      const analysis = runScenarioAnalysis(laborConfig, businessMetrics);
      res.json(analysis);
    } catch (error) {
      console.error("Scenario analysis error:", error);
      res.status(500).json({ error: "Failed to run scenario analysis" });
    }
  });
  
  // Analyze margin for a specific order
  app.post("/api/margin-analysis/order", async (req, res) => {
    try {
      const { analyzeMargin } = await import("./margin-analysis");
      const { order, laborConfig, businessMetrics } = req.body;
      
      const analysis = analyzeMargin(order, laborConfig, businessMetrics);
      res.json(analysis);
    } catch (error) {
      console.error("Order margin analysis error:", error);
      res.status(500).json({ error: "Failed to analyze order margin" });
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
      // Add required fields to items for pricing calculation
      const itemsForPricing = validatedItems.map(item => ({
        ...item,
        deliveryMethod: validatedHeader.deliveryMethod || "shipping",
        cityStateZip: validatedHeader.cityStateZip || undefined,
      }));
      
      const pricing = calculateMultiItemPricing({
        items: itemsForPricing as any[],
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
      
      // Merge items with their calculated pricing and item numbers
      const itemsData = validatedItems.map((item, index) => ({
        ...item,
        itemNumber: index + 1,
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
      const itemsForPricing = (validatedItems || existingOrder.items).map(item => ({
        ...item,
        deliveryMethod: mergedHeader.deliveryMethod || "shipping",
        cityStateZip: mergedHeader.cityStateZip || undefined,
      }));
      
      // Recalculate pricing with complete order data
      const pricing = calculateMultiItemPricing({
        items: itemsForPricing as any[],
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
      
      // Prepare updated items with recalculated pricing and item numbers (if items were provided)
      const itemsData = validatedItems ? validatedItems.map((item, index) => ({
        ...item,
        itemNumber: index + 1,
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
