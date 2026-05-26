import { NextResponse } from "next/server";
import { redis } from "@/app/lib/redis";
import { defaultSettings } from "@/app/data";
import type { AppSettings, SpecialDate } from "@/app/data";

const KEY = "mishmarot:settings";

function normalizeSettings(v: unknown): AppSettings | null {
  if (!v || typeof v !== "object") return null;
  const c = v as Record<string, unknown>;
  const periodStart = typeof c.periodStart === "string" ? c.periodStart : "";
  const periodEnd = typeof c.periodEnd === "string" ? c.periodEnd : "";
  if (!periodStart || !periodEnd) return null;
  const specialDates: SpecialDate[] = Array.isArray(c.specialDates)
    ? (c.specialDates as unknown[]).filter((item): item is SpecialDate =>
        !!item && typeof item === "object" &&
        typeof (item as Record<string, unknown>).id === "string" &&
        typeof (item as Record<string, unknown>).date === "string" &&
        typeof (item as Record<string, unknown>).label === "string"
      )
    : [];
  return { periodStart, periodEnd, specialDates };
}

async function loadSettings(): Promise<AppSettings> {
  const raw = await redis.get(KEY);
  const normalized = normalizeSettings(raw);
  if (normalized) return normalized;
  await redis.set(KEY, defaultSettings);
  return defaultSettings;
}

export async function GET() {
  try {
    return NextResponse.json(await loadSettings());
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json();
    const normalized = normalizeSettings(body);
    if (!normalized) return NextResponse.json({ error: "Invalid" }, { status: 400 });
    await redis.set(KEY, normalized);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
