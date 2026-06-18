import type { CompanionMood, CompanionType } from "@prisma/client";

export type CompanionArchetype = {
  type: CompanionType;
  label: string;
  traits: string[];
  background: string;
  evolution: string;
  stageOneAvatar: string;
  stageTwoAvatar: string;
  accent: string;
};

export const companionArchetypes: Record<CompanionType, CompanionArchetype> = {
  ROBOT: {
    type: "ROBOT",
    label: "Robot",
    traits: ["Logical", "Curious", "Analytical", "Helpful"],
    background: "Futuristic lab",
    evolution: "Becomes more intelligent and efficient.",
    stageOneAvatar: "R-01",
    stageTwoAvatar: "R-02",
    accent: "#3478a4"
  },
  PET: {
    type: "PET",
    label: "Pet",
    traits: ["Cute", "Playful", "Loyal", "Energetic"],
    background: "Cozy garden room",
    evolution: "Becomes more affectionate.",
    stageOneAvatar: "Paw",
    stageTwoAvatar: "Paw+",
    accent: "#2f9b7b"
  },
  ANIME_GIRL: {
    type: "ANIME_GIRL",
    label: "Anime Girl",
    traits: ["Friendly", "Expressive", "Cheerful", "Motivational"],
    background: "Warm cafe bedroom",
    evolution: "Develops unique quirks and interests.",
    stageOneAvatar: "Mika",
    stageTwoAvatar: "Mika+",
    accent: "#d45f3c"
  },
  SPIRIT: {
    type: "SPIRIT",
    label: "Spirit",
    traits: ["Wise", "Calm", "Mysterious", "Reflective"],
    background: "Mystical forest shrine",
    evolution: "Becomes more insightful and philosophical.",
    stageOneAvatar: "Wisp",
    stageTwoAvatar: "Wisp+",
    accent: "#7b61a8"
  }
};

export const relationshipLabels: Record<number, string> = {
  1: "Stranger",
  2: "Acquaintance",
  3: "Friend",
  4: "Close Friend",
  5: "Companion Bond"
};

export const moodLabels: Record<CompanionMood, string> = {
  HAPPY: "Happy",
  NEUTRAL: "Neutral",
  LONELY: "Lonely",
  EXCITED: "Excited"
};
