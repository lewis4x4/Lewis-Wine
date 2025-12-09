"use client";

import { useRef, useState } from "react";
import { Camera, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import Image from "next/image";
import { useRouter } from "next/navigation";

export default function LabelScanPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Fallback camera handling for browsers that support it
  // In a real mobile PWA, <input type="file" capture="environment"> works best

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSelectedImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAnalyze = async () => {
    if (!selectedImage) return;

    setIsAnalyzing(true);
    try {
      // Create a form data object to send the file
      // Convert base64 to blob? Or just send as JSON
      const response = await fetch("/api/ai/scan-label", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: selectedImage }),
      });

      if (!response.ok) throw new Error("Analysis failed");

      const data = await response.json();

      // Navigate to Add Wine page with pre-filled data
      const queryParams = new URLSearchParams({
        name: data.name,
        producer: data.producer,
        vintage: data.vintage,
        region: data.region,
        varietal: data.varietal,
        description: data.description, // Pass the back-label story
      }).toString();

      router.push(`/cellar/add?${queryParams}`);
      toast.success("Label analyzed successfully!");
    } catch (error) {
      console.error(error);
      toast.error("Could not analyze label. Please try again or add manually.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="max-w-md mx-auto space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-playfair font-bold">Label Scanner</h1>
        <p className="text-muted-foreground">
          Take a photo of a wine bottle to automatically extract details.
        </p>
      </div>

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
              onClick={() => setSelectedImage(null)}
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
