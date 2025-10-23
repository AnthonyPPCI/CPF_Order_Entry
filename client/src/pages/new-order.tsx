import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertOrderSchema, type InsertOrder } from "@shared/schema";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useState, useEffect } from "react";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { MatCombobox } from "@/components/mat-combobox";

// Helper function to parse fractions and decimals
function parseFraction(input: string): number {
  if (!input || input.trim() === "") return 0;
  
  const str = input.trim();
  
  // Check if it's a mixed fraction like "16 1/2" or "16-1/2"
  const mixedMatch = str.match(/^(\d+)[\s-]+(\d+)\/(\d+)$/);
  if (mixedMatch) {
    const whole = parseInt(mixedMatch[1]);
    const numerator = parseInt(mixedMatch[2]);
    const denominator = parseInt(mixedMatch[3]);
    return whole + (numerator / denominator);
  }
  
  // Check if it's a simple fraction like "1/2"
  const fractionMatch = str.match(/^(\d+)\/(\d+)$/);
  if (fractionMatch) {
    const numerator = parseInt(fractionMatch[1]);
    const denominator = parseInt(fractionMatch[2]);
    return numerator / denominator;
  }
  
  // Otherwise parse as decimal
  return parseFloat(str) || 0;
}

export default function NewOrder() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [widthText, setWidthText] = useState("12");
  const [heightText, setHeightText] = useState("16");
  const [calculatedPricing, setCalculatedPricing] = useState({
    itemTotal: 0,
    shipping: 0,
    salesTax: 0,
    total: 0,
    balance: 0,
  });

  const form = useForm<InsertOrder>({
    resolver: zodResolver(insertOrderSchema),
    defaultValues: {
      customerName: "",
      address1: "",
      address2: "",
      cityStateZip: "",
      phone: "",
      email: "",
      deliveryMethod: "shipping",
      description: "",
      specialRequests: "",
      frameSku: "",
      chopOnly: false,
      width: 12,
      height: 16,
      matBorderAll: "",
      matBorderLeft: "",
      matBorderRight: "",
      matBorderTop: "",
      matBorderBottom: "",
      mat1Sku: "",
      mat1Reveal: "",
      mat2Sku: "",
      mat2Reveal: "",
      mat3Sku: "",
      extraMatOpenings: 0,
      acrylicType: "Standard",
      backingType: "White Foam",
      printPaper: false,
      printPaperType: "",
      dryMount: false,
      printCanvas: false,
      printCanvasWrapStyle: "",
      engravedPlaque: false,
      engravedPlaqueSize: "",
      leds: false,
      shadowboxFitting: false,
      additionalLabor: false,
      quantity: 1,
      discount: "",
      deposit: "",
    },
  });

  const createOrderMutation = useMutation({
    mutationFn: async (data: InsertOrder) => {
      const response = await apiRequest("POST", "/api/orders", data);
      return await response.json();
    },
    onSuccess: (createdOrder: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      toast({
        title: "Order Created",
        description: "Your custom frame order has been created successfully.",
      });
      // Navigate directly to the order detail page with action buttons
      setLocation(`/order/${createdOrder.id}`);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create order",
        variant: "destructive",
      });
    },
  });

  // Watch form values for pricing calculation
  const watchedValues = form.watch();

  useEffect(() => {
    // Debounce pricing API call
    const timer = setTimeout(async () => {
      try {
        const response = await fetch('/api/pricing', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(watchedValues),
        });
        
        if (response.ok) {
          const pricing = await response.json();
          setCalculatedPricing({
            itemTotal: parseFloat(pricing.itemTotal),
            shipping: parseFloat(pricing.shipping),
            salesTax: pricing.salesTax ? parseFloat(pricing.salesTax) : 0,
            total: parseFloat(pricing.total),
            balance: parseFloat(pricing.balance),
          });
        }
      } catch (error) {
        // Silent fail - keep showing last pricing
        console.error('Pricing calculation error:', error);
      }
    }, 500); // 500ms debounce

    return () => clearTimeout(timer);
  }, [watchedValues]);

  const onSubmit = (data: InsertOrder) => {
    // Remove pricing fields - server will calculate them
    const { itemTotal, shipping, salesTax, total, balance, ...orderData } = data as any;
    createOrderMutation.mutate(orderData);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 md:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Form */}
          <div className="lg:col-span-2 space-y-6">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                {/* Customer Information */}
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0 pb-6">
                    <CardTitle className="text-xl">Customer Information</CardTitle>
                    <FormField
                      control={form.control}
                      name="deliveryMethod"
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <div className="flex items-center gap-4">
                              <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                  type="radio"
                                  value="shipping"
                                  checked={field.value === "shipping"}
                                  onChange={() => field.onChange("shipping")}
                                  className="w-4 h-4"
                                  data-testid="radio-shipping"
                                />
                                <span className="text-sm font-medium">Shipping</span>
                              </label>
                              <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                  type="radio"
                                  value="pickup"
                                  checked={field.value === "pickup"}
                                  onChange={() => field.onChange("pickup")}
                                  className="w-4 h-4"
                                  data-testid="radio-pickup"
                                />
                                <span className="text-sm font-medium">Customer Pickup</span>
                              </label>
                            </div>
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <FormField
                      control={form.control}
                      name="customerName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Customer Name *</FormLabel>
                          <FormControl>
                            <Input {...field} data-testid="input-customer-name" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="address1"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Address 1 *</FormLabel>
                            <FormControl>
                              <Input {...field} data-testid="input-address1" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="address2"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Address 2</FormLabel>
                            <FormControl>
                              <Input {...field} value={field.value || ""} data-testid="input-address2" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={form.control}
                      name="cityStateZip"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>City, State, Zip *</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="e.g., Old Bridge, NJ 08857" data-testid="input-city-state-zip" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="phone"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Phone</FormLabel>
                            <FormControl>
                              <Input {...field} value={field.value || ""} type="tel" data-testid="input-phone" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Email</FormLabel>
                            <FormControl>
                              <Input {...field} value={field.value || ""} type="email" data-testid="input-email" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </CardContent>
                </Card>

                {/* Frame Configuration */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-xl">Frame Configuration</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="frameSku"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Frame SKU *</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="e.g., 8694" className="font-mono" data-testid="input-frame-sku" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="chopOnly"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-center space-x-3 space-y-0 pt-8">
                            <FormControl>
                              <Checkbox
                                checked={field.value}
                                onCheckedChange={field.onChange}
                                data-testid="checkbox-chop-only"
                              />
                            </FormControl>
                            <FormLabel className="font-normal cursor-pointer">
                              Chop Only
                            </FormLabel>
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <FormField
                        control={form.control}
                        name="width"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Width (inches) *</FormLabel>
                            <FormControl>
                              <Input
                                type="text"
                                placeholder="e.g., 16.5 or 16 1/2"
                                onChange={(e) => {
                                  setWidthText(e.target.value);
                                  const parsed = parseFraction(e.target.value);
                                  field.onChange(parsed);
                                }}
                                value={widthText}
                                data-testid="input-width"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="height"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Height (inches) *</FormLabel>
                            <FormControl>
                              <Input
                                type="text"
                                placeholder="e.g., 20 or 20 1/4"
                                onChange={(e) => {
                                  setHeightText(e.target.value);
                                  const parsed = parseFraction(e.target.value);
                                  field.onChange(parsed);
                                }}
                                value={heightText}
                                data-testid="input-height"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="quantity"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Quantity *</FormLabel>
                            <FormControl>
                              <Input
                                {...field}
                                type="number"
                                onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                                data-testid="input-quantity"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <Separator />

                    {/* Mat Configuration */}
                    <Accordion type="single" collapsible className="w-full" data-testid="accordion-mat-configuration">
                      <AccordionItem value="mat-config">
                        <AccordionTrigger className="text-base font-semibold hover:no-underline" data-testid="accordion-trigger-mat-config">
                          Mat Configuration
                        </AccordionTrigger>
                        <AccordionContent className="space-y-6 pt-4">
                          {/* Mat Borders */}
                          <div className="space-y-4">
                            <h4 className="text-sm font-semibold text-muted-foreground">Mat Borders</h4>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                              <FormField
                                control={form.control}
                                name="matBorderAll"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel className="text-sm">All Sides</FormLabel>
                                    <FormControl>
                                      <Input {...field} value={field.value || ""} placeholder="e.g., 2.5 or 2 1/2" data-testid="input-mat-border-all" />
                                    </FormControl>
                                  </FormItem>
                                )}
                              />
                              <FormField
                                control={form.control}
                                name="matBorderLeft"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel className="text-sm">Left</FormLabel>
                                    <FormControl>
                                      <Input {...field} value={field.value || ""} placeholder="e.g., 2.5 or 2 1/2" data-testid="input-mat-border-left" />
                                    </FormControl>
                                  </FormItem>
                                )}
                              />
                              <FormField
                                control={form.control}
                                name="matBorderRight"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel className="text-sm">Right</FormLabel>
                                    <FormControl>
                                      <Input {...field} value={field.value || ""} placeholder="e.g., 2.5 or 2 1/2" data-testid="input-mat-border-right" />
                                    </FormControl>
                                  </FormItem>
                                )}
                              />
                              <FormField
                                control={form.control}
                                name="matBorderTop"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel className="text-sm">Top</FormLabel>
                                    <FormControl>
                                      <Input {...field} value={field.value || ""} placeholder="e.g., 2.5 or 2 1/2" data-testid="input-mat-border-top" />
                                    </FormControl>
                                  </FormItem>
                                )}
                              />
                              <FormField
                                control={form.control}
                                name="matBorderBottom"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel className="text-sm">Bottom</FormLabel>
                                    <FormControl>
                                      <Input {...field} value={field.value || ""} placeholder="e.g., 2.5 or 2 1/2" data-testid="input-mat-border-bottom" />
                                    </FormControl>
                                  </FormItem>
                                )}
                              />
                            </div>
                          </div>

                          {/* Mat Layers */}
                          <div className="space-y-4">
                            <h4 className="text-sm font-semibold text-muted-foreground">Mat Layers</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <FormField
                                control={form.control}
                                name="mat1Sku"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel className="text-sm">Mat 1 SKU</FormLabel>
                                    <FormControl>
                                      <MatCombobox
                                        value={field.value || ""}
                                        onChange={field.onChange}
                                        placeholder="Select mat 1..."
                                      />
                                    </FormControl>
                                  </FormItem>
                                )}
                              />
                              <FormField
                                control={form.control}
                                name="mat1Reveal"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel className="text-sm">Mat 1 Reveal</FormLabel>
                                    <FormControl>
                                      <Input {...field} value={field.value || ""} placeholder="e.g., 0.125" data-testid="input-mat1-reveal" />
                                    </FormControl>
                                  </FormItem>
                                )}
                              />
                              <FormField
                                control={form.control}
                                name="mat2Sku"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel className="text-sm">Mat 2 SKU</FormLabel>
                                    <FormControl>
                                      <MatCombobox
                                        value={field.value || ""}
                                        onChange={field.onChange}
                                        placeholder="Select mat 2..."
                                      />
                                    </FormControl>
                                  </FormItem>
                                )}
                              />
                              <FormField
                                control={form.control}
                                name="mat2Reveal"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel className="text-sm">Mat 2 Reveal</FormLabel>
                                    <FormControl>
                                      <Input {...field} value={field.value || ""} placeholder="e.g., 0.125" data-testid="input-mat2-reveal" />
                                    </FormControl>
                                  </FormItem>
                                )}
                              />
                              <FormField
                                control={form.control}
                                name="mat3Sku"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel className="text-sm">Mat 3 SKU</FormLabel>
                                    <FormControl>
                                      <MatCombobox
                                        value={field.value || ""}
                                        onChange={field.onChange}
                                        placeholder="Select mat 3..."
                                      />
                                    </FormControl>
                                  </FormItem>
                                )}
                              />
                              <FormField
                                control={form.control}
                                name="extraMatOpenings"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel className="text-sm">Extra Mat Openings (after the first opening)</FormLabel>
                                    <FormControl>
                                      <Input
                                        {...field}
                                        type="number"
                                        onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                                        data-testid="input-extra-mat-openings"
                                      />
                                    </FormControl>
                                  </FormItem>
                                )}
                              />
                            </div>
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    </Accordion>
                  </CardContent>
                </Card>

                {/* Materials & Options */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-xl">Materials & Options</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="acrylicType"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Acrylic Type</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger data-testid="select-acrylic-type">
                                  <SelectValue />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="Standard">Standard</SelectItem>
                                <SelectItem value="Museum Quality">Museum Quality</SelectItem>
                                <SelectItem value="Non-Glare">Non-Glare</SelectItem>
                              </SelectContent>
                            </Select>
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="backingType"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Backing Type</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger data-testid="select-backing-type">
                                  <SelectValue />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="White Foam">White Foam</SelectItem>
                                <SelectItem value="Acid Free">Acid Free</SelectItem>
                                <SelectItem value="Black Foam">Black Foam</SelectItem>
                              </SelectContent>
                            </Select>
                          </FormItem>
                        )}
                      />
                    </div>

                    <Separator />

                    <div className="space-y-4">
                      <h3 className="text-base font-semibold">Additional Options</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-3">
                          <FormField
                            control={form.control}
                            name="printPaper"
                            render={({ field }) => (
                              <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                                <FormControl>
                                  <Checkbox
                                    checked={field.value}
                                    onCheckedChange={field.onChange}
                                    data-testid="checkbox-print-paper"
                                  />
                                </FormControl>
                                <FormLabel className="font-normal cursor-pointer">Print (Paper)</FormLabel>
                              </FormItem>
                            )}
                          />
                          {form.watch("printPaper") && (
                            <FormField
                              control={form.control}
                              name="printPaperType"
                              render={({ field }) => (
                                <FormItem className="ml-6">
                                  <FormControl>
                                    <Input {...field} value={field.value || ""} placeholder="Paper type" data-testid="input-print-paper-type" />
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                          )}

                          <FormField
                            control={form.control}
                            name="dryMount"
                            render={({ field }) => (
                              <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                                <FormControl>
                                  <Checkbox
                                    checked={field.value}
                                    onCheckedChange={field.onChange}
                                    data-testid="checkbox-dry-mount"
                                  />
                                </FormControl>
                                <FormLabel className="font-normal cursor-pointer">Dry Mount</FormLabel>
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name="printCanvas"
                            render={({ field }) => (
                              <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                                <FormControl>
                                  <Checkbox
                                    checked={field.value}
                                    onCheckedChange={field.onChange}
                                    data-testid="checkbox-print-canvas"
                                  />
                                </FormControl>
                                <FormLabel className="font-normal cursor-pointer">Print (Canvas)</FormLabel>
                              </FormItem>
                            )}
                          />
                          {form.watch("printCanvas") && (
                            <FormField
                              control={form.control}
                              name="printCanvasWrapStyle"
                              render={({ field }) => (
                                <FormItem className="ml-6">
                                  <FormControl>
                                    <Input {...field} value={field.value || ""} placeholder="Wrap style" data-testid="input-print-canvas-wrap-style" />
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                          )}

                          <FormField
                            control={form.control}
                            name="engravedPlaque"
                            render={({ field }) => (
                              <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                                <FormControl>
                                  <Checkbox
                                    checked={field.value}
                                    onCheckedChange={field.onChange}
                                    data-testid="checkbox-engraved-plaque"
                                  />
                                </FormControl>
                                <FormLabel className="font-normal cursor-pointer">Engraved Plaque</FormLabel>
                              </FormItem>
                            )}
                          />
                          {form.watch("engravedPlaque") && (
                            <FormField
                              control={form.control}
                              name="engravedPlaqueSize"
                              render={({ field }) => (
                                <FormItem className="ml-6">
                                  <FormControl>
                                    <Input {...field} value={field.value || ""} placeholder="Plaque size" data-testid="input-engraved-plaque-size" />
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                          )}
                        </div>

                        <div className="space-y-3">
                          <FormField
                            control={form.control}
                            name="leds"
                            render={({ field }) => (
                              <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                                <FormControl>
                                  <Checkbox
                                    checked={field.value}
                                    onCheckedChange={field.onChange}
                                    data-testid="checkbox-leds"
                                  />
                                </FormControl>
                                <FormLabel className="font-normal cursor-pointer">LEDs</FormLabel>
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name="shadowboxFitting"
                            render={({ field }) => (
                              <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                                <FormControl>
                                  <Checkbox
                                    checked={field.value}
                                    onCheckedChange={field.onChange}
                                    data-testid="checkbox-shadowbox-fitting"
                                  />
                                </FormControl>
                                <FormLabel className="font-normal cursor-pointer">Shadowbox Fitting</FormLabel>
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name="additionalLabor"
                            render={({ field }) => (
                              <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                                <FormControl>
                                  <Checkbox
                                    checked={field.value}
                                    onCheckedChange={field.onChange}
                                    data-testid="checkbox-additional-labor"
                                  />
                                </FormControl>
                                <FormLabel className="font-normal cursor-pointer">Additional Labor</FormLabel>
                              </FormItem>
                            )}
                          />
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Order Details */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-xl">Order Details</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <FormField
                      control={form.control}
                      name="description"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Description</FormLabel>
                          <FormControl>
                            <Input {...field} value={field.value || ""} placeholder="e.g., F8694_12x24_NGA" data-testid="input-description" />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="specialRequests"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Special Requests</FormLabel>
                          <FormControl>
                            <Textarea {...field} value={field.value || ""} rows={3} data-testid="textarea-special-requests" />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="discount"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Discount</FormLabel>
                            <FormControl>
                              <Input
                                {...field}
                                value={field.value || ""}
                                placeholder="e.g., 10% or $50"
                                data-testid="input-discount"
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="deposit"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Deposit</FormLabel>
                            <FormControl>
                              <Input {...field} value={field.value || ""} placeholder="e.g., $100" data-testid="input-deposit" />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </div>
                  </CardContent>
                </Card>
              </form>
            </Form>
          </div>

          {/* Pricing Sidebar */}
          <div className="lg:col-span-1">
            <div className="sticky top-24 space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-xl">Order Summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Frame Size:</span>
                      <span className="font-mono font-medium" data-testid="text-frame-size">
                        {form.watch("width")} × {form.watch("height")} in
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Quantity:</span>
                      <span className="font-mono font-medium" data-testid="text-quantity">
                        {form.watch("quantity")}
                      </span>
                    </div>
                    {/\b(HI|AK|PR|Hawaii|Alaska|Puerto Rico)\b/i.test(form.watch("cityStateZip") || "") && (
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-xs">Remote Destination</Badge>
                      </div>
                    )}
                  </div>

                  <Separator />

                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Item Total:</span>
                      <span className="font-mono font-semibold" data-testid="text-item-total">
                        ${calculatedPricing.itemTotal.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Shipping:</span>
                      <span className="font-mono font-semibold" data-testid="text-shipping">
                        ${calculatedPricing.shipping.toFixed(2)}
                      </span>
                    </div>
                    {calculatedPricing.salesTax > 0 && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Sales Tax:</span>
                        <span className="font-mono font-semibold" data-testid="text-sales-tax">
                          ${calculatedPricing.salesTax.toFixed(2)}
                        </span>
                      </div>
                    )}
                  </div>

                  <Separator />

                  <div className="space-y-3">
                    <div className="flex justify-between text-lg">
                      <span className="font-semibold">Total:</span>
                      <span className="font-mono font-bold text-primary" data-testid="text-total">
                        ${calculatedPricing.total.toFixed(2)}
                      </span>
                    </div>
                    {form.watch("deposit") && parseFloat(form.watch("deposit") || "0") > 0 && (
                      <>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Deposit:</span>
                          <span className="font-mono">
                            ${parseFloat(form.watch("deposit") || "0").toFixed(2)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="font-semibold">Balance Due:</span>
                          <span className="font-mono font-bold" data-testid="text-balance">
                            ${calculatedPricing.balance.toFixed(2)}
                          </span>
                        </div>
                      </>
                    )}
                  </div>

                  <Button
                    type="submit"
                    className="w-full"
                    size="lg"
                    disabled={createOrderMutation.isPending}
                    onClick={form.handleSubmit(onSubmit)}
                    data-testid="button-create-order"
                  >
                    {createOrderMutation.isPending ? "Creating Order..." : "Create Order"}
                  </Button>
                </CardContent>
              </Card>

              <Card className="bg-muted/30">
                <CardContent className="pt-6">
                  <div className="text-xs text-muted-foreground space-y-1">
                    <p className="font-medium text-foreground mb-2">Pricing Information</p>
                    <p>• Base price calculated from frame perimeter</p>
                    <p>• Additional charges apply for premium materials</p>
                    <p>• Remote destinations (HI, AK, PR) have higher shipping</p>
                    <p>• Sales tax applied for NJ deliveries</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
