import { redirect } from "next/navigation";

import { getAuthenticatedClient } from "@/lib/pocketbase/server";
import { listProjects } from "@/lib/history";
import { HistoryListView } from "@/components/history-list";
import { SidebarTrigger } from "@/components/ui/sidebar";

export const metadata = {
  title: "Design History — FortnAI",
};

export default async function HistoryPage() {
  const pb = await getAuthenticatedClient();
  if (!pb) {
    redirect("/sign-in");
  }

  const initial = await listProjects(pb, 1).catch(() => ({
    items: [],
    page: 1,
    perPage: 24,
    totalItems: 0,
    totalPages: 0,
  }));

  return (
    <main className="min-h-screen bg-paper text-ink">
      <div className="mx-auto max-w-5xl px-6 py-8 sm:px-10 sm:py-12">
        <header className="mb-10 flex items-center justify-between border-b border-hair pb-6">
          <div className="flex items-center gap-3">
            <SidebarTrigger className="-ml-2 text-mute hover:text-ink md:hidden" />
            <div>
              <p className="text-sm font-medium text-ink">Design History</p>
              <p className="mt-0.5 text-xs text-mute">Every room analysis you&apos;ve run</p>
            </div>
          </div>
        </header>

        <HistoryListView initial={initial} />
      </div>
    </main>
  );
}