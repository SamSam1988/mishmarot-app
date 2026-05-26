import { NextResponse } from "next/server";
import { redis } from "@/app/lib/redis";
import { defaultUsers } from "@/app/data";
import type { User } from "@/app/data";

const KEY = "mishmarot:users";

function normalizeUser(v: unknown): User | null {
  if (!v || typeof v !== "object") return null;
  const c = v as Record<string, unknown>;
  const id = typeof c.id === "string" ? c.id : "";
  const username = typeof c.username === "string" ? c.username : "";
  const displayName = typeof c.displayName === "string" ? c.displayName : "";
  const password = typeof c.password === "string" ? c.password : "";
  const role = c.role === "admin" ? "admin" : "scheduler";
  if (!id || !username || !displayName || !password) return null;
  return { id, username, displayName, password, role };
}

async function loadUsers(): Promise<User[]> {
  const raw = await redis.lrange(KEY, 0, -1);
  if (Array.isArray(raw) && raw.length > 0) {
    const parsed = raw
      .map((item: unknown) => {
        if (typeof item === "string") { try { return JSON.parse(item); } catch { return null; } }
        return item;
      })
      .map(normalizeUser)
      .filter((u): u is User => u !== null);
    if (parsed.length > 0) return parsed;
  }
  await saveUsers(defaultUsers);
  return defaultUsers;
}

async function saveUsers(users: User[]) {
  await redis.del(KEY);
  if (users.length > 0) {
    await redis.rpush(KEY, ...users.map((u) => JSON.stringify(u)));
  }
}

export async function GET() {
  try {
    return NextResponse.json(await loadUsers());
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as Record<string, unknown>;
    const users = await loadUsers();

    if (body.action === "changePassword" && typeof body.userId === "string" && typeof body.newPassword === "string") {
      const newPassword = body.newPassword;
      await saveUsers(users.map((u) => u.id === body.userId ? { ...u, password: newPassword } : u));
      return NextResponse.json({ ok: true });
    }
    if (body.action === "resetPassword" && typeof body.userId === "string") {
      await saveUsers(users.map((u) => u.id === body.userId ? { ...u, password: "1234" } : u));
      return NextResponse.json({ ok: true });
    }
    if (body.action === "addUser" && typeof body.username === "string" && typeof body.displayName === "string") {
      const newUser: User = {
        id: `user-${Date.now()}`,
        username: body.username,
        displayName: body.displayName,
        password: "1234",
        role: body.role === "admin" ? "admin" : "scheduler",
      };
      await saveUsers([...users, newUser]);
      return NextResponse.json({ ok: true, user: newUser });
    }
    if (body.action === "deleteUser" && typeof body.userId === "string") {
      await saveUsers(users.filter((u) => u.id !== body.userId));
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
