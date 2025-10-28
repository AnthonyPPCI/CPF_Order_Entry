import { useState, useEffect, useRef } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";

declare global {
  interface Window {
    Square?: any;
  }
}

interface SquarePaymentFormProps {
  amount: string;
  onAmountChange: (amount: string) => void;
  maxAmount?: string;
  showAmountInput?: boolean;
  onCardReady?: () => void;
  onError?: (error: string) => void;
}

export function SquarePaymentForm({
  amount,
  onAmountChange,
  maxAmount,
  showAmountInput = true,
  onCardReady,
  onError,
}: SquarePaymentFormProps) {
  const [initError, setInitError] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const cardRef = useRef<any>(null);
  const paymentsRef = useRef<any>(null);
  const cardContainerId = useRef(`square-card-${Math.random().toString(36).substr(2, 9)}`).current;

  useEffect(() => {
    const initializeSquare = async () => {
      if (!window.Square) {
        const error = "Square payment form is not available.";
        setInitError(error);
        onError?.(error);
        return;
      }

      try {
        const appId = import.meta.env.VITE_SQUARE_APPLICATION_ID;
        const locationId = import.meta.env.VITE_SQUARE_LOCATION_ID;

        if (!appId || !locationId) {
          const error = "Square credentials not configured. Please contact support.";
          setInitError(error);
          onError?.(error);
          return;
        }

        const paymentsInstance = window.Square.payments(appId, locationId);
        paymentsRef.current = paymentsInstance;

        const cardInstance = await paymentsInstance.card();
        await cardInstance.attach(`#${cardContainerId}`);
        cardRef.current = cardInstance;
        
        setIsReady(true);
        onCardReady?.();
      } catch (error: any) {
        console.error('Square initialization error:', error);
        const errorMsg = error?.message || "Failed to initialize payment form.";
        setInitError(errorMsg);
        onError?.(errorMsg);
      }
    };

    initializeSquare();

    return () => {
      if (cardRef.current) {
        cardRef.current.destroy();
        cardRef.current = null;
      }
    };
  }, [cardContainerId, onCardReady, onError]);

  /**
   * Tokenize the card details and get verification token
   * @param buyerDetails Optional buyer details for verification (email, phone, etc.)
   * @returns Promise<{token: string, verificationToken?: string, details?: any} | {error: string}>
   */
  const tokenize = async (buyerDetails?: { email?: string; givenName?: string; familyName?: string; phone?: string }): Promise<{ token?: string; verificationToken?: string; details?: any; error?: string }> => {
    if (!cardRef.current || !paymentsRef.current) {
      return { error: "Payment form not initialized" };
    }

    if (!amount || parseFloat(amount) <= 0) {
      return { error: "Please enter a valid payment amount" };
    }

    try {
      // Step 1: Tokenize the card
      const tokenResult = await cardRef.current.tokenize();
      
      if (tokenResult.status !== 'OK') {
        return { error: tokenResult.errors?.[0]?.message || 'Card tokenization failed' };
      }

      const paymentToken = tokenResult.token;

      // Step 2: Verify buyer (for CVV verification and fraud prevention)
      let verificationToken: string | undefined;
      
      try {
        // Ensure amount is properly formatted as string with 2 decimal places
        const formattedAmount = parseFloat(amount).toFixed(2);
        
        const verificationDetails: any = {
          amount: formattedAmount,
          currencyCode: 'USD',
          intent: 'CHARGE',
        };

        // Add billing contact only if we have at least email or name
        if (buyerDetails?.email || buyerDetails?.givenName) {
          const billingContact: any = {};
          
          if (buyerDetails.email) {
            billingContact.email = buyerDetails.email;
          }
          if (buyerDetails.givenName) {
            billingContact.givenName = buyerDetails.givenName;
          }
          if (buyerDetails.familyName) {
            billingContact.familyName = buyerDetails.familyName;
          }
          if (buyerDetails.phone) {
            billingContact.phone = buyerDetails.phone;
          }
          
          // Only add billingContact if it has at least one property
          if (Object.keys(billingContact).length > 0) {
            verificationDetails.billingContact = billingContact;
          }
        }

        console.log('Attempting buyer verification with:', {
          amount: formattedAmount,
          hasBillingContact: !!verificationDetails.billingContact,
          billingContactFields: verificationDetails.billingContact ? Object.keys(verificationDetails.billingContact) : []
        });

        const verifyResult = await paymentsRef.current.verifyBuyer(paymentToken, verificationDetails);
        
        if (verifyResult.token) {
          verificationToken = verifyResult.token;
          console.log('Buyer verification successful');
        } else {
          console.warn('Buyer verification returned no token');
        }
      } catch (verifyError: any) {
        console.error('Buyer verification failed:', verifyError);
        console.error('Verification error details:', {
          name: verifyError?.name,
          message: verifyError?.message,
          errors: verifyError?.errors,
          argumentErrors: verifyError?.argumentErrors
        });
        // Continue without verification token if this fails
      }

      // Return both payment token and verification token
      return { 
        token: paymentToken,
        verificationToken,
        details: tokenResult.details
      };
    } catch (error: any) {
      return { error: error.message || 'Failed to tokenize card' };
    }
  };

  // Expose tokenize method via ref (parent can call this)
  useEffect(() => {
    if (isReady && cardRef.current) {
      // Store tokenize method on the element for parent access
      const container = document.getElementById(cardContainerId);
      if (container) {
        (container as any).tokenize = tokenize;
      }
    }
  }, [isReady, amount, cardContainerId]);

  return (
    <div className="space-y-4" data-testid="square-payment-form">
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
        <div className="space-y-2">
          <Label>Card Information</Label>
          <div
            id={cardContainerId}
            className="border rounded-lg p-4 min-h-[120px]"
            data-testid="square-card-container"
          />
          {!isReady && (
            <p className="text-sm text-muted-foreground">Loading payment form...</p>
          )}
        </div>
      )}
    </div>
  );
}

// Export a hook for easy access to tokenization
export function useSquarePaymentForm() {
  const tokenize = async (buyerDetails?: { email?: string; givenName?: string; familyName?: string; phone?: string }): Promise<{ token?: string; verificationToken?: string; details?: any; error?: string }> => {
    // Find any square card container (works with unique IDs)
    const container = document.querySelector('[id^="square-card-"]');
    if (container && (container as any).tokenize) {
      return (container as any).tokenize(buyerDetails);
    }
    return { error: "Payment form not ready" };
  };

  return { tokenize };
}
