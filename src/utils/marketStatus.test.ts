import { describe, it, expect } from "vitest";
import { describeAsOf, feedState } from "./marketStatus";

describe("market status wording", () => {
  it("never calls closed-market data live", () => {
    expect(feedState({ status: "LIVE", session: { isOpen: false, phase: "closed", sessionDate: "2026-10-04" } })).toBe("closed");
    expect(feedState({ status: "DELAYED" })).toBe("delayed");
    expect(feedState({ status: "DISCONNECTED" })).toBe("offline");
    expect(feedState({ status: "LIVE", session: { isOpen: true, phase: "open", sessionDate: "2026-10-05" } })).toBe("live");
  });

  it("uses DSE's session date, not the next day's pre-opening stamp", () => {
    // Observed 5 Oct 2026 before the open: tradeTime already says Oct 05 8:36 AM, sessionDate is still 4 Oct
    const p = { status: "LIVE", totals: { tradeTime: "Oct 05, 2026 at 8:36 AM" }, session: { isOpen: false, phase: "closed", sessionDate: "2026-10-04" } };
    expect(describeAsOf(p)).toBe("last session 4 Oct 2026");
  });

  it("adds the closing time when it belongs to the same session", () => {
    const p = { status: "LIVE", totals: { tradeTime: "Oct 04, 2026 at 2:40 PM" }, session: { isOpen: false, phase: "closed", sessionDate: "2026-10-04" } };
    expect(describeAsOf(p)).toBe("last session 4 Oct 2026, closed 2:40 PM");
  });

  it("shows the time of day while the market is open", () => {
    const p = { status: "LIVE", totals: { tradeTime: "Oct 05, 2026 at 11:05 AM" }, session: { isOpen: true, phase: "open", sessionDate: "2026-10-05" } };
    expect(describeAsOf(p)).toBe("as of 11:05 AM (Dhaka)");
  });
});
