import { NextRequest, NextResponse } from "next/server";
import { isAppError, toErrorResponse } from "./errors";
import { logger } from "./logger";

type RouteParams = { params: Promise<Record<string, string>> };
type RouteHandler = (req: NextRequest, ctx: RouteParams) => Promise<NextResponse | Response>;

export function withErrorHandling(tag: string, handler: RouteHandler): RouteHandler {
  const log = logger.child({ route: tag });

  return async (req, ctx) => {
    try {
      return await handler(req, ctx);
    } catch (error) {
      if (isAppError(error)) {
        log.warn({ err: error, status: error.status }, error.message);
      } else {
        log.error({ err: error }, "Unhandled route error");
      }

      const { message, status } = toErrorResponse(error);
      return NextResponse.json({ error: message }, { status });
    }
  };
}
