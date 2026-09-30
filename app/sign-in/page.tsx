import { redirect } from "next/navigation";
import Link from "next/link";

import { getAuthenticatedClient } from "@/lib/pocketbase/server";

import { SignInForm } from "./sign-in-form";

export default async function SignInPage() {
  const pb = await getAuthenticatedClient();
  if (pb) {
    redirect("/");
  }

  return (
    <main className="grid min-h-screen bg-paper lg:grid-cols-[minmax(0,0.88fr)_minmax(440px,1.12fr)]">
      <section className="flex flex-col px-6 py-8 sm:px-10 lg:px-16 lg:py-10">
        <Link href="/" className="flex w-fit items-center gap-3 text-ink" aria-label="FortnAI home">
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-pine">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-paper">
              <path d="M4 3v13h13" />
              <path d="M4 16l6-6 4 4 6-8" />
            </svg>
          </span>
          <span className="text-lg font-medium tracking-tight">FortnAI</span>
        </Link>

        <div className="flex flex-1 items-center justify-center py-20">
          <div className="w-full max-w-[380px]">
            <div className="mb-10">
              <h1 className="max-w-[12ch] text-4xl font-medium leading-[1.04] tracking-[-0.035em] text-ink sm:text-5xl">
                Your next room starts here.
              </h1>
              <p className="mt-5 max-w-[34ch] text-sm leading-6 text-mute">
                Sign in to turn your space into a measured, considered design plan.
              </p>
            </div>
            <SignInForm />
          </div>
        </div>

        <p className="text-xs text-mute">AI interior design, grounded in your actual room.</p>
      </section>

      <aside className="relative hidden overflow-hidden bg-pine lg:block" aria-label="FortnAI design preview">
        <div className="absolute inset-0 opacity-25 [background-image:linear-gradient(rgba(246,244,240,0.22)_1px,transparent_1px),linear-gradient(90deg,rgba(246,244,240,0.22)_1px,transparent_1px)] [background-size:64px_64px]" />
        <div className="relative flex h-full min-h-[720px] flex-col justify-between p-12 text-paper xl:p-16">
          <div className="flex items-center justify-between border-b border-paper/20 pb-5 text-xs tracking-[0.12em] uppercase">
            <span>FortnAI studio</span>
            <span>01 / 01</span>
          </div>

          <div className="relative mx-auto w-full max-w-[560px] py-12">
            <div className="absolute -right-2 top-8 h-24 w-24 rounded-full border border-paper/30" />
            <div className="absolute -left-5 bottom-6 h-16 w-16 border border-paper/25" />
            <svg viewBox="0 0 620 480" className="relative w-full" fill="none" role="img" aria-label="Abstract room layout drawing">
              <path d="M82 366V132l228-76 228 76v234H82Z" stroke="currentColor" strokeWidth="1.5" opacity=".8" />
              <path d="M82 132l228 82 228-82M310 214v152M82 366l228-64 228 64" stroke="currentColor" strokeWidth="1.5" opacity=".55" />
              <path d="M143 202h111v91H143zM366 220h105v75H366z" stroke="currentColor" strokeWidth="2" />
              <path d="M168 202v91M229 202v91M392 220v75M445 220v75" stroke="currentColor" strokeWidth="1" opacity=".5" />
              <circle cx="310" cy="214" r="31" stroke="currentColor" strokeWidth="1.5" />
              <path d="M279 214h62M310 183v62" stroke="currentColor" strokeWidth="1" opacity=".55" />
              <path d="M112 112h396M112 385h396" stroke="currentColor" strokeWidth="1" strokeDasharray="4 7" opacity=".45" />
            </svg>
            <div className="mt-8 flex items-end justify-between border-t border-paper/20 pt-4">
              <span className="text-sm text-paper/75">Room analysis / spatial study</span>
              <span className="text-xs text-paper/50">AI-01</span>
            </div>
          </div>

          </div>
      </aside>
    </main>
  );
}
