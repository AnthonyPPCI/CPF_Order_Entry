import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage, pricingConfigStorage } from "./storage";
import { insertOrderSchema, insertOrderHeaderSchema, insertOrderItemSchema } from "@shared/schema";
import { calculatePricing, calculateMultiItemPricing } from "./pricing";
import { z } from "zod";
import { Resend } from "resend";
import { generateOrderPDF } from "./pdf-generator";
import { SquareClient, SquareEnvironment } from "square";
import { randomUUID, createHash } from "crypto";
import { syncOrderToShipStation, syncMultiItemOrderToShipStation } from "./shipstation";

// Initialize Resend for email sending
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

// Initialize Square client
const squareClient = process.env.SQUARE_ACCESS_TOKEN ? new SquareClient({
  accessToken: process.env.SQUARE_ACCESS_TOKEN,
  environment: process.env.SQUARE_ACCESS_TOKEN?.startsWith('EAAA') ? SquareEnvironment.Production : SquareEnvironment.Sandbox,
}) : null;

// Helper function to clean empty strings from numeric/text fields
function cleanEmptyFields(data: any): any {
  const cleaned = { ...data };
  
  // Convert empty strings to null for all fields (PostgreSQL prefers null over empty strings for optional fields)
  for (const key in cleaned) {
    if (cleaned[key] === '') {
      cleaned[key] = null;
    }
  }
  
  return cleaned;
}

// Helper function to generate next sequential order number
async function generateNextOrderNumber(): Promise<string> {
  // Get the highest order number from both tables
  const ordersMax = await storage.getMaxOrderNumber();
  const headersMax = await storage.getMaxOrderHeaderNumber();
  
  // Extract the numeric part from both
  const ordersNum = ordersMax ? parseInt(ordersMax.replace('Store_', '')) : 0;
  const headersNum = headersMax ? parseInt(headersMax.replace('Store_', '')) : 0;
  
  // Get the highest number from both tables
  const maxNum = Math.max(ordersNum, headersNum);
  
  // Generate next number with padding
  const nextNum = maxNum + 1;
  return `Store_${String(nextNum).padStart(5, '0')}`;
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Send Google Review request
  app.post("/api/send-review-request", async (req, res) => {
    try {
      console.log('[Google Reviews] Received review request:', { customerName: req.body.customerName, email: req.body.email, phone: req.body.phone, smsConsent: req.body.smsConsent });
      
      const { customerName, email, phone, smsConsent } = req.body;

      if (!customerName) {
        console.log('[Google Reviews] Error: Customer name missing');
        return res.status(400).json({ error: "Customer name is required" });
      }

      if (!email && !phone) {
        console.log('[Google Reviews] Error: No contact info provided');
        return res.status(400).json({ error: "Either email or phone number is required" });
      }

      // Subscribe to SMS marketing if consent is given
      if (smsConsent && phone && process.env.KLAVIYO_API_KEY) {
        console.log(`[Google Reviews] SMS consent provided, subscribing ${phone} to Klaviyo SMS`);
        try {
          const { subscribeToKlaviyoSMS } = await import("./klaviyo.js");
          await subscribeToKlaviyoSMS(phone, customerName, email);
          console.log(`[Google Reviews] Successfully subscribed ${phone} to SMS marketing`);
        } catch (error: any) {
          console.error("[Google Reviews] Failed to subscribe to SMS:", error);
          // Don't fail the entire request if SMS subscription fails
        }
      }

      const reviewUrl = "https://g.page/r/CYWvDmYp3xKEEBM/review";
      const results = { email: null, sms: null };

      // Send email if provided
      if (email && resend) {
        console.log(`[Google Reviews] Sending email to: ${email}`);
        try {
          const emailResult = await resend.emails.send({
            from: "CustomPictureFrames.com <orders@custompictureframes.com>",
            to: email,
            subject: "We'd love your feedback!",
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2>Hi ${customerName}!</h2>
                <p>Thank you for choosing CustomPictureFrames.com for your framing needs!</p>
                <p>We hope you're happy with your order. If you have a moment, we'd greatly appreciate it if you could share your experience by leaving us a review on Google.</p>
                <p style="text-align: center; margin: 30px 0;">
                  <a href="${reviewUrl}" style="background-color: #4285f4; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block; font-weight: bold;">Leave a Review</a>
                </p>
                <p style="font-size: 14px; color: #666;">Your feedback helps us improve and helps other customers make informed decisions.</p>
                <p>Thank you for your support!</p>
                <p style="margin-top: 30px;">
                  <strong>CustomPictureFrames.com</strong><br>
                  6 Shirley Ave, Somerset, NJ 08873<br>
                  (800) 916-8770
                </p>
              </div>
            `,
          });
          console.log(`[Google Reviews] Email sent successfully to ${email}:`, emailResult);
          results.email = "sent";
        } catch (emailError: any) {
          console.error("[Google Reviews] Failed to send review request email:", emailError);
          results.email = "failed";
        }
      } else if (email && !resend) {
        console.log('[Google Reviews] Resend client not initialized - RESEND_API_KEY missing');
      }

      // Send SMS if phone provided and Klaviyo is configured
      if (phone && process.env.KLAVIYO_API_KEY) {
        console.log(`[Google Reviews] Sending SMS to: ${phone}`);
        try {
          const { sendGoogleReviewRequestViaSMS } = await import("./klaviyo.js");
          await sendGoogleReviewRequestViaSMS(phone, customerName, reviewUrl);
          console.log(`[Google Reviews] SMS sent successfully to ${phone}`);
          results.sms = "sent";
        } catch (smsError: any) {
          console.error("[Google Reviews] Failed to send review request SMS:", smsError);
          results.sms = "failed";
        }
      } else if (phone && !process.env.KLAVIYO_API_KEY) {
        console.log('[Google Reviews] Klaviyo not configured - KLAVIYO_API_KEY missing');
      }

      console.log('[Google Reviews] Final results:', results);
      
      // Build message based on what was actually sent
      let message = '';
      if (results.email === 'sent' && results.sms === 'sent') {
        message = 'Review request sent via email. SMS queued in Klaviyo (requires Flow setup to send automatically).';
      } else if (results.email === 'sent') {
        message = 'Review request sent via email.';
      } else if (results.sms === 'sent') {
        message = 'SMS queued in Klaviyo (requires Flow setup to send automatically).';
      } else {
        message = 'Review request processed.';
      }
      
      res.json({ 
        success: true, 
        results,
        message
      });
    } catch (error: any) {
      console.error("Error sending review request:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Create and send PayPal invoice
  app.post("/api/create-paypal-invoice", async (req, res) => {
    try {
      console.log('[PayPal Invoice] Starting invoice creation process');
      const { orderId, isMultiItem } = req.body;
      console.log(`[PayPal Invoice] Order ID: ${orderId}, Multi-item: ${isMultiItem}`);
      
      if (!orderId) {
        console.log('[PayPal Invoice] Error: Order ID missing');
        return res.status(400).json({ error: "Order ID is required" });
      }

      const { createPayPalInvoice, sendPayPalInvoice } = await import("./paypal.js");
      let order;
      let items: any[] = [];

      if (isMultiItem) {
        // Fetch multi-item order
        const orderHeader = await storage.getOrderHeaderById(orderId);
        if (!orderHeader) {
          return res.status(404).json({ error: "Order not found" });
        }
        order = orderHeader;
        
        // Build items array from order items
        const orderItems = await storage.getOrderItemsByHeaderId(orderId);
        items = orderItems.map((item, index) => ({
          name: `Item #${index + 1}: ${item.frameSku || 'Frame'}`,
          description: `${item.width || 'N/A'} x ${item.height || 'N/A'}`,
          quantity: "1",
          unit_amount: {
            currency_code: "USD",
            value: item.itemTotal || "0.00",
          },
        }));
        
        // Add shipping
        if (parseFloat(orderHeader.shipping) > 0) {
          items.push({
            name: "Shipping",
            quantity: "1",
            unit_amount: {
              currency_code: "USD",
              value: orderHeader.shipping,
            },
          });
        }
        
        // Add sales tax
        if (orderHeader.salesTax && parseFloat(orderHeader.salesTax) > 0) {
          items.push({
            name: "Sales Tax",
            quantity: "1",
            unit_amount: {
              currency_code: "USD",
              value: orderHeader.salesTax,
            },
          });
        }
      } else {
        // Fetch single-item order
        order = await storage.getOrderById(orderId);
        if (!order) {
          return res.status(404).json({ error: "Order not found" });
        }
        
        // Build items array
        items.push({
          name: `Frame: ${order.frameSku || 'Custom Frame'}`,
          description: `${order.width || 'N/A'} x ${order.height || 'N/A'}`,
          quantity: order.quantity?.toString() || "1",
          unit_amount: {
            currency_code: "USD",
            value: order.itemTotal,
          },
        });
        
        // Add shipping
        if (parseFloat(order.shipping) > 0) {
          items.push({
            name: "Shipping",
            quantity: "1",
            unit_amount: {
              currency_code: "USD",
              value: order.shipping,
            },
          });
        }
        
        // Add sales tax
        if (order.salesTax && parseFloat(order.salesTax) > 0) {
          items.push({
            name: "Sales Tax",
            quantity: "1",
            unit_amount: {
              currency_code: "USD",
              value: order.salesTax,
            },
          });
        }
      }

      // Validate customer email
      if (!order.email) {
        console.log('[PayPal Invoice] Error: Customer email missing');
        return res.status(400).json({ error: "Customer email is required to send PayPal invoice" });
      }
      
      console.log(`[PayPal Invoice] Creating invoice for customer: ${order.email}`);
      console.log(`[PayPal Invoice] Invoice items:`, JSON.stringify(items, null, 2));

      // Create invoice
      console.log('[PayPal Invoice] Calling createPayPalInvoice...');
      const invoice = await createPayPalInvoice(order, items);
      console.log(`[PayPal Invoice] Invoice created successfully with ID: ${invoice.id}`);
      
      // Send invoice
      console.log(`[PayPal Invoice] Sending invoice ${invoice.id} to customer...`);
      await sendPayPalInvoice(invoice.id);
      console.log(`[PayPal Invoice] Invoice sent successfully`);
      
      // Get the payment URL from invoice links
      const paymentLink = invoice.links.find((link: any) => link.rel === "payer-view");
      console.log(`[PayPal Invoice] Payment link: ${paymentLink?.href || 'NOT FOUND'}`);
      
      // Update order with PayPal invoice info
      const updateData = {
        paypalInvoiceId: invoice.id,
        paypalInvoiceStatus: "SENT",
        paypalInvoiceUrl: paymentLink?.href,
        paymentMethod: "paypal" as const,
      };
      
      if (isMultiItem) {
        await storage.updateOrderHeader(orderId, updateData);
      } else {
        await storage.updateOrder(orderId, updateData);
      }

      console.log(`[PayPal Invoice] Updating order with invoice details...`);
      res.json({ 
        success: true, 
        invoiceId: invoice.id,
        invoiceUrl: paymentLink?.href,
        message: "PayPal invoice created and sent successfully" 
      });
      console.log(`[PayPal Invoice] Process completed successfully`);
    } catch (error: any) {
      console.error("[PayPal Invoice] ERROR occurred:", error);
      console.error("[PayPal Invoice] Error message:", error.message);
      console.error("[PayPal Invoice] Error stack:", error.stack);
      res.status(500).json({ error: error.message });
    }
  });

  // PayPal webhook handler
  app.post("/api/webhooks/paypal", async (req, res) => {
    try {
      const { verifyWebhookSignature } = await import("./paypal.js");
      
      // Verify webhook signature for security
      const webhookId = process.env.PAYPAL_WEBHOOK_ID;
      if (!webhookId) {
        console.error("[PayPal Webhook] PAYPAL_WEBHOOK_ID not configured");
        return res.status(500).json({ error: "Webhook not configured" });
      }
      
      // Extract PayPal transmission headers (case-insensitive)
      const headers: Record<string, string> = {};
      for (const [key, value] of Object.entries(req.headers)) {
        if (typeof value === 'string') {
          headers[key.toLowerCase()] = value;
        }
      }
      
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
        const allOrders = await storage.listOrders();
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
        const allMultiOrders = await storage.listOrderHeaders();
        const multiOrder = allMultiOrders.find((o: any) => o.paypalInvoiceId === invoiceId);
        
        if (multiOrder) {
          const newPaidToDate = parseFloat(multiOrder.paidToDate || "0") + parseFloat(paidAmount);
          const newBalance = parseFloat(multiOrder.total) - newPaidToDate;
          
          await storage.updateOrderHeader(multiOrder.id, {
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

      res.json({ success: true, emailId: data.data?.id });
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

      const { orderId, amount, sourceId, verificationToken, buyerEmailAddress } = req.body;

      // Validate required fields (orderId is optional for pre-order payments)
      if (!amount || !sourceId) {
        return res.status(400).json({ error: "Missing required fields: amount, sourceId" });
      }

      // Get location ID (check both VITE_ prefixed and non-prefixed)
      const locationId = process.env.VITE_SQUARE_LOCATION_ID || process.env.SQUARE_LOCATION_ID;
      
      if (!locationId) {
        return res.status(500).json({ error: "Square Location ID not configured. Please add SQUARE_LOCATION_ID or VITE_SQUARE_LOCATION_ID." });
      }

      // Convert amount to cents (Square uses smallest currency unit)
      const amountInCents = Math.round(parseFloat(amount) * 100);

      const detectedEnvironment = process.env.SQUARE_ACCESS_TOKEN?.startsWith('EAAA') ? 'Production' : 'Sandbox';
      
      console.log('Square payment request:', {
        locationId,
        amount: amountInCents,
        hasVerificationToken: !!verificationToken,
        hasBuyerEmail: !!buyerEmailAddress,
        hasAccessToken: !!process.env.SQUARE_ACCESS_TOKEN,
        accessTokenPrefix: process.env.SQUARE_ACCESS_TOKEN?.substring(0, 10) + '...',
        detectedEnvironment,
      });

      // Build payment request with verification token for CVV verification
      const paymentRequest: any = {
        sourceId,
        idempotencyKey: randomUUID(),
        amountMoney: {
          amount: BigInt(amountInCents),
          currency: 'USD',
        },
        locationId,
        autocomplete: true, // Complete payment immediately
      };

      // Add verification token if provided (for CVV verification)
      if (verificationToken) {
        paymentRequest.verificationToken = verificationToken;
      }

      // Add buyer email if provided (helps with fraud prevention)
      if (buyerEmailAddress) {
        paymentRequest.buyerEmailAddress = buyerEmailAddress;
      }

      console.log('Calling Square Payments API with request:', JSON.stringify({
        ...paymentRequest,
        amountMoney: { amount: amountInCents.toString(), currency: 'USD' },
        sourceId: sourceId.substring(0, 10) + '...',
        verificationToken: verificationToken ? verificationToken.substring(0, 10) + '...' : undefined,
      }, null, 2));

      // Create payment using Square API (v43+ syntax)
      const response = await squareClient.payments.createPayment(paymentRequest);

      console.log('Square API response status:', response.statusCode);
      console.log('Square API response:', JSON.stringify(response.result, null, 2));

      if (response.result?.payment?.status === 'COMPLETED') {
        // If orderId provided, fetch the order to update balance
        if (orderId) {
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
            
            res.json({ 
              success: true, 
              paymentId: response.result.payment.id,
              newBalance: newBalance.toFixed(2),
              status: 'COMPLETED'
            });
          } else {
            res.status(404).json({ error: "Order not found" });
          }
        } else {
          // Pre-order payment (no order ID yet)
          res.json({ 
            success: true, 
            paymentId: response.result.payment.id,
            amount: amount,
            status: 'COMPLETED'
          });
        }
      } else {
        const paymentStatus = response.result?.payment?.status || 'FAILED';
        res.status(400).json({ 
          error: "Payment declined or failed", 
          status: paymentStatus,
          success: false
        });
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
      
      // Merge validated data with calculated pricing and clean empty strings
      const orderData = cleanEmptyFields({
        ...validatedData,
        ...pricing,
      });
      
      const order = await storage.createOrder(orderData);
      
      // Sync to ShipStation if requested
      if (validatedData.syncToShipstation) {
        try {
          await syncOrderToShipStation(order);
          console.log(`[ShipStation] Successfully synced order ${order.id} to ShipStation`);
        } catch (shipStationError: any) {
          console.error(`[ShipStation] Failed to sync order ${order.id}:`, shipStationError.message);
          // Don't fail the order creation if ShipStation sync fails
          // Just log the error and continue
        }
      }
      
      res.status(201).json(order);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation error", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create order" });
    }
  });

  // Create order with optional payment processing
  app.post("/api/orders-with-payment", async (req, res) => {
    try {
      const { orderData, paymentData } = req.body;
      
      // Validate order data
      const validatedData = insertOrderSchema.parse(orderData);
      
      // Calculate pricing server-side
      const pricing = calculatePricing(validatedData);
      
      // Preserve payment fields from original orderData (validation strips these out)
      const paymentFields: any = {};
      if (orderData.paidToDate) {
        paymentFields.paidToDate = orderData.paidToDate;
      }
      if (orderData.paymentMethod) {
        paymentFields.paymentMethod = orderData.paymentMethod;
      }
      
      // Generate sequential order number
      const orderNumber = await generateNextOrderNumber();
      
      // Merge pricing with validated data, then add payment fields and order number
      const completeOrderData = cleanEmptyFields({
        ...pricing,
        ...validatedData,
        ...paymentFields,  // Add payment fields last to ensure they're preserved
        orderNumber,  // Add generated order number
      });
      
      // Create the order first
      const order = await storage.createOrder(completeOrderData);
      
      // Sync customer to Klaviyo
      try {
        const { addCustomerToKlaviyo } = await import("./klaviyo.js");
        await addCustomerToKlaviyo(order);
      } catch (klaviyoError: any) {
        console.error(`[Klaviyo] Failed to sync customer:`, klaviyoError.message);
        // Don't fail the order creation if Klaviyo sync fails
      }
      
      // Sync to ShipStation if requested (but skip for PayPal - sync after payment)
      const isPayPalOrder = validatedData.paymentMethod === "paypal";
      console.log(`[ShipStation] Order ${order.id} syncToShipstation flag: ${validatedData.syncToShipstation}, payment method: ${validatedData.paymentMethod}`);
      
      if (validatedData.syncToShipstation && !isPayPalOrder) {
        try {
          console.log(`[ShipStation] Starting sync for order ${order.id}...`);
          await syncOrderToShipStation(order);
          console.log(`[ShipStation] Successfully synced order ${order.id} to ShipStation`);
        } catch (shipStationError: any) {
          console.error(`[ShipStation] Failed to sync order ${order.id}:`, shipStationError.message);
          // Don't fail the order creation if ShipStation sync fails
        }
      } else if (isPayPalOrder && validatedData.syncToShipstation) {
        console.log(`[ShipStation] Deferring sync for PayPal order ${order.id} until payment confirmed`);
      }
      
      // If payment info provided, process or record the payment
      if (paymentData && paymentData.amount) {
        try {
          // Check if payment is already charged (pre-charged before order creation)
          if (paymentData.paymentId && paymentData.status === 'charged') {
            // Payment already charged - just update paidToDate and balance
            console.log(`[Payment] Using pre-charged payment ${paymentData.paymentId} for order ${order.id}`);
            const paidAmount = parseFloat(paymentData.amount);
            const currentPaid = parseFloat(order.paidToDate);
            const newPaidToDate = (currentPaid + paidAmount).toFixed(2);
            const newBalance = Math.max(0, parseFloat(order.total) - parseFloat(newPaidToDate)).toFixed(2);
            
            const updatedOrder = await storage.updateOrder(order.id, { 
              paidToDate: newPaidToDate,
              balance: newBalance 
            });
            
            return res.status(201).json(updatedOrder);
          }
          
          // Legacy flow: charge the card now (shouldn't happen with new flow, but kept for compatibility)
          if (paymentData.sourceId) {
            if (!squareClient) {
              throw new Error("Square payment not configured");
            }

            const locationId = process.env.VITE_SQUARE_LOCATION_ID || process.env.SQUARE_LOCATION_ID;
            if (!locationId) {
              throw new Error("Square Location ID not configured");
            }

            // Convert amount to cents
            const amountInCents = Math.round(parseFloat(paymentData.amount) * 100);

            // Create payment using Square API
            const response = await squareClient.payments.create({
              sourceId: paymentData.sourceId,
              idempotencyKey: randomUUID(),
              amountMoney: {
                amount: BigInt(amountInCents),
                currency: 'USD',
              },
              locationId,
            });

            if (response.result?.payment?.status === 'COMPLETED') {
              // Update paidToDate and balance
              const paidAmount = parseFloat(paymentData.amount);
              const currentPaid = parseFloat(order.paidToDate);
              const newPaidToDate = (currentPaid + paidAmount).toFixed(2);
              const newBalance = Math.max(0, parseFloat(order.total) - parseFloat(newPaidToDate)).toFixed(2);
              
              const updatedOrder = await storage.updateOrder(order.id, { 
                paidToDate: newPaidToDate,
                balance: newBalance 
              });
              
              // Return just the order for consistency with cash/no payment responses
              return res.status(201).json(updatedOrder);
            } else {
              // Payment failed - rollback order creation
              await storage.deleteOrder(order.id);
              return res.status(400).json({ 
                error: "Payment failed", 
                status: response.result?.payment?.status,
                orderRolledBack: true
              });
            }
          }
        } catch (paymentError: any) {
          // Payment processing failed - rollback order creation
          await storage.deleteOrder(order.id);
          console.error('Payment processing error:', paymentError);
          return res.status(500).json({ 
            error: "Payment processing failed", 
            details: paymentError.message,
            orderRolledBack: true
          });
        }
      }
      
      // No payment requested - return the order (cash payment or no payment)
      // If it's a cash payment, paidToDate and paymentMethod are already in the order
      res.status(201).json(order);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation error", details: error.errors });
      }
      console.error('Order creation error:', error);
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
      
      // Merge header data with calculated pricing and clean empty strings
      const headerData = cleanEmptyFields({
        ...validatedHeader,
        shipping: pricing.shipping,
        salesTax: pricing.salesTax,
        total: pricing.total,
        balance: pricing.balance,
      });
      
      // Merge items with their calculated pricing and item numbers, clean empty strings
      const itemsData = validatedItems.map((item, index) => cleanEmptyFields({
        ...item,
        itemNumber: index + 1,
        itemTotal: pricing.items[index].itemTotal,
      }));
      
      const order = await storage.createMultiItemOrder(headerData, itemsData);
      
      // Sync customer to Klaviyo
      try {
        const { addCustomerToKlaviyo } = await import("./klaviyo.js");
        await addCustomerToKlaviyo(order);
      } catch (klaviyoError: any) {
        console.error(`[Klaviyo] Failed to sync customer:`, klaviyoError.message);
        // Don't fail the order creation if Klaviyo sync fails
      }
      
      // Sync to ShipStation if requested (but skip for PayPal - sync after payment)
      const isPayPalOrder = validatedHeader.paymentMethod === "paypal";
      console.log(`[ShipStation] Multi-item order ${order.id} syncToShipstation flag: ${validatedHeader.syncToShipstation}, payment method: ${validatedHeader.paymentMethod}`);
      
      if (validatedHeader.syncToShipstation && !isPayPalOrder) {
        try {
          console.log(`[ShipStation] Starting sync for multi-item order ${order.id}...`);
          await syncMultiItemOrderToShipStation(order, order.items);
          console.log(`[ShipStation] Successfully synced multi-item order ${order.id} to ShipStation`);
        } catch (shipStationError: any) {
          console.error(`[ShipStation] Failed to sync multi-item order ${order.id}:`, shipStationError.message);
          // Don't fail the order creation if ShipStation sync fails
        }
      } else if (isPayPalOrder && validatedHeader.syncToShipstation) {
        console.log(`[ShipStation] Deferring sync for PayPal multi-order ${order.id} until payment confirmed`);
      }
      
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

  // Delete single-item order (password protected)
  app.delete("/api/orders/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const { password } = req.body;
      
      // Verify password: "2026DOG"
      const expectedHash = createHash('sha256').update('2026DOG').digest('hex');
      const providedHash = createHash('sha256').update(password || '').digest('hex');
      
      if (providedHash !== expectedHash) {
        return res.status(403).json({ error: "Invalid password" });
      }
      
      const deleted = await storage.deleteOrder(id);
      if (deleted) {
        res.json({ success: true });
      } else {
        res.status(404).json({ error: "Order not found" });
      }
    } catch (error) {
      console.error("Delete order error:", error);
      res.status(500).json({ error: "Failed to delete order" });
    }
  });

  // Delete multi-item order (password protected)
  app.delete("/api/multi-orders/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const { password } = req.body;
      
      const expectedHash = createHash('sha256').update('2026DOG').digest('hex');
      const providedHash = createHash('sha256').update(password || '').digest('hex');
      
      if (providedHash !== expectedHash) {
        return res.status(403).json({ error: "Invalid password" });
      }
      
      const deleted = await storage.deleteMultiItemOrder(id);
      if (deleted) {
        res.json({ success: true });
      } else {
        res.status(404).json({ error: "Order not found" });
      }
    } catch (error) {
      console.error("Delete multi-item order error:", error);
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
