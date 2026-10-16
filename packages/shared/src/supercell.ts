export type SupercellErrorCode =
  | "AUTHORIZATION_FAILED"
  | "PLAYER_NOT_FOUND"
  | "UPSTREAM_RATE_LIMITED"
  | "UPSTREAM_MAINTENANCE"
  | "UPSTREAM_UNAVAILABLE"
  | "UPSTREAM_REQUEST_FAILED";

export class MissingConfigurationError extends Error {
  readonly variableName: string;

  constructor(variableName: string) {
    super(`Missing required server configuration: ${variableName}`);
    this.name = "MissingConfigurationError";
    this.variableName = variableName;
  }
}

interface SupercellErrorDetails {
  code: SupercellErrorCode;
  message: string;
}

function supercellErrorDetails(
  status: number,
  serviceName: string,
): SupercellErrorDetails {
  if (status === 401 || status === 403) {
    return {
      code: "AUTHORIZATION_FAILED",
      message: `${serviceName} access was rejected. Check the API token and proxy IP allowlist.`,
    };
  }
  if (status === 404) {
    return {
      code: "PLAYER_NOT_FOUND",
      message: `The configured ${serviceName} player could not be found.`,
    };
  }
  if (status === 429) {
    return {
      code: "UPSTREAM_RATE_LIMITED",
      message: `${serviceName} is temporarily limiting requests. Try again in a few minutes.`,
    };
  }
  if (status === 503) {
    return {
      code: "UPSTREAM_MAINTENANCE",
      message: `${serviceName} is under maintenance. Try again later.`,
    };
  }
  if (status >= 500) {
    return {
      code: "UPSTREAM_UNAVAILABLE",
      message: `${serviceName} is temporarily unavailable. Try again shortly.`,
    };
  }
  return {
    code: "UPSTREAM_REQUEST_FAILED",
    message: `${serviceName} rejected the request. Try again shortly.`,
  };
}

export class SupercellApiError extends Error {
  readonly status: number;
  readonly code: SupercellErrorCode;
  readonly publicMessage: string;

  constructor(status: number, serviceName = "Supercell") {
    const details = supercellErrorDetails(status, serviceName);
    super(`${serviceName} API request failed with status ${status}`);
    this.name = "SupercellApiError";
    this.status = status;
    this.code = details.code;
    this.publicMessage = details.message;
  }
}

export class SupercellNetworkError extends Error {
  readonly code = "UPSTREAM_UNAVAILABLE" as const;
  readonly publicMessage: string;

  constructor(serviceName = "Supercell") {
    super(`${serviceName} API network request failed`);
    this.name = "SupercellNetworkError";
    this.publicMessage = `The ${serviceName} service could not be reached. Try again shortly.`;
  }
}

export function normalizePlayerTag(tag: string): string {
  return `#${tag.trim().replace(/^#+/, "").toUpperCase()}`;
}

export function encodedTag(tag: string): string {
  return encodeURIComponent(normalizePlayerTag(tag));
}

export type SupercellFetchInit = RequestInit & {
  next?: {
    revalidate?: number;
    tags?: string[];
  };
};

export interface SupercellFetcherOptions {
  serviceName: string;
  baseUrl: string;
  apiKeyEnvVar: string;
}

export function createSupercellFetcher({
  serviceName,
  baseUrl,
  apiKeyEnvVar,
}: SupercellFetcherOptions) {
  return async function supercellFetch<T>(
    path: string,
    init: SupercellFetchInit = {},
  ): Promise<T> {
    const apiKey = process.env[apiKeyEnvVar]?.trim();
    if (!apiKey) {
      throw new MissingConfigurationError(apiKeyEnvVar);
    }

    const headers = new Headers(init.headers);
    headers.set("Accept", "application/json");
    headers.set("Authorization", `Bearer ${apiKey}`);

    let response: Response;
    try {
      response = await fetch(`${baseUrl}${path}`, {
        ...init,
        headers,
      });
    } catch {
      throw new SupercellNetworkError(serviceName);
    }

    if (!response.ok) {
      throw new SupercellApiError(response.status, serviceName);
    }

    return (await response.json()) as T;
  };
}

export function supercellUpstreamStatus(error: SupercellApiError): number {
  if (error.code === "PLAYER_NOT_FOUND") {
    return 404;
  }
  if (error.code === "UPSTREAM_RATE_LIMITED") {
    return 429;
  }
  if (
    error.code === "AUTHORIZATION_FAILED" ||
    error.code === "UPSTREAM_MAINTENANCE" ||
    error.code === "UPSTREAM_UNAVAILABLE"
  ) {
    return 503;
  }
  return 502;
}

export const SUPERCELL_ERROR_GUIDANCE: Record<
  string,
  { title: string; detail: string }
> = {
  CONFIGURATION_MISSING: {
    title: "Server setup needed",
    detail:
      "Add the Supercell and AI provider server environment variables, then run the analysis again.",
  },
  AUTHORIZATION_FAILED: {
    title: "API access was rejected",
    detail:
      "Verify the API token and confirm the RoyaleAPI proxy IP is allowed for that token.",
  },
  PLAYER_NOT_FOUND: {
    title: "Player tag was not found",
    detail: "Confirm the configured account tag is available through the API.",
  },
  UPSTREAM_RATE_LIMITED: {
    title: "Upstream API needs a timeout",
    detail: "Wait a few minutes before requesting another fresh snapshot.",
  },
  UPSTREAM_MAINTENANCE: {
    title: "Upstream API is under maintenance",
    detail: "The analysis will return once the official API is back online.",
  },
  UPSTREAM_UNAVAILABLE: {
    title: "Upstream service is temporarily unavailable",
    detail:
      "The upstream service could not be reached. Wait a moment and try again.",
  },
  RATE_LIMITED: {
    title: "Too many refreshes",
    detail:
      "This analysis refreshes every 30 minutes, so another request is not needed yet.",
  },
};
