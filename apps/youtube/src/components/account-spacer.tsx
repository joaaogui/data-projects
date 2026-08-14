/**
 * The sign-in button / user menu is pinned to the viewport corner in the root
 * layout, above the navbar. This reserves the width it occupies so navbar
 * content never slides underneath it.
 */
export function AccountSpacer() {
  return <div aria-hidden className="w-16 shrink-0 sm:w-20" />;
}
