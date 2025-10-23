import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, decimal, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

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
  
  // Order Details
  description: text("description"),
  specialRequests: text("special_requests"),
  
  // Frame Details
  frameSku: text("frame_sku"),
  chopOnly: boolean("chop_only").notNull().default(false),
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
  backingType: text("backing_type").notNull().default("White Foam"),
  
  // Print Options
  printPaper: boolean("print_paper").notNull().default(false),
  printPaperType: text("print_paper_type"),
  dryMount: boolean("dry_mount").notNull().default(false),
  
  printCanvas: boolean("print_canvas").notNull().default(false),
  printCanvasWrapStyle: text("print_canvas_wrap_style"),
  
  // Additional Options
  engravedPlaque: boolean("engraved_plaque").notNull().default(false),
  engravedPlaqueSize: text("engraved_plaque_size"),
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
  balance: decimal("balance", { precision: 10, scale: 2 }).notNull(),
});

export const insertOrderSchema = createInsertSchema(orders, {
  customerName: z.string().optional().or(z.literal("")),
  address1: z.string().optional().or(z.literal("")),
  cityStateZip: z.string().optional().or(z.literal("")),
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
  email: z.string().email().optional().or(z.literal("")),
}).omit({
  id: true,
  orderDate: true,
  itemTotal: true,
  shipping: true,
  total: true,
  balance: true,
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
