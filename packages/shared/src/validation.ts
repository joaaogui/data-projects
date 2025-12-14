export interface ValidationResult {
  valid: boolean;
  error?: string;
  sanitized?: string;
}

export function createValidator(options: {
  allowedCharsRegex: RegExp;
  maxLength: number;
  fieldName: string;
}) {
  return function validate(
    value: string | null | undefined
  ): ValidationResult {
    if (!value || typeof value !== "string") {
      return { valid: false, error: `${options.fieldName} is required` };
    }

    const trimmed = value.trim();

    if (trimmed.length === 0) {
      return { valid: false, error: `${options.fieldName} cannot be empty` };
    }

    if (trimmed.length > options.maxLength) {
      return {
        valid: false,
        error: `${options.fieldName} too long (max ${options.maxLength} characters)`,
      };
    }

    if (!options.allowedCharsRegex.test(trimmed)) {
      return {
        valid: false,
        error: `${options.fieldName} contains invalid characters`,
      };
    }

    return { valid: true, sanitized: trimmed };
  };
}

export function getSafeErrorMessage(
  error: unknown,
  fallback: string,
  safeMessages: string[] = []
): string {
  if (process.env.NODE_ENV === "development") {
    return error instanceof Error ? error.message : fallback;
  }

  if (error instanceof Error) {
    if (safeMessages.some((msg) => error.message.includes(msg))) {
      return error.message;
    }
  }

  return fallback;
}
