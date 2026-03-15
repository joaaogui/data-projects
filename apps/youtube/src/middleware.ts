export { proxy as middleware } from "./proxy";

export const config = {
  matcher: [String.raw`/((?!_next/static|_next/image|favicon\.ico|favicon\.svg).*)`],
};
