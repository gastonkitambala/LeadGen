import { Business, WebsiteStatus } from "@/types";

const WEAKNESS_LINES: Record<WebsiteStatus, string[]> = {
  NO_WEBSITE: [
    "I noticed {name} doesn't have a website yet — in {city}, that means potential customers searching online are finding your competitors instead.",
    "I searched for {industry} services in {city} and couldn't find a website for {name}. You're losing leads every day to businesses with an online presence.",
    "With {reviews} 5-star reviews, {name} clearly does great work. But without a website, you're invisible to the 80% of customers who search Google before choosing a {industry}.",
  ],
  BROKEN: [
    "I just visited {name}'s website and got a 404 error — the domain may have expired. Anyone who tries to find you online right now hits a dead end.",
    "Your website at {website} appears to be down. This is actually costing you customers who are actively trying to reach you.",
    "I found {name} on Google Maps but your website is returning errors. With {reviews} reviews, you deserve a site that actually works.",
  ],
  OUTDATED: [
    "I visited {name}'s website and it looks like it hasn't been updated since around 2010 — it's not mobile-friendly, and 70% of your potential customers are on phones.",
    "Your website for {name} looks dated and isn't optimized for mobile devices. Customers searching on their phones are likely bouncing to a competitor.",
    "I checked {name}'s site — it has real character, but it's not showing up well in Google search and doesn't work great on mobile.",
  ],
  POOR_MOBILE: [
    "I ran a quick analysis on {name}'s website — it scores {mobileScore}/100 on mobile speed. Most of your visitors are on phones, and slow sites lose 53% of visitors.",
    "Your website scored {mobileScore}/100 on Google's mobile test. In a city like {city}, most people find local {industry} services on their phone.",
    "I checked {name}'s site performance — the mobile experience needs work. A faster, mobile-first redesign could directly increase your call volume.",
  ],
  NEEDS_WORK: [
    "I ran an audit on {name}'s website — there are a few technical issues (missing SSL, slow load times) that are hurting your Google ranking and costing you leads.",
    "Your site has good bones but is being held back by some technical issues I spotted. These are fixable and would make a real difference to your search visibility.",
    "I checked {name}'s website score — it's at {mobileScore}/100 on mobile. Small improvements could push you above competitors in {city} search results.",
  ],
  DECENT: [
    "I was researching {industry} businesses in {city} and came across {name}. Your site is solid — I have a few ideas to take it to the next level.",
    "I found {name} while researching local {industry} businesses. There are some conversion-rate improvements that could turn more visitors into actual customers.",
    "Your site is better than most in {city}, but I spotted a few things that could meaningfully improve your lead generation.",
  ],
};

const CLOSERS = [
  "I specialize in building modern websites for local {industry} businesses that generate real leads. Would a 15-minute call this week make sense?",
  "I build fast, mobile-first websites specifically for local service businesses like yours. Happy to do a free audit call — no pressure, just value.",
  "I've helped similar businesses in {city} significantly increase their inbound calls. Would love to show you what's possible in a quick call.",
  "I do web design for local businesses in {city} and this is exactly the kind of problem I solve. Can I send over a few examples?",
];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function generatePitch(business: Business): string {
  const status = business.websiteScore.status;
  const weaknessTemplates = WEAKNESS_LINES[status] || WEAKNESS_LINES.NEEDS_WORK;
  const weaknessLine = pick(weaknessTemplates);
  const closer = pick(CLOSERS);

  const template = `Hi, I'm [Your Name] — ${weaknessLine}\n\n${closer}\n\n— [Your Name]\n[Your Phone/Email]`;

  return template
    .replace(/{name}/g, business.name)
    .replace(/{city}/g, business.city)
    .replace(/{industry}/g, business.industry.toLowerCase())
    .replace(/{reviews}/g, String(business.reviewCount ?? 0))
    .replace(/{rating}/g, String(business.rating ?? ""))
    .replace(/{website}/g, business.website ?? "your website")
    .replace(/{mobileScore}/g, String(business.websiteScore.mobileScore ?? "low"));
}
