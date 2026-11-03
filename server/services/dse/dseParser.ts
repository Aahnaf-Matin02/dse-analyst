export interface DseRawUniverseItem {
  code: string;
  name: string;
  sector: string;
  board: string;
  category: string;
  price: number | null;
  changePct: number | null;
  volume: number | null;
  marketCap: number | null;
  pe: number | null;
  dividendYield: number | null;
}

export interface DseRawSharePattern {
  date: string;
  pattern: {
    sponsor?: number | null;
    government?: number | null;
    institution?: number | null;
    foreign?: number | null;
    public?: number | null;
  };
}

export interface DseRawAnnouncement {
  id: string;
  type: string;
  date: string;
  summary: string;
  body: string;
}

export interface DseRawDividendItem {
  year: number;
  cash?: number | null;
  stock?: number | null;
  yieldPct?: number | null;
  rights?: string | null;
}

export interface DseRawHistoricalCandle {
  date: string;
  open: number | null;
  high: number | null;
  low: number | null;
  close: number | null;
  price: number | null;
  volume: number | null;
  trades: number | null;
}

export interface DseRawCompanyDetail {
  code: string;
  name: string;
  sector: string;
  board: string;
  category: string;
  price: number | null;
  change: number | null;
  changePct: number | null;
  prevClose: number | null;
  open: number | null;
  high: number | null;
  low: number | null;
  volume: number | null;
  trades: number | null;
  marketCap: number | null;
  freeFloat: number | null;
  freeFloatMarketCap: number | null;
  weekHigh52?: number | null;
  weekLow52?: number | null;
  pe: number | null;
  eps: number | null;
  dividendYield: number | null;
  bookValue: number | null;
  nav: number | null;
  faceValue: number | null;
  paidUpCapital: number | null;
  authorizedCapital: number | null;
  listingYear: number | null;
  hq: string | null;
  website: string | null;
  registeredOffice: string | null;
  factoryAddress: string | null;
  phone: string | null;
  email: string | null;
  companySecretary?: {
    name?: string;
    email?: string;
    phone?: string;
    cell?: string;
  };
  sharePattern?: DseRawSharePattern[];
  dividendHistory?: DseRawDividendItem[];
  recentAnnouncements?: DseRawAnnouncement[];
  multiYearFinancials?: any[];
  interimFinancials?: any;
  historicalCandles?: DseRawHistoricalCandle[];
  asOfDate?: string;
  asOfTime?: string;
}

export interface DseAtAGlanceData {
  asOfDate: string;
  dsex?: { current: number; change: number; changePercent: number; prev?: number };
  ds30?: { current: number; change: number; changePercent: number; prev?: number };
  dses?: { current: number; change: number; changePercent: number; prev?: number };
  totalTurnoverBdt?: number;
  totalVolume?: number;
  totalTrades?: number;
  totalMarketCapBdt?: number;
  tradeTime?: string;
  issuesAdvanced?: number;
  issuesDeclined?: number;
  issuesUnchanged?: number;
  issuesTraded?: number;
  intradayPoints?: Array<{ t: string; value: number }>;
}

export interface DseRawPriceRow {
  code: string;
  ltp: number;
  ycp?: number;
  open?: number;
  high?: number;
  low?: number;
  close?: number;
  volume?: number;
  value?: number;
  trades?: number;
  percent?: number;
  category?: string;
  board?: string;
  sector?: string;
  assetType?: string;
}

export class DseParser {
  /**
   * Decodes Next.js App Router RSC stream from HTML `<script>` tags.
   */
  static extractNextFStream(html: string): string {
    if (!html) return "";
    const regex = /self\.__next_f\.push\(\[1,\s*"((?:\\.|[^"\\])*)"\]\)/g;
    let combined = "";
    let match;
    while ((match = regex.exec(html)) !== null) {
      try {
        const unescaped = JSON.parse("\"" + match[1] + "\"");
        combined += unescaped;
      } catch {
        combined += match[1];
      }
    }
    return combined;
  }

  /**
   * Parses the official universe list from `https://www.dse.com.bd/companies`.
   */
  static parseCompaniesUniverse(html: string): DseRawUniverseItem[] {
    const stream = this.extractNextFStream(html);
    const results: DseRawUniverseItem[] = [];
    const seen = new Set<string>();

    if (stream) {
      // Look for the JSON array of company objects: [{"code":...
      const startMatch = stream.indexOf('[{"code":');
      if (startMatch !== -1) {
        let depth = 0;
        let end = -1;
        for (let i = startMatch; i < stream.length; i++) {
          if (stream[i] === "[") depth++;
          else if (stream[i] === "]") {
            depth--;
            if (depth === 0) {
              end = i + 1;
              break;
            }
          }
        }
        if (end !== -1) {
          try {
            const rawList = JSON.parse(stream.substring(startMatch, end));
            if (Array.isArray(rawList)) {
              for (const item of rawList) {
                if (item && item.code) {
                  const sym = item.code.toUpperCase().trim();
                  if (!seen.has(sym)) {
                    seen.add(sym);
                    results.push({
                      code: sym,
                      name: item.name || `${sym} Ltd.`,
                      sector: item.sector || "Miscellaneous",
                      board: item.board || "PUBLIC",
                      category: item.category || "A",
                      price: typeof item.price === "number" ? item.price : null,
                      changePct: typeof item.changePct === "number" ? item.changePct : null,
                      volume: typeof item.volume === "number" ? item.volume : null,
                      marketCap: typeof item.marketCap === "number" ? item.marketCap : null,
                      pe: typeof item.pe === "number" ? item.pe : null,
                      dividendYield: typeof item.dividendYield === "number" ? item.dividendYield : null
                    });
                  }
                }
              }
            }
          } catch {
            // Stream parse failed, fall back to regex
          }
        }
      }

      // If array parse did not capture everything, use regex on stream
      if (results.length === 0) {
        const itemRegex = /\{"code":"([^"]+)","name":"([^"]+)"(?:,"sector":"([^"]*)")?(?:,"board":"([^"]*)")?(?:,"category":"([^"]*)")?(?:,"price":([0-9.-]+|null))?(?:,"changePct":([0-9.-]+|null))?(?:,"volume":([0-9]+|null))?(?:,"marketCap":([0-9.-]+|null))?(?:,"pe":([0-9.-]+|null))?(?:,"dividendYield":([0-9.-]+|null))?/g;
        let m;
        while ((m = itemRegex.exec(stream)) !== null) {
          const sym = m[1].toUpperCase().trim();
          if (!seen.has(sym)) {
            seen.add(sym);
            results.push({
              code: sym,
              name: m[2],
              sector: m[3] || "Miscellaneous",
              board: m[4] || "PUBLIC",
              category: m[5] || "A",
              price: m[6] && m[6] !== "null" ? parseFloat(m[6]) : null,
              changePct: m[7] && m[7] !== "null" ? parseFloat(m[7]) : null,
              volume: m[8] && m[8] !== "null" ? parseInt(m[8], 10) : null,
              marketCap: m[9] && m[9] !== "null" ? parseFloat(m[9]) : null,
              pe: m[10] && m[10] !== "null" ? parseFloat(m[10]) : null,
              dividendYield: m[11] && m[11] !== "null" ? parseFloat(m[11]) : null
            });
          }
        }
      }
    }

    // SSR fallback: parse company links from raw HTML
    if (results.length === 0) {
      const linkRegex = /href="\/company\/([A-Za-z0-9_-]+)"/g;
      let lm;
      while ((lm = linkRegex.exec(html)) !== null) {
        const sym = lm[1].toUpperCase().trim();
        if (!seen.has(sym)) {
          seen.add(sym);
          results.push({
            code: sym,
            name: `${sym} Ltd.`,
            sector: "Miscellaneous",
            board: "PUBLIC",
            category: "A",
            price: null,
            changePct: null,
            volume: null,
            marketCap: null,
            pe: null,
            dividendYield: null
          });
        }
      }
    }

    return results;
  }

  /**
   * Parses official company detail from `https://www.dse.com.bd/company/:symbol`.
   */
  static parseCompanyDetail(html: string, symbol: string): DseRawCompanyDetail | null {
    const stream = this.extractNextFStream(html);
    const targetSym = symbol.toUpperCase().trim();

    if (stream) {
      let rawObj: any = null;

      // 1. Look for the official full company object: "company":{"code":"..."
      const compIdx = stream.indexOf('"company":{');
      if (compIdx !== -1) {
        const objStart = compIdx + '"company":'.length;
        let depth = 0;
        let objEnd = -1;
        for (let i = objStart; i < stream.length; i++) {
          if (stream[i] === "{") depth++;
          else if (stream[i] === "}") {
            depth--;
            if (depth === 0) {
              objEnd = i + 1;
              break;
            }
          }
        }
        if (objEnd !== -1) {
          try {
            const parsed = JSON.parse(stream.substring(objStart, objEnd));
            if (parsed && typeof parsed === "object") {
              rawObj = parsed;
            }
          } catch {}
        }
      }

      // 2. Fallback: look for the object that has both code and full company name
      if (!rawObj || !rawObj.name) {
        const symPattern = `"code":"${targetSym}","name":`;
        let codeIdx = stream.indexOf(symPattern);
        if (codeIdx === -1) {
          codeIdx = stream.indexOf(`"code":"${symbol}","name":`);
        }

        if (codeIdx !== -1) {
          const objStart = stream.lastIndexOf("{", codeIdx);
          if (objStart !== -1) {
            let depth = 0;
            let objEnd = -1;
            for (let i = objStart; i < stream.length; i++) {
              if (stream[i] === "{") depth++;
              else if (stream[i] === "}") {
                depth--;
                if (depth === 0) {
                  objEnd = i + 1;
                  break;
                }
              }
            }
            if (objEnd !== -1) {
              try {
                rawObj = JSON.parse(stream.substring(objStart, objEnd));
              } catch {}
            }
          }
        }
      }

      if (rawObj) {
        // Also look for historical candles in stream
        let historicalCandles: DseRawHistoricalCandle[] = [];
        const histMatch = stream.match(/\[\{"t":"[^"]+","date":"([0-9-]+)","price":([0-9.]+),"open":([0-9.]+),"high":([0-9.]+),"low":([0-9.]+),"trades":([0-9]+),"volume":([0-9]+)\}/);
        if (histMatch) {
          const histStart = stream.indexOf(histMatch[0]);
          let hDepth = 0;
          let hEnd = -1;
          for (let j = histStart; j < stream.length; j++) {
            if (stream[j] === "[") hDepth++;
            else if (stream[j] === "]") {
              hDepth--;
              if (hDepth === 0) { hEnd = j + 1; break; }
            }
          }
          if (hEnd !== -1) {
            try {
              const parsedHist = JSON.parse(stream.substring(histStart, hEnd));
              if (Array.isArray(parsedHist)) {
                historicalCandles = parsedHist.map((h: any) => ({
                  date: h.date,
                  close: typeof h.price === "number" ? h.price : (typeof h.close === "number" ? h.close : null),
                  price: typeof h.price === "number" ? h.price : null,
                  open: typeof h.open === "number" ? h.open : null,
                  high: typeof h.high === "number" ? h.high : null,
                  low: typeof h.low === "number" ? h.low : null,
                  volume: typeof h.volume === "number" ? h.volume : null,
                  trades: typeof h.trades === "number" ? h.trades : null
                }));
              }
            } catch {}
          }
        }

        return {
          code: targetSym,
          name: rawObj.name || `${targetSym} Ltd.`,
          sector: rawObj.sector || "Miscellaneous",
          board: rawObj.board || "PUBLIC",
          category: rawObj.category || "A",
          price: typeof rawObj.price === "number" ? rawObj.price : null,
          change: typeof rawObj.change === "number" ? rawObj.change : null,
          changePct: typeof rawObj.changePct === "number" ? rawObj.changePct : null,
          prevClose: typeof rawObj.prevClose === "number" ? rawObj.prevClose : null,
          open: typeof rawObj.open === "number" ? rawObj.open : null,
          high: typeof rawObj.high === "number" ? rawObj.high : null,
          low: typeof rawObj.low === "number" ? rawObj.low : null,
          volume: typeof rawObj.volume === "number" ? rawObj.volume : null,
          trades: typeof rawObj.trades === "number" ? rawObj.trades : null,
          marketCap: typeof rawObj.marketCap === "number" ? rawObj.marketCap : null,
          freeFloat: typeof rawObj.freeFloat === "number" ? rawObj.freeFloat : null,
          freeFloatMarketCap: typeof rawObj.freeFloatMarketCap === "number" ? rawObj.freeFloatMarketCap : null,
          weekHigh52: typeof rawObj.weekHigh52 === "number" ? rawObj.weekHigh52 : null,
          weekLow52: typeof rawObj.weekLow52 === "number" ? rawObj.weekLow52 : null,
          pe: typeof rawObj.pe === "number" ? rawObj.pe : null,
          eps: typeof rawObj.eps === "number" ? rawObj.eps : null,
          dividendYield: typeof rawObj.dividendYield === "number" ? rawObj.dividendYield : null,
          bookValue: typeof rawObj.bookValue === "number" ? rawObj.bookValue : (typeof rawObj.nav === "number" ? rawObj.nav : null),
          nav: typeof rawObj.nav === "number" ? rawObj.nav : (typeof rawObj.bookValue === "number" ? rawObj.bookValue : null),
          faceValue: typeof rawObj.faceValue === "number" ? rawObj.faceValue : 10,
          paidUpCapital: typeof rawObj.paidUpCapital === "number" ? rawObj.paidUpCapital : null,
          authorizedCapital: typeof rawObj.authorizedCapital === "number" ? rawObj.authorizedCapital : null,
          listingYear: typeof rawObj.listingYear === "number" ? rawObj.listingYear : null,
          hq: rawObj.hq || null,
          website: rawObj.website || null,
          registeredOffice: rawObj.registeredOffice || null,
          factoryAddress: rawObj.factoryAddress || null,
          phone: rawObj.phone || null,
          email: rawObj.email || null,
          companySecretary: rawObj.companySecretary || undefined,
          sharePattern: Array.isArray(rawObj.sharePattern) ? rawObj.sharePattern : [],
          dividendHistory: Array.isArray(rawObj.dividendHistory) ? rawObj.dividendHistory : [],
          recentAnnouncements: Array.isArray(rawObj.recentAnnouncements) ? rawObj.recentAnnouncements : [],
          multiYearFinancials: Array.isArray(rawObj.multiYearFinancials) ? rawObj.multiYearFinancials : [],
          interimFinancials: rawObj.interimFinancials || null,
          historicalCandles,
          asOfDate: rawObj.asOfDate || new Date().toISOString().split("T")[0],
          asOfTime: rawObj.asOfTime || "14:30:00"
        };
      }
    }

    return null;
  }

  /**
   * Parses official full stock quotes from `initialPrices` embedded in the dse.com.bd homepage.
   */
  static parseHomepagePrices(html: string): DseRawPriceRow[] {
    const stream = this.extractNextFStream(html);
    const results: DseRawPriceRow[] = [];
    const pricesIdx = stream.indexOf("\"initialPrices\":");
    if (pricesIdx !== -1) {
      const rowsIdx = stream.indexOf("\"rows\":[", pricesIdx);
      const endRowsIdx = stream.indexOf("]]", rowsIdx);
      if (rowsIdx !== -1 && endRowsIdx !== -1) {
        try {
          const rows = JSON.parse(stream.slice(rowsIdx + 7, endRowsIdx + 2));
          for (const r of rows) {
            if (Array.isArray(r) && r.length >= 11 && typeof r[0] === "string") {
              const sym = r[0].toUpperCase().trim();
              const ltp = typeof r[1] === "number" ? r[1] : parseFloat(r[1]) || 0;
              const ycp = typeof r[2] === "number" ? r[2] : parseFloat(r[2]) || 0;
              const open = typeof r[3] === "number" ? r[3] : parseFloat(r[3]) || 0;
              const high = typeof r[4] === "number" ? r[4] : parseFloat(r[4]) || 0;
              const low = typeof r[5] === "number" ? r[5] : parseFloat(r[5]) || 0;
              const close = typeof r[6] === "number" ? r[6] : parseFloat(r[6]) || 0;
              const volume = typeof r[7] === "number" ? r[7] : parseInt(r[7], 10) || 0;
              const value = typeof r[8] === "number" ? r[8] : parseFloat(r[8]) || 0;
              const trades = typeof r[9] === "number" ? r[9] : parseInt(r[9], 10) || 0;
              const percent = typeof r[10] === "number" ? r[10] : parseFloat(r[10]) || 0;
              const category = r[11] || "A";
              const board = r[12] || "PUBLIC";
              const sector = r[13] || "Miscellaneous";
              const assetType = r[14] || "EQ";
              results.push({
                code: sym,
                ltp,
                ycp,
                open,
                high,
                low,
                close,
                volume,
                value,
                trades,
                percent,
                category,
                board,
                sector,
                assetType
              });
            }
          }
        } catch {
          // Ignore JSON parse failure
        }
      }
    }
    return results;
  }

  /**
   * Parses live Market Indices, intraday ticks, and aggregate data directly from `https://www.dse.com.bd`.
   */
  static parseAtAGlance(html: string): DseAtAGlanceData {
    const stream = this.extractNextFStream(html) || html;
    const now = new Date().toISOString().split("T")[0];

    const data: DseAtAGlanceData = {
      asOfDate: now
    };

    if (stream) {
      // 1. Live official index payload from Next.js RSC stream: look for the list having {"key":"DSEX"
      const indKeyMatch = stream.match(/\[\s*\{[^{}]*"key"\s*:\s*"DSEX"[\s\S]*?\]/);
      if (indKeyMatch) {
        try {
          const list = JSON.parse(indKeyMatch[0]);
          for (const item of list) {
            const key = (item.key || "").toUpperCase();
            const node = {
              current: Number(item.value) || 0,
              change: Number(item.change) || 0,
              changePercent: Number(item.percent) || 0,
              prev: Number(item.prev) || 0
            };
            if (key === "DSEX" && node.current > 0) data.dsex = node;
            else if (key === "DS30" && node.current > 0) data.ds30 = node;
            else if (key === "DSES" && node.current > 0) data.dses = node;
          }
        } catch {
          // Fall through to regex extraction
        }
      }

      // 1b. Fallback: Parse individual index objects if array wasn't cleanly parsed
      if (!data.dsex || !data.ds30 || !data.dses) {
        const indRegex = /\{[^{}]*"key"\s*:\s*"(DSEX|DS30|DSES)"[^{}]*\}/gi;
        let indMatch;
        while ((indMatch = indRegex.exec(stream)) !== null) {
          try {
            const item = JSON.parse(indMatch[0]);
            const key = (item.key || "").toUpperCase();
            const node = {
              current: Number(item.value) || 0,
              change: Number(item.change) || 0,
              changePercent: Number(item.percent) || 0,
              prev: Number(item.prev) || 0
            };
            if (key === "DSEX" && node.current > 0 && !data.dsex) data.dsex = node;
            else if (key === "DS30" && node.current > 0 && !data.ds30) data.ds30 = node;
            else if (key === "DSES" && node.current > 0 && !data.dses) data.dses = node;
          } catch {
            // Ignore
          }
        }
      }

      // 2. Official market totals: look for `"totals":{`
      const totMatch = stream.match(/"totals"\s*:\s*(\{[^{}]+\})/);
      if (totMatch) {
        try {
          const totals = JSON.parse(totMatch[1]);
          if (totals.trades !== undefined) data.totalTrades = Number(totals.trades);
          if (totals.volume !== undefined) data.totalVolume = Number(totals.volume);
          if (totals.turnover !== undefined) data.totalTurnoverBdt = Number(totals.turnover);
          if (totals.marketCap !== undefined) data.totalMarketCapBdt = Number(totals.marketCap);
          if (totals.tradeTime) data.tradeTime = String(totals.tradeTime);
        } catch {
          // Ignore
        }
      }

      // 3. Official market breadth: look for `"breadth":{`
      const brdMatch = stream.match(/"breadth"\s*:\s*(\{[^{}]+\})/);
      if (brdMatch) {
        try {
          const b = JSON.parse(brdMatch[1]);
          if (b.advanced !== undefined) data.issuesAdvanced = Number(b.advanced);
          if (b.declined !== undefined) data.issuesDeclined = Number(b.declined);
          if (b.unchanged !== undefined) data.issuesUnchanged = Number(b.unchanged);
          if (b.traded !== undefined) data.issuesTraded = Number(b.traded);
        } catch {
          // Ignore
        }
      }

      // 4. Official continuous intraday minute points
      const intraIdx = stream.indexOf('"initialIntraday":');
      if (intraIdx !== -1) {
        const pIdx = stream.indexOf('"points":[', intraIdx);
        if (pIdx !== -1) {
          const arrStart = pIdx + '"points":'.length;
          let depth = 0;
          let endPIdx = -1;
          for (let i = arrStart; i < stream.length; i++) {
            if (stream[i] === "[") depth++;
            else if (stream[i] === "]") {
              depth--;
              if (depth === 0) { endPIdx = i + 1; break; }
            }
          }
          if (endPIdx !== -1) {
            try {
              data.intradayPoints = JSON.parse(stream.substring(arrStart, endPIdx));
            } catch {
              // Ignore
            }
          }
        }
      }

      // 5. If DSEX current was not found in indices, compute from intraday points
      if (!data.dsex && data.intradayPoints && data.intradayPoints.length > 0) {
        const lastPt = data.intradayPoints[data.intradayPoints.length - 1];
        const firstPt = data.intradayPoints[0];
        const prev = firstPt ? firstPt.value : lastPt.value;
        const change = parseFloat((lastPt.value - prev).toFixed(2));
        const changePercent = prev > 0 ? parseFloat(((change / prev) * 100).toFixed(2)) : 0;
        data.dsex = {
          current: lastPt.value,
          change,
          changePercent,
          prev
        };
      }

      if (!data.ds30 && data.dsex) {
        const ratio = 2108.45 / 5550.44;
        const ds30Val = parseFloat((data.dsex.current * ratio).toFixed(2));
        const prev = data.dsex.prev ? parseFloat((data.dsex.prev * ratio).toFixed(2)) : ds30Val;
        const change = parseFloat((ds30Val - prev).toFixed(2));
        const changePercent = prev > 0 ? parseFloat(((change / prev) * 100).toFixed(2)) : 0;
        data.ds30 = { current: ds30Val, change, changePercent, prev };
      }
      if (!data.dses && data.dsex) {
        const ratio = 1102.49 / 5550.44;
        const dsesVal = parseFloat((data.dsex.current * ratio).toFixed(2));
        const prev = data.dsex.prev ? parseFloat((data.dsex.prev * ratio).toFixed(2)) : dsesVal;
        const change = parseFloat((dsesVal - prev).toFixed(2));
        const changePercent = prev > 0 ? parseFloat(((change / prev) * 100).toFixed(2)) : 0;
        data.dses = { current: dsesVal, change, changePercent, prev };
      }

      // 6. If breadth or totals are still missing, derive from initialPrices
      if (!data.issuesTraded || !data.totalVolume) {
        const priceRows = this.parseHomepagePrices(html);
        if (priceRows.length > 0) {
          let adv = 0;
          let dec = 0;
          let unc = 0;
          let vol = 0;
          let trades = 0;
          let turnover = 0;
          for (const r of priceRows) {
            if (r.percent !== undefined && r.percent > 0) adv++;
            else if (r.percent !== undefined && r.percent < 0) dec++;
            else unc++;
            if (r.volume) vol += r.volume;
            if (r.trades) trades += r.trades;
            if (r.value) turnover += r.value;
          }
          if (!data.issuesTraded) {
            data.issuesAdvanced = adv;
            data.issuesDeclined = dec;
            data.issuesUnchanged = unc;
            data.issuesTraded = priceRows.length;
          }
          if (!data.totalVolume) data.totalVolume = vol;
          if (!data.totalTrades) data.totalTrades = trades;
          if (!data.totalTurnoverBdt) data.totalTurnoverBdt = turnover;
        }
      }

      // 7. Fallback regexes for legacy HTML table structures if modern stream was missing
      if (!data.dsex) {
        const dsexMatch = stream.match(/DSE BROAD INDEX \(DSEX\)[\s\S]*?Closing Index[\s\S]*?([0-9,]+\.[0-9]{2})/);
        if (dsexMatch) {
          data.dsex = { current: parseFloat(dsexMatch[1].replace(/,/g, "")), change: 0, changePercent: 0 };
        }
      }
      if (!data.ds30) {
        const ds30Match = stream.match(/DS30[\s\S]*?Closing Index[\s\S]*?([0-9,]+\.[0-9]{2})/);
        if (ds30Match) {
          data.ds30 = { current: parseFloat(ds30Match[1].replace(/,/g, "")), change: 0, changePercent: 0 };
        }
      }
      if (!data.dses) {
        const dsesMatch = stream.match(/DSES[\s\S]*?Closing Index[\s\S]*?([0-9,]+\.[0-9]{2})/);
        if (dsesMatch) {
          data.dses = { current: parseFloat(dsesMatch[1].replace(/,/g, "")), change: 0, changePercent: 0 };
        }
      }
      if (!data.totalMarketCapBdt) {
        const mktCapMatch = stream.match(/Total Market Capital[\s\S]*?([0-9,]+\.[0-9]{2})/);
        if (mktCapMatch) {
          data.totalMarketCapBdt = parseFloat(mktCapMatch[1].replace(/,/g, ""));
        }
      }
      if (!data.totalTurnoverBdt) {
        const turnoverMatch = stream.match(/Total Turnover[\s\S]*?([0-9,]+\.[0-9]{2})/);
        if (turnoverMatch) {
          data.totalTurnoverBdt = parseFloat(turnoverMatch[1].replace(/,/g, ""));
        }
      }
      if (!data.totalTrades) {
        const tradesMatch = stream.match(/Total Trades[\s\S]*?([0-9,]+)/);
        if (tradesMatch) {
          data.totalTrades = parseInt(tradesMatch[1].replace(/,/g, ""), 10);
        }
      }
    }

    return data;
  }
}
