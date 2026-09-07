"use client";

import { useState } from "react";
import type { Obstacle } from "@/lib/schema";

interface ObstacleEditorProps {
  widthFt: number;
  lengthFt: number;
  obstacles: Obstacle[];
  onChange: (obstacles: Obstacle[]) => void;
}

type Mode = "door" | "window";

export function ObstacleEditor({ widthFt, lengthFt, obstacles, onChange }: ObstacleEditorProps) {
  const [mode, setMode] = useState<Mode>("door");

  if (!(widthFt > 0) || !(lengthFt > 0)) {
    return <p className="text-xs text-mute">Enter valid room dimensions to mark doors and windows.</p>;
  }

  const addAt = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const nx = (e.clientX - rect.left) / rect.width;
    const ny = (e.clientY - rect.top) / rect.height;
    const margins = { top: ny, bottom: 1 - ny, left: nx, right: 1 - nx };
    const wall = (
      Object.keys(margins) as (keyof typeof margins)[]
    ).sort((a, b) => margins[a] - margins[b])[0];

    const wallRef = wall === "top" ? "north" : wall === "bottom" ? "south" : wall === "left" ? "west" : "east";
    const offsetFt =
      wallRef === "north" || wallRef === "south" ? nx * widthFt : ny * lengthFt;
    const existing = obstacles.some(
      (o) => o.wallRef === wallRef && Math.abs(o.offsetFt - offsetFt) < Math.max(1, (wallRef === "north" || wallRef === "south" ? widthFt : lengthFt) / 12)
    );
    if (existing) return;

    onChange([
      ...obstacles,
      {
        type: mode,
        wallRef,
        offsetFt: Math.round(offsetFt * 10) / 10,
        widthFt: mode === "door" ? 3 : 5,
        swingClearanceFt: mode === "door" ? 3 : undefined,
      },
    ]);
  };

  const markerPos = (o: Obstacle) => {
    const along = o.wallRef === "north" || o.wallRef === "south" ? (o.offsetFt / widthFt) * 100 : (o.offsetFt / lengthFt) * 100;
    switch (o.wallRef) {
      case "north":
        return { left: `${along}%`, top: "0%" };
      case "south":
        return { left: `${along}%`, top: "100%" };
      case "west":
        return { left: "0%", top: `${along}%` };
      case "east":
        return { left: "100%", top: `${along}%` };
    }
  };

  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <button
          type="button"
          onClick={() => setMode("door")}
          className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
            mode === "door" ? "border-pine bg-pine text-paper" : "border-hair text-mute hover:text-ink"
          }`}
        >
          Door
        </button>
        <button
          type="button"
          onClick={() => setMode("window")}
          className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
            mode === "window" ? "border-pine bg-pine text-paper" : "border-hair text-mute hover:text-ink"
          }`}
        >
          Window
        </button>
        <span className="ml-1 text-xs text-mute">Click a wall to place · click a marker to remove</span>
        {obstacles.length > 0 && (
          <button
            type="button"
            onClick={() => onChange([])}
            className="ml-auto text-xs font-medium text-pine underline underline-offset-4"
          >
            Clear
          </button>
        )}
      </div>

      <div
        onClick={addAt}
        className="relative cursor-crosshair overflow-hidden rounded-lg border border-hair bg-pine-soft/60"
        style={{ aspectRatio: `${widthFt} / ${lengthFt}`, touchAction: "none" }}
      >
        <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[11px] tracking-wide text-mute">
          {widthFt}′ × {lengthFt}′
        </span>
        {obstacles.map((o, i) => (
          <button
            key={i}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onChange(obstacles.filter((_, idx) => idx !== i));
            }}
            className="absolute z-10 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded border border-ink/20 text-[10px] font-medium shadow-sm transition-transform hover:scale-110"
            style={{
              ...markerPos(o),
              width: "2.5rem",
              height: "1.25rem",
              backgroundColor: o.type === "door" ? "#8f6b46" : "#a9bdc9",
              color: "#fff",
            }}
            title={`${o.type} · ${o.offsetFt} ft from start`}
          >
            {o.type === "door" ? "D" : "W"}
          </button>
        ))}
      </div>
    </div>
  );
}