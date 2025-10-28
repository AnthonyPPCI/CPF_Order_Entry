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
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useState, useEffect } from "react";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { MatCombobox } from "@/components/mat-combobox";
import { SquarePaymentForm, useSquarePaymentForm } from "@/components/SquarePaymentForm";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { X, Plus, ChevronDown, HelpCircle, Star } from "lucide-react";

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

// Helper function to parse discount values (matches backend logic)
function parseDiscount(discountInput: string, subtotal: number): number {
  if (!discountInput || discountInput.trim() === "") return 0;
  
  const str = discountInput.trim();
  
  // Check if it's a percentage (e.g., "10%", "15%")
  if (str.includes('%')) {
    const percentValue = parseFloat(str.replace('%', '').trim());
    if (isNaN(percentValue)) return 0;
    return (percentValue / 100) * subtotal;
  }
  
  // Check if it's a dollar amount (e.g., "$10", "$10.50")
  if (str.includes('$')) {
    const dollarValue = parseFloat(str.replace('$', '').trim());
    return isNaN(dollarValue) ? 0 : dollarValue;
  }
  
  // Reject plain numbers - must have $ or %
  return 0;
}

export default function NewOrder() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [widthText, setWidthText] = useState("12");
  const [heightText, setHeightText] = useState("16");
  const [pendingItems, setPendingItems] = useState<InsertOrder[]>([]);
  const [editingItemIndex, setEditingItemIndex] = useState<number | null>(null);
  const [paymentAmount, setPaymentAmount] = useState("0.00");
  const [skipPayment, setSkipPayment] = useState(false);
  const [activePaymentMethod, setActivePaymentMethod] = useState<string | undefined>(undefined);
  const [processedPayment, setProcessedPayment] = useState<{ 
    type: 'credit_card' | 'cash' | 'paypal', 
    token?: string, 
    amount: string,
    status?: 'ready' | 'charged' | 'failed',
    paymentId?: string,
    errorMessage?: string
  } | null>(null);
  const { tokenize } = useSquarePaymentForm();
  const [calculatedPricing, setCalculatedPricing] = useState({
    itemTotal: 0,
    shipping: 0,
    salesTax: 0,
    total: 0,
    balance: 0,
    breakdown: {
      frameCost: "0.00",
      mat1Cost: "0.00",
      mat2Cost: "0.00",
      mat3Cost: "0.00",
      acrylicCost: "0.00",
      backingCost: "0.00",
      printPaperCost: "0.00",
      dryMountCost: "0.00",
      printCanvasCost: "0.00",
      canvasStretchingCost: "0.00",
      engravedPlaqueCost: "0.00",
      ledsCost: "0.00",
      shadowboxFittingCost: "0.00",
      additionalLaborCost: "0.00",
      extraMatOpeningsCost: "0.00",
    },
    bom: [] as string[],
  });

  const form = useForm<InsertOrder & { cashAmount?: string, smsConsent?: boolean }>({
    resolver: zodResolver(insertOrderSchema.extend({ cashAmount: insertOrderSchema.shape.deposit })),
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
      smsConsent: true,
      frameSku: "",
      chopOnly: false,
      sample: false,
      syncToShipstation: false,
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
      backingSku: "White Foam",
      printPaper: false,
      printPaperType: "",
      dryMount: false,
      printCanvas: false,
      printCanvasWrapStyle: "",
      canvasStretching: false,
      engravedPlaque: false,
      engravedPlaqueSize: "",
      engravedPlaqueColor: "",
      engravedPlaqueFont: "",
      engravedPlaqueText1: "",
      engravedPlaqueText2: "",
      engravedPlaqueText3: "",
      engravedPlaqueTextAdditional: [],
      leds: false,
      shadowboxFitting: false,
      additionalLabor: false,
      stackerFrame: false,
      shadowDepth: "",
      quantity: 1,
      discount: "",
      deposit: "",
      cashAmount: "",
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
        title: "Order Created & Recorded",
        description: `Order #${createdOrder.id?.slice(0, 8).toUpperCase()} has been created and recorded in the system.`,
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

  const createMultiItemOrderMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest("POST", "/api/multi-orders", data);
      return await response.json();
    },
    onSuccess: (createdOrder: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      toast({
        title: "Multi-Item Order Created & Recorded",
        description: `Order #${createdOrder.id?.slice(0, 8).toUpperCase()} with ${createdOrder.items?.length || 0} items has been created and recorded in the system.`,
      });
      // Navigate to the order detail page
      setLocation(`/order/${createdOrder.id}`);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create multi-item order",
        variant: "destructive",
      });
    },
  });

  // Watch form values for pricing calculation - watch all fields to trigger recalculation
  const watchedValues = form.watch();

  useEffect(() => {
    // Debounce pricing API call
    const timer = setTimeout(async () => {
      try {
        // Get fresh form values to ensure we have the latest state
        const currentValues = form.getValues();
        
        const response = await fetch('/api/pricing', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(currentValues),
        });
        
        if (response.ok) {
          const pricing = await response.json();
          setCalculatedPricing({
            itemTotal: parseFloat(pricing.itemTotal),
            shipping: parseFloat(pricing.shipping),
            salesTax: pricing.salesTax ? parseFloat(pricing.salesTax) : 0,
            total: parseFloat(pricing.total),
            balance: parseFloat(pricing.balance),
            breakdown: pricing.breakdown,
            bom: pricing.bom || [],
          });
        }
      } catch (error) {
        // Silent fail - keep showing last pricing
        console.error('Pricing calculation error:', error);
      }
    }, 500); // 500ms debounce

    return () => clearTimeout(timer);
  }, [watchedValues, form]);

  // Auto-populate Frame SKU with topper SKU when building stacker frames
  useEffect(() => {
    const stackerFrame = form.watch("stackerFrame");
    const topperSku = form.watch("topperSku");
    
    if (stackerFrame && topperSku) {
      // Only auto-populate if frameSku is empty or already contains a topper SKU
      const currentFrameSku = form.getValues("frameSku");
      if (!currentFrameSku || currentFrameSku === "9731" || currentFrameSku === "9531") {
        form.setValue("frameSku", topperSku);
      }
    }
  }, [form.watch("stackerFrame"), form.watch("topperSku")]);

  // Auto-update payment amount when total changes
  useEffect(() => {
    setPaymentAmount(calculatedPricing.total.toFixed(2));
  }, [calculatedPricing.total]);

  // Clear processed payment if amounts change (prevents stale payment data)
  useEffect(() => {
    if (processedPayment) {
      // Clear credit card payment if amount changed
      if (processedPayment.type === 'credit_card' && processedPayment.amount !== paymentAmount) {
        setProcessedPayment(null);
        toast({
          title: "Payment Cleared",
          description: "Order total changed. Please process payment again.",
          variant: "default"
        });
      }
      // Clear cash payment if amount changed
      if (processedPayment.type === 'cash' && processedPayment.amount !== form.watch("cashAmount")) {
        setProcessedPayment(null);
        toast({
          title: "Payment Cleared",
          description: "Cash amount changed. Please record payment again.",
          variant: "default"
        });
      }
    }
  }, [paymentAmount, form.watch("cashAmount"), processedPayment]);

  // Clear processed payment when accordion changes (switching payment methods)
  useEffect(() => {
    if (processedPayment && activePaymentMethod) {
      const isWrongMethod = 
        (processedPayment.type === 'credit_card' && activePaymentMethod !== 'credit-card') ||
        (processedPayment.type === 'cash' && activePaymentMethod !== 'cash');
      
      if (isWrongMethod) {
        setProcessedPayment(null);
        toast({
          title: "Payment Cleared",
          description: "Switched payment method. Please process payment again.",
          variant: "default"
        });
      }
    }
  }, [activePaymentMethod, processedPayment]);

  // Handler to process credit card payment
  const handleProcessCreditCard = async () => {
    if (!paymentAmount || parseFloat(paymentAmount) <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid payment amount.",
        variant: "destructive"
      });
      return;
    }

    // Show processing toast
    toast({
      title: "Processing Payment...",
      description: "Charging card, please wait...",
    });

    try {
      // Step 1: Tokenize the card
      const result = await tokenize();
      if (!result.token) {
        throw new Error(result.error || "Card tokenization failed");
      }

      // Step 2: Charge the card immediately (without order ID)
      const response = await fetch('/api/process-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: parseFloat(paymentAmount).toFixed(2),
          sourceId: result.token,
        }),
      });

      const data = await response.json();

      if (response.ok && data.success && data.status === 'COMPLETED') {
        // Payment succeeded
        setProcessedPayment({
          type: 'credit_card',
          token: result.token,
          amount: paymentAmount,
          status: 'charged',
          paymentId: data.paymentId
        });
        toast({
          title: "✅ Payment Accepted",
          description: `$${paymentAmount} charged successfully. Payment ID: ${data.paymentId.substring(0, 8)}...`,
        });
      } else {
        // Payment failed or declined
        const errorMsg = data.error || "Payment declined";
        setProcessedPayment({
          type: 'credit_card',
          token: result.token,
          amount: paymentAmount,
          status: 'failed',
          errorMessage: errorMsg
        });
        toast({
          title: "❌ Payment Declined",
          description: errorMsg,
          variant: "destructive"
        });
      }
    } catch (error: any) {
      console.error('Payment error:', error);
      toast({
        title: "Payment Error",
        description: error.message || "Failed to process payment. Please try again.",
        variant: "destructive"
      });
    }
  };

  // Handler to record cash payment
  const handleRecordCash = () => {
    const cashAmount = form.watch("cashAmount");
    if (!cashAmount || parseFloat(cashAmount) <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid cash amount.",
        variant: "destructive"
      });
      return;
    }

    setProcessedPayment({
      type: 'cash',
      amount: cashAmount
    });
    toast({
      title: "Cash Payment Ready",
      description: `Cash payment of $${cashAmount} will be recorded when you create the order.`,
    });
  };

  const onSubmit = async (data: InsertOrder & { cashAmount?: string }) => {
    // Remove pricing fields - server will calculate them
    const { itemTotal, shipping, salesTax, total, balance, cashAmount, ...orderData } = data as any;
    
    // Use pre-processed payment if available
    let paymentData = null;
    let paymentMethodValue = null;
    let orderDataWithPayment = { ...orderData };
    
    if (processedPayment) {
      // Use the already-processed payment (allows partial payments for deposits)
      if (processedPayment.type === 'credit_card') {
        paymentData = {
          sourceId: processedPayment.token,
          amount: processedPayment.amount
        };
        paymentMethodValue = "credit_card";
      } else if (processedPayment.type === 'cash') {
        paymentMethodValue = "cash";
        orderDataWithPayment.paidToDate = processedPayment.amount;
      } else if (processedPayment.type === 'paypal') {
        paymentMethodValue = "paypal";
      }
    }
    
    // Add payment method to order data
    orderDataWithPayment.paymentMethod = paymentMethodValue;
    
    if (pendingItems.length > 0) {
      // Multi-item order: combine pending items with current item
      let allItems;
      
      if (editingItemIndex !== null) {
        // User is editing an existing item - replace it in pendingItems
        const updated = [...pendingItems];
        updated[editingItemIndex] = orderData;
        allItems = updated;
      } else {
        // User is adding a new item - append to pendingItems
        allItems = [...pendingItems, orderData];
      }
      
      // Extract customer/order-level data from the first item (current form)
      const { 
        customerName, address1, address2, cityStateZip, phone, email,
        deliveryMethod, description, specialRequests, discount, deposit,
        ...firstItemData
      } = orderData;
      
      const multiItemOrderData = {
        header: {
          customerName,
          address1,
          address2,
          cityStateZip,
          phone,
          email,
          deliveryMethod,
          description,
          specialRequests,
          discount,
          deposit,
        },
        items: allItems.map((item: any) => {
          // Remove customer fields from each item, keep only item-specific fields
          const { 
            customerName: _, address1: __, address2: ___, cityStateZip: ____, 
            phone: _____, email: ______, deliveryMethod: _______,
            description: ________, specialRequests: _________, 
            discount: __________, deposit: ___________,
            ...itemData 
          } = item;
          return itemData;
        }),
        paymentData,
      };
      
      // For multi-item orders, use standard endpoint (payment not yet supported for multi-item)
      try {
        if (paymentData) {
          toast({
            title: "Note",
            description: "Payment processing for multi-item orders will be available soon. Creating order without payment.",
          });
        }
        
        // Remove paymentData from multi-item order data
        const { paymentData: _, ...multiItemOrderDataWithoutPayment } = multiItemOrderData;
        
        const response = await apiRequest('POST', '/api/multi-orders', multiItemOrderDataWithoutPayment);
        const createdOrder = await response.json();
        queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
        
        // Send PayPal invoice if payment method is PayPal
        if (paymentMethodValue === 'paypal') {
          try {
            const paypalResponse = await fetch('/api/create-paypal-invoice', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ orderId: createdOrder.id, isMultiItem: true }),
            });
            
            if (paypalResponse.ok) {
              const paypalData = await paypalResponse.json();
              toast({
                title: "Multi-Item Order Created & PayPal Invoice Sent",
                description: `Order #${createdOrder.id?.slice(0, 8).toUpperCase()} created. PayPal invoice sent to ${orderData.email}.`,
              });
            } else {
              throw new Error('Failed to send PayPal invoice');
            }
          } catch (paypalError: any) {
            toast({
              title: "Order Created, but PayPal Invoice Failed",
              description: `Order created successfully, but couldn't send PayPal invoice: ${paypalError.message}`,
              variant: "destructive",
            });
          }
        } else {
          toast({
            title: "Multi-Item Order Created & Recorded",
            description: `Order #${createdOrder.id?.slice(0, 8).toUpperCase()} with ${createdOrder.items?.length || 0} items has been created.`,
          });
        }
        
        setLocation(`/order/${createdOrder.id}`);
      } catch (error: any) {
        toast({
          title: "Error",
          description: error.message || "Failed to create multi-item order",
          variant: "destructive",
        });
      }
    } else {
      // Single-item order with payment
      try {
        const response = await apiRequest('POST', '/api/orders-with-payment', { orderData: orderDataWithPayment, paymentData });
        const createdOrder = await response.json();
        queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
        
        let description = `Order #${createdOrder.id?.slice(0, 8).toUpperCase()} has been created`;
        if (paymentMethodValue === 'credit_card') {
          description += ' and payment processed';
        } else if (paymentMethodValue === 'cash') {
          description += ' and cash payment recorded';
        } else if (paymentMethodValue === 'paypal') {
          // Send PayPal invoice
          try {
            const paypalResponse = await fetch('/api/create-paypal-invoice', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ orderId: createdOrder.id, isMultiItem: false }),
            });
            
            if (paypalResponse.ok) {
              description = `Order #${createdOrder.id?.slice(0, 8).toUpperCase()} created and PayPal invoice sent to ${orderDataWithPayment.email}`;
            } else {
              throw new Error('Failed to send PayPal invoice');
            }
          } catch (paypalError: any) {
            description = `Order created but PayPal invoice failed: ${paypalError.message}`;
          }
        }
        
        toast({
          title: "Order Created & Recorded",
          description,
        });
        setLocation(`/order/${createdOrder.id}`);
      } catch (error: any) {
        toast({
          title: "Error",
          description: error.message || "Failed to create order",
          variant: "destructive",
        });
      }
    }
  };

  // Handler to add current item to pending items
  const handleAddItem = async () => {
    const isValid = await form.trigger(); // Validate form
    if (!isValid) {
      toast({
        title: "Validation Error",
        description: "Please fix the errors in the form before adding the item.",
        variant: "destructive",
      });
      return;
    }

    const formData = form.getValues();
    
    if (editingItemIndex !== null) {
      // Update existing item
      const updated = [...pendingItems];
      updated[editingItemIndex] = formData;
      setPendingItems(updated);
      setEditingItemIndex(null);
      toast({
        title: "Item Updated",
        description: `Item #${editingItemIndex + 1} has been updated.`,
      });
    } else {
      // Add new item
      setPendingItems([...pendingItems, formData]);
      toast({
        title: "Item Added",
        description: `Item #${pendingItems.length + 1} added to order.`,
      });
    }

    // Reset form but keep customer data
    const customerData = {
      customerName: formData.customerName,
      address1: formData.address1,
      address2: formData.address2,
      cityStateZip: formData.cityStateZip,
      phone: formData.phone,
      email: formData.email,
      deliveryMethod: formData.deliveryMethod,
      description: formData.description,
      specialRequests: formData.specialRequests,
      discount: formData.discount,
      deposit: formData.deposit,
    };

    form.reset({
      ...customerData,
      frameSku: "",
      chopOnly: false,
      sample: false,
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
      backingSku: "White Foam",
      printPaper: false,
      printPaperType: "",
      dryMount: false,
      printCanvas: false,
      printCanvasWrapStyle: "",
      canvasStretching: false,
      engravedPlaque: false,
      engravedPlaqueSize: "",
      engravedPlaqueColor: "",
      engravedPlaqueFont: "",
      engravedPlaqueText1: "",
      engravedPlaqueText2: "",
      engravedPlaqueText3: "",
      engravedPlaqueTextAdditional: [],
      leds: false,
      shadowboxFitting: false,
      additionalLabor: false,
      stackerFrame: false,
      shadowDepth: "",
      quantity: 1,
    });
    
    setWidthText("12");
    setHeightText("16");
  };

  // Handler to edit an item
  const handleEditItem = (index: number) => {
    const item = pendingItems[index];
    form.reset(item);
    setWidthText(item.width?.toString() || "12");
    setHeightText(item.height?.toString() || "16");
    setEditingItemIndex(index);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    toast({
      title: "Editing Item",
      description: `Item #${index + 1} loaded into form for editing.`,
    });
  };

  // Handler to remove an item
  const handleRemoveItem = (index: number) => {
    const updated = pendingItems.filter((_, i) => i !== index);
    setPendingItems(updated);
    if (editingItemIndex === index) {
      setEditingItemIndex(null);
    }
    toast({
      title: "Item Removed",
      description: `Item #${index + 1} removed from order.`,
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 md:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Form */}
          <div className="lg:col-span-2 space-y-6">
            {/* Accumulated Items Display */}
            {pendingItems.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-xl flex items-center justify-between">
                    <span>Items in Order ({pendingItems.length})</span>
                    {editingItemIndex !== null && (
                      <Badge variant="secondary">Editing Item #{editingItemIndex + 1}</Badge>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {pendingItems.map((item, index) => (
                      <Card key={index} className="border-muted">
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <Badge variant="outline">Item #{index + 1}</Badge>
                                {item.frameSku && (
                                  <span className="text-sm font-mono text-muted-foreground">{item.frameSku}</span>
                                )}
                              </div>
                              <div className="grid grid-cols-2 gap-2 text-sm">
                                {(item.width && item.height) || item.sample ? (
                                  <div>
                                    <span className="text-muted-foreground">Size:</span>{" "}
                                    <span className="font-mono">{item.sample ? "Sample" : `${item.width}" × ${item.height}"`}</span>
                                  </div>
                                ) : null}
                                {item.quantity && (
                                  <div>
                                    <span className="text-muted-foreground">Qty:</span> {item.quantity}
                                  </div>
                                )}
                                {item.mat1Sku && (
                                  <div>
                                    <span className="text-muted-foreground">Mat 1:</span>{" "}
                                    <span className="font-mono text-xs">{item.mat1Sku}</span>
                                  </div>
                                )}
                                {item.acrylicType && (
                                  <div>
                                    <span className="text-muted-foreground">Acrylic:</span> {item.acrylicType}
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEditItem(index)}
                                data-testid={`button-edit-item-${index}`}
                              >
                                Edit
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => handleRemoveItem(index)}
                                data-testid={`button-remove-item-${index}`}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

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
                          <FormLabel>Customer Name</FormLabel>
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
                            <FormLabel>Address 1</FormLabel>
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
                          <FormLabel>City, State, Zip</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="e.g., Somerset, NJ 08873" data-testid="input-city-state-zip" />
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

                {/* Order Configuration - Combined Card */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-xl">Order Configuration</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Accordion type="multiple" className="w-full">
                      {/* Frame Configuration */}
                      <AccordionItem value="frame-config">
                        <AccordionTrigger className="text-base font-semibold hover:no-underline" data-testid="accordion-trigger-frame-config">
                          Frame Configuration
                        </AccordionTrigger>
                        <AccordionContent className="space-y-6 pt-4">
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

                      <div className="flex flex-wrap items-center gap-6 pt-8">
                        <FormField
                          control={form.control}
                          name="chopOnly"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                              <FormControl>
                                <Checkbox
                                  checked={field.value}
                                  onCheckedChange={field.onChange}
                                  disabled={form.watch("sample")}
                                  data-testid="checkbox-chop-only"
                                />
                              </FormControl>
                              <FormLabel className="font-normal cursor-pointer">
                                Chop Only
                              </FormLabel>
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="sample"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                              <FormControl>
                                <Checkbox
                                  checked={field.value}
                                  onCheckedChange={field.onChange}
                                  data-testid="checkbox-sample"
                                />
                              </FormControl>
                              <div className="flex items-center gap-2">
                                <FormLabel className="font-normal cursor-pointer">
                                  Sample
                                </FormLabel>
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <HelpCircle className="h-4 w-4 text-muted-foreground" />
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p className="max-w-xs">Sample orders are $0 for materials with $5 flat shipping. Only frame or mat SKU is required.</p>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              </div>
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="stackerFrame"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                            <FormControl>
                              <Checkbox
                                checked={field.value}
                                onCheckedChange={field.onChange}
                                disabled={form.watch("sample")}
                                data-testid="checkbox-stacker-frame"
                              />
                            </FormControl>
                            <FormLabel className="font-normal cursor-pointer">
                              Stacker Frame (Deep Shadowbox)
                            </FormLabel>
                          </FormItem>
                        )}
                      />

                      {form.watch("stackerFrame") && (
                        <FormField
                          control={form.control}
                          name="shadowDepth"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Shadow Depth (inches)</FormLabel>
                              <FormControl>
                                <Input
                                  {...field}
                                  value={field.value || ""}
                                  placeholder="e.g., 9 or 4.5"
                                  data-testid="input-shadow-depth"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      )}
                    </div>

                    {form.watch("stackerFrame") && (
                      <FormField
                        control={form.control}
                        name="topperSku"
                        render={({ field }) => (
                          <FormItem className="space-y-3">
                            <FormLabel>Topper Style</FormLabel>
                            <FormControl>
                              <RadioGroup
                                onValueChange={field.onChange}
                                value={field.value || "9731"}
                                className="flex flex-col space-y-1"
                              >
                                <FormItem className="flex items-center space-x-3 space-y-0">
                                  <FormControl>
                                    <RadioGroupItem value="9731" data-testid="radio-topper-9731" />
                                  </FormControl>
                                  <FormLabel className="font-normal cursor-pointer">
                                    9731 (1.0" depth)
                                  </FormLabel>
                                </FormItem>
                                <FormItem className="flex items-center space-x-3 space-y-0">
                                  <FormControl>
                                    <RadioGroupItem value="9531" data-testid="radio-topper-9531" />
                                  </FormControl>
                                  <FormLabel className="font-normal cursor-pointer">
                                    9531 (0.75" depth)
                                  </FormLabel>
                                </FormItem>
                              </RadioGroup>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}

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
                                disabled={form.watch("sample")}
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
                                disabled={form.watch("sample")}
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
                                disabled={form.watch("sample")}
                                data-testid="input-quantity"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="acrylicType"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Acrylic Type</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value} disabled={form.watch("sample")}>
                              <FormControl>
                                <SelectTrigger data-testid="select-acrylic-type">
                                  <SelectValue />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="None">None</SelectItem>
                                <SelectItem value="Standard">Standard</SelectItem>
                                <SelectItem value="Non-Glare">Non-Glare</SelectItem>
                              </SelectContent>
                            </Select>
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="backingSku"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Backing SKU</FormLabel>
                            <MatCombobox
                              value={field.value || ""}
                              onChange={field.onChange}
                              placeholder="Search backing SKU..."
                              filterItemType="" // Show all supplies for backing (no filter)
                              disabled={form.watch("sample")}
                              data-testid="combobox-backing-sku"
                            />
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                        </AccordionContent>
                      </AccordionItem>

                      {/* Mat Configuration */}
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
                                      <Input {...field} value={field.value || ""} placeholder="e.g., 2.5 or 2 1/2" disabled={form.watch("sample")} data-testid="input-mat-border-all" />
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
                                      <Input {...field} value={field.value || ""} placeholder="e.g., 2.5 or 2 1/2" disabled={form.watch("sample")} data-testid="input-mat-border-left" />
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
                                      <Input {...field} value={field.value || ""} placeholder="e.g., 2.5 or 2 1/2" disabled={form.watch("sample")} data-testid="input-mat-border-right" />
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
                                      <Input {...field} value={field.value || ""} placeholder="e.g., 2.5 or 2 1/2" disabled={form.watch("sample")} data-testid="input-mat-border-top" />
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
                                      <Input {...field} value={field.value || ""} placeholder="e.g., 2.5 or 2 1/2" disabled={form.watch("sample")} data-testid="input-mat-border-bottom" />
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
                                    <FormLabel className="text-sm">Mat 1</FormLabel>
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
                                      <Input {...field} value={field.value || ""} placeholder="e.g., 0.125" disabled={form.watch("sample")} data-testid="input-mat1-reveal" />
                                    </FormControl>
                                  </FormItem>
                                )}
                              />
                              <FormField
                                control={form.control}
                                name="mat2Sku"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel className="text-sm">Mat 2</FormLabel>
                                    <FormControl>
                                      <MatCombobox
                                        value={field.value || ""}
                                        onChange={field.onChange}
                                        placeholder="Select mat 2..."
                                        disabled={form.watch("sample")}
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
                                      <Input {...field} value={field.value || ""} placeholder="e.g., 0.125" disabled={form.watch("sample")} data-testid="input-mat2-reveal" />
                                    </FormControl>
                                  </FormItem>
                                )}
                              />
                              <FormField
                                control={form.control}
                                name="mat3Sku"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel className="text-sm">Mat 3</FormLabel>
                                    <FormControl>
                                      <MatCombobox
                                        value={field.value || ""}
                                        onChange={field.onChange}
                                        placeholder="Select mat 3..."
                                        disabled={form.watch("sample")}
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
                                        disabled={form.watch("sample")}
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

                      {/* Print Options */}
                      <AccordionItem value="print-options">
                        <AccordionTrigger className="text-base font-semibold hover:no-underline" data-testid="accordion-trigger-print-options">
                          Print Options
                        </AccordionTrigger>
                        <AccordionContent className="space-y-6 pt-4">
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
                                        disabled={form.watch("sample")}
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
                                        disabled={form.watch("sample")}
                                        data-testid="checkbox-dry-mount"
                                      />
                                    </FormControl>
                                    <FormLabel className="font-normal cursor-pointer">Dry Mount</FormLabel>
                                  </FormItem>
                                )}
                              />
                            </div>

                            <div className="space-y-3">
                              <FormField
                                control={form.control}
                                name="printCanvas"
                                render={({ field }) => (
                                  <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                                    <FormControl>
                                      <Checkbox
                                        checked={field.value}
                                        onCheckedChange={field.onChange}
                                        disabled={form.watch("sample")}
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
                                      <FormLabel className="text-sm">Wrap Style</FormLabel>
                                      <Select onValueChange={field.onChange} value={field.value || ""}>
                                        <FormControl>
                                          <SelectTrigger data-testid="select-canvas-wrap-style">
                                            <SelectValue placeholder="Select wrap style" />
                                          </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                          <SelectItem value="Gallery">Gallery - Wrapped around frame edges</SelectItem>
                                          <SelectItem value="Museum">Museum - Extra border before wrapping</SelectItem>
                                          <SelectItem value="Rolled">Rolled - Canvas not stretched</SelectItem>
                                        </SelectContent>
                                      </Select>
                                    </FormItem>
                                  )}
                                />
                              )}
                              
                              <FormField
                                control={form.control}
                                name="canvasStretching"
                                render={({ field }) => (
                                  <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                                    <FormControl>
                                      <Checkbox
                                        checked={field.value}
                                        onCheckedChange={field.onChange}
                                        disabled={form.watch("sample")}
                                        data-testid="checkbox-canvas-stretching"
                                      />
                                    </FormControl>
                                    <FormLabel className="font-normal cursor-pointer">Canvas Stretching (Customer Supplied)</FormLabel>
                                  </FormItem>
                                )}
                              />
                            </div>
                          </div>
                        </AccordionContent>
                      </AccordionItem>

                      {/* Additional Options */}
                      <AccordionItem value="additional-options">
                        <AccordionTrigger className="text-base font-semibold hover:no-underline" data-testid="accordion-trigger-additional-options">
                          Additional Options
                        </AccordionTrigger>
                        <AccordionContent className="space-y-6 pt-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                                        disabled={form.watch("sample")}
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
                                        disabled={form.watch("sample")}
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
                                        disabled={form.watch("sample")}
                                        data-testid="checkbox-additional-labor"
                                      />
                                    </FormControl>
                                    <FormLabel className="font-normal cursor-pointer">Additional Labor</FormLabel>
                                  </FormItem>
                                )}
                              />
                            </div>

                            <div className="space-y-3">
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
                            <div className="ml-6 space-y-3">
                              <FormField
                                control={form.control}
                                name="engravedPlaqueSize"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel className="text-sm">Plaque Size</FormLabel>
                                    <FormControl>
                                      <Input {...field} value={field.value || ""} placeholder="e.g., 3x5 inches" data-testid="input-engraved-plaque-size" />
                                    </FormControl>
                                  </FormItem>
                                )}
                              />
                              
                              <FormField
                                control={form.control}
                                name="engravedPlaqueColor"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel className="text-sm">Plaque Color</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value || ""}>
                                      <FormControl>
                                        <SelectTrigger data-testid="select-plaque-color">
                                          <SelectValue placeholder="Select color" />
                                        </SelectTrigger>
                                      </FormControl>
                                      <SelectContent>
                                        <SelectItem value="Black">Black</SelectItem>
                                        <SelectItem value="Brass">Brass</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </FormItem>
                                )}
                              />
                              
                              <FormField
                                control={form.control}
                                name="engravedPlaqueFont"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel className="text-sm">Font</FormLabel>
                                    <FormControl>
                                      <Input {...field} value={field.value || ""} placeholder="e.g., Times New Roman" data-testid="input-plaque-font" />
                                    </FormControl>
                                  </FormItem>
                                )}
                              />
                              
                              <FormField
                                control={form.control}
                                name="engravedPlaqueText1"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel className="text-sm">Text Line 1</FormLabel>
                                    <FormControl>
                                      <Input {...field} value={field.value || ""} placeholder="First line of text" data-testid="input-plaque-text-1" />
                                    </FormControl>
                                  </FormItem>
                                )}
                              />
                              
                              <FormField
                                control={form.control}
                                name="engravedPlaqueText2"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel className="text-sm">Text Line 2</FormLabel>
                                    <FormControl>
                                      <Input {...field} value={field.value || ""} placeholder="Second line of text" data-testid="input-plaque-text-2" />
                                    </FormControl>
                                  </FormItem>
                                )}
                              />
                              
                              <FormField
                                control={form.control}
                                name="engravedPlaqueText3"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel className="text-sm">Text Line 3</FormLabel>
                                    <FormControl>
                                      <Input {...field} value={field.value || ""} placeholder="Third line of text" data-testid="input-plaque-text-3" />
                                    </FormControl>
                                  </FormItem>
                                )}
                              />
                              
                              {(form.watch("engravedPlaqueTextAdditional") || []).map((_, index) => (
                                <FormField
                                  key={index}
                                  control={form.control}
                                  name={`engravedPlaqueTextAdditional.${index}` as any}
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel className="text-sm">Text Line {index + 4}</FormLabel>
                                      <div className="flex gap-2">
                                        <FormControl>
                                          <Input {...field} value={field.value || ""} placeholder={`Line ${index + 4}`} data-testid={`input-plaque-text-${index + 4}`} />
                                        </FormControl>
                                        <Button
                                          type="button"
                                          size="icon"
                                          variant="ghost"
                                          onClick={() => {
                                            const current = form.getValues("engravedPlaqueTextAdditional") || [];
                                            form.setValue("engravedPlaqueTextAdditional", current.filter((_, i) => i !== index));
                                          }}
                                          data-testid={`button-remove-line-${index + 4}`}
                                        >
                                          <X className="w-4 h-4" />
                                        </Button>
                                      </div>
                                    </FormItem>
                                  )}
                                />
                              ))}
                              
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  const current = form.getValues("engravedPlaqueTextAdditional") || [];
                                  form.setValue("engravedPlaqueTextAdditional", [...current, ""]);
                                }}
                                data-testid="button-add-plaque-line"
                                className="w-full"
                              >
                                <Plus className="w-4 h-4 mr-2" />
                                Add a line
                              </Button>
                            </div>
                          )}
                            </div>
                          </div>
                        </AccordionContent>
                      </AccordionItem>

                      {/* Order Details */}
                      <AccordionItem value="order-details">
                        <AccordionTrigger className="text-base font-semibold hover:no-underline" data-testid="accordion-trigger-order-details">
                          Order Details
                        </AccordionTrigger>
                        <AccordionContent className="space-y-4 pt-4">
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

                    <Accordion type="single" collapsible className="border rounded-md px-3">
                      <AccordionItem value="discount" className="border-none">
                        <AccordionTrigger className="text-xs text-muted-foreground hover:no-underline py-2" data-testid="accordion-trigger-discount">
                          <ChevronDown className="w-3 h-3" />
                        </AccordionTrigger>
                        <AccordionContent className="pb-3">
                          <FormField
                            control={form.control}
                            name="discount"
                            render={({ field }) => (
                              <FormItem>
                                <FormControl>
                                  <Input
                                    {...field}
                                    value={field.value || ""}
                                    placeholder="e.g., 10% or $50"
                                    className="text-sm h-8"
                                    data-testid="input-discount"
                                  />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                        </AccordionContent>
                      </AccordionItem>
                    </Accordion>
                        </AccordionContent>
                      </AccordionItem>
                    </Accordion>
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
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Size:</span>
                      <span className="font-mono font-medium" data-testid="text-frame-size">
                        {form.watch("sample") ? "Sample" : `${form.watch("width")} × ${form.watch("height")} in`}
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

                  <div className="space-y-2 text-sm">
                    {form.watch("stackerFrame") && form.watch("shadowDepth") && parseFloat(calculatedPricing.breakdown.frameCost) > 0 && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Stacker Frame ({form.watch("shadowDepth")}\" deep)</span>
                        <span className="font-mono" data-testid="text-frame-cost">${calculatedPricing.breakdown.frameCost}</span>
                      </div>
                    )}
                    {!form.watch("stackerFrame") && form.watch("frameSku") && parseFloat(calculatedPricing.breakdown.frameCost) > 0 && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Frame ({form.watch("frameSku")})</span>
                        <span className="font-mono" data-testid="text-frame-cost">${calculatedPricing.breakdown.frameCost}</span>
                      </div>
                    )}
                    {form.watch("mat1Sku") && parseFloat(calculatedPricing.breakdown.mat1Cost) > 0 && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Mat 1 ({form.watch("mat1Sku")})</span>
                        <span className="font-mono">${calculatedPricing.breakdown.mat1Cost}</span>
                      </div>
                    )}
                    {form.watch("mat2Sku") && parseFloat(calculatedPricing.breakdown.mat2Cost) > 0 && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Mat 2 ({form.watch("mat2Sku")})</span>
                        <span className="font-mono">${calculatedPricing.breakdown.mat2Cost}</span>
                      </div>
                    )}
                    {form.watch("mat3Sku") && parseFloat(calculatedPricing.breakdown.mat3Cost) > 0 && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Mat 3 ({form.watch("mat3Sku")})</span>
                        <span className="font-mono">${calculatedPricing.breakdown.mat3Cost}</span>
                      </div>
                    )}
                    {form.watch("acrylicType") && form.watch("acrylicType") !== "None" && parseFloat(calculatedPricing.breakdown.acrylicCost) > 0 && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">{form.watch("acrylicType")} Acrylic</span>
                        <span className="font-mono">${calculatedPricing.breakdown.acrylicCost}</span>
                      </div>
                    )}
                    {form.watch("backingSku") && parseFloat(calculatedPricing.breakdown.backingCost) > 0 && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Backing ({form.watch("backingSku")})</span>
                        <span className="font-mono">${calculatedPricing.breakdown.backingCost}</span>
                      </div>
                    )}
                    {form.watch("printPaper") && parseFloat(calculatedPricing.breakdown.printPaperCost) > 0 && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Print (Paper)</span>
                        <span className="font-mono">${calculatedPricing.breakdown.printPaperCost}</span>
                      </div>
                    )}
                    {form.watch("dryMount") && parseFloat(calculatedPricing.breakdown.dryMountCost) > 0 && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Dry Mount</span>
                        <span className="font-mono">${calculatedPricing.breakdown.dryMountCost}</span>
                      </div>
                    )}
                    {form.watch("printCanvas") && parseFloat(calculatedPricing.breakdown.printCanvasCost) > 0 && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Print (Canvas - {form.watch("printCanvasWrapStyle") || "Gallery"})</span>
                        <span className="font-mono">${calculatedPricing.breakdown.printCanvasCost}</span>
                      </div>
                    )}
                    {form.watch("canvasStretching") && parseFloat(calculatedPricing.breakdown.canvasStretchingCost) > 0 && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Canvas Stretching (Customer Supplied)</span>
                        <span className="font-mono">${calculatedPricing.breakdown.canvasStretchingCost}</span>
                      </div>
                    )}
                    {form.watch("engravedPlaque") && parseFloat(calculatedPricing.breakdown.engravedPlaqueCost) > 0 && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Engraved Plaque</span>
                        <span className="font-mono">${calculatedPricing.breakdown.engravedPlaqueCost}</span>
                      </div>
                    )}
                    {form.watch("leds") && parseFloat(calculatedPricing.breakdown.ledsCost) > 0 && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">LEDs</span>
                        <span className="font-mono">${calculatedPricing.breakdown.ledsCost}</span>
                      </div>
                    )}
                    {form.watch("shadowboxFitting") && parseFloat(calculatedPricing.breakdown.shadowboxFittingCost) > 0 && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Shadowbox Fitting</span>
                        <span className="font-mono">${calculatedPricing.breakdown.shadowboxFittingCost}</span>
                      </div>
                    )}
                    {form.watch("additionalLabor") && parseFloat(calculatedPricing.breakdown.additionalLaborCost) > 0 && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Additional Labor</span>
                        <span className="font-mono">${calculatedPricing.breakdown.additionalLaborCost}</span>
                      </div>
                    )}
                    {form.watch("extraMatOpenings") > 0 && parseFloat(calculatedPricing.breakdown.extraMatOpeningsCost) > 0 && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Extra Mat Openings ({form.watch("extraMatOpenings")})</span>
                        <span className="font-mono">${calculatedPricing.breakdown.extraMatOpeningsCost}</span>
                      </div>
                    )}
                  </div>

                  {calculatedPricing.bom && calculatedPricing.bom.length > 0 && (
                    <>
                      <Separator />
                      <div className="space-y-2">
                        <div className="text-sm font-semibold text-foreground">Bill of Materials (Production)</div>
                        <div className="space-y-1">
                          {calculatedPricing.bom.map((bomLine, index) => (
                            <div key={index} className="text-xs font-mono bg-muted px-2 py-1 rounded" data-testid={`text-bom-line-${index}`}>
                              {bomLine}
                            </div>
                          ))}
                        </div>
                      </div>
                    </>
                  )}

                  <Separator />

                  <div className="space-y-2">
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
                    {(() => {
                      const discountValue = form.watch("discount");
                      if (!discountValue) return null;
                      
                      const subtotalBeforeDiscount = calculatedPricing.itemTotal + calculatedPricing.shipping + calculatedPricing.salesTax;
                      const discountAmount = parseDiscount(discountValue, subtotalBeforeDiscount);
                      
                      if (discountAmount <= 0) return null;
                      
                      return (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Discount ({discountValue}):</span>
                          <span className="font-mono font-semibold text-green-600 dark:text-green-400" data-testid="text-discount">
                            -${discountAmount.toFixed(2)}
                          </span>
                        </div>
                      );
                    })()}
                  </div>

                  <Separator />

                  <div className="space-y-2">
                    <div className="flex justify-between text-lg">
                      <span className="font-semibold">Total:</span>
                      <span className="font-mono font-bold text-primary" data-testid="text-total">
                        ${calculatedPricing.total.toFixed(2)}
                      </span>
                    </div>
                    
                    {processedPayment && (
                      <>
                        <Separator className="my-2" />
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Paid to Date:</span>
                          <span className="font-mono font-semibold text-green-600 dark:text-green-400" data-testid="text-paid-to-date">
                            ${processedPayment.amount}
                          </span>
                        </div>
                        <div className="flex justify-between text-lg">
                          <span className="font-semibold">Balance:</span>
                          <span className="font-mono font-bold" data-testid="text-balance">
                            ${(parseFloat(calculatedPricing.total.toFixed(2)) - parseFloat(processedPayment.amount)).toFixed(2)}
                          </span>
                        </div>
                      </>
                    )}
                  </div>

                  {pendingItems.length > 0 && (
                    <div className="p-3 bg-primary/5 rounded-md border border-primary/20">
                      <p className="text-sm font-medium">
                        {pendingItems.length} item{pendingItems.length !== 1 ? 's' : ''} in this order
                      </p>
                    </div>
                  )}

                  <div className="space-y-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full"
                      size="lg"
                      onClick={handleAddItem}
                      data-testid="button-add-item"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      {editingItemIndex !== null ? "Update Item" : "Add Another Item"}
                    </Button>
                    
                    <Button
                      type="submit"
                      className="w-full font-bold"
                      size="lg"
                      disabled={createOrderMutation.isPending || createMultiItemOrderMutation.isPending}
                      onClick={form.handleSubmit(onSubmit)}
                      data-testid="button-create-order"
                    >
                      {(createOrderMutation.isPending || createMultiItemOrderMutation.isPending) ? "Creating Order..." : 
                        pendingItems.length > 0 ? `Submit Order (${pendingItems.length + 1} items)` : "Create Order"}
                    </Button>
                    
                    <div className="flex flex-row items-center justify-center space-x-3">
                      <Checkbox
                        checked={form.watch("syncToShipstation")}
                        onCheckedChange={(checked) => form.setValue("syncToShipstation", checked as boolean)}
                        data-testid="checkbox-sync-shipstation"
                      />
                      <label 
                        htmlFor="syncToShipstation" 
                        className="font-bold cursor-pointer"
                        onClick={() => form.setValue("syncToShipstation", !form.watch("syncToShipstation"))}
                      >
                        Sync order to ShipStation
                      </label>
                    </div>
                    
                    <div className="pt-4 border-t">
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full bg-yellow-50 hover:bg-yellow-100 dark:bg-yellow-950/20 dark:hover:bg-yellow-950/30 border-yellow-200 dark:border-yellow-800"
                        size="lg"
                        onClick={async () => {
                          const customerName = form.getValues("customerName");
                          const email = form.getValues("email");
                          const phone = form.getValues("phone");
                          const smsConsent = form.getValues("smsConsent") ?? true;
                          
                          if (!customerName) {
                            toast({ title: "Customer name required", description: "Please enter a customer name first.", variant: "destructive" });
                            return;
                          }
                          
                          if (!email && !phone) {
                            toast({ title: "Contact info required", description: "Please enter an email or phone number.", variant: "destructive" });
                            return;
                          }
                          
                          try {
                            const response = await fetch("/api/send-review-request", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ customerName, email, phone, smsConsent }),
                            });
                            
                            const data = await response.json();
                            
                            if (data.success) {
                              toast({ 
                                title: "Review request sent!", 
                                description: data.message 
                              });
                            } else {
                              throw new Error(data.error);
                            }
                          } catch (error: any) {
                            toast({ 
                              title: "Failed to send review request", 
                              description: error.message, 
                              variant: "destructive" 
                            });
                          }
                        }}
                        data-testid="button-request-review"
                      >
                        <Star className="h-4 w-4 mr-2 fill-yellow-400 text-yellow-400" />
                        Request Google Review
                      </Button>
                      <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                        <Checkbox 
                          id="sms-consent" 
                          defaultChecked={true}
                          checked={form.watch("smsConsent") ?? true}
                          onCheckedChange={(checked) => form.setValue("smsConsent", checked as boolean)}
                          data-testid="checkbox-sms-consent"
                        />
                        <label 
                          htmlFor="sms-consent" 
                          className="cursor-pointer select-none"
                        >
                          Send me order updates and review requests via text
                        </label>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Payment</CardTitle>
                </CardHeader>
                <CardContent>
                  <Accordion 
                    type="single" 
                    collapsible 
                    className="w-full"
                    value={activePaymentMethod}
                    onValueChange={setActivePaymentMethod}
                  >
                    <AccordionItem value="credit-card">
                      <AccordionTrigger data-testid="accordion-credit-card">
                        <div className="flex items-center gap-2">
                          Credit Card Payment
                          {processedPayment?.type === 'credit_card' && processedPayment.status === 'charged' && (
                            <Badge variant="default" className="ml-2 bg-green-600 hover:bg-green-700">✓ Accepted: ${processedPayment.amount}</Badge>
                          )}
                          {processedPayment?.type === 'credit_card' && processedPayment.status === 'failed' && (
                            <Badge variant="destructive" className="ml-2">✗ Declined: ${processedPayment.amount}</Badge>
                          )}
                        </div>
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="space-y-4">
                          <SquarePaymentForm
                            amount={paymentAmount}
                            onAmountChange={setPaymentAmount}
                            maxAmount={calculatedPricing.total.toFixed(2)}
                          />
                          <div className="flex gap-2">
                            <Button
                              type="button"
                              onClick={handleProcessCreditCard}
                              className="flex-1"
                              disabled={processedPayment?.type === 'credit_card' && processedPayment.status === 'charged'}
                              data-testid="button-process-credit-card"
                            >
                              {processedPayment?.type === 'credit_card' && processedPayment.status === 'charged' 
                                ? '✓ Card Charged Successfully' 
                                : processedPayment?.type === 'credit_card' && processedPayment.status === 'failed'
                                ? 'Try Again'
                                : 'Process Credit Card Payment'
                              }
                            </Button>
                            {processedPayment?.type === 'credit_card' && (
                              <Button
                                type="button"
                                variant="outline"
                                onClick={() => setProcessedPayment(null)}
                                data-testid="button-clear-credit-card"
                              >
                                Clear
                              </Button>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {processedPayment?.type === 'credit_card' && processedPayment.status === 'charged'
                              ? `Card charged successfully. ${processedPayment.paymentId ? `Payment ID: ${processedPayment.paymentId.substring(0, 12)}...` : ''}`
                              : processedPayment?.type === 'credit_card' && processedPayment.status === 'failed'
                              ? `Payment declined. ${processedPayment.errorMessage || 'Please try again with a different card.'}`
                              : 'Click the button above to charge the card immediately and see accepted/declined status.'
                            }
                          </p>
                        </div>
                      </AccordionContent>
                    </AccordionItem>

                    <AccordionItem value="paypal">
                      <AccordionTrigger data-testid="accordion-paypal">
                        <div className="flex items-center gap-2">
                          PayPal Invoice
                          {processedPayment?.type === 'paypal' && (
                            <Badge variant="default" className="ml-2">Invoice Ready</Badge>
                          )}
                        </div>
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="space-y-4">
                          <p className="text-sm text-muted-foreground">
                            Creates a PayPal invoice and emails it to the customer. Payment is tracked automatically.
                          </p>
                          <Button
                            type="button"
                            onClick={() => {
                              if (!form.watch("email")) {
                                toast({
                                  title: "Customer email required",
                                  description: "Please enter the customer's email address to send a PayPal invoice.",
                                  variant: "destructive"
                                });
                                return;
                              }
                              setProcessedPayment({ type: 'paypal', amount: '0.00' });
                              setActivePaymentMethod('');
                              toast({
                                title: "PayPal invoice ready",
                                description: "A PayPal invoice will be created and sent after the order is created."
                              });
                            }}
                            className="w-full"
                            disabled={processedPayment?.type === 'paypal'}
                            data-testid="button-prepare-paypal"
                          >
                            {processedPayment?.type === 'paypal' ? 'PayPal Invoice Ready' : 'Prepare PayPal Invoice'}
                          </Button>
                          {processedPayment?.type === 'paypal' && (
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => setProcessedPayment(null)}
                              className="w-full"
                              data-testid="button-clear-paypal"
                            >
                              Clear
                            </Button>
                          )}
                          <p className="text-sm text-muted-foreground">
                            Click "Prepare PayPal Invoice" above, then "Create Order". The invoice will be sent automatically to the customer's email.
                          </p>
                        </div>
                      </AccordionContent>
                    </AccordionItem>

                    <AccordionItem value="cash">
                      <AccordionTrigger data-testid="accordion-cash">
                        <div className="flex items-center gap-2">
                          Cash Payment
                          {processedPayment?.type === 'cash' && (
                            <Badge variant="default" className="ml-2">Ready: ${processedPayment.amount}</Badge>
                          )}
                        </div>
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <label className="text-sm font-medium">Cash Amount Received</label>
                            <Input
                              type="number"
                              step="0.01"
                              placeholder="0.00"
                              value={form.watch("cashAmount") || ""}
                              onChange={(e) => form.setValue("cashAmount", e.target.value)}
                              data-testid="input-cash-amount"
                            />
                          </div>
                          <div className="flex gap-2">
                            <Button
                              type="button"
                              onClick={handleRecordCash}
                              className="flex-1"
                              disabled={processedPayment?.type === 'cash'}
                              data-testid="button-record-cash"
                            >
                              {processedPayment?.type === 'cash' ? 'Cash Payment Ready' : 'Record Cash Payment'}
                            </Button>
                            {processedPayment?.type === 'cash' && (
                              <Button
                                type="button"
                                variant="outline"
                                onClick={() => setProcessedPayment(null)}
                                data-testid="button-clear-cash"
                              >
                                Clear
                              </Button>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            Click the button above to prepare the cash payment, then click "Create Order"
                          </p>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                  
                  <p className="text-sm text-muted-foreground mt-4">
                    Payment is optional. You can create the order now and process payment later.
                  </p>
                </CardContent>
              </Card>

            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
