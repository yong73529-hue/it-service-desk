type ChatMessage = { role: "system" | "user"; content: string };

export function isAiConfigured() {
  return Boolean(process.env.AI_API_KEY && process.env.AI_API_BASE_URL && process.env.AI_MODEL);
}

type AiAnswer = { answer: string; model: string; fallbackUsed: boolean };
const retryableStatus = new Set([408, 409, 425, 429, 500, 502, 503, 504]);

async function requestModel(model: string, messages: ChatMessage[]) {
  const base = String(process.env.AI_API_BASE_URL).replace(/\/$/, "");
  const response = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.AI_API_KEY}` },
    body: JSON.stringify({ model, messages, temperature: 0.2, max_tokens: 900, stream: false }),
    signal: AbortSignal.timeout(20000),
    cache: "no-store",
  });
  if (!response.ok) {
    const error = new Error(`AI_HTTP_${response.status}`) as Error & { retryable?: boolean };
    error.retryable = retryableStatus.has(response.status);
    throw error;
  }
  const data = await response.json() as { choices?: { message?: { content?: string } }[] };
  const answer = data.choices?.[0]?.message?.content?.trim();
  if (!answer) {
    const error = new Error("AI_EMPTY_RESPONSE") as Error & { retryable?: boolean };
    error.retryable = true;
    throw error;
  }
  return answer;
}

export async function createAiAnswer(messages: ChatMessage[]): Promise<AiAnswer> {
  if (!isAiConfigured()) throw new Error("AI_NOT_CONFIGURED");
  const primary = String(process.env.AI_MODEL);
  const fallback = String(process.env.AI_FALLBACK_MODEL || "").trim();
  try {
    return { answer: await requestModel(primary, messages), model: primary, fallbackUsed: false };
  } catch (error) {
    const retryable = error instanceof DOMException || error instanceof TypeError || (error instanceof Error && ((error as Error & { retryable?: boolean }).retryable || error.name === "TimeoutError"));
    if (!fallback || fallback === primary || !retryable) throw error;
    console.warn(`Primary AI model unavailable (${error instanceof Error ? error.message : "unknown"}); switching to fallback model.`);
    return { answer: await requestModel(fallback, messages), model: fallback, fallbackUsed: true };
  }
}
