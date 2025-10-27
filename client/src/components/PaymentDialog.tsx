import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { CreditCard, Loader2 } from "lucide-react";

interface PaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string;
  balance: string;
  onPaymentSuccess: () => void;
}

declare global {
  interface Window {
    Square?: any;
  }
}

export function PaymentDialog({
  open,
  onOpenChange,
  orderId,
  balance,
  onPaymentSuccess,
}: PaymentDialogProps) {
  const { toast } = useToast();
  const [amount, setAmount] = useState(balance);
  const [processing, setProcessing] = useState(false);
  const [card, setCard] = useState<any>(null);
  const [payments, setPayments] = useState<any>(null);

  useEffect(() => {
    if (!open) return;

    const initializeSquare = async () => {
      if (!window.Square) {
        toast({
          title: "Error",
          description: "Square payment form is not available.",
          variant: "destructive",
        });
        return;
      }

      try {
        const paymentsInstance = window.Square.payments(
          import.meta.env.VITE_SQUARE_APPLICATION_ID,
          import.meta.env.VITE_SQUARE_LOCATION_ID
        );
        setPayments(paymentsInstance);

        const cardInstance = await paymentsInstance.card();
        await cardInstance.attach('#card-container');
        setCard(cardInstance);
      } catch (error) {
        console.error('Square initialization error:', error);
        toast({
          title: "Error",
          description: "Failed to initialize payment form.",
          variant: "destructive",
        });
      }
    };

    initializeSquare();

    return () => {
      if (card) {
        card.destroy();
      }
    };
  }, [open]);

  const handlePayment = async () => {
    if (!card || !amount || parseFloat(amount) <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid payment amount.",
        variant: "destructive",
      });
      return;
    }

    setProcessing(true);

    try {
      // Tokenize card details
      const result = await card.tokenize();
      
      if (result.status === 'OK') {
        // Send payment to backend
        const response = await fetch('/api/process-payment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            orderId,
            amount: parseFloat(amount).toFixed(2),
            sourceId: result.token,
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Payment failed');
        }

        toast({
          title: "Payment Successful",
          description: `$${amount} payment processed. New balance: $${data.newBalance}`,
        });

        onOpenChange(false);
        onPaymentSuccess();
      } else {
        throw new Error(result.errors?.[0]?.message || 'Card tokenization failed');
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Collect Payment
          </DialogTitle>
          <DialogDescription>
            Process a payment for Order #{orderId.slice(0, 8).toUpperCase()}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="payment-amount">Payment Amount</Label>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">$</span>
              <Input
                id="payment-amount"
                type="number"
                step="0.01"
                min="0"
                max={parseFloat(balance)}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                data-testid="input-payment-amount"
              />
            </div>
            <p className="text-sm text-muted-foreground">
              Current balance: ${balance}
            </p>
          </div>

          <div className="space-y-2">
            <Label>Card Details</Label>
            <div 
              id="card-container" 
              className="border rounded-md p-3 min-h-[100px]"
              data-testid="square-card-container"
            />
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
              disabled={processing || !amount || parseFloat(amount) <= 0}
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
      </DialogContent>
    </Dialog>
  );
}
