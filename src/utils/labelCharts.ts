/**
 * Recharts renders each chart as a focusable <svg role="application"> without an accessible name.
 * Name each one after the nearest preceding heading in its card, e.g. "Chart: Price chart — GP".
 */
function nearestHeading(el: Element): string | null {
  let node: Element | null = el;
  for (let depth = 0; node && depth < 8; depth++) {
    const h = node.querySelector("h1, h2, h3, h4");
    if (h && h.textContent?.trim()) return h.textContent.trim().replace(/\s+/g, " ").slice(0, 80);
    node = node.parentElement;
  }
  return null;
}

function labelAll(root: ParentNode) {
  root.querySelectorAll("svg.recharts-surface:not([aria-label])").forEach(svg => {
    const heading = nearestHeading(svg);
    svg.setAttribute("aria-label", heading ? `Chart: ${heading}` : "Chart");
  });
}

export function startChartLabeling() {
  if (typeof window === "undefined" || typeof MutationObserver === "undefined") return;
  let scheduled = false;
  const obs = new MutationObserver(() => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => { scheduled = false; labelAll(document); });
  });
  obs.observe(document.body, { childList: true, subtree: true });
  labelAll(document);
}
