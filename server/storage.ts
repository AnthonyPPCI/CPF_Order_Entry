import { type Order, type InsertOrder } from "@shared/schema";
import { randomUUID, createHash } from "crypto";

// Extended insert type that includes calculated pricing fields
type InsertOrderWithPricing = InsertOrder & {
  itemTotal: string;
  shipping: string;
  salesTax?: string;
  total: string;
  balance: string;
};

export interface IStorage {
  // Order operations
  getAllOrders(): Promise<Order[]>;
  getOrderById(id: string): Promise<Order | undefined>;
  createOrder(order: InsertOrderWithPricing): Promise<Order>;
  updateOrder(id: string, order: Partial<InsertOrderWithPricing>): Promise<Order | undefined>;
  deleteOrder(id: string): Promise<boolean>;
}

export class MemStorage implements IStorage {
  private orders: Map<string, Order>;

  constructor() {
    this.orders = new Map();
  }

  async getAllOrders(): Promise<Order[]> {
    return Array.from(this.orders.values()).sort(
      (a, b) => new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime()
    );
  }

  async getOrderById(id: string): Promise<Order | undefined> {
    return this.orders.get(id);
  }

  async createOrder(insertOrder: InsertOrderWithPricing): Promise<Order> {
    const id = randomUUID();
    const order: Order = {
      id,
      orderDate: new Date(),
      customerName: insertOrder.customerName || null,
      address1: insertOrder.address1 || null,
      address2: insertOrder.address2 || null,
      cityStateZip: insertOrder.cityStateZip || null,
      phone: insertOrder.phone || null,
      email: insertOrder.email || null,
      deliveryMethod: insertOrder.deliveryMethod || "shipping",
      description: insertOrder.description || null,
      specialRequests: insertOrder.specialRequests || null,
      frameSku: insertOrder.frameSku || null,
      chopOnly: insertOrder.chopOnly || false,
      stackerFrame: insertOrder.stackerFrame || false,
      shadowDepth: insertOrder.shadowDepth || null,
      topperSku: insertOrder.topperSku || null,
      width: insertOrder.width?.toString() || null,
      height: insertOrder.height?.toString() || null,
      matBorderAll: insertOrder.matBorderAll || null,
      matBorderLeft: insertOrder.matBorderLeft || null,
      matBorderRight: insertOrder.matBorderRight || null,
      matBorderTop: insertOrder.matBorderTop || null,
      matBorderBottom: insertOrder.matBorderBottom || null,
      mat1Sku: insertOrder.mat1Sku || null,
      mat1Reveal: insertOrder.mat1Reveal || null,
      mat2Sku: insertOrder.mat2Sku || null,
      mat2Reveal: insertOrder.mat2Reveal || null,
      mat3Sku: insertOrder.mat3Sku || null,
      extraMatOpenings: insertOrder.extraMatOpenings || 0,
      acrylicType: insertOrder.acrylicType || "Standard",
      backingType: insertOrder.backingType || "White Foam",
      printPaper: insertOrder.printPaper || false,
      printPaperType: insertOrder.printPaperType || null,
      dryMount: insertOrder.dryMount || false,
      printCanvas: insertOrder.printCanvas || false,
      printCanvasWrapStyle: insertOrder.printCanvasWrapStyle || null,
      engravedPlaque: insertOrder.engravedPlaque || false,
      engravedPlaqueSize: insertOrder.engravedPlaqueSize || null,
      engravedPlaqueColor: insertOrder.engravedPlaqueColor || null,
      engravedPlaqueFont: insertOrder.engravedPlaqueFont || null,
      engravedPlaqueText1: insertOrder.engravedPlaqueText1 || null,
      engravedPlaqueText2: insertOrder.engravedPlaqueText2 || null,
      engravedPlaqueText3: insertOrder.engravedPlaqueText3 || null,
      engravedPlaqueTextAdditional: insertOrder.engravedPlaqueTextAdditional || null,
      leds: insertOrder.leds || false,
      shadowboxFitting: insertOrder.shadowboxFitting || false,
      additionalLabor: insertOrder.additionalLabor || false,
      quantity: insertOrder.quantity || 1,
      itemTotal: insertOrder.itemTotal,
      shipping: insertOrder.shipping,
      salesTax: insertOrder.salesTax || null,
      discount: insertOrder.discount || null,
      total: insertOrder.total,
      deposit: insertOrder.deposit || null,
      balance: insertOrder.balance,
    };
    this.orders.set(id, order);
    return order;
  }

  async updateOrder(id: string, updateData: Partial<InsertOrderWithPricing>): Promise<Order | undefined> {
    const existingOrder = this.orders.get(id);
    if (!existingOrder) {
      return undefined;
    }

    const updatedOrder: Order = {
      ...existingOrder,
      ...updateData,
    };
    this.orders.set(id, updatedOrder);
    return updatedOrder;
  }

  async deleteOrder(id: string): Promise<boolean> {
    return this.orders.delete(id);
  }
}

// Pricing configuration storage (in-memory)
interface PricingConfig {
  markup: number;
  chopOnlyJoinFt: number;
  shippingRates: { min: number; max: number; rate: number }[];
  acrylicPrices: { type: string; pricePerSqIn: number }[];
  backingPrices: { type: string; price: number }[];
  stackerFrames: { sku: string; depth: number; pricePerFt: number }[];
  topperPieces: { sku: string; depth: number; pricePerFt: number }[];
  stackerAssemblyCharge: number;
  stackerMarkup: number;
  passwordHash: string; // SHA-256 hash of the password
}

class PricingConfigStorage {
  private config: PricingConfig;

  constructor() {
    // Default configuration matching Google Sheets
    this.config = {
      markup: 2.75,
      chopOnlyJoinFt: 18,
      shippingRates: [
        { min: 1, max: 30, rate: 9 },
        { min: 31, max: 49, rate: 19 },
        { min: 50, max: 74, rate: 29 },
        { min: 75, max: 999, rate: 250 },
      ],
      acrylicPrices: [
        { type: 'Standard', pricePerSqIn: 0.009 },
        { type: 'Non-Glare', pricePerSqIn: 0.018 },
        { type: 'Museum Quality', pricePerSqIn: 0.027 },
      ],
      backingPrices: [
        { type: 'None', price: 0 },
        { type: 'White Foam', price: 2 },
        { type: 'Black Foam', price: 2.5 },
        { type: 'Acid Free', price: 3 },
      ],
      stackerFrames: [
        { sku: '9532', depth: 2.5, pricePerFt: 11.81 },
        { sku: '9533', depth: 1.5, pricePerFt: 8.36 },
      ],
      topperPieces: [
        { sku: '9531', depth: 0.75, pricePerFt: 8.50 },
        { sku: '9731', depth: 1.0, pricePerFt: 9.00 },
      ],
      stackerAssemblyCharge: 29.17,
      stackerMarkup: 2.5,
      // SHA-256 hash of "2026DOG"
      passwordHash: '8a707e0ded3de11960657de67f2e66292900c86c1ecfe7e570167397943cdaf4',
    };
  }

  getConfig() {
    return { ...this.config };
  }

  updateConfig(updates: Partial<PricingConfig>) {
    this.config = { ...this.config, ...updates };
  }

  verifyPassword(password: string): boolean {
    // Simple SHA-256 hash comparison
    const hash = createHash('sha256').update(password).digest('hex');
    return hash === this.config.passwordHash;
  }
}

export const pricingConfigStorage = new PricingConfigStorage();

export const storage = new MemStorage();
