import "server-only";
import type { z } from "zod";

export function shouldSkipEnvValidation(
  source: NodeJS.ProcessEnv = process.env,
): boolean {
  return (
    source.NODE_ENV === "test" ||
    Boolean(source.VITEST) ||
    Boolean(source.CI) ||
    Boolean(source.SKIP_ENV_VALIDATION)
  );
}

export function loadServerEnv<TSchema extends z.ZodTypeAny>(
  schema: TSchema,
  buildDefaults: Partial<z.output<TSchema>>,
  source: NodeJS.ProcessEnv = process.env,
): z.output<TSchema> {
  const result = schema.safeParse(source);
  if (result.success) {
    return result.data;
  }
  if (shouldSkipEnvValidation(source)) {
    return { ...buildDefaults, ...source } as z.output<TSchema>;
  }
  throw result.error;
}
