import type { AgentMemory } from "@prisma/client";

const categoryWeight = {
  GOAL: 3,
  PROJECT: 3,
  PREFERENCE: 2,
  FEEDBACK: 2,
  DECISION: 2,
  FACT: 1
} as const;

export function retrieveRelevantAgentMemories(memories: AgentMemory[], message: string, limit = 8) {
  const messageTerms = terms(message);

  return memories
    .map((memory) => {
      const memoryTerms = terms(`${memory.content} ${memory.tags.join(" ")}`);
      const overlap = [...messageTerms].filter((term) => memoryTerms.has(term)).length;
      const score = memory.importance * 2 + memory.confidence + categoryWeight[memory.category] + overlap * 6;
      return { memory, score, overlap };
    })
    .filter(({ overlap, memory }) => overlap > 0 || memory.category === "GOAL" || memory.category === "PROJECT")
    .sort((left, right) => right.score - left.score)
    .slice(0, limit)
    .map(({ memory }) => memory);
}

function terms(value: string) {
  return new Set(
    value
      .toLowerCase()
      .match(/[a-z0-9]{3,}/g)
      ?.filter((term) => !stopWords.has(term)) ?? []
  );
}

const stopWords = new Set([
  "about", "after", "again", "also", "been", "being", "could", "from", "have", "into", "just", "like", "more", "really", "should", "that", "the", "this", "they", "want", "with", "would", "your"
]);
