"use client";

import * as React from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "./button";
import { cn } from "@data-projects/shared";

interface ThemeToggleProps {
  iconClassName?: string;
}

export function ThemeToggle({ iconClassName }: Readonly<ThemeToggleProps> = {}) {
  const { setTheme } = useTheme();
  const [isDark, setIsDark] = React.useState<boolean | null>(null);

  const readIsDark = React.useCallback(() => {
    const htmlDark = document.documentElement.classList.contains("dark");
    const bodyDark = document.body.classList.contains("dark");
    return htmlDark || bodyDark;
  }, []);

  React.useLayoutEffect(() => {
    const next = readIsDark();
    setIsDark(next);

    const observer = new MutationObserver(() => {
      const updated = readIsDark();
      setIsDark(updated);
    });

    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    observer.observe(document.body, { attributes: true, attributeFilter: ["class"] });

    return () => observer.disconnect();
  }, [readIsDark]);

  if (isDark === null) {
    return (
      <Button variant="ghost" size="icon" className="h-9 w-9">
        <span className="sr-only">Toggle theme</span>
      </Button>
    );
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      data-testid="theme-toggle"
      className="h-9 w-9 hover:bg-accent/20 transition-colors"
      onClick={() => {
        const darkNow = readIsDark();
        const next = darkNow ? "light" : "dark";

        setTheme(next);
      }}
    >
      {isDark ? (
        <Sun className={cn("h-5 w-5 transition-all", iconClassName || "text-yellow-500")} />
      ) : (
        <Moon className={cn("h-5 w-5 transition-all", iconClassName)} />
      )}
      <span className="sr-only">Toggle theme</span>
    </Button>
  );
}

