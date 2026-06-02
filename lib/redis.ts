import { Redis } from "@upstash/redis";

export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

export const REDIS_KEY = "etf_volume_data";

export type ETFVolumeRecord = {
  ticker: string;
  date: string;           // YYYY-MM-DD
  volume: number;         // today's share volume
  avg30: number;          // 30-day avg volume
  ratio: number;          // volume / avg30
  prevVolume: number;     // yesterday's volume (for direction)
  direction: "up" | "down" | "neutral";
  price: number;          // closing price
  dollarVolume: number;   // volume * price (in millions)
};

export type VolumeData = {
  updatedAt: string;
  records: ETFVolumeRecord[];
};
