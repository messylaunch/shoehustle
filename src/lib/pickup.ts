// Pickup meets, formatted for humans.

export const DAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

export interface MeetLike {
  name: string;
  city: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
}

/** "12:00" -> "12pm", "18:30" -> "6:30pm". */
export function formatTime(value: string): string {
  const [hoursRaw, minutesRaw] = value.split(":");
  const hours = Number(hoursRaw);
  const minutes = Number(minutesRaw ?? 0);
  if (!Number.isFinite(hours)) return value;

  const suffix = hours >= 12 ? "pm" : "am";
  const display = hours % 12 === 0 ? 12 : hours % 12;
  return minutes
    ? `${display}:${String(minutes).padStart(2, "0")}${suffix}`
    : `${display}${suffix}`;
}

export function dayName(dayOfWeek: number): string {
  return DAYS[dayOfWeek] ?? "Saturday";
}

/** "Saturdays 12pm–2pm · Kroger lot, Dayton" */
export function formatMeet(meet: MeetLike): string {
  return `${dayName(meet.dayOfWeek)}s ${formatTime(meet.startTime)}–${formatTime(
    meet.endTime,
  )} · ${meet.name}, ${meet.city}`;
}

/** Short form for a chip or a line under a price. */
export function formatSlot(meet: MeetLike): string {
  return `${dayName(meet.dayOfWeek)}s ${formatTime(meet.startTime)}`;
}

/**
 * The next date this meet happens, so a buyer sees "this Saturday" rather
 * than having to work it out. Returns today's meet if it hasn't ended yet.
 */
export function nextOccurrence(meet: MeetLike, now = new Date()): Date {
  const [endHours, endMinutes] = meet.endTime.split(":").map(Number);
  const result = new Date(now);

  let delta = (meet.dayOfWeek - now.getDay() + 7) % 7;
  if (delta === 0) {
    const endsToday = new Date(now);
    endsToday.setHours(endHours || 0, endMinutes || 0, 0, 0);
    // Today's slot already finished, so the next one is next week.
    if (now > endsToday) delta = 7;
  }

  result.setDate(now.getDate() + delta);
  const [startHours, startMinutes] = meet.startTime.split(":").map(Number);
  result.setHours(startHours || 0, startMinutes || 0, 0, 0);
  return result;
}
