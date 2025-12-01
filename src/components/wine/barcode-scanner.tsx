"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface BarcodeScannerProps {
  onScan: (barcode: string) => void;
  onError?: (error: string) => void;
}

export function BarcodeScanner({ onScan, onError }: BarcodeScannerProps) {
  const [isScanning, setIsScanning] = useState(false);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const stopScanning = useCallback(async () => {
    if (scannerRef.current?.isScanning) {
      try {
        await scannerRef.current.stop();
      } catch {
        // Ignore stop errors
      }
    }
    setIsScanning(false);
  }, []);

  const startScanning = useCallback(async () => {
    if (!containerRef.current) return;

    try {
      // Initialize scanner if not already done
      if (!scannerRef.current) {
        scannerRef.current = new Html5Qrcode("barcode-reader", {
          formatsToSupport: [
            Html5QrcodeSupportedFormats.EAN_13,
            Html5QrcodeSupportedFormats.EAN_8,
            Html5QrcodeSupportedFormats.UPC_A,
            Html5QrcodeSupportedFormats.UPC_E,
            Html5QrcodeSupportedFormats.CODE_128,
            Html5QrcodeSupportedFormats.CODE_39,
          ],
          verbose: false,
        });
      }

      // Start scanning
      await scannerRef.current.start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox: { width: 250, height: 150 },
          aspectRatio: 1.0,
        },
        async (decodedText) => {
          // Successfully scanned
          await stopScanning();
          onScan(decodedText);
        },
        () => {
          // Scan error (no barcode found in frame) - ignore
        }
      );

      setIsScanning(true);
      setHasPermission(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to start scanner";

      if (message.includes("Permission") || message.includes("denied")) {
        setHasPermission(false);
        onError?.("Camera permission denied. Please allow camera access to scan barcodes.");
      } else {
        onError?.(message);
      }
    }
  }, [onScan, onError, stopScanning]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (scannerRef.current?.isScanning) {
        scannerRef.current.stop().catch(() => {});
      }
    };
  }, []);

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-0">
        <div className="relative">
          {/* Scanner container */}
          <div
            id="barcode-reader"
            ref={containerRef}
            className="w-full aspect-[4/3] bg-black"
          />

          {/* Overlay when not scanning */}
          {!isScanning && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 text-white">
              {hasPermission === false ? (
                <div className="text-center p-6">
                  <div className="text-5xl mb-4">📷</div>
                  <h3 className="text-lg font-semibold mb-2">
                    Camera Access Required
                  </h3>
                  <p className="text-sm text-gray-300 mb-4">
                    Please allow camera access to scan wine barcodes
                  </p>
                  <Button onClick={startScanning} variant="secondary">
                    Try Again
                  </Button>
                </div>
              ) : (
                <div className="text-center p-6">
                  <div className="text-5xl mb-4">📱</div>
                  <h3 className="text-lg font-semibold mb-2">
                    Ready to Scan
                  </h3>
                  <p className="text-sm text-gray-300 mb-4">
                    Point your camera at a wine barcode
                  </p>
                  <Button onClick={startScanning} size="lg">
                    Start Scanning
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Scanning indicator */}
          {isScanning && (
            <div className="absolute bottom-4 left-0 right-0 flex justify-center">
              <div className="bg-black/60 text-white px-4 py-2 rounded-full text-sm flex items-center gap-2">
                <span className="animate-pulse">●</span>
                Scanning...
              </div>
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="p-4 flex justify-center gap-2">
          {isScanning ? (
            <Button variant="outline" onClick={stopScanning}>
              Stop Scanning
            </Button>
          ) : (
            <Button onClick={startScanning}>Start Scanning</Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
