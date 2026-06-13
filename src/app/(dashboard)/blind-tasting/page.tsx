"use client";

import { useState } from "react";
import { useCellarInventory } from "@/lib/hooks/use-cellar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { EyeOff, MapPin, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import Confetti from "react-confetti";

type GameStage = "setup" | "retrieve" | "tasting" | "reveal";

export default function BlindTastingPage() {
    const { data: inventory } = useCellarInventory();

    const [stage, setStage] = useState<GameStage>("setup");
    const [criteria, setCriteria] = useState({
        type: "red",
        minPrice: 0,
        maxPrice: 100,
    });

    // The selected "Mystery Wine"
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [mysteryWine, setMysteryWine] = useState<any>(null);

    // User's guesses
    const [guess, setGuess] = useState({
        varietal: "",
        region: "",
        vintage: "",
        price: "",
    });

    // Score
    const [score, setScore] = useState<{ total: number; breakdown: string[] } | null>(null);

    const startGame = () => {
        if (!inventory) return;

        // Filter inventory based on criteria
        const candidates = inventory.filter(wine => {
            const type = wine.wine_reference?.wine_type || wine.custom_wine_type;
            const price = (wine.current_market_value_cents || wine.purchase_price_cents || 0) / 100;

            const typeMatch = criteria.type === "any" || type === criteria.type;
            const priceMatch = price >= criteria.minPrice && price <= criteria.maxPrice;
            const hasLocation = wine.location_id || wine.simple_location; // Only pick wines we can find!

            return typeMatch && priceMatch && hasLocation && wine.status === 'in_cellar';
        });

        if (candidates.length === 0) {
            toast.error("No wines found matching your criteria! Try expanding your search.");
            return;
        }

        // Pick a random winner
        const winner = candidates[Math.floor(Math.random() * candidates.length)];
        setMysteryWine(winner);
        setStage("retrieve");
    };

    const submitGuess = () => {
        if (!mysteryWine) return;

        // Calculate Score
        let points = 0;
        const breakdown = [];

        // Check Vintage (Exact: 20pts, +/- 1 year: 10pts)
        const actualVintage = mysteryWine.vintage || mysteryWine.custom_vintage;
        if (guess.vintage) {
            const guessV = parseInt(guess.vintage);
            if (guessV === actualVintage) {
                points += 20;
                breakdown.push("Vintage: Perfect! (+20)");
            } else if (Math.abs(guessV - actualVintage) <= 1) {
                points += 10;
                breakdown.push("Vintage: Close! (+10)");
            } else {
                breakdown.push(`Vintage: Missed. It was ${actualVintage}`);
            }
        }

        // Check Varietal (String includes check for MVP)
        // In a real app, use structured Varietal IDs
        const actualVarietal = mysteryWine.wine_reference?.varietal || "";
        if (guess.varietal && actualVarietal.toLowerCase().includes(guess.varietal.toLowerCase())) {
            points += 30;
            breakdown.push("Varietal: Spot on! (+30)");
        } else {
            breakdown.push(`Varietal: Nope. It's mostly ${actualVarietal || 'Unknown'}`);
        }

        // Region Check
        const actualRegion = mysteryWine.wine_reference?.region || mysteryWine.custom_region || "";
        if (guess.region && actualRegion.toLowerCase().includes(guess.region.toLowerCase())) {
            points += 20;
            breakdown.push("Region: Correct! (+20)");
        }

        // Price Guess (Within 20%)
        const actualPrice = (mysteryWine.current_market_value_cents || mysteryWine.purchase_price_cents || 0) / 100;
        if (guess.price) {
            const guessP = parseFloat(guess.price);
            const margin = actualPrice * 0.2;
            if (guessP >= actualPrice - margin && guessP <= actualPrice + margin) {
                points += 15;
                breakdown.push(`Price: Good eye! Actual: $${actualPrice} (+15)`);
            } else {
                breakdown.push(`Price: Off. It's valued at $${actualPrice}`);
            }
        }

        setScore({ total: points, breakdown });
        setStage("reveal");
    };

    const resetGame = () => {
        setStage("setup");
        setMysteryWine(null);
        setGuess({ varietal: "", region: "", vintage: "", price: "" });
        setScore(null);
    };

    return (
        <div className="max-w-md mx-auto space-y-8 pb-20">
            <div className="text-center space-y-2">
                <h1 className="text-4xl font-playfair font-bold flex items-center justify-center gap-3">
                    <EyeOff className="h-8 w-8" /> Blind tasting
                </h1>
                <p className="text-muted-foreground">Train your palate against your own cellar, not theory.</p>
            </div>

            <Card className="border-primary/25 bg-gradient-to-br from-primary/10 via-background to-background">
                <CardHeader>
                    <CardTitle className="font-playfair text-2xl">Palate training view</CardTitle>
                    <CardDescription>Blind tasting should feel like a premium practice loop, not a novelty game.</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-3">
                    <div className="rounded-xl border bg-background/80 p-4 text-left">
                        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">What matters now</div>
                        <p className="mt-2 text-sm text-foreground">This mode turns your actual bottles into training reps for varietal, region, vintage, and value judgment.</p>
                    </div>
                    <div className="rounded-xl border bg-background/80 p-4 text-left">
                        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Best next move</div>
                        <p className="mt-2 text-sm text-foreground">Pick realistic constraints, decant honestly, and let repeated reps sharpen your pattern recognition.</p>
                    </div>
                    <div className="rounded-xl border bg-background/80 p-4 text-left">
                        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Risk if ignored</div>
                        <p className="mt-2 text-sm text-foreground">If this feels gimmicky instead of disciplined, the feature becomes cute but not valuable.</p>
                    </div>
                </CardContent>
            </Card>

            {stage === "setup" && (
                <Card>
                    <CardHeader>
                        <CardTitle>Game Setup</CardTitle>
                        <CardDescription>What kind of wine should we hunt for?</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="space-y-2">
                            <Label>Wine Type</Label>
                            <Select
                                value={criteria.type}
                                onValueChange={(v) => setCriteria({ ...criteria, type: v })}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select type" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="red">Red</SelectItem>
                                    <SelectItem value="white">White</SelectItem>
                                    <SelectItem value="rose">Rosé</SelectItem>
                                    <SelectItem value="sparkling">Sparkling</SelectItem>
                                    <SelectItem value="any">Surprise Me (Any)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-4">
                            <div className="flex justify-between">
                                <Label>Price Range</Label>
                                <span className="text-sm text-muted-foreground">${criteria.minPrice} - ${criteria.maxPrice}</span>
                            </div>
                            <Slider
                                min={0}
                                max={500}
                                step={10}
                                value={[criteria.minPrice, criteria.maxPrice]}
                                onValueChange={([min, max]) => setCriteria({ ...criteria, minPrice: min, maxPrice: max })}
                            />
                        </div>
                    </CardContent>
                    <CardFooter>
                        <Button className="w-full" size="lg" onClick={startGame}>Find a Candidate</Button>
                    </CardFooter>
                </Card>
            )}

            {stage === "retrieve" && mysteryWine && (
                <Card className="border-2 border-primary/50 animate-in fade-in zoom-in duration-500">
                    <CardHeader className="text-center">
                        <CardTitle className="text-2xl">Bottle Selected!</CardTitle>
                        <CardDescription>Go retrieve this bottle without looking at the label.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-8 text-center">
                        <div className="p-8 bg-muted rounded-full w-32 h-32 mx-auto flex items-center justify-center">
                            <MapPin className="h-16 w-16 text-primary animate-bounce" />
                        </div>

                        <div className="space-y-2">
                            <h3 className="text-lg font-semibold">Location</h3>
                            <div className="text-3xl font-bold font-playfair">
                                {mysteryWine.simple_location || "Unknown Location"}
                            </div>
                            {/* If we had structured location, we would display Zone/Rack here instead */}
                            <p className="text-sm text-muted-foreground">
                                Warning: Don&apos;t peek at the label! Decant immediately.
                            </p>
                        </div>
                    </CardContent>
                    <CardFooter>
                        <Button className="w-full" onClick={() => setStage("tasting")}>
                            I Have Decanted It
                        </Button>
                    </CardFooter>
                </Card>
            )}

            {stage === "tasting" && (
                <Card>
                    <CardHeader>
                        <CardTitle>Tasting Sheet</CardTitle>
                        <CardDescription>Taste the wine and enter your guesses.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label>Guess the Varietal</Label>
                            <Input
                                placeholder="e.g. Cabernet, Pinot Noir..."
                                value={guess.varietal}
                                onChange={(e) => setGuess({ ...guess, varietal: e.target.value })}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Guess the Region</Label>
                            <Input
                                placeholder="e.g. Napa, Bordeaux, Tuscany..."
                                value={guess.region}
                                onChange={(e) => setGuess({ ...guess, region: e.target.value })}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Guess the Vintage</Label>
                            <Input
                                type="number"
                                placeholder="YYYY"
                                value={guess.vintage}
                                onChange={(e) => setGuess({ ...guess, vintage: e.target.value })}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Guess the Value ($)</Label>
                            <Input
                                type="number"
                                placeholder="0.00"
                                value={guess.price}
                                onChange={(e) => setGuess({ ...guess, price: e.target.value })}
                            />
                        </div>
                    </CardContent>
                    <CardFooter>
                        <Button className="w-full" size="lg" onClick={submitGuess}>
                            Reveal Identity
                        </Button>
                    </CardFooter>
                </Card>
            )}

            {stage === "reveal" && mysteryWine && score && (
                <>
                    {score.total > 50 && <Confetti numberOfPieces={200} recycle={false} />}
                    <Card className="border-2 border-primary">
                        <CardHeader className="text-center">
                            <CardTitle className="text-3xl">The Reveal</CardTitle>
                            <div className="text-6xl font-bold text-primary my-4">{score.total}<span className="text-2xl text-muted-foreground">/85</span></div>
                            <CardDescription>Points Scored</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            {/* The Reveal Section */}
                            <div className="bg-muted/30 p-6 rounded-lg text-center space-y-2">
                                <p className="text-sm uppercase tracking-widest text-muted-foreground">You were drinking...</p>
                                <h2 className="text-2xl font-playfair font-bold">
                                    {mysteryWine.vintage || mysteryWine.custom_vintage} {mysteryWine.wine_reference?.name || mysteryWine.custom_name}
                                </h2>
                                <p className="text-muted-foreground">
                                    {mysteryWine.wine_reference?.producer || mysteryWine.custom_producer}
                                </p>
                                <Badge variant="outline" className="mt-2">
                                    {mysteryWine.wine_reference?.region || mysteryWine.custom_region}
                                </Badge>
                            </div>

                            <div className="space-y-2 border-t pt-4">
                                <h3 className="font-semibold mb-2">Score Breakdown</h3>
                                {score.breakdown.map((item, i) => (
                                    <div key={i} className="flex items-center gap-2 text-sm">
                                        {item.includes("!") ? "✅" : "❌"} {item}
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                        <CardFooter className="flex gap-2">
                            <Button variant="outline" className="w-full" onClick={resetGame}>
                                <RefreshCw className="mr-2 h-4 w-4" /> Play Again
                            </Button>
                            <Button className="w-full" onClick={() => toast.info("Social Sharing coming in Phase 3!")}>
                                Share Result
                            </Button>
                        </CardFooter>
                    </Card>
                </>
            )}
        </div>
    );
}
