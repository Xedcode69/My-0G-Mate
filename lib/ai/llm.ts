import OpenAI from "openai";

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type GenerateReplyOptions = {
  maxTokens?: number;
  temperature?: number;
};

type AiProvider = "openai" | "0g";

type ProviderConfig = {
  provider: AiProvider;
  apiKey?: string;
  baseURL: string;
  model: string;
  trustMode?: "private";
  verifyTee?: boolean;
};

const ZERO_G_ROUTER_URL = "https://router-api.0g.ai/v1";
const ZERO_G_DEFAULT_MODEL = "0gm-1.0-35b-a3b";

export function isLlmConfigured() {
  return Boolean(providerConfig(activeProvider()).apiKey);
}

export async function generateCompanionReply(messages: ChatMessage[], options: GenerateReplyOptions = {}) {
  const provider = activeProvider();
  const config = providerConfig(provider);
  if (!config.apiKey) return fallbackReply(messages);

  try {
    return await generateReply(config, messages, options);
  } catch (error) {
    if (error instanceof TeeVerificationError) {
      console.error(error.message);
      return fallbackReply(messages);
    }

    const fallbackProvider = fallbackAiProvider(provider);
    const fallbackConfig = fallbackProvider ? providerConfig(fallbackProvider) : null;

    if (fallbackConfig?.apiKey) {
      try {
        return await generateReply(fallbackConfig, messages, options);
      } catch {
        // Return the local reply below when both configured providers are unavailable.
      }
    }

    console.error(`AI reply generation failed with ${provider}`, error);
    return fallbackReply(messages);
  }
}

async function generateReply(config: ProviderConfig, messages: ChatMessage[], options: GenerateReplyOptions) {
  const client = new OpenAI({
    apiKey: config.apiKey,
    baseURL: config.baseURL,
    defaultHeaders: config.trustMode ? { "X-0G-Provider-Trust-Mode": config.trustMode } : undefined
  });

  const request = {
    model: config.model,
    messages,
    temperature: options.temperature ?? 0.8,
    max_tokens: options.maxTokens ?? 260,
    ...(config.verifyTee ? { verify_tee: true } : {})
  };
  const response = await client.chat.completions.create(request);

  if (config.verifyTee && !teeWasVerified(response)) {
    throw new TeeVerificationError("0G did not return a verified TEE trace for this response");
  }

  return response.choices[0]?.message.content?.trim() || fallbackReply(messages);
}

function activeProvider(): AiProvider {
  return process.env.AI_PROVIDER?.trim().toLowerCase() === "0g" ? "0g" : "openai";
}

function fallbackAiProvider(active: AiProvider): AiProvider | null {
  const configured = process.env.AI_FALLBACK_PROVIDER?.trim().toLowerCase();
  if (configured === "openai" && active !== "openai") return "openai";
  if (configured === "0g" && active !== "0g") return "0g";
  return null;
}

function providerConfig(provider: AiProvider): ProviderConfig {
  if (provider === "0g") {
    return {
      provider,
      apiKey: process.env.ZERO_G_COMPUTE_API_KEY,
      baseURL: process.env.ZERO_G_COMPUTE_BASE_URL || ZERO_G_ROUTER_URL,
      model: process.env.ZERO_G_COMPUTE_MODEL || ZERO_G_DEFAULT_MODEL,
      trustMode: process.env.ZERO_G_COMPUTE_TRUST_MODE?.toLowerCase() === "disabled" ? undefined : "private",
      verifyTee: process.env.ZERO_G_COMPUTE_VERIFY_TEE?.toLowerCase() !== "false"
    };
  }

  return {
    provider,
    apiKey: process.env.LLM_API_KEY,
    baseURL: process.env.LLM_BASE_URL || "https://api.openai.com/v1",
    model: process.env.LLM_MODEL || "gpt-4o-mini"
  };
}

function teeWasVerified(response: unknown) {
  if (!response || typeof response !== "object") return false;
  const record = response as { trace?: unknown; x_0g_trace?: unknown; tee_verified?: unknown; metadata?: unknown };
  const trace = asRecord(record.trace);
  const zeroGTrace = asRecord(record.x_0g_trace);
  const metadata = asRecord(record.metadata);
  const verified = record.tee_verified === true || trace?.tee_verified === true || zeroGTrace?.tee_verified === true || metadata?.tee_verified === true;

  if (!verified && process.env.NODE_ENV !== "production") {
    console.warn("0G TEE verification metadata was not found", {
      responseKeys: Object.keys(record).filter((key) => key !== "choices"),
      traceType: typeof record.trace,
      traceKeys: trace ? Object.keys(trace) : [],
      zeroGTraceType: typeof record.x_0g_trace,
      zeroGTraceKeys: zeroGTrace ? Object.keys(zeroGTrace) : [],
      metadataKeys: metadata ? Object.keys(metadata) : []
    });
  }

  return verified;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object") return value as Record<string, unknown>;
  if (typeof value !== "string") return null;
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" ? parsed as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

class TeeVerificationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TeeVerificationError";
  }
}

function fallbackReply(messages: ChatMessage[]) {
  const workflowInstruction = messages.find((message) => message.role === "system" && message.content.startsWith("An agent workflow has just started."))?.content;
  const openingQuestion = workflowInstruction?.match(/Start by asking this opening question, naturally and only once:\s*([\s\S]+)$/)?.[1]?.trim();
  if (openingQuestion) return openingQuestion;

  const userMessage = [...messages].reverse().find((message) => message.role === "user")?.content ?? "";
  if (/learning|build|blockchain|code/i.test(userMessage)) {
    return "I like that direction. Tell me what part you are working on now, and I will keep track of it so we can build on it together.";
  }
  if (/sad|stressed|worried|lonely/i.test(userMessage)) {
    return "I am here with you. Want to tell me the part that feels heaviest right now?";
  }
  return "I will remember that. What should we do with this next?";
}
