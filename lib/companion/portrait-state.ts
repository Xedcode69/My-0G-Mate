export const portraitVisualStates = ["supportive", "energized", "focused", "playful", "reflective"] as const;

export type PortraitVisualState = (typeof portraitVisualStates)[number];
export type PortraitActivityState = "idle" | "listening" | "thinking" | "replying" | "celebrating";

export type PortraitDirection = {
  visualState: PortraitVisualState;
  label: string;
  expression: string;
  pose: string;
  lighting: string;
  background: string;
};

export const portraitDirections: Record<PortraitVisualState, PortraitDirection> = {
  supportive: {
    visualState: "supportive",
    label: "Supportive",
    expression: "a gentle, reassuring expression",
    pose: "a relaxed, open posture",
    lighting: "warm golden lighting",
    background: "a soft, welcoming room"
  },
  energized: {
    visualState: "energized",
    label: "Energized",
    expression: "an excited, encouraging expression",
    pose: "an active, ready-to-cheer pose",
    lighting: "crisp, bright lighting",
    background: "a subtle stadium or game-room backdrop"
  },
  focused: {
    visualState: "focused",
    label: "Focused",
    expression: "a calm, attentive expression",
    pose: "a confident, engaged posture",
    lighting: "clean, cool task lighting",
    background: "a subtle futuristic workspace"
  },
  playful: {
    visualState: "playful",
    label: "Playful",
    expression: "a bright, playful reaction",
    pose: "a lively, expressive pose",
    lighting: "cinematic, colorful lighting",
    background: "a whimsical cinematic backdrop"
  },
  reflective: {
    visualState: "reflective",
    label: "Reflective",
    expression: "a calm, thoughtful expression",
    pose: "a still, grounded posture",
    lighting: "soft, low-contrast evening lighting",
    background: "a quiet, uncluttered background"
  }
};

const statePatterns: Array<[PortraitVisualState, RegExp]> = [
  ["supportive", /\b(help|support|sad|anxious|anxiety|stressed|overwhelmed|lonely|grief|hurt|sorry|difficult|hard time|feel(?:ing)? down)\b/i],
  ["energized", /\b(sport|sports|game|gaming|match|football|soccer|cricket|basketball|win|won|goal|play|esport)\b/i],
  ["focused", /\b(code|coding|technology|tech|program|debug|computer|software|ai|build|study|work|project)\b/i],
  ["playful", /\b(movie|movies|film|anime|show|series|character|funny|joke|meme|watch)\b/i],
  ["reflective", /\b(reflect|reflection|meaning|life|future|memory|memories|thoughtful|serious|philosophy|purpose)\b/i]
];

export function selectPortraitState(...messages: string[]): PortraitVisualState {
  const text = messages.join(" ");
  return statePatterns.find(([, pattern]) => pattern.test(text))?.[0] ?? "supportive";
}
