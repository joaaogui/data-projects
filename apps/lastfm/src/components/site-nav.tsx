"use client";

import { cn } from "@data-projects/shared";
import { Navbar } from "@data-projects/ui";
import { AudioLines } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/", label: "Overview" },
  { href: "/time", label: "Time" },
  { href: "/artists", label: "Artists" },
  { href: "/evolution", label: "Evolution" },
  { href: "/library", label: "Library" },
  { href: "/import", label: "Import" },
] as const;

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SiteNav() {
  const pathname = usePathname();

  return (
    <div className="sticky top-0 z-50">
      <Navbar
        logo={<AudioLines className="size-5 text-data" aria-hidden />}
        appName="Listening Habits"
        // Navbar clones this and overrides only className and children, so the
        // label survives. It has to live here because the brand text is hidden
        // on small screens, which would otherwise leave the link unnamed.
        homeLink={<Link href="/" aria-label="Listening Habits home" />}
      />
      <nav
        aria-label="Sections"
        className="border-b border-border/50 bg-background/80 backdrop-blur-xl"
      >
        <div className="container mx-auto flex gap-1 overflow-x-auto px-3 sm:px-4">
          {TABS.map((tab) => {
            const active = isActive(pathname, tab.href);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition-colors",
                  active
                    ? "border-data text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                {tab.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
