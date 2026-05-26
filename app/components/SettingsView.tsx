"use client";
import { useState } from "react";
import type { User, Soldier, AppSettings, SpecialDate } from "../data";

type Props = {
  loggedInUser: User;
  users: User[];
  soldiers: Soldier[];
  settings: AppSettings;
  onChangePassword: (userId: string, newPassword: string) => Promise<void>;
  onResetPassword: (userId: string) => Promise<void>;
  onAddUser: (username: string, displayName: string, role: "admin" | "scheduler") => Promise<void>;
  onDeleteUser: (userId: string) => Promise<void>;
  onSetTrainee: (soldierId: string, isTrainee: boolean) => Promise<void>;
  onDeleteSoldier: (soldierId: string) => Promise<void>;
  onSaveSettings: (settings: AppSettings) => Promise<void>;
  onDeleteAllShifts: () => Promise<void>;
};

export function SettingsView({
  loggedInUser, users, soldiers, settings,
  onChangePassword, onResetPassword, onAddUser, onDeleteUser,
  onSetTrainee, onDeleteSoldier, onSaveSettings, onDeleteAllShifts,
}: Props) {
  const isAdmin = loggedInUser.role === "admin";
  const [oldPw, setOldPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [pwMsg, setPwMsg] = useState("");
  const [newUsername, setNewUsername] = useState("");
  const [newDisplayName, setNewDisplayName] = useState("");
  const [newUserRole, setNewUserRole] = useState<"admin" | "scheduler">("scheduler");
  const [specialDate, setSpecialDate] = useState("");
  const [specialLabel, setSpecialLabel] = useState("");
  const [localSettings, setLocalSettings] = useState<AppSettings>({ ...settings });
  const [isSaving, setIsSaving] = useState(false);
  const [msg, setMsg] = useState("");

  async function handleChangePw() {
    const me = users.find((u) => u.id === loggedInUser.id);
    if (!me || me.password !== oldPw) { setPwMsg("סיסמה ישנה שגויה"); return; }
    if (newPw.length < 4) { setPwMsg("סיסמה חדשה קצרה מדי"); return; }
    await onChangePassword(loggedInUser.id, newPw);
    setPwMsg("סיסמה שונתה בהצלחה ✓");
    setOldPw(""); setNewPw("");
  }

  async function handleSave() {
    setIsSaving(true);
    await onSaveSettings(localSettings);
    setIsSaving(false);
    setMsg("הגדרות נשמרו ✓");
    setTimeout(() => setMsg(""), 3000);
  }

  function handleAddSpecialDate() {
    if (!specialDate || !specialLabel) return;
    const next: SpecialDate[] = [
      ...localSettings.specialDates.filter((s) => s.date !== specialDate),
      { id: `sd-${Date.now()}`, date: specialDate, label: specialLabel },
    ];
    setLocalSettings((s) => ({ ...s, specialDates: next }));
    setSpecialDate(""); setSpecialLabel("");
  }

  return (
    <div className="p-4 space-y-6 overflow-y-auto pb-20">
      <h2 className="text-lg font-bold text-white">הגדרות</h2>

      {/* Change my password — available to all */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4 space-y-3">
        <h3 className="text-sm font-semibold text-zinc-200">שינוי סיסמה</h3>
        <input type="password" value={oldPw} onChange={(e) => setOldPw(e.target.value)}
          placeholder="סיסמה ישנה"
          className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white" />
        <input type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)}
          placeholder="סיסמה חדשה"
          className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white" />
        {pwMsg && <p className="text-xs text-green-400">{pwMsg}</p>}
        <button type="button" onClick={handleChangePw}
          className="w-full rounded-xl bg-blue-600 py-2 text-sm font-semibold text-white hover:bg-blue-700">
          שנה סיסמה
        </button>
      </div>

      {/* Soldiers list — trainee toggle for all, delete only for admin */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4 space-y-3">
        <h3 className="text-sm font-semibold text-zinc-200">כוח האדם ({soldiers.length})</h3>
        <div className="space-y-2">
          {soldiers.map((s) => (
            <div key={s.id} className="flex items-center gap-2 rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2">
              <span className="flex-1 text-sm text-white">{s.name}</span>
              <button type="button" onClick={() => onSetTrainee(s.id, !s.isTrainee)}
                className={`text-xs px-2 py-1 rounded-lg border ${
                  s.isTrainee
                    ? "border-orange-500/40 bg-orange-500/20 text-orange-300"
                    : "border-zinc-600 bg-zinc-700 text-zinc-400"
                }`}>
                {s.isTrainee ? "מתלמד/ת ✓" : "מתלמד/ת"}
              </button>
              {isAdmin && (
                <button type="button" onClick={() => onDeleteSoldier(s.id)}
                  className="text-zinc-600 hover:text-red-400 text-sm">✕</button>
              )}
            </div>
          ))}
        </div>
        {!isAdmin && (
          <p className="text-xs text-zinc-500">רק מנהל יכול למחוק חיילים</p>
        )}
      </div>

      {/* Admin-only sections */}
      {isAdmin && (
        <>
          {/* Reset other users' passwords */}
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4 space-y-3">
            <h3 className="text-sm font-semibold text-zinc-200">ניהול משתמשים</h3>
            {users.filter((u) => u.id !== loggedInUser.id).map((u) => (
              <div key={u.id} className="flex items-center gap-2 rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2">
                <span className="flex-1 text-sm text-white">{u.displayName}</span>
                <span className="text-xs text-zinc-400">{u.role === "admin" ? "מנהל" : "מתזמן"}</span>
                <button type="button" onClick={() => onResetPassword(u.id)}
                  className="text-xs border border-zinc-600 bg-zinc-700 px-2 py-1 rounded-lg text-zinc-300 hover:bg-zinc-600">
                  איפוס סיסמה
                </button>
                <button type="button" onClick={() => onDeleteUser(u.id)}
                  className="text-zinc-600 hover:text-red-400 text-sm">✕</button>
              </div>
            ))}

            <div className="space-y-2 pt-2 border-t border-zinc-700">
              <p className="text-xs text-zinc-400">הוסף משתמש חדש</p>
              <input type="text" value={newUsername} onChange={(e) => setNewUsername(e.target.value)}
                placeholder="שם משתמש (לכניסה)"
                className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white" />
              <input type="text" value={newDisplayName} onChange={(e) => setNewDisplayName(e.target.value)}
                placeholder="שם תצוגה"
                className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white" />
              <select value={newUserRole} onChange={(e) => setNewUserRole(e.target.value as "admin" | "scheduler")}
                className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white">
                <option value="scheduler">מתזמן</option>
                <option value="admin">מנהל</option>
              </select>
              <button type="button"
                onClick={async () => {
                  if (!newUsername || !newDisplayName) return;
                  await onAddUser(newUsername, newDisplayName, newUserRole);
                  setNewUsername(""); setNewDisplayName("");
                }}
                className="w-full rounded-xl bg-zinc-700 py-2 text-sm font-semibold text-white hover:bg-zinc-600">
                הוסף משתמש
              </button>
            </div>
          </div>

          {/* Period + special dates */}
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4 space-y-3">
            <h3 className="text-sm font-semibold text-zinc-200">תקופת שירות ותאריכים מיוחדים</h3>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-zinc-400 block mb-1">התחלה</label>
                <input type="date" value={localSettings.periodStart}
                  onChange={(e) => setLocalSettings((s) => ({ ...s, periodStart: e.target.value }))}
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white" />
              </div>
              <div>
                <label className="text-xs text-zinc-400 block mb-1">סיום</label>
                <input type="date" value={localSettings.periodEnd}
                  onChange={(e) => setLocalSettings((s) => ({ ...s, periodEnd: e.target.value }))}
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white" />
              </div>
            </div>

            {/* Special dates */}
            <div className="space-y-2 pt-2 border-t border-zinc-700">
              <p className="text-xs text-zinc-400">תאריכים מיוחדים</p>
              {localSettings.specialDates.map((sd) => (
                <div key={sd.id} className="flex items-center gap-2">
                  <span className="flex-1 text-sm text-amber-300">{sd.label} — {sd.date}</span>
                  <button type="button"
                    onClick={() => setLocalSettings((s) => ({
                      ...s, specialDates: s.specialDates.filter((x) => x.id !== sd.id),
                    }))}
                    className="text-zinc-600 hover:text-red-400">✕</button>
                </div>
              ))}
              <div className="grid grid-cols-2 gap-2">
                <input type="date" value={specialDate} onChange={(e) => setSpecialDate(e.target.value)}
                  className="rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white" />
                <input type="text" value={specialLabel} onChange={(e) => setSpecialLabel(e.target.value)}
                  placeholder="תווית (למשל: ט׳ באב)"
                  className="rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white" />
              </div>
              <button type="button" onClick={handleAddSpecialDate}
                className="text-xs text-zinc-400 hover:text-zinc-200">
                + הוסף תאריך מיוחד
              </button>
            </div>

            {msg && <p className="text-xs text-green-400">{msg}</p>}
            <button type="button" onClick={handleSave} disabled={isSaving}
              className="w-full rounded-xl bg-blue-600 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
              {isSaving ? "שומר..." : "שמור הגדרות"}
            </button>
          </div>

          {/* Danger zone */}
          <div className="rounded-2xl border border-red-900/40 bg-red-950/20 p-4 space-y-3">
            <h3 className="text-sm font-semibold text-red-300">אזור מסוכן</h3>
            <button type="button"
              onClick={async () => {
                if (!window.confirm("האם אתה בטוח? פעולה זו תמחק את כל המשמרות לצמיתות.")) return;
                await onDeleteAllShifts();
              }}
              className="w-full rounded-xl border border-red-700/40 bg-red-900/20 py-2 text-sm font-semibold text-red-300 hover:bg-red-900/40">
              מחק את כל המשמרות
            </button>
          </div>
        </>
      )}
    </div>
  );
}
