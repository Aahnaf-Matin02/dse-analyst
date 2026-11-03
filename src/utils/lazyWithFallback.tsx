import React, { Suspense, lazy } from "react";
import { SkeletonCard } from "../components/ui/StatusPrimitives";

/**
 * Route/section-level code splitting: loads a component's code on first render and shows a
 * skeleton (with a screen-reader "Loading…" message) meanwhile.
 */
export function lazyWithFallback<P extends object>(loader: () => Promise<{ default: React.ComponentType<P> }>, label = "Loading section") {
  const Lazy = lazy(loader);
  const Wrapped = (props: P) => (
    <Suspense fallback={<SkeletonCard lines={4} label={label} />}>
      <Lazy {...(props as any)} />
    </Suspense>
  );
  return Wrapped;
}
