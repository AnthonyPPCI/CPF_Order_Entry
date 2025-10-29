import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { CreditCard, Loader2, AlertCircle, DollarSign, Receipt, Banknote, FileText } from "lucide-react";
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { queryClient } from "@/lib/queryClient";

const stripePublicKey = import.meta.env.VITE_STRIPE_PUBLIC_KEY;
const stripePromise = stripePublicKey ? loadStripe(stripePublicKey) : null;

interface PaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string;
  balance: string;
  onPaymentSuccess: () => void;
}

type PaymentMethod = 'credit_card' | 'cash' | 'check' | 'paypal' | null;

function CreditCardPaymentContent({
  orderId,
  balance,
  onOpenChange,
  onPaymentSuccess,
}: PaymentDialogProps) {
  const { toast } = useToast();
  const [amount, setAmount] = useState(balance);
  const [processing, setProcessing] = useState(false);
  const [clientSecret, setClientSecret] = useState<string>("");
  const [loadingIntent, setLoadingIntent] = useState(false);
  const stripe = useStripe();
  const elements = useElements();

  useEffect(() => {
    if (orderId && balance) {
      setAmount(balance);
      
      const createPaymentIntent = async () => {
        setLoadingIntent(true);
        try {
          const response = await fetch('/api/create-payment-intent', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              orderId,
              amount: parseFloat(balance).toFixed(2),
            }),
          });

          const data = await response.json();

          if (!response.ok) {
            throw new Error(data.error || 'Failed to initialize payment');
          }

          setClientSecret(data.clientSecret);
        } catch (error: any) {
          console.error('Payment intent creation error:', error);
          toast({
            title: "Payment Initialization Failed",
            description: error.message || "Failed to initialize payment. Please try again.",
            variant: "destructive",
          });
        } finally {
          setLoadingIntent(false);
        }
      };

      createPaymentIntent();
    }
  }, [orderId, balance, toast]);

  useEffect(() => {
    console.log('[PaymentDialog] Amount changed:', { amount, balance, clientSecret: !!clientSecret, willUpdate: amount !== balance });
    
    if (clientSecret && amount && parseFloat(amount) > 0 && amount !== balance) {
      console.log('[PaymentDialog] Scheduling PaymentIntent update in 1 second...');
      const updatePaymentIntent = async () => {
        setLoadingIntent(true);
        console.log('[PaymentDialog] Creating NEW PaymentIntent for amount:', amount);
        try {
          const response = await fetch('/api/create-payment-intent', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              orderId,
              amount: parseFloat(amount).toFixed(2),
            }),
          });

          const data = await response.json();

          if (!response.ok) {
            throw new Error(data.error || 'Failed to update payment amount');
          }

          console.log('[PaymentDialog] NEW PaymentIntent created:', data.paymentIntentId);
          setClientSecret(data.clientSecret);
        } catch (error: any) {
          console.error('[PaymentDialog] Payment intent update error:', error);
        } finally {
          setLoadingIntent(false);
        }
      };

      const timer = setTimeout(updatePaymentIntent, 1000);
      return () => clearTimeout(timer);
    }
  }, [amount, balance, clientSecret, orderId]);

  const handlePayment = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid payment amount.",
        variant: "destructive",
      });
      return;
    }

    if (!stripe || !elements) {
      toast({
        title: "Payment Not Ready",
        description: "Payment system is still loading. Please wait.",
        variant: "destructive",
      });
      return;
    }

    if (!clientSecret) {
      toast({
        title: "Payment Not Ready",
        description: "Payment session not initialized. Please try again.",
        variant: "destructive",
      });
      return;
    }

    if (loadingIntent) {
      toast({
        title: "Payment Amount Updating",
        description: "Please wait for the payment amount to finish updating before processing.",
        variant: "destructive",
      });
      return;
    }

    setProcessing(true);

    try {
      // CRITICAL: Retrieve PaymentIntent to validate amount BEFORE charging
      const paymentIntentId = clientSecret.split('_secret_')[0];
      const retrievedIntent = await stripe.retrievePaymentIntent(clientSecret);
      
      if (retrievedIntent.error) {
        throw new Error(retrievedIntent.error.message || 'Failed to retrieve payment information');
      }

      if (!retrievedIntent.paymentIntent) {
        throw new Error('Payment information not found');
      }

      // Validate amount BEFORE charging the card
      const paymentIntentAmount = (retrievedIntent.paymentIntent.amount / 100).toFixed(2);
      const enteredAmount = parseFloat(amount).toFixed(2);
      
      if (paymentIntentAmount !== enteredAmount) {
        throw new Error(
          `Payment amount mismatch: You entered $${enteredAmount} but the payment session is for $${paymentIntentAmount}. Please wait a moment for the amount to update, then try again.`
        );
      }

      // Amount is correct - proceed with charging the card
      const { error: confirmError, paymentIntent } = await stripe.confirmCardPayment(
        clientSecret,
        {
          payment_method: {
            card: elements.getElement('card')!,
          },
        }
      );

      if (confirmError) {
        throw new Error(confirmError.message || 'Payment confirmation failed');
      }

      if (paymentIntent && paymentIntent.id) {
        const response = await fetch('/api/confirm-payment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            orderId,
            amount: parseFloat(amount).toFixed(2),
            paymentIntentId: paymentIntent.id,
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Payment confirmation failed');
        }

        toast({
          title: "Payment Successful",
          description: `$${amount} payment processed. New balance: $${data.newBalance}`,
        });

        onOpenChange(false);
        onPaymentSuccess();
      }
    } catch (error: any) {
      console.error('Payment error:', error);
      toast({
        title: "Payment Failed",
        description: error.message || "Failed to process payment. Please try again.",
        variant: "destructive",
      });
    } finally {
      setProcessing(false);
    }
  };

  if (loadingIntent) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-3 text-muted-foreground">Initializing payment...</span>
      </div>
    );
  }

  if (!clientSecret) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Unable to initialize payment. Please close and try again.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="payment-amount">Amount to Charge</Label>
          <div className="flex items-center gap-2">
            <span className="text-lg text-muted-foreground">$</span>
            <Input
              id="payment-amount"
              type="number"
              step="0.01"
              min="0.01"
              max={parseFloat(balance)}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="text-lg font-medium"
              data-testid="input-payment-amount"
            />
          </div>
          <p className="text-sm text-muted-foreground">
            Maximum: ${balance}
          </p>
        </div>

        <div className="space-y-2">
          <Label>Card Information</Label>
          <div 
            data-testid="stripe-card-container"
            className="p-3 border rounded-md bg-background"
          >
            <CardElement
              options={{
                style: {
                  base: {
                    fontSize: '16px',
                    color: '#424770',
                    '::placeholder': {
                      color: '#aab7c4',
                    },
                  },
                  invalid: {
                    color: '#9e2146',
                  },
                },
                hidePostalCode: true,
                disableLinkAutofill: true,
              } as any}
            />
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-4">
        <Button
          variant="outline"
          onClick={() => onOpenChange(false)}
          disabled={processing}
          data-testid="button-cancel-payment"
        >
          Cancel
        </Button>
        <Button
          onClick={handlePayment}
          disabled={processing || loadingIntent || !clientSecret || !amount || parseFloat(amount) <= 0}
          data-testid="button-process-payment"
        >
          {processing ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Processing...
            </>
          ) : loadingIntent ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Updating Amount...
            </>
          ) : (
            `Charge $${amount || '0.00'}`
          )}
        </Button>
      </div>
    </div>
  );
}

export function PaymentDialog({
  open,
  onOpenChange,
  orderId,
  balance,
  onPaymentSuccess,
}: PaymentDialogProps) {
  const { toast } = useToast();
  const [selectedMethod, setSelectedMethod] = useState<string>("");
  const [cashAmount, setCashAmount] = useState(balance);
  const [processingCash, setProcessingCash] = useState(false);
  const [processingPayPal, setProcessingPayPal] = useState(false);
  const [clientSecret, setClientSecret] = useState<string>("");

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setCashAmount(balance);
      setSelectedMethod("");
    }
  }, [open, balance]);

  // Create payment intent when credit card is selected
  useEffect(() => {
    if (open && selectedMethod === 'credit_card' && orderId && balance) {
      const createPaymentIntent = async () => {
        try {
          const response = await fetch('/api/create-payment-intent', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              orderId,
              amount: parseFloat(balance).toFixed(2),
            }),
          });

          const data = await response.json();

          if (response.ok && data.clientSecret) {
            setClientSecret(data.clientSecret);
          }
        } catch (error) {
          console.error('Payment intent creation error:', error);
        }
      };

      createPaymentIntent();
    } else {
      setClientSecret("");
    }
  }, [open, selectedMethod, orderId, balance]);

  const handleCashPayment = async () => {
    if (!cashAmount || parseFloat(cashAmount) <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid cash amount.",
        variant: "destructive",
      });
      return;
    }

    setProcessingCash(true);
    try {
      const response = await fetch('/api/record-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId,
          amount: parseFloat(cashAmount).toFixed(2),
          paymentMethod: 'cash',
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to record cash payment');
      }

      toast({
        title: "Cash Payment Recorded",
        description: `$${cashAmount} cash payment recorded. New balance: $${data.newBalance}`,
      });

      onOpenChange(false);
      onPaymentSuccess();
    } catch (error: any) {
      console.error('Cash payment error:', error);
      toast({
        title: "Payment Failed",
        description: error.message || "Failed to record cash payment. Please try again.",
        variant: "destructive",
      });
    } finally {
      setProcessingCash(false);
    }
  };

  const handlePayPalInvoice = async () => {
    setProcessingPayPal(true);
    try {
      const response = await fetch('/api/create-paypal-invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          orderId,
          isMultiItem: false
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create PayPal invoice');
      }

      toast({
        title: "PayPal Invoice Sent",
        description: `Invoice has been sent to the customer's email.`,
      });

      onOpenChange(false);
      onPaymentSuccess();
    } catch (error: any) {
      console.error('PayPal invoice error:', error);
      toast({
        title: "Invoice Failed",
        description: error.message || "Failed to create PayPal invoice. Please try again.",
        variant: "destructive",
      });
    } finally {
      setProcessingPayPal(false);
    }
  };

  const elementsOptions = clientSecret ? {
    clientSecret,
    appearance: {
      theme: 'stripe' as const,
    },
  } : undefined;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Collect Payment
          </DialogTitle>
          <DialogDescription>
            Order #{orderId.slice(0, 8).toUpperCase()} · Balance due: ${balance}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <Accordion type="single" collapsible value={selectedMethod} onValueChange={setSelectedMethod}>
            {/* Credit Card */}
            <AccordionItem value="credit_card">
              <AccordionTrigger data-testid="accordion-credit-card">
                <div className="flex items-center gap-2">
                  <CreditCard className="h-4 w-4" />
                  Credit Card
                </div>
              </AccordionTrigger>
              <AccordionContent>
                {!stripePromise ? (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      Stripe payment processing is not configured. Please contact support or use an alternative payment method.
                    </AlertDescription>
                  </Alert>
                ) : clientSecret && elementsOptions ? (
                  <Elements stripe={stripePromise} options={elementsOptions}>
                    <CreditCardPaymentContent
                      open={open}
                      onOpenChange={onOpenChange}
                      orderId={orderId}
                      balance={balance}
                      onPaymentSuccess={onPaymentSuccess}
                    />
                  </Elements>
                ) : (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    <span className="ml-3 text-sm text-muted-foreground">Loading payment form...</span>
                  </div>
                )}
              </AccordionContent>
            </AccordionItem>

            {/* Cash Payment */}
            <AccordionItem value="cash">
              <AccordionTrigger data-testid="accordion-cash">
                <div className="flex items-center gap-2">
                  <Banknote className="h-4 w-4" />
                  Cash Payment
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="cash-amount">Cash Amount Received</Label>
                    <Input
                      id="cash-amount"
                      type="number"
                      step="0.01"
                      value={cashAmount}
                      onChange={(e) => setCashAmount(e.target.value)}
                      placeholder="0.00"
                      data-testid="input-cash-amount"
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      onClick={() => onOpenChange(false)}
                      disabled={processingCash}
                      data-testid="button-cancel-cash"
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleCashPayment}
                      disabled={processingCash || !cashAmount || parseFloat(cashAmount) <= 0}
                      data-testid="button-record-cash"
                    >
                      {processingCash ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Recording...
                        </>
                      ) : (
                        `Record $${cashAmount || '0.00'}`
                      )}
                    </Button>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* PayPal Invoice */}
            <AccordionItem value="paypal">
              <AccordionTrigger data-testid="accordion-paypal">
                <div className="flex items-center gap-2">
                  <Receipt className="h-4 w-4" />
                  PayPal Invoice
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Send a PayPal invoice to the customer's email for the full balance amount.
                  </p>
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      onClick={() => onOpenChange(false)}
                      disabled={processingPayPal}
                      data-testid="button-cancel-paypal"
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handlePayPalInvoice}
                      disabled={processingPayPal}
                      data-testid="button-send-paypal"
                    >
                      {processingPayPal ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Sending...
                        </>
                      ) : (
                        `Send Invoice for $${balance}`
                      )}
                    </Button>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>

          {!selectedMethod && (
            <p className="text-sm text-muted-foreground text-center">
              Select a payment method above to continue
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
