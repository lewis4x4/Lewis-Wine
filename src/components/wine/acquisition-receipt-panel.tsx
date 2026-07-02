"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ReceiptText, RefreshCw, ScanLine, Trophy } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { buildAcquisitionReceipt, parseReceiptText, type AcquisitionReceiptItem } from "@/lib/acquisition-receipt";

const sampleReceipt = `Benchmark Wine Shop
2026-06-24
2 x 2021 Tapiz Alta Collection Cabernet Sauvignon Mendoza @ $92.00
1 x 2020 Lewis Cellars Reserve Cabernet Napa Valley @ $210.00
Subtotal $394.00
Tax $27.58
Total $421.58`;
const sampleVendor = "Benchmark Wine Shop";
const sampleNotes = "Bought after Shopping Mode recommendation; house restock for steak dinners.";

function formatCents(cents: number | null | undefined) {
  if (cents == null) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(cents / 100);
}

function ReceiptItemCard({ item }: { item: AcquisitionReceiptItem }) {
  return (
    <div className="rounded-3xl border bg-background p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h4 className="font-medium leading-6">{item.wineTitle}</h4>
          <p className="mt-1 text-sm text-muted-foreground">{[item.region, item.varietal].filter(Boolean).join(" · ") || item.rawText}</p>
        </div>
        <Badge variant={item.action === "close_acquisition_and_add_to_cellar" ? "default" : "secondary"} className="rounded-full">{item.action === "close_acquisition_and_add_to_cellar" ? "Close target" : "Cellar intake"}</Badge>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        <div className="rounded-2xl bg-muted/40 p-3"><div className="text-xs uppercase text-muted-foreground">Qty</div><div className="text-lg font-semibold">{item.quantity}</div></div>
        <div className="rounded-2xl bg-muted/40 p-3"><div className="text-xs uppercase text-muted-foreground">Unit</div><div className="text-lg font-semibold">{formatCents(item.unitPriceCents)}</div></div>
        <div className="rounded-2xl bg-muted/40 p-3"><div className="text-xs uppercase text-muted-foreground">Line</div><div className="text-lg font-semibold">{formatCents(item.lineTotalCents)}</div></div>
      </div>
    </div>
  );
}

export function AcquisitionReceiptPanel() {
  const [vendor, setVendor] = useState("");
  const [notes, setNotes] = useState("");
  const [receiptText, setReceiptText] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  // One key per form session: a retry after a failed submit replays instead
  // of duplicating bottles/price evidence. Rotated after each success.
  const idempotencyKeyRef = useRef<string>(`receipt-${crypto.randomUUID()}`);
  const parsed = useMemo(() => parseReceiptText(receiptText), [receiptText]);
  const receipt = useMemo(() => buildAcquisitionReceipt({
    vendor: vendor || parsed.vendor,
    vendorType: parsed.vendorType,
    purchaseDate: parsed.purchaseDate,
    subtotalCents: parsed.subtotalCents,
    taxCents: parsed.taxCents,
    totalCents: parsed.totalCents,
    receiptText,
    notes,
    items: parsed.items.map((item) => ({ ...item, selected: true })),
  }), [vendor, parsed, receiptText, notes]);

  async function saveReceipt() {
    setIsSaving(true);
    setNotice(null);
    try {
      const response = await fetch("/api/acquisition-receipts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vendor: receipt.vendor,
          vendorType: receipt.vendorType,
          purchaseDate: receipt.purchaseDate,
          subtotalCents: receipt.subtotalCents,
          taxCents: receipt.taxCents,
          totalCents: receipt.totalCents,
          receiptText,
          notes,
          items: receipt.items,
          idempotencyKey: idempotencyKeyRef.current,
        }),
      });
      const payload = await response.json();
      if (response.status === 401) {
        setNotice("Sign in to save this receipt into cellar history and Acquisition Engine.");
        return;
      }
      if (!response.ok || !payload.success) throw new Error(payload.error ?? "Failed to capture receipt");
      idempotencyKeyRef.current = `receipt-${crypto.randomUUID()}`;
      toast.success(payload.replayed ? "Receipt was already captured." : "Acquisition receipt captured.");
      setNotice(payload.purchaseStory ?? "Receipt saved.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not capture receipt");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Card id="acquisition-receipt" className="rounded-[28px] border-primary/30 bg-gradient-to-br from-primary/10 via-background to-background shadow-sm">
      <CardHeader>
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 font-playfair text-3xl"><ReceiptText className="h-7 w-7 text-primary" /> Acquisition Receipt Capture</CardTitle>
            <CardDescription>Close the loop after a purchase: receipt → acquired target → cellar intake → verified purchase price.</CardDescription>
          </div>
          <div className="flex flex-wrap gap-2"><Badge variant="secondary">{receipt.summary.totalBottles} bottles</Badge><Badge variant="outline">{formatCents(receipt.summary.totalWineSpendCents)}</Badge><Badge variant="outline">{receipt.summary.cellarIntakeCount} cellar intakes</Badge></div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-4 lg:grid-cols-[1fr_1fr_auto]">
          <div className="space-y-2"><Label>Vendor</Label><Input value={vendor} onChange={(event) => setVendor(event.target.value)} /></div>
          <div className="space-y-2"><Label>Notes / why bought</Label><Input value={notes} onChange={(event) => setNotes(event.target.value)} /></div>
          <div className="flex items-end"><Button onClick={saveReceipt} disabled={isSaving || !receipt.items.length}><RefreshCw className="mr-2 h-4 w-4" /> {isSaving ? "Saving" : "Save receipt"}</Button></div>
        </div>
        <Textarea rows={7} value={receiptText} onChange={(event) => setReceiptText(event.target.value)} placeholder="Paste receipt text here — vendor, date, and one line per wine (e.g. 2 x 2021 Producer Label Region @ $92.00)." />
        {!receiptText.trim() ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-muted-foreground"
            onClick={() => {
              setVendor(sampleVendor);
              setNotes(sampleNotes);
              setReceiptText(sampleReceipt);
            }}
          >
            Load sample receipt
          </Button>
        ) : null}
        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-3xl border bg-background/70 p-4"><div className="text-xs font-semibold uppercase tracking-wide text-primary">Purchase story</div><p className="mt-2 text-sm text-muted-foreground">{receipt.purchaseStory}</p>{notice ? <p className="mt-2 text-sm text-primary">{notice}</p> : null}</div>
          <div className="rounded-3xl border bg-background/70 p-4"><div className="text-xs font-semibold uppercase tracking-wide text-primary">Closeout</div><p className="mt-2 text-sm text-muted-foreground">Linked Acquisition targets become acquired; unlinked bottles enter cellar with verified purchase-price evidence.</p></div>
          <div className="rounded-3xl border bg-background/70 p-4"><div className="text-xs font-semibold uppercase tracking-wide text-primary">Photo/OCR</div><p className="mt-2 text-sm text-muted-foreground">Existing receipt scanner remains available; this panel is the acquisition closeout path.</p><Button variant="outline" size="sm" className="mt-3" asChild><Link href="/scan/receipt"><ScanLine className="mr-2 h-4 w-4" /> Scan receipt</Link></Button></div>
        </div>
        <div className="grid gap-4 xl:grid-cols-2">{receipt.items.length ? receipt.items.map((item) => <ReceiptItemCard key={item.id} item={item} />) : <div className="rounded-3xl border border-dashed bg-background/70 p-8 text-center text-muted-foreground">Paste receipt text to parse purchase lines.</div>}</div>
        <Button variant="secondary" size="sm" asChild><Link href="/intelligence#acquisition-engine"><Trophy className="mr-2 h-4 w-4" /> Open Acquisition Engine</Link></Button>
      </CardContent>
    </Card>
  );
}
