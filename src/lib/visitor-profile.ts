export interface VisitorProfile {
  visitCount: number;
  firstVisit: string;
  lastVisit: string;
  viewedProducts: string[];
  viewedCategories: string[];
  purchasedProducts: string[];
  lastConversationStage: string;
  preferences: Record<string, string>;
}

const COOKIE_NAME = "rtg_visitor_profile";
const MAX_AGE_DAYS = 30;

function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function setCookie(name: string, value: string) {
  const maxAge = MAX_AGE_DAYS * 24 * 60 * 60;
  document.cookie = `${name}=${encodeURIComponent(value)};path=/;max-age=${maxAge};SameSite=Lax`;
}

function today(): string {
  return new Date().toISOString().split("T")[0];
}

function emptyProfile(): VisitorProfile {
  return {
    visitCount: 0,
    firstVisit: today(),
    lastVisit: today(),
    viewedProducts: [],
    viewedCategories: [],
    purchasedProducts: [],
    lastConversationStage: "",
    preferences: {},
  };
}

export function loadVisitorProfile(): VisitorProfile {
  const raw = getCookie(COOKIE_NAME);
  if (!raw) return emptyProfile();
  try {
    const parsed = JSON.parse(raw);
    return { ...emptyProfile(), ...parsed };
  } catch {
    return emptyProfile();
  }
}

export function saveVisitorProfile(profile: VisitorProfile) {
  // Trim arrays to keep cookie size manageable
  const trimmed = {
    ...profile,
    viewedProducts: profile.viewedProducts.slice(-20),
    viewedCategories: profile.viewedCategories.slice(-10),
    purchasedProducts: profile.purchasedProducts.slice(-20),
  };
  try {
    setCookie(COOKIE_NAME, JSON.stringify(trimmed));
  } catch {
    // Cookie too large — trim further
    trimmed.viewedProducts = trimmed.viewedProducts.slice(-5);
    setCookie(COOKIE_NAME, JSON.stringify(trimmed));
  }
}

// Call on every page load to update visit tracking
export function recordVisit(pageContext?: {
  productName?: string;
  category?: string;
  purchasedProducts?: string[];
}): VisitorProfile {
  const profile = loadVisitorProfile();
  const isNewDay = profile.lastVisit !== today();

  if (isNewDay || profile.visitCount === 0) {
    profile.visitCount++;
  }
  if (!profile.firstVisit) profile.firstVisit = today();
  profile.lastVisit = today();

  if (pageContext?.productName) {
    if (!profile.viewedProducts.includes(pageContext.productName)) {
      profile.viewedProducts.push(pageContext.productName);
    }
  }

  if (pageContext?.category) {
    if (!profile.viewedCategories.includes(pageContext.category)) {
      profile.viewedCategories.push(pageContext.category);
    }
  }

  if (pageContext?.purchasedProducts) {
    for (const p of pageContext.purchasedProducts) {
      if (!profile.purchasedProducts.includes(p)) {
        profile.purchasedProducts.push(p);
      }
    }
  }

  saveVisitorProfile(profile);
  return profile;
}

// Extract preferences from chat messages and save to profile
export function extractPreferencesFromChat(
  messages: { role: string; text: string }[]
): Record<string, string> {
  const prefs: Record<string, string> = {};

  for (const msg of messages) {
    if (msg.role !== "user") continue;
    const text = msg.text.toLowerCase();

    // Sleep position
    if (text.includes("side sleeper") || text.includes("sleep on my side"))
      prefs.sleepPosition = "side";
    if (text.includes("back sleeper") || text.includes("sleep on my back"))
      prefs.sleepPosition = "back";
    if (text.includes("stomach sleeper") || text.includes("sleep on my stomach"))
      prefs.sleepPosition = "stomach";
    if (text.includes("combination") || text.includes("move around"))
      prefs.sleepPosition = "combination";

    // Temperature
    if (text.includes("sleep hot") || text.includes("too hot") || text.includes("sweaty"))
      prefs.temperature = "hot";
    if (text.includes("sleep cold")) prefs.temperature = "cold";

    // Budget
    const budgetMatch = text.match(
      /under \$[\d,]+|\$[\d,]+-\$[\d,]+|\$[\d,]+\+/i
    );
    if (budgetMatch) prefs.budget = budgetMatch[0];

    // Size
    for (const size of ["twin xl", "twin", "full", "queen", "king", "cal king"]) {
      if (text.includes(size)) prefs.size = size;
    }

    // Pain
    if (text.includes("back pain") || text.includes("back kills"))
      prefs.painPoint = "back";
    if (text.includes("hip pain") || text.includes("hip hurts"))
      prefs.painPoint = "hip";
    if (text.includes("shoulder")) prefs.painPoint = "shoulder";

    // Firmness
    if (text.includes("firm")) prefs.firmness = "firm";
    if (text.includes("soft") || text.includes("plush")) prefs.firmness = "soft";
    if (text.includes("medium")) prefs.firmness = "medium";
  }

  return prefs;
}

// Update profile with preferences from the current conversation
export function updateProfileFromChat(
  messages: { role: string; text: string }[],
  stage: string
) {
  const profile = loadVisitorProfile();
  const prefs = extractPreferencesFromChat(messages);
  profile.preferences = { ...profile.preferences, ...prefs };
  profile.lastConversationStage = stage;
  saveVisitorProfile(profile);
}
