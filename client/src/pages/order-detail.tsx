import { useQuery } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
import { type Order, type OrderHeader, type OrderItem } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Printer, Mail, Mic, Square } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import cpfLogo from "@assets/cpf-logo.webp";

// Type for multi-item order response (header fields merged with items array)
type MultiItemOrderResponse = OrderHeader & {
  items: OrderItem[];
};

export default function OrderDetail() {
  const [, params] = useRoute("/order/:id");
  const orderId = params?.id;
  const { toast } = useToast();

  const { data: orderData, isLoading } = useQuery<Order | MultiItemOrderResponse>({
    queryKey: ["/api/orders", orderId],
    enabled: !!orderId,
  });

  // Check if this is a multi-item order (has items array)
  const isMultiItemOrder = orderData && "items" in orderData;
  const order = isMultiItemOrder ? null : (orderData as Order);
  const multiOrder = isMultiItemOrder ? (orderData as MultiItemOrderResponse) : null;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-4xl mx-auto px-4 md:px-8 py-8">
          <Card>
            <CardContent className="pt-6">
              <div className="animate-pulse space-y-4">
                <div className="h-6 bg-muted rounded w-1/3"></div>
                <div className="h-4 bg-muted rounded w-1/2"></div>
                <div className="h-4 bg-muted rounded w-2/3"></div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (!order && !multiOrder) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-4xl mx-auto px-4 md:px-8 py-8">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-12">
                <p className="text-muted-foreground mb-4">Order not found</p>
                <Link href="/orders" asChild>
                  <Button variant="outline">Back to Orders</Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // If it's a multi-item order, show simplified view for now
  if (multiOrder) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-4xl mx-auto px-4 md:px-8 py-8">
          <div className="space-y-6">
            {/* Navigation */}
            <div className="flex items-center">
              <Link href="/orders" asChild>
                <Button variant="ghost" data-testid="button-back">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Orders
                </Button>
              </Link>
            </div>

            {/* Multi-Item Order Display */}
            <Card>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle>Multi-Item Order</CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                      Order #{multiOrder.id?.slice(0, 8).toUpperCase()}
                    </p>
                  </div>
                  <Badge variant="secondary">{multiOrder.items.length} Items</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Customer Information */}
                <div>
                  <h3 className="font-semibold mb-2">Customer Information</h3>
                  <div className="text-sm space-y-1">
                    <p className="font-medium">{multiOrder.customerName}</p>
                    {multiOrder.address1 && <p className="text-muted-foreground">{multiOrder.address1}</p>}
                    {multiOrder.cityStateZip && <p className="text-muted-foreground">{multiOrder.cityStateZip}</p>}
                    {multiOrder.phone && <p className="text-muted-foreground">{multiOrder.phone}</p>}
                  </div>
                </div>

                <Separator />

                {/* Order Items */}
                <div>
                  <h3 className="font-semibold mb-3">Order Items</h3>
                  <div className="space-y-4">
                    {multiOrder.items.map((item, index) => (
                      <Card key={item.id || index} className="border-muted">
                        <CardHeader>
                          <div className="flex justify-between items-start">
                            <CardTitle className="text-base">Item #{item.itemNumber || index + 1}</CardTitle>
                            {item.itemTotal && (
                              <Badge variant="outline">${item.itemTotal}</Badge>
                            )}
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="grid grid-cols-2 gap-2 text-sm">
                            {item.frameSku && (
                              <div>
                                <span className="text-muted-foreground">Frame SKU:</span>{" "}
                                <code className="font-mono text-xs">{item.frameSku}</code>
                              </div>
                            )}
                            {item.width && item.height && (
                              <div>
                                <span className="text-muted-foreground">Size:</span>{" "}
                                <span className="font-mono">{item.width} × {item.height}"</span>
                              </div>
                            )}
                            {item.quantity && (
                              <div>
                                <span className="text-muted-foreground">Quantity:</span> {item.quantity}
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>

                <Separator />

                {/* Order Totals */}
                <div>
                  <h3 className="font-semibold mb-3">Order Summary</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Shipping:</span>
                      <span className="font-medium">${multiOrder.shipping}</span>
                    </div>
                    {multiOrder.salesTax && multiOrder.salesTax !== "0.00" && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Sales Tax:</span>
                        <span className="font-medium">${multiOrder.salesTax}</span>
                      </div>
                    )}
                    {multiOrder.discount && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Discount:</span>
                        <span className="font-medium">{multiOrder.discount}</span>
                      </div>
                    )}
                    {multiOrder.deposit && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Deposit Paid:</span>
                        <span className="font-medium">{multiOrder.deposit}</span>
                      </div>
                    )}
                    <Separator />
                    <div className="flex justify-between text-lg">
                      <span className="font-bold">Total:</span>
                      <span className="font-bold">${multiOrder.total}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Balance Due:</span>
                      <span className="font-semibold">${multiOrder.balance}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  const handlePrint = () => {
    window.print();
  };

  const handleEmailBrian = () => {
    if (!order) return;
    
    const subject = encodeURIComponent(`Order #${order.id.slice(0, 8).toUpperCase()} - ${order.customerName}`);
    const body = encodeURIComponent(
      `Order Details:\n\n` +
      `Customer: ${order.customerName}\n` +
      `Frame: ${order.frameSku} (${order.width}" × ${order.height}")\n` +
      `Quantity: ${order.quantity}\n` +
      `Total: $${parseFloat(order.total).toFixed(2)}\n` +
      `Balance Due: $${parseFloat(order.balance).toFixed(2)}\n\n` +
      `Description: ${order.description || 'N/A'}\n\n` +
      `View full order: ${window.location.href}`
    );
    
    window.location.href = `mailto:brian@custompictureframes.com?subject=${subject}&body=${body}`;
  };

  const handleEmailCustomer = () => {
    if (!order || !order.email) {
      toast({
        title: "No Email Address",
        description: "This order does not have a customer email address.",
        variant: "destructive",
      });
      return;
    }
    
    const subject = encodeURIComponent(`Your Order from CustomPictureFrames.com`);
    const body = encodeURIComponent(
      `Dear ${order.customerName},\n\n` +
      `Thank you for your order!\n\n` +
      `Order #: ${order.id.slice(0, 8).toUpperCase()}\n` +
      `Frame: ${order.frameSku} (${order.width}" × ${order.height}")\n` +
      `Quantity: ${order.quantity}\n` +
      `Total: $${parseFloat(order.total).toFixed(2)}\n` +
      `Balance Due: $${parseFloat(order.balance).toFixed(2)}\n\n` +
      `We will contact you when your order is ready.\n\n` +
      `Best regards,\n` +
      `CustomPictureFrames.com\n` +
      `(800) 916-8770`
    );
    
    window.location.href = `mailto:${order.email}?subject=${subject}&body=${body}`;
  };

  const handleRecordOrder = () => {
    if (!order) return;
    
    toast({
      title: "Order Recorded",
      description: `Order #${order.id.slice(0, 8).toUpperCase()} has been recorded in the system.`,
    });
  };

  const handleOpenSquare = () => {
    if (!order) return;
    
    const squareUrl = `https://squareup.com/dashboard/sales/transactions`;
    window.open(squareUrl, '_blank');
    
    toast({
      title: "Opening Square",
      description: "Square payment system opened in new tab.",
    });
  };

  const hasDeposit = order.deposit && parseFloat(order.deposit) > 0;
  const isPaid = parseFloat(order.balance) === 0;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 md:px-8 py-8">
        <div className="space-y-6">
          {/* Navigation */}
          <div className="flex items-center print:hidden">
            <Link href="/orders" asChild>
              <Button variant="ghost" data-testid="button-back">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Orders
              </Button>
            </Link>
          </div>

          {/* Action Buttons - Google Sheets Style */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 print:hidden">
            <Button 
              variant="outline" 
              onClick={handlePrint} 
              data-testid="button-print-order"
              className="h-auto py-4 flex-col gap-2 hover-elevate active-elevate-2"
            >
              <Printer className="h-6 w-6" />
              <span className="font-semibold">Print Order</span>
            </Button>
            
            <Button 
              variant="outline" 
              onClick={handleEmailBrian} 
              data-testid="button-email-brian"
              className="h-auto py-4 flex-col gap-2 hover-elevate active-elevate-2"
            >
              <Mail className="h-6 w-6" />
              <span className="font-semibold">Email Brian</span>
            </Button>
            
            <Button 
              variant="outline" 
              onClick={handleEmailCustomer} 
              data-testid="button-email-customer"
              className="h-auto py-4 flex-col gap-2 hover-elevate active-elevate-2"
            >
              <Mail className="h-6 w-6" />
              <span className="font-semibold">Email Customer</span>
            </Button>
            
            <Button 
              variant="outline" 
              onClick={handleRecordOrder} 
              data-testid="button-record-order"
              className="h-auto py-4 flex-col gap-2 hover-elevate active-elevate-2"
            >
              <Mic className="h-6 w-6" />
              <span className="font-semibold">Record Order</span>
            </Button>
            
            <Button 
              variant="outline" 
              onClick={handleOpenSquare} 
              data-testid="button-open-square"
              className="h-auto py-4 flex-col gap-2 hover-elevate active-elevate-2"
            >
              <Square className="h-6 w-6" />
              <span className="font-semibold">Open Square</span>
            </Button>
          </div>

          {/* Invoice */}
          <Card className="print:shadow-none print:border-0">
            <CardHeader className="space-y-6">
              {/* Company Header */}
              <div className="flex justify-between items-start">
                <div>
                  <img src={cpfLogo} alt="CustomPictureFrames.com" className="h-12 w-auto mb-3 dark:invert dark:brightness-0 dark:contrast-200" />
                  <div className="text-sm text-muted-foreground space-y-0.5">
                    <p>6 Shirley Ave</p>
                    <p>Somerset, NJ 08873</p>
                    <p>(800) 916-8770</p>
                    <p>hello@CustomPictureFrames.com</p>
                  </div>
                </div>
                <div className="text-right">
                  <h2 className="text-xl font-semibold">ORDER INVOICE</h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    Order #{order.id.slice(0, 8).toUpperCase()}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {new Date(order.orderDate).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </p>
                  <div className="mt-2">
                    {isPaid ? (
                      <Badge variant="default" className="bg-chart-2 text-white">Paid in Full</Badge>
                    ) : hasDeposit ? (
                      <Badge variant="default" className="bg-chart-3 text-white">Deposit Received</Badge>
                    ) : (
                      <Badge variant="secondary">Payment Pending</Badge>
                    )}
                  </div>
                </div>
              </div>

              <Separator />

              {/* Customer Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="font-semibold mb-2">Customer Information</h3>
                  <div className="text-sm space-y-1">
                    <p className="font-medium">{order.customerName}</p>
                    <p className="text-muted-foreground">{order.address1}</p>
                    {order.address2 && <p className="text-muted-foreground">{order.address2}</p>}
                    <p className="text-muted-foreground">{order.cityStateZip}</p>
                    {order.phone && <p className="text-muted-foreground">{order.phone}</p>}
                    {order.email && <p className="text-muted-foreground">{order.email}</p>}
                  </div>
                </div>
                <div>
                  <h3 className="font-semibold mb-2">Order Details</h3>
                  <div className="text-sm space-y-1">
                    {order.description && (
                      <p>
                        <span className="text-muted-foreground">Description:</span>{" "}
                        <span className="font-medium">{order.description}</span>
                      </p>
                    )}
                    <p>
                      <span className="text-muted-foreground">Frame SKU:</span>{" "}
                      <code className="font-mono bg-muted px-1.5 py-0.5 rounded text-xs">
                        {order.frameSku}
                      </code>
                    </p>
                    <p>
                      <span className="text-muted-foreground">Dimensions:</span>{" "}
                      <span className="font-mono">{order.width} × {order.height} inches</span>
                    </p>
                    <p>
                      <span className="text-muted-foreground">Quantity:</span>{" "}
                      <span className="font-mono">{order.quantity}</span>
                    </p>
                  </div>
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-6">
              {/* Specifications */}
              <div>
                <h3 className="font-semibold mb-3">Frame Specifications</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Acrylic Type:</span>
                    <span className="font-medium">{order.acrylicType}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Backing:</span>
                    <span className="font-medium">{order.backingType}</span>
                  </div>
                  {order.chopOnly && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Chop Only:</span>
                      <span className="font-medium">Yes</span>
                    </div>
                  )}
                  {order.mat1Sku && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Mat 1 SKU:</span>
                      <span className="font-mono text-xs">{order.mat1Sku}</span>
                    </div>
                  )}
                  {order.mat2Sku && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Mat 2 SKU:</span>
                      <span className="font-mono text-xs">{order.mat2Sku}</span>
                    </div>
                  )}
                  {order.mat3Sku && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Mat 3 SKU:</span>
                      <span className="font-mono text-xs">{order.mat3Sku}</span>
                    </div>
                  )}
                  {order.extraMatOpenings > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Extra Mat Openings:</span>
                      <span className="font-medium">{order.extraMatOpenings}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Additional Options */}
              {(order.printPaper || order.printCanvas || order.engravedPlaque || order.leds || order.shadowboxFitting || order.additionalLabor || order.dryMount) && (
                <>
                  <Separator />
                  <div>
                    <h3 className="font-semibold mb-3">Additional Options</h3>
                    <div className="flex flex-wrap gap-2">
                      {order.printPaper && (
                        <Badge variant="outline">
                          Print (Paper)
                          {order.printPaperType && `: ${order.printPaperType}`}
                        </Badge>
                      )}
                      {order.dryMount && <Badge variant="outline">Dry Mount</Badge>}
                      {order.printCanvas && (
                        <Badge variant="outline">
                          Print (Canvas)
                          {order.printCanvasWrapStyle && `: ${order.printCanvasWrapStyle}`}
                        </Badge>
                      )}
                      {order.engravedPlaque && (
                        <Badge variant="outline">
                          Engraved Plaque
                          {order.engravedPlaqueSize && `: ${order.engravedPlaqueSize}`}
                        </Badge>
                      )}
                      {order.leds && <Badge variant="outline">LEDs</Badge>}
                      {order.shadowboxFitting && <Badge variant="outline">Shadowbox Fitting</Badge>}
                      {order.additionalLabor && <Badge variant="outline">Additional Labor</Badge>}
                    </div>
                  </div>
                </>
              )}

              {/* Special Requests */}
              {order.specialRequests && (
                <>
                  <Separator />
                  <div>
                    <h3 className="font-semibold mb-2">Special Requests</h3>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                      {order.specialRequests}
                    </p>
                  </div>
                </>
              )}

              <Separator />

              {/* Pricing */}
              <div>
                <h3 className="font-semibold mb-4">Pricing Summary</h3>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Item Total:</span>
                    <span className="font-mono font-medium">
                      ${parseFloat(order.itemTotal).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Shipping:</span>
                    <span className="font-mono font-medium">
                      ${parseFloat(order.shipping).toFixed(2)}
                    </span>
                  </div>
                  {order.salesTax && parseFloat(order.salesTax) > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Sales Tax:</span>
                      <span className="font-mono font-medium">
                        ${parseFloat(order.salesTax).toFixed(2)}
                      </span>
                    </div>
                  )}
                  {order.discountPercent > 0 && (
                    <div className="flex justify-between text-sm text-chart-2">
                      <span>Discount ({order.discountPercent}%):</span>
                      <span className="font-mono font-medium">
                        -$
                        {(
                          (parseFloat(order.itemTotal) +
                            parseFloat(order.shipping) +
                            (order.salesTax ? parseFloat(order.salesTax) : 0)) *
                          (order.discountPercent / 100)
                        ).toFixed(2)}
                      </span>
                    </div>
                  )}

                  <Separator className="my-3" />

                  <div className="flex justify-between text-lg">
                    <span className="font-bold">Total:</span>
                    <span className="font-mono font-bold text-primary" data-testid="text-invoice-total">
                      ${parseFloat(order.total).toFixed(2)}
                    </span>
                  </div>

                  {hasDeposit && (
                    <>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Deposit Paid:</span>
                        <span className="font-mono font-medium">
                          ${parseFloat(order.deposit!).toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between text-lg">
                        <span className="font-bold">Balance Due:</span>
                        <span className="font-mono font-bold" data-testid="text-invoice-balance">
                          ${parseFloat(order.balance).toFixed(2)}
                        </span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
