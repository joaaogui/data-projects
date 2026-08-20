import { createValidator } from "@data-projects/shared";

export { getSafeErrorMessage } from "@data-projects/shared";

export const validateSearchQuery = createValidator({
  allowedCharsRegex: /^[\w\s\-':.!?&()@#]+$/,
  maxLength: 100,
  fieldName: "Search query",
});

export const validateChannelId = createValidator({
  allowedCharsRegex: /^[a-zA-Z0-9_-]+$/,
  maxLength: 50,
  fieldName: "Channel ID",
});

export function validateVideoId(value: string | null | undefined) {
  if (!value || !/^[a-zA-Z0-9_-]{11}$/.test(value)) {
    return { valid: false, error: "Invalid video ID" };
  }
  return { valid: true, sanitized: value };
}
