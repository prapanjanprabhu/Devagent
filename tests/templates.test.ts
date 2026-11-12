import { describe, expect, it } from "vitest";
import { draftFromDescription } from "@/lib/templates";

describe("draftFromDescription", () => {
  it("picks the business type and reads typed prices and hours", () => {
    const d = draftFromDescription("3-chair unisex salon, open 10am-8pm, closed Sunday. Haircut 400, colouring from 2000.");
    expect(d.vertical).toBe("salon");
    expect(d.services.find((s) => s.name === "Haircut")?.price).toBe(400);
    expect(d.services.find((s) => /colouring/i.test(s.name))?.price).toBe(2000);
    expect(d.hours?.["1"]).toEqual(["10:00", "20:00"]);
    expect(d.hours?.["0"]).toBeNull();
  });

  it("never invents a price", () => {
    const d = draftFromDescription("A small dental clinic in town");
    expect(d.vertical).toBe("clinic");
    expect(d.services.every((s) => s.price === null)).toBe(true);
  });

  it("turns on classes for a gym and orders for a bakery", () => {
    expect(draftFromDescription("yoga studio with group classes").modules).toContain("classes");
    expect(draftFromDescription("home bakery").modules).toContain("commerce");
  });

  it("falls back to a general business", () => {
    expect(draftFromDescription("we do things").vertical).toBe("general");
  });
});
