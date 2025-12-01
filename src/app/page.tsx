import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary/20">
      {/* Header */}
      <header className="container mx-auto px-4 py-6">
        <nav className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🍷</span>
            <span className="font-playfair text-2xl font-bold text-primary">
              Pourfolio
            </span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/login">
              <Button variant="ghost">Sign In</Button>
            </Link>
            <Link href="/signup">
              <Button>Get Started</Button>
            </Link>
          </div>
        </nav>
      </header>

      {/* Hero */}
      <main className="container mx-auto px-4 py-20">
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="font-playfair text-5xl font-bold tracking-tight text-foreground md:text-6xl lg:text-7xl">
            Your Wine
            <span className="text-primary"> Portfolio</span>
          </h1>
          <p className="mt-6 text-xl text-muted-foreground">
            Track every bottle, rate every pour, and never miss the perfect
            drinking window. Pourfolio is your personal sommelier in your
            pocket.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link href="/signup">
              <Button size="lg" className="min-w-[200px]">
                Start Your Collection
              </Button>
            </Link>
            <Link href="/login">
              <Button size="lg" variant="outline" className="min-w-[200px]">
                Sign In
              </Button>
            </Link>
          </div>
        </div>

        {/* Features */}
        <div className="mt-32 grid gap-8 md:grid-cols-3">
          <FeatureCard
            icon="📱"
            title="Scan & Add"
            description="Scan any wine barcode to instantly add it to your cellar with all the details."
          />
          <FeatureCard
            icon="⭐"
            title="Rate & Track"
            description="Use the 100-point scale to rate wines and track how your palate evolves over time."
          />
          <FeatureCard
            icon="🍾"
            title="Perfect Timing"
            description="Know exactly when each bottle is at its peak with drinking window alerts."
          />
        </div>

        {/* Stats Preview */}
        <div className="mt-32 rounded-2xl bg-card p-8 shadow-lg">
          <div className="grid gap-8 text-center md:grid-cols-4">
            <StatCard value="200K+" label="Wines in Database" />
            <StatCard value="100pt" label="Rating Scale" />
            <StatCard value="∞" label="Bottles to Track" />
            <StatCard value="Free" label="To Get Started" />
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="container mx-auto px-4 py-8 text-center text-sm text-muted-foreground">
        <p>&copy; {new Date().getFullYear()} Pourfolio. Your wine, your way.</p>
      </footer>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: string;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-xl bg-card p-6 shadow-sm transition-shadow hover:shadow-md">
      <div className="text-4xl">{icon}</div>
      <h3 className="mt-4 font-playfair text-xl font-semibold">{title}</h3>
      <p className="mt-2 text-muted-foreground">{description}</p>
    </div>
  );
}

function StatCard({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <div className="font-playfair text-3xl font-bold text-primary">
        {value}
      </div>
      <div className="mt-1 text-sm text-muted-foreground">{label}</div>
    </div>
  );
}
