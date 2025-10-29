import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Header } from "@/components/header";
import NewOrder from "@/pages/new-order";
import OrderList from "@/pages/order-list";
import OrderDetail from "@/pages/order-detail";
import ControlPanel from "@/pages/control-panel";
import SMSTest from "@/pages/sms-test";
import NotFound from "@/pages/not-found";
import { useEffect, useState } from "react";

function Router() {
  return (
    <Switch>
      <Route path="/" component={NewOrder} />
      <Route path="/orders" component={OrderList} />
      <Route path="/order/:id" component={OrderDetail} />
      <Route path="/control-panel" component={ControlPanel} />
      <Route path="/sms-test" component={SMSTest} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check authentication on mount
    fetch('/api/auth/user', { credentials: 'include' })
      .then(res => {
        if (res.status === 401 || res.status === 403) {
          // Not authenticated or no permission - redirect to main site
          window.location.href = 'https://framesbox.com';
          return;
        }
        return res.json();
      })
      .then(user => {
        if (user) {
          setIsAuthenticated(true);
        }
        setIsLoading(false);
      })
      .catch(() => {
        // Error - redirect to main site
        window.location.href = 'https://framesbox.com';
      });
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <div className="min-h-screen bg-background">
          <Header />
          <Router />
        </div>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
