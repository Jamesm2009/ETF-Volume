import { NextResponse } from "next/server";
import { redis, REDIS_KEY, ETFVolumeRecord, VolumeData } from "@/lib/redis";
import { ETFS } from "@/lib/etfs";

export const maxDuration = 60;

async function fetchYFinanceData(tickers: string[]): Promise<Record<string, any>> {
  const results: Record<string, any> = {};
  await Promise.all(
    tickers.map(async (ticker) => {
      try {
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=90d`;
        const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
        if (!res.ok) return;
        const json = await res.json();
        const chart = json?.chart?.result?.[0];
        if (!chart) return;

        const timestamps: number[] = chart.timestamp || [];
        const opens:   number[] = chart.indicators?.quote?.[0]?.open   || [];
        const closes:  number[] = chart.indicators?.quote?.[0]?.close  || [];
        const volumes: number[] = chart.indicators?.quote?.[0]?.volume || [];

        const validDays = timestamps
          .map((t, i) => ({ t, o: opens[i], c: closes[i], v: volumes[i] }))
          .filter(d => d.v != null && d.c != null && d.o != null && d.v > 0);

        if (validDays.length < 6) return;

        const yesterday = validDays[validDays.length - 1];
        const dayBefore = validDays[validDays.length - 2];

        // 30-day avg excluding yesterday
        const last30 = validDays.slice(-31, -1);
        const avg30 = last30.length > 0
          ? last30.reduce((sum, d) => sum + d.v, 0) / last30.length
          : yesterday.v;

        const ratio = avg30 > 0 ? yesterday.v / avg30 : 1;

        // Flow direction: close vs open (Investing.com method)
        function flowDir(d: { o: number; c: number }): "inflow" | "outflow" | "neutral" {
          const chg = (d.c - d.o) / d.o;
          if (chg > 0.001)  return "inflow";
          if (chg < -0.001) return "outflow";
          return "neutral";
        }

        // Last 5 completed trading days for sparkline
        const last5 = validDays.slice(-5).map(d => ({
          date:      new Date(d.t * 1000).toISOString().split("T")[0],
          volume:    Math.round(d.v),
          flow:      flowDir(d),
          ratio:     Math.round((avg30 > 0 ? d.v / avg30 : 1) * 100) / 100,
        }));

        results[ticker] = {
          volume:       Math.round(yesterday.v),
          avg30:        Math.round(avg30),
          ratio:        Math.round(ratio * 100) / 100,
          prevVolume:   Math.round(dayBefore.v),
          flow:         flowDir(yesterday),
          price:        Math.round(yesterday.c * 100) / 100,
          dollarVolume: Math.round((yesterday.v * yesterday.c) / 1_000_000),
          date:         new Date(yesterday.t * 1000).toISOString().split("T")[0],
          last5,
        };
      } catch (e) {
        console.error(`Failed ${ticker}:`, e);
      }
    })
  );
  return results;
}

export async function GET() {
  const tickers = ETFS.map(e => e.ticker);
  const raw = await fetchYFinanceData(tickers);

  const records: ETFVolumeRecord[] = ETFS.map(etf => {
    const d = raw[etf.ticker];
    if (!d) return {
      ticker: etf.ticker,
      date: new Date().toISOString().split("T")[0],
      volume: 0, avg30: 0, ratio: 0, prevVolume: 0,
      flow: "neutral" as const, price: 0, dollarVolume: 0, last5: [],
    };
    return { ticker: etf.ticker, ...d };
  });

  const payload: VolumeData = { updatedAt: new Date().toISOString(), records };
  await redis.set(REDIS_KEY, JSON.stringify(payload));
  return NextResponse.json({ ok: true, count: records.length, updatedAt: payload.updatedAt });
}
