import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { CreditCard, Loader2 } from "lucide-react";
import { SquarePaymentForm, useSquarePaymentForm } from "./SquarePaymentForm";

interface PaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string;
  balance: string;
  onPaymentSuccess: () => void;
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
  const { tokenize } = useSquarePaymentForm();

  useEffect(() => {
    if (open) {
      // Reset amount to current balance when dialog opens
      setAmount(balance);
    }
  }, [open, balance]);

  const handlePayment = async () => {
    if (!amount || parseFloat(amount) <= 0) {
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
      const result = await tokenize();
      
      if (result.error) {
        throw new Error(result.error);
      }

      if (result.token) {
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
            Payment
          </DialogTitle>
          <DialogDescription>
            Order #{orderId.slice(0, 8).toUpperCase()} · Balance due: ${balance}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <SquarePaymentForm
            amount={amount}
            onAmountChange={setAmount}
            maxAmount={balance}
            showAmountInput={true}
          />

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
