export function readNonEmptyString(
  value: unknown,
  field: string,
  maximumLength = 500,
) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${field} is required.`);
  }

  const normalized = value.trim();
  if (normalized.length > maximumLength) {
    throw new Error(`${field} must be ${maximumLength} characters or fewer.`);
  }

  return normalized;
}

export function readPositiveInteger(value: unknown, field: string) {
  const normalized = typeof value === "string" ? Number(value) : value;
  if (!Number.isInteger(normalized) || Number(normalized) < 1) {
    throw new Error(`${field} must be a positive whole number.`);
  }

  return Number(normalized);
}

export function readPositiveMoney(value: unknown, field: string) {
  const normalized = typeof value === "string" ? Number(value) : value;
  if (
    typeof normalized !== "number"
    || !Number.isFinite(normalized)
    || normalized <= 0
  ) {
    throw new Error(`${field} must be greater than zero.`);
  }

  return Math.round(normalized * 100) / 100;
}

export function isIsoDate(value: unknown): value is string {
  return typeof value === "string"
    && /^\d{4}-\d{2}-\d{2}$/.test(value)
    && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

export function todayIsoDate() {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 10);
}

export function errorResponse(error: unknown, fallback: string) {
  return Response.json(
    { error: error instanceof Error ? error.message : fallback },
    { status: 400 },
  );
}
