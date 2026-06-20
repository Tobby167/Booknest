type Bucket = {
  count: number;
  resetAt: number;
};

const globalStore = globalThis as typeof globalThis & {
  __booknestRateLimit?: Map<string, Bucket>;
};

function store() {
  globalStore.__booknestRateLimit ??= new Map<string, Bucket>();
  return globalStore.__booknestRateLimit;
}

export function getRequestKey(request: Request, scope: string) {
  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = forwardedFor || request.headers.get("x-real-ip") || "unknown";
  return `${scope}:${ip}`;
}

export function rateLimit(key: string, limit = 20, windowMs = 60_000) {
  const now = Date.now();
  const buckets = store();
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1 };
  }

  if (bucket.count >= limit) {
    return { allowed: false, remaining: 0 };
  }

  bucket.count += 1;
  return { allowed: true, remaining: limit - bucket.count };
}
