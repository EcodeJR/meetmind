type MetricLabels = Record<string, string | number | boolean | undefined>;

interface DurationMetric {
  count: number;
  totalMs: number;
  maxMs: number;
}

const counters = new Map<string, number>();
const durations = new Map<string, DurationMetric>();
const startedAt = Date.now();

const metricKey = (name: string, labels: MetricLabels = {}): string => {
  const normalizedLabels = Object.entries(labels)
    .filter(([, value]) => value !== undefined)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${String(value)}`)
    .join(',');

  return normalizedLabels ? `${name}{${normalizedLabels}}` : name;
};

/**
 * Small, dependency-free operational metrics registry. It intentionally keeps
 * only aggregate, non-user-identifying labels so it is safe to expose in logs
 * and can later be replaced by a hosted metrics provider without changing callers.
 */
export const incrementMetric = (name: string, labels?: MetricLabels, value = 1): void => {
  const key = metricKey(name, labels);
  counters.set(key, (counters.get(key) || 0) + value);
};

export const recordDuration = (name: string, durationMs: number, labels?: MetricLabels): void => {
  const key = metricKey(name, labels);
  const existing = durations.get(key) || { count: 0, totalMs: 0, maxMs: 0 };
  existing.count += 1;
  existing.totalMs += Math.max(0, durationMs);
  existing.maxMs = Math.max(existing.maxMs, durationMs);
  durations.set(key, existing);
};

export const getOperationalMetrics = () => ({
  uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000),
  counters: Object.fromEntries(counters.entries()),
  durations: Object.fromEntries(
    [...durations.entries()].map(([key, value]) => [key, {
      count: value.count,
      averageMs: Math.round(value.totalMs / value.count),
      maxMs: Math.round(value.maxMs),
    }])
  ),
});
