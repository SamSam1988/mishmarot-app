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

function getShiftStartMs(shift: Shift): number {
  return new Date(`${shift.date}T${String(shift.startHour).padStart(2, "0")}:00:00`).getTime();
}

function isCurrentShift(shift: Shift, allShifts: Shift[], now: Date): boolean {
  const sorted = [...allShifts].sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return a.startHour - b.startHour;
  });
  const idx = sorted.findIndex((s) => s.id === shift.id);
  const next = sorted[idx + 1];
  const shiftStart = getShiftStartMs(shift);
  const shiftEnd = next
    ? getShiftStartMs(next)
    : shiftStart + 24 * 60 * 60 * 1000;
  return now.getTime() >= shiftStart && now.getTime() < shiftEnd;
}

function isPastShift(shift: Shift, allShifts: Shift[], now: Date): boolean {
  return getShiftStartMs(shift) < now.getTime() && !isCurrentShift(shift, allShifts, now);
}

// Calculate next shift date based on last shift and chosen hour
function calcNextDate(lastShift: Shift | null, hour: number, periodStart: string): string {
  if (!lastShift) return periodStart;
  // If new hour > last hour → same day
  // If new hour <= last hour → next day (crossed midnight)
  if (hour > lastShift.startHour) {
    return lastShift.date;
  } else {
    const d = new Date(lastShift.date);
    d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  }
}

// Calculate duration in hours between last shift and new shift
function calcDuration(lastShift: Shift | null, newDate: string, newHour: number): number {
  if (!lastShift) return 0;
  const lastMs = getShiftStartMs(lastShift);
  const newMs = new Date(`${newDate}T${String(newHour).padStart(2, "00")}:00:00`).getTime();
  return (newMs - lastMs) / (1000 * 60 * 60);
}

export function ShiftsView({
  loggedInUser, shifts, soldiers, specialDates, periodStart,
  onAddShift, onDeleteShift, onAddSoldier,
}: Props) {
  const now = new Date();
  const isAdmin = loggedInUser.role === "admin";
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [hour, setHour] = useState("");
  const [soldierName, setSoldierName] = useState("");
  const [backupInputs, setBackupInputs] = useState<{ name: string; type: "צל" | "גיבוי" }[]>([]);
  const [autocomplete, setAutocomplete] = useState<Soldier[]>([]);
  const [backupAutocomplete, setBackupAutocomplete] = useState<Soldier[][]>([]);
  const [newSoldierPopup, setNewSoldierPopup] = useState<{ name: string } | null>(null);
  const [traineePopup, setTraineePopup] = useState<{ soldier: Soldier; onConfirm: () => void } | null>(null);
  const [longShiftPopup, setLongShiftPopup] = useState<{ onConfirm: () => void } | null>(null);
  const [showScrollButtons, setShowScrollButtons] = useState(false);
  const currentRef = useRef<HTMLDivElement | null>(null);
  const lastRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const sortedShifts = [...shifts].sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return a.startHour - b.startHour;
  });

  const lastShift = sortedShifts.length > 0 ? sortedShifts[sortedShifts.length - 1] : null;

  const byDate: Record<string, Shift[]> = {};
  for (const s of sortedShifts) {
    if (!byDate[s.date]) byDate[s.date] = [];
    byDate[s.date].push(s);
  }

  useEffect(() => {
    setTimeout(() => {
      currentRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 300);
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const handler = () => setShowScrollButtons(el.scrollTop > 100);
    el.addEventListener("scroll", handler);
    return () => el.removeEventListener("scroll", handler);
  }, []);

  function handleSoldierInput(val: string) {
    setSoldierName(val);
    if (val.length < 1) { setAutocomplete([]); return; }
    setAutocomplete(soldiers.filter((s) => s.name.includes(val)).slice(0, 5));
  }

  function handleBackupInput(idx: number, val: string) {
    setBackupInputs((prev) => prev.map((b, i) => i === idx ? { ...b, name: val } : b));
    if (val.length < 1) {
      setBackupAutocomplete((prev) => prev.map((a, i) => i === idx ? [] : a));
      return;
    }
    setBackupAutocomplete((prev) => prev.map((a, i) =>
      i === idx ? soldiers.filter((s) => s.name.includes(val)).slice(0, 5) : a
    ));
  }

  async function handleSubmitShift() {
    if (!hour || !soldierName) return;
    const h = parseInt(hour);
    if (isNaN(h) || h < 0 || h > 23) return;

    const nextDate = calcNextDate(lastShift, h, periodStart);
    const duration = calcDuration(lastShift, nextDate, h);

    // Check long shift
    if (duration > 12) {
      setLongShiftPopup({
        onConfirm: () => {
          setLongShiftPopup(null);
          checkSoldierAndProceed(h, nextDate);
        },
      });
      return;
    }

    checkSoldierAndProceed(h, nextDate);
  }

  function checkSoldierAndProceed(h: number, nextDate: string) {
    const existing = soldiers.find((s) => s.name === soldierName);
    if (!existing) {
      setNewSoldierPopup({ name: soldierName });
      return;
    }
    if (existing.isTrainee && backupInputs.filter((b) => b.name).length === 0) {
      setTraineePopup({
        soldier: existing,
        onConfirm: () => { setTraineePopup(null); doAddShift(existing, h, nextDate); },
      });
      return;
    }
    doAddShift(existing, h, nextDate);
  }

  const doAddShift = useCallback(async (mainSoldier: Soldier, h: number, date: string) => {
    const resolvedBackups: Shift["backups"] = [];
    for (const b of backupInputs) {
      if (!b.name) continue;
      let sol = soldiers.find((s) => s.name === b.name);
      if (!sol) sol = await onAddSoldier(b.name, true);
      resolvedBackups.push({ soldierId: sol.id, soldierName: sol.name, type: b.type });
    }

    const shift: Shift = {
      id: `shift-${Date.now()}`,
      date,
      startHour: h,
      soldierId: mainSoldier.id,
      soldierName: mainSoldier.name,
      backups: resolvedBackups,
      isPast: false,
      createdAt: Date.now(),
      scheduledBy: loggedInUser.displayName,
    };

    await onAddShift(shift);
    setHour("");
    setSoldierName("");
    setBackupInputs([]);
    setBackupAutocomplete([]);
    setAutocomplete([]);
  }, [backupInputs, soldiers, onAddShift, onAddSoldier, loggedInUser]);

  async function handleConfirmNewSoldier(isTrainee: boolean) {
    if (!newSoldierPopup) return;
    const sol = await onAddSoldier(newSoldierPopup.name, isTrainee);
    setNewSoldierPopup(null);
    const h = parseInt(hour);
    const nextDate = calcNextDate(lastShift, h, periodStart);
    checkSoldierAndProceed(h, nextDate);
    doAddShift(sol, h, nextDate);
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
      text += `, ${s.backups.map((b) => `${b.type}: ${b.soldierName}`).join(", ")}`;
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
    window.open(`https://wa.me/?text=${encodeURIComponent(lines.join("\n"))}`, "_blank");
  }

  const lastScheduledShift = sortedShifts[sortedShifts.length - 1];
  const dates = Object.keys(byDate).sort();

  // Preview next date based on current hour input
  const previewHour = parseInt(hour);
  const previewDate = !isNaN(previewHour) && hour !== ""
    ? calcNextDate(lastShift, previewHour, periodStart)
    : null;
  const isNewDay = previewDate && lastShift && previewDate !== lastShift.date;

  return (
    <div ref={containerRef} className="relative h-full overflow-y-auto pb-32">
      {showScrollButtons && (
        <div className="fixed bottom-24 left-0 right-0 flex justify-center gap-3 z-20 px-4">
          <button type="button"
            onClick={() => currentRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })}
            className="rounded-xl bg-blue-700 px-4 py-2 text-xs font-semibold text-white shadow-lg">
            עבור לעכשיו
          </button>
          <button type="button"
            onClick={() => lastRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })}
            className="rounded-xl bg-zinc-700 px-4 py-2 text-xs font-semibold text-white shadow-lg">
            עבור לאחרון
          </button>
        </div>
      )}

      <div className="space-y-1 p-3">
        {dates.map((date) => {
          const specialLabel = specialDates.find((sd) => sd.date === date)?.label;
          return (
            <div key={date}>
              <div className="sticky top-0 z-10 bg-zinc-950/90 py-2 border-b border-zinc-800 mb-2">
                <p className="text-sm font-bold text-zinc-200">
                  {formatDateHeader(date)}
                  {specialLabel && <span className="mr-2 text-amber-400 text-xs">{specialLabel}</span>}
                </p>
              </div>

              {byDate[date].map((shift) => {
                const isCurrent = isCurrentShift(shift, sortedShifts, now);
                const isPast = isPastShift(shift, sortedShifts, now);
                const canEdit = isAdmin || !isPast;
                const isSelected = selected.has(shift.id);

                return (
                  <div key={shift.id}
                    ref={isCurrent ? currentRef : shift.id === lastScheduledShift?.id ? lastRef : undefined}
                    className={`rounded-xl border p-3 mb-1.5 flex items-center gap-3 transition ${
                      isCurrent ? "border-blue-500 bg-blue-900/30"
                      : isPast ? "border-zinc-800 bg-zinc-900/40 opacity-50"
                      : "border-zinc-700 bg-zinc-900"
                    } ${isSelected ? "ring-2 ring-blue-400" : ""}`}>
                    <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(shift.id)}
                      className="w-4 h-4 rounded accent-blue-500 flex-shrink-0" />
                    <span className="text-lg font-bold text-zinc-100 w-14 flex-shrink-0">
                      {formatHour(shift.startHour)}
                    </span>
                    <div className="flex-1 min-w-0">
                      <span className={`font-semibold ${isCurrent ? "text-blue-200" : isPast ? "text-zinc-400" : "text-white"}`}>
                        {shift.soldierName}
                      </span>
                      {shift.backups.length > 0 && (
                        <span className="text-xs text-zinc-400 mr-1">
                          {shift.backups.map((b) => ` ,${b.type}: ${b.soldierName}`).join("")}
                        </span>
                      )}
                      {isCurrent && <span className="mr-2 text-xs bg-blue-600 text-white px-2 py-0.5 rounded-full">עכשיו</span>}
                      {"scheduledBy" in shift && (shift as Shift & { scheduledBy?: string }).scheduledBy && (
                        <p className="text-[10px] text-zinc-500 mt-0.5">
                          שובץ ע"י {(shift as Shift & { scheduledBy?: string }).scheduledBy}
                        </p>
                      )}
                    </div>
                    {canEdit && (
                      <button type="button" onClick={() => onDeleteShift(shift.id)}
                        className="text-zinc-600 hover:text-red-400 text-lg flex-shrink-0">✕</button>
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

          {lastShift ? (
            <p className="text-xs text-zinc-400">
              משמרת אחרונה: {formatDateHeader(lastShift.date)}, {formatHour(lastShift.startHour)}
            </p>
          ) : (
            <p className="text-xs text-zinc-400">תחילת תקופת שירות: {periodStart}</p>
          )}

          <div>
            <label className="text-xs text-zinc-400 block mb-1">שעת התחלה (0-23)</label>
            <input
              type="number" min={0} max={23} value={hour}
              onChange={(e) => setHour(e.target.value)}
              className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white"
              placeholder="למשל: 9"
            />
            {previewDate && (
              <p className={`text-xs mt-1 ${isNewDay ? "text-amber-400 font-semibold" : "text-zinc-400"}`}>
                {isNewDay ? `⚠️ יום חדש: ${formatDateHeader(previewDate)}` : `תאריך: ${formatDateHeader(previewDate)}`}
              </p>
            )}
          </div>

          <div className="relative">
            <label className="text-xs text-zinc-400 block mb-1">חייל/ת</label>
            <input
              type="text" value={soldierName}
              onChange={(e) => handleSoldierInput(e.target.value)}
              className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white"
              placeholder="הקלד שם..."
            />
            {autocomplete.length > 0 && (
              <div className="absolute top-full right-0 left-0 z-10 rounded-xl border border-zinc-700 bg-zinc-800 shadow-lg overflow-hidden">
                {autocomplete.map((s) => (
                  <button key={s.id} type="button"
                    onClick={() => { setSoldierName(s.name); setAutocomplete([]); }}
                    className="w-full text-right px-3 py-2 text-sm hover:bg-zinc-700 text-white">
                    {s.name} {s.isTrainee ? "(מתלמד/ת)" : ""}
                  </button>
                ))}
              </div>
            )}
          </div>

          {backupInputs.map((b, idx) => (
            <div key={idx} className="flex gap-2 items-end">
              <div className="flex-1 relative">
                <label className="text-xs text-zinc-400 block mb-1">גיבוי/צל</label>
                <input type="text" value={b.name}
                  onChange={(e) => handleBackupInput(idx, e.target.value)}
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white"
                  placeholder="שם..." />
                {(backupAutocomplete[idx] ?? []).length > 0 && (
                  <div className="absolute top-full right-0 left-0 z-10 rounded-xl border border-zinc-700 bg-zinc-800 shadow-lg">
                    {(backupAutocomplete[idx] ?? []).map((s) => (
                      <button key={s.id} type="button"
                        onClick={() => {
                          setBackupInputs((prev) => prev.map((x, i) => i === idx ? { ...x, name: s.name } : x));
                          setBackupAutocomplete((prev) => prev.map((a, i) => i === idx ? [] : a));
                        }}
                        className="w-full text-right px-3 py-2 text-sm hover:bg-zinc-700 text-white">
                        {s.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <select value={b.type}
                onChange={(e) => setBackupInputs((prev) => prev.map((x, i) => i === idx ? { ...x, type: e.target.value as "צל" | "גיבוי" } : x))}
                className="rounded-xl border border-zinc-700 bg-zinc-800 px-2 py-2 text-sm text-white">
                <option value="גיבוי">גיבוי</option>
                <option value="צל">צל</option>
              </select>
              <button type="button" onClick={() => {
                setBackupInputs((prev) => prev.filter((_, i) => i !== idx));
                setBackupAutocomplete((prev) => prev.filter((_, i) => i !== idx));
              }} className="text-zinc-500 hover:text-red-400 pb-2">✕</button>
            </div>
          ))}

          <button type="button"
            onClick={() => {
              setBackupInputs((prev) => [...prev, { name: "", type: "גיבוי" }]);
              setBackupAutocomplete((prev) => [...prev, []]);
            }}
            className="text-xs text-zinc-400 hover:text-zinc-200">
            + הוסף גיבוי/צל
          </button>

          <button type="button" onClick={handleSubmitShift}
            disabled={!hour || !soldierName}
            className="w-full rounded-xl bg-blue-600 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition disabled:opacity-40">
            הוסף משמרת
          </button>
        </div>
      </div>

      {selected.size > 0 && (
        <div className="fixed bottom-6 right-0 left-0 flex justify-center px-4 z-20">
          <button type="button" onClick={handleShare}
            className="rounded-2xl bg-green-600 hover:bg-green-700 px-6 py-3 text-sm font-bold text-white shadow-xl flex items-center gap-2">
            <span>📤</span>
            שיתוף ב-WhatsApp ({selected.size} משמרות)
          </button>
        </div>
      )}

      {/* Long shift popup */}
      {longShiftPopup && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="rounded-2xl border border-zinc-700 bg-zinc-900 p-6 max-w-sm w-full space-y-4">
            <p className="text-white font-semibold">המשמרת הקודמת תהיה ארוכה מן הרגיל. להמשיך?</p>
            <div className="grid grid-cols-2 gap-3">
              <button type="button" onClick={longShiftPopup.onConfirm}
                className="rounded-xl bg-blue-600 py-2 font-semibold text-white hover:bg-blue-700">כן</button>
              <button type="button" onClick={() => setLongShiftPopup(null)}
                className="rounded-xl border border-zinc-600 bg-zinc-800 py-2 font-semibold text-white hover:bg-zinc-700">לא</button>
            </div>
          </div>
        </div>
      )}

      {/* New soldier popup */}
      {newSoldierPopup && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="rounded-2xl border border-zinc-700 bg-zinc-900 p-6 max-w-sm w-full space-y-4">
            <p className="text-white font-semibold">שיבצת חייל/ת חדש/ה: <span className="text-blue-300">{newSoldierPopup.name}</span></p>
            <p className="text-zinc-300 text-sm">האם להוסיף לכוח?</p>
            <div className="grid grid-cols-2 gap-3">
              <button type="button" onClick={() => handleConfirmNewSoldier(false)}
                className="rounded-xl bg-blue-600 py-2 font-semibold text-white hover:bg-blue-700">כן</button>
              <button type="button" onClick={() => setNewSoldierPopup(null)}
                className="rounded-xl border border-zinc-600 bg-zinc-800 py-2 font-semibold text-white hover:bg-zinc-700">לא</button>
            </div>
          </div>
        </div>
      )}

      {/* Trainee popup */}
      {traineePopup && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="rounded-2xl border border-zinc-700 bg-zinc-900 p-6 max-w-sm w-full space-y-4">
            <p className="text-white font-semibold">{traineePopup.soldier.name} מתלמד/ת — האם באמת לשבץ אותו/ה לבד?</p>
            <div className="grid grid-cols-2 gap-3">
              <button type="button" onClick={traineePopup.onConfirm}
                className="rounded-xl bg-orange-600 py-2 font-semibold text-white hover:bg-orange-700">כן</button>
              <button type="button" onClick={() => setTraineePopup(null)}
                className="rounded-xl border border-zinc-600 bg-zinc-800 py-2 font-semibold text-white hover:bg-zinc-700">לא</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
