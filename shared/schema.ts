import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, decimal, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Legacy single-item orders table (will be migrated to order_headers + order_items)
export const orders = pgTable("orders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orderDate: timestamp("order_date").notNull().defaultNow(),
  
  // Customer Information
  customerName: text("customer_name"),
  address1: text("address_1"),
  address2: text("address_2"),
  cityStateZip: text("city_state_zip"),
  phone: text("phone"),
  email: text("email"),
  smsConsent: boolean("sms_consent").notNull().default(false),
  
  // Order Details
  deliveryMethod: text("delivery_method").notNull().default("shipping"),
  pickupStatus: varchar("pickup_status").$type<"awaiting_pickup" | "picked_up" | null>(),
  description: text("description"),
  specialRequests: text("special_requests"),
  
  // Frame Details
  frameSku: text("frame_sku"),
  chopOnly: boolean("chop_only").notNull().default(false),
  sample: boolean("sample").notNull().default(false),
  stackerFrame: boolean("stacker_frame").notNull().default(false),
  shadowDepth: text("shadow_depth"),
  topperSku: text("topper_sku"),
  width: decimal("width"),
  height: decimal("height"),
  
  // Mat Configuration
  matBorderAll: text("mat_border_all"),
  matBorderLeft: text("mat_border_left"),
  matBorderRight: text("mat_border_right"),
  matBorderTop: text("mat_border_top"),
  matBorderBottom: text("mat_border_bottom"),
  
  mat1Sku: text("mat_1_sku"),
  mat1Reveal: text("mat_1_reveal"),
  mat2Sku: text("mat_2_sku"),
  mat2Reveal: text("mat_2_reveal"),
  mat3Sku: text("mat_3_sku"),
  extraMatOpenings: integer("extra_mat_openings").notNull().default(0),
  
  // Materials
  acrylicType: text("acrylic_type").notNull().default("Standard"),
  backingSku: text("backing_sku").default("White Foam"),
  
  // Print Options
  printPaper: boolean("print_paper").notNull().default(false),
  printPaperType: text("print_paper_type"),
  dryMount: boolean("dry_mount").notNull().default(false),
  
  printCanvas: boolean("print_canvas").notNull().default(false),
  printCanvasWrapStyle: text("print_canvas_wrap_style"),
  canvasStretching: boolean("canvas_stretching").notNull().default(false),
  
  // Additional Options
  engravedPlaque: boolean("engraved_plaque").notNull().default(false),
  engravedPlaqueSize: text("engraved_plaque_size"),
  engravedPlaqueColor: text("engraved_plaque_color"),
  engravedPlaqueFont: text("engraved_plaque_font"),
  engravedPlaqueText1: text("engraved_plaque_text_1"),
  engravedPlaqueText2: text("engraved_plaque_text_2"),
  engravedPlaqueText3: text("engraved_plaque_text_3"),
  engravedPlaqueTextAdditional: text("engraved_plaque_text_additional").array(),
  leds: boolean("leds").notNull().default(false),
  shadowboxFitting: boolean("shadowbox_fitting").notNull().default(false),
  additionalLabor: boolean("additional_labor").notNull().default(false),
  
  // Pricing
  quantity: integer("quantity").notNull().default(1),
  itemTotal: decimal("item_total", { precision: 10, scale: 2 }).notNull(),
  shipping: decimal("shipping", { precision: 10, scale: 2 }).notNull(),
  salesTax: decimal("sales_tax", { precision: 10, scale: 2 }),
  discount: text("discount"),
  total: decimal("total", { precision: 10, scale: 2 }).notNull(),
  deposit: text("deposit"),
  paidToDate: decimal("paid_to_date", { precision: 10, scale: 2 }).notNull().default("0"),
  balance: decimal("balance", { precision: 10, scale: 2 }).notNull(),
  paymentMethod: varchar("payment_method").$type<"credit_card" | "cash" | "paypal" | null>(),
  
  // PayPal Integration
  paypalInvoiceId: varchar("paypal_invoice_id"),
  paypalInvoiceStatus: varchar("paypal_invoice_status"),
  paypalInvoiceUrl: text("paypal_invoice_url"),
  
  // ShipStation Integration
  syncToShipstation: boolean("sync_to_shipstation").notNull().default(false),
  orderNumber: varchar("order_number").unique(),
});

export const insertOrderSchema = createInsertSchema(orders, {
  customerName: z.string().optional().or(z.literal("")),
  address1: z.string().optional().or(z.literal("")),
  cityStateZip: z.string().optional().or(z.literal("")),
  deliveryMethod: z.string().optional().default("shipping"),
  frameSku: z.string().optional().or(z.literal("")),
  width: z.coerce.number().optional().or(z.literal("" as any)),
  height: z.coerce.number().optional().or(z.literal("" as any)),
  quantity: z.coerce.number().optional().default(1),
  extraMatOpenings: z.coerce.number().optional().default(0),
  discount: z.string().optional().or(z.literal("")),
  deposit: z.string().optional().or(z.literal("")),
  matBorderAll: z.string().optional().or(z.literal("")),
  matBorderLeft: z.string().optional().or(z.literal("")),
  matBorderRight: z.string().optional().or(z.literal("")),
  matBorderTop: z.string().optional().or(z.literal("")),
  matBorderBottom: z.string().optional().or(z.literal("")),
  mat1Reveal: z.string().optional().or(z.literal("")),
  mat2Reveal: z.string().optional().or(z.literal("")),
  shadowDepth: z.string().optional().or(z.literal("")),
  topperSku: z.string().optional().or(z.literal("")),
  email: z.string().email().optional().or(z.literal("")),
}).omit({
  id: true,
  orderDate: true,
  itemTotal: true,
  shipping: true,
  total: true,
  paidToDate: true,
  balance: true,
  orderNumber: true,
});

export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type Order = typeof orders.$inferSelect;

// Moulding lookup table for frame pricing
export const moulding = pgTable("moulding", {
  sku: varchar("sku").primaryKey(),
  width: decimal("width").notNull(),
  joinCost: decimal("join_cost").notNull(),
});

export type Moulding = typeof moulding.$inferSelect;

// Supply lookup table for materials pricing
export const supply = pgTable("supply", {
  sku: varchar("sku").primaryKey(),
  name: text("name").notNull(),
  price: decimal("price").notNull(),
});

export type Supply = typeof supply.$inferSelect;

// Pricing configuration table
export const pricingConfig = pgTable("pricing_config", {
  key: varchar("key").primaryKey(),
  value: decimal("value").notNull(),
});

export type PricingConfig = typeof pricingConfig.$inferSelect;

// ============================================================================
// Multi-Item Order Tables (Normalized Schema)
// ============================================================================

// Order header - customer info, delivery, and order-level pricing
export const orderHeaders = pgTable("order_headers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orderDate: timestamp("order_date").notNull().defaultNow(),
  
  // Customer Information
  customerName: text("customer_name"),
  address1: text("address_1"),
  address2: text("address_2"),
  cityStateZip: text("city_state_zip"),
  phone: text("phone"),
  email: text("email"),
  smsConsent: boolean("sms_consent").notNull().default(false),
  
  // Delivery & Notes
  deliveryMethod: text("delivery_method").notNull().default("shipping"),
  pickupStatus: varchar("pickup_status").$type<"awaiting_pickup" | "picked_up" | null>(),
  description: text("description"),
  specialRequests: text("special_requests"),
  
  // Order-level Pricing
  shipping: decimal("shipping", { precision: 10, scale: 2 }).notNull(),
  salesTax: decimal("sales_tax", { precision: 10, scale: 2 }),
  discount: text("discount"),
  total: decimal("total", { precision: 10, scale: 2 }).notNull(),
  deposit: text("deposit"),
  paidToDate: decimal("paid_to_date", { precision: 10, scale: 2 }).notNull().default("0"),
  balance: decimal("balance", { precision: 10, scale: 2 }).notNull(),
  paymentMethod: varchar("payment_method").$type<"credit_card" | "cash" | "paypal" | null>(),
  
  // PayPal Integration
  paypalInvoiceId: varchar("paypal_invoice_id"),
  paypalInvoiceStatus: varchar("paypal_invoice_status"),
  paypalInvoiceUrl: text("paypal_invoice_url"),
  
  // ShipStation Integration
  syncToShipstation: boolean("sync_to_shipstation").notNull().default(false),
  orderNumber: varchar("order_number").unique(),
});

export const insertOrderHeaderSchema = createInsertSchema(orderHeaders, {
  customerName: z.string().optional().or(z.literal("")),
  address1: z.string().optional().or(z.literal("")),
  cityStateZip: z.string().optional().or(z.literal("")),
  deliveryMethod: z.string().optional().default("shipping"),
  discount: z.string().optional().or(z.literal("")),
  deposit: z.string().optional().or(z.literal("")),
  email: z.string().email().optional().or(z.literal("")),
}).omit({
  id: true,
  orderDate: true,
  shipping: true,
  total: true,
  balance: true,
  orderNumber: true,
});

export type InsertOrderHeader = z.infer<typeof insertOrderHeaderSchema>;
export type OrderHeader = typeof orderHeaders.$inferSelect;

// Order items - individual frame/item configurations
export const orderItems = pgTable("order_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orderId: varchar("order_id").notNull().references(() => orderHeaders.id, { onDelete: "cascade" }),
  itemNumber: integer("item_number").notNull(), // Position in order (1, 2, 3, etc.)
  
  // Frame Details
  frameSku: text("frame_sku"),
  chopOnly: boolean("chop_only").notNull().default(false),
  sample: boolean("sample").notNull().default(false),
  stackerFrame: boolean("stacker_frame").notNull().default(false),
  shadowDepth: text("shadow_depth"),
  topperSku: text("topper_sku"),
  width: decimal("width"),
  height: decimal("height"),
  
  // Mat Configuration
  matBorderAll: text("mat_border_all"),
  matBorderLeft: text("mat_border_left"),
  matBorderRight: text("mat_border_right"),
  matBorderTop: text("mat_border_top"),
  matBorderBottom: text("mat_border_bottom"),
  
  mat1Sku: text("mat_1_sku"),
  mat1Reveal: text("mat_1_reveal"),
  mat2Sku: text("mat_2_sku"),
  mat2Reveal: text("mat_2_reveal"),
  mat3Sku: text("mat_3_sku"),
  extraMatOpenings: integer("extra_mat_openings").notNull().default(0),
  
  // Materials
  acrylicType: text("acrylic_type").notNull().default("Standard"),
  backingSku: text("backing_sku").default("White Foam"),
  
  // Print Options
  printPaper: boolean("print_paper").notNull().default(false),
  printPaperType: text("print_paper_type"),
  dryMount: boolean("dry_mount").notNull().default(false),
  
  printCanvas: boolean("print_canvas").notNull().default(false),
  printCanvasWrapStyle: text("print_canvas_wrap_style"),
  canvasStretching: boolean("canvas_stretching").notNull().default(false),
  
  // Additional Options
  engravedPlaque: boolean("engraved_plaque").notNull().default(false),
  engravedPlaqueSize: text("engraved_plaque_size"),
  engravedPlaqueColor: text("engraved_plaque_color"),
  engravedPlaqueFont: text("engraved_plaque_font"),
  engravedPlaqueText1: text("engraved_plaque_text_1"),
  engravedPlaqueText2: text("engraved_plaque_text_2"),
  engravedPlaqueText3: text("engraved_plaque_text_3"),
  engravedPlaqueTextAdditional: text("engraved_plaque_text_additional").array(),
  leds: boolean("leds").notNull().default(false),
  shadowboxFitting: boolean("shadowbox_fitting").notNull().default(false),
  additionalLabor: boolean("additional_labor").notNull().default(false),
  
  // Item-level Pricing
  quantity: integer("quantity").notNull().default(1),
  itemTotal: decimal("item_total", { precision: 10, scale: 2 }).notNull(),
});

export const insertOrderItemSchema = createInsertSchema(orderItems, {
  frameSku: z.string().optional().or(z.literal("")),
  width: z.coerce.number().optional().or(z.literal("" as any)),
  height: z.coerce.number().optional().or(z.literal("" as any)),
  quantity: z.coerce.number().optional().default(1),
  extraMatOpenings: z.coerce.number().optional().default(0),
  matBorderAll: z.string().optional().or(z.literal("")),
  matBorderLeft: z.string().optional().or(z.literal("")),
  matBorderRight: z.string().optional().or(z.literal("")),
  matBorderTop: z.string().optional().or(z.literal("")),
  matBorderBottom: z.string().optional().or(z.literal("")),
  mat1Reveal: z.string().optional().or(z.literal("")),
  mat2Reveal: z.string().optional().or(z.literal("")),
  shadowDepth: z.string().optional().or(z.literal("")),
  topperSku: z.string().optional().or(z.literal("")),
  itemNumber: z.coerce.number().optional().default(1),
}).omit({
  id: true,
  orderId: true,
  itemTotal: true,
});

export type InsertOrderItem = z.infer<typeof insertOrderItemSchema>;
export type OrderItem = typeof orderItems.$inferSelect;

// ============================================================================
// Margin Analysis Types
// ============================================================================

// Labor cost configuration - used for margin analysis
export interface LaborCostConfig {
  // Base labor by frame size (United Inches)
  smallFrameLabor: number;      // < 60 UI (e.g., $7)
  mediumFrameLabor: number;     // 60-120 UI (e.g., $10)
  largeFrameLabor: number;      // > 120 UI (e.g., $14)
  
  // Complexity adders
  matComplexityAdder: number;   // Additional cost per mat (e.g., $2)
  stackerComplexityAdder: number; // Additional cost for stacker assembly (e.g., $5)
}

// Business metrics for margin analysis
export interface BusinessMetrics {
  marketingPercent: number;     // Marketing as % of retail (e.g., 25)
  monthlyOverhead: number;      // Monthly fixed costs (e.g., $50,000)
  monthlyFrameVolume: number;   // Average frames per month (e.g., 22,000)
}

// Margin analysis result for a single order
export interface MarginAnalysis {
  // Input order details
  orderType: 'Stacker Frame' | 'Full Frame' | 'Component';
  retailPrice: number;
  
  // Cost breakdown
  materialCost: number;
  marketingCost: number;
  laborCost: number;
  overheadAllocation: number;
  
  // Margin calculations
  grossMargin: number;          // Retail - Materials
  grossMarginPercent: number;   // (Gross Margin / Retail) × 100
  
  contributionMargin: number;   // Gross - Marketing - Labor - Overhead
  contributionMarginPercent: number; // (Contribution / Retail) × 100
  
  // Health indicators
  isHealthy: boolean;           // Contribution margin >= 20%
  isWarning: boolean;           // Contribution margin < 15%
}

// Scenario analysis result with multiple test cases
export interface ScenarioAnalysis {
  scenarios: {
    name: string;
    description: string;
    analysis: MarginAnalysis;
  }[];
  averageMargin: number;        // Blended average across scenarios
  healthyCount: number;         // Number of scenarios with healthy margins
  warningCount: number;         // Number of scenarios with warning margins
}
