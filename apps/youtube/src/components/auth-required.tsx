"use client";

import { Button } from "@data-projects/ui";
import { LogIn } from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

export function useSignInHref(): string {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const query = searchParams.toString();
  const callbackUrl = `${pathname || "/"}${query ? `?${query}` : ""}`;
  return `/signin?callbackUrl=${encodeURIComponent(callbackUrl)}`;
}

export function AuthRequired({
  title,
  description,
  compact = false,
}: Readonly<{
  title: string;
  description: string;
  compact?: boolean;
}>) {
  const href = useSignInHref();

  return (
    <div
      className={`rounded-lg border border-border bg-card ${
        compact ? "p-4" : "px-5 py-6 sm:px-6"
      }`}
    >
      <div
        className={`flex gap-4 ${
          compact
            ? "flex-col items-start sm:flex-row sm:items-center sm:justify-between"
            : "flex-col items-start"
        }`}
      >
        <div className="space-y-1">
          <p className="text-sm font-medium">{title}</p>
          <p className="max-w-xl text-xs leading-relaxed text-muted-foreground">
            {description}
          </p>
        </div>
        <Button size="sm" asChild className="shrink-0 gap-1.5">
          <Link href={href}>
            <LogIn className="h-3.5 w-3.5" aria-hidden="true" />
            Sign in
          </Link>
        </Button>
      </div>
    </div>
  );
}
