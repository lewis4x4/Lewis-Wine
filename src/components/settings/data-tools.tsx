"use client";

import { useState } from "react";
import { parse } from "csv-parse/browser/esm";
import { Download, Upload, AlertCircle, CheckCircle, FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "sonner";
import { useCellar, useAddToInventory } from "@/lib/hooks/use-cellar";

// Define the shape of our CSV import
type CSVRow = {
    Name: string;
    Producer?: string;
    Vintage?: string;
    Region?: string;
    Quantity?: string;
    Price?: string;
    Location?: string;
    Notes?: string;
};

export function DataTools() {
    const { data: cellar } = useCellar();
    const addToInventory = useAddToInventory();

    const [isImporting, setIsImporting] = useState(false);
    const [importStats, setImportStats] = useState<{ total: number; success: number; failed: number } | null>(null);

    const handleExport = () => {
        // TODO: Implement actual export by fetching all inventory
        // For now we toast
        toast.info("Export feature coming soon! (Fetching all data...)");
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsImporting(true);
        setImportStats(null);

        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const csvData = event.target?.result as string;

                parse(csvData, {
                    columns: true,
                    skip_empty_lines: true,
                    trim: true,
                }, async (err, records: CSVRow[]) => {
                    if (err) {
                        toast.error("Failed to parse CSV file");
                        setIsImporting(false);
                        return;
                    }

                    if (!cellar) {
                        toast.error("Cellar not found. Please refresh.");
                        setIsImporting(false);
                        return;
                    }

                    let successCount = 0;
                    let failedCount = 0;

                    // Process records sequentially to avoid overwhelming the server
                    for (const row of records) {
                        try {
                            if (!row.Name) throw new Error("Missing Name");

                            await addToInventory.mutateAsync({
                                cellar_id: cellar.id,
                                wine_reference_id: null, // Manual add
                                custom_name: row.Name,
                                custom_producer: row.Producer || null,
                                custom_vintage: row.Vintage ? parseInt(row.Vintage) : null,
                                custom_region: row.Region || null,
                                quantity: row.Quantity ? parseInt(row.Quantity) : 1,
                                purchase_price_cents: row.Price ? Math.round(parseFloat(row.Price.replace('$', '')) * 100) : null,
                                simple_location: row.Location || null,
                                notes: row.Notes || null,
                            });
                            successCount++;
                        } catch (error) {
                            console.error("Failed to import row:", row, error);
                            failedCount++;
                        }
                    }

                    setImportStats({
                        total: records.length,
                        success: successCount,
                        failed: failedCount
                    });

                    if (successCount > 0) {
                        toast.success(`Successfully imported ${successCount} wines!`);
                    }
                    setIsImporting(false);
                });
            } catch (error) {
                console.error("Import error:", error);
                toast.error("An error occurred during import");
                setIsImporting(false);
            }
        };
        reader.readAsText(file);
    };

    return (
        <div className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
                {/* Export Section */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Download className="h-5 w-5" />
                            Export Data
                        </CardTitle>
                        <CardDescription>
                            Download your entire cellar inventory as a CSV file.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Button variant="outline" onClick={handleExport} className="w-full">
                            <FileSpreadsheet className="mr-2 h-4 w-4" />
                            Download CSV
                        </Button>
                    </CardContent>
                </Card>

                {/* Import Section */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Upload className="h-5 w-5" />
                            Import Data
                        </CardTitle>
                        <CardDescription>
                            Upload a CSV file to bulk add wines.
                            <br />
                            <span className="text-xs text-muted-foreground">
                                Required columns: Name. Optional: Producer, Vintage, Quantity, Price.
                            </span>
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid w-full max-w-sm items-center gap-1.5">
                            <Input
                                id="csv-upload"
                                type="file"
                                accept=".csv"
                                onChange={handleFileUpload}
                                disabled={isImporting}
                            />
                        </div>

                        {isImporting && (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full" />
                                Processing file...
                            </div>
                        )}

                        {importStats && (
                            <Alert variant={importStats.failed > 0 ? "destructive" : "default"} className="bg-muted/50">
                                {importStats.failed > 0 ? <AlertCircle className="h-4 w-4" /> : <CheckCircle className="h-4 w-4" />}
                                <AlertTitle>Import Complete</AlertTitle>
                                <AlertDescription>
                                    Processed: {importStats.total}. Success: {importStats.success}. Failed: {importStats.failed}.
                                </AlertDescription>
                            </Alert>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
