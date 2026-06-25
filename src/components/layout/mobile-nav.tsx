"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { BOUGHT_WINE_INTAKE, boughtWineIntakeHref } from "@/lib/purchase-intake";

const navItems = [
  { href: "/", label: "Home", icon: "🏠" },
  { href: "/cellar", label: "Cellar", icon: "🍾" },
  { href: "/capture", label: "Capture", icon: "📷" },
  { href: boughtWineIntakeHref(), label: BOUGHT_WINE_INTAKE.mobileLabel, icon: "🧾" },
  { href: "/intelligence", label: "Intel", icon: "✨" },
] as const;

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background md:hidden">
      <div className="grid grid-cols-5 py-2">
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center gap-1 px-2 py-2 text-xs",
                isActive ? "text-primary" : "text-muted-foreground"
              )}
            >
              <span className="text-xl">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
