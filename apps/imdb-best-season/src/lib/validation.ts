import { createValidator, getSafeErrorMessage, type ValidationResult } from "@data-projects/shared";

export { getSafeErrorMessage };

const ALLOWED_CHARS_REGEX = /^[\w\s\-':.!?&()]+$/;
const INVALID_CHARS_REGEX = /[^\w\s\-':.!?&()]/g;

function sanitizeTitle(title: string): string {
  return title.replace(INVALID_CHARS_REGEX, "").replace(/\s+/g, " ").trim();
}

const baseValidator = createValidator({
  allowedCharsRegex: ALLOWED_CHARS_REGEX,
  maxLength: 200,
  fieldName: "Title",
});

export function validateTitle(value: string | null | undefined): ValidationResult {
  if (!value || typeof value !== "string") {
    return { valid: false, error: "Title is required" };
  }

  const sanitized = sanitizeTitle(value);
  
  if (sanitized.length === 0) {
    return { valid: false, error: "Title cannot be empty" };
  }

  return baseValidator(sanitized);
}
