import { NextResponse } from "next/server";
import { redis, REDIS_KEY, VolumeData } from "@/lib/redis";

export const revalidate = 3600; // cache 1 hour

export async function GET() {
  try {
    const raw = await redis.get<string>(REDIS_KEY);
    if (!raw) {
      return NextResponse.json({ error: "No data yet. Run the cron job first." }, { status: 404 });
    }
    const data: VolumeData = typeof raw === "string" ? JSON.parse(raw) : raw;
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: "Redis error" }, { status: 500 });
  }
}

