"use client";

import { createContext, useContext } from "react";

const SignedInContext = createContext(false);

export function SignedInProvider({
  isSignedIn,
  children,
}: Readonly<{ isSignedIn: boolean; children: React.ReactNode }>) {
  return (
    <SignedInContext.Provider value={isSignedIn}>
      {children}
    </SignedInContext.Provider>
  );
}

export function useIsSignedIn() {
  return useContext(SignedInContext);
}
