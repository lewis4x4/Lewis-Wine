"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/jarvis", label: "Overview" },
  { href: "/jarvis/capture", label: "Capture" },
  { href: "/jarvis/voice", label: "Voice" },
  { href: "/jarvis/commitments", label: "Commitments" },
  { href: "/jarvis/timeline", label: "Timeline" },
  { href: "/jarvis/briefing", label: "Briefing" },
];

export function JarvisNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-wrap gap-2">
      {navItems.map((item) => {
        const isActive =
          pathname === item.href ||
          (item.href !== "/jarvis" && pathname.startsWith(`${item.href}/`));

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "rounded-full border px-4 py-2 text-sm font-medium transition-colors",
              isActive
                ? "border-primary/20 bg-primary/10 text-foreground shadow-sm"
                : "border-border/70 bg-background/80 text-muted-foreground hover:text-foreground",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
