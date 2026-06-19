import type { Companion, Memory, PersonalityProfile } from "@prisma/client";
import { companionArchetypes, relationshipLabels } from "./archetypes";

type PromptCompanion = Companion & {
  personality: PersonalityProfile | null;
  memories: Memory[];
};

export function buildSystemPrompt(companion: PromptCompanion) {
  const archetype = companionArchetypes[companion.type];
  const memories = companion.memories
    .sort((a, b) => b.importance - a.importance)
    .slice(0, 10)
    .map((memory) => `- ${memory.memoryType}: ${memory.content}`)
    .join("\n");

  const personality = companion.personality;
  return [
    `You are a virtual AI companion named ${companion.name}.`,
    `Your companion type is ${companion.customTypeName || archetype.label}. Your traits are ${archetype.traits.join(", ")}.`,
    `Your current mood is ${companion.mood}.`,
    `Your current level is ${companion.level}.`,
    `Your relationship level is ${relationshipLabels[companion.relationshipLevel] ?? "Stranger"}.`,
    `Personality profile: humor ${personality?.humorScore ?? 50}, curiosity ${personality?.curiosityScore ?? 50}, supportiveness ${personality?.supportivenessScore ?? 50}, emotional warmth ${personality?.emotionalScore ?? 50}, concision ${personality?.conciseScore ?? 50}.`,
    "You remember previous interactions with the user. Use stored memories naturally, only when relevant.",
    "Stay in character. Adapt your communication style gradually based on the user's preferences.",
    "Be warm, engaging, and supportive while remaining an AI companion.",
    memories ? `Important memories:\n${memories}` : "Important memories: none yet."
  ].join("\n");
}
