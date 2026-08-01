import { describe, expect, it } from "vitest";
import {
  scoreAudit,
  noWebsiteScore,
  socialOnlyScore,
  detectSocialPlatform,
} from "./score";
import { AuditSignals, HtmlSignals } from "./types";

const NOW = new Date("2026-08-01T12:00:00Z");

function html(overrides: Partial<HtmlSignals> = {}): HtmlSignals {
  return {
    hasViewport: true,
    viewportResponsive: true,
    hasTitle: true,
    hasMetaDescription: true,
    legacyMarkers: [],
    ...overrides,
  };
}

function signals(overrides: Partial<AuditSignals> = {}): AuditSignals {
  return {
    url: "https://example.com",
    reachable: true,
    statusCode: 200,
    finalUrl: "https://example.com/",
    isHttps: true,
    responseMs: 600,
    htmlBytes: 40_000,
    html: html(),
    ...overrides,
  };
}

describe("scoreAudit", () => {
  it("scores a fast, modern, secure site as DECENT", () => {
    const result = scoreAudit(signals(), NOW);

    expect(result.status).toBe("DECENT");
    expect(result.score).toBe(100);
    expect(result.issues).toEqual([]);
  });

  it("scores an unreachable site as BROKEN regardless of anything else", () => {
    const result = scoreAudit(
      signals({ reachable: false, statusCode: 503, html: undefined }),
      NOW
    );

    expect(result.status).toBe("BROKEN");
    expect(result.score).toBe(5);
    expect(result.reason).toContain("503");
  });

  it("names DNS failure as an expired domain", () => {
    const result = scoreAudit(
      signals({ reachable: false, statusCode: undefined, error: "dns", html: undefined }),
      NOW
    );

    expect(result.reason).toContain("expired");
  });

  it("classifies a site with no viewport tag as POOR_MOBILE", () => {
    const result = scoreAudit(
      signals({ html: html({ hasViewport: false, viewportResponsive: false }) }),
      NOW
    );

    expect(result.status).toBe("POOR_MOBILE");
    expect(result.issues).toContain("no mobile viewport tag");
  });

  it("classifies a fixed-width viewport as POOR_MOBILE too", () => {
    const result = scoreAudit(
      signals({ html: html({ viewportResponsive: false }) }),
      NOW
    );

    expect(result.status).toBe("POOR_MOBILE");
  });

  it("treats any hard legacy marker as OUTDATED", () => {
    const result = scoreAudit(
      signals({ html: html({ legacyMarkers: ["flash"] }) }),
      NOW
    );

    expect(result.status).toBe("OUTDATED");
    expect(result.reason).toContain("Flash content");
  });

  it("does not call a site outdated for jQuery 1.x alone", () => {
    const result = scoreAudit(
      signals({ html: html({ legacyMarkers: ["jquery-1.x"] }) }),
      NOW
    );

    expect(result.status).not.toBe("OUTDATED");
  });

  it("treats jQuery 1.x plus a second marker as OUTDATED", () => {
    const result = scoreAudit(
      signals({ html: html({ legacyMarkers: ["jquery-1.x", "font-tag"] }) }),
      NOW
    );

    expect(result.status).toBe("OUTDATED");
  });

  it("treats a six-year-old copyright as OUTDATED", () => {
    const result = scoreAudit(
      signals({ html: html({ copyrightYear: 2020 }) }),
      NOW
    );

    expect(result.status).toBe("OUTDATED");
    expect(result.issues).toContain("copyright still says 2020");
  });

  it("penalises a three-year-old copyright without calling it outdated", () => {
    const result = scoreAudit(
      signals({ html: html({ copyrightYear: 2023 }) }),
      NOW
    );

    expect(result.status).not.toBe("OUTDATED");
    expect(result.score).toBeLessThan(100);
  });

  it("penalises missing HTTPS", () => {
    const withoutSsl = scoreAudit(signals({ isHttps: false }), NOW);

    expect(withoutSsl.score).toBe(75);
    expect(withoutSsl.status).toBe("NEEDS_WORK");
    expect(withoutSsl.issues).toContain("no HTTPS");
  });

  it("penalises load time in bands", () => {
    const fast = scoreAudit(signals({ responseMs: 900 }), NOW).score;
    const okay = scoreAudit(signals({ responseMs: 2000 }), NOW).score;
    const slow = scoreAudit(signals({ responseMs: 4000 }), NOW).score;
    const awful = scoreAudit(signals({ responseMs: 9000 }), NOW).score;

    expect(fast).toBeGreaterThan(okay);
    expect(okay).toBeGreaterThan(slow);
    expect(slow).toBeGreaterThan(awful);
  });

  it("reports load time in seconds once past a second", () => {
    const result = scoreAudit(signals({ responseMs: 4200 }), NOW);
    expect(result.issues).toContain("4.2s load time");
  });

  it("never returns a score outside 0-100", () => {
    const worst = scoreAudit(
      signals({
        isHttps: false,
        responseMs: 20_000,
        htmlBytes: 4_000_000,
        html: html({
          hasViewport: false,
          viewportResponsive: false,
          hasTitle: false,
          hasMetaDescription: false,
          copyrightYear: 2005,
          legacyMarkers: ["flash", "frameset", "font-tag", "table-layout"],
        }),
      }),
      NOW
    );

    expect(worst.score).toBeGreaterThanOrEqual(0);
    expect(worst.score).toBeLessThanOrEqual(100);
    expect(worst.status).toBe("OUTDATED");
  });

  it("handles a response with no readable HTML", () => {
    const result = scoreAudit(signals({ html: undefined }), NOW);

    expect(result.status).toBe("NEEDS_WORK");
    expect(result.reason).toContain("no readable HTML");
  });

  it("records the audit date", () => {
    expect(scoreAudit(signals(), NOW).lastChecked).toBe("2026-08-01");
  });
});

describe("noWebsiteScore", () => {
  it("is the worst possible lead score", () => {
    expect(noWebsiteScore().score).toBe(0);
    expect(noWebsiteScore().status).toBe("NO_WEBSITE");
  });
});

describe("detectSocialPlatform", () => {
  it.each([
    ["https://www.facebook.com/tonysbarbers", "Facebook page"],
    ["https://instagram.com/tonysbarbers", "Instagram profile"],
    ["linktr.ee/tonys", "Linktree"],
  ])("recognises %s", (url, expected) => {
    expect(detectSocialPlatform(url)).toBe(expected);
  });

  it("leaves a real website alone", () => {
    expect(detectSocialPlatform("https://tonysbarbers.com")).toBeUndefined();
  });

  it("does not treat a lookalike domain as social", () => {
    expect(detectSocialPlatform("https://facebook.com.evil.example")).toBeUndefined();
  });

  it("returns undefined for unparseable input", () => {
    expect(detectSocialPlatform("not a url at all !!")).toBeUndefined();
  });
});

describe("socialOnlyScore", () => {
  it("ranks a social-only presence just above having nothing", () => {
    const result = socialOnlyScore("Facebook page");

    expect(result.status).toBe("NO_WEBSITE");
    expect(result.score).toBe(2);
    expect(result.reason).toContain("Facebook page");
  });
});
