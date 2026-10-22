export function formatDate(value: Date | string, withYear = false) {
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    ...(withYear ? { year: "numeric" } : {}),
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}
export function formatDuration(minutes: number | null) {
  if (minutes === null || Number.isNaN(minutes)) return "—";
  if (minutes < 60) return `${Math.round(minutes)} 分钟`;
  return `${Math.floor(minutes / 60)} 小时 ${Math.round(minutes % 60)} 分钟`;
}
const CHINA_OFFSET_MS = 8 * 60 * 60 * 1000;
export function startOfDay(date = new Date()) {
  const shifted = new Date(date.getTime() + CHINA_OFFSET_MS);
  return new Date(
    Date.UTC(
      shifted.getUTCFullYear(),
      shifted.getUTCMonth(),
      shifted.getUTCDate(),
    ) - CHINA_OFFSET_MS,
  );
}
export function startOfWeek(date = new Date()) {
  const dayStart = startOfDay(date);
  const shifted = new Date(dayStart.getTime() + CHINA_OFFSET_MS);
  const day = shifted.getUTCDay() || 7;
  return new Date(dayStart.getTime() - (day - 1) * 24 * 60 * 60 * 1000);
}
export function startOfMonth(date = new Date()) {
  const shifted = new Date(date.getTime() + CHINA_OFFSET_MS);
  return new Date(
    Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), 1) -
      CHINA_OFFSET_MS,
  );
}
export function chinaDateKey(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(date)
    .replaceAll("-", "");
}
