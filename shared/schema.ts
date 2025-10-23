import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, decimal, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const orders = pgTable("orders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orderDate: timestamp("order_date").notNull().defaultNow(),
  
  // Customer Information
  customerName: text("customer_name").notNull(),
  address1: text("address_1").notNull(),
  address2: text("address_2"),
  cityStateZip: text("city_state_zip").notNull(),
  phone: text("phone"),
  email: text("email"),
  
  // Order Details
  description: text("description"),
  specialRequests: text("special_requests"),
  
  // Frame Details
  frameSku: text("frame_sku").notNull(),
  chopOnly: boolean("chop_only").notNull().default(false),
  width: decimal("width").notNull(),
  height: decimal("height").notNull(),
  
  // Mat Configuration
  matBorderAll: decimal("mat_border_all"),
  matBorderLeft: decimal("mat_border_left"),
  matBorderRight: decimal("mat_border_right"),
  matBorderTop: decimal("mat_border_top"),
  matBorderBottom: decimal("mat_border_bottom"),
  
  mat1Sku: text("mat_1_sku"),
  mat1Reveal: decimal("mat_1_reveal"),
  mat2Sku: text("mat_2_sku"),
  mat2Reveal: decimal("mat_2_reveal"),
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
  discountPercent: integer("discount_percent").notNull().default(0),
  total: decimal("total", { precision: 10, scale: 2 }).notNull(),
  deposit: decimal("deposit", { precision: 10, scale: 2 }),
  balance: decimal("balance", { precision: 10, scale: 2 }).notNull(),
});

export const insertOrderSchema = createInsertSchema(orders, {
  customerName: z.string().min(1, "Customer name is required"),
  address1: z.string().min(1, "Address is required"),
  cityStateZip: z.string().min(1, "City, State, Zip is required"),
  frameSku: z.string().min(1, "Frame SKU is required"),
  width: z.coerce.number().min(1, "Width must be at least 1"),
  height: z.coerce.number().min(1, "Height must be at least 1"),
  quantity: z.coerce.number().min(1, "Quantity must be at least 1"),
  extraMatOpenings: z.coerce.number().min(0).default(0),
  discountPercent: z.coerce.number().min(0).max(100).default(0),
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
