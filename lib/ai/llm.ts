import OpenAI from "openai";

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export async function generateCompanionReply(messages: ChatMessage[]) {
  const apiKey = process.env.LLM_API_KEY;
  if (!apiKey) return fallbackReply(messages);

  const client = new OpenAI({
    apiKey,
    baseURL: process.env.LLM_BASE_URL || "https://api.openai.com/v1"
  });

  const response = await client.chat.completions.create({
    model: process.env.LLM_MODEL || "gpt-4o-mini",
    messages,
    temperature: 0.8,
    max_tokens: 260
  });

  return response.choices[0]?.message.content?.trim() || fallbackReply(messages);
}

function fallbackReply(messages: ChatMessage[]) {
  const userMessage = [...messages].reverse().find((message) => message.role === "user")?.content ?? "";
  if (/learning|build|blockchain|code/i.test(userMessage)) {
    return "I like that direction. Tell me what part you are working on now, and I will keep track of it so we can build on it together.";
  }
  if (/sad|stressed|worried|lonely/i.test(userMessage)) {
    return "I am here with you. Want to tell me the part that feels heaviest right now?";
  }
  return "I will remember that. What should we do with this next?";
}
