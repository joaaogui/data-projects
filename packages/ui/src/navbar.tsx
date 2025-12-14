"use client";

import * as React from "react";
import { ThemeToggle } from "./theme-toggle";

interface NavbarProps {
  logo: React.ReactNode;
  appName?: string;
  search?: React.ReactNode;
  homeLink?: React.ReactNode;
  themeIconClassName?: string;
}

export function Navbar({
  logo,
  appName,
  search,
  homeLink,
  themeIconClassName,
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
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center gap-3 sm:gap-4">
          {homeLink ? (
            React.cloneElement(homeLink as React.ReactElement<{ className?: string; children?: React.ReactNode }>, {
              className: "shrink-0 flex items-center gap-2 sm:gap-3 hover:opacity-80 transition-opacity",
              children: brandContent,
            })
          ) : (
            <div className="shrink-0 flex items-center gap-2 sm:gap-3">
              {brandContent}
            </div>
          )}
          {search && (
            <div className="flex-1 max-w-md ml-auto">{search}</div>
          )}
          <ThemeToggle iconClassName={themeIconClassName} />
        </div>
      </div>
    </header>
  );
}

