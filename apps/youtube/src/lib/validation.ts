import { createValidator, getSafeErrorMessage } from "@data-projects/shared";

export { getSafeErrorMessage };

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
