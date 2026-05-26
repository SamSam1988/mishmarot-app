"use client";
import { useState } from "react";

type Props = {
  value: string;
  onChange: (hour: string) => void;
  onClose: () => void;
};

export function ClockPicker({ value, onChange, onClose }: Props) {
  const [selected, setSelected] = useState<number | null>(
    value !== "" ? parseInt(value) : null
  );

  const hours = Array.from({ length: 24 }, (_, i) => i);

  // Layout: inner ring 0-11, outer ring 12-23
  function getPos(hour: number, inner: boolean) {
    const angle = ((hour % 12) / 12) * 2 * Math.PI - Math.PI / 2;
    const r = inner ? 52 : 82;
    return {
      x: 100 + r * Math.cos(angle),
      y: 100 + r * Math.sin(angle),
    };
  }

  function handleConfirm() {
    if (selected === null) return;
    onChange(String(selected));
    onClose();
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="rounded-2xl border border-zinc-700 bg-zinc-900 p-5 w-full max-w-xs space-y-4">
        <p className="text-center text-sm font-semibold text-zinc-200">בחר שעה</p>

        {/* Selected display */}
        <div className="text-center text-4xl font-bold text-white">
          {selected !== null ? `${String(selected).padStart(2, "0")}:00` : "--:--"}
        </div>

        {/* Clock face */}
        <div className="relative mx-auto" style={{ width: 200, height: 200 }}>
          <svg width="200" height="200" className="absolute inset-0">
            {/* Clock face background */}
            <circle cx="100" cy="100" r="95" fill="#27272a" stroke="#3f3f46" strokeWidth="1" />
            
            {/* Hand */}
            {selected !== null && (() => {
              const pos = getPos(selected, selected < 12);
              return (
                <line x1="100" y1="100" x2={pos.x} y2={pos.y}
                  stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" />
              );
            })()}
            <circle cx="100" cy="100" r="3" fill="#3b82f6" />

            {/* Hour markers */}
            {hours.map((h) => {
              const inner = h < 12;
              const pos = getPos(h, inner);
              const isSelected = h === selected;
              return (
                <g key={h} onClick={() => setSelected(h)} style={{ cursor: "pointer" }}>
                  <circle cx={pos.x} cy={pos.y} r="14"
                    fill={isSelected ? "#3b82f6" : "transparent"} />
                  <text x={pos.x} y={pos.y} textAnchor="middle" dominantBaseline="central"
                    fontSize={inner ? "11" : "10"}
                    fill={isSelected ? "white" : inner ? "#e4e4e7" : "#a1a1aa"}
                    fontWeight={isSelected ? "bold" : "normal"}>
                    {h}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        <p className="text-center text-xs text-zinc-500">
          מספרים פנימיים: 0-11 | חיצוניים: 12-23
        </p>

        <div className="grid grid-cols-2 gap-3">
          <button type="button" onClick={onClose}
            className="rounded-xl border border-zinc-600 bg-zinc-800 py-2 text-sm font-semibold text-white hover:bg-zinc-700">
            ביטול
          </button>
          <button type="button" onClick={handleConfirm} disabled={selected === null}
            className="rounded-xl bg-blue-600 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-40">
            אישור
          </button>
        </div>
      </div>
    </div>
  );
}
