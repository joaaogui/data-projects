import { createValidator, getSafeErrorMessage } from "@data-projects/shared";

export { getSafeErrorMessage };

                                          
export const validateArtistName = createValidator({
  allowedCharsRegex: /^[\w\s\-':.!?&()]+$/,
  maxLength: 200,
  fieldName: "Artist name",
});
