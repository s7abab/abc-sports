interface OpenRouterMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface OpenRouterOptions {
  messages: OpenRouterMessage[];
  maxTokens?: number;
  temperature?: number;
  model?: string;
}

export function isAiEnabled() {
  return Boolean(process.env.OPENROUTER_API_KEY);
}

export async function createOpenRouterChatCompletion({
  messages,
  maxTokens = 180,
  temperature = 0.1,
  model = process.env.OPENROUTER_MODEL || "google/gemini-2.5-flash",
}: OpenRouterOptions) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY is not configured.");
  }

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
      "X-Title": "ABC Sports",
    },
    body: JSON.stringify({
      model,
      messages,
      temperature,
      max_tokens: maxTokens,
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenRouter request failed with ${response.status}.`);
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };

  return data.choices?.[0]?.message?.content?.trim() || "";
}

export function parseJsonObject<T>(value: string, fallback: T): T {
  try {
    const jsonMatch = value.match(/\{[\s\S]*\}/);
    return JSON.parse(jsonMatch?.[0] ?? value) as T;
  } catch {
    return fallback;
  }
}
