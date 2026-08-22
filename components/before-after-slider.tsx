"use client";

import { useCallback, useRef, useState } from "react";

interface BeforeAfterSliderProps {
  before: string;
  after: string;
}

export function BeforeAfterSlider({ before, after }: BeforeAfterSliderProps) {
  const [position, setPosition] = useState(50);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const updatePosition = useCallback((clientX: number) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const pct = ((clientX - rect.left) / rect.width) * 100;
    setPosition(Math.min(96, Math.max(4, pct)));
  }, []);

  const onPointerDown = (e: React.PointerEvent) => {
    dragging.current = true;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    updatePosition(e.clientX);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (dragging.current) updatePosition(e.clientX);
  };

  const onPointerUp = () => {
    dragging.current = false;
  };

  return (
    <div
      ref={containerRef}
      className="relative aspect-square w-full cursor-ew-resize overflow-hidden rounded-xl border border-hair bg-surface select-none"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerUp}
      style={{ touchAction: "none" }}
    >
      {/* After (base layer) */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={after} alt="Redesigned room" className="absolute inset-0 h-full w-full object-cover" />

      {/* Before (clipped to the left of the divider) */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={before}
        alt="Original room"
        className="absolute inset-0 h-full w-full object-cover"
        draggable={false}
        style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}
      />

      {/* Divider */}
      <div className="absolute inset-y-0 z-10" style={{ left: `${position}%` }}>
        <div className="absolute inset-y-0 -left-px w-px bg-paper shadow-[0_0_8px_rgba(0,0,0,0.25)]" />
        <div className="absolute top-1/2 left-0 flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-hair bg-paper text-ink shadow-sm">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M8 7l-5 5 5 5" />
            <path d="M16 7l5 5-5 5" />
          </svg>
        </div>
      </div>

      {/* Labels */}
      <span className="absolute top-3 left-3 z-10 rounded-full bg-paper/90 px-2.5 py-1 text-[11px] font-medium tracking-wide text-ink">
        Before
      </span>
      <span className="absolute top-3 right-3 z-10 rounded-full bg-paper/90 px-2.5 py-1 text-[11px] font-medium tracking-wide text-ink">
        After
      </span>
    </div>
  );
}