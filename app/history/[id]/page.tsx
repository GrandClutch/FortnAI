import { notFound, redirect } from "next/navigation";

import { getAuthenticatedClient } from "@/lib/pocketbase/server";
import { getProjectDetail, touchProjectOpened } from "@/lib/history";
import { DesignDetailView } from "@/components/design-detail";
import { SidebarTrigger } from "@/components/ui/sidebar";

export const metadata = {
  title: "Design — FortnAI",
};

export default async function DesignDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const pb = await getAuthenticatedClient();
  if (!pb) {
    redirect("/sign-in");
  }

  const detail = await getProjectDetail(pb, id);
  if (!detail) {
    notFound();
  }

  await touchProjectOpened(pb, id).catch(() => undefined);

  return (
    <main className="min-h-screen bg-paper text-ink">
      <div className="mx-auto max-w-5xl px-6 py-8 sm:px-10 sm:py-12">
        <header className="mb-10 flex items-center justify-between border-b border-hair pb-6">
          <div className="flex items-center gap-3">
            <SidebarTrigger className="-ml-2 text-mute hover:text-ink md:hidden" />
            <div>
              <p className="text-sm font-medium text-ink">Design Studio</p>
              <p className="mt-0.5 text-xs text-mute">Saved room analysis</p>
            </div>
          </div>
          <span className="hidden text-xs text-mute sm:block">
            {detail.width} m × {detail.length} m × {detail.height} m room
          </span>
        </header>

        <DesignDetailView detail={detail} />
      </div>
    </main>
  );
}