import type { AgentMemory, AgentProfile, Companion, Memory, PersonalityProfile } from "@prisma/client";
import { companionArchetypes, relationshipLabels } from "./archetypes";

type PromptCompanion = Companion & {
  personality: PersonalityProfile | null;
  agentProfile: AgentProfile | null;
  agentMemories: AgentMemory[];
  memories: Memory[];
};

export function buildSystemPrompt(companion: PromptCompanion, relevantAgentMemories = companion.agentMemories) {
  const archetype = companionArchetypes[companion.type];
  const memories = companion.memories
    .sort((a, b) => b.importance - a.importance)
    .slice(0, 10)
    .map((memory) => `- ${memory.memoryType}: ${memory.content}`)
    .join("\n");

  const personality = companion.personality;
  const agent = companion.agentProfile;
  const agentMemories = relevantAgentMemories
    .map((memory) => `- ${memory.category.toLowerCase()}: ${memory.content}`)
    .join("\n");
  return [
    `You are a virtual AI companion named ${companion.name}.`,
    `Your companion type is ${companion.customTypeName || archetype.label}. Your traits are ${archetype.traits.join(", ")}.`,
    agent ? "AGENT IDENTITY" : null,
    agent ? `Role: ${agent.role}.` : null,
    agent ? `Mission: ${agent.mission}` : null,
    agent ? `Focused scope: ${agent.scope.join(", ")}.` : null,
    agent?.expertise.length ? `Core expertise: ${agent.expertise.join(", ")}.` : null,
    agent?.successCriteria.length ? `Success criteria: ${agent.successCriteria.join("; ")}.` : null,
    agent?.responseStyle ? `Response style: ${agent.responseStyle}.` : null,
    agent?.boundaries.length ? `Boundaries: ${agent.boundaries.join("; ")}.` : null,
    agent ? "Prioritize your focused scope and mission. When a request is outside that scope, be transparent, offer limited general support when appropriate, and guide the user back to your area of expertise." : null,
    agent ? "Do not claim to have performed external actions, accessed private systems, or verified facts unless the conversation explicitly provides that evidence." : null,
    `Your current mood is ${companion.mood}.`,
    `Your current level is ${companion.level}.`,
    `Your relationship level is ${relationshipLabels[companion.relationshipLevel] ?? "Stranger"}.`,
    `Personality profile: humor ${personality?.humorScore ?? 50}, curiosity ${personality?.curiosityScore ?? 50}, supportiveness ${personality?.supportivenessScore ?? 50}, emotional warmth ${personality?.emotionalScore ?? 50}, concision ${personality?.conciseScore ?? 50}.`,
    "You remember previous interactions with the user. Use stored memories naturally, only when relevant.",
    "Stay in character. Adapt your communication style gradually based on the user's preferences.",
    "Be warm, engaging, and supportive while remaining an AI companion.",
    memories ? `Important companion memories:\n${memories}` : "Important companion memories: none yet.",
    agentMemories ? `Relevant agent memories for this request:\n${agentMemories}` : "Relevant agent memories: none yet."
  ].filter((line): line is string => Boolean(line)).join("\n");
}
