import React, { Suspense, lazy } from "react";
import { TerminalLoader } from "../components/ui/TerminalLoader";

/**
 * Route/section-level code splitting: loads a component's code on first render and shows a
 * terminal-style loader (animated, with a glossary tip and a screen-reader status) meanwhile.
 */
export function lazyWithFallback<P extends object>(loader: () => Promise<{ default: React.ComponentType<P> }>, label = "Loading section") {
  const Lazy = lazy(loader);
  const Wrapped = (props: P) => (
    <Suspense fallback={<TerminalLoader label={label} />}>
      <Lazy {...(props as any)} />
    </Suspense>
  );
  return Wrapped;
}
