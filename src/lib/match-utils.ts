export type MatchStatus = "completed" | "today" | "upcoming";
export type RuntimeMatchStatus = MatchStatus | "live";

const MATCH_LIVE_LEAD_MS = 15 * 60 * 1000;
const MATCH_LIVE_WINDOW_MS = 120 * 60 * 1000;

export function getLocalDateKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function normalizeDate(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }

  const date = value.trim();
  if (!date) {
    return "";
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return date;
  }

  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) {
    return date;
  }

  return getLocalDateKey(parsed);
}

export function normalizeMatchDateTime(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }

  const date = value.trim();
  if (!date) {
    return "";
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return `${date}T00:00`;
  }

  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(date)) {
    return date;
  }

  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) {
    return date;
  }

  const hours = String(parsed.getHours()).padStart(2, "0");
  const minutes = String(parsed.getMinutes()).padStart(2, "0");
  return `${getLocalDateKey(parsed)}T${hours}:${minutes}`;
}

export function parseMatchDateTime(dateString: string): Date | null {
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
    const [year, month, day] = dateString.split("-").map(Number);
    return new Date(year, month - 1, day);
  }

  const parsed = new Date(dateString);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed;
  }

  const normalizedDate = normalizeDate(dateString);
  if (/^\d{4}-\d{2}-\d{2}$/.test(normalizedDate)) {
    const [year, month, day] = normalizedDate.split("-").map(Number);
    return new Date(year, month - 1, day);
  }

  return null;
}

export function getMatchSortValue(dateString: string): number {
  return parseMatchDateTime(dateString)?.getTime() ?? Number.MAX_SAFE_INTEGER;
}

export function getMatchLiveStart(dateString: string): Date | null {
  const matchDate = parseMatchDateTime(dateString);
  if (!matchDate) {
    return null;
  }

  return new Date(matchDate.getTime() - MATCH_LIVE_LEAD_MS);
}

export function getMatchLiveEnd(dateString: string): Date | null {
  const matchDate = parseMatchDateTime(dateString);
  if (!matchDate) {
    return null;
  }

  return new Date(matchDate.getTime() + MATCH_LIVE_WINDOW_MS);
}

export function deriveMatchStatus(dateString: string): MatchStatus {
  const today = getLocalDateKey();
  const matchDate = normalizeDate(dateString);

  if (!matchDate) {
    return "upcoming";
  }

  if (matchDate < today) {
    return "completed";
  }

  if (matchDate === today) {
    return "today";
  }

  return "upcoming";
}

export function deriveRuntimeMatchStatus(dateString: string, now = new Date()): RuntimeMatchStatus {
  const matchDate = parseMatchDateTime(dateString);
  const liveStart = getMatchLiveStart(dateString);
  const liveEnd = getMatchLiveEnd(dateString);

  if (!matchDate) {
    return deriveMatchStatus(dateString);
  }

  const today = getLocalDateKey(now);
  const matchDay = getLocalDateKey(matchDate);

  if (matchDay < today) {
    return "completed";
  }

  if (matchDay > today) {
    return "upcoming";
  }

  if (liveStart && now.getTime() < liveStart.getTime()) {
    return "today";
  }

  if (liveEnd && now.getTime() <= liveEnd.getTime()) {
    return "live";
  }

  return "completed";
}

export function formatMatchDate(dateString: string): string {
  const hasTime = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(dateString);
  const matchDate = normalizeDate(dateString);
  if (!matchDate) {
    return dateString;
  }

  const [year, month, day] = matchDate.split("-").map(Number);
  const [, time = "00:00"] = dateString.split("T");
  const [hours, minutes] = time.split(":").map(Number);
  const date = new Date(year, month - 1, day, hours || 0, minutes || 0);
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    ...(hasTime ? { hour: "numeric", minute: "2-digit" } : {}),
  }).format(date);
}
