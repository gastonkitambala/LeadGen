import { Business, WebsiteStatus } from "@/types";

/**
 * Builds a cold-outreach opener from what the audit actually found.
 *
 * Templates are tagged with the data they interpolate. OpenStreetMap has no review
 * counts and the audit has no PageSpeed number, so a template that mentions either is
 * only eligible when that field is genuinely present — otherwise the pitch goes out
 * saying "with 0 five-star reviews", which is worse than saying nothing.
 */

interface Template {
  text: string;
  /** Fields this template interpolates. Only drawn when all of them exist. */
  requires?: ("reviews" | "website" | "loadTime" | "issues")[];
}

const WEAKNESS_LINES: Record<WebsiteStatus, Template[]> = {
  NO_WEBSITE: [
    {
      text: "I noticed {name} doesn't have a website — which means when someone in {city} searches for a {industry}, they're finding your competitors instead of you.",
    },
    {
      text: "I went looking for {name} online and couldn't find a website anywhere. Every one of those searches is a customer who ended up somewhere else.",
    },
    {
      text: "You're on the map but not on the web — {name} has no website, so you're invisible to the people who search before they call.",
    },
    {
      text: "With {reviews} reviews, {name} clearly does good work. But without a website, most people searching for a {industry} in {city} will never find out.",
      requires: ["reviews"],
    },
  ],
  BROKEN: [
    {
      text: "I just tried to visit {name}'s website and it doesn't load. Anyone trying to find you online right now is hitting a dead end.",
    },
    {
      text: "Your site at {website} appears to be down. That's not a cosmetic problem — it's actively costing you customers who are trying to reach you.",
      requires: ["website"],
    },
    {
      text: "I found {name} while researching {industry} businesses in {city}, but your website is returning an error. Worth knowing about, if nobody's told you.",
    },
  ],
  OUTDATED: [
    {
      text: "I had a look at {name}'s website — {issues}. It's the kind of thing customers notice, even when they can't say why.",
      requires: ["issues"],
    },
    {
      text: "Your website has clearly been around a while, and it's showing. On a phone it's close to unusable, which is where most people searching for a {industry} start.",
    },
    {
      text: "I checked {name}'s site. It has character, but it's built on technology that browsers barely support anymore, and Google ranks it accordingly.",
    },
  ],
  POOR_MOBILE: [
    {
      text: "I pulled up {name}'s website on my phone and it's not built for mobile — no responsive layout at all. That's most of your traffic pinching and zooming to read your phone number.",
    },
    {
      text: "Your site doesn't adapt to phone screens. In {city}, most people looking for a {industry} are searching on mobile, and a site that fights them is a site they leave.",
    },
    {
      text: "I ran a check on {name}'s website — {issues}. Fixing the mobile experience alone usually moves the needle on call volume.",
      requires: ["issues"],
    },
  ],
  NEEDS_WORK: [
    {
      text: "I audited {name}'s website and found a few things holding it back: {issues}. All fixable, and all currently costing you search visibility.",
      requires: ["issues"],
    },
    {
      text: "Your site has good bones, but it takes {loadTime} to load. Visitors start leaving after about three seconds.",
      requires: ["loadTime"],
    },
    {
      text: "I had a look at {name}'s website — nothing dramatic, but there are some technical issues quietly costing you ranking against other {industry} businesses in {city}.",
    },
  ],
  DECENT: [
    {
      text: "I was researching {industry} businesses in {city} and came across {name}. Your site is genuinely solid — which is rare. I had a couple of ideas about turning more of those visitors into calls.",
    },
    {
      text: "Your website is better than most of what I see in this industry. That usually means the opportunity isn't the site itself, it's what happens after someone lands on it.",
    },
    {
      text: "I found {name} while looking at {industry} businesses around {city}. No complaints about the site — but there's a gap between visitors and enquiries that's worth a conversation.",
    },
  ],
};

const CLOSERS: Template[] = [
  {
    text: "I build websites for local {industry} businesses that actually generate calls. Would fifteen minutes this week be useful?",
  },
  {
    text: "I do fast, mobile-first sites for local service businesses. Happy to walk you through a free audit — no pitch, just what I found.",
  },
  {
    text: "I've done this for other businesses around {city} and it tends to pay for itself quickly. Can I send over a couple of examples?",
  },
  {
    text: "This is exactly the kind of thing I fix for local businesses. Worth a short call?",
  },
];

export function generatePitch(business: Business, random = Math.random): string {
  const available = availableFields(business);
  const status = business.websiteScore.status;

  const weakness = pick(
    eligible(WEAKNESS_LINES[status] ?? WEAKNESS_LINES.NEEDS_WORK, available),
    random
  );
  const closer = pick(eligible(CLOSERS, available), random);

  const body = `Hi, I'm [Your Name] — ${weakness}\n\n${closer}\n\n— [Your Name]\n[Your Phone/Email]`;
  return fill(body, business);
}

function availableFields(business: Business): Set<string> {
  const fields = new Set<string>();
  const score = business.websiteScore;

  if ((business.reviewCount ?? 0) > 0) fields.add("reviews");
  if (business.website) fields.add("website");
  if (score.loadMs !== undefined) fields.add("loadTime");
  if (score.issues && score.issues.length > 0) fields.add("issues");

  return fields;
}

/**
 * Keeps templates whose required fields all exist. Falls back to the unconditional
 * templates if filtering leaves nothing, so there is always something to send.
 */
function eligible(templates: Template[], available: Set<string>): Template[] {
  const usable = templates.filter((t) =>
    (t.requires ?? []).every((field) => available.has(field))
  );
  return usable.length > 0 ? usable : templates.filter((t) => !t.requires);
}

function pick(templates: Template[], random: () => number): string {
  if (templates.length === 0) return "";
  return templates[Math.floor(random() * templates.length)].text;
}

function fill(template: string, business: Business): string {
  const issues = business.websiteScore.issues ?? [];

  return template
    .replace(/{name}/g, business.name)
    .replace(/{city}/g, business.city)
    .replace(/{industry}/g, business.industry.toLowerCase())
    .replace(/{reviews}/g, String(business.reviewCount ?? 0))
    .replace(/{rating}/g, String(business.rating ?? ""))
    .replace(/{website}/g, business.website ?? "your website")
    .replace(/{loadTime}/g, formatLoad(business.websiteScore.loadMs))
    .replace(/{issues}/g, formatIssues(issues));
}

function formatIssues(issues: string[]): string {
  const top = issues.slice(0, 2);
  if (top.length === 0) return "a few technical issues";
  if (top.length === 1) return top[0];
  return `${top[0]} and ${top[1]}`;
}

function formatLoad(ms: number | undefined): string {
  if (ms === undefined) return "a while";
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)} seconds` : `${Math.round(ms)}ms`;
}
