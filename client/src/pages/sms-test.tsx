import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

export default function SMSTest() {
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("Test message from CustomPictureFrames.com");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleSendTestSMS = async () => {
    if (!phone) {
      toast({
        title: "Phone Required",
        description: "Please enter a phone number",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);

    try {
      const response = await apiRequest("POST", "/api/test-sms", { phone, message });
      const data = await response.json();

      toast({
        title: "✅ SMS Sent Successfully",
        description: `Test message sent to ${phone}`,
      });

      console.log("SMS test response:", data);
    } catch (error: any) {
      console.error("SMS test error:", error);
      toast({
        title: "❌ SMS Failed",
        description: error.message || "Failed to send test SMS",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle>Twilio SMS Test</CardTitle>
          <CardDescription>
            Test your Twilio SMS configuration by sending a test message
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="phone">Phone Number</Label>
            <Input
              id="phone"
              type="tel"
              placeholder="(555) 123-4567"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              data-testid="input-phone"
            />
            <p className="text-sm text-muted-foreground">
              Enter phone number in any format (will be auto-formatted to E.164)
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="message">Test Message</Label>
            <Textarea
              id="message"
              placeholder="Test message content"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
              data-testid="input-message"
            />
          </div>

          <Button
            onClick={handleSendTestSMS}
            disabled={isLoading || !phone}
            className="w-full"
            data-testid="button-send-test-sms"
          >
            {isLoading ? "Sending..." : "Send Test SMS"}
          </Button>

          <div className="bg-muted p-4 rounded-md space-y-2">
            <h4 className="font-semibold text-sm">Debug Info:</h4>
            <p className="text-xs text-muted-foreground">
              This test will attempt to send an SMS using your configured Twilio credentials.
              Check the browser console and server logs for detailed debug information.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
