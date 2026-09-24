import type { DesignResult } from "@/lib/schema";

export function BlueprintSpec({ design }: { design: DesignResult }) {
  const shoppingByIndex = new Map(
    (design.shopping?.items ?? []).map((entry) => [entry.itemIndex, entry])
  );

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
              <th className="px-4 py-3 font-medium">Size (W×D×H)</th>
              <th className="px-4 py-3 font-medium">Placement</th>
              <th className="px-4 py-3 font-medium">Source</th>
              <th className="px-6 py-3 text-right font-medium">Cost</th>
            </tr>
          </thead>
          <tbody>
            {design.furnitureRecommendations.map((f, index) => {
              const entry = shoppingByIndex.get(index);
              const cost = entry?.priceUSD ?? f.estimatedCostUSD;
              const real = entry?.dimensionsSource === "product";
              return (
                <tr key={`${f.item}-${index}`} className="border-b border-hair/70 last:border-0">
                  <td className="px-6 py-4 font-medium text-ink">{f.item}</td>
                  <td className="px-4 py-4 text-xs text-mute">
                    <span className="font-mono">
                      {f.width} cm × {f.depth} cm × {f.height} cm
                    </span>
                    <span className="ml-2 text-[10px] tracking-wide uppercase">
                      {real ? "real" : "est."}
                    </span>
                  </td>
                  <td className="max-w-xs px-4 py-4 text-xs leading-5 text-mute">
                    {f.placementNotes}
                  </td>
                  <td className="px-4 py-4 text-xs">
                    {entry?.product ? (
                      <a
                        href={entry.product.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium text-pine underline underline-offset-4"
                      >
                        {entry.product.retailer}
                      </a>
                    ) : (
                      <span className="text-mute">—</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right font-medium text-ink">
                    ${cost.toLocaleString()}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
