"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import type { Shift, Soldier, User, SpecialDate } from "../data";

type Props = {
  loggedInUser: User;
  shifts: Shift[];
  soldiers: Soldier[];
  specialDates: SpecialDate[];
  periodStart: string;
  periodEnd: string;
  onAddShift: (shift: Shift) => Promise<void>;
  onUpdateShift: (shiftId: string, patch: Partial<Shift>) => Promise<void>;
  onDeleteShift: (shiftId: string) => Promise<void>;
  onAddSoldier: (name: string, isTrainee: boolean) => Promise<Soldier>;
};

function formatHour(h: number) {
  return `${String(h).padStart(2, "0")}:00`;
}

function hebrewDay(dateStr: string) {
  const days = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];
  const d = new Date(dateStr);
  return days[d.getDay()];
}

function hebrewMonth(dateStr: string) {
  const months = ["ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני",
    "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר"];
  const d = new Date(dateStr);
  return months[d.getMonth()];
}

function formatDateHeader(dateStr: string) {
  const d = new Date(dateStr);
  return `יום ${hebrewDay(dateStr)}, ${d.getDate()} ב${hebrewMonth(dateStr)}`;
}

function isCurrentShift(shift: Shift, allShifts: Shift[], now: Date): boolean {
  const shiftStart = new Date(`${shift.date}T${String(shift.startHour).padStart(2, "0")}:00:00`);
  const dateShifts = allShifts
    .filter((s) => s.date === shift.date || (shift.startHour >= 0))
    .sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return a.startHour - b.startHour;
    });
  const idx = dateShifts.findIndex((s) => s.id === shift.id);
  const next = dateShifts[idx + 1];
  const shiftEnd = next
    ? new Date(`${next.date}T${String(next.startHour).padStart(2, "0")}:00:00`)
    : new Date(shiftStart.getTime() + 24 * 60 * 60 * 1000);
  return now >= shiftStart && now < shiftEnd;
}

function isPastShift(shift: Shift, allShifts: Shift[], now: Date): boolean {
  const shiftStart = new Date(`${shift.date}T${String(shift.startHour).padStart(2, "0")}:00:00`);
  return shiftStart < now && !isCurrentShift(shift, allShifts, now);
}

type NewShiftState = {
  date: string;
  hour: string;
  soldierName: string;
  backups: { name: string; type: "צל" | "גיבוי" }[];
  showBackupInput: boolean;
};

export function ShiftsView({
  loggedInUser, shifts, soldiers, specialDates, periodStart, periodEnd,
  onAddShift, onDeleteShift, onAddSoldier,
}: Props) {
  const now = new Date();
  const isAdmin = loggedInUser.role === "admin";
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [newShift, setNewShift] = useState<NewShiftState>({
    date: periodStart,
    hour: "",
    soldierName: "",
    backups: [],
    showBackupInput: false,
  });
  const [autocomplete, setAutocomplete] = useState<Soldier[]>([]);
  const [backupAutocomplete, setBackupAutocomplete] = useState<Soldier[]>([]);
  const [backupInputs, setBackupInputs] = useState<{ name: string; type: "צל" | "גיבוי" }[]>([]);
  const [newSoldierPopup, setNewSoldierPopup] = useState<{ name: string; isBackup: boolean } | null>(null);
  const [traineePopup, setTraineePopup] = useState<{ soldier: Soldier; onConfirm: () => void } | null>(null);
  const [showScrollButtons, setShowScrollButtons] = useState(false);
  const currentRef = useRef<HTMLDivElement | null>(null);
  const lastRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Sort shifts by date then hour
  const sortedShifts = [...shifts].sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return a.startHour - b.startHour;
  });

  // Group by date
  const byDate: Record<string, Shift[]> = {};
  for (const s of sortedShifts) {
    if (!byDate[s.date]) byDate[s.date] = [];
    byDate[s.date].push(s);
  }

  // Scroll to current shift on mount
  useEffect(() => {
    setTimeout(() => {
      currentRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 300);
  }, []);

  // Show scroll buttons on scroll
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const handler = () => setShowScrollButtons(el.scrollTop > 100);
    el.addEventListener("scroll", handler);
    return () => el.removeEventListener("scroll", handler);
  }, []);

  function handleSoldierInput(val: string) {
    setNewShift((s) => ({ ...s, soldierName: val }));
    if (val.length < 1) { setAutocomplete([]); return; }
    setAutocomplete(soldiers.filter((s) => s.name.includes(val)).slice(0, 5));
  }

  function handleBackupInput(idx: number, val: string) {
    setBackupInputs((prev) => prev.map((b, i) => i === idx ? { ...b, name: val } : b));
    if (val.length < 1) { setBackupAutocomplete([]); return; }
    setBackupAutocomplete(soldiers.filter((s) => s.name.includes(val)).slice(0, 5));
  }

  async function handleSubmitShift() {
    if (!newShift.hour || !newShift.soldierName) return;
    const hour = parseInt(newShift.hour);
    if (isNaN(hour) || hour < 0 || hour > 23) return;

    // Check if soldier is new
    const existing = soldiers.find((s) => s.name === newShift.soldierName);
    if (!existing) {
      setNewSoldierPopup({ name: newShift.soldierName, isBackup: false });
      return;
    }

    // Check if trainee
    if (existing.isTrainee && backupInputs.length === 0) {
      setTraineePopup({
        soldier: existing,
        onConfirm: () => { setTraineePopup(null); doAddShift(existing); },
      });
      return;
    }

    doAddShift(existing);
  }

  const doAddShift = useCallback(async (mainSoldier: Soldier) => {
    const hour = parseInt(newShift.hour);

    // Determine date — if hour is after midnight, use next date
    let date = newShift.date;
    if (sortedShifts.length > 0) {
      const lastShift = sortedShifts[sortedShifts.length - 1];
      if (lastShift.date === date && hour < lastShift.startHour) {
        // Next day
        const d = new Date(date);
        d.setDate(d.getDate() + 1);
        date = d.toISOString().slice(0, 10);
      }
    }

    const resolvedBackups: Shift["backups"] = [];
    for (const b of backupInputs) {
      if (!b.name) continue;
      let sol = soldiers.find((s) => s.name === b.name);
      if (!sol) {
        sol = await onAddSoldier(b.name, true); // backups default to trainee
      }
      resolvedBackups.push({ soldierId: sol.id, soldierName: sol.name, type: b.type });
    }

    const shift: Shift = {
      id: `shift-${Date.now()}`,
      date,
      startHour: hour,
      soldierId: mainSoldier.id,
      soldierName: mainSoldier.name,
      backups: resolvedBackups,
      isPast: false,
      createdAt: Date.now(),
    };

    await onAddShift(shift);
    setNewShift({ date, hour: "", soldierName: "", backups: [], showBackupInput: false });
    setBackupInputs([]);
    setAutocomplete([]);
  }, [newShift, sortedShifts, backupInputs, soldiers, onAddShift, onAddSoldier]);

  async function handleConfirmNewSoldier(isTrainee: boolean) {
    if (!newSoldierPopup) return;
    const sol = await onAddSoldier(newSoldierPopup.name, isTrainee);
    setNewSoldierPopup(null);
    doAddShift(sol);
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function formatShiftText(s: Shift) {
    let text = `${formatHour(s.startHour)} ${s.soldierName}`;
    if (s.backups.length > 0) {
      const backupStr = s.backups.map((b) => `${b.type}: ${b.soldierName}`).join(", ");
      text += `, ${backupStr}`;
    }
    return text;
  }

  function handleShare() {
    const lines: string[] = [];
    let lastDate = "";
    for (const s of sortedShifts) {
      if (!selected.has(s.id)) continue;
      if (s.date !== lastDate) {
        lines.push(formatDateHeader(s.date));
        lastDate = s.date;
      }
      lines.push(formatShiftText(s));
    }
    const text = lines.join("\n");
    const encoded = encodeURIComponent(text);
    window.open(`https://wa.me/?text=${encoded}`, "_blank");
  }

  const dates = Object.keys(byDate).sort();
  let lastShiftId: string | null = null;
  for (const s of sortedShifts) {
    if (!isPastShift(s, sortedShifts, now)) { break; }
    lastShiftId = s.id;
  }
  // Find last scheduled shift
  const lastScheduledShift = sortedShifts[sortedShifts.length - 1];

  return (
    <div ref={containerRef} className="relative h-full overflow-y-auto pb-32">
      {/* Scroll buttons */}
      {showScrollButtons && (
        <div className="fixed bottom-24 left-0 right-0 flex justify-center gap-3 z-20 px-4">
          <button
            type="button"
            onClick={() => currentRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })}
            className="rounded-xl bg-blue-700 px-4 py-2 text-xs font-semibold text-white shadow-lg"
          >
            עבור לעכשיו
          </button>
          <button
            type="button"
            onClick={() => lastRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })}
            className="rounded-xl bg-zinc-700 px-4 py-2 text-xs font-semibold text-white shadow-lg"
          >
            עבור לאחרון
          </button>
        </div>
      )}

      <div className="space-y-2 p-3">
        {dates.map((date) => {
          const specialLabel = specialDates.find((sd) => sd.date === date)?.label;
          return (
            <div key={date}>
              {/* Date header */}
              <div className="sticky top-0 z-10 bg-zinc-950/90 py-2">
                <p className="text-sm font-bold text-zinc-200">
                  {formatDateHeader(date)}
                  {specialLabel && (
                    <span className="mr-2 text-amber-400 text-xs">{specialLabel}</span>
                  )}
                </p>
              </div>

              {/* Shifts for this date */}
              {byDate[date].map((shift) => {
                const isCurrent = isCurrentShift(shift, sortedShifts, now);
                const isPast = isPastShift(shift, sortedShifts, now);
                const canEdit = isAdmin || !isPast;
                const isSelected = selected.has(shift.id);

                return (
                  <div
                    key={shift.id}
                    ref={isCurrent ? currentRef : shift.id === lastScheduledShift?.id ? lastRef : undefined}
                    className={`rounded-xl border p-3 mb-2 flex items-center gap-3 transition ${
                      isCurrent
                        ? "border-blue-500 bg-blue-900/30"
                        : isPast
                        ? "border-zinc-800 bg-zinc-900/40 opacity-50"
                        : "border-zinc-700 bg-zinc-900"
                    } ${isSelected ? "ring-2 ring-blue-400" : ""}`}
                  >
                    {/* Checkbox */}
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelect(shift.id)}
                      className="w-4 h-4 rounded accent-blue-500 flex-shrink-0"
                    />

                    {/* Time */}
                    <span className="text-lg font-bold text-zinc-100 w-14 flex-shrink-0">
                      {formatHour(shift.startHour)}
                    </span>

                    {/* Soldier info */}
                    <div className="flex-1 min-w-0">
                      <span className={`font-semibold ${isCurrent ? "text-blue-200" : isPast ? "text-zinc-400" : "text-white"}`}>
                        {shift.soldierName}
                      </span>
                      {shift.backups.length > 0 && (
                        <span className="text-xs text-zinc-400 mr-1">
                          {shift.backups.map((b) => ` ,${b.type}: ${b.soldierName}`).join("")}
                        </span>
                      )}
                      {isCurrent && (
                        <span className="mr-2 text-xs bg-blue-600 text-white px-2 py-0.5 rounded-full">עכשיו</span>
                      )}
                    </div>

                    {/* Delete */}
                    {canEdit && (
                      <button
                        type="button"
                        onClick={() => onDeleteShift(shift.id)}
                        className="text-zinc-600 hover:text-red-400 text-lg flex-shrink-0"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}

        {/* New shift form */}
        <div className="rounded-2xl border border-zinc-700 bg-zinc-900 p-4 space-y-3 mt-4">
          <p className="text-sm font-semibold text-zinc-200">הוסף משמרת חדשה</p>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-zinc-400 block mb-1">תאריך</label>
              <input
                type="date"
                value={newShift.date}
                min={periodStart}
                max={periodEnd}
                onChange={(e) => setNewShift((s) => ({ ...s, date: e.target.value }))}
                className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white"
              />
            </div>
            <div>
              <label className="text-xs text-zinc-400 block mb-1">שעת התחלה (0-23)</label>
              <input
                type="number"
                min={0}
                max={23}
                value={newShift.hour}
                onChange={(e) => setNewShift((s) => ({ ...s, hour: e.target.value }))}
                className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white"
                placeholder="למשל: 9"
              />
            </div>
          </div>

          {/* Soldier autocomplete */}
          <div className="relative">
            <label className="text-xs text-zinc-400 block mb-1">חייל/ת</label>
            <input
              type="text"
              value={newShift.soldierName}
              onChange={(e) => handleSoldierInput(e.target.value)}
              className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white"
              placeholder="הקלד שם..."
            />
            {autocomplete.length > 0 && (
              <div className="absolute top-full right-0 left-0 z-10 rounded-xl border border-zinc-700 bg-zinc-800 shadow-lg overflow-hidden">
                {autocomplete.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => { setNewShift((n) => ({ ...n, soldierName: s.name })); setAutocomplete([]); }}
                    className="w-full text-right px-3 py-2 text-sm hover:bg-zinc-700 text-white"
                  >
                    {s.name} {s.isTrainee ? "(מתלמד/ת)" : ""}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Backup soldiers */}
          {backupInputs.map((b, idx) => (
            <div key={idx} className="flex gap-2 items-end">
              <div className="flex-1 relative">
                <label className="text-xs text-zinc-400 block mb-1">גיבוי/צל</label>
                <input
                  type="text"
                  value={b.name}
                  onChange={(e) => handleBackupInput(idx, e.target.value)}
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white"
                  placeholder="שם..."
                />
                {backupAutocomplete.length > 0 && (
                  <div className="absolute top-full right-0 left-0 z-10 rounded-xl border border-zinc-700 bg-zinc-800 shadow-lg">
                    {backupAutocomplete.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => {
                          setBackupInputs((prev) => prev.map((x, i) => i === idx ? { ...x, name: s.name } : x));
                          setBackupAutocomplete([]);
                        }}
                        className="w-full text-right px-3 py-2 text-sm hover:bg-zinc-700 text-white"
                      >
                        {s.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <select
                value={b.type}
                onChange={(e) => setBackupInputs((prev) => prev.map((x, i) => i === idx ? { ...x, type: e.target.value as "צל" | "גיבוי" } : x))}
                className="rounded-xl border border-zinc-700 bg-zinc-800 px-2 py-2 text-sm text-white"
              >
                <option value="גיבוי">גיבוי</option>
                <option value="צל">צל</option>
              </select>
              <button
                type="button"
                onClick={() => setBackupInputs((prev) => prev.filter((_, i) => i !== idx))}
                className="text-zinc-500 hover:text-red-400 pb-2"
              >✕</button>
            </div>
          ))}

          <button
            type="button"
            onClick={() => setBackupInputs((prev) => [...prev, { name: "", type: "גיבוי" }])}
            className="text-xs text-zinc-400 hover:text-zinc-200"
          >
            + הוסף גיבוי/צל
          </button>

          <button
            type="button"
            onClick={handleSubmitShift}
            disabled={!newShift.hour || !newShift.soldierName}
            className="w-full rounded-xl bg-blue-600 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition disabled:opacity-40"
          >
            הוסף משמרת
          </button>
        </div>
      </div>

      {/* Share button */}
      {selected.size > 0 && (
        <div className="fixed bottom-6 right-0 left-0 flex justify-center px-4 z-20">
          <button
            type="button"
            onClick={handleShare}
            className="rounded-2xl bg-green-600 hover:bg-green-700 px-6 py-3 text-sm font-bold text-white shadow-xl flex items-center gap-2"
          >
            <span>📤</span>
            שיתוף ב-WhatsApp ({selected.size} משמרות)
          </button>
        </div>
      )}

      {/* New soldier popup */}
      {newSoldierPopup && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="rounded-2xl border border-zinc-700 bg-zinc-900 p-6 max-w-sm w-full space-y-4">
            <p className="text-white font-semibold">
              שיבצת חייל/ת חדש/ה: <span className="text-blue-300">{newSoldierPopup.name}</span>
            </p>
            <p className="text-zinc-300 text-sm">האם להוסיף לכוח?</p>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => handleConfirmNewSoldier(false)}
                className="rounded-xl bg-blue-600 py-2 font-semibold text-white hover:bg-blue-700"
              >
                כן
              </button>
              <button
                type="button"
                onClick={() => setNewSoldierPopup(null)}
                className="rounded-xl border border-zinc-600 bg-zinc-800 py-2 font-semibold text-white hover:bg-zinc-700"
              >
                לא
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Trainee popup */}
      {traineePopup && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="rounded-2xl border border-zinc-700 bg-zinc-900 p-6 max-w-sm w-full space-y-4">
            <p className="text-white font-semibold">
              {traineePopup.soldier.name} מתלמד/ת — האם באמת לשבץ אותו/ה לבד?
            </p>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={traineePopup.onConfirm}
                className="rounded-xl bg-orange-600 py-2 font-semibold text-white hover:bg-orange-700"
              >
                כן
              </button>
              <button
                type="button"
                onClick={() => setTraineePopup(null)}
                className="rounded-xl border border-zinc-600 bg-zinc-800 py-2 font-semibold text-white hover:bg-zinc-700"
              >
                לא
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
