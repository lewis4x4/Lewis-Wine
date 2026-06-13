"use client";

import { useRef, useState } from "react";
import { Camera, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import Image from "next/image";
import { useRouter } from "next/navigation";

export default function LabelScanPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Fallback camera handling for browsers that support it
  // In a real mobile PWA, <input type="file" capture="environment"> works best

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setSelectedImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAnalyze = async () => {
    if (!selectedFile) return;

    setIsAnalyzing(true);
    try {
      const formData = new FormData();
      formData.append("label", selectedFile);

      const response = await fetch("/api/label/scan", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();
      if (!response.ok || !data.success || !data.wine) {
        throw new Error(data.error || "Analysis failed");
      }

      const queryParams = new URLSearchParams({
        name: data.wine.name || "",
        producer: data.wine.producer || "",
        vintage: data.wine.vintage ? String(data.wine.vintage) : "",
        region: data.wine.region || "",
        country: data.wine.country || "",
        wine_type: data.wine.wine_type || "",
        appellation: data.wine.appellation || "",
        sub_region: data.wine.sub_region || "",
        grape_varieties: data.wine.grape_varieties?.join(", ") || "",
        alcohol_percentage: data.wine.alcohol_percentage ? String(data.wine.alcohol_percentage) : "",
        notes: data.raw_text || "",
        capture_source: "label_scan",
        capture_confidence: data.wine.confidence ? String(data.wine.confidence) : "",
        capture_descriptors: data.wine.detected_descriptors?.join(", ") || "",
        capture_tasting_note: data.wine.suggested_tasting_note || "",
        capture_brian_fit_hint: data.wine.brian_fit_hint || "",
      }).toString();

      router.push(`/cellar/add?${queryParams}`);
      toast.success("Label analyzed successfully!");
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "Could not analyze label. Please try again or add manually.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="max-w-md mx-auto space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-playfair font-bold">Label scan</h1>
        <p className="text-muted-foreground">
          Turn a bottle photo into structured wine detail.
        </p>
      </div>

      <Card className="border-primary/25 bg-gradient-to-br from-primary/10 via-background to-background">
        <CardHeader>
          <CardTitle className="font-playfair text-2xl">Label intake view</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <div className="rounded-xl border bg-background/80 p-4 text-left">
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">What matters now</div>
            <p className="mt-2 text-sm text-foreground">A clean label photo is often the fastest way to recover identity when barcode data is weak or missing.</p>
          </div>
          <div className="rounded-xl border bg-background/80 p-4 text-left">
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Best next move</div>
            <p className="mt-2 text-sm text-foreground">Fill the frame with the label, reduce glare, and let the system pre-build the add flow for you.</p>
          </div>
          <div className="rounded-xl border bg-background/80 p-4 text-left">
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Risk if ignored</div>
            <p className="mt-2 text-sm text-foreground">Poor capture quality turns a premium intake shortcut into manual cleanup work.</p>
          </div>
        </CardContent>
      </Card>

      <Card className="border-2 border-dashed relative overflow-hidden min-h-[400px] flex flex-col justify-center items-center bg-muted/20">
        {selectedImage ? (
          <div className="relative w-full h-full min-h-[400px]">
            <Image
              src={selectedImage}
              alt="Selected label"
              fill
              className="object-contain"
            />
            <Button
              variant="secondary"
              size="icon"
              className="absolute top-2 right-2 rounded-full"
              onClick={() => {
                setSelectedImage(null);
                setSelectedFile(null);
              }}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <div className="text-center space-y-4 p-8">
            <div className="h-20 w-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
              <Camera className="h-10 w-10 text-primary" />
            </div>
            <div>
              <Button onClick={() => fileInputRef.current?.click()} size="lg" className="w-full">
                <Camera className="mr-2 h-4 w-4" />
                Take Photo
              </Button>
              <p className="mt-2 text-sm text-muted-foreground">
                or <span className="underline cursor-pointer" onClick={() => fileInputRef.current?.click()}>upload from gallery</span>
              </p>
            </div>
          </div>
        )}
        <Input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handleFileSelect}
        />
      </Card>

      <div className="grid gap-2">
        <Button
          onClick={handleAnalyze}
          disabled={!selectedImage || isAnalyzing}
          size="lg"
          className="w-full"
        >
          {isAnalyzing ? "Analyzing..." : "Analyze Label"}
        </Button>
        <Button variant="outline" onClick={() => router.back()} className="w-full">
          Cancel
        </Button>
      </div>

      <p className="text-center text-xs text-muted-foreground">
        Powered by AI Vision. Results may vary depending on lighting and label clarity.
      </p>
    </div>
  );
}
