import { describe, it, expect } from "vitest";
import { parseLegacyPrices, parseLegacyMarket } from "../services/dse/dseLegacyLive";

// Shapes copied from old.dsebd.org on 3 Nov 2026 (trimmed)
const PRICES = `<table><tr><th>#</th><th>TRADING CODE</th><th>LTP*</th><th>HIGH</th><th>LOW</th><th>CLOSEP*</th><th>YCP*</th><th>CHANGE</th><th>TRADE</th><th>VALUE (mn)</th><th>VOLUME</th></tr>
<tr><td>1</td><td>1JANATAMF</td><td>3.3</td><td>3.4</td><td>3.3</td><td>0</td><td>3.3</td><td>0</td><td>59</td><td>1.022</td><td>309,685</td></tr>
<tr><td>2</td><td>RECKITTBEN</td><td>3,210</td><td>3,215</td><td>3,200</td><td>0</td><td>3,211</td><td>-1</td><td>12</td><td>0.5</td><td>150</td></tr></table>`;

const HOME = `<div>Market Status: Open Visit DSE New Website</div><div>Last update on Nov 03, 2026 at 11:04 AM</div>
<div>DSE X Index</div><div>5312.92708</div><div>-20.65155</div><div>-0.3872%</div>
<div>DSE S Index 1035.25809 -2.55403 -0.2461%</div><div>DS30 Index 2029.43902 -12.69949 -0.62187%</div>
<div>Total Trade Total Volume Total Value in Taka (mn) 46106 54606186 1546.366</div>
<div>Issues Advanced Issues declined Issues Unchanged 118 184 76</div>
<div>Total Trade Total Volume Total Value in Taka (mn) Total Market Cap. in Taka (mn) 02-11-2026 164394 170158951 4182.236</div>
<div>DSE X Index 5333.57863 -51.56797 -0.9576%</div>`;

describe("old.dsebd.org live parsers", () => {
  it("reads every row of the latest share price table, including thousands separators", () => {
    const rows = parseLegacyPrices(PRICES);
    expect(rows).toHaveLength(2);
    expect(rows[1]).toMatchObject({ code: "RECKITTBEN", ltp: 3210, high: 3215, ycp: 3211, volume: 150, trades: 12 });
  });

  it("reads the current block only: indices, totals, breadth, status and DSE's own trade time", () => {
    const m = parseLegacyMarket(HOME);
    expect(m.indices.DSEX).toMatchObject({ value: 5312.92708, change: -20.65155, changePercent: -0.3872 });
    expect(m.indices.DS30?.value).toBe(2029.43902);
    expect(m.totals).toMatchObject({ trades: 46106, volume: 54606186, turnover: 1546.366, tradeTime: "Nov 03, 2026 at 11:04 AM" });
    expect(m.breadth).toEqual({ advanced: 118, declined: 184, unchanged: 76, traded: 378 });
    expect(m.session.isOpen).toBe(true);
  });

  it("returns no index values rather than guessing when the block is missing", () => {
    const m = parseLegacyMarket("<html>maintenance</html>");
    expect(m.indices.DSEX).toBeUndefined();
    expect(m.session.isOpen).toBe(false);
  });
});
