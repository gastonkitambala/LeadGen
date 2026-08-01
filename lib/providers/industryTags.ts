/**
 * Maps a human industry name to OpenStreetMap tag filters.
 *
 * OSM has no single "category" field — a barbershop is `shop=hairdresser`, a plumber
 * is `craft=plumber`, a dentist is `amenity=dentist`. This table encodes that mapping
 * for the industries the UI offers, plus common aliases people actually type.
 *
 * Anything unrecognized falls back to a name search, so the input box stays free-text.
 */

/** Tags within one filter are AND-ed. Separate filters are OR-ed. */
export type TagFilter = Record<string, string>;

export interface ResolvedIndustry {
  /** Canonical display label, echoed back on every Business. */
  label: string;
  /** OSM tag filters to query. Empty when we only have a name match. */
  filters: TagFilter[];
  /** Case-insensitive regex applied to the `name` tag, for free-text input. */
  nameRegex?: string;
}

interface IndustryDefinition {
  label: string;
  filters: TagFilter[];
  aliases?: string[];
}

const INDUSTRIES: IndustryDefinition[] = [
  {
    label: "Barbershop",
    filters: [{ shop: "hairdresser" }, { craft: "barber" }],
    aliases: ["barber", "barbers", "barber shop"],
  },
  {
    label: "Hair Salon",
    filters: [{ shop: "hairdresser" }, { shop: "beauty" }],
    aliases: ["hairdresser", "salon", "hair"],
  },
  {
    label: "Nail Salon",
    filters: [{ shop: "beauty", beauty: "nails" }, { shop: "nail_salon" }],
    aliases: ["nails", "manicure"],
  },
  {
    label: "Bakery",
    filters: [{ shop: "bakery" }, { shop: "pastry" }],
    aliases: ["baker", "patisserie"],
  },
  {
    label: "Restaurant",
    filters: [{ amenity: "restaurant" }],
    aliases: ["restaurants", "diner", "eatery", "food"],
  },
  {
    label: "Pizza",
    filters: [
      { amenity: "restaurant", cuisine: "pizza" },
      { amenity: "fast_food", cuisine: "pizza" },
    ],
    aliases: ["pizzeria", "pizza shop"],
  },
  {
    label: "Cafe",
    filters: [{ amenity: "cafe" }, { shop: "coffee" }],
    aliases: ["coffee", "coffee shop", "coffeeshop", "café"],
  },
  {
    label: "Bar",
    filters: [{ amenity: "bar" }, { amenity: "pub" }],
    aliases: ["pub", "tavern", "brewery"],
  },
  {
    label: "Plumber",
    filters: [{ craft: "plumber" }, { shop: "plumbing" }],
    aliases: ["plumbing", "plumbers"],
  },
  {
    label: "Electrician",
    filters: [{ craft: "electrician" }, { shop: "electrical" }],
    aliases: ["electrical", "electricians"],
  },
  {
    label: "HVAC",
    filters: [
      { craft: "hvac" },
      { craft: "heating_engineer" },
      { shop: "hvac" },
    ],
    aliases: ["heating", "air conditioning", "ac repair"],
  },
  {
    label: "Roofing",
    filters: [{ craft: "roofer" }],
    aliases: ["roofer", "roofers", "roof repair"],
  },
  {
    label: "Painting",
    filters: [{ craft: "painter" }],
    aliases: ["painter", "painters", "house painting"],
  },
  {
    label: "Landscaping",
    filters: [
      { craft: "gardener" },
      { shop: "garden_centre" },
      { landuse: "plant_nursery" },
    ],
    aliases: ["gardener", "lawn care", "landscaper"],
  },
  {
    label: "Cleaning Service",
    filters: [
      { craft: "cleaning" },
      { shop: "laundry" },
      { office: "cleaning" },
    ],
    aliases: ["cleaner", "cleaners", "maid service", "janitorial"],
  },
  {
    label: "Dry Cleaner",
    filters: [{ shop: "dry_cleaning" }, { shop: "laundry" }],
    aliases: ["dry cleaning", "laundromat", "launderette"],
  },
  {
    label: "Locksmith",
    filters: [{ craft: "locksmith" }, { shop: "locksmith" }],
    aliases: ["locks", "key cutting"],
  },
  {
    label: "Auto Repair",
    filters: [{ shop: "car_repair" }, { shop: "tyres" }],
    aliases: ["mechanic", "car repair", "auto shop", "garage", "body shop"],
  },
  {
    label: "Car Dealer",
    filters: [{ shop: "car" }],
    aliases: ["car dealership", "auto dealer"],
  },
  {
    label: "Gym",
    filters: [{ leisure: "fitness_centre" }, { leisure: "sports_centre" }],
    aliases: ["fitness", "fitness center", "crossfit", "yoga"],
  },
  {
    label: "Dentist",
    filters: [{ amenity: "dentist" }, { healthcare: "dentist" }],
    aliases: ["dental", "dentistry", "orthodontist"],
  },
  {
    label: "Veterinarian",
    filters: [{ amenity: "veterinary" }, { healthcare: "veterinary" }],
    aliases: ["vet", "vets", "animal hospital", "veterinary"],
  },
  {
    label: "Chiropractor",
    filters: [{ healthcare: "chiropractor" }],
    aliases: ["chiropractic"],
  },
  {
    label: "Physical Therapy",
    filters: [{ healthcare: "physiotherapist" }],
    aliases: ["physiotherapy", "physio", "physical therapist"],
  },
  {
    label: "Optometrist",
    filters: [{ shop: "optician" }, { healthcare: "optometrist" }],
    aliases: ["optician", "eye doctor", "optical"],
  },
  {
    label: "Pharmacy",
    filters: [{ amenity: "pharmacy" }, { healthcare: "pharmacy" }],
    aliases: ["chemist", "drugstore"],
  },
  {
    label: "Doctor",
    filters: [{ amenity: "doctors" }, { healthcare: "doctor" }],
    aliases: ["clinic", "physician", "medical practice", "gp"],
  },
  {
    label: "Daycare",
    filters: [{ amenity: "childcare" }, { amenity: "kindergarten" }],
    aliases: ["childcare", "nursery", "preschool", "kindergarten"],
  },
  {
    label: "Law Firm",
    filters: [{ office: "lawyer" }],
    aliases: ["lawyer", "attorney", "solicitor", "legal"],
  },
  {
    label: "Accounting",
    filters: [{ office: "accountant" }, { office: "tax_advisor" }],
    aliases: ["accountant", "cpa", "bookkeeping", "tax"],
  },
  {
    label: "Real Estate",
    filters: [{ office: "estate_agent" }],
    aliases: ["realtor", "estate agent", "real estate agent"],
  },
  {
    label: "Insurance",
    filters: [{ office: "insurance" }],
    aliases: ["insurance agent", "insurance broker"],
  },
  {
    label: "Florist",
    filters: [{ shop: "florist" }],
    aliases: ["flowers", "flower shop"],
  },
  {
    label: "Jewelry Store",
    filters: [{ shop: "jewelry" }, { craft: "jeweller" }],
    aliases: ["jeweler", "jeweller", "jewellery"],
  },
  {
    label: "Furniture Store",
    filters: [{ shop: "furniture" }, { shop: "interior_decoration" }],
    aliases: ["furniture", "home furnishing"],
  },
  {
    label: "Hotel",
    filters: [{ tourism: "hotel" }, { tourism: "motel" }, { tourism: "guest_house" }],
    aliases: ["motel", "inn", "bed and breakfast", "b&b"],
  },
  {
    label: "Photographer",
    filters: [{ craft: "photographer" }, { shop: "photo" }],
    aliases: ["photography", "photo studio"],
  },
  {
    label: "Tattoo Studio",
    filters: [{ shop: "tattoo" }],
    aliases: ["tattoo", "tattoo parlor", "piercing"],
  },
  {
    label: "Pet Store",
    filters: [{ shop: "pet" }, { shop: "pet_grooming" }],
    aliases: ["pet shop", "pet grooming", "groomer"],
  },
  {
    label: "Butcher",
    filters: [{ shop: "butcher" }],
    aliases: ["meat", "meat shop"],
  },
  {
    label: "Grocery Store",
    filters: [{ shop: "supermarket" }, { shop: "convenience" }, { shop: "greengrocer" }],
    aliases: ["grocery", "supermarket", "convenience store", "bodega"],
  },
  {
    label: "Hardware Store",
    filters: [{ shop: "hardware" }, { shop: "doityourself" }],
    aliases: ["hardware", "diy", "home improvement"],
  },
  {
    label: "Carpenter",
    filters: [{ craft: "carpenter" }, { craft: "joiner" }],
    aliases: ["carpentry", "joiner", "cabinet maker"],
  },
  {
    label: "Bicycle Shop",
    filters: [{ shop: "bicycle" }],
    aliases: ["bike shop", "bike repair", "cycle shop"],
  },
];

/** Options offered by the search box dropdown. */
export const INDUSTRY_OPTIONS: string[] = INDUSTRIES.map((i) => i.label).sort(
  (a, b) => a.localeCompare(b)
);

const LOOKUP: Map<string, IndustryDefinition> = (() => {
  const map = new Map<string, IndustryDefinition>();
  for (const industry of INDUSTRIES) {
    map.set(normalize(industry.label), industry);
    for (const alias of industry.aliases ?? []) {
      // A label always wins over another entry's alias.
      if (!map.has(normalize(alias))) map.set(normalize(alias), industry);
    }
  }
  return map;
})();

function normalize(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Escapes a user string for safe embedding in an Overpass regex literal. */
export function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\"]/g, "\\$&");
}

/**
 * Resolves free-text industry input to tag filters.
 *
 * Known industries and their aliases get tag filters, which are precise. Unknown input
 * degrades to a name regex across shops, crafts, offices and amenities — less precise,
 * but it means typing "escape room" still returns something.
 */
export function resolveIndustry(input: string): ResolvedIndustry {
  const key = normalize(input);
  const known = LOOKUP.get(key);

  if (known) {
    return { label: known.label, filters: known.filters };
  }

  // Try a singular form before giving up: "bakeries" -> "bakery", "gyms" -> "gym".
  for (const candidate of singularize(key)) {
    const match = LOOKUP.get(candidate);
    if (match) return { label: match.label, filters: match.filters };
  }

  return {
    label: titleCase(input.trim()),
    filters: [],
    nameRegex: escapeRegex(input.trim()),
  };
}

function singularize(value: string): string[] {
  const forms: string[] = [];
  if (value.endsWith("ies")) forms.push(value.slice(0, -3) + "y");
  if (value.endsWith("es")) forms.push(value.slice(0, -2));
  if (value.endsWith("s")) forms.push(value.slice(0, -1));
  return forms;
}

function titleCase(value: string): string {
  return value.replace(
    /\w\S*/g,
    (word) => word[0].toUpperCase() + word.slice(1).toLowerCase()
  );
}
