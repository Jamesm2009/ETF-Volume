"use client";

import { useEffect, useState, useMemo } from "react";
import { ETFS, CATEGORIES } from "@/lib/etfs";
import { VolumeData, ETFVolumeRecord } from "@/lib/redis";

type View = "bar" | "table";
type SortKey = "ratio" | "volume" | "dollarVolume" | "ticker";

const CATEGORY_COLORS: Record<string, string> = {
  "Broad US Equity":   "#4f8ef7",
  "US Sectors":        "#34c98a",
  "International":     "#f7a34f",
  "Fixed Income":      "#b47ff7",
  "Commodities & Alt": "#f7e34f",
};

function fmt(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000)     return (n / 1_000).toFixed(0) + "K";
  return n.toLocaleString();
}

function DirectionArrow({ dir }: { dir: "up" | "down" | "neutral" }) {
  if (dir === "up")      return <span style={{ color: "#34c98a", fontWeight: 700 }}>↑</span>;
  if (dir === "down")    return <span style={{ color: "#f7554f", fontWeight: 700 }}>↓</span>;
  return <span style={{ color: "#888" }}>→</span>;
}

function RatioBadge({ ratio }: { ratio: number }) {
  const color =
    ratio >= 2   ? "#f7554f" :
    ratio >= 1.5 ? "#f7a34f" :
    ratio >= 1.1 ? "#34c98a" :
    ratio < 0.7  ? "#b47ff7" : "#888";
  return (
    <span style={{
      background: color + "22",
      color,
      border: `1px solid ${color}55`,
      borderRadius: 4,
      padding: "2px 7px",
      fontSize: 12,
      fontWeight: 700,
      fontFamily: "monospace",
      letterSpacing: "0.04em",
    }}>
      {ratio.toFixed(2)}×
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

  useEffect(() => {
    fetch("/api/data")
      .then(r => r.json())
      .then(d => {
        if (d.error) setError(d.error);
        else setData(d);
        setLoading(false);
      })
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
    list = [...list].sort((a, b) => {
      const mul = sortAsc ? 1 : -1;
      if (sortKey === "ticker") return mul * a.ticker.localeCompare(b.ticker);
      return mul * ((a as any)[sortKey] - (b as any)[sortKey]);
    });
    return list;
  }, [enriched, filterCat, sortKey, sortAsc]);

  const maxRatio = useMemo(() => Math.max(...filtered.map(r => r.ratio), 1), [filtered]);

  const top5 = useMemo(() => [...enriched].sort((a,b) => b.ratio - a.ratio).slice(0, 5), [enriched]);
  const bot5 = useMemo(() => [...enriched].sort((a,b) => a.ratio - b.ratio).slice(0, 5), [enriched]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortAsc(v => !v);
    else { setSortKey(key); setSortAsc(false); }
  }

  const updatedAt = data?.updatedAt
    ? new Date(data.updatedAt).toLocaleString("en-US", { month:"short", day:"numeric", hour:"2-digit", minute:"2-digit" })
    : null;

  return (
    <div style={{
      minHeight: "100vh",
      background: "#0d0f14",
      color: "#e8eaf0",
      fontFamily: "'DM Mono', 'IBM Plex Mono', 'Courier New', monospace",
      padding: "0 0 60px",
    }}>
      {/* Header */}
      <header style={{
        borderBottom: "1px solid #1e2130",
        padding: "20px 32px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        background: "#0d0f14",
        position: "sticky",
        top: 0,
        zIndex: 100,
      }}>
        <div>
          <div style={{ fontSize: 11, letterSpacing: "0.2em", color: "#4f8ef7", textTransform: "uppercase", marginBottom: 4 }}>
            Market Dashboard
          </div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em", color: "#fff" }}>
            ETF Volume Flow
          </h1>
        </div>
        <div style={{ textAlign: "right" }}>
          {updatedAt && (
            <div style={{ fontSize: 11, color: "#555", letterSpacing: "0.05em" }}>
              Updated {updatedAt}
            </div>
          )}
          <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
            {(["bar", "table"] as View[]).map(v => (
              <button key={v} onClick={() => setView(v)} style={{
                background: view === v ? "#4f8ef7" : "#161924",
                color: view === v ? "#fff" : "#666",
                border: `1px solid ${view === v ? "#4f8ef7" : "#252840"}`,
                borderRadius: 6,
                padding: "6px 14px",
                cursor: "pointer",
                fontSize: 12,
                fontFamily: "inherit",
                letterSpacing: "0.05em",
                textTransform: "uppercase",
                fontWeight: view === v ? 700 : 400,
                transition: "all 0.15s",
              }}>
                {v === "bar" ? "⬛ Chart" : "⊟ Table"}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div style={{ padding: "20px 32px 0" }}>
        {/* Category filter pills */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 24 }}>
          {["All", ...CATEGORIES].map(cat => (
            <button key={cat} onClick={() => setFilterCat(cat)} style={{
              background: filterCat === cat ? (CATEGORY_COLORS[cat] ?? "#4f8ef7") + "22" : "#161924",
              color: filterCat === cat ? (CATEGORY_COLORS[cat] ?? "#4f8ef7") : "#555",
              border: `1px solid ${filterCat === cat ? (CATEGORY_COLORS[cat] ?? "#4f8ef7") + "88" : "#252840"}`,
              borderRadius: 20,
              padding: "5px 14px",
              cursor: "pointer",
              fontSize: 11,
              fontFamily: "inherit",
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              fontWeight: filterCat === cat ? 700 : 400,
              transition: "all 0.15s",
            }}>
              {cat}
            </button>
          ))}
        </div>

        {loading && (
          <div style={{ textAlign: "center", padding: 80, color: "#444" }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>◌</div>
            Loading volume data…
          </div>
        )}

        {error && (
          <div style={{
            background: "#1a0f0f",
            border: "1px solid #4a1f1f",
            borderRadius: 8,
            padding: 24,
            color: "#f7554f",
            fontSize: 13,
          }}>
            <strong>No data available.</strong> {error}
            <div style={{ color: "#666", marginTop: 8, fontSize: 11 }}>
              Trigger the cron job at <code>/api/cron</code> to fetch initial data.
            </div>
          </div>
        )}

        {!loading && !error && data && (
          <>
            {/* Summary row */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 28 }}>
              {[
                { label: "ETFs Tracked", value: enriched.length },
                { label: "Elevated (>1.5×)", value: enriched.filter(r => r.ratio >= 1.5).length, color: "#f7a34f" },
                { label: "Very High (>2×)",  value: enriched.filter(r => r.ratio >= 2).length,   color: "#f7554f" },
                { label: "Low (<0.7×)",       value: enriched.filter(r => r.ratio < 0.7).length,  color: "#b47ff7" },
              ].map(({ label, value, color }) => (
                <div key={label} style={{
                  background: "#161924",
                  border: "1px solid #1e2130",
                  borderRadius: 8,
                  padding: "14px 18px",
                }}>
                  <div style={{ fontSize: 10, color: "#555", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 6 }}>{label}</div>
                  <div style={{ fontSize: 26, fontWeight: 700, color: color ?? "#fff" }}>{value}</div>
                </div>
              ))}
            </div>

            {/* BAR CHART VIEW */}
            {view === "bar" && (
              <div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                  <div style={{ fontSize: 11, color: "#555", letterSpacing: "0.1em" }}>
                    RANKED BY VOLUME RATIO (TODAY ÷ 30-DAY AVG)
                  </div>
                  <div style={{ display: "flex", gap: 16, fontSize: 11, color: "#555" }}>
                    {[
                      { label: "Very High ≥2×", color: "#f7554f" },
                      { label: "Elevated ≥1.5×", color: "#f7a34f" },
                      { label: "Normal ≥1×", color: "#34c98a" },
                      { label: "Low <0.7×", color: "#b47ff7" },
                    ].map(({ label, color }) => (
                      <span key={label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                        <span style={{ width: 8, height: 8, borderRadius: 2, background: color, display: "inline-block" }} />
                        {label}
                      </span>
                    ))}
                  </div>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                  {filtered.map((r, i) => {
                    const pct = Math.min((r.ratio / (maxRatio * 1.05)) * 100, 100);
                    const barColor =
                      r.ratio >= 2   ? "#f7554f" :
                      r.ratio >= 1.5 ? "#f7a34f" :
                      r.ratio >= 1.0 ? "#34c98a" : "#b47ff7";
                    const catColor = CATEGORY_COLORS[r.category] ?? "#4f8ef7";

                    return (
                      <div key={r.ticker} style={{
                        display: "grid",
                        gridTemplateColumns: "90px 1fr 80px",
                        alignItems: "center",
                        gap: 12,
                        padding: "8px 12px",
                        background: i % 2 === 0 ? "#161924" : "#121520",
                        borderRadius: 6,
                        border: "1px solid #1e2130",
                      }}>
                        {/* Ticker + name */}
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <span style={{ width: 3, height: 14, borderRadius: 2, background: catColor, display: "inline-block", flexShrink: 0 }} />
                            <span style={{ fontWeight: 700, fontSize: 13, color: "#fff" }}>{r.ticker}</span>
                            <DirectionArrow dir={r.direction} />
                          </div>
                          <div style={{ fontSize: 10, color: "#555", marginTop: 2, marginLeft: 9, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                            {r.name}
                          </div>
                        </div>

                        {/* Bar */}
                        <div style={{ position: "relative" }}>
                          <div style={{
                            height: 20,
                            background: "#1e2130",
                            borderRadius: 3,
                            overflow: "hidden",
                          }}>
                            <div style={{
                              width: `${pct}%`,
                              height: "100%",
                              background: `${barColor}`,
                              borderRadius: 3,
                              transition: "width 0.4s ease",
                              position: "relative",
                            }}>
                              <div style={{
                                position: "absolute",
                                inset: 0,
                                background: "linear-gradient(90deg, transparent 60%, rgba(255,255,255,0.1))",
                              }} />
                            </div>
                          </div>
                          {/* 1× baseline */}
                          <div style={{
                            position: "absolute",
                            top: 0,
                            left: `${Math.min((1 / (maxRatio * 1.05)) * 100, 100)}%`,
                            width: 1,
                            height: "100%",
                            background: "#333",
                            pointerEvents: "none",
                          }} />
                        </div>

                        {/* Stats */}
                        <div style={{ textAlign: "right" }}>
                          <RatioBadge ratio={r.ratio} />
                          <div style={{ fontSize: 10, color: "#555", marginTop: 3 }}>
                            {fmt(r.volume)} shrs
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* TABLE VIEW */}
            {view === "table" && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
                {/* Top 5 / Bottom 5 summary cards */}
                <div>
                  <div style={{ fontSize: 11, color: "#34c98a", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 12 }}>
                    ▲ Top 5 — Highest Volume Ratio
                  </div>
                  {top5.map((r, i) => (
                    <div key={r.ticker} style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "10px 16px",
                      background: "#161924",
                      border: "1px solid #1e2130",
                      borderRadius: 6,
                      marginBottom: 6,
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ color: "#34c98a", fontSize: 12, width: 16 }}>#{i+1}</span>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 14 }}>{r.ticker} <DirectionArrow dir={r.direction} /></div>
                          <div style={{ fontSize: 10, color: "#555" }}>{r.name}</div>
                        </div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <RatioBadge ratio={r.ratio} />
                        <div style={{ fontSize: 10, color: "#555", marginTop: 3 }}>{fmt(r.volume)} shrs</div>
                      </div>
                    </div>
                  ))}
                </div>

                <div>
                  <div style={{ fontSize: 11, color: "#b47ff7", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 12 }}>
                    ▼ Bottom 5 — Lowest Volume Ratio
                  </div>
                  {bot5.map((r, i) => (
                    <div key={r.ticker} style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "10px 16px",
                      background: "#161924",
                      border: "1px solid #1e2130",
                      borderRadius: 6,
                      marginBottom: 6,
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ color: "#b47ff7", fontSize: 12, width: 16 }}>#{i+1}</span>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 14 }}>{r.ticker} <DirectionArrow dir={r.direction} /></div>
                          <div style={{ fontSize: 10, color: "#555" }}>{r.name}</div>
                        </div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <RatioBadge ratio={r.ratio} />
                        <div style={{ fontSize: 10, color: "#555", marginTop: 3 }}>{fmt(r.volume)} shrs</div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Full sortable table */}
                <div style={{ gridColumn: "1 / -1", marginTop: 8 }}>
                  <div style={{ fontSize: 11, color: "#555", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 12 }}>
                    Full Table — Click Column Headers to Sort
                  </div>
                  <div style={{ background: "#161924", border: "1px solid #1e2130", borderRadius: 8, overflow: "hidden" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                      <thead>
                        <tr style={{ borderBottom: "1px solid #1e2130" }}>
                          {[
                            { key: "ticker", label: "Ticker" },
                            { key: null, label: "Name" },
                            { key: null, label: "Category" },
                            { key: "ratio", label: "Ratio" },
                            { key: "volume", label: "Volume" },
                            { key: "dollarVolume", label: "$Volume (M)" },
                            { key: null, label: "Dir" },
                          ].map(({ key, label }) => (
                            <th key={label}
                              onClick={() => key && toggleSort(key as SortKey)}
                              style={{
                                padding: "10px 14px",
                                textAlign: "left",
                                color: key && sortKey === key ? "#4f8ef7" : "#444",
                                fontSize: 10,
                                letterSpacing: "0.1em",
                                textTransform: "uppercase",
                                cursor: key ? "pointer" : "default",
                                userSelect: "none",
                                fontWeight: 600,
                              }}>
                              {label}{key && sortKey === key ? (sortAsc ? " ↑" : " ↓") : ""}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {filtered.map((r, i) => (
                          <tr key={r.ticker} style={{
                            borderBottom: "1px solid #1a1e2a",
                            background: i % 2 === 0 ? "transparent" : "#12151f",
                          }}>
                            <td style={{ padding: "9px 14px", fontWeight: 700, color: "#fff" }}>{r.ticker}</td>
                            <td style={{ padding: "9px 14px", color: "#888", fontSize: 11 }}>{r.name}</td>
                            <td style={{ padding: "9px 14px" }}>
                              <span style={{
                                background: (CATEGORY_COLORS[r.category] ?? "#4f8ef7") + "22",
                                color: CATEGORY_COLORS[r.category] ?? "#4f8ef7",
                                borderRadius: 3,
                                padding: "2px 6px",
                                fontSize: 10,
                                letterSpacing: "0.04em",
                              }}>
                                {r.category}
                              </span>
                            </td>
                            <td style={{ padding: "9px 14px" }}><RatioBadge ratio={r.ratio} /></td>
                            <td style={{ padding: "9px 14px", fontFamily: "monospace", color: "#ccc" }}>{fmt(r.volume)}</td>
                            <td style={{ padding: "9px 14px", fontFamily: "monospace", color: "#ccc" }}>${r.dollarVolume.toLocaleString()}M</td>
                            <td style={{ padding: "9px 14px" }}><DirectionArrow dir={r.direction} /></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
