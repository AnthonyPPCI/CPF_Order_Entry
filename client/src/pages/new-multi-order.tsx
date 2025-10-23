import { useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Plus, Trash2 } from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

// Simplified form model (not directly tied to Zod schemas)
type MultiOrderForm = {
  header: {
    customerName: string;
    address1: string;
    address2: string;
    cityStateZip: string;
    phone: string;
    email: string;
    deliveryMethod: string;
    description: string;
    specialRequests: string;
    discount: string;
    deposit: string;
  };
  items: Array<{
    frameSku: string;
    width: string;
    height: string;
    mat1Sku: string;
    mat2Sku: string;
    mat3Sku: string;
    quantity: number;
    acrylicType: string;
    backingType: string;
  }>;
};

export default function NewMultiOrder() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [pricing, setPricing] = useState<any>(null);

  const form = useForm<MultiOrderForm>({
    defaultValues: {
      header: {
        customerName: "",
        address1: "",
        address2: "",
        cityStateZip: "",
        phone: "",
        email: "",
        deliveryMethod: "shipping",
        description: "",
        specialRequests: "",
        discount: "",
        deposit: "",
      },
      items: [
        {
          frameSku: "",
          width: "",
          height: "",
          mat1Sku: "",
          mat2Sku: "",
          mat3Sku: "",
          quantity: 1,
          acrylicType: "Standard",
          backingType: "White Foam",
        },
      ],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "items",
  });

  const createOrderMutation = useMutation({
    mutationFn: async (data: MultiOrderForm) => {
      const response = await apiRequest("/api/multi-orders", "POST", data);
      return await response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/multi-orders"] });
      toast({
        title: "Success",
        description: "Multi-item order created successfully",
      });
      navigate(`/multi-order/${data.id}`);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create order",
        variant: "destructive",
      });
    },
  });

  // Calculate pricing preview
  const calculatePricing = async () => {
    try {
      const formData = form.getValues();
      const response = await fetch("/api/multi-pricing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: formData.items,
          customerAddress: {
            cityStateZip: formData.header.cityStateZip,
          },
          deliveryMethod: formData.header.deliveryMethod,
          discount: formData.header.discount,
          deposit: formData.header.deposit,
        }),
      });
      if (response.ok) {
        const pricingData = await response.json();
        setPricing(pricingData);
      }
    } catch (error) {
      console.error("Pricing calculation error:", error);
    }
  };

  // Debounced pricing calculation
  const [pricingTimeout, setPricingTimeout] = useState<NodeJS.Timeout | null>(null);
  const debouncedCalculatePricing = () => {
    if (pricingTimeout) clearTimeout(pricingTimeout);
    const timeout = setTimeout(calculatePricing, 500);
    setPricingTimeout(timeout);
  };

  const onSubmit = (data: MultiOrderForm) => {
    createOrderMutation.mutate(data);
  };

  return (
    <div className="container mx-auto py-8 max-w-5xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Create Multi-Item Order</h1>
        <p className="text-muted-foreground">Add multiple frames/components to a single order</p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} onChange={debouncedCalculatePricing} className="space-y-8">
          {/* Customer Information */}
          <Card data-testid="card-customer-info">
            <CardHeader>
              <CardTitle>Customer Information</CardTitle>
              <CardDescription>Order-level customer details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="header.deliveryMethod"
                render={({ field }) => (
                  <FormItem data-testid="field-delivery-method">
                    <FormLabel>Delivery Method</FormLabel>
                    <FormControl>
                      <RadioGroup
                        onValueChange={field.onChange}
                        value={field.value}
                        className="flex gap-4"
                        data-testid="radio-delivery-method"
                      >
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="shipping" id="shipping" data-testid="radio-shipping" />
                          <label htmlFor="shipping">Shipping</label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="pickup" id="pickup" data-testid="radio-pickup" />
                          <label htmlFor="pickup">Customer Pickup</label>
                        </div>
                      </RadioGroup>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="header.customerName"
                  render={({ field }) => (
                    <FormItem data-testid="field-customer-name">
                      <FormLabel>Customer Name</FormLabel>
                      <FormControl>
                        <Input {...field} data-testid="input-customer-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="header.phone"
                  render={({ field }) => (
                    <FormItem data-testid="field-phone">
                      <FormLabel>Phone</FormLabel>
                      <FormControl>
                        <Input {...field} data-testid="input-phone" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="header.cityStateZip"
                render={({ field }) => (
                  <FormItem data-testid="field-city-state-zip">
                    <FormLabel>City, State, ZIP</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Somerset, NJ 08873" data-testid="input-city-state-zip" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="header.discount"
                  render={({ field }) => (
                    <FormItem data-testid="field-discount">
                      <FormLabel>Discount</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="e.g., 10% or $50" data-testid="input-discount" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="header.deposit"
                  render={({ field }) => (
                    <FormItem data-testid="field-deposit">
                      <FormLabel>Deposit</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="e.g., $100" data-testid="input-deposit" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>

          {/* Items Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold">Order Items</h2>
              <Button
                type="button"
                onClick={() =>
                  append({
                    frameSku: "",
                    width: "",
                    height: "",
                    mat1Sku: "",
                    mat2Sku: "",
                    mat3Sku: "",
                    quantity: 1,
                    acrylicType: "Standard",
                    backingType: "White Foam",
                  })
                }
                variant="outline"
                size="sm"
                data-testid="button-add-item"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Item
              </Button>
            </div>

            {fields.map((field, index) => (
              <Card key={field.id} data-testid={`card-item-${index}`}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CardTitle>Item #{index + 1}</CardTitle>
                      {pricing?.items?.[index] && (
                        <Badge variant="outline" data-testid={`badge-item-total-${index}`}>
                          ${pricing.items[index].itemTotal}
                        </Badge>
                      )}
                    </div>
                    {fields.length > 1 && (
                      <Button
                        type="button"
                        variant="destructive"
                        size="icon"
                        onClick={() => remove(index)}
                        data-testid={`button-remove-${index}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-3 gap-4">
                    <FormField
                      control={form.control}
                      name={`items.${index}.frameSku`}
                      render={({ field }) => (
                        <FormItem data-testid={`field-frame-sku-${index}`}>
                          <FormLabel>Frame SKU</FormLabel>
                          <FormControl>
                            <Input {...field} data-testid={`input-frame-sku-${index}`} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name={`items.${index}.width`}
                      render={({ field }) => (
                        <FormItem data-testid={`field-width-${index}`}>
                          <FormLabel>Width</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="16" data-testid={`input-width-${index}`} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name={`items.${index}.height`}
                      render={({ field }) => (
                        <FormItem data-testid={`field-height-${index}`}>
                          <FormLabel>Height</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="20" data-testid={`input-height-${index}`} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <FormField
                      control={form.control}
                      name={`items.${index}.mat1Sku`}
                      render={({ field }) => (
                        <FormItem data-testid={`field-mat1-sku-${index}`}>
                          <FormLabel>Mat 1 SKU</FormLabel>
                          <FormControl>
                            <Input {...field} data-testid={`input-mat1-sku-${index}`} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name={`items.${index}.mat2Sku`}
                      render={({ field }) => (
                        <FormItem data-testid={`field-mat2-sku-${index}`}>
                          <FormLabel>Mat 2 SKU</FormLabel>
                          <FormControl>
                            <Input {...field} data-testid={`input-mat2-sku-${index}`} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name={`items.${index}.quantity`}
                      render={({ field }) => (
                        <FormItem data-testid={`field-quantity-${index}`}>
                          <FormLabel>Quantity</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              {...field}
                              onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                              data-testid={`input-quantity-${index}`}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Order Summary */}
          {pricing && (
            <Card data-testid="card-order-summary">
              <CardHeader>
                <CardTitle>Order Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>Subtotal ({pricing.items.length} items):</span>
                    <span className="font-semibold" data-testid="text-subtotal">
                      ${pricing.subtotal}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Shipping:</span>
                    <span className="font-semibold" data-testid="text-shipping">
                      ${pricing.shipping}
                    </span>
                  </div>
                  {pricing.salesTax && (
                    <div className="flex justify-between">
                      <span>Sales Tax (NJ 7%):</span>
                      <span className="font-semibold" data-testid="text-sales-tax">
                        ${pricing.salesTax}
                      </span>
                    </div>
                  )}
                  <Separator />
                  <div className="flex justify-between text-lg">
                    <span className="font-bold">Total:</span>
                    <span className="font-bold" data-testid="text-total">
                      ${pricing.total}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Balance Due:</span>
                    <span className="font-semibold" data-testid="text-balance">
                      ${pricing.balance}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Submit Button */}
          <div className="flex justify-end gap-4">
            <Button type="button" variant="outline" onClick={() => navigate("/orders")} data-testid="button-cancel">
              Cancel
            </Button>
            <Button type="submit" disabled={createOrderMutation.isPending} data-testid="button-submit">
              {createOrderMutation.isPending ? "Creating..." : "Create Multi-Item Order"}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
