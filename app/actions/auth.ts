"use server";

import { redirect } from "next/navigation";
import PocketBase from "pocketbase";

import { POCKETBASE_URL } from "@/lib/pocketbase/constants";
import { clearAuthCookie, setAuthCookie } from "@/lib/pocketbase/server";

export type SignInState = {
  error?: string;
};

export async function signInAction(
  _previousState: SignInState,
  formData: FormData
): Promise<SignInState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Enter your email and password to continue." };
  }

  const pb = new PocketBase(POCKETBASE_URL);
  pb.autoCancellation(false);

  try {
    await pb.collection("users").authWithPassword(email, password);
  } catch {
    return { error: "That email or password is not correct." };
  }

  await setAuthCookie(pb);
  redirect("/");
}

export async function logoutAction() {
  await clearAuthCookie();
  redirect("/sign-in");
}
