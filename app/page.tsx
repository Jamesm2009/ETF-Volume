"use client";

import { useEffect, useState, useMemo } from "react";
import { ETFS, CATEGORIES } from "@/lib/etfs";
import { VolumeData, ETFVolumeRecord } from "@/lib/redis";

type View = "bar" | "table";
type SortKey = "ratio" | "volume" | "dollarVolume" | "ticker";

const CATEGORY_COLORS: Record<string, string> = {
  "Broad US Equity":   "#60a5fa",
  "US Sectors":        "#34d399",
  "International":     "#fb923c",
  "Fixed Income":      "#c084fc",
  "Commodities & Alt": "#fbbf24",
};

function fmt(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000)     return (n / 1_000).toFixed(0) + "K";
  return n.toLocaleString();
}

function getMarketHoursFraction(): number {
  const now = new Date();
  const ct = new Date(now.toLocaleString("en-US", { timeZone: "America/Chicago" }));
  const h = ct.getHours() + ct.getMinutes() / 60;
  const open = 8.5;
  const close = 15.0;
  if (h <= open) return 0;
  if (h >= close) return 1;
  return (h - open) / (close - open);
}

function DirectionArrow({ dir }: { dir: "up" | "down" | "neutral" }) {
  if (dir === "up")   return <span style={{ color: "#34d399", fontWeight: 700, fontSize: 13 }}>↑</span>;
  if (dir === "down") return <span style={{ color: "#f87171", fontWeight: 700, fontSize: 13 }}>↓</span>;
  return <span style={{ color: "#6b7280", fontSize: 13 }}>→</span>;
}

function RatioBadge({ ratio, adjusted }: { ratio: number; adjusted: number }) {
  const color =
    adjusted >= 2   ? "#f87171" :
    adjusted >= 1.5 ? "#fb923c" :
    adjusted >= 1.0 ? "#34d399" :
    adjusted < 0.7  ? "#c084fc" : "#94a3b8";
  return (
    <span style={{
      background: color + "20",
      color,
      border: `1px solid ${color}60`,
      borderRadius: 4,
      padding: "1px 7px",
      fontSize: 11,
      fontWeight: 700,
      fontFamily: "monospace",
      letterSpacing: "0.04em",
      whiteSpace: "nowrap",
    }}>
      {ratio.toFixed(2)}x
    </span>
  );
}

export default function Dashboard() {
  const [data, setData] = useState<VolumeData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<View>("bar");
  const [sortKey, setSortKey] = useState<SortKey>("ratio");
  const [sortAsc, setSortAsc] = useState(false);
  const [filterCat, setFilterCat] = useState<string>("All");
  const [loading, setLoading] = useState(true);
  const [mktFraction, setMktFraction] = useState(1);

  useEffect(() => {
    const f = getMarketHoursFraction();
    setMktFraction(f > 0.05 ? f : 1);
    fetch("/api/data")
      .then(r => r.json())
      .then(d => { if (d.error) setError(d.error); else setData(d); setLoading(false); })
      .catch(() => { setError("Failed to fetch data"); setLoading(false); });
  }, []);

  const enriched = useMemo(() => {
    if (!data) return [];
    const etfMap = Object.fromEntries(ETFS.map(e => [e.ticker, e]));
    return data.records
      .map(r => {
        const adjusted = mktFraction < 1 ? r.ratio / mktFraction : r.ratio;
        return { ...r, ...etfMap[r.ticker], adjusted };
      })
      .filter(r => r.ticker && r.volume > 0);
  }, [data, mktFraction]);

  const filtered = useMemo(() => {
    let list = filterCat === "All" ? enriched : enriched.filter(r => r.category === filterCat);
    return [...list].sort((a, b) => {
      const mul = sortAsc ? 1 : -1;
      if (sortKey === "ticker") return mul * a.ticker.localeCompare(b.ticker);
      return mul * ((a as any)[sortKey] - (b as any)[sortKey]);
    });
  }, [enriched, filterCat, sortKey, sortAsc]);

  const maxAdj = useMemo(() => Math.max(...filtered.map(r => (r as any).adjusted), 1), [filtered]);
  const top5   = useMemo(() => [...enriched].sort((a,b) => (b as any).adjusted - (a as any).adjusted).slice(0,5), [enriched]);
  const bot5   = useMemo(() => [...enriched].sort((a,b) => (a as any).adjusted - (b as any).adjusted).slice(0,5), [enriched]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortAsc(v => !v);
    else { setSortKey(key); setSortAsc(false); }
  }

  const updatedAt = data?.updatedAt
    ? new Date(data.updatedAt).toLocaleString("en-US", { month:"short", day:"numeric", hour:"2-digit", minute:"2-digit" })
    : null;

  const isIntraday = mktFraction < 0.99;

  const elevatedCount  = enriched.filter(r => (r as any).adjusted >= 1.5).length;
  const veryHighCount  = enriched.filter(r => (r as any).adjusted >= 2).length;
  const lowCount       = enriched.filter(r => (r as any).adjusted < 0.7).length;

  return (
    <div style={{ minHeight:"100vh", background:"#f0f4f8", color:"#1e293b", fontFamily:"'DM Mono','IBM Plex Mono','Courier New',monospace", padding:"0 0 40px" }}>

      {/* Header */}
      <header style={{ background:"#1e2d45", color:"#fff", padding:"10px 24px", display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:8, position:"sticky", top:0, zIndex:100, boxShadow:"0 2px 8px rgba(0,0,0,.2)" }}>
        <div>
          <div style={{ fontSize:10, letterSpacing:"0.2em", color:"#60a5fa", textTransform:"uppercase", marginBottom:2 }}>Market Dashboard</div>
          <h1 style={{ margin:0, fontSize:20, fontWeight:700, letterSpacing:"-0.02em", color:"#fff" }}>ETF Volume Flow</h1>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:16, flexWrap:"wrap" }}>
          {updatedAt && <div style={{ fontSize:11, color:"#94a3b8" }}>Updated {updatedAt}{isIntraday ? " · intraday adjusted" : ""}</div>}
          <div style={{ display:"flex", gap:6 }}>
            {(["bar","table"] as View[]).map(v => (
              <button key={v} onClick={() => setView(v)} style={{ background: view===v ? "#2563eb" : "rgba(255,255,255,.08)", color: view===v ? "#fff" : "#94a3b8", border:`1px solid ${view===v ? "#2563eb" : "rgba(255,255,255,.15)"}`, borderRadius:6, padding:"5px 14px", cursor:"pointer", fontSize:11, fontFamily:"inherit", letterSpacing:"0.06em", textTransform:"uppercase", fontWeight: view===v ? 700 : 400 }}>
                {v === "bar" ? "⬛ Chart" : "⊟ Table"}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div style={{ padding:"12px 20px 0" }}>

        {/* Category pills */}
        <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:12 }}>
          {["All",...CATEGORIES].map(cat => {
            const col = CATEGORY_COLORS[cat] ?? "#2563eb";
            const active = filterCat === cat;
            return (
              <button key={cat} onClick={() => setFilterCat(cat)} style={{ background: active ? col+"22" : "#fff", color: active ? col : "#64748b", border:`1px solid ${active ? col+"99" : "#cbd5e1"}`, borderRadius:20, padding:"4px 14px", cursor:"pointer", fontSize:11, fontFamily:"inherit", letterSpacing:"0.06em", textTransform:"uppercase", fontWeight: active ? 700 : 400, boxShadow:"0 1px 2px rgba(0,0,0,.05)" }}>
                {cat}
              </button>
            );
          })}
        </div>

        {loading && <div style={{ textAlign:"center", padding:60, color:"#94a3b8" }}>Loading volume data…</div>}

        {error && (
          <div style={{ background:"#fef2f2", border:"1px solid #fecaca", borderRadius:8, padding:20, color:"#b91c1c", fontSize:13 }}>
            <strong>No data yet.</strong> {error}
            <div style={{ color:"#94a3b8", marginTop:6, fontSize:11 }}>Visit <code>/api/cron</code> to seed data.</div>
          </div>
        )}

        {!loading && !error && data && (
          <>
            {/* Summary cards */}
            <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:8, marginBottom:12 }}>
              {[
                { label:"ETFs Tracked",      value:enriched.length,  color:"#1e293b" },
                { label:"Elevated (>1.5x)",  value:elevatedCount,    color:"#fb923c" },
                { label:"Very High (>2x)",   value:veryHighCount,    color:"#f87171" },
                { label:"Low (<0.7x)",        value:lowCount,         color:"#c084fc" },
              ].map(({ label, value, color }) => (
                <div key={label} style={{ background:"#fff", border:"1px solid #e2e8f0", borderRadius:8, padding:"10px 16px", boxShadow:"0 1px 2px rgba(0,0,0,.04)" }}>
                  <div style={{ fontSize:10, color:"#94a3b8", letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:4 }}>{label}</div>
                  <div style={{ fontSize:24, fontWeight:700, color }}>{value}</div>
                </div>
              ))}
            </div>

            {isIntraday && (
              <div style={{ background:"#eff6ff", border:"1px solid #bfdbfe", borderRadius:6, padding:"6px 14px", fontSize:11, color:"#1d4ed8", marginBottom:10 }}>
                Intraday mode: ratios adjusted for {Math.round(mktFraction*100)}% of trading day elapsed. Ratios will normalize toward 1.0x by market close.
              </div>
            )}

            {/* BAR CHART */}
            {view === "bar" && (
              <div style={{ background:"#fff", border:"1px solid #e2e8f0", borderRadius:8, overflow:"hidden", boxShadow:"0 1px 3px rgba(0,0,0,.06)" }}>
                <div style={{ padding:"8px 14px", borderBottom:"1px solid #f1f5f9", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                  <div style={{ fontSize:10, color:"#64748b", letterSpacing:"0.1em", textTransform:"uppercase" }}>Ranked by volume ratio (today / 30-day avg{isIntraday ? ", time-adjusted" : ""})</div>
                  <div style={{ display:"flex", gap:14, fontSize:10, color:"#64748b" }}>
                    {[["#f87171","≥2x Very High"],["#fb923c","≥1.5x Elevated"],["#34d399","≥1x Normal"],["#c084fc","<0.7x Low"]].map(([c,l]) => (
                      <span key={l} style={{ display:"flex", alignItems:"center", gap:4 }}>
                        <span style={{ width:8, height:8, borderRadius:2, background:c, display:"inline-block" }} />
                        {l}
                      </span>
                    ))}
                  </div>
                </div>

                {filtered.map((r, i) => {
                  const adj = (r as any).adjusted as number;
                  const pct = Math.min((adj / (maxAdj * 1.05)) * 100, 100);
                  const barColor =
                    adj >= 2   ? "#f87171" :
                    adj >= 1.5 ? "#fb923c" :
                    adj >= 1.0 ? "#34d399" : "#c084fc";
                  const catColor = CATEGORY_COLORS[r.category] ?? "#60a5fa";

                  return (
                    <div key={r.ticker} style={{ display:"grid", gridTemplateColumns:"100px 1fr 90px", alignItems:"center", gap:10, padding:"5px 14px", background: i%2===0 ? "#fff" : "#f8fafc", borderBottom:"1px solid #f1f5f9" }}>
                      <div>
                        <div style={{ display:"flex", alignItems:"center", gap:5 }}>
                          <span style={{ width:3, height:12, borderRadius:2, background:catColor, display:"inline-block", flexShrink:0 }} />
                          <span style={{ fontWeight:700, fontSize:12, color:"#0f172a" }}>{r.ticker}</span>
                          <DirectionArrow dir={r.direction} />
                        </div>
                        <div style={{ fontSize:10, color:"#94a3b8", marginLeft:8, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{r.name}</div>
                      </div>

                      <div style={{ position:"relative" }}>
                        <div style={{ height:16, background:"#f1f5f9", borderRadius:3, overflow:"hidden" }}>
                          <div style={{ width:`${pct}%`, height:"100%", background:barColor, borderRadius:3, opacity:0.85 }} />
                        </div>
                        <div style={{ position:"absolute", top:0, left:`${Math.min((1/(maxAdj*1.05))*100,100)}%`, width:1, height:"100%", background:"#cbd5e1", pointerEvents:"none" }} />
                      </div>

                      <div style={{ textAlign:"right" }}>
                        <RatioBadge ratio={r.ratio} adjusted={adj} />
                        <div style={{ fontSize:10, color:"#94a3b8", marginTop:2 }}>{fmt(r.volume)}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* TABLE VIEW */}
            {view === "table" && (
              <div>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14, marginBottom:14 }}>
                  {[
                    { label:"Top 5 — Highest Volume Ratio", color:"#059669", items:top5 },
                    { label:"Bottom 5 — Lowest Volume Ratio", color:"#7c3aed", items:bot5 },
                  ].map(({ label, color, items }) => (
                    <div key={label} style={{ background:"#fff", border:"1px solid #e2e8f0", borderRadius:8, overflow:"hidden", boxShadow:"0 1px 2px rgba(0,0,0,.04)" }}>
                      <div style={{ padding:"8px 14px", borderBottom:"1px solid #f1f5f9", fontSize:10, color, fontWeight:700, letterSpacing:"0.1em", textTransform:"uppercase" }}>{label}</div>
                      {items.map((r,i) => (
                        <div key={r.ticker} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"7px 14px", borderBottom: i<4 ? "1px solid #f8fafc" : "none", background: i%2===0 ? "#fff" : "#fafafa" }}>
                          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                            <span style={{ color, fontSize:11, width:20, fontWeight:700 }}>#{i+1}</span>
                            <div>
                              <div style={{ fontWeight:700, fontSize:13, color:"#0f172a" }}>{r.ticker} <DirectionArrow dir={r.direction} /></div>
                              <div style={{ fontSize:10, color:"#94a3b8" }}>{r.name}</div>
                            </div>
                          </div>
                          <div style={{ textAlign:"right" }}>
                            <RatioBadge ratio={r.ratio} adjusted={(r as any).adjusted} />
                            <div style={{ fontSize:10, color:"#94a3b8", marginTop:2 }}>{fmt(r.volume)} shrs</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>

                <div style={{ background:"#fff", border:"1px solid #e2e8f0", borderRadius:8, overflow:"hidden", boxShadow:"0 1px 2px rgba(0,0,0,.04)" }}>
                  <div style={{ padding:"8px 14px", borderBottom:"1px solid #f1f5f9", fontSize:10, color:"#64748b", fontWeight:700, letterSpacing:"0.1em", textTransform:"uppercase" }}>Full Table — Click to Sort</div>
                  <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12 }}>
                    <thead>
                      <tr style={{ background:"#f8fafc", borderBottom:"2px solid #e2e8f0" }}>
                        {([["ticker","Ticker"],["","Name"],["","Category"],["ratio","Ratio"],["volume","Volume"],["dollarVolume","$Vol (M)"],["","Dir"]] as [string,string][]).map(([key,label]) => (
                          <th key={label} onClick={() => key && toggleSort(key as SortKey)} style={{ padding:"7px 12px", textAlign:"left", color: key && sortKey===key ? "#2563eb" : "#64748b", fontSize:10, letterSpacing:"0.08em", textTransform:"uppercase", cursor: key ? "pointer" : "default", fontWeight:700, whiteSpace:"nowrap" }}>
                            {label}{key && sortKey===key ? (sortAsc ? " ↑" : " ↓") : ""}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((r,i) => (
                        <tr key={r.ticker} style={{ borderBottom:"1px solid #f1f5f9", background: i%2===0 ? "#fff" : "#fafafa" }}>
                          <td style={{ padding:"5px 12px", fontWeight:700, fontSize:12, color:"#0f172a" }}>{r.ticker}</td>
                          <td style={{ padding:"5px 12px", color:"#475569", fontSize:11 }}>{r.name}</td>
                          <td style={{ padding:"5px 12px" }}>
                            <span style={{ background:(CATEGORY_COLORS[r.category]??"#60a5fa")+"20", color:CATEGORY_COLORS[r.category]??"#60a5fa", borderRadius:3, padding:"1px 6px", fontSize:10, fontWeight:600 }}>{r.category}</span>
                          </td>
                          <td style={{ padding:"5px 12px" }}><RatioBadge ratio={r.ratio} adjusted={(r as any).adjusted} /></td>
                          <td style={{ padding:"5px 12px", fontFamily:"monospace", color:"#475569", fontSize:11 }}>{fmt(r.volume)}</td>
                          <td style={{ padding:"5px 12px", fontFamily:"monospace", color:"#475569", fontSize:11 }}>${r.dollarVolume.toLocaleString()}M</td>
                          <td style={{ padding:"5px 12px" }}><DirectionArrow dir={r.direction} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
