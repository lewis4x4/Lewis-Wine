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
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href="/cellar" className="flex items-center gap-2">
            <span className="text-xl">🍷</span>
            <span className="font-playfair text-xl font-bold text-primary">
              Pourfolio
            </span>
          </Link>
          <nav className="hidden md:flex items-center gap-4">
            <Link
              href="/cellar"
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              My Cellar
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
            <DropdownMenu>
              <DropdownMenuTrigger className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
                Discover
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem asChild>
                  <Link href="/wishlist">Wishlist</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/shopping">Shopping List</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/visits">Winery Visits</Link>
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
            <Button variant="ghost" className="relative h-8 w-8 rounded-full">
              <Avatar className="h-8 w-8">
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
            <DropdownMenuItem onClick={handleSignOut}>
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
