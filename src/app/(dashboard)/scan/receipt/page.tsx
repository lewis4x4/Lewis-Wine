"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useCellar, useAddToInventory } from "@/lib/hooks/use-cellar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import type { ReceiptScanResult, ExtractedWine, ReceiptImportItem, WineType } from "@/types/database";

type ScanState = "idle" | "uploading" | "processing" | "review" | "importing";

export default function ScanReceiptPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { data: cellar } = useCellar();
  const addToInventory = useAddToInventory();

  const [scanState, setScanState] = useState<ScanState>("idle");
  const [scanResult, setScanResult] = useState<ReceiptScanResult | null>(null);
  const [importItems, setImportItems] = useState<ReceiptImportItem[]>([]);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

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
      formData.append("receipt", file);

      const response = await fetch("/api/receipt/scan", {
        method: "POST",
        body: formData,
      });

      const result: ReceiptScanResult = await response.json();

      if (!result.success) {
        throw new Error((result as ReceiptScanResult & { error?: string }).error || "Failed to scan receipt");
      }

      setScanResult(result);

      // Convert to import items
      const items: ReceiptImportItem[] = result.wines.map((wine) => ({
        ...wine,
        selected: true,
        matched_wine_reference_id: null,
        matched_wine_reference: null,
      }));

      setImportItems(items);
      setScanState("review");
      toast.success(`Found ${result.wines.length} wine(s) on receipt`);
    } catch (error) {
      console.error("Scan error:", error);
      toast.error(error instanceof Error ? error.message : "Failed to scan receipt");
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

  const toggleItem = (id: string) => {
    setImportItems((items) =>
      items.map((item) =>
        item.id === id ? { ...item, selected: !item.selected } : item
      )
    );
  };

  const updateItem = (id: string, updates: Partial<ExtractedWine>) => {
    setImportItems((items) =>
      items.map((item) => (item.id === id ? { ...item, ...updates } : item))
    );
  };

  const handleImport = async () => {
    if (!cellar) {
      toast.error("No cellar found");
      return;
    }

    const selectedItems = importItems.filter((item) => item.selected);
    if (selectedItems.length === 0) {
      toast.error("No wines selected for import");
      return;
    }

    setScanState("importing");

    try {
      for (const item of selectedItems) {
        await addToInventory.mutateAsync({
          cellar_id: cellar.id,
          custom_name: item.name,
          custom_producer: item.producer,
          custom_vintage: item.vintage,
          vintage: item.vintage,
          quantity: item.quantity,
          purchase_price_cents: item.unit_price_cents,
          purchase_date: scanResult?.purchase_date || new Date().toISOString().split("T")[0],
          purchase_location: scanResult?.vendor || undefined,
          status: "in_cellar",
        });
      }

      toast.success(`Successfully imported ${selectedItems.length} wine(s) to your cellar`);
      router.push("/cellar");
    } catch (error) {
      console.error("Import error:", error);
      toast.error("Failed to import wines");
      setScanState("review");
    }
  };

  const formatCurrency = (cents: number | null) => {
    if (cents === null) return "—";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(cents / 100);
  };

  const getConfidenceBadge = (confidence: number) => {
    if (confidence >= 80) {
      return <Badge variant="default" className="bg-green-600">High</Badge>;
    } else if (confidence >= 50) {
      return <Badge variant="secondary" className="bg-yellow-500 text-black">Medium</Badge>;
    }
    return <Badge variant="destructive">Low</Badge>;
  };

  const resetScan = () => {
    setScanState("idle");
    setScanResult(null);
    setImportItems([]);
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
          <h1 className="font-playfair text-3xl font-bold">Scan Receipt</h1>
          <p className="text-muted-foreground">
            Upload a receipt to automatically extract wine purchases
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
            <CardTitle>Upload Receipt Image</CardTitle>
            <CardDescription>
              Take a photo or upload an image of your wine receipt. We&apos;ll extract the wine
              names, prices, and quantities automatically.
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
                  <p className="text-lg font-medium">Analyzing receipt...</p>
                  <p className="text-sm text-muted-foreground">
                    Our AI is extracting wine information from your receipt
                  </p>
                </div>
              ) : previewUrl ? (
                <div className="space-y-4">
                  <img
                    src={previewUrl}
                    alt="Receipt preview"
                    className="max-h-64 mx-auto rounded-lg shadow-md"
                  />
                  <p className="text-sm text-muted-foreground">Uploading...</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="text-6xl">🧾</div>
                  <div>
                    <p className="text-lg font-medium">Drop receipt image here</p>
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
                  <div className="flex gap-2 justify-center">
                    <Button
                      variant="outline"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      Select File
                    </Button>
                    <Button
                      onClick={() => {
                        if (fileInputRef.current) {
                          fileInputRef.current.capture = "environment";
                          fileInputRef.current.click();
                        }
                      }}
                    >
                      Take Photo
                    </Button>
                  </div>
                </div>
              )}
            </div>

            <div className="mt-6 text-sm text-muted-foreground">
              <p className="font-medium mb-2">Tips for best results:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Ensure the receipt is well-lit and in focus</li>
                <li>Include the entire receipt in the photo</li>
                <li>Avoid shadows and glare</li>
                <li>Works best with printed receipts (handwritten may have lower accuracy)</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Review Section */}
      {(scanState === "review" || scanState === "importing") && scanResult && (
        <div className="space-y-6">
          {/* Receipt Summary */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Receipt Summary</CardTitle>
                  <CardDescription>
                    Review and edit the extracted information before importing
                  </CardDescription>
                </div>
                <Button variant="outline" onClick={resetScan}>
                  Scan Another
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-4">
                <div>
                  <Label className="text-muted-foreground">Vendor</Label>
                  <p className="font-medium">{scanResult.vendor || "Unknown"}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Date</Label>
                  <p className="font-medium">
                    {scanResult.purchase_date || "Not detected"}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Total</Label>
                  <p className="font-medium">
                    {formatCurrency(scanResult.total_cents)}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Wines Found</Label>
                  <p className="font-medium">{scanResult.wines.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Preview Image */}
          {previewUrl && (
            <Card>
              <CardHeader>
                <CardTitle>Receipt Image</CardTitle>
              </CardHeader>
              <CardContent>
                <img
                  src={previewUrl}
                  alt="Scanned receipt"
                  className="max-h-96 mx-auto rounded-lg shadow-md"
                />
              </CardContent>
            </Card>
          )}

          {/* Wine Items */}
          <Card>
            <CardHeader>
              <CardTitle>Extracted Wines</CardTitle>
              <CardDescription>
                Select which wines to add to your cellar and verify the details
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {importItems.map((item) => (
                  <div
                    key={item.id}
                    className={`border rounded-lg p-4 transition-colors ${
                      item.selected ? "border-primary bg-primary/5" : "border-muted"
                    }`}
                  >
                    <div className="flex items-start gap-4">
                      <Checkbox
                        checked={item.selected}
                        onCheckedChange={() => toggleItem(item.id)}
                        className="mt-1"
                      />
                      <div className="flex-1 space-y-4">
                        <div className="flex items-start justify-between">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{item.name}</span>
                              {getConfidenceBadge(item.confidence)}
                            </div>
                            {item.producer && (
                              <p className="text-sm text-muted-foreground">
                                {item.producer}
                              </p>
                            )}
                            <p className="text-xs text-muted-foreground font-mono">
                              Raw: {item.raw_text}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-bold">
                              {formatCurrency(item.price_cents)}
                            </p>
                            {item.quantity > 1 && (
                              <p className="text-sm text-muted-foreground">
                                {formatCurrency(item.unit_price_cents)} each
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Editable Fields */}
                        <div className="grid gap-4 md:grid-cols-4">
                          <div>
                            <Label className="text-xs">Wine Name</Label>
                            <Input
                              value={item.name}
                              onChange={(e) =>
                                updateItem(item.id, { name: e.target.value })
                              }
                              className="mt-1"
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Producer</Label>
                            <Input
                              value={item.producer || ""}
                              onChange={(e) =>
                                updateItem(item.id, {
                                  producer: e.target.value || null,
                                })
                              }
                              className="mt-1"
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Vintage</Label>
                            <Input
                              type="number"
                              value={item.vintage || ""}
                              onChange={(e) =>
                                updateItem(item.id, {
                                  vintage: e.target.value
                                    ? parseInt(e.target.value)
                                    : null,
                                })
                              }
                              className="mt-1"
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Wine Type</Label>
                            <Select
                              value={item.wine_type || ""}
                              onValueChange={(value) =>
                                updateItem(item.id, {
                                  wine_type: (value || null) as WineType | null,
                                })
                              }
                            >
                              <SelectTrigger className="mt-1">
                                <SelectValue placeholder="Select type" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="red">Red</SelectItem>
                                <SelectItem value="white">White</SelectItem>
                                <SelectItem value="rose">Rose</SelectItem>
                                <SelectItem value="sparkling">Sparkling</SelectItem>
                                <SelectItem value="dessert">Dessert</SelectItem>
                                <SelectItem value="fortified">Fortified</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        <div className="grid gap-4 md:grid-cols-4">
                          <div>
                            <Label className="text-xs">Quantity</Label>
                            <Input
                              type="number"
                              min="1"
                              value={item.quantity}
                              onChange={(e) =>
                                updateItem(item.id, {
                                  quantity: parseInt(e.target.value) || 1,
                                })
                              }
                              className="mt-1"
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Price per Bottle ($)</Label>
                            <Input
                              type="number"
                              step="0.01"
                              value={
                                item.unit_price_cents
                                  ? (item.unit_price_cents / 100).toFixed(2)
                                  : ""
                              }
                              onChange={(e) =>
                                updateItem(item.id, {
                                  unit_price_cents: e.target.value
                                    ? Math.round(parseFloat(e.target.value) * 100)
                                    : null,
                                })
                              }
                              className="mt-1"
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Region</Label>
                            <Input
                              value={item.region || ""}
                              onChange={(e) =>
                                updateItem(item.id, {
                                  region: e.target.value || null,
                                })
                              }
                              className="mt-1"
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Country</Label>
                            <Input
                              value={item.country || ""}
                              onChange={(e) =>
                                updateItem(item.id, {
                                  country: e.target.value || null,
                                })
                              }
                              className="mt-1"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Import Actions */}
              <div className="mt-6 flex items-center justify-between border-t pt-6">
                <div className="text-sm text-muted-foreground">
                  {importItems.filter((i) => i.selected).length} of{" "}
                  {importItems.length} wines selected
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={resetScan}>
                    Cancel
                  </Button>
                  <Button
                    onClick={handleImport}
                    disabled={
                      scanState === "importing" ||
                      importItems.filter((i) => i.selected).length === 0
                    }
                  >
                    {scanState === "importing" ? (
                      <>
                        <span className="animate-spin mr-2">⏳</span>
                        Importing...
                      </>
                    ) : (
                      <>
                        Import to Cellar
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Raw Text (collapsible for debugging) */}
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
        </div>
      )}
    </div>
  );
}
