"use client";

import { useActionState, useState } from "react";
import { Eye, EyeOff } from "lucide-react";

import { signInAction, type SignInState } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

const initialState: SignInState = {};

export function SignInForm() {
  const [state, formAction, pending] = useActionState(signInAction, initialState);
  const [showPassword, setShowPassword] = useState(false);

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <FieldGroup className="gap-5">
        <Field>
          <FieldLabel htmlFor="email" className="text-ink">Email</FieldLabel>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            required
            className="mt-2 h-12 border-hair bg-surface px-4 text-sm shadow-none placeholder:text-mute/70 focus-visible:border-pine focus-visible:ring-pine/20"
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="password" className="text-ink">Password</FieldLabel>
          <div className="relative mt-2">
            <Input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              required
              className="h-12 border-hair bg-surface px-4 pr-12 text-sm shadow-none focus-visible:border-pine focus-visible:ring-pine/20"
            />
            <button
              type="button"
              onClick={() => setShowPassword((visible) => !visible)}
              className="absolute inset-y-0 right-3 flex items-center text-mute transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pine/30"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
            </button>
          </div>
        </Field>
      </FieldGroup>

      <FieldError className="text-red-700" errors={state.error ? [{ message: state.error }] : undefined} />
      <Field>
        <Button type="submit" disabled={pending} className="h-12 w-full rounded-md bg-pine text-sm text-paper hover:bg-pine/90">
          {pending ? "Signing in..." : "Sign in"}
        </Button>
      </Field>
      <FieldDescription className="text-center text-xs text-mute">
        Use the email and password from your FortnAI account.
      </FieldDescription>
    </form>
  );
}
