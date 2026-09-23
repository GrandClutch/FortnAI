"use client";

import { useState } from "react";
import type { DesignResult } from "@/lib/schema";

export function BudgetCalculator({ design }: { design: DesignResult }) {
  const [selected, setSelected] = useState<Record<number, boolean>>({});
  const [prices, setPrices] = useState<Record<number, number>>({});

  const items = design.furnitureRecommendations.map((f, i) => ({
    ...f,
    index: i,
    included: selected[i] !== false,
    price: prices[i] ?? f.estimatedCostUSD,
  }));

  const total = items.filter((i) => i.included).reduce((sum, i) => sum + i.price, 0);
  const originalTotal = items
    .filter((i) => i.included)
    .reduce((s, i) => s + i.estimatedCostUSD, 0);

  return (
    <section className="overflow-hidden rounded-xl border border-hair bg-surface">
      <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-hair px-6 py-5">
        <div>
          <h3 className="text-base font-medium">Budget calculator</h3>
          <p className="mt-0.5 text-xs text-mute">Toggle pieces and adjust prices to plan your spend</p>
        </div>
        <div className="text-right">
          <span className="block text-[11px] tracking-wide text-mute">Total</span>
          <span className="text-2xl font-medium tracking-tight text-ink">
            ${total.toLocaleString()}
          </span>
        </div>
      </div>
      <div className="divide-y divide-hair/70">
        {items.map((f) => (
          <div
            key={f.item}
            className={`flex items-center gap-4 px-6 py-3.5 transition-opacity ${
              f.included ? "opacity-100" : "opacity-40"
            }`}
          >
            <input
              type="checkbox"
              checked={f.included}
              onChange={() => setSelected((s) => ({ ...s, [f.index]: !(s[f.index] !== false) }))}
              className="h-4 w-4 accent-pine"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-ink">{f.item}</p>
              <p className="text-[11px] text-mute">{f.category}</p>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-mute">$</span>
              <input
                type="number"
                min="0"
                value={f.price}
                onChange={(e) => setPrices((p) => ({ ...p, [f.index]: Number(e.target.value) || 0 }))}
                className="w-24 rounded-lg border border-hair bg-paper px-2.5 py-1.5 text-right text-sm font-medium text-ink outline-none focus:border-ink/60"
              />
            </div>
          </div>
        ))}
      </div>
      {originalTotal !== total && (
        <div className="flex justify-end border-t border-hair px-6 py-3 text-xs text-mute">
          Saved {(originalTotal - total).toLocaleString()} vs original estimate
        </div>
      )}
    </section>
  );
}