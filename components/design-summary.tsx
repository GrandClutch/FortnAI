import type { DesignResult } from "@/lib/schema";

export function DesignSummary({ design }: { design: DesignResult }) {
  return (
    <section className="max-w-3xl space-y-8">
      <div>
        <h3 className="mb-2 text-xs tracking-wide text-mute">Design direction</h3>
        <p className="text-2xl font-medium leading-snug tracking-tight">
          {design.designTheme}
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          {design.colorPalette.map((hex) => (
            <span key={hex} className="flex items-center gap-2">
              <span
                className="h-6 w-6 rounded-full border border-hair"
                style={{ backgroundColor: hex }}
              />
              <span className="font-mono text-xs text-mute">{hex}</span>
            </span>
          ))}
        </div>
      </div>

      <div className="border-t border-hair pt-6">
        <h3 className="mb-2 text-xs tracking-wide text-mute">Spatial strategy</h3>
        <p className="text-[15px] leading-relaxed text-ink/90">
          {design.spatialStrategy}
        </p>
      </div>

      <div className="border-t border-hair pt-6">
        <h3 className="mb-2 text-xs tracking-wide text-mute">Lighting</h3>
        <p className="text-[15px] leading-relaxed text-ink/90">
          {design.lightingAdvice}
        </p>
      </div>
    </section>
  );
}