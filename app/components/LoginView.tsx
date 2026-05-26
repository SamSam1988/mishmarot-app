"use client";
import { useState } from "react";
import type { User } from "../data";

type Props = {
  users: User[];
  onLogin: (user: User) => void;
};

export function LoginView({ users, onLogin }: Props) {
  const [selected, setSelected] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  function handleLogin() {
    const user = users.find((u) => u.username === selected);
    if (!user) { setError("משתמש לא נמצא"); return; }
    if (user.password !== password) { setError("סיסמה שגויה"); return; }
    setError("");
    onLogin(user);
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-white">שיבוצי משמרות</h1>
          <p className="text-zinc-400 mt-1 text-sm">התחברות למערכת</p>
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6 space-y-4">
          <div className="space-y-2">
            <label className="text-sm text-zinc-300">שם משתמש</label>
            <select
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
              className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2.5 text-white"
            >
              <option value="">-- בחר משתמש --</option>
              {users.map((u) => (
                <option key={u.id} value={u.username}>{u.displayName}</option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm text-zinc-300">סיסמה</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleLogin()}
              className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2.5 text-white"
              placeholder="הכנס סיסמה"
            />
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <button
            type="button"
            onClick={handleLogin}
            className="w-full rounded-xl bg-blue-600 py-3 font-semibold text-white hover:bg-blue-700 transition"
          >
            כניסה
          </button>
        </div>
      </div>
    </div>
  );
}
