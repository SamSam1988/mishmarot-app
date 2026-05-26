"use client";
import { useMemo } from "react";
import type { Shift, Soldier } from "../data";

type Props = {
  shifts: Shift[];
  soldiers: Soldier[];
};

function isNightHour(h: number) { return h >= 22 || h < 6; }
function isShabbatHour(dateStr: string, h: number) {
  const d = new Date(dateStr);
  const day = d.getDay();
  // Friday from 19:00 = shabbat start, Saturday until 20:00
  if (day === 5 && h >= 19) return true;
  if (day === 6 && h < 20) return true;
  return false;
}
function isMorningHour(h: number) { return h >= 6 && h < 12; }

function getShiftDuration(shift: Shift, allShifts: Shift[]): number {
  const sorted = [...allShifts].sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return a.startHour - b.startHour;
  });
  const idx = sorted.findIndex((s) => s.id === shift.id);
  const next = sorted[idx + 1];
  if (!next) return 1;
  const start = new Date(`${shift.date}T${String(shift.startHour).padStart(2, "0")}:00:00`);
  const end = new Date(`${next.date}T${String(next.startHour).padStart(2, "0")}:00:00`);
  return Math.max(1, (end.getTime() - start.getTime()) / (1000 * 60 * 60));
}

export function StatsView({ shifts, soldiers }: Props) {
  const stats = useMemo(() => {
    const byName: Record<string, {
      name: string;
      totalHours: number;
      nightHours: number;
      shabbatHours: number;
      morningHours: number;
      shiftCount: number;
      longestShift: number;
    }> = {};

    for (const shift of shifts) {
      const duration = getShiftDuration(shift, shifts);
      const name = shift.soldierName;
      if (!byName[name]) {
        byName[name] = { name, totalHours: 0, nightHours: 0, shabbatHours: 0, morningHours: 0, shiftCount: 0, longestShift: 0 };
      }
      byName[name].totalHours += duration;
      byName[name].shiftCount += 1;
      byName[name].longestShift = Math.max(byName[name].longestShift, duration);
      if (isNightHour(shift.startHour)) byName[name].nightHours += duration;
      if (isShabbatHour(shift.date, shift.startHour)) byName[name].shabbatHours += duration;
      if (isMorningHour(shift.startHour)) byName[name].morningHours += duration;
    }

    return Object.values(byName).sort((a, b) => b.totalHours - a.totalHours);
  }, [shifts]);

  const maxHours = Math.max(...stats.map((s) => s.totalHours), 1);

  if (shifts.length === 0) {
    return (
      <div className="p-6 text-center text-zinc-400">
        <p className="text-4xl mb-3">📊</p>
        <p>אין נתונים עדיין. הוסף משמרות כדי לראות סטטיסטיקות.</p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-6 overflow-y-auto">
      <h2 className="text-lg font-bold text-white">סטטיסטיקות משמרות</h2>

      {/* Total hours bar chart */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4 space-y-3">
        <h3 className="text-sm font-semibold text-zinc-300">סה"כ שעות לפי חייל</h3>
        {stats.map((s) => (
          <div key={s.name} className="space-y-1">
            <div className="flex justify-between text-xs text-zinc-300">
              <span>{s.name}</span>
              <span>{s.totalHours.toFixed(1)} שעות</span>
            </div>
            <div className="h-3 rounded-full bg-zinc-800 overflow-hidden">
              <div
                className="h-full rounded-full bg-blue-500 transition-all"
                style={{ width: `${(s.totalHours / maxHours) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Night hours */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4 space-y-3">
        <h3 className="text-sm font-semibold text-zinc-300">🌙 שעות לילה (22:00–06:00)</h3>
        {stats.sort((a, b) => b.nightHours - a.nightHours).map((s) => (
          <div key={s.name} className="flex justify-between text-sm">
            <span className="text-zinc-300">{s.name}</span>
            <span className="text-zinc-100 font-semibold">{s.nightHours.toFixed(1)} שע'</span>
          </div>
        ))}
      </div>

      {/* Shabbat hours */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4 space-y-3">
        <h3 className="text-sm font-semibold text-zinc-300">✡️ שעות שבת (ו׳ 19:00 – ש׳ 20:00)</h3>
        {stats.sort((a, b) => b.shabbatHours - a.shabbatHours).map((s) => (
          <div key={s.name} className="flex justify-between text-sm">
            <span className="text-zinc-300">{s.name}</span>
            <span className="text-zinc-100 font-semibold">{s.shabbatHours.toFixed(1)} שע'</span>
          </div>
        ))}
      </div>

      {/* Morning hours */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4 space-y-3">
        <h3 className="text-sm font-semibold text-zinc-300">🌅 שעות בוקר (06:00–12:00)</h3>
        {stats.sort((a, b) => b.morningHours - a.morningHours).map((s) => (
          <div key={s.name} className="flex justify-between text-sm">
            <span className="text-zinc-300">{s.name}</span>
            <span className="text-zinc-100 font-semibold">{s.morningHours.toFixed(1)} שע'</span>
          </div>
        ))}
      </div>

      {/* Shift count */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4 space-y-3">
        <h3 className="text-sm font-semibold text-zinc-300">📋 מספר משמרות</h3>
        {stats.sort((a, b) => b.shiftCount - a.shiftCount).map((s) => (
          <div key={s.name} className="flex justify-between text-sm">
            <span className="text-zinc-300">{s.name}</span>
            <span className="text-zinc-100 font-semibold">{s.shiftCount} משמרות</span>
          </div>
        ))}
      </div>

      {/* Longest shift */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4 space-y-3">
        <h3 className="text-sm font-semibold text-zinc-300">⏱️ משמרת ארוכה ביותר</h3>
        {stats.sort((a, b) => b.longestShift - a.longestShift).map((s) => (
          <div key={s.name} className="flex justify-between text-sm">
            <span className="text-zinc-300">{s.name}</span>
            <span className="text-zinc-100 font-semibold">{s.longestShift.toFixed(1)} שע'</span>
          </div>
        ))}
      </div>
    </div>
  );
}
