export type StructuredResult = {
  type: "recommendations" | "plan" | "research" | "checklist" | "summary";
  title: string;
  summary?: string;
  items: { title: string; subtitle?: string; description?: string; tags?: string[] }[];
  followUps?: string[];
};

export function extractStructuredResult(response: string) {
  const match = response.match(/\s*\[\[STRUCTURED_RESULT:\s*([\s\S]*?)\s*\]\]\s*/);
  if (!match) return { response, structuredOutput: null as StructuredResult | null };
  const cleanedResponse = response.replace(match[0], "").trim();
  try {
    const parsed = JSON.parse(match[1]);
    if (!isStructuredResult(parsed)) return { response: cleanedResponse, structuredOutput: null as StructuredResult | null };
    return { response: cleanedResponse, structuredOutput: parsed };
  } catch {
    return { response: cleanedResponse, structuredOutput: null as StructuredResult | null };
  }
}

function isStructuredResult(value: unknown): value is StructuredResult {
  if (!value || typeof value !== "object") return false;
  const result = value as Record<string, unknown>;
  if (!(["recommendations", "plan", "research", "checklist", "summary"] as string[]).includes(String(result.type)) || typeof result.title !== "string" || !Array.isArray(result.items)) return false;
  return result.items.every((item) => {
    if (!item || typeof item !== "object") return false;
    const entry = item as Record<string, unknown>;
    return typeof entry.title === "string" && (entry.subtitle === undefined || typeof entry.subtitle === "string") && (entry.description === undefined || typeof entry.description === "string") && (entry.tags === undefined || (Array.isArray(entry.tags) && entry.tags.every((tag) => typeof tag === "string")));
  });
}
