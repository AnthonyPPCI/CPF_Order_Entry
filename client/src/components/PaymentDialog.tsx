import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { CreditCard, Loader2, AlertCircle } from "lucide-react";
import { StripePaymentForm } from "./StripePaymentForm";
import { Elements, useStripe, useElements } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import { Alert, AlertDescription } from "@/components/ui/alert";

const stripePublicKey = import.meta.env.VITE_STRIPE_PUBLIC_KEY;
const stripePromise = stripePublicKey ? loadStripe(stripePublicKey) : null;

interface PaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string;
  balance: string;
  onPaymentSuccess: () => void;
}

function PaymentDialogContent({
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
      // Reset amount to current balance
      setAmount(balance);
      
      // Create payment intent when dialog opens
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

  // Update payment intent when amount changes
  useEffect(() => {
    if (clientSecret && amount && parseFloat(amount) > 0 && amount !== balance) {
      const updatePaymentIntent = async () => {
        setLoadingIntent(true);
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

          setClientSecret(data.clientSecret);
        } catch (error: any) {
          console.error('Payment intent update error:', error);
        } finally {
          setLoadingIntent(false);
        }
      };

      const timer = setTimeout(updatePaymentIntent, 1000);
      return () => clearTimeout(timer);
    }
  }, [amount, orderId]);

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

    setProcessing(true);

    try {
      // Confirm the payment using Stripe
      const { error: stripeError, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: window.location.origin,
        },
        redirect: 'if_required',
      });

      if (stripeError) {
        throw new Error(stripeError.message || 'Payment confirmation failed');
      }

      if (paymentIntent && paymentIntent.id) {
        // Send payment confirmation to backend
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

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <CreditCard className="h-5 w-5" />
          Payment
        </DialogTitle>
        <DialogDescription>
          Order #{orderId.slice(0, 8).toUpperCase()} · Balance due: ${balance}
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-6 py-4">
        {loadingIntent ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="ml-3 text-muted-foreground">Initializing payment...</span>
          </div>
        ) : clientSecret ? (
          <StripePaymentForm
            amount={amount}
            onAmountChange={setAmount}
            maxAmount={balance}
            showAmountInput={true}
            clientSecret={clientSecret}
          />
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            Unable to initialize payment. Please close and try again.
          </div>
        )}

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
            ) : (
              `Charge $${amount || '0.00'}`
            )}
          </Button>
        </div>
      </div>
    </>
  );
}

export function PaymentDialog({
  open,
  onOpenChange,
  orderId,
  balance,
  onPaymentSuccess,
}: PaymentDialogProps) {
  const [clientSecret, setClientSecret] = useState<string>("");

  useEffect(() => {
    if (open && orderId && balance) {
      // Create payment intent when dialog opens
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
  }, [open, orderId, balance]);

  const elementsOptions = clientSecret ? {
    clientSecret,
    appearance: {
      theme: 'stripe' as const,
    },
  } : undefined;

  if (!stripePromise) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Payment
            </DialogTitle>
            <DialogDescription>
              Order #{orderId.slice(0, 8).toUpperCase()} · Balance due: ${balance}
            </DialogDescription>
          </DialogHeader>
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Stripe payment processing is not configured. Please contact support or use an alternative payment method.
            </AlertDescription>
          </Alert>
          <div className="flex justify-end pt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-close-payment">
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {clientSecret && elementsOptions ? (
          <Elements stripe={stripePromise} options={elementsOptions}>
            <PaymentDialogContent
              open={open}
              onOpenChange={onOpenChange}
              orderId={orderId}
              balance={balance}
              onPaymentSuccess={onPaymentSuccess}
            />
          </Elements>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Payment
              </DialogTitle>
              <DialogDescription>
                Order #{orderId.slice(0, 8).toUpperCase()} · Balance due: ${balance}
              </DialogDescription>
            </DialogHeader>
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <span className="ml-3 text-muted-foreground">Initializing payment...</span>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
