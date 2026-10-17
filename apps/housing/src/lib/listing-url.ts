const ALLOWED_LISTING_HOST_REGEX =
  /^(?:www\.)?(?:quintoandar\.com\.br|zapimoveis\.com\.br|vivareal\.com\.br|netimoveis\.com(?:\.br)?|imovelweb\.com\.br)$/i;

export function isValidAllowedListingUrl(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== "https:") return false;
    return ALLOWED_LISTING_HOST_REGEX.test(parsed.hostname);
  } catch {
    return false;
  }
}
