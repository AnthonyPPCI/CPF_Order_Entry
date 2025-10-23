import { type Order, type InsertOrder } from "@shared/schema";
import { randomUUID } from "crypto";

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
      ...insertOrder,
      id,
      orderDate: new Date(),
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

export const storage = new MemStorage();
