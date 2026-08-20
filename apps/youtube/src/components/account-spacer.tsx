/**
 * The sign-in button / user menu is pinned to the viewport corner in the root
 * layout, above the navbar. This reserves the width it occupies so navbar
 * content never slides underneath it.
 */
export function AccountSpacer() {
  return <div aria-hidden className="order-first w-28 shrink-0 sm:order-last sm:w-20" />;
}
