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
      <div className="container flex h-16 items-center justify-between">
        <div className="flex items-center gap-8">
          <Link href="/dashboard" className="flex items-center gap-3">
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
          <nav className="hidden md:flex items-center gap-5">
            <Link
              href="/cellar"
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Cellar
            </Link>
            <Link
              href="/scan"
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Scan
            </Link>
            <Link
              href="/ratings"
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Ratings
            </Link>
            <Link
              href="/analytics"
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Analytics
            </Link>
            <Link
              href="/bottle-brain"
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Bottle Brain
            </Link>
            <Link
              href="/intelligence"
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Intelligence
            </Link>
            <Link
              href="/jarvis/voice"
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Voice Capture
            </Link>
            <Link
              href="/recommendations"
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Tonight Engine
            </Link>
            <Link
              href="/jarvis"
              className="rounded-full border border-border/70 bg-background/80 px-3 py-2 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-accent"
            >
              JARVIS
            </Link>
            <DropdownMenu>
              <DropdownMenuTrigger className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
                Explore
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem asChild>
                  <Link href="/jarvis">JARVIS Memory OS</Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/bottle-brain">Bottle Brain</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/jarvis/voice">Voice Capture</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/recommendations">Tonight Engine</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/wishlist">Wishlist</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/shopping">Shopping</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/visits">Visits</Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Link
              href="/social"
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Social
            </Link>
          </nav>
        </div>

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
              <Link href="/settings">Settings</Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
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
    </header>
  );
}
