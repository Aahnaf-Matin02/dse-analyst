import https from "https";
import http from "http";
import fs from "fs";
import path from "path";

async function fetchUrl(url, options = {}) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith("https") ? https : http;
    const req = lib.get(url, {
      headers: {
        "User-Agent": "DSE-Terminal-DataBackfill/1.0 (Capital Markets Research & Historical Analysis; contact: support@terminal.internal)",
        ...(options.headers || {})
      },
      timeout: 10000
    }, (res) => {
      let data = "";
      res.on("data", chunk => data += chunk);
      res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, body: data }));
    });
    req.on("error", reject);
    req.on("timeout", () => { req.destroy(); reject(new Error("Timeout")); });
  });
}

async function main() {
  console.log("=== PROBING CANDIDATE SOURCES ===");

  // Candidate 1: DSE Official Pages
  console.log("\n--- Candidate 1: DSE Official (dse.com.bd) ---");
  try {
    const res = await fetchUrl("https://www.dse.com.bd/data-archives");
    console.log("dse.com.bd/data-archives status:", res.status);
    console.log("body length:", res.body.length);
    // Find Next.js page data / props
    const nextDataMatch = res.body.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
    if (nextDataMatch) {
      console.log("Found __NEXT_DATA__ in data-archives");
    }
  } catch (err) {
    console.log("dse.com.bd/data-archives error:", err.message);
  }

  // Check company financial page on DSE
  try {
    const res = await fetchUrl("https://www.dse.com.bd/company/GP");
    console.log("dse.com.bd/company/GP status:", res.status, "length:", res.body.length);
    // Search for financial metrics: EPS, NAV, PE, etc.
    const hasEPS = res.body.includes("EPS") || res.body.includes("Earnings Per Share");
    const hasNAV = res.body.includes("NAV") || res.body.includes("Net Asset Value");
    const hasPE = res.body.includes("P/E") || res.body.includes("PE");
    console.log("DSE GP page indicators:", { hasEPS, hasNAV, hasPE });
    
    // Check if there is JSON data or table data
    const jsonMatch = res.body.match(/\{"company":\{[\s\S]*?\}\}/);
    if (jsonMatch) {
      console.log("Found company JSON in DSE GP page!");
    }
  } catch (err) {
    console.log("dse.com.bd/company/GP error:", err.message);
  }

  // Candidate 1: DSE Official company page structure
  console.log("\n--- Candidate 1: DSE Official (dse.com.bd/company/GP) details ---");
  try {
    const res = await fetchUrl("https://www.dse.com.bd/company/GP");
    // Look for financial tables, headings, or props
    // Let's see if there is JSON in script tags
    const scripts = res.body.match(/<script[^>]*>([\s\S]*?)<\/script>/g) || [];
    console.log(`Found ${scripts.length} script tags in dse.com.bd/company/GP`);
    for (const s of scripts) {
      if (s.includes("BASIC INFORMATION") || s.includes("EPS") || s.includes("NAV") || s.includes("financials") || s.includes("dividend")) {
        console.log("Script snippet with financial keywords:", s.slice(0, 300));
        break;
      }
    }
    // Check if there is server-rendered HTML table or text
    const textMatches = res.body.match(/(EPS|NAV|P\/E|Authorized Capital|Paid-up Capital|Market Cap|Net Asset Value)[^<]{0,100}/gi) || [];
    console.log("DSE text matches:", textMatches.slice(0, 10));
  } catch (err) {
    console.log("dse.com.bd error:", err.message);
  }

  // Candidate 2: biniyog.com.bd network analysis
  console.log("\n--- Candidate 2: biniyog.com.bd endpoints ---");
  try {
    // Check what endpoints exist on dse.biniyog.com.bd
    const biniyogHost = "https://dse.biniyog.com.bd";
    const testPaths = [
      "/api/market-status",
      "/api/is-after-market-hour",
      "/api/latest-share-price",
      "/api/latest-share-price-all",
      "/api/stocks",
      "/api/history/GP",
      "/api/price/GP"
    ];
    for (const p of testPaths) {
      try {
        const res = await fetchUrl(biniyogHost + p);
        console.log(`biniyog ${p} -> status: ${res.status}, length: ${res.body.length}, snippet: ${res.body.slice(0, 100)}`);
      } catch (e) {
        console.log(`biniyog ${p} -> error: ${e.message}`);
      }
    }
  } catch (err) {
    console.log("biniyog test error:", err.message);
  }

  // Candidate 3: bdshare source inspection
  console.log("\n--- Candidate 3: bdshare source analysis ---");
  try {
    const rawRes = await fetchUrl("https://raw.githubusercontent.com/sadman-sakib/bdshare/master/bdshare/stock/trading.py");
    console.log("bdshare trading.py status:", rawRes.status);
    if (rawRes.status === 200) {
      console.log("bdshare trading.py snippet:", rawRes.body.slice(0, 800));
    }
  } catch (err) {
    console.log("bdshare fetch error:", err.message);
  }

  // Candidate 4: Mendeley Dataset details
  console.log("\n--- Candidate 4: Mendeley Dataset (DOI 10.17632/5mww8rb9td.1) ---");
  try {
    const mendeleyRes = await fetchUrl("https://data.mendeley.com/api/datasets/5mww8rb9td/1");
    if (mendeleyRes.status === 200) {
      const parsed = JSON.parse(mendeleyRes.body);
      console.log("Mendeley keys:", Object.keys(parsed));
      console.log("Mendeley view:", JSON.stringify(parsed.view || {}).slice(0, 300));
      console.log("Mendeley files:", parsed.files ? parsed.files.length : "none");
      if (parsed.files) {
        parsed.files.forEach(f => console.log(`  File: ${f.name} (${f.size} bytes) -> ${f.download_url}`));
      }
    }
    // Also check direct doi link
    const doiRes = await fetchUrl("https://doi.org/10.17632/5mww8rb9td.1");
    console.log("DOI redirect status:", doiRes.status, "location:", doiRes.headers.location);
  } catch (err) {
    console.log("Mendeley error:", err.message);
  }

  // Candidate 5: Existing Investing.com CSVs
  console.log("\n--- Candidate 5: Existing Investing.com CSVs ---");
  const investingDir = "data/history/imports/investing/stocks";
  if (fs.existsSync(investingDir)) {
    const files = fs.readdirSync(investingDir);
    console.log(`Found ${files.length} CSV files in ${investingDir}`);
    const gpPath = path.join(investingDir, "GP.csv");
    if (fs.existsSync(gpPath)) {
      const content = fs.readFileSync(gpPath, "utf-8").trim().split("\n");
      console.log(`GP.csv has ${content.length} rows`);
      console.log("First 4 rows (header + 3 rows):");
      console.log(content.slice(0, 4).join("\n"));
      console.log("Last 3 rows:");
      console.log(content.slice(-3).join("\n"));
    }
  } else {
    console.log("Directory does not exist:", investingDir);
  }
}

main();
