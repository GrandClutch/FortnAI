interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

function clientAddress(request: Request): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    ?? request.headers.get("x-real-ip")
    ?? "local";
}

export function checkRateLimit(
  request: Request,
  key: string,
  limit: number,
  windowMs: number
): { allowed: boolean; retryAfter: number } {
  const now = Date.now();
  const bucketKey = `${key}:${clientAddress(request)}`;
  const current = buckets.get(bucketKey);
  const bucket = !current || current.resetAt <= now
    ? { count: 0, resetAt: now + windowMs }
    : current;

  bucket.count += 1;
  buckets.set(bucketKey, bucket);

  if (buckets.size > 5000) {
    for (const [storedKey, storedBucket] of buckets) {
      if (storedBucket.resetAt <= now) buckets.delete(storedKey);
    }
  }

  return {
    allowed: bucket.count <= limit,
    retryAfter: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
  };
}

export function rateLimitResponse(retryAfter: number): Response {
  return Response.json(
    { error: "Too many requests. Please try again later." },
    { status: 429, headers: { "Retry-After": String(retryAfter) } }
  );
}
