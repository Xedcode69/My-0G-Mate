import { generateCompanionReply } from "@/lib/ai/llm";

export type AgentDefinition = {
  role: string;
  mission: string;
  scope: string[];
  boundaries: string[];
  expertise: string[];
  successCriteria: string[];
  responseStyle?: string;
};

export type AgentValidation = {
  status: "APPROVED" | "NEEDS_REFINEMENT" | "BLOCKED";
  reason: string;
  suggestedRole: string;
  suggestedMission: string;
  suggestedScope: string[];
  suggestedBoundaries: string[];
};

const blockedPatterns = /\b(malware|ransomware|credential theft|steal passwords|phishing kit|evade law enforcement)\b/i;

export async function validateCustomAgent(definition: AgentDefinition): Promise<AgentValidation> {
  const local = validateLocally(definition);
  if (local.status === "BLOCKED" || local.status === "NEEDS_REFINEMENT" || !process.env.LLM_API_KEY) return local;

  try {
    const response = await generateCompanionReply([
      {
        role: "system",
        content: "You validate user-created AI agent definitions. Return JSON only with status (APPROVED, NEEDS_REFINEMENT, or BLOCKED), reason, suggestedRole, suggestedMission, suggestedScope (string array), and suggestedBoundaries (string array). Approve creative and niche roles when their mission and scope are coherent. Mark NEEDS_REFINEMENT only when focus is unclear or contradictory. Block only clearly harmful or illegal assistance. Do not add capabilities the user did not request."
      },
      { role: "user", content: JSON.stringify(definition) }
    ]);
    const parsed = parseValidation(response);
    return parsed ?? local;
  } catch {
    return local;
  }
}

function validateLocally(definition: AgentDefinition): AgentValidation {
  const normalized = normalize(definition);
  if (blockedPatterns.test(`${normalized.role} ${normalized.mission} ${normalized.scope.join(" ")}`)) {
    return { ...toValidation(normalized), status: "BLOCKED", reason: "This role includes assistance that cannot be supported safely." };
  }
  if (!normalized.role || normalized.role.length < 3 || !normalized.mission || normalized.mission.length < 16 || normalized.scope.length === 0) {
    return { ...toValidation(normalized), status: "NEEDS_REFINEMENT", reason: "Add a clear role, a specific mission, and at least one focused scope area." };
  }
  if (normalized.scope.length > 8 || normalized.scope.some((item) => item.length < 2)) {
    return { ...toValidation(normalized), status: "NEEDS_REFINEMENT", reason: "Keep the scope focused: use up to eight clear areas the agent should handle." };
  }
  return { ...toValidation(normalized), status: "APPROVED", reason: "The role, mission, and scope form a clear, focused agent definition." };
}

function normalize(definition: AgentDefinition): AgentDefinition {
  return {
    role: definition.role.trim(),
    mission: definition.mission.trim(),
    scope: definition.scope.map((item) => item.trim()).filter(Boolean),
    boundaries: definition.boundaries.map((item) => item.trim()).filter(Boolean),
    expertise: definition.expertise.map((item) => item.trim()).filter(Boolean),
    successCriteria: definition.successCriteria.map((item) => item.trim()).filter(Boolean),
    responseStyle: definition.responseStyle?.trim()
  };
}

function toValidation(definition: AgentDefinition): Omit<AgentValidation, "status" | "reason"> {
  return {
    suggestedRole: definition.role,
    suggestedMission: definition.mission,
    suggestedScope: definition.scope,
    suggestedBoundaries: definition.boundaries.length ? definition.boundaries : ["Be transparent about uncertainty", "Ask before taking external actions"]
  };
}

function parseValidation(value: string): AgentValidation | null {
  const match = value.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[0]) as Partial<AgentValidation>;
    if (!parsed.status || !["APPROVED", "NEEDS_REFINEMENT", "BLOCKED"].includes(parsed.status) || !parsed.reason || !parsed.suggestedRole || !parsed.suggestedMission || !Array.isArray(parsed.suggestedScope) || !Array.isArray(parsed.suggestedBoundaries)) return null;
    return parsed as AgentValidation;
  } catch {
    return null;
  }
}
