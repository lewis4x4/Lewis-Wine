import Link from "next/link";
import {
    ArrowUpRight,
    Wine,
    Scan,
    Plus,
    TrendingUp,
    TrendingDown,
    Activity,
    Calendar
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { CellarCommandCenter } from "@/components/cellar/cellar-command-center";
import { buildCellarCommandCenter } from "@/lib/cellar-command-center";
import { buildTasteGenome } from "@/lib/taste-genome";
import { isWineReadyNow } from "@/lib/wine-readiness";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export const metadata = {
    title: "Dashboard | Pourfolio",
};

export default async function DashboardPage() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        redirect("/login");
    }

    // Fetch Cellar
    const { data: cellar } = await supabase
        .from("cellars")
        .select("id")
        .eq("owner_id", user.id)
        .single<{ id: string }>();

    if (!cellar) {
        // New-user state: the signup trigger normally creates a cellar, but if
        // it didn't (pre-trigger accounts, trigger failure) create one inline
        // mirroring handle_new_user instead of linking to a page that doesn't exist.
        async function createCellar() {
            "use server";
            const actionSupabase = await createClient();
            const { data: { user: actionUser } } = await actionSupabase.auth.getUser();
            if (!actionUser) redirect("/login");
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (actionSupabase as any)
                .from("profiles")
                .upsert({ id: actionUser.id }, { onConflict: "id" });
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (actionSupabase as any)
                .from("cellars")
                .insert({ owner_id: actionUser.id, name: "My Cellar" });
            redirect("/cellar");
        }
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-4">
                <h2 className="text-3xl font-playfair font-bold">Welcome to Pourfolio</h2>
                <p className="text-muted-foreground max-w-md">Let&apos;s set up your first cellar to get started.</p>
                <form action={createCellar}>
                    <Button size="lg" type="submit">Create My Cellar</Button>
                </form>
            </div>
        );
    }

    // Fetch Inventory Stats
    const { data: rawInventory } = await supabase
        .from("cellar_inventory")
        .select(`
      id,
      quantity,
      purchase_price_cents,
      current_market_value_cents,
      low_stock_threshold,
      low_stock_alert_enabled,
      tags,
      drink_after,
      drink_before,
      created_at,
      wine_reference (
        name,
        region,
        producer,
        wine_type
      ),
      ratings (
        id,
        score,
        rating_signals (*)
      ),
      custom_name,
      custom_producer,
      custom_region,
      custom_wine_type
    `)
        .eq("cellar_id", cellar.id)
        .eq("status", "in_cellar");

    // Define type for manual casting since pure inference is struggling
    type InventoryItem = {
        id: string;
        quantity: number;
        purchase_price_cents: number | null;
        current_market_value_cents: number | null;
        low_stock_threshold: number | null;
        low_stock_alert_enabled: boolean;
        tags: string[] | null;
        drink_after: string | null;
        drink_before: string | null;
        created_at: string;
        wine_reference: {
            name: string;
            region: string | null;
            producer: string | null;
            wine_type: string | null;
        } | null;
        ratings: Array<{
            id: string;
            score: number | null;
            rating_signals?: Array<{
                smoothness?: number | null;
                boldness?: number | null;
                earthiness?: number | null;
                spiciness?: number | null;
                fruit_forward?: number | null;
                dryness?: number | null;
                tannin_level?: number | null;
                acidity?: number | null;
                finish_length?: number | null;
                richness?: number | null;
            }> | null;
        }> | null;
        custom_name: string | null;
        custom_producer: string | null;
        custom_region: string | null;
        custom_wine_type: string | null;
        accepted_price_evidence_count?: number | null;
        stale_price_evidence_count?: number | null;
        evidence_awaiting_review_count?: number | null;
    }

    const inventory = rawInventory as unknown as InventoryItem[] | null;

    let totalBottles = 0;
    let totalValueCents = 0;
    let readyToDrinkCount = 0;
    const recentActivity = (inventory || [])
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 5);

    // Calculate this month's additions for trend indicators
    const now = new Date();
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    let addedThisMonth = 0;

    (inventory || []).forEach(item => {
        const createdAt = new Date(item.created_at);
        if (createdAt >= thisMonthStart) {
            addedThisMonth += item.quantity;
        }
    });

    (inventory || []).forEach(item => {
        totalBottles += item.quantity;

        // Value: Prefer market value, fallback to purchase price
        const unitValue = item.current_market_value_cents ?? item.purchase_price_cents ?? 0;
        totalValueCents += unitValue * item.quantity;

        if (isWineReadyNow(item)) {
            readyToDrinkCount += item.quantity;
        }
    });

    const totalValue = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 0
    }).format(totalValueCents / 100);

    const avgPrice = totalBottles > 0
        ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format((totalValueCents / totalBottles) / 100)
        : "$0.00";

    const commandWines = (inventory || []).map((item) => ({
        id: item.id,
        name: item.wine_reference?.name,
        custom_name: item.custom_name,
        producer: item.wine_reference?.producer,
        custom_producer: item.custom_producer,
        region: item.wine_reference?.region,
        custom_region: item.custom_region,
        wine_type: item.wine_reference?.wine_type,
        custom_wine_type: item.custom_wine_type,
        quantity: item.quantity,
        drink_after: item.drink_after,
        drink_before: item.drink_before,
        purchase_price_cents: item.purchase_price_cents,
        current_market_value_cents: item.current_market_value_cents,
        low_stock_threshold: item.low_stock_threshold,
        low_stock_alert_enabled: item.low_stock_alert_enabled,
        ratings_count: item.ratings?.length ?? 0,
        rating_signal_count: item.ratings?.reduce((sum, rating) => sum + (rating.rating_signals?.length ?? 0), 0) ?? 0,
        tags: item.tags,
        created_at: item.created_at,
        accepted_price_evidence_count: item.accepted_price_evidence_count,
        stale_price_evidence_count: item.stale_price_evidence_count,
        evidence_awaiting_review_count: item.evidence_awaiting_review_count,
    }));

    const tasteGenome = buildTasteGenome((inventory || []).flatMap((item) =>
        (item.ratings || [])
            .filter((rating) => rating.score != null)
            .map((rating) => ({
                id: rating.id,
                score: rating.score ?? 0,
                wine_type: item.wine_reference?.wine_type || item.custom_wine_type,
                region: item.wine_reference?.region || item.custom_region,
                producer: item.wine_reference?.producer || item.custom_producer,
                vintage: null,
                purchase_price_cents: item.purchase_price_cents,
                rating_signal: rating.rating_signals?.[0] ?? null,
            }))
    ));

    const commandCenter = buildCellarCommandCenter(commandWines, { laneLimit: 4, tasteGenome });

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Header Section */}
            <section className="rounded-[28px] border border-border/60 bg-gradient-to-br from-background via-background to-primary/5 px-8 py-8 shadow-[0_20px_60px_-40px_rgba(120,24,40,0.35)]">
                <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
                    <div className="max-w-3xl space-y-4">
                        <div className="inline-flex items-center rounded-full border border-border/60 bg-background/80 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
                            Collection command layer
                        </div>
                        <div className="space-y-2">
                            <h1 className="font-playfair text-5xl font-semibold tracking-tight text-foreground">Command Center</h1>
                            <p className="max-w-2xl text-lg text-muted-foreground">
                                One calm surface for what to open, what to watch, and what deserves attention next.
                            </p>
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-3">
                        <Link href="/scan">
                            <Button className="h-11 gap-2 rounded-full px-5">
                                <Scan className="h-4 w-4" />
                                Scan bottle
                            </Button>
                        </Link>
                        <Link href="/cellar/add">
                            <Button variant="outline" className="h-11 gap-2 rounded-full px-5">
                                <Plus className="h-4 w-4" />
                                Add bottle
                            </Button>
                        </Link>
                    </div>
                </div>

                <div className="mt-8 grid gap-4 lg:grid-cols-[1.45fr_1fr_1fr]">
                    <div className="rounded-3xl border border-border/60 bg-background/88 p-6 shadow-sm">
                        <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Collection brief</div>
                        <p className="mt-4 text-2xl font-medium leading-tight text-foreground">
                            {readyToDrinkCount > 0
                                ? `${readyToDrinkCount} bottles are ready now, with ${totalBottles} total bottles in the cellar.`
                                : `The cellar holds ${totalBottles} bottles, but nothing is clearly in a defined peak window yet.`}
                        </p>
                        <p className="mt-3 text-sm leading-6 text-muted-foreground">
                            {readyToDrinkCount > 0
                                ? "The system now has enough signal to turn inventory into a real tonight decision."
                                : "The next upgrade is better readiness and tasting memory so the collection becomes more decisive."}
                        </p>
                    </div>
                    <div className="rounded-3xl border border-border/60 bg-background/88 p-6 shadow-sm">
                        <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Best next move</div>
                        <p className="mt-4 text-lg font-medium leading-8 text-foreground">
                            {readyToDrinkCount > 0
                                ? "Use Tonight Engine to choose confidently from bottles that are ready now."
                                : "Tighten drink windows and tasting memory so the cellar feels sharper."}
                        </p>
                    </div>
                    <div className="rounded-3xl border border-border/60 bg-background/88 p-6 shadow-sm">
                        <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Shortcut</div>
                        <div className="mt-4 flex flex-col gap-3">
                            <Link href="/recommendations">
                                <Button className="h-11 w-full rounded-full">Open Tonight Engine</Button>
                            </Link>
                            <Link href="/cellar">
                                <Button variant="outline" className="h-11 w-full rounded-full">Review Cellar</Button>
                            </Link>
                        </div>
                    </div>
                </div>
            </section>

            {totalBottles > 0 && <CellarCommandCenter center={commandCenter} compact />}

            {/* KPI Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <KPICard
                    title="Collection value"
                    value={totalValue}
                    change="Portfolio value"
                    icon={<TrendingUp className="h-4 w-4 text-emerald-500" />}
                />
                <KPICard
                    title="Total bottles"
                    value={totalBottles.toString()}
                    change={`${inventory?.length || 0} unique labels`}
                    icon={<Wine className="h-4 w-4 text-violet-500" />}
                    trend={addedThisMonth > 0 ? { value: addedThisMonth, label: `${addedThisMonth} this month` } : undefined}
                />
                <KPICard
                    title="Ready now"
                    value={readyToDrinkCount.toString()}
                    change="Bottles in peak window"
                    icon={<Calendar className="h-4 w-4 text-amber-500" />}
                />
                <KPICard
                    title="Average bottle"
                    value={avgPrice}
                    change="Per bottle average"
                    icon={<Activity className="h-4 w-4 text-blue-500" />}
                />
            </div>

            {/* Main Content Areas */}
            <div className="grid gap-8 lg:grid-cols-7">

                {/* Left Column: Recent Activity & Quick Stats */}
                <Card className="col-span-full rounded-[28px] border border-border/60 bg-background/96 shadow-[0_20px_45px_-30px_rgba(15,23,42,0.24)] lg:col-span-4">
                    <CardHeader>
                        <CardTitle>Recent movement</CardTitle>
                        <CardDescription>
                            The newest bottles and signals entering your decision surface.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-6">
                            {recentActivity.length === 0 ? (
                                <div className="text-center py-8 text-muted-foreground">
                                    No wines added yet. Start scanning!
                                </div>
                            ) : (
                                recentActivity.map((item) => (
                                    <div key={item.id} className="group flex items-center justify-between rounded-2xl border border-transparent px-2 py-2 transition-colors hover:border-border/60 hover:bg-muted/10">
                                        <div className="flex items-center gap-4">
                                            <div className="flex h-11 w-11 items-center justify-center rounded-full border border-primary/20 bg-primary/5 transition-transform group-hover:scale-105">
                                                <Wine className="h-4.5 w-4.5 text-primary" />
                                            </div>
                                            <div className="space-y-1">
                                                <p className="font-medium leading-none">
                                                    {item.wine_reference?.name || item.custom_name || "Unknown Wine"}
                                                </p>
                                                <p className="text-xs text-muted-foreground">
                                                    {item.wine_reference?.producer || item.custom_producer || "Unknown Producer"}
                                                    {item.wine_reference?.region ? ` • ${item.wine_reference.region}` : ""}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="text-sm font-medium tabular-nums">
                                            {new Date(item.created_at).toLocaleDateString()}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </CardContent>
                    <CardFooter>
                        <Link href="/cellar" className="w-full">
                            <Button variant="ghost" className="w-full">View Full Cellar <ArrowUpRight className="ml-2 h-4 w-4" /></Button>
                        </Link>
                    </CardFooter>
                </Card>

                {/* Right Column: Sommelier & Storage */}
                <div className="col-span-full space-y-6 lg:col-span-3">

                    <Card className="relative overflow-hidden rounded-[28px] border border-border/60 bg-gradient-to-br from-background via-background to-primary/5 shadow-[0_20px_45px_-30px_rgba(120,24,40,0.24)]">
                        <div className="absolute right-0 top-0 p-5 opacity-8">
                            <Wine className="h-24 w-24" />
                        </div>
                        <CardHeader>
                            <CardTitle className="font-playfair text-2xl tracking-tight text-foreground">
                                Tonight outlook
                            </CardTitle>
                            <CardDescription>
                                A fast read on whether the cellar is ready to make a strong tonight decision.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="rounded-2xl border border-border/60 bg-background/88 p-4 text-sm text-muted-foreground">
                                {readyToDrinkCount > 0 ? (
                                    <span><span className="font-medium text-foreground">{readyToDrinkCount} bottles are ready now.</span> Tonight Engine should already have enough signal to help you choose well.</span>
                                ) : (
                                    <span><span className="font-medium text-foreground">Readiness is still thin.</span> Add or tighten drink windows so the system can become more decisive.</span>
                                )}
                            </div>
                            <Link href="/recommendations">
                                <Button className="h-11 w-full rounded-full">Open Tonight Engine</Button>
                            </Link>
                        </CardContent>
                    </Card>

                    <Card className="rounded-[28px] border border-border/60 bg-background/96 shadow-sm">
                        <CardHeader>
                            <CardTitle className="tracking-tight">Cellar readiness</CardTitle>
                            <CardDescription>
                                Bottles in their drinking window
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <StorageProgress name="Ready to drink" current={readyToDrinkCount} max={totalBottles} />
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}

// Sub-components
function KPICard({ title, value, change, icon, trend }: {
    title: string,
    value: string,
    change: string,
    icon: React.ReactNode,
    trend?: { value: number, label: string }
}) {
    return (
        <Card className="rounded-3xl border border-border/60 bg-background/96 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-[0_18px_40px_-32px_rgba(15,23,42,0.24)]">
            <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
                <CardTitle className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                    {title}
                </CardTitle>
                {icon}
            </CardHeader>
            <CardContent>
                <div className="text-4xl font-semibold font-playfair tracking-tight">{value}</div>
                <div className="mt-2 flex items-center gap-2">
                    {trend && trend.value !== 0 && (
                        <span className={`flex items-center text-xs font-medium ${trend.value > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                            {trend.value > 0 ? (
                                <TrendingUp className="h-3 w-3 mr-0.5" />
                            ) : (
                                <TrendingDown className="h-3 w-3 mr-0.5" />
                            )}
                            {trend.value > 0 ? '+' : ''}{trend.label}
                        </span>
                    )}
                    <p className="text-xs text-muted-foreground">
                        {change}
                    </p>
                </div>
            </CardContent>
        </Card>
    )
}

function StorageProgress({ name, current, max }: { name: string, current: number, max: number }) {
    const percentage = max > 0 ? Math.min(Math.round((current / max) * 100), 100) : 0;
    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
                <span className="font-medium">{name}</span>
                <span className="text-muted-foreground">{current} of {max} bottles</span>
            </div>
            <Progress value={percentage} className="h-2" />
        </div>
    )
}
