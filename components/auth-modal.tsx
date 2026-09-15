"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth-provider";

type AuthMode = "signin" | "signup";

interface AuthModalProps {
  open: boolean;
  onClose: () => void;
}

export function AuthModal({ open, onClose }: AuthModalProps) {
  const { refresh } = useAuth();
  const [mode, setMode] = useState<AuthMode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (mode === "signup" && password !== passwordConfirm) {
      setError("Passwords do not match.");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/auth/${mode === "signup" ? "signup" : "login"}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(
          mode === "signup"
            ? { email, password, passwordConfirm }
            : { email, password }
        ),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error || "Authentication failed");

      await refresh();
      onClose();
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : "Authentication failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  const startGoogleAuth = () => {
    setError(null);
    setIsGoogleLoading(true);

    const width = 520;
    const height = 680;
    const left = window.screenX + Math.max(0, (window.outerWidth - width) / 2);
    const top = window.screenY + Math.max(0, (window.outerHeight - height) / 2);
    const popup = window.open(
      "/api/auth/google/start",
      "fortnai-google-auth",
      `width=${width},height=${height},left=${left},top=${top}`
    );

    if (!popup) {
      setIsGoogleLoading(false);
      window.location.replace("/api/auth/google/start");
      return;
    }

    let finished = false;
    const cleanup = () => {
      window.removeEventListener("message", onMessage);
      window.clearInterval(popupCheck);
    };
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.source !== "fortnai-auth") return;

      finished = true;
      cleanup();
      setIsGoogleLoading(false);
      if (event.data.type === "success") {
        void refresh().then(() => onClose());
      } else {
        setError(event.data.message || "Google sign-in failed");
      }
    };
    const popupCheck = window.setInterval(() => {
      if (!popup.closed || finished) return;
      cleanup();
      setIsGoogleLoading(false);
      setError("Google sign-in was cancelled");
    }, 500);

    window.addEventListener("message", onMessage);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/25 px-5 py-8 backdrop-blur-[2px]"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-modal-title"
        className="w-full max-w-[390px] rounded-2xl border border-hair bg-paper px-6 py-7 shadow-[0_20px_70px_rgba(33,31,27,0.18)] sm:px-8"
      >
        <div className="mb-7 flex items-start justify-between gap-4">
          <div>
            <h2 id="auth-modal-title" className="text-2xl font-medium tracking-tight text-ink">
              {mode === "signin" ? "Sign in" : "Sign up"}
            </h2>
            <p className="mt-2 text-sm text-mute">
              {mode === "signin" ? "Welcome back to your studio." : "Create your FortnAI account."}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close authentication dialog"
            className="flex h-8 w-8 items-center justify-center rounded-full text-mute transition-colors hover:bg-surface hover:text-ink"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label htmlFor="auth-email" className="mb-1.5 block text-xs text-mute">
              Email
            </label>
            <input
              id="auth-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoFocus
              required
              className="w-full rounded-lg border border-hair bg-surface px-3.5 py-3 text-sm text-ink outline-none transition-colors focus:border-ink/60"
            />
          </div>

          <div>
            <label htmlFor="auth-password" className="mb-1.5 block text-xs text-mute">
              Password
            </label>
            <input
              id="auth-password"
              type="password"
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              className="w-full rounded-lg border border-hair bg-surface px-3.5 py-3 text-sm text-ink outline-none transition-colors focus:border-ink/60"
            />
          </div>

          {mode === "signup" && (
            <div>
              <label htmlFor="auth-password-confirm" className="mb-1.5 block text-xs text-mute">
                Confirm password
              </label>
              <input
                id="auth-password-confirm"
                type="password"
                autoComplete="new-password"
                value={passwordConfirm}
                onChange={(event) => setPasswordConfirm(event.target.value)}
                required
                className="w-full rounded-lg border border-hair bg-surface px-3.5 py-3 text-sm text-ink outline-none transition-colors focus:border-ink/60"
              />
            </div>
          )}

          {error && (
            <p role="alert" className="rounded-lg border border-ink/15 bg-surface px-3 py-2.5 text-xs leading-relaxed text-ink">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={isSubmitting || isGoogleLoading}
            className="flex w-full items-center justify-center rounded-lg bg-ink px-4 py-3 text-sm font-medium text-paper transition-colors hover:bg-ink/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting ? "Please wait..." : mode === "signin" ? "Sign in" : "Sign up"}
          </button>
        </form>

        <p className="mt-5 text-center text-xs text-mute">
          {mode === "signin" ? "Don't have an account?" : "Already have an account?"}{" "}
          <button
            type="button"
            onClick={() => {
              setMode(mode === "signin" ? "signup" : "signin");
              setError(null);
            }}
            className="font-medium text-pine underline underline-offset-4"
          >
            {mode === "signin" ? "Sign up" : "Sign in"}
          </button>
        </p>

        <div className="my-5 flex items-center gap-3 text-[11px] text-mute">
          <span className="h-px flex-1 bg-hair" />
          <span>or continue with</span>
          <span className="h-px flex-1 bg-hair" />
        </div>

        <button
          type="button"
          onClick={startGoogleAuth}
          disabled={isSubmitting || isGoogleLoading}
          className="flex w-full items-center justify-center gap-3 rounded-lg border border-hair bg-surface px-4 py-3 text-sm font-medium text-ink transition-colors hover:border-ink/50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <svg width="17" height="17" viewBox="0 0 24 24" aria-hidden="true">
            <path fill="#4285F4" d="M21.6 12.23c0-.72-.06-1.42-.18-2.09H12v3.96h5.38a4.6 4.6 0 0 1-1.99 3.02v2.51h3.23c1.89-1.74 2.98-4.3 2.98-7.4Z" />
            <path fill="#34A853" d="M12 22c2.7 0 4.96-.9 6.62-2.44l-3.23-2.51c-.9.6-2.05.96-3.39.96-2.6 0-4.8-1.76-5.59-4.12H3.07v2.59A10 10 0 0 0 12 22Z" />
            <path fill="#FBBC05" d="M6.41 13.89A6 6 0 0 1 6.1 12c0-.66.11-1.3.31-1.89V7.52H3.07A10 10 0 0 0 2 12c0 1.61.39 3.13 1.07 4.48l3.34-2.59Z" />
            <path fill="#EA4335" d="M12 5.99c1.47 0 2.79.5 3.83 1.48l2.87-2.87C16.96 2.99 14.7 2 12 2a10 10 0 0 0-8.93 5.52l3.34 2.59C7.2 7.75 9.4 5.99 12 5.99Z" />
          </svg>
          {isGoogleLoading ? "Connecting..." : "Continue with Google"}
        </button>
      </section>
    </div>
  );
}
