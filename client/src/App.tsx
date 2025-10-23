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
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      <Route path="/" component={NewOrder} />
      <Route path="/orders" component={OrderList} />
      <Route path="/order/:id" component={OrderDetail} />
      <Route path="/control-panel" component={ControlPanel} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
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
