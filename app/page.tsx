"use client";

import { useEffect, useState, useMemo } from "react";
import { ETFS, CATEGORIES } from "@/lib/etfs";
import { VolumeData, DayFlow } from "@/lib/redis";

type View    = "bar" | "table" | "top5";
type SortKey = "ratio" | "volume" | "dollarVolume" | "ticker" | "flow";

const CAT_COLOR: Record<string, string> = {
  "Broad US Equity":   "#60a5fa",
  "US Sectors":        "#34d399",
  "Intl - Dev Mrkt":   "#fb923c",
  "Intl - Emer Mrkt":  "#f59e0b",
  "Fixed Income":      "#c084fc",
  "Commodities & Alt": "#facc15",
};

const FLOW_COLOR = { inflow: "#22c55e", outflow: "#ef4444", neutral: "#94a3b8" };
const FLOW_LABEL = { inflow: "Inflow", outflow: "Outflow", neutral: "Neutral" };
const FLOW_ICON  = { inflow: "▲", outflow: "▼", neutral: "—" };

function fmt(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000)     return (n / 1_000).toFixed(0) + "K";
  return n.toLocaleString();
}

function fmtPct(v: number | null): string {
  if (v == null) return "—";
  return (v >= 0 ? "+" : "") + v.toFixed(1) + "%";
}

function FlowBadge({ flow }: { flow: "inflow" | "outflow" | "neutral" }) {
  const c = FLOW_COLOR[flow];
  return (
    <span style={{ background: c + "20", color: c, border: `1px solid ${c}60`, borderRadius: 4, padding: "1px 7px", fontSize: 11, fontWeight: 700, letterSpacing: "0.04em", whiteSpace: "nowrap" }}>
      {FLOW_ICON[flow]} {FLOW_LABEL[flow]}
    </span>
  );
}

function RatioBadge({ ratio }: { ratio: number }) {
  const color = ratio >= 2 ? "#ef4444" : ratio >= 1.5 ? "#fb923c" : ratio >= 1.0 ? "#22c55e" : "#c084fc";
  return (
    <span style={{ background: color + "20", color, border: `1px solid ${color}60`, borderRadius: 4, padding: "1px 7px", fontSize: 11, fontWeight: 700, fontFamily: "monospace", whiteSpace: "nowrap" }}>
      {ratio.toFixed(2)}x
    </span>
  );
}

function BiasBadge({ bias }: { bias: "bull" | "bear" }) {
  const c = bias === "bull" ? "#22c55e" : "#ef4444";
  return (
    <span style={{ background: c + "20", color: c, border: `1px solid ${c}60`, borderRadius: 4, padding: "1px 7px", fontSize: 11, fontWeight: 700, whiteSpace: "nowrap" }}>
      {bias === "bull" ? "▲ BULL" : "▼ BEAR"}
    </span>
  );
}

function Sparkline({ days, avg30 }: { days: DayFlow[]; avg30: number }) {
  if (!days || days.length === 0) return <span style={{ color: "#94a3b8", fontSize: 10 }}>—</span>;
  const maxVol = Math.max(...days.map(d => d.volume), avg30 * 1.5);
  const W = 56, H = 24, gap = 2;
  const barW = (W - gap * (days.length - 1)) / days.length;
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: "block" }}>
      <line
        x1={0} y1={H - (avg30 / maxVol) * H}
        x2={W} y2={H - (avg30 / maxVol) * H}
        stroke="#3b82f6" strokeWidth={1.5} strokeDasharray="3,2" opacity={0.9}
      />
      {days.map((d, i) => {
        const h = Math.max((d.volume / maxVol) * H, 2);
        const x = i * (barW + gap);
        const col = FLOW_COLOR[d.flow];
        return <rect key={i} x={x} y={H - h} width={barW} height={h} fill={col} opacity={0.85} rx={1} />;
      })}
    </svg>
  );
}

// ── Mini bar for % of group ───────────────────────────────────────────────────
function PctBar({ pct }: { pct: number | null }) {
  if (pct == null) return <span style={{ color: "#94a3b8" }}>—</span>;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, justifyContent: "flex-end" }}>
      <div style={{ width: 50, height: 6, background: "#e2e8f0", borderRadius: 3, overflow: "hidden" }}>
        <div style={{ width: `${Math.min(pct * 4, 100)}%`, height: "100%", background: "#60a5fa", borderRadius: 3 }} />
      </div>
      <span style={{ fontFamily: "monospace", fontSize: 11, color: "#475569", minWidth: 34, textAlign: "right" }}>{pct.toFixed(1)}%</span>
    </div>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const [activeTab, setActiveTab] = useState<"etf" | "levered">("etf");

  return (
    <div style={{ minHeight: "100vh", background: "#f0f4f8", color: "#1e293b", fontFamily: "'DM Mono','IBM Plex Mono','Courier New',monospace", paddingBottom: 40 }}>

      {/* ── Header ── */}
      <header style={{ background: "#1e2d45", color: "#fff", padding: "10px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8, position: "sticky", top: 0, zIndex: 100, boxShadow: "0 2px 8px rgba(0,0,0,.2)" }}>
        <div>
          <div style={{ fontSize: 10, letterSpacing: "0.2em", color: "#60a5fa", textTransform: "uppercase", marginBottom: 2 }}>Market Dashboard</div>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "#fff" }}>ETF Volume Flow</h1>
        </div>
        {/* Tab buttons */}
        <div style={{ display: "flex", gap: 6 }}>
          {([
            { key: "etf",     label: "ETF Volume Flow"   },
            { key: "levered", label: "Levered ETF Volume" },
          ] as { key: "etf" | "levered"; label: string }[]).map(({ key, label }) => (
            <button key={key} onClick={() => setActiveTab(key)} style={{
              background:   activeTab === key ? "#2563eb" : "rgba(255,255,255,.08)",
              color:        activeTab === key ? "#fff" : "#94a3b8",
              border:       `1px solid ${activeTab === key ? "#2563eb" : "rgba(255,255,255,.15)"}`,
              borderRadius: 6, padding: "5px 14px", cursor: "pointer",
              fontSize: 11, fontFamily: "inherit", letterSpacing: "0.06em",
              textTransform: "uppercase", fontWeight: activeTab === key ? 700 : 400,
            }}>
              {label}
            </button>
          ))}
        </div>
      </header>

      {activeTab === "etf"     && <ETFVolumeTab />}
      {activeTab === "levered" && <LeveredTab />}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 1 — ETF Volume Flow (original, unchanged)
// ═══════════════════════════════════════════════════════════════════════════════
function ETFVolumeTab() {
  const [data, setData]           = useState<VolumeData | null>(null);
  const [error, setError]         = useState<string | null>(null);
  const [view, setView]           = useState<View>("table");
  const [sortKey, setSortKey]     = useState<SortKey>("ratio");
  const [sortAsc, setSortAsc]     = useState(false);
  const [filterCat, setFilterCat] = useState("All");
  const [loading, setLoading]     = useState(true);

  useEffect(() => {
    fetch("/api/data")
      .then(r => r.json())
      .then(d => { if (d.error) setError(d.error); else setData(d); setLoading(false); })
      .catch(() => { setError("Failed to fetch data"); setLoading(false); });
  }, []);

  const enriched = useMemo(() => {
    if (!data) return [];
    const etfMap = Object.fromEntries(ETFS.map(e => [e.ticker, e]));
    return data.records
      .map(r => ({ ...r, ...etfMap[r.ticker] }))
      .filter(r => r.ticker && r.volume > 0);
  }, [data]);

  const filtered = useMemo(() => {
    let list = filterCat === "All" ? enriched : enriched.filter(r => r.category === filterCat);
    return [...list].sort((a, b) => {
      const mul = sortAsc ? 1 : -1;
      if (sortKey === "ticker") return mul * a.ticker.localeCompare(b.ticker);
      if (sortKey === "flow") {
        const order = { inflow: 1, neutral: 0, outflow: -1 };
        return mul * (order[a.flow] - order[b.flow]);
      }
      return mul * ((a as any)[sortKey] - (b as any)[sortKey]);
    });
  }, [enriched, filterCat, sortKey, sortAsc]);

  const maxRatio = useMemo(() => Math.max(...filtered.map(r => r.ratio), 1), [filtered]);
  const top5     = useMemo(() => [...enriched].sort((a, b) => b.ratio - a.ratio).slice(0, 5), [enriched]);
  const bot5     = useMemo(() => [...enriched].sort((a, b) => a.ratio - b.ratio).slice(0, 5), [enriched]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortAsc(v => !v);
    else { setSortKey(key); setSortAsc(false); }
  }

  const updatedAt = data?.updatedAt
    ? new Date(data.updatedAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
    : null;

  const inflowCount  = enriched.filter(r => r.flow === "inflow").length;
  const outflowCount = enriched.filter(r => r.flow === "outflow").length;
  const elevCount    = enriched.filter(r => r.ratio >= 1.5).length;
  const vhCount      = enriched.filter(r => r.ratio >= 2).length;

  const VIEWS: { key: View; label: string }[] = [
    { key: "table", label: "Table" },
    { key: "bar",   label: "Chart" },
    { key: "top5",  label: "Top / Bot 5" },
  ];

  return (
    <div style={{ padding: "12px 20px 0" }}>
      {/* View toggle + updated timestamp */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10, flexWrap: "wrap", gap: 8 }}>
        <div style={{ display: "flex", gap: 6 }}>
          {VIEWS.map(({ key, label }) => (
            <button key={key} onClick={() => setView(key)} style={{ background: view === key ? "#2563eb" : "#fff", color: view === key ? "#fff" : "#64748b", border: `1px solid ${view === key ? "#2563eb" : "#cbd5e1"}`, borderRadius: 6, padding: "5px 14px", cursor: "pointer", fontSize: 11, fontFamily: "inherit", letterSpacing: "0.06em", textTransform: "uppercase", fontWeight: view === key ? 700 : 400 }}>
              {label}
            </button>
          ))}
        </div>
        {updatedAt && <div style={{ fontSize: 11, color: "#94a3b8" }}>Updated {updatedAt}</div>}
      </div>

      {/* Category filter pills */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
        {["All", ...CATEGORIES].map(cat => {
          const col = CAT_COLOR[cat] ?? "#2563eb";
          const active = filterCat === cat;
          return (
            <button key={cat} onClick={() => setFilterCat(cat)} style={{ background: active ? col + "22" : "#fff", color: active ? col : "#64748b", border: `1px solid ${active ? col + "99" : "#cbd5e1"}`, borderRadius: 20, padding: "4px 14px", cursor: "pointer", fontSize: 11, fontFamily: "inherit", letterSpacing: "0.06em", textTransform: "uppercase", fontWeight: active ? 700 : 400, boxShadow: "0 1px 2px rgba(0,0,0,.05)" }}>
              {cat}
            </button>
          );
        })}
      </div>

      {loading && <div style={{ textAlign: "center", padding: 60, color: "#94a3b8" }}>Loading volume data…</div>}
      {error && (
        <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: 20, color: "#b91c1c", fontSize: 13 }}>
          <strong>No data yet.</strong> {error}
          <div style={{ color: "#94a3b8", marginTop: 6, fontSize: 11 }}>Visit <code>/api/cron</code> to seed data.</div>
        </div>
      )}

      {!loading && !error && data && (
        <>
          {/* Summary cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(6,1fr)", gap: 8, marginBottom: 12 }}>
            {[
              { label: "Inflow (up day)",       value: inflowCount,       color: "#22c55e" },
              { label: "Outflow (down day)",     value: outflowCount,      color: "#ef4444" },
              { label: "Elevated vol (>1.5x)",   value: elevCount,         color: "#fb923c" },
              { label: "Very high vol (>2x)",    value: vhCount,           color: "#ef4444" },
              { label: "ETFs tracked",           value: enriched.length,   color: "#1e293b" },
              { label: "Categories",             value: CATEGORIES.length, color: "#64748b" },
            ].map(({ label, value, color }) => (
              <div key={label} style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, padding: "10px 14px", boxShadow: "0 1px 2px rgba(0,0,0,.04)" }}>
                <div style={{ fontSize: 9, color: "#94a3b8", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 4 }}>{label}</div>
                <div style={{ fontSize: 22, fontWeight: 700, color }}>{value}</div>
              </div>
            ))}
          </div>

          {/* Legend */}
          <div style={{ fontSize: 10, color: "#64748b", marginBottom: 8, display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
            <span style={{ fontWeight: 700, color: "#475569" }}>Flow = close vs open:</span>
            <span style={{ color: "#22c55e" }}>▲ Inflow = close &gt; open</span>
            <span style={{ color: "#ef4444" }}>▼ Outflow = close &lt; open</span>
            <span style={{ color: "#94a3b8" }}>— Neutral</span>
            <span style={{ borderLeft: "1px solid #e2e8f0", paddingLeft: 16 }}>Sparkline = last 5 days · <span style={{ color: "#3b82f6" }}>blue dashed</span> = 30-day avg</span>
          </div>

          {/* BAR CHART VIEW */}
          {view === "bar" && (
            <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,.06)" }}>
              <div style={{ padding: "7px 14px", borderBottom: "1px solid #f1f5f9", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                <div style={{ fontSize: 10, color: "#64748b", letterSpacing: "0.1em", textTransform: "uppercase" }}>Ranked by volume ratio — yesterday vs 30-day avg</div>
                <div style={{ display: "flex", gap: 12, fontSize: 10, color: "#64748b" }}>
                  {[["#ef4444",">=2x"],["#fb923c",">=1.5x"],["#22c55e",">=1x"],["#c084fc","<0.7x"]].map(([c,l]) => (
                    <span key={l} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <span style={{ width: 8, height: 8, borderRadius: 2, background: c, display: "inline-block" }} />{l}
                    </span>
                  ))}
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "100px 1fr 64px 80px 70px", alignItems: "center", gap: 10, padding: "4px 14px", background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                {["ETF","Volume ratio bar","5-day","Flow","Ratio"].map(h => (
                  <div key={h} style={{ fontSize: 9, color: "#94a3b8", letterSpacing: "0.1em", textTransform: "uppercase", textAlign: h === "5-day" ? "right" : h === "Flow" || h === "Ratio" ? "right" : "left" }}>{h}</div>
                ))}
              </div>
              {[...filtered].sort((a, b) => b.ratio - a.ratio).map((r, i) => {
                const pct      = Math.min((r.ratio / (maxRatio * 1.05)) * 100, 100);
                const barColor = r.ratio >= 2 ? "#ef4444" : r.ratio >= 1.5 ? "#fb923c" : r.ratio >= 1.0 ? "#22c55e" : "#c084fc";
                const catColor = CAT_COLOR[r.category] ?? "#60a5fa";
                return (
                  <div key={r.ticker} style={{ display: "grid", gridTemplateColumns: "100px 1fr 64px 80px 70px", alignItems: "center", gap: 10, padding: "5px 14px", background: i % 2 === 0 ? "#fff" : "#f8fafc", borderBottom: "1px solid #f1f5f9" }}>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                        <span style={{ width: 3, height: 12, borderRadius: 2, background: catColor, display: "inline-block", flexShrink: 0 }} />
                        <span style={{ fontWeight: 700, fontSize: 12, color: "#0f172a" }}>{r.ticker}</span>
                      </div>
                      <div style={{ fontSize: 10, color: "#94a3b8", marginLeft: 8, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.name}</div>
                    </div>
                    <div style={{ position: "relative" }}>
                      <div style={{ height: 16, background: "#f1f5f9", borderRadius: 3, overflow: "hidden" }}>
                        <div style={{ width: `${pct}%`, height: "100%", background: barColor, borderRadius: 3, opacity: 0.8 }} />
                      </div>
                      <div style={{ position: "absolute", top: 0, left: `${Math.min((1 / (maxRatio * 1.05)) * 100, 100)}%`, width: 1, height: "100%", background: "#94a3b8", pointerEvents: "none" }} />
                    </div>
                    <div style={{ display: "flex", justifyContent: "flex-end" }}><Sparkline days={r.last5 || []} avg30={r.avg30} /></div>
                    <div style={{ textAlign: "right" }}><FlowBadge flow={r.flow} /></div>
                    <div style={{ textAlign: "right" }}>
                      <RatioBadge ratio={r.ratio} />
                      <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 2 }}>{fmt(r.volume)}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* TABLE VIEW */}
          {view === "table" && (
            <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, overflow: "hidden", boxShadow: "0 1px 2px rgba(0,0,0,.04)" }}>
              <div style={{ padding: "8px 14px", borderBottom: "1px solid #f1f5f9", fontSize: 10, color: "#64748b", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" }}>Full Table — Click Column to Sort</div>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr style={{ background: "#f8fafc", borderBottom: "2px solid #e2e8f0" }}>
                    {([["ticker","Ticker"],["","Name"],["","Category"],["flow","Flow"],["ratio","Ratio"],["volume","Volume"],["dollarVolume","$Vol (M)"],["","5-Day"]] as [string,string][]).map(([key, label]) => (
                      <th key={label} onClick={() => key && toggleSort(key as SortKey)} style={{ padding: "7px 12px", textAlign: "left", color: key && sortKey === key ? "#2563eb" : "#64748b", fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", cursor: key ? "pointer" : "default", fontWeight: 700, whiteSpace: "nowrap" }}>
                        {label}{key && sortKey === key ? (sortAsc ? " ↑" : " ↓") : ""}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r, i) => (
                    <tr key={r.ticker} style={{ borderBottom: "1px solid #f1f5f9", background: i % 2 === 0 ? "#fff" : "#fafafa" }}>
                      <td style={{ padding: "5px 12px", fontWeight: 700, fontSize: 12, color: "#0f172a" }}>{r.ticker}</td>
                      <td style={{ padding: "5px 12px", color: "#475569", fontSize: 11 }}>{r.name}</td>
                      <td style={{ padding: "5px 12px" }}>
                        <span style={{ background: (CAT_COLOR[r.category] ?? "#60a5fa") + "20", color: CAT_COLOR[r.category] ?? "#60a5fa", borderRadius: 3, padding: "1px 6px", fontSize: 10, fontWeight: 600 }}>{r.category}</span>
                      </td>
                      <td style={{ padding: "5px 12px" }}><FlowBadge flow={r.flow} /></td>
                      <td style={{ padding: "5px 12px" }}><RatioBadge ratio={r.ratio} /></td>
                      <td style={{ padding: "5px 12px", fontFamily: "monospace", color: "#475569", fontSize: 11 }}>{fmt(r.volume)}</td>
                      <td style={{ padding: "5px 12px", fontFamily: "monospace", color: "#475569", fontSize: 11 }}>${r.dollarVolume.toLocaleString()}M</td>
                      <td style={{ padding: "5px 12px" }}><Sparkline days={r.last5 || []} avg30={r.avg30} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* TOP / BOTTOM 5 VIEW */}
          {view === "top5" && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              {[
                { label: "Top 5 — Highest Volume Ratio", color: "#059669", items: top5 },
                { label: "Bottom 5 — Lowest Volume Ratio", color: "#7c3aed", items: bot5 },
              ].map(({ label, color, items }) => (
                <div key={label} style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, overflow: "hidden", boxShadow: "0 1px 2px rgba(0,0,0,.04)" }}>
                  <div style={{ padding: "8px 14px", borderBottom: "1px solid #f1f5f9", fontSize: 10, color, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" }}>{label}</div>
                  {items.map((r, i) => (
                    <div key={r.ticker} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 14px", borderBottom: i < 4 ? "1px solid #f8fafc" : "none", background: i % 2 === 0 ? "#fff" : "#fafafa" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ color, fontSize: 11, width: 20, fontWeight: 700 }}>#{i + 1}</span>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 13, color: "#0f172a" }}>{r.ticker}</div>
                          <div style={{ fontSize: 10, color: "#94a3b8" }}>{r.name}</div>
                        </div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <Sparkline days={r.last5 || []} avg30={r.avg30} />
                        <FlowBadge flow={r.flow} />
                        <div style={{ textAlign: "right" }}>
                          <RatioBadge ratio={r.ratio} />
                          <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 2 }}>{fmt(r.volume)}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 2 — Levered ETF Volume
// ═══════════════════════════════════════════════════════════════════════════════
type LeveredRecord = {
  ticker:     string;
  name:       string;
  bias:       "bull" | "bear";
  underlying: string;
  volume:     number | null;
  avg5:       number | null;
  price:      number | null;
  chg1d:      number | null;
  ytd:        number | null;
  pctOfGroup: number | null;
};

type LeveredPayload = {
  etfs:  LeveredRecord[];
  meta:  { totalAvg5: number; bullAvg5: number; bearAvg5: number; bbRatio: number | null; updatedAt: string };
};

function LeveredTab() {
  const [data,    setData]    = useState<LeveredPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const [filter,  setFilter]  = useState<"all" | "bull" | "bear">("all");

  useEffect(() => {
    fetch("/api/levered")
      .then(r => r.json())
      .then(d => { if (d.error) setError(d.error); else setData(d); setLoading(false); })
      .catch(() => { setError("Failed to fetch levered data"); setLoading(false); });
  }, []);

  const filtered = useMemo(() => {
    if (!data) return [];
    return filter === "all" ? data.etfs : data.etfs.filter(e => e.bias === filter);
  }, [data, filter]);

  const meta = data?.meta;
  const updatedAt = meta?.updatedAt
    ? new Date(meta.updatedAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
    : null;

  const bbLabel = meta?.bbRatio == null ? "—"
    : meta.bbRatio > 1.2 ? "Bullish skew"
    : meta.bbRatio < 0.8 ? "Bearish skew"
    : "Roughly balanced";
  const bbColor = meta?.bbRatio == null ? "#64748b"
    : meta.bbRatio > 1.2 ? "#22c55e"
    : meta.bbRatio < 0.8 ? "#ef4444"
    : "#f59e0b";

  return (
    <div style={{ padding: "12px 20px 0" }}>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
        <div style={{ fontSize: 10, color: "#64748b", letterSpacing: "0.1em", textTransform: "uppercase" }}>
          Leveraged &amp; Inverse Single-Stock ETFs — Sorted by 5-Day Avg Volume
        </div>
        {updatedAt && <div style={{ fontSize: 11, color: "#94a3b8" }}>Updated {updatedAt}</div>}
      </div>

      {loading && <div style={{ textAlign: "center", padding: 60, color: "#94a3b8" }}>Loading levered ETF data…</div>}
      {error && (
        <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: 20, color: "#b91c1c", fontSize: 13 }}>
          <strong>Error:</strong> {error}
        </div>
      )}

      {!loading && !error && data && (
        <>
          {/* Summary cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8, marginBottom: 12 }}>
            {[
              { label: "Bull 5D Avg Vol",  value: meta?.bullAvg5 ? fmt(meta.bullAvg5) : "—", color: "#22c55e" },
              { label: "Bear 5D Avg Vol",  value: meta?.bearAvg5 ? fmt(meta.bearAvg5) : "—", color: "#ef4444" },
              { label: "Bull : Bear Ratio", value: meta?.bbRatio != null ? meta.bbRatio.toFixed(2) : "—", sub: bbLabel, color: bbColor },
              { label: "Group 5D Avg Vol", value: meta?.totalAvg5 ? fmt(meta.totalAvg5) : "—", color: "#60a5fa" },
            ].map(({ label, value, sub, color }) => (
              <div key={label} style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, padding: "10px 14px", boxShadow: "0 1px 2px rgba(0,0,0,.04)" }}>
                <div style={{ fontSize: 9, color: "#94a3b8", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 4 }}>{label}</div>
                <div style={{ fontSize: 22, fontWeight: 700, color }}>{value}</div>
                {sub && <div style={{ fontSize: 10, color, marginTop: 2 }}>{sub}</div>}
              </div>
            ))}
          </div>

          {/* Filter pills */}
          <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
            {([["all","All"],["bull","Bull Only"],["bear","Bear Only"]] as [string,string][]).map(([key, label]) => {
              const col = key === "bull" ? "#22c55e" : key === "bear" ? "#ef4444" : "#2563eb";
              const active = filter === key;
              return (
                <button key={key} onClick={() => setFilter(key as any)} style={{ background: active ? col + "20" : "#fff", color: active ? col : "#64748b", border: `1px solid ${active ? col + "99" : "#cbd5e1"}`, borderRadius: 20, padding: "4px 14px", cursor: "pointer", fontSize: 11, fontFamily: "inherit", letterSpacing: "0.06em", textTransform: "uppercase", fontWeight: active ? 700 : 400 }}>
                  {label}
                </button>
              );
            })}
          </div>

          {/* Table */}
          <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, overflow: "hidden", boxShadow: "0 1px 2px rgba(0,0,0,.04)" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={{ background: "#f8fafc", borderBottom: "2px solid #e2e8f0" }}>
                  {["#","Ticker","Name","Bias","Underlying","Today Vol","5D Avg Vol","% of Group","Price","1D %","YTD %"].map((h, i) => (
                    <th key={h} style={{ padding: "7px 12px", textAlign: i <= 4 ? "left" : "right", color: "#64748b", fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 700, whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((r, i) => {
                  const chgColor = r.chg1d == null ? "#94a3b8" : r.chg1d >= 0 ? "#22c55e" : "#ef4444";
                  const ytdColor = r.ytd   == null ? "#94a3b8" : r.ytd   >= 0 ? "#22c55e" : "#ef4444";
                  return (
                    <tr key={r.ticker} style={{ borderBottom: "1px solid #f1f5f9", background: i % 2 === 0 ? "#fff" : "#fafafa" }}>
                      <td style={{ padding: "6px 12px", color: "#94a3b8", fontSize: 11 }}>{i + 1}</td>
                      <td style={{ padding: "6px 12px", fontWeight: 700, fontSize: 13, color: "#0f172a" }}>{r.ticker}</td>
                      <td style={{ padding: "6px 12px", color: "#475569", fontSize: 11, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.name}</td>
                      <td style={{ padding: "6px 12px" }}><BiasBadge bias={r.bias} /></td>
                      <td style={{ padding: "6px 12px", color: "#64748b", fontSize: 11, fontFamily: "monospace" }}>{r.underlying}</td>
                      <td style={{ padding: "6px 12px", textAlign: "right", fontFamily: "monospace", color: "#475569", fontSize: 11 }}>{r.volume != null ? fmt(r.volume) : "—"}</td>
                      <td style={{ padding: "6px 12px", textAlign: "right", fontFamily: "monospace", color: "#2563eb", fontSize: 11, fontWeight: 600 }}>{r.avg5 != null ? fmt(r.avg5) : "—"}</td>
                      <td style={{ padding: "6px 12px" }}><PctBar pct={r.pctOfGroup} /></td>
                      <td style={{ padding: "6px 12px", textAlign: "right", fontFamily: "monospace", color: "#475569", fontSize: 11 }}>{r.price != null ? `$${r.price.toFixed(2)}` : "—"}</td>
                      <td style={{ padding: "6px 12px", textAlign: "right", fontFamily: "monospace", fontSize: 11, fontWeight: 600, color: chgColor }}>{fmtPct(r.chg1d)}</td>
                      <td style={{ padding: "6px 12px", textAlign: "right", fontFamily: "monospace", fontSize: 11, color: ytdColor }}>{fmtPct(r.ytd)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div style={{ textAlign: "center", fontSize: 10, color: "#94a3b8", marginTop: 14 }}>
            Share volume (equity, not options) · Sorted by 5-day average · Data via Yahoo Finance end-of-day · Bull:Bear ratio based on 5D avg volume
          </div>
        </>
      )}
    </div>
  );
}
