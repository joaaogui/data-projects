import { NextRequest, NextResponse } from "next/server";
import { isAppError, toErrorResponse } from "./errors";
import { logger } from "./logger";

/**
 * Generic over the context so the same wrapper fits both static routes (which
 * Next types with an empty params bag) and dynamic ones.
 */
type RouteHandler<TCtx> = (
  req: NextRequest,
  ctx: TCtx
) => Promise<NextResponse | Response>;

export function withErrorHandling<TCtx>(
  tag: string,
  handler: RouteHandler<TCtx>
): RouteHandler<TCtx> {
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
