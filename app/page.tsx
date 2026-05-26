"use client";
import { useState, useEffect } from "react";
import type { User, Soldier, Shift, AppSettings } from "./data";
import { LoginView } from "./components/LoginView";
import { ShiftsView } from "./components/ShiftsView";
import { StatsView } from "./components/StatsView";
import { SettingsView } from "./components/SettingsView";

type Tab = "shifts" | "stats" | "settings";

export default function Home() {
  const [users, setUsers] = useState<User[]>([]);
  const [soldiers, setSoldiers] = useState<Soldier[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [settings, setSettings] = useState<AppSettings>({
    periodStart: "2026-07-01",
    periodEnd: "2026-10-01",
    specialDates: [],
  });
  const [loggedInUser, setLoggedInUser] = useState<User | null>(null);
  const [tab, setTab] = useState<Tab>("shifts");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadAll() {
      try {
        const [uRes, sRes, shRes, stRes] = await Promise.all([
          fetch("/api/users"),
          fetch("/api/soldiers"),
          fetch("/api/shifts"),
          fetch("/api/settings"),
        ]);
        const [u, s, sh, st] = await Promise.all([
          uRes.json(), sRes.json(), shRes.json(), stRes.json(),
        ]);
        setUsers(u as User[]);
        setSoldiers(s as Soldier[]);
        setShifts(sh as Shift[]);
        setSettings(st as AppSettings);
      } catch (e) {
        console.error(e);
      }
      setLoading(false);
    }
    void loadAll();
  }, []);

  async function handleAddShift(shift: Shift) {
    await fetch("/api/shifts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "add", shift }),
    });
    setShifts((prev) => [...prev, shift]);
  }

  async function handleUpdateShift(shiftId: string, patch: Partial<Shift>) {
    await fetch("/api/shifts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "update", shiftId, patch }),
    });
    setShifts((prev) => prev.map((s) => s.id === shiftId ? { ...s, ...patch } : s));
  }

  async function handleDeleteShift(shiftId: string) {
    await fetch("/api/shifts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete", shiftId }),
    });
    setShifts((prev) => prev.filter((s) => s.id !== shiftId));
  }

  async function handleDeleteAllShifts() {
    await fetch("/api/shifts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "deleteAll" }),
    });
    setShifts([]);
  }

  async function handleAddSoldier(name: string, isTrainee: boolean): Promise<Soldier> {
    const res = await fetch("/api/soldiers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "add", name, isTrainee }),
    });
    const data = await res.json() as { soldier: Soldier };
    setSoldiers((prev) => {
      const exists = prev.find((s) => s.id === data.soldier.id);
      return exists ? prev : [...prev, data.soldier];
    });
    return data.soldier;
  }

  async function handleSetTrainee(soldierId: string, isTrainee: boolean) {
    await fetch("/api/soldiers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "setTrainee", soldierId, isTrainee }),
    });
    setSoldiers((prev) => prev.map((s) => s.id === soldierId ? { ...s, isTrainee } : s));
  }

  async function handleDeleteSoldier(soldierId: string) {
    await fetch("/api/soldiers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete", soldierId }),
    });
    setSoldiers((prev) => prev.filter((s) => s.id !== soldierId));
  }

  async function handleChangePassword(userId: string, newPassword: string) {
    await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "changePassword", userId, newPassword }),
    });
    setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, password: newPassword } : u));
  }

  async function handleResetPassword(userId: string) {
    await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "resetPassword", userId }),
    });
    setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, password: "1234" } : u));
  }

  async function handleAddUser(username: string, displayName: string, role: "admin" | "scheduler") {
    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "addUser", username, displayName, role }),
    });
    const data = await res.json() as { user: User };
    setUsers((prev) => [...prev, data.user]);
  }

  async function handleDeleteUser(userId: string) {
    await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "deleteUser", userId }),
    });
    setUsers((prev) => prev.filter((u) => u.id !== userId));
  }

  async function handleSaveSettings(newSettings: AppSettings) {
    await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newSettings),
    });
    setSettings(newSettings);
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-zinc-400 text-lg">טוען...</p>
      </div>
    );
  }

  if (!loggedInUser) {
    return <LoginView users={users} onLogin={setLoggedInUser} />;
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: "shifts", label: "תכנון משמרות" },
    { id: "stats", label: "סטטיסטיקה" },
    { id: "settings", label: "הגדרות" },
  ];

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 bg-zinc-900">
        <h1 className="text-base font-bold text-white">שיבוצי משמרות</h1>
        <button
          type="button"
          onClick={() => setLoggedInUser(null)}
          className="text-xs text-zinc-400 hover:text-white"
        >
          יציאה ({loggedInUser.displayName})
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-zinc-800 bg-zinc-900">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`flex-1 py-3 text-sm font-semibold transition ${
              tab === t.id
                ? "text-blue-400 border-b-2 border-blue-400"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {tab === "shifts" && (
          <ShiftsView
            loggedInUser={loggedInUser}
            shifts={shifts}
            soldiers={soldiers}
            specialDates={settings.specialDates}
            periodStart={settings.periodStart}
            periodEnd={settings.periodEnd}
            onAddShift={handleAddShift}
            onUpdateShift={handleUpdateShift}
            onDeleteShift={handleDeleteShift}
            onAddSoldier={handleAddSoldier}
          />
        )}
        {tab === "stats" && (
          <StatsView shifts={shifts} soldiers={soldiers} />
        )}
        {tab === "settings" && (
          <SettingsView
            loggedInUser={loggedInUser}
            users={users}
            soldiers={soldiers}
            settings={settings}
            onChangePassword={handleChangePassword}
            onResetPassword={handleResetPassword}
            onAddUser={handleAddUser}
            onDeleteUser={handleDeleteUser}
            onSetTrainee={handleSetTrainee}
            onDeleteSoldier={handleDeleteSoldier}
            onSaveSettings={handleSaveSettings}
            onDeleteAllShifts={handleDeleteAllShifts}
          />
        )}
      </div>
    </div>
  );
}
