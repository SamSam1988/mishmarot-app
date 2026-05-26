import { NextResponse } from "next/server";
import { redis } from "@/app/lib/redis";
import { defaultSoldiers } from "@/app/data";
import type { Soldier } from "@/app/data";

const KEY = "mishmarot:soldiers";

function normalizeSoldier(v: unknown): Soldier | null {
  if (!v || typeof v !== "object") return null;
  const c = v as Record<string, unknown>;
  const id = typeof c.id === "string" ? c.id : "";
  const name = typeof c.name === "string" ? c.name : "";
  if (!id || !name) return null;
  return { id, name, isTrainee: c.isTrainee === true };
}

async function loadSoldiers(): Promise<Soldier[]> {
  const raw = await redis.lrange(KEY, 0, -1);
  if (Array.isArray(raw) && raw.length > 0) {
    const parsed = raw
      .map((item: unknown) => {
        if (typeof item === "string") { try { return JSON.parse(item); } catch { return null; } }
        return item;
      })
      .map(normalizeSoldier)
      .filter((s): s is Soldier => s !== null);
    if (parsed.length > 0) return parsed;
  }
  await saveSoldiers(defaultSoldiers);
  return defaultSoldiers;
}

async function saveSoldiers(soldiers: Soldier[]) {
  await redis.del(KEY);
  if (soldiers.length > 0) {
    await redis.rpush(KEY, ...soldiers.map((s) => JSON.stringify(s)));
  }
}

export async function GET() {
  try {
    return NextResponse.json(await loadSoldiers());
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as Record<string, unknown>;
    const soldiers = await loadSoldiers();

    if (body.action === "add" && typeof body.name === "string") {
      const exists = soldiers.find((s) => s.name === body.name);
      if (exists) return NextResponse.json({ ok: true, soldier: exists });
      const newSoldier: Soldier = {
        id: `sol-${Date.now()}`,
        name: body.name,
        isTrainee: body.isTrainee === true,
      };
      await saveSoldiers([...soldiers, newSoldier]);
      return NextResponse.json({ ok: true, soldier: newSoldier });
    }

    if (body.action === "setTrainee" && typeof body.soldierId === "string") {
      await saveSoldiers(soldiers.map((s) =>
        s.id === body.soldierId ? { ...s, isTrainee: body.isTrainee === true } : s
      ));
      return NextResponse.json({ ok: true });
    }

    if (body.action === "delete" && typeof body.soldierId === "string") {
      await saveSoldiers(soldiers.filter((s) => s.id !== body.soldierId));
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
