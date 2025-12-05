"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useCellar, useAddToInventory } from "@/lib/hooks/use-cellar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import type { LabelScanResult, WineType } from "@/types/database";

type ScanState = "idle" | "uploading" | "processing" | "review" | "adding";

export default function ScanLabelPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { data: cellar } = useCellar();
  const addToInventory = useAddToInventory();

  const [scanState, setScanState] = useState<ScanState>("idle");
  const [scanResult, setScanResult] = useState<LabelScanResult | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Editable wine fields
  const [wineName, setWineName] = useState("");
  const [producer, setProducer] = useState("");
  const [vintage, setVintage] = useState<string>("");
  const [wineType, setWineType] = useState<WineType | "">("");
  const [region, setRegion] = useState("");
  const [country, setCountry] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [purchasePrice, setPurchasePrice] = useState("");

  const handleFileSelect = useCallback(async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }

    // Create preview
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    setScanState("uploading");

    try {
      setScanState("processing");

      const formData = new FormData();
      formData.append("label", file);

      const response = await fetch("/api/label/scan", {
        method: "POST",
        body: formData,
      });

      const result: LabelScanResult = await response.json();

      if (!result.success || !result.wine) {
        throw new Error(result.error || "Failed to scan label");
      }

      setScanResult(result);

      // Pre-fill editable fields
      setWineName(result.wine.name || "");
      setProducer(result.wine.producer || "");
      setVintage(result.wine.vintage?.toString() || "");
      setWineType(result.wine.wine_type || "");
      setRegion(result.wine.region || "");
      setCountry(result.wine.country || "");

      setScanState("review");
      toast.success("Label scanned successfully!");
    } catch (error) {
      console.error("Scan error:", error);
      toast.error(error instanceof Error ? error.message : "Failed to scan label");
      setScanState("idle");
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file) handleFileSelect(file);
    },
    [handleFileSelect]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  // Cleanup object URL on unmount to prevent memory leak
  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const handleAddToCellar = async () => {
    if (!cellar) {
      toast.error("No cellar found");
      return;
    }

    if (!wineName.trim()) {
      toast.error("Wine name is required");
      return;
    }

    setScanState("adding");

    try {
      await addToInventory.mutateAsync({
        cellar_id: cellar.id,
        custom_name: wineName,
        custom_producer: producer || null,
        custom_vintage: vintage ? parseInt(vintage) : null,
        custom_wine_type: wineType ? (wineType as "red" | "white" | "rose" | "sparkling" | "dessert" | "fortified") : null,
        custom_region: region || null,
        vintage: vintage ? parseInt(vintage) : null,
        quantity,
        purchase_price_cents: purchasePrice ? Math.round(parseFloat(purchasePrice) * 100) : null,
        purchase_date: new Date().toISOString().split("T")[0],
        status: "in_cellar",
      });

      toast.success(`Added ${wineName} to your cellar!`);
      router.push("/cellar");
    } catch (error) {
      console.error("Add error:", error);
      toast.error("Failed to add wine to cellar");
      setScanState("review");
    }
  };

  const getConfidenceBadge = (confidence: number) => {
    if (confidence >= 80) {
      return <Badge variant="default" className="bg-green-600">High Confidence</Badge>;
    } else if (confidence >= 50) {
      return <Badge variant="secondary" className="bg-yellow-500 text-black">Medium Confidence</Badge>;
    }
    return <Badge variant="destructive">Low Confidence</Badge>;
  };

  const resetScan = () => {
    setScanState("idle");
    setScanResult(null);
    setWineName("");
    setProducer("");
    setVintage("");
    setWineType("");
    setRegion("");
    setCountry("");
    setQuantity(1);
    setPurchasePrice("");
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-playfair text-3xl font-bold">Scan Wine Label</h1>
          <p className="text-muted-foreground">
            Take a photo of a wine label to auto-fill wine details
          </p>
        </div>
        <Link href="/scan">
          <Button variant="outline">Back to Scan</Button>
        </Link>
      </div>

      {/* Upload Section */}
      {(scanState === "idle" || scanState === "uploading" || scanState === "processing") && (
        <Card>
          <CardHeader>
            <CardTitle>Upload Label Image</CardTitle>
            <CardDescription>
              Take a photo or upload an image of a wine bottle label. We&apos;ll extract the wine
              name, producer, vintage, and other details automatically.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div
              className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors ${
                scanState === "processing"
                  ? "border-primary bg-primary/5"
                  : "border-muted-foreground/25 hover:border-primary/50"
              }`}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
            >
              {scanState === "processing" ? (
                <div className="space-y-4">
                  <div className="text-6xl animate-pulse">🔍</div>
                  <p className="text-lg font-medium">Analyzing label...</p>
                  <p className="text-sm text-muted-foreground">
                    Our AI is reading the wine label and extracting details
                  </p>
                </div>
              ) : previewUrl ? (
                <div className="space-y-4">
                  <img
                    src={previewUrl}
                    alt="Label preview"
                    className="max-h-64 mx-auto rounded-lg shadow-md"
                  />
                  <p className="text-sm text-muted-foreground">Uploading...</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="text-6xl">🏷️</div>
                  <div>
                    <p className="text-lg font-medium">Drop wine label image here</p>
                    <p className="text-sm text-muted-foreground">
                      or click to select a file
                    </p>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleFileSelect(file);
                    }}
                  />
                  <div className="flex flex-col sm:flex-row gap-2 justify-center">
                    <Button
                      onClick={() => {
                        if (fileInputRef.current) {
                          fileInputRef.current.removeAttribute("capture");
                          fileInputRef.current.click();
                        }
                      }}
                    >
                      Upload from Library
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        if (fileInputRef.current) {
                          fileInputRef.current.capture = "environment";
                          fileInputRef.current.click();
                        }
                      }}
                    >
                      Take Photo Now
                    </Button>
                  </div>
                </div>
              )}
            </div>

            <div className="mt-6 text-sm text-muted-foreground">
              <p className="font-medium mb-2">Tips for best results:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Hold the bottle straight and capture the main label</li>
                <li>Ensure good lighting - avoid shadows and glare</li>
                <li>Get close enough to read the text clearly</li>
                <li>Include the vintage year if visible</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Review Section */}
      {(scanState === "review" || scanState === "adding") && scanResult?.wine && (
        <div className="space-y-6">
          {/* Scan Summary */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <CardTitle>Wine Details</CardTitle>
                  <CardDescription>
                    Review and edit the extracted information before adding to your cellar
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  {getConfidenceBadge(scanResult.wine.confidence)}
                  <Button variant="outline" onClick={resetScan}>
                    Scan Another
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Preview Image */}
              {previewUrl && (
                <div className="flex justify-center">
                  <img
                    src={previewUrl}
                    alt="Scanned label"
                    className="max-h-48 rounded-lg shadow-md"
                  />
                </div>
              )}

              {/* Editable Fields */}
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="wineName">Wine Name *</Label>
                  <Input
                    id="wineName"
                    value={wineName}
                    onChange={(e) => setWineName(e.target.value)}
                    placeholder="e.g., Cabernet Sauvignon"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="producer">Producer</Label>
                  <Input
                    id="producer"
                    value={producer}
                    onChange={(e) => setProducer(e.target.value)}
                    placeholder="e.g., Harvester"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="vintage">Vintage</Label>
                  <Input
                    id="vintage"
                    type="number"
                    value={vintage}
                    onChange={(e) => setVintage(e.target.value)}
                    placeholder="e.g., 2023"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="wineType">Wine Type</Label>
                  <Select value={wineType} onValueChange={(v) => setWineType(v as WineType | "")}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="red">Red</SelectItem>
                      <SelectItem value="white">White</SelectItem>
                      <SelectItem value="rose">Rosé</SelectItem>
                      <SelectItem value="sparkling">Sparkling</SelectItem>
                      <SelectItem value="dessert">Dessert</SelectItem>
                      <SelectItem value="fortified">Fortified</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="region">Region</Label>
                  <Input
                    id="region"
                    value={region}
                    onChange={(e) => setRegion(e.target.value)}
                    placeholder="e.g., Paso Robles"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="country">Country</Label>
                  <Input
                    id="country"
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    placeholder="e.g., USA"
                  />
                </div>
              </div>

              {/* Additional extracted info */}
              {(scanResult.wine.sub_region || scanResult.wine.appellation || scanResult.wine.grape_varieties || scanResult.wine.alcohol_percentage) && (
                <div className="border-t pt-4">
                  <p className="text-sm font-medium mb-2">Additional Details Detected:</p>
                  <div className="flex flex-wrap gap-2">
                    {scanResult.wine.sub_region && (
                      <Badge variant="outline">{scanResult.wine.sub_region}</Badge>
                    )}
                    {scanResult.wine.appellation && (
                      <Badge variant="outline">{scanResult.wine.appellation}</Badge>
                    )}
                    {scanResult.wine.grape_varieties?.map((grape) => (
                      <Badge key={grape} variant="secondary">{grape}</Badge>
                    ))}
                    {scanResult.wine.alcohol_percentage && (
                      <Badge variant="outline">{scanResult.wine.alcohol_percentage}% ABV</Badge>
                    )}
                  </div>
                </div>
              )}

              {/* Purchase info */}
              <div className="border-t pt-4">
                <p className="text-sm font-medium mb-3">Add to Cellar</p>
                <div className="grid gap-4 md:grid-cols-2">
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
                        className="text-center w-20"
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
              </div>
            </CardContent>
            <CardFooter className="flex gap-2 justify-end">
              <Button variant="outline" onClick={resetScan}>
                Cancel
              </Button>
              <Button
                onClick={handleAddToCellar}
                disabled={scanState === "adding" || !wineName.trim()}
              >
                {scanState === "adding" ? (
                  <>
                    <span className="animate-spin mr-2">...</span>
                    Adding...
                  </>
                ) : (
                  "Add to Cellar"
                )}
              </Button>
            </CardFooter>
          </Card>

          {/* Raw Text (collapsible for debugging) */}
          {scanResult.raw_text && (
            <details className="text-sm">
              <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                Show raw extracted text
              </summary>
              <Card className="mt-2">
                <CardContent className="pt-4">
                  <pre className="whitespace-pre-wrap font-mono text-xs bg-muted p-4 rounded-lg overflow-auto max-h-64">
                    {scanResult.raw_text}
                  </pre>
                </CardContent>
              </Card>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
