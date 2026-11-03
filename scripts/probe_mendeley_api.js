import https from "https";

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

async function run() {
  const res = await fetchUrl("https://data.mendeley.com/datasets/5mww8rb9td/1");
  const scripts = res.body.match(/src="([^"]+\.js)"/g) || [];
  console.log("Mendeley scripts:", scripts);

  // Try standard Mendeley file endpoints:
  const testEndpoints = [
    "https://data.mendeley.com/api/datasets/5mww8rb9td/1/files",
    "https://data.mendeley.com/api/datasets/5mww8rb9td/files",
    "https://api.mendeley.com/datasets/5mww8rb9td/files",
    "https://data.mendeley.com/public-files/datasets/5mww8rb9td/files",
    "https://data.mendeley.com/archived-files/datasets/5mww8rb9td/1",
    "https://data.mendeley.com/public-files/datasets/5mww8rb9td/files/zip"
  ];
  for (const ep of testEndpoints) {
    try {
      const epRes = await fetchUrl(ep);
      console.log(`${ep} -> status: ${epRes.status}, len: ${epRes.body.length}, snippet: ${epRes.body.slice(0, 120)}`);
    } catch (e) {
      console.log(`${ep} -> error: ${e.message}`);
    }
  }
}

run();
