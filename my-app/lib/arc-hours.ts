export type ArcCalendarDate = `${number}-${string}-${string}`;

export type OpenHour = {
  key: string;
  label: string;
};

const PACIFIC_TIME_ZONE = "America/Los_Angeles";

function getPacificParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: PACIFIC_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  return Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value])
  );
}

function hourLabel(hour: number) {
  const period = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;
  return `${displayHour} ${period}`;
}

function sampleKey(date: string, hour: number) {
  const period = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;
  return `${date}|${String(displayHour).padStart(2, "0")}:00 ${period}`;
}

function getHourFromTimestamp(timestamp: string) {
  const match = timestamp.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)$/i);
  if (!match) return null;

  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour < 1 || hour > 12 || minute > 59) return null;

  const normalizedHour = (hour % 12) + (match[3].toUpperCase() === "PM" ? 12 : 0);
  return normalizedHour;
}

/** Summer hours are applied from June 1 through August 31. */
function isSummerDate(date: string) {
  const month = Number(date.split("-")[1]);
  return month >= 6 && month <= 8;
}

export function isArcOpen(date: string, timestamp: string) {
  const hour = getHourFromTimestamp(timestamp);
  if (hour === null) return false;

  const [year, month, day] = date.split("-").map(Number);
  if (!year || !month || !day) return false;

  const dayOfWeek = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
  const [opensAt, closesAt] = isSummerDate(date)
    ? isWeekend
      ? [9, 21]
      : [6, 22]
    : isWeekend
      ? [8, 23]
      : [5, 24];

  return hour >= opensAt && hour < closesAt;
}

/** Returns one x-axis mark for every open hour in the rolling 24-hour window. */
export function getOpenHoursInLast24Hours(now = new Date()): OpenHour[] {
  const openHours: OpenHour[] = [];

  for (let offset = 23; offset >= 0; offset -= 1) {
    const parts = getPacificParts(new Date(now.getTime() - offset * 60 * 60 * 1000));
    const date = `${parts.year}-${parts.month}-${parts.day}`;
    const hour = Number(parts.hour);
    const timestamp = `${String(hour % 12 || 12).padStart(2, "0")}:00 ${
      hour >= 12 ? "PM" : "AM"
    }`;

    if (isArcOpen(date, timestamp)) {
      openHours.push({ key: sampleKey(date, hour), label: hourLabel(hour) });
    }
  }

  return openHours;
}

export function getSampleKey(date: string, timestamp: string) {
  const match = timestamp.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)$/i);
  if (!match) return null;

  const hour = getHourFromTimestamp(timestamp);
  if (hour === null) return null;

  const displayHour = String(hour % 12 || 12).padStart(2, "0");
  return `${date}|${displayHour}:${match[2]} ${match[3].toUpperCase()}`;
}
