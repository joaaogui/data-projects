"use client";

import * as React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "./theme-provider";
import { TooltipProvider } from "./tooltip";
import { PostHogProvider } from "./posthog-provider";

interface ProvidersProps {
  children: React.ReactNode;
  defaultTheme?: "light" | "dark" | "system";
  posthogApiKey?: string;
  posthogHost?: string;
}

export function Providers({
  children,
  defaultTheme = "system",
  posthogApiKey,
  posthogHost,
}: ProvidersProps) {
  const [queryClient] = React.useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  const content = (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider
        attribute="class"
        defaultTheme={defaultTheme}
        enableSystem
        disableTransitionOnChange
      >
        <TooltipProvider delayDuration={200}>{children}</TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );

  if (posthogApiKey) {
    return (
      <PostHogProvider apiKey={posthogApiKey} apiHost={posthogHost}>
        {content}
      </PostHogProvider>
    );
  }

  return content;
}

