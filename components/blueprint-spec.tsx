import type { DesignResult } from "@/lib/schema";

export function BlueprintSpec({ design }: { design: DesignResult }) {
  return (
    <section className="overflow-hidden rounded-xl border border-hair bg-surface">
      <div className="flex items-baseline justify-between border-b border-hair px-6 py-5">
        <h3 className="text-base font-medium">Blueprint spec sheet</h3>
        <span className="text-xs text-mute">
          {design.furnitureRecommendations.length} pieces · sized to your room
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-hair text-[11px] tracking-wide text-mute">
              <th className="px-6 py-3 font-medium">Piece</th>
              <th className="px-4 py-3 font-medium">Max size (W×D×H)</th>
              <th className="px-4 py-3 font-medium">Placement</th>
              <th className="px-6 py-3 text-right font-medium">Est. cost</th>
            </tr>
          </thead>
          <tbody>
            {design.furnitureRecommendations.map((f) => (
              <tr key={f.item} className="border-b border-hair/70 last:border-0">
                <td className="px-6 py-4 font-medium text-ink">{f.item}</td>
                <td className="px-4 py-4 font-mono text-xs text-mute">
                  {f.width}″ × {f.depth}″ × {f.height}″
                </td>
                <td className="max-w-xs px-4 py-4 text-xs leading-5 text-mute">
                  {f.placementNotes}
                </td>
                <td className="px-6 py-4 text-right font-medium text-ink">
                  ${f.estimatedCostUSD.toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}