"use client";

import { usePathname, useSearchParams } from "next/navigation";
import posthog from "posthog-js";
import { PostHogProvider as PHProvider, usePostHog } from "posthog-js/react";
import { Suspense, useEffect } from "react";

function PostHogPageView() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const posthog = usePostHog();

  useEffect(() => {
    if (pathname && posthog) {
      let url = globalThis.origin + pathname;
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

function isValidPostHogKey(key: string): boolean {
  return key.length > 0 && key.startsWith("phc_");
}

export function PostHogProvider({
  children,
  apiKey,
  apiHost = "https://us.i.posthog.com",
}: Readonly<PostHogProviderProps>) {
  const isValid = isValidPostHogKey(apiKey);

  useEffect(() => {
    if (globalThis.window !== undefined && isValid) {
      posthog.init(apiKey, {
        api_host: apiHost,
        person_profiles: "identified_only",
        capture_pageview: false,
        capture_pageleave: true,
      });
    }
  }, [apiKey, apiHost, isValid]);

  if (!isValid) {
    return <>{children}</>;
  }

  return (
    <PHProvider client={posthog}>
      <Suspense fallback={null}>
        <PostHogPageView />
      </Suspense>
      {children}
    </PHProvider>
  );
}

