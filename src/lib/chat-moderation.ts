export interface ChatModerationResult {
  allowed: boolean;
  reason: string;
  category: "ok" | "spam" | "abuse" | "link";
}

const BLOCKED_WORDS = [
  "fuck",
  "shit",
  "bitch",
  "asshole",
  "kill yourself",
  "nigger",
  "chink",
  "paki",
  "മൈര്",
  "മയിര്",
  "പുണ്ട",
  "പൂണ്ട",
  "തായോളി",
  "തായോലി",
  "കുണ്ണ",
  "കൂണ്ണ",
  "പൂറ്",
  "പൂർ",
  "പട്ടി",
  "നായിന്റെ മോൻ",
  "നായിന്റെമോൻ",
  "പൊലയാടി",
  "പൊലയാടിമോൻ",
  "വേശ്യ",
  "കഴുവേറി",
  "കഴുവേറിയ",
  "myre",
  "myr",
  "mayir",
  "maire",
  "punda",
  "poonda",
  "thayoli",
  "tayoli",
  "kunna",
  "koonna",
  "poor",
  "patti",
  "nayinte mon",
  "nayintemon",
  "polayadi",
  "polayadi mon",
  "veshya",
  "kazhuveri",
];

function heuristicModerate(body: string): ChatModerationResult {
  const normalized = body
    .toLowerCase()
    .normalize("NFKC")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  const compact = normalized.replace(/\s+/g, "");
  const hasLink = /https?:\/\/|www\.|t\.me\/|wa\.me\/|bit\.ly|discord\.gg/i.test(normalized);
  const repeatedChars = /(.)\1{8,}/.test(normalized);
  const blockedWord = BLOCKED_WORDS.find((word) => {
    const normalizedWord = word.toLowerCase().normalize("NFKC");
    return normalized.includes(normalizedWord) || compact.includes(normalizedWord.replace(/\s+/g, ""));
  });

  if (hasLink) {
    return { allowed: false, reason: "Links are blocked in live chat.", category: "link" };
  }

  if (blockedWord) {
    return { allowed: false, reason: "Abusive language is blocked.", category: "abuse" };
  }

  if (repeatedChars) {
    return { allowed: false, reason: "Repeated spam is blocked.", category: "spam" };
  }

  return { allowed: true, reason: "Passed local moderation.", category: "ok" };
}

export async function moderateChatMessage(input: {
  body: string;
  kind: "message" | "reaction";
}): Promise<ChatModerationResult> {
  if (input.kind === "reaction") {
    return { allowed: true, reason: "Reactions are allowlisted.", category: "ok" };
  }

  return heuristicModerate(input.body);
}
