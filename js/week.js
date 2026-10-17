// "The week on screen": the calendar tab lists one week at a time, Monday first, instead of
// a whole month that keeps growing. Pure helpers, no DOM.
import { startOfWeek, addDays, monthNameFmt } from './dates.js';

// weekStart is null for "this week", so it keeps meaning this week as the days go by.
export function resolveWeek(weekStart, now = new Date()) {
  const current = startOfWeek(now);
  const start = weekStart ? startOfWeek(weekStart) : current;
  return { start, end: addDays(start, 6), isCurrent: start.getTime() === current.getTime() };
}

// "12–18 October" or "28 September – 4 October"
export function weekLabel(start) {
  const end = addDays(start, 6);
  if (start.getMonth() === end.getMonth()) return `${start.getDate()}–${end.getDate()} ${monthNameFmt.format(end)}`;
  return `${start.getDate()} ${monthNameFmt.format(start)} – ${end.getDate()} ${monthNameFmt.format(end)}`;
}

// The value to keep in state for the week containing `date`: null when that is this week.
export function storedWeek(date, now = new Date()) {
  const start = startOfWeek(date);
  return start.getTime() === startOfWeek(now).getTime() ? null : start;
}

// One week back (-1) or forward (+1). Returns the new stored week, or undefined when it
// would be in the future.
export function shiftWeek(weekStart, direction, now = new Date()) {
  const next = addDays(resolveWeek(weekStart, now).start, direction * 7);
  if (next.getTime() > startOfWeek(now).getTime()) return undefined;
  return storedWeek(next, now);
}

// The month a week belongs to for the month grid: the one holding most of its days.
export function monthOfWeek(start) {
  const middle = addDays(start, 3);
  return new Date(middle.getFullYear(), middle.getMonth(), 1);
}

export function entriesInWeek(entries, start) {
  const from = start.getTime();
  const to = addDays(start, 7).getTime();
  return entries.filter((e) => e.t >= from && e.t < to);
}

export const inWeek = (date, start) => {
  const t = date.getTime();
  return t >= start.getTime() && t < addDays(start, 7).getTime();
};
