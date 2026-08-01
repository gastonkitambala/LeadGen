import { describe, expect, it } from "vitest";
import { parseOpeningHours, isOpenNow } from "./openingHours";

/** Day indices follow JavaScript's convention: 0 is Sunday. */
function at(day: number, hour: number, minute = 0): Date {
  // 2026-08-02 is a Sunday, so adding `day` lands on the day we want.
  return new Date(2026, 7, 2 + day, hour, minute);
}

describe("parseOpeningHours", () => {
  it("parses a weekday range", () => {
    const hours = parseOpeningHours("Mo-Fr 09:00-17:00");

    expect(hours?.weekday_text).toEqual([
      "Monday: 9:00 AM – 5:00 PM",
      "Tuesday: 9:00 AM – 5:00 PM",
      "Wednesday: 9:00 AM – 5:00 PM",
      "Thursday: 9:00 AM – 5:00 PM",
      "Friday: 9:00 AM – 5:00 PM",
      "Saturday: Closed",
      "Sunday: Closed",
    ]);
  });

  it("parses multiple rules with an explicit closure", () => {
    const hours = parseOpeningHours("Mo-Fr 08:00-18:00; Sa 09:00-13:00; Su off");

    expect(hours?.weekday_text?.[5]).toBe("Saturday: 9:00 AM – 1:00 PM");
    expect(hours?.weekday_text?.[6]).toBe("Sunday: Closed");
  });

  it("parses a split day", () => {
    const hours = parseOpeningHours("Mo 09:00-12:00,13:00-17:00");

    expect(hours?.weekday_text?.[0]).toBe(
      "Monday: 9:00 AM – 12:00 PM, 1:00 PM – 5:00 PM"
    );
  });

  it("parses a comma-separated day list", () => {
    const hours = parseOpeningHours("Mo,We,Fr 10:00-14:00");

    expect(hours?.weekday_text?.[0]).toContain("10:00 AM");
    expect(hours?.weekday_text?.[1]).toBe("Tuesday: Closed");
    expect(hours?.weekday_text?.[2]).toContain("10:00 AM");
  });

  it("parses 24/7", () => {
    const hours = parseOpeningHours("24/7");

    expect(hours?.weekday_text?.every((line) => line.includes("Open 24 hours")))
      .toBe(true);
  });

  it("handles a day range that wraps past Sunday", () => {
    const hours = parseOpeningHours("Sa-Mo 10:00-16:00");

    expect(hours?.weekday_text?.[0]).toContain("10:00 AM"); // Monday
    expect(hours?.weekday_text?.[5]).toContain("10:00 AM"); // Saturday
    expect(hours?.weekday_text?.[6]).toContain("10:00 AM"); // Sunday
    expect(hours?.weekday_text?.[1]).toBe("Tuesday: Closed");
  });

  it("treats a rule with no days as applying every day", () => {
    const hours = parseOpeningHours("09:00-17:00");

    expect(hours?.weekday_text?.every((line) => line.includes("9:00 AM"))).toBe(true);
  });

  it("carries an overnight range into the following day", () => {
    const hours = parseOpeningHours("Fr 18:00-02:00");
    const period = hours?.periods?.[0];

    expect(period?.open).toEqual({ day: 5, time: "1800" });
    expect(period?.close).toEqual({ day: 6, time: "0200" });
  });

  it("lets a later rule override an earlier one for the same day", () => {
    const hours = parseOpeningHours("Mo-Su 09:00-17:00; Su 12:00-16:00");

    expect(hours?.weekday_text?.[6]).toBe("Sunday: 12:00 PM – 4:00 PM");
  });

  it.each([
    ["Mo-Fr 09:00-17:00; PH off", "public holidays"],
    ['Mo-Fr 09:00-17:00 "by appointment"', "comments"],
    ["Jan-Mar 09:00-17:00", "date ranges"],
    ["Mo sunrise-sunset", "sun-relative times"],
    ["Xx-Yy 09:00-17:00", "unknown day names"],
    ["nonsense", "free text"],
  ])("returns null for %s (%s)", (spec) => {
    expect(parseOpeningHours(spec)).toBeNull();
  });

  it("returns null for an empty string", () => {
    expect(parseOpeningHours("   ")).toBeNull();
  });
});

describe("isOpenNow", () => {
  const nineToFive = parseOpeningHours("Mo-Fr 09:00-17:00")!;

  it("is open in the middle of a shift", () => {
    expect(isOpenNow(nineToFive, at(3, 12))).toBe(true);
  });

  it("is closed before opening", () => {
    expect(isOpenNow(nineToFive, at(3, 8, 59))).toBe(false);
  });

  it("is open on the opening minute", () => {
    expect(isOpenNow(nineToFive, at(3, 9, 0))).toBe(true);
  });

  it("is closed on the closing minute", () => {
    expect(isOpenNow(nineToFive, at(3, 17, 0))).toBe(false);
  });

  it("is closed on a day with no hours", () => {
    expect(isOpenNow(nineToFive, at(0, 12))).toBe(false);
  });

  it("stays open past midnight on an overnight shift", () => {
    const lateBar = parseOpeningHours("Fr 18:00-02:00")!;

    expect(isOpenNow(lateBar, at(5, 23))).toBe(true);
    expect(isOpenNow(lateBar, at(6, 1))).toBe(true);
    expect(isOpenNow(lateBar, at(6, 3))).toBe(false);
  });

  it("is always open for 24/7", () => {
    const always = parseOpeningHours("24/7")!;

    expect(isOpenNow(always, at(0, 3))).toBe(true);
    expect(isOpenNow(always, at(4, 23, 59))).toBe(true);
  });

  it("returns undefined when there are no hours to judge", () => {
    expect(isOpenNow(undefined)).toBeUndefined();
    expect(isOpenNow({ periods: [] })).toBeUndefined();
  });
});
