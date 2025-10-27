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
  // Simple two-tier markup
  fullFrameMarkup: number;
  componentMarkup: number;
  
  // Basic settings
  chopOnlyJoinFt: number;
  minimumPrice: number;
  
  // Shipping
  shippingRates: { min: number; max: number; rate: number }[];
  
  // Materials
  acrylicPrices: { type: string; pricePerSqIn: number }[];
  backingPrices: { type: string; pricePerSqIn: number }[];
  
  // Add-on services (per square inch)
  printPaperPricePerSqIn: number;
  dryMountPricePerSqIn: number;
  printCanvasRolledPricePerSqIn: number;
  printCanvasGalleryPricePerSqIn: number;
  canvasStretchingPricePerSqIn: number;
  
  // Fixed-cost add-ons (retail prices)
  engravedPlaquePrice: number;
  ledsPrice: number;
  shadowboxFittingPrice: number;
  additionalLaborPrice: number;
  
  // Stacker frames
  stackerFrames: { sku: string; depth: number; pricePerFt: number }[];
  stackerAssemblyCharge: number;
  stackerMarkup: number;
  topperPieces: { sku: string; depth: number; pricePerFt: number }[];
}

interface Moulding {
  sku: string;
  width: number;
  supplier: string;
  description: string;
  retailPrice: number;
  discountPercent: number;
  costPerFoot: number;
  chop: number;
  joinCost: number;
}

interface Supply {
  sku: string;
  name: string;
  price: number;
  itemType: string;
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
                  if (fetchedConfig) {
                    setConfig(fetchedConfig);
                  }
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
                if (fetchedConfig) {
                  setConfig(fetchedConfig);
                }
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
                  <Label htmlFor="fullFrameMarkup">Full Frame Markup</Label>
                  <Input
                    id="fullFrameMarkup"
                    type="number"
                    step="0.1"
                    value={currentConfig.fullFrameMarkup}
                    onChange={(e) => setConfig({ ...currentConfig, fullFrameMarkup: parseFloat(e.target.value) })}
                    disabled={!editMode}
                    data-testid="input-full-frame-markup"
                  />
                  <p className="text-sm text-muted-foreground">Current: {currentConfig.fullFrameMarkup}× (Frame + Acrylic + Backing + optional Mats)</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="componentMarkup">Component Markup</Label>
                  <Input
                    id="componentMarkup"
                    type="number"
                    step="0.1"
                    value={currentConfig.componentMarkup}
                    onChange={(e) => setConfig({ ...currentConfig, componentMarkup: parseFloat(e.target.value) })}
                    disabled={!editMode}
                    data-testid="input-component-markup"
                  />
                  <p className="text-sm text-muted-foreground">Current: {currentConfig.componentMarkup}× (Any individual component)</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="minimumPrice">Minimum Price Floor</Label>
                  <Input
                    id="minimumPrice"
                    type="number"
                    value={currentConfig.minimumPrice}
                    onChange={(e) => setConfig({ ...currentConfig, minimumPrice: parseFloat(e.target.value) })}
                    disabled={!editMode}
                    data-testid="input-minimum-price"
                  />
                  <p className="text-sm text-muted-foreground">Current: ${currentConfig.minimumPrice} (applies to orders with frames)</p>
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

          {/* Material Prices - Acrylic & Backing Combined */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                <CardTitle>Material Prices</CardTitle>
              </div>
              <CardDescription>Price per square inch for acrylic and backing materials</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {/* Acrylic Section */}
                <div className="space-y-3">
                  <Label className="text-sm font-semibold">Acrylic</Label>
                  <div className="space-y-3 pl-4 border-l-2 border-border">
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
                </div>

                {/* Backing Section */}
                <div className="space-y-3">
                  <Label className="text-sm font-semibold">Backing</Label>
                  <div className="space-y-3 pl-4 border-l-2 border-border">
                    {currentConfig.backingPrices.map((item, idx) => (
                      <div key={idx} className="grid grid-cols-2 gap-4 items-center">
                        <div className="text-sm font-medium">{item.type}</div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm">$</span>
                          <Input
                            type="number"
                            step="0.0001"
                            value={item.pricePerSqIn}
                            onChange={(e) => {
                              const newPrices = [...currentConfig.backingPrices];
                              newPrices[idx].pricePerSqIn = parseFloat(e.target.value);
                              setConfig({ ...currentConfig, backingPrices: newPrices });
                            }}
                            disabled={!editMode}
                            className="w-32"
                            data-testid={`input-backing-${idx}`}
                          />
                          <span className="text-sm text-muted-foreground">/sq in</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Add-On Pricing */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                <CardTitle>Add-On Services Pricing</CardTitle>
              </div>
              <CardDescription>Configurable pricing for additional services</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-8">
                {/* Per Square Inch Services */}
                <div className="space-y-4">
                  <div className="space-y-1">
                    <Label className="text-sm font-semibold">Per Square Inch Services</Label>
                    <p className="text-xs text-muted-foreground">These services receive markup treatment (4.5× or 5.5×)</p>
                  </div>
                  <div className="pl-4 border-l-2 border-border space-y-4">
                    <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                      <div className="flex items-center justify-between gap-4">
                        <Label htmlFor="printPaperPricePerSqIn" className="text-sm font-medium whitespace-nowrap">Print Paper</Label>
                        <div className="flex items-center gap-2">
                          <span className="text-sm">$</span>
                          <Input
                            id="printPaperPricePerSqIn"
                            type="number"
                            step="0.001"
                            value={currentConfig.printPaperPricePerSqIn}
                            onChange={(e) => setConfig({ ...currentConfig, printPaperPricePerSqIn: parseFloat(e.target.value) })}
                            disabled={!editMode}
                            className="w-24"
                            data-testid="input-print-paper-price"
                          />
                          <span className="text-xs text-muted-foreground">/sq in</span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between gap-4">
                        <Label htmlFor="dryMountPricePerSqIn" className="text-sm font-medium whitespace-nowrap">Dry Mount</Label>
                        <div className="flex items-center gap-2">
                          <span className="text-sm">$</span>
                          <Input
                            id="dryMountPricePerSqIn"
                            type="number"
                            step="0.001"
                            value={currentConfig.dryMountPricePerSqIn}
                            onChange={(e) => setConfig({ ...currentConfig, dryMountPricePerSqIn: parseFloat(e.target.value) })}
                            disabled={!editMode}
                            className="w-24"
                            data-testid="input-dry-mount-price"
                          />
                          <span className="text-xs text-muted-foreground">/sq in</span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between gap-4">
                        <Label htmlFor="printCanvasRolledPricePerSqIn" className="text-sm font-medium whitespace-nowrap">Canvas (Rolled)</Label>
                        <div className="flex items-center gap-2">
                          <span className="text-sm">$</span>
                          <Input
                            id="printCanvasRolledPricePerSqIn"
                            type="number"
                            step="0.001"
                            value={currentConfig.printCanvasRolledPricePerSqIn}
                            onChange={(e) => setConfig({ ...currentConfig, printCanvasRolledPricePerSqIn: parseFloat(e.target.value) })}
                            disabled={!editMode}
                            className="w-24"
                            data-testid="input-canvas-rolled-price"
                          />
                          <span className="text-xs text-muted-foreground">/sq in</span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between gap-4">
                        <Label htmlFor="printCanvasGalleryPricePerSqIn" className="text-sm font-medium whitespace-nowrap">Canvas (Gallery/Museum)</Label>
                        <div className="flex items-center gap-2">
                          <span className="text-sm">$</span>
                          <Input
                            id="printCanvasGalleryPricePerSqIn"
                            type="number"
                            step="0.001"
                            value={currentConfig.printCanvasGalleryPricePerSqIn}
                            onChange={(e) => setConfig({ ...currentConfig, printCanvasGalleryPricePerSqIn: parseFloat(e.target.value) })}
                            disabled={!editMode}
                            className="w-24"
                            data-testid="input-canvas-gallery-price"
                          />
                          <span className="text-xs text-muted-foreground">/sq in</span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between gap-4">
                        <Label htmlFor="canvasStretchingPricePerSqIn" className="text-sm font-medium whitespace-nowrap">Canvas Stretching</Label>
                        <div className="flex items-center gap-2">
                          <span className="text-sm">$</span>
                          <Input
                            id="canvasStretchingPricePerSqIn"
                            type="number"
                            step="0.001"
                            value={currentConfig.canvasStretchingPricePerSqIn}
                            onChange={(e) => setConfig({ ...currentConfig, canvasStretchingPricePerSqIn: parseFloat(e.target.value) })}
                            disabled={!editMode}
                            className="w-24"
                            data-testid="input-canvas-stretching-price"
                          />
                          <span className="text-xs text-muted-foreground">/sq in</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Fixed Cost Services */}
                <div className="space-y-4">
                  <div className="space-y-1">
                    <Label className="text-sm font-semibold">Fixed Cost Services</Label>
                    <p className="text-xs text-muted-foreground">Retail prices with no markup applied (1×)</p>
                  </div>
                  <div className="pl-4 border-l-2 border-border space-y-4">
                    <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                      <div className="flex items-center justify-between gap-4">
                        <Label htmlFor="engravedPlaquePrice" className="text-sm font-medium whitespace-nowrap">Engraved Plaque</Label>
                        <div className="flex items-center gap-2">
                          <span className="text-sm">$</span>
                          <Input
                            id="engravedPlaquePrice"
                            type="number"
                            step="0.50"
                            value={currentConfig.engravedPlaquePrice}
                            onChange={(e) => setConfig({ ...currentConfig, engravedPlaquePrice: parseFloat(e.target.value) })}
                            disabled={!editMode}
                            className="w-24"
                            data-testid="input-plaque-price"
                          />
                        </div>
                      </div>
                      <div className="flex items-center justify-between gap-4">
                        <Label htmlFor="ledsPrice" className="text-sm font-medium whitespace-nowrap">LEDs</Label>
                        <div className="flex items-center gap-2">
                          <span className="text-sm">$</span>
                          <Input
                            id="ledsPrice"
                            type="number"
                            step="0.50"
                            value={currentConfig.ledsPrice}
                            onChange={(e) => setConfig({ ...currentConfig, ledsPrice: parseFloat(e.target.value) })}
                            disabled={!editMode}
                            className="w-24"
                            data-testid="input-leds-price"
                          />
                        </div>
                      </div>
                      <div className="flex items-center justify-between gap-4">
                        <Label htmlFor="shadowboxFittingPrice" className="text-sm font-medium whitespace-nowrap">Shadowbox Fitting</Label>
                        <div className="flex items-center gap-2">
                          <span className="text-sm">$</span>
                          <Input
                            id="shadowboxFittingPrice"
                            type="number"
                            step="0.50"
                            value={currentConfig.shadowboxFittingPrice}
                            onChange={(e) => setConfig({ ...currentConfig, shadowboxFittingPrice: parseFloat(e.target.value) })}
                            disabled={!editMode}
                            className="w-24"
                            data-testid="input-shadowbox-fitting-price"
                          />
                        </div>
                      </div>
                      <div className="flex items-center justify-between gap-4">
                        <Label htmlFor="additionalLaborPrice" className="text-sm font-medium whitespace-nowrap">Additional Labor</Label>
                        <div className="flex items-center gap-2">
                          <span className="text-sm">$</span>
                          <Input
                            id="additionalLaborPrice"
                            type="number"
                            step="0.50"
                            value={currentConfig.additionalLaborPrice}
                            onChange={(e) => setConfig({ ...currentConfig, additionalLaborPrice: parseFloat(e.target.value) })}
                            disabled={!editMode}
                            className="w-24"
                            data-testid="input-additional-labor-price"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Stacker Frames (Deep Shadowbox) - Combined with Topper Pieces */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                <CardTitle>Stacker Frames (Deep Shadowbox)</CardTitle>
              </div>
              <CardDescription>Frame layers and topper options for custom depth shadowboxes</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-8">
                {/* Frame Layer Options */}
                <div className="space-y-3">
                  <Label className="text-sm font-semibold">Frame Layer Options</Label>
                  <div className="pl-4 border-l-2 border-border space-y-3">
                    {currentConfig.stackerFrames.map((frame, idx) => (
                      <div key={idx} className="flex items-center justify-between gap-4">
                        <div className="text-sm font-medium">{frame.sku} ({frame.depth}")</div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm">$</span>
                          <Input
                            type="number"
                            step="0.01"
                            value={frame.pricePerFt}
                            onChange={(e) => {
                              const newFrames = [...currentConfig.stackerFrames];
                              newFrames[idx].pricePerFt = parseFloat(e.target.value);
                              setConfig({ ...currentConfig, stackerFrames: newFrames });
                            }}
                            disabled={!editMode}
                            className="w-24"
                            data-testid={`input-stacker-frame-${idx}`}
                          />
                          <span className="text-sm text-muted-foreground">/ft</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Topper Frame Options */}
                <div className="space-y-3">
                  <Label className="text-sm font-semibold">Topper Frame Options</Label>
                  <div className="pl-4 border-l-2 border-border space-y-3">
                    {currentConfig.topperPieces.map((topper, idx) => (
                      <div key={idx} className="flex items-center justify-between gap-4">
                        <div className="text-sm font-medium">{topper.sku} ({topper.depth}")</div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm">$</span>
                          <Input
                            type="number"
                            step="0.01"
                            value={topper.pricePerFt}
                            onChange={(e) => {
                              const newToppers = [...currentConfig.topperPieces];
                              newToppers[idx].pricePerFt = parseFloat(e.target.value);
                              setConfig({ ...currentConfig, topperPieces: newToppers });
                            }}
                            disabled={!editMode}
                            className="w-24"
                            data-testid={`input-topper-${idx}`}
                          />
                          <span className="text-sm text-muted-foreground">/ft</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Assembly & Markup Settings */}
                <div className="pt-2 border-t">
                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="stackerAssemblyCharge">Assembly Charge</Label>
                      <div className="flex items-center gap-2">
                        <span className="text-sm">$</span>
                        <Input
                          id="stackerAssemblyCharge"
                          type="number"
                          step="0.01"
                          value={currentConfig.stackerAssemblyCharge}
                          onChange={(e) => setConfig({ ...currentConfig, stackerAssemblyCharge: parseFloat(e.target.value) })}
                          disabled={!editMode}
                          className="w-24"
                          data-testid="input-stacker-assembly"
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">Flat fee for assembling stacker layers</p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="stackerMarkup">Stacker Markup Multiplier</Label>
                      <Input
                        id="stackerMarkup"
                        type="number"
                        step="0.01"
                        value={currentConfig.stackerMarkup}
                        onChange={(e) => setConfig({ ...currentConfig, stackerMarkup: parseFloat(e.target.value) })}
                        disabled={!editMode}
                        className="w-24"
                        data-testid="input-stacker-markup"
                      />
                      <p className="text-xs text-muted-foreground">Current: {currentConfig.stackerMarkup}×</p>
                    </div>
                  </div>
                </div>
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
                  <div className="max-h-[500px] overflow-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-muted sticky top-0">
                        <tr>
                          <th className="text-left p-2 font-medium whitespace-nowrap">SKU</th>
                          <th className="text-left p-2 font-medium whitespace-nowrap">Width</th>
                          <th className="text-left p-2 font-medium whitespace-nowrap">Supplier</th>
                          <th className="text-left p-2 font-medium whitespace-nowrap">Description</th>
                          <th className="text-right p-2 font-medium whitespace-nowrap">Retail Price</th>
                          <th className="text-right p-2 font-medium whitespace-nowrap">Discount %</th>
                          <th className="text-right p-2 font-medium whitespace-nowrap">Cost/Ft</th>
                          <th className="text-right p-2 font-medium whitespace-nowrap">Chop</th>
                          <th className="text-right p-2 font-medium whitespace-nowrap">Join Cost</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredMouldings.map((moulding, idx) => (
                          <tr key={moulding.sku} className={idx % 2 === 0 ? "bg-background" : "bg-muted/30"}>
                            <td className="p-2 font-mono whitespace-nowrap">{moulding.sku}</td>
                            <td className="p-2 whitespace-nowrap">{moulding.width}"</td>
                            <td className="p-2 whitespace-nowrap">{moulding.supplier}</td>
                            <td className="p-2 max-w-xs truncate" title={moulding.description}>{moulding.description}</td>
                            <td className="p-2 text-right font-mono whitespace-nowrap">${moulding.retailPrice.toFixed(2)}</td>
                            <td className="p-2 text-right whitespace-nowrap">{moulding.discountPercent}%</td>
                            <td className="p-2 text-right font-mono whitespace-nowrap">${moulding.costPerFoot.toFixed(2)}</td>
                            <td className="p-2 text-right font-mono whitespace-nowrap">${moulding.chop.toFixed(2)}</td>
                            <td className="p-2 text-right font-mono whitespace-nowrap">${moulding.joinCost.toFixed(2)}</td>
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
                  <div className="max-h-[500px] overflow-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-muted sticky top-0">
                        <tr>
                          <th className="text-left p-2 font-medium whitespace-nowrap">SKU</th>
                          <th className="text-left p-2 font-medium whitespace-nowrap">Name</th>
                          <th className="text-right p-2 font-medium whitespace-nowrap">Price</th>
                          <th className="text-left p-2 font-medium whitespace-nowrap">Item Type</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredSupplies.map((supply, idx) => (
                          <tr key={supply.sku} className={idx % 2 === 0 ? "bg-background" : "bg-muted/30"}>
                            <td className="p-2 font-mono whitespace-nowrap">{supply.sku}</td>
                            <td className="p-2 max-w-md truncate" title={supply.name}>{supply.name}</td>
                            <td className="p-2 text-right font-mono whitespace-nowrap">${supply.price.toFixed(2)}</td>
                            <td className="p-2 whitespace-nowrap">{supply.itemType}</td>
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
