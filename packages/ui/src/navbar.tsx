"use client";

import * as React from "react";
import { ThemeToggle } from "./theme-toggle";

interface NavbarProps {
  logo: React.ReactNode;
  appName?: string;
  search?: React.ReactNode;
  homeLink?: React.ReactNode;
  homeLabel?: string;
  themeIconClassName?: string;
  /** Trailing slot, for apps that overlay their own control in the corner. */
  actions?: React.ReactNode;
  /**
   * Span the full width with flush padding instead of a centred container, so
   * the navbar lines up with full-bleed page content underneath it.
   */
  fullWidth?: boolean;
}

export function Navbar({
  logo,
  appName,
  search,
  homeLink,
  homeLabel,
  themeIconClassName,
  actions,
  fullWidth = false,
}: Readonly<NavbarProps>) {
  const brandContent = (
    <>
      {logo}
      {appName && (
        <span className="hidden sm:inline font-semibold text-lg tracking-tight">
          {appName}
        </span>
      )}
    </>
  );

  return (
    <header className="flex-shrink-0 sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
      <div className={fullWidth ? "px-3 py-2.5 sm:px-6 sm:py-3" : "container mx-auto px-3 py-2.5 sm:px-4 sm:py-3"}>
        <div className="responsive-navbar flex flex-wrap items-center gap-2 sm:flex-nowrap sm:gap-4">
          {homeLink ? (
            React.cloneElement(homeLink as React.ReactElement<{ className?: string; children?: React.ReactNode; "aria-label"?: string }>, {
              className: "shrink-0 flex items-center gap-2 sm:gap-3 hover:opacity-80 transition-opacity",
              "aria-label": homeLabel ?? (appName ? `${appName} home` : "Home"),
              children: brandContent,
            })
          ) : (
            <div className="shrink-0 flex items-center gap-2 sm:gap-3">
              {brandContent}
            </div>
          )}
          {search && (
            <div className="responsive-navbar-search order-last w-full sm:order-none sm:ml-auto sm:max-w-md sm:flex-1">
              {search}
            </div>
          )}
          <div className="ml-auto flex shrink-0 items-center gap-1 sm:ml-0 sm:gap-2">
            <ThemeToggle iconClassName={themeIconClassName} />
            {actions}
          </div>
        </div>
      </div>
    </header>
  );
}

