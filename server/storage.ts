import { 
  type Order, 
  type InsertOrder,
  type OrderHeader,
  type InsertOrderHeader,
  type OrderItem,
  type InsertOrderItem,
} from "@shared/schema";
import { randomUUID, createHash } from "crypto";

// Extended insert type that includes calculated pricing fields
type InsertOrderWithPricing = InsertOrder & {
  itemTotal: string;
  shipping: string;
  salesTax?: string;
  total: string;
  balance: string;
};

// Multi-item order types
type InsertOrderHeaderWithPricing = InsertOrderHeader & {
  shipping: string;
  salesTax?: string;
  total: string;
  balance: string;
};

type InsertOrderItemWithPricing = InsertOrderItem & {
  itemTotal: string;
};

// Complete multi-item order with items included
export type MultiItemOrder = OrderHeader & {
  items: OrderItem[];
};

export interface IStorage {
  // Legacy single-item order operations (for backwards compatibility)
  getAllOrders(): Promise<Order[]>;
  getOrderById(id: string): Promise<Order | undefined>;
  createOrder(order: InsertOrderWithPricing): Promise<Order>;
  updateOrder(id: string, order: Partial<InsertOrderWithPricing>): Promise<Order | undefined>;
  deleteOrder(id: string): Promise<boolean>;
  
  // Multi-item order operations
  getAllMultiItemOrders(): Promise<MultiItemOrder[]>;
  getMultiItemOrderById(id: string): Promise<MultiItemOrder | undefined>;
  createMultiItemOrder(header: InsertOrderHeaderWithPricing, items: InsertOrderItemWithPricing[]): Promise<MultiItemOrder>;
  updateMultiItemOrder(id: string, header: Partial<InsertOrderHeaderWithPricing>, items?: InsertOrderItemWithPricing[]): Promise<MultiItemOrder | undefined>;
  deleteMultiItemOrder(id: string): Promise<boolean>;
}

export class MemStorage implements IStorage {
  private orders: Map<string, Order>;
  private orderHeaders: Map<string, OrderHeader>;
  private orderItems: Map<string, OrderItem[]>; // Maps orderId -> OrderItem[]

  constructor() {
    this.orders = new Map();
    this.orderHeaders = new Map();
    this.orderItems = new Map();
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

  // Multi-item order operations
  async getAllMultiItemOrders(): Promise<MultiItemOrder[]> {
    const headers = Array.from(this.orderHeaders.values());
    const ordersWithItems = headers.map(header => ({
      ...header,
      items: this.orderItems.get(header.id) || [],
    }));
    
    return ordersWithItems.sort(
      (a, b) => new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime()
    );
  }

  async getMultiItemOrderById(id: string): Promise<MultiItemOrder | undefined> {
    const header = this.orderHeaders.get(id);
    if (!header) {
      return undefined;
    }
    
    return {
      ...header,
      items: this.orderItems.get(id) || [],
    };
  }

  async createMultiItemOrder(
    insertHeader: InsertOrderHeaderWithPricing,
    insertItems: InsertOrderItemWithPricing[]
  ): Promise<MultiItemOrder> {
    const orderId = randomUUID();
    
    // Create order header
    const header: OrderHeader = {
      id: orderId,
      orderDate: new Date(),
      customerName: insertHeader.customerName || null,
      address1: insertHeader.address1 || null,
      address2: insertHeader.address2 || null,
      cityStateZip: insertHeader.cityStateZip || null,
      phone: insertHeader.phone || null,
      email: insertHeader.email || null,
      deliveryMethod: insertHeader.deliveryMethod || "shipping",
      description: insertHeader.description || null,
      specialRequests: insertHeader.specialRequests || null,
      shipping: insertHeader.shipping,
      salesTax: insertHeader.salesTax || null,
      discount: insertHeader.discount || null,
      total: insertHeader.total,
      deposit: insertHeader.deposit || null,
      balance: insertHeader.balance,
    };
    
    // Create order items
    const items: OrderItem[] = insertItems.map((insertItem, index) => ({
      id: randomUUID(),
      orderId,
      itemNumber: insertItem.itemNumber || index + 1,
      frameSku: insertItem.frameSku || null,
      chopOnly: insertItem.chopOnly || false,
      stackerFrame: insertItem.stackerFrame || false,
      shadowDepth: insertItem.shadowDepth || null,
      topperSku: insertItem.topperSku || null,
      width: insertItem.width?.toString() || null,
      height: insertItem.height?.toString() || null,
      matBorderAll: insertItem.matBorderAll || null,
      matBorderLeft: insertItem.matBorderLeft || null,
      matBorderRight: insertItem.matBorderRight || null,
      matBorderTop: insertItem.matBorderTop || null,
      matBorderBottom: insertItem.matBorderBottom || null,
      mat1Sku: insertItem.mat1Sku || null,
      mat1Reveal: insertItem.mat1Reveal || null,
      mat2Sku: insertItem.mat2Sku || null,
      mat2Reveal: insertItem.mat2Reveal || null,
      mat3Sku: insertItem.mat3Sku || null,
      extraMatOpenings: insertItem.extraMatOpenings || 0,
      acrylicType: insertItem.acrylicType || "Standard",
      backingType: insertItem.backingType || "White Foam",
      printPaper: insertItem.printPaper || false,
      printPaperType: insertItem.printPaperType || null,
      dryMount: insertItem.dryMount || false,
      printCanvas: insertItem.printCanvas || false,
      printCanvasWrapStyle: insertItem.printCanvasWrapStyle || null,
      engravedPlaque: insertItem.engravedPlaque || false,
      engravedPlaqueSize: insertItem.engravedPlaqueSize || null,
      engravedPlaqueColor: insertItem.engravedPlaqueColor || null,
      engravedPlaqueFont: insertItem.engravedPlaqueFont || null,
      engravedPlaqueText1: insertItem.engravedPlaqueText1 || null,
      engravedPlaqueText2: insertItem.engravedPlaqueText2 || null,
      engravedPlaqueText3: insertItem.engravedPlaqueText3 || null,
      engravedPlaqueTextAdditional: insertItem.engravedPlaqueTextAdditional || null,
      leds: insertItem.leds || false,
      shadowboxFitting: insertItem.shadowboxFitting || false,
      additionalLabor: insertItem.additionalLabor || false,
      quantity: insertItem.quantity || 1,
      itemTotal: insertItem.itemTotal,
    }));
    
    this.orderHeaders.set(orderId, header);
    this.orderItems.set(orderId, items);
    
    return {
      ...header,
      items,
    };
  }

  async updateMultiItemOrder(
    id: string,
    updateHeader: Partial<InsertOrderHeaderWithPricing>,
    updateItems?: InsertOrderItemWithPricing[]
  ): Promise<MultiItemOrder | undefined> {
    const existingHeader = this.orderHeaders.get(id);
    if (!existingHeader) {
      return undefined;
    }

    // Update header
    const updatedHeader: OrderHeader = {
      ...existingHeader,
      ...updateHeader,
    };
    this.orderHeaders.set(id, updatedHeader);

    // Update items if provided
    if (updateItems) {
      const items: OrderItem[] = updateItems.map((insertItem, index) => ({
        id: randomUUID(),
        orderId: id,
        itemNumber: insertItem.itemNumber || index + 1,
        frameSku: insertItem.frameSku || null,
        chopOnly: insertItem.chopOnly || false,
        stackerFrame: insertItem.stackerFrame || false,
        shadowDepth: insertItem.shadowDepth || null,
        topperSku: insertItem.topperSku || null,
        width: insertItem.width?.toString() || null,
        height: insertItem.height?.toString() || null,
        matBorderAll: insertItem.matBorderAll || null,
        matBorderLeft: insertItem.matBorderLeft || null,
        matBorderRight: insertItem.matBorderRight || null,
        matBorderTop: insertItem.matBorderTop || null,
        matBorderBottom: insertItem.matBorderBottom || null,
        mat1Sku: insertItem.mat1Sku || null,
        mat1Reveal: insertItem.mat1Reveal || null,
        mat2Sku: insertItem.mat2Sku || null,
        mat2Reveal: insertItem.mat2Reveal || null,
        mat3Sku: insertItem.mat3Sku || null,
        extraMatOpenings: insertItem.extraMatOpenings || 0,
        acrylicType: insertItem.acrylicType || "Standard",
        backingType: insertItem.backingType || "White Foam",
        printPaper: insertItem.printPaper || false,
        printPaperType: insertItem.printPaperType || null,
        dryMount: insertItem.dryMount || false,
        printCanvas: insertItem.printCanvas || false,
        printCanvasWrapStyle: insertItem.printCanvasWrapStyle || null,
        engravedPlaque: insertItem.engravedPlaque || false,
        engravedPlaqueSize: insertItem.engravedPlaqueSize || null,
        engravedPlaqueColor: insertItem.engravedPlaqueColor || null,
        engravedPlaqueFont: insertItem.engravedPlaqueFont || null,
        engravedPlaqueText1: insertItem.engravedPlaqueText1 || null,
        engravedPlaqueText2: insertItem.engravedPlaqueText2 || null,
        engravedPlaqueText3: insertItem.engravedPlaqueText3 || null,
        engravedPlaqueTextAdditional: insertItem.engravedPlaqueTextAdditional || null,
        leds: insertItem.leds || false,
        shadowboxFitting: insertItem.shadowboxFitting || false,
        additionalLabor: insertItem.additionalLabor || false,
        quantity: insertItem.quantity || 1,
        itemTotal: insertItem.itemTotal,
      }));
      this.orderItems.set(id, items);
    }

    return {
      ...updatedHeader,
      items: this.orderItems.get(id) || [],
    };
  }

  async deleteMultiItemOrder(id: string): Promise<boolean> {
    const headerDeleted = this.orderHeaders.delete(id);
    this.orderItems.delete(id);
    return headerDeleted;
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
