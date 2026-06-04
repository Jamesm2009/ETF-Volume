import { NextResponse } from "next/server";
import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

const REDIS_KEY = "etf_volume_data";

export async function GET() {
  try {
    const raw = await redis.get<string>(REDIS_KEY);
    if (!raw) {
      return NextResponse.json({ error: "No data yet. Visit /api/cron to seed." }, { status: 404 });
    }
    const data = typeof raw === "string" ? JSON.parse(raw) : raw;
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: "Redis error" }, { status: 500 });
  }
}
