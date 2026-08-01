import { BusinessHours } from "@/types";

/**
 * Parser for the common subset of the OSM `opening_hours` syntax.
 *
 * The full specification supports date ranges, public holidays, sunset offsets, week
 * numbers and nested rule modifiers. Almost no real shop tag uses any of that. This
 * handles the forms that actually appear — `Mo-Fr 09:00-17:00; Sa 10:00-14:00; Su off`
 * and `24/7` — and returns null for anything else so the caller can fall back to
 * displaying the raw tag rather than showing something wrong.
 */

const DAY_INDEX: Record<string, number> = {
  su: 0,
  mo: 1,
  tu: 2,
  we: 3,
  th: 4,
  fr: 5,
  sa: 6,
};

/** Display order is Monday-first, matching how business hours are normally listed. */
const DISPLAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

interface Period {
  open: { day: number; time: string };
  close?: { day: number; time: string };
}

interface Range {
  startMin: number;
  endMin: number;
}

export function parseOpeningHours(spec: string): BusinessHours | null {
  const cleaned = spec.trim();
  if (cleaned.length === 0) return null;

  // Quoted comments and holiday rules are not something we can render honestly.
  if (/"/.test(cleaned) || /\b(PH|SH|easter|sunrise|sunset|dawn|dusk)\b/i.test(cleaned)) {
    return null;
  }

  const byDay = new Map<number, Range[]>();

  if (/^24\s*\/\s*7$/.test(cleaned)) {
    for (let day = 0; day < 7; day++) byDay.set(day, [{ startMin: 0, endMin: 1440 }]);
    return buildHours(byDay);
  }

  for (const rule of cleaned.split(";")) {
    const trimmed = rule.trim();
    if (trimmed.length === 0) continue;
    if (!applyRule(trimmed, byDay)) return null;
  }

  if (byDay.size === 0) return null;
  return buildHours(byDay);
}

function applyRule(rule: string, byDay: Map<number, Range[]>): boolean {
  const closed = /^([A-Za-z,\s-]*?)\s*(?:off|closed)$/i.exec(rule);
  if (closed) {
    const days = parseDays(closed[1]);
    if (!days) return false;
    for (const day of days) byDay.set(day, byDay.get(day) ?? []);
    return true;
  }

  const open = /^([A-Za-z,\s-]*?)\s*((?:\d{1,2}:\d{2}\s*-\s*\d{1,2}:\d{2})(?:\s*,\s*\d{1,2}:\d{2}\s*-\s*\d{1,2}:\d{2})*)$/.exec(
    rule
  );
  if (!open) return false;

  const days = parseDays(open[1]);
  if (!days) return false;

  const ranges = parseRanges(open[2]);
  if (!ranges) return false;

  for (const day of days) {
    // A later rule for the same day replaces the earlier one, per the OSM spec.
    byDay.set(day, ranges);
  }
  return true;
}

/** An empty day specification means the rule applies every day. */
function parseDays(spec: string): number[] | null {
  const trimmed = spec.trim();
  if (trimmed.length === 0) return [0, 1, 2, 3, 4, 5, 6];

  const days = new Set<number>();

  for (const token of trimmed.split(",")) {
    const part = token.trim();
    if (part.length === 0) continue;

    const range = /^([A-Za-z]{2})\s*-\s*([A-Za-z]{2})$/.exec(part);
    if (range) {
      const from = DAY_INDEX[range[1].toLowerCase()];
      const to = DAY_INDEX[range[2].toLowerCase()];
      if (from === undefined || to === undefined) return null;
      // Ranges wrap: Sa-Mo means Saturday, Sunday, Monday.
      for (let day = from; ; day = (day + 1) % 7) {
        days.add(day);
        if (day === to) break;
      }
      continue;
    }

    const single = DAY_INDEX[part.toLowerCase()];
    if (single === undefined) return null;
    days.add(single);
  }

  return days.size > 0 ? Array.from(days) : null;
}

function parseRanges(spec: string): Range[] | null {
  const ranges: Range[] = [];

  for (const token of spec.split(",")) {
    const match = /^\s*(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})\s*$/.exec(token);
    if (!match) return null;

    const startMin = Number(match[1]) * 60 + Number(match[2]);
    const endRaw = Number(match[3]) * 60 + Number(match[4]);
    if (startMin > 1440 || endRaw > 1440) return null;

    // An end at or before the start crosses midnight: 18:00-02:00.
    const endMin = endRaw <= startMin ? endRaw + 1440 : endRaw;
    ranges.push({ startMin, endMin });
  }

  return ranges.length > 0 ? ranges : null;
}

function buildHours(byDay: Map<number, Range[]>): BusinessHours {
  const periods: Period[] = [];

  for (let day = 0; day < 7; day++) {
    for (const range of byDay.get(day) ?? []) {
      const crossesMidnight = range.endMin > 1440;
      periods.push({
        open: { day, time: toHHMM(range.startMin) },
        close: {
          day: crossesMidnight ? (day + 1) % 7 : day,
          time: toHHMM(crossesMidnight ? range.endMin - 1440 : range.endMin),
        },
      });
    }
  }

  const weekday_text = DISPLAY_ORDER.map((day) => {
    const ranges = byDay.get(day);
    if (ranges === undefined) return `${DAY_NAMES[day]}: Closed`;
    if (ranges.length === 0) return `${DAY_NAMES[day]}: Closed`;
    if (ranges.length === 1 && ranges[0].startMin === 0 && ranges[0].endMin === 1440) {
      return `${DAY_NAMES[day]}: Open 24 hours`;
    }
    const text = ranges
      .map((r) => `${formatTime(r.startMin)} – ${formatTime(r.endMin % 1440)}`)
      .join(", ");
    return `${DAY_NAMES[day]}: ${text}`;
  });

  return { periods, weekday_text };
}

/**
 * Whether a business is open at `now`, using the viewer's local clock.
 *
 * Deliberately client-side: the server's time zone has nothing to do with the
 * business's. This is right when prospecting in your own region and, since the full
 * weekday hours are always displayed next to it, harmless when it is not.
 */
export function isOpenNow(
  hours: BusinessHours | undefined,
  now = new Date()
): boolean | undefined {
  const periods = hours?.periods;
  if (!periods || periods.length === 0) return undefined;

  const nowDay = now.getDay();
  const nowMin = now.getHours() * 60 + now.getMinutes();

  for (const period of periods) {
    const openDay = period.open.day;
    const openMin = fromHHMM(period.open.time);
    if (!period.close) {
      if (nowDay === openDay && nowMin >= openMin) return true;
      continue;
    }

    const closeDay = period.close.day;
    const closeMin = fromHHMM(period.close.time);

    if (closeDay === openDay) {
      const endMin = closeMin === 0 ? 1440 : closeMin;
      if (nowDay === openDay && nowMin >= openMin && nowMin < endMin) return true;
    } else {
      if (nowDay === openDay && nowMin >= openMin) return true;
      if (nowDay === closeDay && nowMin < closeMin) return true;
    }
  }

  return false;
}

/**
 * Midnight-as-closing-time is written "2400", not "0000".
 *
 * Collapsing it to "0000" made a 24-hour day close the instant it opened, which is how
 * a business tagged `24/7` reported itself shut at 23:59.
 */
function toHHMM(minutes: number): string {
  const capped = Math.min(minutes, 1440);
  const h = Math.floor(capped / 60);
  const m = capped % 60;
  return `${String(h).padStart(2, "0")}${String(m).padStart(2, "0")}`;
}

function fromHHMM(time: string): number {
  return Number(time.slice(0, 2)) * 60 + Number(time.slice(2, 4));
}

function formatTime(minutes: number): string {
  const h24 = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  const suffix = h24 < 12 ? "AM" : "PM";
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${suffix}`;
}
