import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Lock, Settings2, DollarSign, TruckIcon, Package, Search, Database } from "lucide-react";
import { queryClient } from "@/lib/queryClient";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface PricingConfig {
  markup: number;
  chopOnlyJoinFt: number;
  shippingRates: { min: number; max: number; rate: number }[];
  acrylicPrices: { type: string; pricePerSqIn: number }[];
  backingPrices: { type: string; price: number }[];
}

interface Moulding {
  sku: string;
  joinCost: number;
  width: number;
}

interface Supply {
  sku: string;
  price: number;
}

export default function ControlPanel() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState("");
  const [editMode, setEditMode] = useState(false);
  const [config, setConfig] = useState<PricingConfig | null>(null);
  const [mouldingSearch, setMouldingSearch] = useState("");
  const [supplySearch, setSupplySearch] = useState("");
  const { toast } = useToast();

  const { data: fetchedConfig } = useQuery<PricingConfig>({
    queryKey: ["/api/control-panel/config"],
    enabled: isAuthenticated,
  });

  const { data: mouldings = [] } = useQuery<Moulding[]>({
    queryKey: ["/api/control-panel/mouldings"],
    enabled: isAuthenticated,
  });

  const { data: supplies = [] } = useQuery<Supply[]>({
    queryKey: ["/api/control-panel/supplies"],
    enabled: isAuthenticated,
  });

  // Initialize config when fetched
  useEffect(() => {
    if (fetchedConfig && !config) {
      setConfig(fetchedConfig);
    }
  }, [fetchedConfig, config]);

  // Filter mouldings and supplies based on search
  const filteredMouldings = useMemo(() => {
    if (!mouldingSearch) return mouldings.slice(0, 50); // Show first 50 by default
    return mouldings.filter(m => 
      m.sku.toLowerCase().includes(mouldingSearch.toLowerCase())
    ).slice(0, 100);
  }, [mouldings, mouldingSearch]);

  const filteredSupplies = useMemo(() => {
    if (!supplySearch) return supplies.slice(0, 50); // Show first 50 by default
    return supplies.filter(s => 
      s.sku.toLowerCase().includes(supplySearch.toLowerCase())
    ).slice(0, 100);
  }, [supplies, supplySearch]);

  const verifyMutation = useMutation({
    mutationFn: async (pwd: string) => {
      const res = await fetch("/api/control-panel/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: pwd }),
      });
      return res.json();
    },
    onSuccess: (data) => {
      if (data.valid) {
        setIsAuthenticated(true);
        toast({ title: "Access Granted", description: "Welcome to the control panel" });
      } else {
        toast({ title: "Access Denied", description: "Invalid password", variant: "destructive" });
      }
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (updates: Partial<PricingConfig>) => {
      const res = await fetch("/api/control-panel/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, ...updates }),
      });
      if (!res.ok) throw new Error("Update failed");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/control-panel/config"] });
      setEditMode(false);
      toast({ title: "Saved", description: "Pricing configuration updated successfully" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update configuration", variant: "destructive" });
    },
  });

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    verifyMutation.mutate(password);
  };

  const handleSave = () => {
    if (config) {
      updateMutation.mutate(config);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <div className="p-4 bg-primary/10 rounded-full">
                <Lock className="h-8 w-8 text-primary" />
              </div>
            </div>
            <CardTitle className="text-2xl">Control Panel</CardTitle>
            <CardDescription>Enter password to access pricing configuration</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  data-testid="input-password"
                />
              </div>
              <Button
                type="submit"
                className="w-full"
                disabled={verifyMutation.isPending}
                data-testid="button-login"
              >
                {verifyMutation.isPending ? "Verifying..." : "Access Control Panel"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  const currentConfig = config || fetchedConfig;
  if (!currentConfig) return null;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 md:px-8 py-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Settings2 className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-3xl font-bold">Pricing Control Panel</h1>
              <p className="text-muted-foreground">Manage pricing configuration and business levers</p>
            </div>
          </div>
          <div className="flex gap-2">
            {editMode ? (
              <>
                <Button variant="outline" onClick={() => {
                  setConfig(fetchedConfig);
                  setEditMode(false);
                }} data-testid="button-cancel">
                  Cancel
                </Button>
                <Button onClick={handleSave} disabled={updateMutation.isPending} data-testid="button-save">
                  {updateMutation.isPending ? "Saving..." : "Save Changes"}
                </Button>
              </>
            ) : (
              <Button onClick={() => {
                setConfig(fetchedConfig || null);
                setEditMode(true);
              }} data-testid="button-edit">
                Edit Configuration
              </Button>
            )}
          </div>
        </div>

        <Tabs defaultValue="config" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="config">Configuration</TabsTrigger>
            <TabsTrigger value="mouldings">Mouldings ({mouldings.length})</TabsTrigger>
            <TabsTrigger value="supplies">Supplies ({supplies.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="config" className="space-y-6 mt-6">
          {/* Business Levers */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                <CardTitle>Business Levers</CardTitle>
              </div>
              <CardDescription>Key multipliers and adjustments affecting all pricing</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="markup">Markup Multiplier</Label>
                  <Input
                    id="markup"
                    type="number"
                    step="0.01"
                    value={currentConfig.markup}
                    onChange={(e) => setConfig({ ...currentConfig, markup: parseFloat(e.target.value) })}
                    disabled={!editMode}
                    data-testid="input-markup"
                  />
                  <p className="text-sm text-muted-foreground">Current: {currentConfig.markup}×</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="chopOnlyJoinFt">Chop Only Join Feet</Label>
                  <Input
                    id="chopOnlyJoinFt"
                    type="number"
                    value={currentConfig.chopOnlyJoinFt}
                    onChange={(e) => setConfig({ ...currentConfig, chopOnlyJoinFt: parseInt(e.target.value) })}
                    disabled={!editMode}
                    data-testid="input-chop-join-ft"
                  />
                  <p className="text-sm text-muted-foreground">Join feet for chop-only orders</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Shipping Rates */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <TruckIcon className="h-5 w-5" />
                <CardTitle>Shipping Rates</CardTitle>
              </div>
              <CardDescription>Based on united inches (perimeter + mats)</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {currentConfig.shippingRates.map((rate, idx) => (
                  <div key={idx} className="grid grid-cols-4 gap-4 items-center">
                    <div className="col-span-3 text-sm">
                      {rate.min}" to {rate.max}" united inches
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm">$</span>
                      <Input
                        type="number"
                        value={rate.rate}
                        onChange={(e) => {
                          const newRates = [...currentConfig.shippingRates];
                          newRates[idx].rate = parseFloat(e.target.value);
                          setConfig({ ...currentConfig, shippingRates: newRates });
                        }}
                        disabled={!editMode}
                        className="w-24"
                        data-testid={`input-shipping-${idx}`}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Acrylic Prices */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                <CardTitle>Acrylic Prices</CardTitle>
              </div>
              <CardDescription>Price per square inch</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {currentConfig.acrylicPrices.map((item, idx) => (
                  <div key={idx} className="grid grid-cols-2 gap-4 items-center">
                    <div className="text-sm font-medium">{item.type}</div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm">$</span>
                      <Input
                        type="number"
                        step="0.001"
                        value={item.pricePerSqIn}
                        onChange={(e) => {
                          const newPrices = [...currentConfig.acrylicPrices];
                          newPrices[idx].pricePerSqIn = parseFloat(e.target.value);
                          setConfig({ ...currentConfig, acrylicPrices: newPrices });
                        }}
                        disabled={!editMode}
                        className="w-32"
                        data-testid={`input-acrylic-${idx}`}
                      />
                      <span className="text-sm text-muted-foreground">/sq in</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Backing Prices */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                <CardTitle>Backing Prices</CardTitle>
              </div>
              <CardDescription>Flat rate per order</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {currentConfig.backingPrices.map((item, idx) => (
                  <div key={idx} className="grid grid-cols-2 gap-4 items-center">
                    <div className="text-sm font-medium">{item.type}</div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm">$</span>
                      <Input
                        type="number"
                        step="0.50"
                        value={item.price}
                        onChange={(e) => {
                          const newPrices = [...currentConfig.backingPrices];
                          newPrices[idx].price = parseFloat(e.target.value);
                          setConfig({ ...currentConfig, backingPrices: newPrices });
                        }}
                        disabled={!editMode}
                        className="w-32"
                        data-testid={`input-backing-${idx}`}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
          </TabsContent>

          <TabsContent value="mouldings" className="space-y-6 mt-6">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Database className="h-5 w-5" />
                  <CardTitle>Moulding Pricing Data</CardTitle>
                </div>
                <CardDescription>
                  {mouldings.length} moulding SKUs loaded from Excel file
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-2">
                  <Search className="h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by SKU..."
                    value={mouldingSearch}
                    onChange={(e) => setMouldingSearch(e.target.value)}
                    className="max-w-sm"
                    data-testid="input-moulding-search"
                  />
                </div>
                <div className="border rounded-lg overflow-hidden">
                  <div className="max-h-[500px] overflow-y-auto">
                    <table className="w-full">
                      <thead className="bg-muted sticky top-0">
                        <tr>
                          <th className="text-left p-3 font-medium">SKU</th>
                          <th className="text-right p-3 font-medium">Join Cost</th>
                          <th className="text-right p-3 font-medium">Width (in)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredMouldings.map((moulding, idx) => (
                          <tr key={moulding.sku} className={idx % 2 === 0 ? "bg-background" : "bg-muted/30"}>
                            <td className="p-3 font-mono text-sm">{moulding.sku}</td>
                            <td className="p-3 text-right font-mono text-sm">${moulding.joinCost.toFixed(2)}</td>
                            <td className="p-3 text-right text-sm">{moulding.width}"</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">
                  {mouldingSearch 
                    ? `Showing ${filteredMouldings.length} results (max 100)`
                    : `Showing first 50 of ${mouldings.length} mouldings. Use search to find specific SKUs.`
                  }
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="supplies" className="space-y-6 mt-6">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Database className="h-5 w-5" />
                  <CardTitle>Supply Pricing Data</CardTitle>
                </div>
                <CardDescription>
                  {supplies.length} supply SKUs loaded from Excel file
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-2">
                  <Search className="h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by SKU..."
                    value={supplySearch}
                    onChange={(e) => setSupplySearch(e.target.value)}
                    className="max-w-sm"
                    data-testid="input-supply-search"
                  />
                </div>
                <div className="border rounded-lg overflow-hidden">
                  <div className="max-h-[500px] overflow-y-auto">
                    <table className="w-full">
                      <thead className="bg-muted sticky top-0">
                        <tr>
                          <th className="text-left p-3 font-medium">SKU</th>
                          <th className="text-right p-3 font-medium">Price</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredSupplies.map((supply, idx) => (
                          <tr key={supply.sku} className={idx % 2 === 0 ? "bg-background" : "bg-muted/30"}>
                            <td className="p-3 font-mono text-sm">{supply.sku}</td>
                            <td className="p-3 text-right font-mono text-sm">${supply.price.toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">
                  {supplySearch 
                    ? `Showing ${filteredSupplies.length} results (max 100)`
                    : `Showing first 50 of ${supplies.length} supplies. Use search to find specific SKUs.`
                  }
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
