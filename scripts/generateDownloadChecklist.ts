// scripts/generateDownloadChecklist.ts
// Run: tsx scripts/generateDownloadChecklist.ts

import fs from "fs";
import path from "path";
import { INVESTING_URL_MAP } from "./investingUrlMap";
import { parseHistoryCSV, deriveCoverage } from "../server/repositories/historicalRepository";

const IMPORT_DIR  = path.join(process.cwd(), "data", "history", "imports", "investing", "stocks");
const CLEAN_DIR   = path.join(process.cwd(), "data", "history", "stocks");
const OUTPUT_HTML = path.join(process.cwd(), "data", "history", "imports", "download-checklist.html");

function main() {
  const all = Object.entries(INVESTING_URL_MAP);
  
  const readySymbols: string[] = [];
  const missingSymbols: typeof all = [];

  for (const [sym, info] of all) {
    const cleanPath = path.join(CLEAN_DIR, `${sym}.csv`);
    let isReady = false;
    if (fs.existsSync(cleanPath)) {
      try {
        const content = fs.readFileSync(cleanPath, "utf-8");
        const rows = parseHistoryCSV(content);
        const cov = deriveCoverage(sym, rows);
        if (cov) {
          const years = (new Date(cov.endDate).getTime() - new Date(cov.startDate).getTime()) / (365.25 * 24 * 3600 * 1000);
          const overlapsDsex = cov.startDate <= "2024-05-25" && cov.endDate >= "2026-05-01";
          if (years >= 2.0 && overlapsDsex) {
            isReady = true;
          }
        }
      } catch (err) {
        console.warn(`Failed parse during checklist check for ${sym}:`, err);
      }
    }
    
    if (isReady) {
      readySymbols.push(sym);
    } else {
      missingSymbols.push([sym, info]);
    }
  }

  const existingSet = new Set(readySymbols);
  const done    = all.filter(([sym]) =>  existingSet.has(sym));
  const missing = missingSymbols;

  // Dynamic status check for DSEX, DS30, and DSES indices
  const indices = ["DSEX", "DS30", "DSES"];
  const indicesStats = indices.map(symbol => {
    const filePath = path.join(process.cwd(), "data", "history", "indices", `${symbol}.csv`);
    let rows = 0;
    let firstDate = "-";
    let lastDate = "-";
    let years = 0;
    let statusColor = "red";
    let statusText = "Missing / Seeds Only";

    if (fs.existsSync(filePath)) {
      try {
        const content = fs.readFileSync(filePath, "utf-8");
        const lines = content.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
        if (lines.length > 1) {
          rows = lines.length - 1;
          const firstCols = lines[1].split(",");
          const lastCols = lines[lines.length - 1].split(",");
          firstDate = firstCols[0];
          lastDate = lastCols[0];
          if (firstDate && lastDate && firstDate !== "date" && lastDate !== "date" && !isNaN(new Date(firstDate).getTime())) {
            const first = new Date(firstDate);
            const last = new Date(lastDate);
            years = parseFloat(((last.getTime() - first.getTime()) / (365.25 * 24 * 3600 * 1000)).toFixed(1));
          }
        }
      } catch (err) {
        console.error(`Error reading ${symbol} clean data for checklist`, err);
      }
    }

    if (rows >= 1200) {
      statusColor = "green";
      statusText = "Full Coverage (5+ Years)";
    } else if (rows > 0) {
      statusColor = "amber";
      statusText = `Partial Coverage (${years} Years)`;
    }

    let url = "";
    if (symbol === "DSEX") url = "https://www.investing.com/indices/dhaka-stock-exchange-broad-historical-data";
    else if (symbol === "DS30") url = "https://www.investing.com/indices/dhaka-stock-exchange-30-historical-data";
    else if (symbol === "DSES") url = "https://www.investing.com/indices/dsex-shariah-historical-data";

    return { symbol, rows, firstDate, lastDate, years, statusColor, statusText, url };
  });

  // Group missing by sector
  const bySector: Record<string, typeof missing> = {};
  for (const [sym, info] of missing) {
    if (!bySector[info.sector]) bySector[info.sector] = [];
    bySector[info.sector].push([sym, info]);
  }

  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`  DSE Investing.com CSV Download Checklist`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`  ✅ Downloaded : ${done.length} stocks`);
  console.log(`  ⬇️  Remaining  : ${missing.length} stocks`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

  for (const [sector, entries] of Object.entries(bySector).sort()) {
    console.log(`\n  📂 ${sector} (${entries.length} remaining)`);
    for (const [sym, info] of entries) {
      console.log(`     ${sym.padEnd(14)} ${info.investingName}`);
      console.log(`                   ${info.url}`);
    }
  }

  // Build HTML
  const indicesBlocksHtml = `
    <div class="sector-block index-block" style="margin-bottom: 2.5rem; background: #fafbfe; border: 1px solid #ddecfa; padding: 1.5rem; border-radius: 12px;">
      <h3 style="color: #032d60; border-bottom: 2px solid #bcd4f0; padding-bottom: 0.75rem; margin-top: 0;">📉 Primary Market Index History</h3>
      
      <div style="background: #e6fdf4; border: 1px solid #a7f3d0; color: #047857; padding: 1rem; border-radius: 8px; margin-bottom: 1.5rem; font-family: monospace; font-size: 0.85rem; line-height: 1.4;">
        ℹ️ <strong>Coverage Info:</strong> DSEX/DS30/DSES cover from 2024-05-15 to today. Download 2024-05-15 &rarr; today data (~2.1 years) from Investing.com for all individual stocks to match the active market index benchmark range.
      </div>

      <table style="width: 100%;">
        <thead>
          <tr>
            <th>Status Indicator</th>
            <th>Index Symbol</th>
            <th>Row Count</th>
            <th>Extents Range</th>
            <th>Dynamic Coverage</th>
            <th>Manual Download Link</th>
          </tr>
        </thead>
        <tbody>
          ${indicesStats.map(stat => {
            const indicatorColor = stat.statusColor === 'green' ? '#10b981' : (stat.statusColor === 'amber' ? '#f59e0b' : '#ef4444');
            const bgClass = stat.statusColor === 'green' ? '#ecfdf5' : (stat.statusColor === 'amber' ? '#fffbeb' : '#fef2f2');
            const textClass = stat.statusColor === 'green' ? '#065f46' : (stat.statusColor === 'amber' ? '#92400e' : '#991b1b');
            return `
            <tr style="background: ${stat.statusColor === 'green' ? '#f0fdf4' : (stat.statusColor === 'amber' ? '#fefce8' : '#fffbeb')}">
              <td>
                <span style="display:inline-block; padding: 4px 10px; border-radius: 9999px; font-size: 0.75rem; font-weight: 700; background: ${bgClass}; color: ${textClass}">
                  ● ${stat.statusText}
                </span>
              </td>
              <td><code>${stat.symbol}</code></td>
              <td><strong>${stat.rows}</strong> rows</td>
              <td><code>${stat.firstDate}</code> to <code>${stat.lastDate}</code></td>
              <td><strong>${stat.years}</strong> Years</td>
              <td><a href="${stat.url}" target="_blank" style="font-weight: 600; color: #1e3a8a;">Manual Download CSV ↗</a></td>
            </tr>`;
          }).join("")}
        </tbody>
      </table>
    </div>`;

  const sectorBlocks = Object.entries(bySector).sort().map(([sector, entries]) => `
    <div class="sector-block">
      <h3>${sector} <span class="count">${entries.length} remaining</span></h3>
      <table>
        <thead><tr><th>✓</th><th>Symbol</th><th>Company</th><th>Link</th></tr></thead>
        <tbody>
          ${entries.map(([sym, info]) => `
          <tr>
            <td><input type="checkbox" id="chk-${sym}"></td>
            <td><code>${sym}</code></td>
            <td>${info.investingName}</td>
            <td><a href="${info.url}" target="_blank">Download CSV ↗</a></td>
          </tr>`).join("")}
        </tbody>
      </table>
    </div>`).join("");

  const doneList = done.map(([sym]) =>
    `<span class="done-badge">${sym}</span>`).join(" ");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>DSE CSV Download Checklist</title>
<style>
  body { font-family: system-ui,sans-serif; max-width: 960px; margin: 2rem auto; padding: 0 1rem; color: #1c1c1e; }
  h1   { font-size: 1.5rem; margin-bottom: 0.25rem; }
  .subtitle { color: #6b6560; font-size: 0.9rem; margin-bottom: 2rem; }
  .stats { display: flex; gap: 1rem; margin-bottom: 2rem; }
  .stat { background: #f5f0e8; padding: 1rem 1.5rem; border-radius: 10px; }
  .stat-n { font-size: 2rem; font-weight: 600; }
  .stat-n.green { color: #1a6b4a; }
  .stat-n.amber { color: #ba7517; }
  .stat-label { font-size: 0.8rem; color: #6b6560; }
  .sector-block { margin-bottom: 2rem; }
  h3   { font-size: 1rem; border-bottom: 1px solid #e8e0d0; padding-bottom: 0.5rem; }
  .count { font-size: 0.8rem; color: #6b6560; font-weight: 400; }
  table { width: 100%; border-collapse: collapse; font-size: 0.875rem; }
  th   { text-align: left; padding: 6px 8px; background: #faf7f2; font-size: 0.75rem; color: #6b6560; }
  td   { padding: 6px 8px; border-bottom: 1px solid #f0ebe0; }
  code { font-size: 0.8rem; background: #f0ebe0; padding: 2px 6px; border-radius: 4px; }
  a    { color: #1a6b4a; text-decoration: none; }
  a:hover { text-decoration: underline; }
  input[type="checkbox"] { width: 16px; height: 16px; cursor: pointer; }
  .done-section { margin-top: 2rem; padding: 1rem; background: #eaf3de; border-radius: 10px; }
  .done-badge { display: inline-block; font-size: 0.7rem; background: #1a6b4a; color: #fff; padding: 2px 6px; border-radius: 4px; margin: 2px; font-family: monospace; }
  .instruction { background: #e6f1fb; border-left: 3px solid #185fa5; padding: 1rem; border-radius: 0 8px 8px 0; margin-bottom: 2rem; font-size: 0.875rem; }
  .instruction ol { margin: 0.5rem 0 0 1.25rem; }
  .instruction li { margin-bottom: 0.25rem; }
</style>
</head>
<body>
<h1>DSE Investing.com CSV Download Checklist</h1>
<p class="subtitle">Generated: ${new Date().toLocaleString()} &middot;
  Save each CSV as <code>{SYMBOL}.csv</code> in
  <code>data/history/imports/investing/stocks/</code> (or /indices/ for market index history)</p>

<div class="stats">
  <div class="stat"><div class="stat-n green">${done.length}</div><div class="stat-label">CSVs downloaded</div></div>
  <div class="stat"><div class="stat-n amber">${missing.length}</div><div class="stat-label">Still needed</div></div>
  <div class="stat"><div class="stat-n">${all.length}</div><div class="stat-label">Total mapped</div></div>
</div>

<div class="instruction">
  <strong>How to download each CSV:</strong>
  <ol>
    <li>Click "Download CSV ↗" — opens the stock or index historical data page on Investing.com</li>
    <li>Set date range: <strong>2024-05-15 → today</strong> (~2.1 years)</li>
    <li>Click <strong>Download Data</strong> (top-right of the price table)</li>
    <li>Rename the file exactly as <strong>{SYMBOL}.csv</strong></li>
    <li>Move to: <code>data/history/imports/investing/stocks/</code> (or <code>data/history/imports/investing/indices/</code> for core indexes)</li>
    <li>After each batch: run <code>npm run import:investing-history</code></li>
    <li>Regenerate this checklist: <code>npm run checklist</code></li>
  </ol>
</div>

${indicesBlocksHtml}

${sectorBlocks}

<div class="done-section">
  <strong>✅ Already downloaded (${done.length}):</strong><br><br>
  ${doneList}
</div>
</body>
</html>`;

  fs.mkdirSync(path.dirname(OUTPUT_HTML), { recursive: true });
  fs.writeFileSync(OUTPUT_HTML, html, "utf-8");
  console.log(`\n✅ HTML checklist → ${OUTPUT_HTML}`);
  console.log(`   Open in browser to use the clickable download links.\n`);
}

main();
