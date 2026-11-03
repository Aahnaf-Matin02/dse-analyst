import https from "https";
import fs from "fs";

function fetchUrl(url, headers = {}) {
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: {
        "User-Agent": "DSE-Terminal-DataBackfill/1.0 (Capital Markets Research & Historical Analysis; contact: support@terminal.internal)",
        ...headers
      }
    }, (res) => {
      let data = "";
      res.on("data", chunk => data += chunk);
      res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, body: data }));
    }).on("error", reject);
  });
}

async function testMendeley() {
  console.log("=== Testing Mendeley Dataset ===");
  try {
    const res = await fetchUrl("https://data.mendeley.com/datasets/5mww8rb9td/1");
    console.log("Mendeley HTML status:", res.status, "len:", res.body.length);
    const scriptMatches = res.body.match(/<script[^>]*>([\s\S]*?)<\/script>/g) || [];
    for (const s of scriptMatches) {
      if (s.includes("5mww8rb9td") && s.includes("license")) {
        const jsonMatch = s.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          try {
            const data = JSON.parse(jsonMatch[0]);
            console.log("Mendeley schema name:", data.name);
            console.log("Mendeley schema license:", data.license);
            console.log("Mendeley schema datePublished:", data.datePublished);
            console.log("Mendeley schema url:", data.url);
          } catch (e) {}
        }
      }
      if (s.includes("public-files") || s.includes("download_url") || s.includes("files")) {
        const downloadMatches = s.match(/https:\/\/[^"'\s]+\/files\/[^"'\s]+/g) || [];
        if (downloadMatches.length > 0) {
          console.log("Found direct file download URLs in script:", downloadMatches.slice(0, 5));
        }
      }
    }
    // Search raw HTML for direct file links
    const directFileMatches = res.body.match(/\/public-files\/datasets\/5mww8rb9td\/files\/[a-zA-Z0-9-]+/g) || [];
    console.log("Direct public file paths:", Array.from(new Set(directFileMatches)));
  } catch (err) {
    console.error("Mendeley error:", err.message);
  }
}

async function testBiniyog() {
  console.log("\n=== Testing biniyog.com.bd ===");
  try {
    const res = await fetchUrl("https://platform.biniyog.com.bd/assets/latest-share-price-CsU7k55p.js");
    console.log("biniyog latest-share-price-CsU7k55p.js length:", res.body.length);
    const urls = res.body.match(/https?:\/\/[^\s"'`)]+/g) || [];
    console.log("URLs in chunk:", Array.from(new Set(urls)));
    const apis = res.body.match(/\/api\/[a-zA-Z0-9_.-]+/g) || [];
    console.log("API paths in chunk:", Array.from(new Set(apis)));
    // Let's print snippets around any network calls
    const axiosMatches = res.body.match(/\.(get|post)\(["']([^"']+)["']/g) || [];
    console.log("Axios/fetch calls in chunk:", axiosMatches);
  } catch (err) {
    console.error("Biniyog error:", err.message);
  }
}

async function testBdshare() {
  console.log("\n=== Testing bdshare ===");
  try {
    // Check pypi releases and files
    const res = await fetchUrl("https://pypi.org/pypi/bdshare/json");
    if (res.status === 200) {
      const data = JSON.parse(res.body);
      console.log("bdshare release:", data.info.version);
      console.log("bdshare project_urls:", data.info.project_urls);
    }
    // Check github repository
    const ghRes = await fetchUrl("https://api.github.com/repos/sadman-sakib/bdshare");
    console.log("GitHub API status:", ghRes.status);
    if (ghRes.status === 200) {
      const ghData = JSON.parse(ghRes.body);
      console.log("GitHub repo:", ghData.full_name, "license:", ghData.license?.name);
    }
  } catch (err) {
    console.error("bdshare error:", err.message);
  }
}

async function main() {
  await testMendeley();
  await testBiniyog();
  await testBdshare();
}

main();
