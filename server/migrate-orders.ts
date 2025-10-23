import { db } from "./db";
import { orders, orderHeaders, orderItems } from "@shared/schema";
import { sql } from "drizzle-orm";

/**
 * Data migration script to convert legacy single-item orders
 * to the new normalized order_headers + order_items structure.
 * 
 * This script:
 * 1. Reads all existing orders from the legacy `orders` table
 * 2. Creates corresponding order_headers records (customer info, totals)
 * 3. Creates order_items records (one per legacy order)
 * 4. Preserves all data and pricing
 */
async function migrateOrders() {
  console.log("Starting order migration from legacy schema to normalized schema...");
  
  try {
    // Get all existing orders
    const legacyOrders = await db.select().from(orders);
    console.log(`Found ${legacyOrders.length} legacy orders to migrate`);
    
    if (legacyOrders.length === 0) {
      console.log("No orders to migrate. Migration complete.");
      return;
    }
    
    let migratedCount = 0;
    
    for (const order of legacyOrders) {
      // Check if this order has already been migrated
      const existing = await db
        .select()
        .from(orderHeaders)
        .where(sql`${orderHeaders.id} = ${order.id}`)
        .limit(1);
      
      if (existing.length > 0) {
        console.log(`Order ${order.id} already migrated, skipping...`);
        continue;
      }
      
      // Create order header
      await db.insert(orderHeaders).values({
        id: order.id, // Preserve the same ID
        orderDate: order.orderDate,
        customerName: order.customerName,
        address1: order.address1,
        address2: order.address2,
        cityStateZip: order.cityStateZip,
        phone: order.phone,
        email: order.email,
        deliveryMethod: order.deliveryMethod,
        description: order.description,
        specialRequests: order.specialRequests,
        shipping: order.shipping,
        salesTax: order.salesTax,
        discount: order.discount,
        total: order.total,
        deposit: order.deposit,
        balance: order.balance,
      });
      
      // Create order item (single item from legacy order)
      await db.insert(orderItems).values({
        orderId: order.id,
        itemNumber: 1, // First (and only) item in legacy orders
        frameSku: order.frameSku,
        chopOnly: order.chopOnly,
        stackerFrame: order.stackerFrame,
        shadowDepth: order.shadowDepth,
        topperSku: order.topperSku,
        width: order.width,
        height: order.height,
        matBorderAll: order.matBorderAll,
        matBorderLeft: order.matBorderLeft,
        matBorderRight: order.matBorderRight,
        matBorderTop: order.matBorderTop,
        matBorderBottom: order.matBorderBottom,
        mat1Sku: order.mat1Sku,
        mat1Reveal: order.mat1Reveal,
        mat2Sku: order.mat2Sku,
        mat2Reveal: order.mat2Reveal,
        mat3Sku: order.mat3Sku,
        extraMatOpenings: order.extraMatOpenings,
        acrylicType: order.acrylicType,
        backingType: order.backingType,
        printPaper: order.printPaper,
        printPaperType: order.printPaperType,
        dryMount: order.dryMount,
        printCanvas: order.printCanvas,
        printCanvasWrapStyle: order.printCanvasWrapStyle,
        engravedPlaque: order.engravedPlaque,
        engravedPlaqueSize: order.engravedPlaqueSize,
        engravedPlaqueColor: order.engravedPlaqueColor,
        engravedPlaqueFont: order.engravedPlaqueFont,
        engravedPlaqueText1: order.engravedPlaqueText1,
        engravedPlaqueText2: order.engravedPlaqueText2,
        engravedPlaqueText3: order.engravedPlaqueText3,
        engravedPlaqueTextAdditional: order.engravedPlaqueTextAdditional,
        leds: order.leds,
        shadowboxFitting: order.shadowboxFitting,
        additionalLabor: order.additionalLabor,
        quantity: order.quantity,
        itemTotal: order.itemTotal,
      });
      
      migratedCount++;
      console.log(`Migrated order ${order.id} (${migratedCount}/${legacyOrders.length})`);
    }
    
    console.log(`\nMigration complete! Successfully migrated ${migratedCount} orders.`);
    console.log("\nNote: Legacy 'orders' table is preserved for safety.");
    console.log("You can drop it manually once you've verified the migration.");
    
  } catch (error) {
    console.error("Migration failed:", error);
    throw error;
  }
}

// Run migration
migrateOrders()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
