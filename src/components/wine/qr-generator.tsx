"use client";

import { useRef } from "react";
import QRCode from "react-qr-code";
import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";

export function QRCodeGenerator({
    id,
    name,
    producer
}: {
    id: string,
    name: string,
    producer: string
}) {
    const printRef = useRef<HTMLDivElement>(null);

    const handlePrint = () => {
        // In a real app, this would open a specific PDF generator or print window
        // For MVP, we simply print the component area via a new window or CSS print media
        const content = printRef.current;
        if (!content) return;

        const printWindow = window.open('', '', 'height=500,width=500');
        if (printWindow) {
            printWindow.document.write('<html><head><title>Print QR Code</title>');
            printWindow.document.write('<style>body { font-family: sans-serif; text-align: center; margin-top: 20px; }</style>');
            printWindow.document.write('</head><body>');
            printWindow.document.write(content.innerHTML);
            printWindow.document.write('</body></html>');
            printWindow.document.close();
            printWindow.focus();
            printWindow.print();
        }
    };

    const appUrl = typeof window !== 'undefined' ? window.location.origin : 'https://pourfolio.app';
    // The QR code leads directly to the bottle's CONSUME/MANAGE page
    const targetUrl = `${appUrl}/cellar/${id}`;

    return (
        <div className="flex flex-col items-center gap-4 p-4 border rounded-lg bg-card">
            <div ref={printRef} className="flex flex-col items-center p-4 bg-white text-black border w-fit">
                {/* Physical Tag Layout (Small Size for Bottle Neck) */}
                <div className="text-[10px] font-bold uppercase truncate max-w-[120px]">{producer}</div>
                <div className="text-[8px] truncate max-w-[120px] mb-2">{name}</div>
                <div className="h-24 w-24">
                    <QRCode
                        value={targetUrl}
                        size={256}
                        style={{ height: "auto", maxWidth: "100%", width: "100%" }}
                        viewBox={`0 0 256 256`}
                    />
                </div>
                <div className="text-[8px] mt-1 text-slate-500">{id.slice(0, 8)}</div>
            </div>

            <Button onClick={handlePrint} size="sm" variant="outline" className="w-full">
                <Printer className="mr-2 h-4 w-4" />
                Print Tag
            </Button>
        </div>
    );
}
