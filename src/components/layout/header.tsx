"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/components/providers/auth-provider";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { toast } from "sonner";
import { BOUGHT_WINE_INTAKE, boughtWineIntakeHref } from "@/lib/purchase-intake";

const primaryNav = [
  { href: "/cellar", label: "Cellar" },
  { href: "/capture", label: "Capture" },
  { href: "/intelligence", label: "Intelligence" },
  { href: "/recommendations", label: "Tonight" },
] as const;

const moreNav = [
  { href: "/ratings", label: "Ratings" },
  { href: "/analytics", label: "Analytics" },
  { href: "/bottle-brain", label: "Bottle Brain" },
  { href: "/blind-tasting", label: "Blind Tasting" },
  { href: "/jarvis/voice", label: "Voice Capture" },
  { href: "/shopping", label: "Shopping" },
  { href: "/wishlist", label: "Wishlist" },
  { href: "/visits", label: "Visits" },
  { href: "/social", label: "Social" },
] as const;

const navLinkClass = "rounded-full px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground";

export function Header() {
  const { user } = useAuth();
  const router = useRouter();
  const supabase = createClient();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    toast.success("Signed out successfully");
    router.push("/");
    router.refresh();
  };

  const initials = user?.email?.substring(0, 2).toUpperCase() || "??";

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/60 bg-background/92 backdrop-blur-xl supports-[backdrop-filter]:bg-background/78">
      <div className="mx-auto flex h-16 w-full max-w-[1400px] items-center justify-between gap-4 px-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-6">
          <Link href="/" className="flex shrink-0 items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full border border-primary/20 bg-primary/5 text-base text-primary shadow-sm">
              🍷
            </div>
            <div className="flex flex-col leading-none">
              <span className="font-playfair text-xl font-semibold tracking-tight text-foreground">
                Pourfolio
              </span>
              <span className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                Collector OS
              </span>
            </div>
          </Link>

          <nav className="hidden items-center gap-1 lg:flex" aria-label="Primary navigation">
            {primaryNav.map((item) => (
              <Link key={item.href} href={item.href} className={navLinkClass}>
                {item.label}
              </Link>
            ))}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="rounded-full px-3 text-sm font-medium text-muted-foreground hover:text-foreground">
                  More
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-48">
                {moreNav.map((item) => (
                  <DropdownMenuItem key={item.href} asChild>
                    <Link href={item.href}>{item.label}</Link>
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/jarvis">JARVIS Memory OS</Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </nav>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Button asChild className="hidden rounded-full px-4 shadow-sm md:inline-flex" title={BOUGHT_WINE_INTAKE.shortDescription}>
            <Link href={boughtWineIntakeHref()}>{BOUGHT_WINE_INTAKE.primaryLabel}</Link>
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-10 w-10 rounded-full border border-border/60 bg-background/80 shadow-sm">
                <Avatar className="h-9 w-9">
                  <AvatarFallback className="bg-primary text-primary-foreground">
                    {initials}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <div className="flex items-center justify-start gap-2 p-2">
                <div className="flex flex-col space-y-1 leading-none">
                  <p className="text-sm font-medium">{user?.email}</p>
                </div>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href={boughtWineIntakeHref()}>{BOUGHT_WINE_INTAKE.primaryLabel}</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/settings">Settings</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/jarvis">JARVIS Memory OS</Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleSignOut}>
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
