import { NextResponse } from "next/server";
import { redis } from "@/app/lib/redis";
import type { Shift } from "@/app/data";

const KEY = "mishmarot:shifts";

function normalizeShift(v: unknown): Shift | null {
  if (!v || typeof v !== "object") return null;
  const c = v as Record<string, unknown>;
  const id = typeof c.id === "string" ? c.id : "";
  const date = typeof c.date === "string" ? c.date : "";
  const startHour = typeof c.startHour === "number" ? c.startHour : -1;
  const soldierId = typeof c.soldierId === "string" ? c.soldierId : "";
  const soldierName = typeof c.soldierName === "string" ? c.soldierName : "";
  if (!id || !date || startHour < 0 || !soldierId || !soldierName) return null;
  const backups = Array.isArray(c.backups)
    ? (c.backups as unknown[]).filter((b): b is { soldierId: string; soldierName: string; type: "צל" | "גיבוי" } =>
        !!b && typeof b === "object" &&
        typeof (b as Record<string, unknown>).soldierId === "string" &&
        typeof (b as Record<string, unknown>).soldierName === "string"
      )
    : [];
  return {
    id, date, startHour, soldierId, soldierName, backups,
    isPast: c.isPast === true,
    createdAt: typeof c.createdAt === "number" ? c.createdAt : Date.now(),
  };
}

async function loadShifts(): Promise<Shift[]> {
  const raw = await redis.lrange(KEY, 0, -1);
  return raw
    .map((item: unknown) => {
      if (typeof item === "string") { try { return JSON.parse(item); } catch { return null; } }
      return item;
    })
    .map(normalizeShift)
    .filter((s): s is Shift => s !== null);
}

async function saveShifts(shifts: Shift[]) {
  await redis.del(KEY);
  if (shifts.length > 0) {
    await redis.rpush(KEY, ...shifts.map((s) => JSON.stringify(s)));
  }
}

export async function GET() {
  try {
    return NextResponse.json(await loadShifts());
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as Record<string, unknown>;
    const shifts = await loadShifts();

    if (body.action === "add") {
      const shift = normalizeShift(body.shift);
      if (!shift) return NextResponse.json({ error: "Invalid shift" }, { status: 400 });
      await saveShifts([...shifts, shift]);
      return NextResponse.json({ ok: true, shift });
    }

    if (body.action === "update" && typeof body.shiftId === "string") {
      const updated = shifts.map((s) => {
        if (s.id !== body.shiftId) return s;
        const patch = body.patch as Record<string, unknown>;
        return { ...s, ...patch };
      });
      await saveShifts(updated);
      return NextResponse.json({ ok: true });
    }

    if (body.action === "delete" && typeof body.shiftId === "string") {
      await saveShifts(shifts.filter((s) => s.id !== body.shiftId));
      return NextResponse.json({ ok: true });
    }

    if (body.action === "deleteAll") {
      await saveShifts([]);
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
