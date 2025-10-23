import { useQuery } from "@tanstack/react-query";
import { type Order } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Eye, Search } from "lucide-react";
import { Link } from "wouter";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";

export default function OrderList() {
  const [searchTerm, setSearchTerm] = useState("");

  const { data: orders, isLoading } = useQuery<Order[]>({
    queryKey: ["/api/orders"],
  });

  const filteredOrders = orders?.filter((order) => {
    const search = searchTerm.toLowerCase();
    return (
      order.customerName.toLowerCase().includes(search) ||
      order.description?.toLowerCase().includes(search) ||
      order.frameSku.toLowerCase().includes(search) ||
      order.id.toLowerCase().includes(search)
    );
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-7xl mx-auto px-4 md:px-8 py-8">
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <CardContent className="pt-6">
                  <div className="animate-pulse space-y-3">
                    <div className="h-4 bg-muted rounded w-1/4"></div>
                    <div className="h-4 bg-muted rounded w-1/2"></div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 md:px-8 py-8">
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h1 className="text-3xl font-bold">Orders</h1>
              <p className="text-muted-foreground">
                {filteredOrders?.length || 0} {filteredOrders?.length === 1 ? "order" : "orders"} found
              </p>
            </div>
            <Link href="/" asChild>
              <Button data-testid="button-new-order">New Order</Button>
            </Link>
          </div>

          {/* Search */}
          <Card>
            <CardContent className="pt-6">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by customer name, SKU, or description..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                  data-testid="input-search"
                />
              </div>
            </CardContent>
          </Card>

          {/* Orders List */}
          {!filteredOrders || filteredOrders.length === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center py-12">
                  <p className="text-muted-foreground mb-4">
                    {searchTerm ? "No orders match your search" : "No orders yet"}
                  </p>
                  {!searchTerm && (
                    <Link href="/" asChild>
                      <Button variant="outline" data-testid="button-create-first-order">Create Your First Order</Button>
                    </Link>
                  )}
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {/* Desktop Table */}
              <div className="hidden md:block">
                <Card>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left p-4 font-semibold text-sm">Date</th>
                          <th className="text-left p-4 font-semibold text-sm">Customer</th>
                          <th className="text-left p-4 font-semibold text-sm">Frame SKU</th>
                          <th className="text-left p-4 font-semibold text-sm">Size</th>
                          <th className="text-left p-4 font-semibold text-sm">Description</th>
                          <th className="text-right p-4 font-semibold text-sm">Total</th>
                          <th className="text-right p-4 font-semibold text-sm">Status</th>
                          <th className="text-right p-4 font-semibold text-sm">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredOrders.map((order, index) => {
                          const hasDeposit = order.deposit && parseFloat(order.deposit) > 0;
                          const isPaid = parseFloat(order.balance) === 0;

                          return (
                            <tr
                              key={order.id}
                              className={`border-b hover-elevate ${index % 2 === 0 ? "bg-muted/20" : ""}`}
                              data-testid={`row-order-${order.id}`}
                            >
                              <td className="p-4 text-sm">
                                {new Date(order.orderDate).toLocaleDateString()}
                              </td>
                              <td className="p-4">
                                <div className="font-medium">{order.customerName}</div>
                                <div className="text-xs text-muted-foreground">{order.cityStateZip}</div>
                              </td>
                              <td className="p-4">
                                <code className="text-sm font-mono bg-muted px-2 py-1 rounded">
                                  {order.frameSku}
                                </code>
                              </td>
                              <td className="p-4 text-sm font-mono">
                                {order.width}×{order.height}
                              </td>
                              <td className="p-4 text-sm text-muted-foreground max-w-xs truncate">
                                {order.description || "—"}
                              </td>
                              <td className="p-4 text-right">
                                <div className="font-mono font-semibold">${parseFloat(order.total).toFixed(2)}</div>
                                {hasDeposit && (
                                  <div className="text-xs text-muted-foreground">
                                    Balance: ${parseFloat(order.balance).toFixed(2)}
                                  </div>
                                )}
                              </td>
                              <td className="p-4 text-right">
                                {isPaid ? (
                                  <Badge variant="default" className="bg-chart-2 text-white">Paid</Badge>
                                ) : hasDeposit ? (
                                  <Badge variant="default" className="bg-chart-3 text-white">Deposit</Badge>
                                ) : (
                                  <Badge variant="secondary">Pending</Badge>
                                )}
                              </td>
                              <td className="p-4 text-right">
                                <Link href={`/order/${order.id}`} asChild>
                                  <Button variant="ghost" size="icon" data-testid={`button-view-${order.id}`}>
                                    <Eye className="h-4 w-4" />
                                  </Button>
                                </Link>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </Card>
              </div>

              {/* Mobile Cards */}
              <div className="md:hidden space-y-4">
                {filteredOrders.map((order) => {
                  const hasDeposit = order.deposit && parseFloat(order.deposit) > 0;
                  const isPaid = parseFloat(order.balance) === 0;

                  return (
                    <Card key={order.id} className="hover-elevate" data-testid={`card-order-${order.id}`}>
                      <CardHeader className="pb-3">
                        <div className="flex justify-between items-start gap-2">
                          <div className="flex-1">
                            <CardTitle className="text-base">{order.customerName}</CardTitle>
                            <p className="text-sm text-muted-foreground mt-1">
                              {new Date(order.orderDate).toLocaleDateString()}
                            </p>
                          </div>
                          {isPaid ? (
                            <Badge variant="default" className="bg-chart-2 text-white">Paid</Badge>
                          ) : hasDeposit ? (
                            <Badge variant="default" className="bg-chart-3 text-white">Deposit</Badge>
                          ) : (
                            <Badge variant="secondary">Pending</Badge>
                          )}
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div>
                            <span className="text-muted-foreground">Frame SKU:</span>
                            <div className="font-mono font-medium">{order.frameSku}</div>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Size:</span>
                            <div className="font-mono font-medium">
                              {order.width}×{order.height}
                            </div>
                          </div>
                        </div>
                        {order.description && (
                          <div className="text-sm">
                            <span className="text-muted-foreground">Description:</span>
                            <div className="mt-1">{order.description}</div>
                          </div>
                        )}
                        <div className="flex justify-between items-center pt-2 border-t">
                          <div>
                            <div className="font-mono font-semibold text-lg">
                              ${parseFloat(order.total).toFixed(2)}
                            </div>
                            {hasDeposit && (
                              <div className="text-xs text-muted-foreground">
                                Balance: ${parseFloat(order.balance).toFixed(2)}
                              </div>
                            )}
                          </div>
                          <Link href={`/order/${order.id}`} asChild>
                            <Button variant="outline" size="sm" data-testid={`button-view-mobile-${order.id}`}>
                              <Eye className="h-4 w-4 mr-1" />
                              View
                            </Button>
                          </Link>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
