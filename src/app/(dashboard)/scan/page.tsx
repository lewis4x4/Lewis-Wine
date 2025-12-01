"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { BarcodeScanner } from "@/components/wine/barcode-scanner";
import { useWineByBarcode } from "@/lib/hooks/use-wine-search";
import { useCellar, useAddToInventory } from "@/lib/hooks/use-cellar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

type ScanState = "scanning" | "found" | "not-found" | "adding";

export default function ScanPage() {
  const [scannedBarcode, setScannedBarcode] = useState<string | null>(null);
  const [scanState, setScanState] = useState<ScanState>("scanning");
  const [quantity, setQuantity] = useState(1);
  const [purchasePrice, setPurchasePrice] = useState("");
  const [vintage, setVintage] = useState("");

  const router = useRouter();
  const { data: cellar } = useCellar();
  const { data: wine, isLoading: wineLoading } = useWineByBarcode(scannedBarcode);
  const addToInventory = useAddToInventory();

  const handleScan = (barcode: string) => {
    setScannedBarcode(barcode);
    setScanState("found"); // Will check wine data when it loads
  };

  const handleScanError = (error: string) => {
    toast.error(error);
  };

  const handleAddToCollection = async () => {
    if (!cellar) {
      toast.error("No cellar found");
      return;
    }

    setScanState("adding");

    try {
      await addToInventory.mutateAsync({
        cellar_id: cellar.id,
        wine_reference_id: wine?.id || null,
        custom_name: wine ? null : "Unknown Wine",
        vintage: vintage ? parseInt(vintage) : null,
        quantity,
        purchase_price_cents: purchasePrice ? Math.round(parseFloat(purchasePrice) * 100) : null,
      });

      toast.success(`Added ${wine?.name || "wine"} to your cellar!`);
      router.push("/cellar");
    } catch (error) {
      toast.error("Failed to add wine to cellar");
      setScanState("found");
    }
  };

  const handleScanAgain = () => {
    setScannedBarcode(null);
    setScanState("scanning");
    setQuantity(1);
    setPurchasePrice("");
    setVintage("");
  };

  // Determine actual state based on wine data
  const actualState = scanState === "scanning"
    ? "scanning"
    : wineLoading
      ? "found" // Show loading
      : wine
        ? "found"
        : "not-found";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-playfair text-3xl font-bold">Scan Wine</h1>
          <p className="text-muted-foreground">
            Point your camera at a wine barcode
          </p>
        </div>
        <Link href="/cellar/add">
          <Button variant="outline">Add Manually</Button>
        </Link>
      </div>

      {/* Scan Options */}
      {actualState === "scanning" && (
        <div className="grid gap-4 md:grid-cols-2 mb-6">
          <Card className="border-primary">
            <CardContent className="flex items-center gap-4 p-6">
              <div className="text-4xl">📷</div>
              <div>
                <h3 className="font-semibold">Scan Barcode</h3>
                <p className="text-sm text-muted-foreground">
                  Scan a single wine bottle barcode
                </p>
              </div>
            </CardContent>
          </Card>
          <Link href="/scan/receipt">
            <Card className="hover:border-primary transition-colors cursor-pointer h-full">
              <CardContent className="flex items-center gap-4 p-6">
                <div className="text-4xl">🧾</div>
                <div>
                  <h3 className="font-semibold">Scan Receipt</h3>
                  <p className="text-sm text-muted-foreground">
                    Import multiple wines from a receipt
                  </p>
                </div>
              </CardContent>
            </Card>
          </Link>
        </div>
      )}

      {actualState === "scanning" && (
        <BarcodeScanner onScan={handleScan} onError={handleScanError} />
      )}

      {actualState === "found" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {wineLoading ? (
                "Looking up wine..."
              ) : (
                <>
                  <span className="text-green-600">✓</span> Wine Found
                </>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {wineLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin text-4xl">🍷</div>
              </div>
            ) : wine ? (
              <>
                <div>
                  <h3 className="text-xl font-semibold">{wine.name}</h3>
                  {wine.producer && (
                    <p className="text-muted-foreground">{wine.producer}</p>
                  )}
                  <div className="mt-2 flex flex-wrap gap-2">
                    {wine.wine_type && (
                      <Badge variant="secondary">{wine.wine_type}</Badge>
                    )}
                    {wine.region && (
                      <Badge variant="outline">{wine.region}</Badge>
                    )}
                    {wine.country && (
                      <Badge variant="outline">{wine.country}</Badge>
                    )}
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="vintage">Vintage</Label>
                    <Input
                      id="vintage"
                      type="number"
                      placeholder="2020"
                      value={vintage}
                      onChange={(e) => setVintage(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="quantity">Quantity</Label>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setQuantity(Math.max(1, quantity - 1))}
                      >
                        -
                      </Button>
                      <Input
                        id="quantity"
                        type="number"
                        min={1}
                        value={quantity}
                        onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                        className="text-center"
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setQuantity(quantity + 1)}
                      >
                        +
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="price">Price per bottle</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                        $
                      </span>
                      <Input
                        id="price"
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        value={purchasePrice}
                        onChange={(e) => setPurchasePrice(e.target.value)}
                        className="pl-7"
                      />
                    </div>
                  </div>
                </div>
              </>
            ) : null}
          </CardContent>
          <CardFooter className="flex gap-2">
            <Button variant="outline" onClick={handleScanAgain}>
              Scan Another
            </Button>
            <Button
              onClick={handleAddToCollection}
              disabled={addToInventory.isPending || wineLoading}
            >
              {addToInventory.isPending ? "Adding..." : "Add to Cellar"}
            </Button>
          </CardFooter>
        </Card>
      )}

      {actualState === "not-found" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span className="text-yellow-600">⚠</span> Wine Not Found
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">
              We couldn&apos;t find this wine in our database. You can add it
              manually or try scanning again.
            </p>
            <p className="text-sm text-muted-foreground">
              Barcode: <code className="bg-muted px-2 py-1 rounded">{scannedBarcode}</code>
            </p>
          </CardContent>
          <CardFooter className="flex gap-2">
            <Button variant="outline" onClick={handleScanAgain}>
              Scan Again
            </Button>
            <Link href={`/cellar/add?barcode=${scannedBarcode}`}>
              <Button>Add Manually</Button>
            </Link>
          </CardFooter>
        </Card>
      )}
    </div>
  );
}
