"use client";

import posthog from "posthog-js";
import { PostHogProvider as PHProvider, usePostHog } from "posthog-js/react";
import { useEffect, Suspense } from "react";
import { usePathname, useSearchParams } from "next/navigation";

function PostHogPageView() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const posthog = usePostHog();

  useEffect(() => {
    if (pathname && posthog) {
      let url = window.origin + pathname;
      if (searchParams.toString()) {
        url = url + `?${searchParams.toString()}`;
      }
      posthog.capture("$pageview", { $current_url: url });
    }
  }, [pathname, searchParams, posthog]);

  return null;
}

interface PostHogProviderProps {
  children: React.ReactNode;
  apiKey: string;
  apiHost?: string;
}

export function PostHogProvider({
  children,
  apiKey,
  apiHost = "https://us.i.posthog.com",
}: PostHogProviderProps) {
  useEffect(() => {
    if (typeof window !== "undefined" && apiKey) {
      posthog.init(apiKey, {
        api_host: apiHost,
        person_profiles: "identified_only",
        capture_pageview: false,
        capture_pageleave: true,
      });
    }
  }, [apiKey, apiHost]);

  return (
    <PHProvider client={posthog}>
      <Suspense fallback={null}>
        <PostHogPageView />
      </Suspense>
      {children}
    </PHProvider>
  );
}

