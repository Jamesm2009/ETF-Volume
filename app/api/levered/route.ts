export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import { LEVERED_ETFS } from "@/lib/levered";

export const maxDuration = 60;

const REDIS_KEY = "levered_volume_data";

async function fetchLeveredData(): Promise<Record<string, any>> {
  const results: Record<string, any> = {};

  await Promise.all(
    LEVERED_ETFS.map(async (etf) => {
      try {
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${etf.ticker}?interval=1d&range=30d`;
        const res = await fetch(url, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
            "Accept": "application/json",
          },
        });
        if (!res.ok) return;
        const json = await res.json();
        const chart = json?.chart?.result?.[0];
        if (!chart) return;

        const timestamps: number[] = chart.timestamp || [];
        const closes:  number[] = chart.indicators?.quote?.[0]?.close  || [];
        const volumes: number[] = chart.indicators?.quote?.[0]?.volume || [];

        const validDays = timestamps
          .map((t, i) => ({ t, c: closes[i], v: volumes[i] }))
          .filter(d => d.v != null && d.c != null && d.v > 0);

        if (validDays.length < 2) return;

        const today     = validDays[validDays.length - 1];
        const last5vols = validDays.slice(-5).map(d => d.v);
        const avg5      = Math.round(last5vols.reduce((a, b) => a + b, 0) / last5vols.length);

        // YTD: first close of current year
        const curYear = new Date().getFullYear();
        const firstOfYear = validDays.find(d => new Date(d.t * 1000).getFullYear() === curYear);
        const ytd = firstOfYear && today.c
          ? Math.round(((today.c - firstOfYear.c) / firstOfYear.c) * 10000) / 100
          : null;

        // 1D change: compare last two closes
        const prev   = validDays[validDays.length - 2];
        const chg1d  = prev?.c && today.c
          ? Math.round(((today.c - prev.c) / prev.c) * 10000) / 100
          : null;

        const meta = chart.meta;
        results[etf.ticker] = {
          volume:  Math.round(today.v),
          avg5,
          price:   Math.round((meta?.regularMarketPrice ?? today.c) * 100) / 100,
          chg1d,
          ytd,
        };
      } catch (e) {
        console.error(`Levered fetch failed ${etf.ticker}:`, e);
      }
    })
  );

  return results;
}

export async function GET() {
  try {
    const redis = new Redis({
      url:   process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    });

    // Check cache (4 hour TTL)
    const cached = await redis.get<string>(REDIS_KEY);
    if (cached) {
      const parsed = typeof cached === "string" ? JSON.parse(cached) : cached;
      return NextResponse.json({ ...parsed, fromCache: true });
    }

    const raw = await fetchLeveredData();

    // Compute group totals for % of group
    const totalAvg5 = LEVERED_ETFS.reduce((s, e) => s + (raw[e.ticker]?.avg5 ?? 0), 0);
    const bullAvg5  = LEVERED_ETFS.filter(e => e.bias === "bull").reduce((s, e) => s + (raw[e.ticker]?.avg5 ?? 0), 0);
    const bearAvg5  = LEVERED_ETFS.filter(e => e.bias === "bear").reduce((s, e) => s + (raw[e.ticker]?.avg5 ?? 0), 0);
    const bbRatio   = bearAvg5 > 0 ? Math.round((bullAvg5 / bearAvg5) * 100) / 100 : null;

    const etfs = LEVERED_ETFS
      .map(etf => {
        const d = raw[etf.ticker];
        return {
          ticker:     etf.ticker,
          name:       etf.name,
          bias:       etf.bias,
          underlying: etf.underlying,
          volume:     d?.volume  ?? null,
          avg5:       d?.avg5    ?? null,
          price:      d?.price   ?? null,
          chg1d:      d?.chg1d   ?? null,
          ytd:        d?.ytd     ?? null,
          pctOfGroup: totalAvg5 > 0 && d?.avg5
            ? Math.round((d.avg5 / totalAvg5) * 10000) / 100
            : null,
        };
      })
      .sort((a, b) => (b.avg5 ?? -1) - (a.avg5 ?? -1));

    const payload = {
      etfs,
      meta: { totalAvg5, bullAvg5, bearAvg5, bbRatio, updatedAt: new Date().toISOString() },
    };

    // Cache 4 hours
    await redis.set(REDIS_KEY, JSON.stringify(payload), { ex: 14400 });

    return NextResponse.json(payload);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
