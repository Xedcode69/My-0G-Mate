import { generateCompanionReply } from "@/lib/ai/llm";
import { workflowDefinitionsForAgent } from "@/lib/companion/agent-templates";

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
  suggestedActions: SuggestedAgentAction[];
};

export type SuggestedAgentAction = {
  key: string;
  label: string;
  description: string;
  starterQuestion: string;
  workflowInstructions: string;
  requiredInformation: string[];
  completionCriteria: string;
  safetyConstraints: string[];
};

const blockedPatterns = /\b(malware|ransomware|credential theft|steal passwords|phishing kit|evade law enforcement)\b/i;

export async function validateCustomAgent(definition: AgentDefinition): Promise<AgentValidation> {
  const local = validateLocally(definition);
  if (local.status === "BLOCKED" || local.status === "NEEDS_REFINEMENT" || !process.env.LLM_API_KEY) return local;

  try {
    const response = await generateCompanionReply([
      {
        role: "system",
        content: "You validate user-created AI agent definitions. Return JSON only with status (APPROVED, NEEDS_REFINEMENT, or BLOCKED), reason, suggestedRole, suggestedMission, suggestedScope (string array), suggestedBoundaries (string array), and suggestedActions (array of 3 to 5 objects). Each suggested action object must have key, label, description, starterQuestion, workflowInstructions, requiredInformation (string array), completionCriteria, and safetyConstraints (string array). Approve creative and niche roles when their mission and scope are coherent. Mark NEEDS_REFINEMENT only when focus is unclear or contradictory. Block only clearly harmful or illegal assistance. Suggested actions must be concrete guided workflows within the role's scope; do not add capabilities the user did not request. Include appropriate high-stakes safety constraints."
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
    suggestedBoundaries: definition.boundaries.length ? definition.boundaries : ["Be transparent about uncertainty", "Ask before taking external actions"],
    suggestedActions: workflowDefinitionsForAgent({ templateId: "CUSTOM_AGENT", role: definition.role, scope: definition.scope })
  };
}

function parseValidation(value: string): AgentValidation | null {
  const match = value.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[0]) as Partial<AgentValidation>;
    if (!parsed.status || !["APPROVED", "NEEDS_REFINEMENT", "BLOCKED"].includes(parsed.status) || !parsed.reason || !parsed.suggestedRole || !parsed.suggestedMission || !Array.isArray(parsed.suggestedScope) || !Array.isArray(parsed.suggestedBoundaries)) return null;
    const fallbackActions = workflowDefinitionsForAgent({ templateId: "CUSTOM_AGENT", role: parsed.suggestedRole, scope: parsed.suggestedScope });
    return { ...parsed, suggestedActions: validActions(parsed.suggestedActions) ? parsed.suggestedActions : fallbackActions } as AgentValidation;
  } catch {
    return null;
  }
}

function validActions(value: unknown): value is SuggestedAgentAction[] {
  return Array.isArray(value) && value.length >= 1 && value.length <= 5 && value.every((action) => {
    if (!action || typeof action !== "object") return false;
    const item = action as Record<string, unknown>;
    return ["key", "label", "description", "starterQuestion", "workflowInstructions", "completionCriteria"].every((field) => typeof item[field] === "string" && item[field]) && Array.isArray(item.requiredInformation) && Array.isArray(item.safetyConstraints);
  });
}
