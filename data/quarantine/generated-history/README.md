# Quarantined: generated price history — do not use

Everything in this folder was **generated, not downloaded**, and was removed from `data/history` on
2026-10-05. It is kept only so the change is auditable. Nothing in the app reads this folder.

| What | Why it is not real |
|---|---|
| `stocks/*.csv`, `indices/*.csv` (labelled `InvestingCSV`) | Produced by `generateSimulatedCSV()` in `scripts/import-investing-history.ts` (a `Math.random()` walk, ±1.2%/day). Checked against LankaBD for GP and 1JANATAMF on 481 overlapping dates: 0/481 and 6/481 closes match, daily-change correlation 0.075 / 0.031, and 55 dates that were not DSE trading days (e.g. Eid 16–18 Jun 2024). |
| `imports/investing/**` | The "raw Investing.com exports" were written by the same generator in Investing.com's CSV format. |
| `root/GP.csv`, `BATBC.csv`, `SQURPHARMA.csv`, `imports/dse-history.csv` | Hand-written sample rows; e.g. GP 2026-05-20 close 249.50 vs real DSE 237.80. |
| `dse/historical-GP.json`, `market_index_history.json` | Derived from the generated CSVs above. |
| `processed/*`, `errors/*`, `source-map/*` | Summaries and logs of the generated imports. |
| `stocks/AMCL(PRAN)__runtime-written.csv` | Written at runtime by an old read path that has since been removed. |

Real history now comes from the official DSE day-end archive via `npm run backfill:history`
(label `DSE_OFFICIAL`).
