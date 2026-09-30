export function isTimeoutError(err: unknown): boolean {
  if (err instanceof Error) {
    if (err.name === "AbortError" || err.name === "TimeoutError") return true;
    if (/abort|timed? ?out/i.test(err.message)) return true;
    const cause = err.cause;
    if (cause instanceof Error && (cause.name === "AbortError" || cause.name === "TimeoutError")) {
      return true;
    }
  }
  return false;
}