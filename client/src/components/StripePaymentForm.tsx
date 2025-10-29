import { useState } from "react";
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { loadStripe, StripeElementsOptions } from '@stripe/stripe-js';
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Loader2 } from "lucide-react";

const stripePublicKey = import.meta.env.VITE_STRIPE_PUBLIC_KEY;
const stripePromise = stripePublicKey ? loadStripe(stripePublicKey) : null;

interface StripePaymentFormProps {
  amount: string;
  onAmountChange: (amount: string) => void;
  maxAmount?: string;
  showAmountInput?: boolean;
  clientSecret: string;
  onCardReady?: () => void;
  onError?: (error: string) => void;
}

function StripeCardForm({
  onCardReady,
  onError,
}: {
  onCardReady?: () => void;
  onError?: (error: string) => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [isReady, setIsReady] = useState(false);

  const handleReady = () => {
    setIsReady(true);
    onCardReady?.();
  };

  const handleChange = (event: any) => {
    if (event.error) {
      onError?.(event.error.message);
    } else if (event.complete) {
      onError?.('');
    }
  };

  return (
    <div className="space-y-2">
      <Label>Card Information</Label>
      <div data-testid="stripe-card-container">
        <PaymentElement
          onReady={handleReady}
          onChange={handleChange}
          options={{
            layout: 'tabs'
          }}
        />
      </div>
      {!isReady && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" />
          <span>Loading payment form...</span>
        </div>
      )}
    </div>
  );
}

export function StripePaymentForm({
  amount,
  onAmountChange,
  maxAmount,
  showAmountInput = true,
  clientSecret,
  onCardReady,
  onError,
}: StripePaymentFormProps) {
  const [initError, setInitError] = useState<string | null>(null);

  if (!stripePromise) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>Stripe is not configured. Please contact support.</AlertDescription>
      </Alert>
    );
  }

  if (!clientSecret) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>Payment session not initialized. Please try again.</AlertDescription>
      </Alert>
    );
  }

  const elementsOptions: StripeElementsOptions = {
    clientSecret,
    appearance: {
      theme: 'stripe',
    },
  };

  return (
    <div className="space-y-4" data-testid="stripe-payment-form">
      {showAmountInput && (
        <div className="space-y-2">
          <Label htmlFor="payment-amount">Amount to Charge</Label>
          <div className="flex items-center gap-2">
            <span className="text-lg text-muted-foreground">$</span>
            <Input
              id="payment-amount"
              type="number"
              step="0.01"
              min="0.01"
              max={maxAmount ? parseFloat(maxAmount) : undefined}
              value={amount}
              onChange={(e) => onAmountChange(e.target.value)}
              placeholder="0.00"
              className="text-lg font-medium"
              data-testid="input-payment-amount"
            />
          </div>
          {maxAmount && (
            <p className="text-sm text-muted-foreground">
              Maximum: ${maxAmount}
            </p>
          )}
        </div>
      )}

      {initError ? (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{initError}</AlertDescription>
        </Alert>
      ) : (
        <Elements stripe={stripePromise} options={elementsOptions}>
          <StripeCardForm onCardReady={onCardReady} onError={onError} />
        </Elements>
      )}
    </div>
  );
}

// Export a hook for easy access to payment confirmation
export function useStripePaymentForm() {
  const confirmPayment = async (): Promise<{ success?: boolean; error?: string }> => {
    try {
      // This will be called from the parent component that has access to stripe/elements
      // The actual confirmation happens in the parent using stripe.confirmPayment()
      return { success: true };
    } catch (error: any) {
      return { error: error.message || 'Failed to process payment' };
    }
  };

  return { confirmPayment };
}
