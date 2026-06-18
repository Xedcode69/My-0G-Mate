import type { Companion, Memory } from "@prisma/client";

export const xpRewards = {
  DAILY_CHECK_IN: 20,
  FEED_COMPANION: 10,
  PLAY_MINI_GAME: 25,
  REFLECTION_PROMPT: 15,
  ASK_COMPANION_QUESTION: 5
} as const;

export function levelFromXp(xp: number) {
  return Math.floor(xp / 100) + 1;
}

export function relationshipLevelFromScores(trustScore: number, attachmentScore: number) {
  const score = Math.floor((trustScore + attachmentScore) / 2);
  if (score >= 85) return 5;
  if (score >= 65) return 4;
  if (score >= 40) return 3;
  if (score >= 18) return 2;
  return 1;
}

export function nextRelationshipScores(companion: Pick<Companion, "trustScore" | "attachmentScore">, amount = 2) {
  const trustScore = Math.min(100, companion.trustScore + amount);
  const attachmentScore = Math.min(100, companion.attachmentScore + Math.max(1, amount - 1));
  return {
    trustScore,
    attachmentScore,
    relationshipLevel: relationshipLevelFromScores(trustScore, attachmentScore)
  };
}

export function evolutionStageFor(companion: Pick<Companion, "xp" | "relationshipLevel">, memories: Pick<Memory, "importance">[]) {
  const levelScore = Math.min(100, levelFromXp(companion.xp) * 12);
  const relationshipScore = companion.relationshipLevel * 20;
  const memoryScore = Math.min(100, memories.filter((memory) => memory.importance >= 7).length * 12);
  const weighted = levelScore * 0.4 + relationshipScore * 0.3 + memoryScore * 0.3;
  return levelFromXp(companion.xp) >= 5 && weighted >= 60 ? 2 : 1;
}

export function moodAfterInteraction(lastInteractionAgeHours: number, relationshipDelta: number) {
  if (relationshipDelta >= 4) return "EXCITED" as const;
  if (lastInteractionAgeHours > 72) return "LONELY" as const;
  if (relationshipDelta > 0) return "HAPPY" as const;
  return "NEUTRAL" as const;
}
