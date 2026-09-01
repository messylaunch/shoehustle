import { describe, expect, it } from "vitest";
import {
  looksLikeStyleCode,
  researchLinks,
  searchQuery,
  shoeName,
} from "./research";

const jordan = {
  brand: "Jordan",
  model: "4 Retro",
  colorway: "Military Black",
  styleCode: "DH6927-111",
};

const noCode = {
  brand: "New Balance",
  model: "550",
  colorway: "White Green",
  styleCode: null,
};

describe("searchQuery", () => {
  it("uses the style code when there is one", () => {
    expect(searchQuery(jordan)).toBe("DH6927-111");
  });

  it("falls back to brand, model and colorway", () => {
    expect(searchQuery(noCode)).toBe("New Balance 550 White Green");
  });

  it("appends the size when asked", () => {
    expect(searchQuery(jordan, { size: "10.5" })).toBe("DH6927-111 size 10.5");
  });

  it("skips a missing colorway without leaving a double space", () => {
    expect(searchQuery({ brand: "Nike", model: "Dunk Low" })).toBe(
      "Nike Dunk Low",
    );
  });
});

describe("shoeName", () => {
  it("reads like a listing title", () => {
    expect(shoeName(jordan)).toBe("Jordan 4 Retro Military Black");
  });

  it("handles a missing colorway", () => {
    expect(shoeName({ brand: "Nike", model: "Dunk Low" })).toBe("Nike Dunk Low");
  });
});

describe("researchLinks", () => {
  it("puts eBay sold comps first, since that's the real number", () => {
    const links = researchLinks(jordan, { size: "10.5" });
    expect(links[0].kind).toBe("SOLD");
    expect(links[0].url).toContain("LH_Sold=1");
    expect(links[0].url).toContain("LH_Complete=1");
  });

  it("encodes the query so a colorway with spaces still works", () => {
    const links = researchLinks(noCode);
    const stockx = links.find((l) => l.source === "STOCKX");
    expect(stockx?.url).toBe(
      "https://stockx.com/search?s=New%20Balance%20550%20White%20Green",
    );
  });

  it("includes the size in eBay searches but not the broad ones", () => {
    const links = researchLinks(jordan, { size: "10.5" });
    const ebaySold = links.find((l) => l.label === "eBay — sold prices");
    const stockx = links.find((l) => l.source === "STOCKX");
    expect(ebaySold?.url).toContain("size%2010.5");
    expect(stockx?.url).not.toContain("size");
  });

  it("labels every link as sold, ask or mixed so nothing is mistaken for a comp", () => {
    for (const link of researchLinks(jordan)) {
      expect(["SOLD", "ASK", "MIXED"]).toContain(link.kind);
      expect(link.hint.length).toBeGreaterThan(0);
    }
  });
});

describe("looksLikeStyleCode", () => {
  it("accepts the usual shapes", () => {
    expect(looksLikeStyleCode("DH6927-111")).toBe(true);
    expect(looksLikeStyleCode("CT8532 104")).toBe(true);
    expect(looksLikeStyleCode("BQ6472061")).toBe(true);
  });

  it("rejects prose", () => {
    expect(looksLikeStyleCode("Jordan 4 Retro")).toBe(false);
    expect(looksLikeStyleCode("")).toBe(false);
  });
});
