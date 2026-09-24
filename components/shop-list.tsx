import type { ShoppingResult } from "@/lib/schema";

export function ShopList({ shopping }: { shopping: ShoppingResult }) {
  const matched = shopping.items.filter((i) => i.product).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl border border-hair bg-surface px-6 py-4">
        <div>
          <span className="block text-[11px] tracking-wide text-mute">Real products</span>
          <span className="text-sm font-medium text-ink">
            {matched} of {shopping.items.length} matched
          </span>
        </div>
        <div>
          <span className="block text-[11px] tracking-wide text-mute">Total</span>
          <span className="text-sm font-medium text-ink">${shopping.totalUSD.toLocaleString()}</span>
        </div>
        <div>
          <span className="block text-[11px] tracking-wide text-mute">Target</span>
          <span className="text-sm font-medium text-ink">
            ${shopping.minUSD.toLocaleString()}–${shopping.maxUSD.toLocaleString()}
          </span>
        </div>
        <span
          className={`ml-auto rounded-full border px-2.5 py-1 text-[11px] font-medium tracking-wide ${
            shopping.inRange ? "border-pine/40 text-pine" : "border-ink/20 text-mute"
          }`}
        >
          {shopping.inRange ? "In budget" : "Out of budget"}
        </span>
      </div>

      {shopping.warnings && shopping.warnings.length > 0 && (
        <ul className="space-y-1 text-xs text-mute">
          {shopping.warnings.map((warning) => (
            <li key={warning}>· {warning}</li>
          ))}
        </ul>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {shopping.items.map((entry) => (
          <article
            key={`${entry.itemIndex}-${entry.item}`}
            className="flex flex-col overflow-hidden rounded-xl border border-hair bg-surface"
          >
            <div className="relative aspect-[4/3] w-full overflow-hidden bg-paper">
              {entry.product?.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={entry.product.imageUrl}
                  alt={entry.product.title}
                  className="h-full w-full object-contain p-3"
                />
              ) : (
                <span className="absolute inset-0 flex items-center justify-center text-xs text-mute">
                  No live match
                </span>
              )}
            </div>
            <div className="flex flex-1 flex-col gap-2 p-4">
              <p className="text-[11px] tracking-wide text-mute">{entry.item}</p>
              {entry.product ? (
                <>
                  <p className="line-clamp-2 text-sm font-medium text-ink">{entry.product.title}</p>
                  <p className="text-xs text-mute">
                    {entry.product.retailer}
                    {entry.product.rating ? ` · ${entry.product.rating.toFixed(1)}★` : ""}
                    {entry.product.reviews ? ` (${entry.product.reviews.toLocaleString()})` : ""}
                  </p>
                  <div className="mt-auto flex items-center justify-between pt-2">
                    <span className="text-sm font-medium text-ink">
                      ${entry.product.priceUSD.toLocaleString()}
                    </span>
                    <span className="text-[10px] tracking-wide text-mute uppercase">
                      {entry.dimensionsSource === "product" ? "Real size" : "Est. size"}
                    </span>
                  </div>
                  <a
                    href={entry.product.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 flex items-center justify-center gap-1.5 rounded-lg border border-ink px-4 py-2 text-xs font-medium text-ink transition-colors hover:bg-ink hover:text-paper"
                  >
                    View on {entry.product.retailer}
                  </a>
                </>
              ) : (
                <>
                  <p className="text-sm text-mute">No live product found.</p>
                  <p className="mt-auto text-sm font-medium text-ink">
                    ${entry.priceUSD.toLocaleString()}
                    <span className="ml-2 text-[10px] tracking-wide text-mute uppercase">
                      AI estimate
                    </span>
                  </p>
                </>
              )}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
