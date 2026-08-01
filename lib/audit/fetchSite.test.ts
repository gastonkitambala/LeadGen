import { describe, expect, it } from "vitest";
import { isPrivateAddress, normalizeUrl } from "./fetchSite";

describe("isPrivateAddress", () => {
  it.each([
    ["127.0.0.1", "loopback"],
    ["10.1.2.3", "RFC 1918 class A"],
    ["172.16.0.1", "RFC 1918 class B, low end"],
    ["172.31.255.254", "RFC 1918 class B, high end"],
    ["192.168.1.1", "RFC 1918 class C"],
    ["169.254.169.254", "cloud metadata endpoint"],
    ["0.0.0.0", "this network"],
    ["100.64.0.1", "carrier-grade NAT"],
    ["198.18.0.1", "benchmarking range"],
    ["224.0.0.1", "multicast"],
    ["::1", "IPv6 loopback"],
    ["fd00::1", "IPv6 unique local"],
    ["fe80::1", "IPv6 link-local"],
    ["::ffff:127.0.0.1", "IPv4-mapped loopback"],
  ])("blocks %s (%s)", (address) => {
    expect(isPrivateAddress(address)).toBe(true);
  });

  it.each([
    ["8.8.8.8", "public DNS"],
    ["1.1.1.1", "public DNS"],
    ["172.32.0.1", "just outside RFC 1918"],
    ["192.169.0.1", "just outside RFC 1918"],
    ["2606:4700:4700::1111", "public IPv6"],
  ])("allows %s (%s)", (address) => {
    expect(isPrivateAddress(address)).toBe(false);
  });

  it("blocks anything it cannot parse, rather than assuming it is safe", () => {
    expect(isPrivateAddress("not-an-ip")).toBe(true);
    expect(isPrivateAddress("")).toBe(true);
  });
});

describe("normalizeUrl", () => {
  it("adds https to a bare domain, which OSM tags frequently are", () => {
    expect(normalizeUrl("tonysbarbers.com")).toBe("https://tonysbarbers.com");
  });

  it("leaves an explicit scheme alone", () => {
    expect(normalizeUrl("http://tonysbarbers.com")).toBe("http://tonysbarbers.com");
    expect(normalizeUrl("https://tonysbarbers.com")).toBe("https://tonysbarbers.com");
  });

  it("trims surrounding whitespace", () => {
    expect(normalizeUrl("  tonysbarbers.com  ")).toBe("https://tonysbarbers.com");
  });

  it("does not invent https for another scheme", () => {
    expect(normalizeUrl("ftp://files.example.com")).toBe("ftp://files.example.com");
  });
});
