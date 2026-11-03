"""Coverage report for data/history after a backfill load (read-only)."""
import json, os, statistics, collections, glob

H = os.path.join("data", "history")
cov = json.load(open(os.path.join(H, "processed", "coverage-summary.json"), encoding="utf8"))
q = json.load(open(os.path.join(H, "errors", "quarantined-rows.json"), encoding="utf8"))["bySymbol"]
conf = json.load(open(os.path.join(H, "processed", "conflicts.json"), encoding="utf8"))["conflicts"]
disc = json.load(open(os.path.join(H, "processed", "discontinuities.json"), encoding="utf8"))["items"]
prog = json.load(open(os.path.join(H, "processed", "backfill-progress.json"), encoding="utf8"))["windows"]
S = cov["symbols"]

print("=" * 78)
print("SOURCE:", cov["source"], "|", cov["archive"], "| adjusted:", cov["adjusted"], "| generated:", cov["generatedAt"])
w = sorted(prog)
print(f"windows fetched: {len(w)} ({w[0]} .. {w[-1]}) | with data: {sum(1 for k in w if prog[k]['rows'])} | empty: {sum(1 for k in w if not prog[k]['rows'])}")
print(f"first month with data: {min(k for k in w if prog[k]['rows'])} | official DSE sessions in archive: {cov['officialSessionsInArchive']}")

with_data = {k: v for k, v in S.items() if v["rows"] > 0}
missing = sorted(k for k, v in S.items() if v["rows"] == 0)
rows = [v["rows"] for v in with_data.values()]
print("\n--- 395 website securities ---")
print(f"with real history: {len(with_data)} | missing: {len(missing)} {missing}")
buckets = collections.Counter()
for v in S.values():
    y = v["years"] if v["rows"] else None
    buckets["missing" if y is None else "<1" if y < 1 else "1-3" if y < 3 else "3-5" if y < 5 else "5+"] += 1
print("years of history:", {k: buckets.get(k, 0) for k in ["<1", "1-3", "3-5", "5+", "missing"]})
src = collections.Counter()
for v in with_data.values():
    for s, n in v["sources"].items(): src[s] += 1
print("source per symbol:", dict(src))
print(f"rows per symbol: min {min(rows)} | median {statistics.median(rows):.0f} | max {max(rows)}")
print(f"earliest date: {min(v['firstDate'] for v in with_data.values())} | latest date: {max(v['lastDate'] for v in with_data.values())}")
late = sorted(((v["firstDate"], k) for k, v in with_data.items() if v["firstDate"] > "2024-10-31"))
print(f"starts after Oct 2024 (listed later / long halt): {len(late)} -> {late}")
latest = max(v["lastDate"] for v in with_data.values())
stale = sorted(((v["lastDate"], k) for k, v in with_data.items() if v["lastDate"] < latest))
print(f"last row before {latest} (no trade on latest day(s) / suspended): {len(stale)} -> {stale[:15]}{' ...' if len(stale) > 15 else ''}")

def show(sym):
    f = os.path.join(H, "stocks", f"{sym}.csv")
    lines = open(f, encoding="utf8").read().strip().split("\n")
    print(f"\n{sym}  ({len(lines)-1} rows, {f})")
    print("  " + lines[0])
    for l in lines[1:4]: print("  " + l)
    print("  ...")
    for l in lines[-3:]: print("  " + l)
for s in ["GP", "SQURPHARMA", "BATBC"]: show(s)

print("\n--- quarantined rows ---")
reasons = collections.Counter(r["reason"] for rs in q.values() for r in rs)
print(f"total {sum(reasons.values())} in {len(q)} files | by reason: {dict(reasons)}")
top = sorted(((len(v), k) for k, v in q.items()), reverse=True)[:10]
print("most per file:", top)
print("\n--- conflicts ---", len(conf))
print("\n--- discontinuities (>20% close-to-close; prices unadjusted) ---", len(disc))
for d in disc: print(f"  {d['symbol']:12} {d['from']} -> {d['to']}  {d['prevClose']} -> {d['close']}  ({d['change']*100:+.1f}%)")

def size(p):
    return sum(os.path.getsize(f) for f in glob.glob(os.path.join(p, "**", "*"), recursive=True) if os.path.isfile(f))
print("\n--- size ---")
for p in ["stocks", "indices", "imports", "errors", "processed", "source-map"]:
    print(f"  data/history/{p:12} {size(os.path.join(H, p))/1e6:7.2f} MB")
print(f"  data/history total   {size(H)/1e6:7.2f} MB")
for k in ["DSEX", "DS30"]:
    l = open(os.path.join(H, "indices", f"{k}.csv")).read().strip().split("\n")
    print(f"  {k}: {len(l)-1} days, first {l[1].split(',')[0]} last {l[-1].split(',')[0]} close {l[-1].split(',')[4]}")
