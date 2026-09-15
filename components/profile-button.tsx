"use client";

import { useState } from "react";
import { useAuth } from "@/components/auth-provider";

interface ProfileButtonProps {
  onOpenAuth: () => void;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "F";
  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function ProfileButton({ onOpenAuth }: ProfileButtonProps) {
  const { status, user, signOut } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  if (status === "loading") {
    return <span className="h-10 w-10 shrink-0 animate-pulse rounded-full border border-hair bg-surface" />;
  }

  if (!user) {
    return (
      <button
        type="button"
        onClick={onOpenAuth}
        aria-label="Sign in or create an account"
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-hair bg-surface text-ink transition-colors hover:border-ink/50 hover:bg-ink hover:text-paper"
      >
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
          <circle cx="12" cy="8" r="3.2" />
          <path d="M5.5 20c.8-3.3 3-5 6.5-5s5.7 1.7 6.5 5" />
        </svg>
      </button>
    );
  }

  const label = user.displayName || user.email;

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={() => setMenuOpen((open) => !open)}
        aria-label="Open profile menu"
        aria-expanded={menuOpen}
        className="flex h-10 w-10 items-center justify-center rounded-full bg-pine text-sm font-medium text-paper transition-colors hover:bg-ink"
      >
        {initials(user.displayName || user.email)}
      </button>
      {menuOpen && (
        <div className="absolute right-0 top-12 z-30 w-64 rounded-xl border border-hair bg-paper p-4 text-left shadow-[0_14px_40px_rgba(33,31,27,0.12)]">
          <p className="truncate text-sm font-medium text-ink">{label}</p>
          <p className="mt-1 truncate text-xs text-mute">{user.email}</p>
          <button
            type="button"
            onClick={() => {
              setMenuOpen(false);
              void signOut();
            }}
            className="mt-4 w-full rounded-lg border border-hair px-3 py-2 text-left text-sm font-medium text-ink transition-colors hover:border-ink/50"
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
