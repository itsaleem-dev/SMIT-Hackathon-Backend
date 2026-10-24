// Anthropic Messages API ko seedha fetch se call karta hai (koi extra package nahi chahiye).
// .env mein ANTHROPIC_API_KEY zaroori hai. ANTHROPIC_MODEL optional hai.

const API_URL = "https://api.anthropic.com/v1/messages";
const DEFAULT_MODEL = "claude-sonnet-5-5";

export class AiError extends Error {
  constructor(message, status = 502) {
    super(message);
    this.status = status;
  }
}

export const isConfigured = () => Boolean(process.env.ANTHROPIC_API_KEY);

export const askClaude = async ({ system, messages, maxTokens = 800 }) => {
  if (!isConfigured()) {
    throw new AiError(
      "AI is not configured. Add ANTHROPIC_API_KEY to the backend .env file and restart the server.",
      503,
    );
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30000);

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "content-type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL || DEFAULT_MODEL,
        max_tokens: maxTokens,
        system,
        messages,
      }),
    });

    if (!response.ok) {
      let detail = "";
      try {
        detail = (await response.json())?.error?.message || "";
      } catch {
        // ignore
      }
      console.error("Anthropic API error:", response.status, detail);

      if (response.status === 401) {
        throw new AiError("AI key is invalid. Check ANTHROPIC_API_KEY in .env.", 502);
      }
      if (response.status === 429) {
        throw new AiError("AI is busy right now. Please try again in a moment.", 429);
      }
      if (response.status === 400 || response.status === 404) {
        throw new AiError(
          `AI request was rejected (${detail || response.status}). Check ANTHROPIC_MODEL in .env.`,
          502,
        );
      }
      throw new AiError("AI service is unavailable. Please try again later.", 502);
    }

    const data = await response.json();
    return (data.content || [])
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();
  } catch (error) {
    if (error instanceof AiError) throw error;
    if (error.name === "AbortError") {
      throw new AiError("AI took too long to respond. Please try again.", 504);
    }
    console.error("Anthropic fetch failed:", error.message);
    throw new AiError("Could not reach the AI service. Check your internet connection.", 502);
  } finally {
    clearTimeout(timer);
  }
};