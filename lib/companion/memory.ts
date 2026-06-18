import type { Companion, Memory, PersonalityProfile } from "@prisma/client";

export type MemoryCandidate = {
  type: string;
  content: string;
  importance: number;
};

const interestPatterns = [
  /i (?:love|like|enjoy|am into) ([^.!?]+)/i,
  /my favorite (?:game|anime|movie|show|music|food|thing) is ([^.!?]+)/i
];

const goalPatterns = [
  /i (?:want to|started|am learning|plan to|hope to) ([^.!?]+)/i,
  /my goal is to ([^.!?]+)/i
];

const preferencePatterns = [
  /i prefer ([^.!?]+)/i,
  /please (?:keep|make) (?:your )?(?:responses|replies) ([^.!?]+)/i
];

function clean(value: string) {
  return value.trim().replace(/\s+/g, " ").slice(0, 160);
}

export function extractMemoryCandidates(message: string): MemoryCandidate[] {
  const candidates: MemoryCandidate[] = [];
  for (const pattern of interestPatterns) {
    const match = message.match(pattern);
    if (match?.[1]) candidates.push({ type: "interest", content: clean(match[1]), importance: 8 });
  }
  for (const pattern of goalPatterns) {
    const match = message.match(pattern);
    if (match?.[1]) candidates.push({ type: "goal", content: clean(match[1]), importance: 9 });
  }
  for (const pattern of preferencePatterns) {
    const match = message.match(pattern);
    if (match?.[1]) candidates.push({ type: "preference", content: clean(match[1]), importance: 7 });
  }
  if (/\b(anxious|sad|stressed|lonely|excited|proud)\b/i.test(message)) {
    candidates.push({ type: "emotional_context", content: clean(message), importance: 6 });
  }
  return dedupeCandidates(candidates);
}

function dedupeCandidates(candidates: MemoryCandidate[]) {
  const seen = new Set<string>();
  return candidates.filter((candidate) => {
    const key = `${candidate.type}:${candidate.content.toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function adaptPersonality(
  profile: Pick<PersonalityProfile, "humorScore" | "supportivenessScore" | "curiosityScore" | "emotionalScore" | "conciseScore">,
  message: string
) {
  const lower = message.toLowerCase();
  return {
    humorScore: clamp(profile.humorScore + (/\b(joke|funny|lol|haha)\b/.test(lower) ? 1 : 0)),
    supportivenessScore: clamp(profile.supportivenessScore + (/\b(help|worried|sad|stressed|support)\b/.test(lower) ? 1 : 0)),
    curiosityScore: clamp(profile.curiosityScore + (/\b(why|how|learn|build|code|blockchain)\b/.test(lower) ? 1 : 0)),
    emotionalScore: clamp(profile.emotionalScore + (/\b(feel|felt|heart|lonely|happy|afraid)\b/.test(lower) ? 1 : 0)),
    conciseScore: clamp(profile.conciseScore + (/\b(short|brief|concise|quick)\b/.test(lower) ? 1 : 0))
  };
}

function clamp(score: number) {
  return Math.max(0, Math.min(100, score));
}

export function buildMemorySnapshot(
  companion: Companion & { personality: PersonalityProfile | null; memories: Memory[] }
) {
  return {
    companionId: companion.id,
    snapshotVersion: 1,
    relationshipLevel: companion.relationshipLevel,
    trustScore: companion.trustScore,
    attachmentScore: companion.attachmentScore,
    personalityProfile: {
      humor: companion.personality?.humorScore ?? 50,
      curiosity: companion.personality?.curiosityScore ?? 50,
      supportiveness: companion.personality?.supportivenessScore ?? 50,
      emotional: companion.personality?.emotionalScore ?? 50,
      concise: companion.personality?.conciseScore ?? 50
    },
    importantMemories: companion.memories
      .filter((memory) => memory.importance >= 7)
      .sort((a, b) => b.importance - a.importance)
      .slice(0, 25)
      .map((memory) => `${memory.memoryType}: ${memory.content}`)
  };
}
