import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().trim().email("Enter a valid email address").transform((value) => value.toLowerCase()),
  password: z.string().min(1, "Enter your password").max(128, "Password is too long"),
});

export const signupSchema = z
  .object({
    email: z.string().trim().email("Enter a valid email address").transform((value) => value.toLowerCase()),
    password: z.string().min(8, "Password must be at least 8 characters").max(128, "Password is too long"),
    passwordConfirm: z.string().min(1, "Confirm your password").max(128, "Password is too long"),
  })
  .superRefine((data, context) => {
    if (data.password !== data.passwordConfirm) {
      context.addIssue({
        code: "custom",
        path: ["passwordConfirm"],
        message: "Passwords do not match",
      });
    }
  });
