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
        // Handle new user state - maybe redirect to onboarding or show empty state
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-4">
                <h2 className="text-3xl font-playfair font-bold">Welcome to Pourfolio</h2>
                <p className="text-muted-foreground max-w-md">Let's set up your first cellar to get started.</p>
                <Link href="/onboarding">
                    <Button size="lg">Create My Cellar</Button>
                </Link>
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
      drink_after,
      drink_before,
      created_at,
      wine_reference (
        name,
        region,
        producer
      ),
      custom_name,
      custom_producer,
      custom_region
    `)
        .eq("cellar_id", cellar.id)
        .eq("status", "in_cellar");

    // Define type for manual casting since pure inference is struggling
    type InventoryItem = {
        id: string;
        quantity: number;
        purchase_price_cents: number | null;
        current_market_value_cents: number | null;
        drink_after: string | null;
        drink_before: string | null;
        created_at: string;
        wine_reference: {
            name: string;
            region: string | null;
            producer: string | null;
        } | null;
        custom_name: string | null;
        custom_producer: string | null;
        custom_region: string | null;
    }

    const inventory = rawInventory as unknown as InventoryItem[] | null;

    // Calculate Metrics
    const currentYear = new Date().getFullYear();

    let totalBottles = 0;
    let totalValueCents = 0;
    let readyToDrinkCount = 0;
    const recentActivity = (inventory || [])
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 5);

    // Calculate this month's additions for trend indicators
    const now = new Date();
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    let addedThisMonth = 0;
    let addedLastMonth = 0;

    (inventory || []).forEach(item => {
        const createdAt = new Date(item.created_at);
        if (createdAt >= thisMonthStart) {
            addedThisMonth += item.quantity;
        } else if (createdAt >= lastMonthStart && createdAt < thisMonthStart) {
            addedLastMonth += item.quantity;
        }
    });

    (inventory || []).forEach(item => {
        totalBottles += item.quantity;

        // Value: Prefer market value, fallback to purchase price
        const unitValue = item.current_market_value_cents ?? item.purchase_price_cents ?? 0;
        totalValueCents += unitValue * item.quantity;

        // Ready to Drink Logic (Simple Year check)
        const startYear = item.drink_after ? parseInt(item.drink_after) : 0;
        const endYear = item.drink_before ? parseInt(item.drink_before) : 9999;

        if (currentYear >= startYear && currentYear <= endYear) {
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

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Header Section */}
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight font-playfair">Dashboard</h2>
                    <p className="text-muted-foreground">
                        Overview of your collection
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Link href="/scan">
                        <Button className="gap-2 shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all">
                            <Scan className="h-4 w-4" />
                            Scan Bottle
                        </Button>
                    </Link>
                    <Link href="/cellar/add">
                        <Button variant="outline" className="gap-2">
                            <Plus className="h-4 w-4" />
                            Add Manually
                        </Button>
                    </Link>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <KPICard
                    title="Total Value"
                    value={totalValue}
                    change="Portfolio Value"
                    icon={<TrendingUp className="h-4 w-4 text-emerald-500" />}
                />
                <KPICard
                    title="Total Bottles"
                    value={totalBottles.toString()}
                    change={`${inventory?.length || 0} unique labels`}
                    icon={<Wine className="h-4 w-4 text-violet-500" />}
                    trend={addedThisMonth > 0 ? { value: addedThisMonth, label: `${addedThisMonth} this month` } : undefined}
                />
                <KPICard
                    title="Ready to Drink"
                    value={readyToDrinkCount.toString()}
                    change="Bottles in peak window"
                    icon={<Calendar className="h-4 w-4 text-amber-500" />}
                />
                <KPICard
                    title="Avg. Bottle Price"
                    value={avgPrice}
                    change="Per bottle average"
                    icon={<Activity className="h-4 w-4 text-blue-500" />}
                />
            </div>

            {/* Main Content Areas */}
            <div className="grid gap-8 lg:grid-cols-7">

                {/* Left Column: Recent Activity & Quick Stats */}
                <Card className="col-span-full lg:col-span-4 border-none shadow-md bg-gradient-to-br from-card to-secondary/10">
                    <CardHeader>
                        <CardTitle>Recent Additions</CardTitle>
                        <CardDescription>
                            The latest bottles added to your cellar.
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
                                    <div key={item.id} className="flex items-center justify-between group">
                                        <div className="flex items-center gap-4">
                                            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20 group-hover:scale-110 transition-transform">
                                                <Wine className="h-5 w-5 text-primary" />
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
                <div className="col-span-full lg:col-span-3 space-y-6">

                    {/* Sommelier Recommendations - Placeholder until AI is ready */}
                    <Card className="border-primary/20 bg-primary/5 relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-4 opacity-10">
                            <Wine className="w-24 h-24" />
                        </div>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-primary">
                                <Wine className="h-5 w-5" />
                                Sommelier Picks
                            </CardTitle>
                            <CardDescription>
                                Top rated wines from your collection to enjoy.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-3">
                                {readyToDrinkCount > 0 ? (
                                    <p className="text-sm text-muted-foreground">You have {readyToDrinkCount} bottles currently in their drinking window!</p>
                                ) : (
                                    <p className="text-sm text-muted-foreground">Add more wines with drinking windows to get recommendations.</p>
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Storage Snapshot */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Storage Status</CardTitle>
                            <CardDescription>
                                Capacity usage
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <StorageProgress name="Total Capacity" current={totalBottles} max={100} />
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
        <Card className="hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                    {title}
                </CardTitle>
                {icon}
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold font-playfair tracking-tight">{value}</div>
                <div className="flex items-center gap-2 mt-1">
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
    const percentage = Math.min(Math.round((current / max) * 100), 100);
    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
                <span className="font-medium">{name}</span>
                <span className="text-muted-foreground">{current} / {max}+ bottles</span>
            </div>
            <Progress value={percentage} className="h-2" />
        </div>
    )
}
