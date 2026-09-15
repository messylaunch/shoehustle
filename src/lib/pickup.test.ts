import { describe, expect, it } from "vitest";
import { dayName, formatMeet, formatSlot, formatTime, nextOccurrence } from "./pickup";

const saturdayMeet = {
  name: "Kroger lot",
  city: "Dayton",
  dayOfWeek: 6,
  startTime: "12:00",
  endTime: "14:00",
};

describe("formatTime", () => {
  it("reads like a person wrote it", () => {
    expect(formatTime("12:00")).toBe("12pm");
    expect(formatTime("18:30")).toBe("6:30pm");
    expect(formatTime("09:00")).toBe("9am");
    expect(formatTime("00:00")).toBe("12am");
    expect(formatTime("00:15")).toBe("12:15am");
  });

  it("hands back anything it can't parse", () => {
    expect(formatTime("nonsense")).toBe("nonsense");
  });
});

describe("dayName", () => {
  it("names each day", () => {
    expect(dayName(0)).toBe("Sunday");
    expect(dayName(6)).toBe("Saturday");
  });

  it("falls back rather than showing undefined", () => {
    expect(dayName(99)).toBe("Saturday");
  });
});

describe("formatMeet", () => {
  it("reads as one line a buyer can act on", () => {
    expect(formatMeet(saturdayMeet)).toBe(
      "Saturdays 12pm–2pm · Kroger lot, Dayton",
    );
  });
});

describe("formatSlot", () => {
  it("is the short version", () => {
    expect(formatSlot(saturdayMeet)).toBe("Saturdays 12pm");
  });
});

describe("nextOccurrence", () => {
  it("finds the coming Saturday from midweek", () => {
    // Wednesday 9 Sept 2026.
    const wednesday = new Date("2026-09-09T10:00:00");
    const next = nextOccurrence(saturdayMeet, wednesday);
    expect(next.getDay()).toBe(6);
    expect(next.getDate()).toBe(12);
    expect(next.getHours()).toBe(12);
  });

  it("returns today's meet when it hasn't finished", () => {
    // Saturday 12 Sept, 11am — the meet runs 12pm to 2pm.
    const saturdayMorning = new Date("2026-09-12T11:00:00");
    const next = nextOccurrence(saturdayMeet, saturdayMorning);
    expect(next.getDate()).toBe(12);
  });

  it("rolls to next week once today's meet has ended", () => {
    // Saturday 12 Sept, 3pm — an hour after it wrapped up.
    const saturdayEvening = new Date("2026-09-12T15:00:00");
    const next = nextOccurrence(saturdayMeet, saturdayEvening);
    expect(next.getDate()).toBe(19);
  });
});
