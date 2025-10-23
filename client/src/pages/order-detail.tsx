import { useQuery } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
import { type Order } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Printer, Download } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";

export default function OrderDetail() {
  const [, params] = useRoute("/order/:id");
  const orderId = params?.id;

  const { data: order, isLoading } = useQuery<Order>({
    queryKey: ["/api/orders", orderId],
    enabled: !!orderId,
  });

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

  if (!order) {
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

  const handlePrint = () => {
    window.print();
  };

  const handleDownload = () => {
    // In a real app, this would generate a PDF
    alert("PDF download would be implemented with a library like jsPDF");
  };

  const hasDeposit = order.deposit && parseFloat(order.deposit) > 0;
  const isPaid = parseFloat(order.balance) === 0;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 md:px-8 py-8">
        <div className="space-y-6">
          {/* Actions */}
          <div className="flex flex-wrap items-center justify-between gap-4 print:hidden">
            <Link href="/orders" asChild>
              <Button variant="ghost" data-testid="button-back">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Orders
              </Button>
            </Link>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handlePrint} data-testid="button-print">
                <Printer className="h-4 w-4 mr-2" />
                Print
              </Button>
              <Button variant="outline" onClick={handleDownload} data-testid="button-download">
                <Download className="h-4 w-4 mr-2" />
                Download PDF
              </Button>
            </div>
          </div>

          {/* Invoice */}
          <Card className="print:shadow-none print:border-0">
            <CardHeader className="space-y-6">
              {/* Company Header */}
              <div className="flex justify-between items-start">
                <div>
                  <h1 className="text-2xl font-bold">CustomPictureFrames.com</h1>
                  <div className="text-sm text-muted-foreground mt-2 space-y-0.5">
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
