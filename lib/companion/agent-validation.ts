import { generateCompanionReply, isLlmConfigured } from "@/lib/ai/llm";
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
  if (local.status === "BLOCKED" || local.status === "NEEDS_REFINEMENT" || !isLlmConfigured()) return local;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await generateCompanionReply([
      {
        role: "system",
        content: "The server has already approved this custom AI agent definition. Generate only its distinct, concrete agent workflows. Return JSON only, with exactly this top-level shape: {\"suggestedActions\":[...]}. Return 2 to 4 action objects. Every action object must include key, label, description, starterQuestion, workflowInstructions, requiredInformation (a non-empty string array), completionCriteria, and safetyConstraints (a non-empty string array). Each workflow must directly serve the supplied role, mission, and scope and have a different user outcome. Include a domain noun from the role, mission, or scope in the label, description, and workflow instructions. Do not add capabilities outside the supplied definition. Never use generic workflows such as Check focus, Review progress, Get started, or Plan next step. Do not include Markdown, commentary, or fields other than suggestedActions. Example shape only: {\"suggestedActions\":[{\"key\":\"domain-workflow\",\"label\":\"Domain workflow\",\"description\":\"A concrete outcome for the supplied domain.\",\"starterQuestion\":\"What information should we begin with?\",\"workflowInstructions\":\"Collect the necessary context, propose a practical result, and ask for confirmation.\",\"requiredInformation\":[\"user objective\",\"constraints\"],\"completionCriteria\":\"The user has approved a useful result.\",\"safetyConstraints\":[\"State uncertainty clearly\"]}]}."
      },
      { role: "user", content: JSON.stringify(definition) }
      ], { maxTokens: 2200, temperature: 0.2, jsonObject: true });
      const parsedWorkflows = parseWorkflowSuggestions(response);
      if (parsedWorkflows.actions && actionsMatchDefinition(parsedWorkflows.actions, definition)) {
        return { ...local, suggestedActions: parsedWorkflows.actions };
      }
      if (process.env.NODE_ENV !== "production") {
        console.warn("Rejected model-suggested agent workflows", {
          attempt: attempt + 1,
          reason: !parsedWorkflows.actions ? parsedWorkflows.reason : "The workflows were generic, duplicated, or did not align with the role, mission, and scope",
          actionCount: parsedWorkflows.actions?.length ?? 0,
          responseShape: parsedWorkflows.shape
        });
      }
    } catch {
      // Fall through to the deterministic result below.
    }
  }

  return local;
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

type WorkflowParseResult = {
  actions: SuggestedAgentAction[] | null;
  reason: string;
  shape: Record<string, unknown>;
};

function parseWorkflowSuggestions(value: string): WorkflowParseResult {
  const candidates = [
    value.trim().replace(/^```(?:json)?\s*|\s*```$/g, ""),
    value.match(/\{[\s\S]*\}/)?.[0]
  ].filter((candidate): candidate is string => Boolean(candidate));

  let foundObject = false;
  let latestShape: Record<string, unknown> = {
    contentLength: value.length,
    beginsWith: value.trim().slice(0, 1) || "empty",
    endsWith: value.trim().slice(-1) || "empty",
    jsonCandidates: candidates.length
  };

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate) as { suggestedActions?: unknown };
      foundObject = true;
      const rawActions = Array.isArray(parsed.suggestedActions) ? parsed.suggestedActions : [];
      latestShape = {
        topLevelKeys: Object.keys(parsed),
        rawActionCount: rawActions.length,
        firstActionFields: rawActions[0] && typeof rawActions[0] === "object" ? Object.keys(rawActions[0] as Record<string, unknown>) : []
      };
      if (validActions(parsed.suggestedActions)) return { actions: parsed.suggestedActions, reason: "", shape: latestShape };
    } catch {
      // Try the next possible JSON block.
    }
  }

  return {
    actions: null,
    reason: foundObject ? "The JSON object did not contain complete workflow actions" : "The response did not contain a JSON object",
    shape: latestShape
  };
}

function validActions(value: unknown): value is SuggestedAgentAction[] {
  return Array.isArray(value) && value.length >= 2 && value.length <= 4 && value.every((action) => {
    if (!action || typeof action !== "object") return false;
    const item = action as Record<string, unknown>;
    return ["key", "label", "description", "starterQuestion", "workflowInstructions", "completionCriteria"].every((field) => typeof item[field] === "string" && item[field].trim()) && nonEmptyStringArray(item.requiredInformation) && nonEmptyStringArray(item.safetyConstraints);
  }) && new Set(value.map((action) => action.key.trim().toLowerCase())).size === value.length && new Set(value.map((action) => action.label.trim().toLowerCase())).size === value.length;
}

function actionsMatchDefinition(actions: SuggestedAgentAction[], definition: AgentDefinition) {
  const definitionTerms = terms(`${definition.role} ${definition.mission} ${definition.scope.join(" ")}`);
  const genericLabels = new Set(["check focus", "review progress", "get started", "plan next step", "create action plan", "create brief"]);
  if (!validActions(actions) || actions.some((action) => genericLabels.has(action.label.toLowerCase()))) return false;

  const actionTerms = actions.map((action) => terms(`${action.label} ${action.description} ${action.starterQuestion} ${action.workflowInstructions} ${action.requiredInformation.join(" ")} ${action.completionCriteria}`));
  const minimumMatches = definitionTerms.size >= 5 ? 2 : 1;
  return actionTerms.every((termsForAction, index) => {
    const alignedTerms = [...termsForAction].filter((term) => definitionTerms.has(term));
    if (alignedTerms.length < minimumMatches) return false;
    return actionTerms.every((otherTerms, otherIndex) => index === otherIndex || jaccardSimilarity(termsForAction, otherTerms) < 0.8);
  });
}

function nonEmptyStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.length > 0 && value.every((item) => typeof item === "string" && item.trim());
}

function jaccardSimilarity(left: Set<string>, right: Set<string>) {
  const union = new Set([...left, ...right]);
  if (!union.size) return 1;
  const intersection = [...left].filter((term) => right.has(term));
  return intersection.length / union.size;
}

function terms(value: string) {
  return new Set(value.toLowerCase().match(/[a-z0-9]{3,}/g)?.filter((term) => !genericTerms.has(term)) ?? []);
}

const genericTerms = new Set(["about", "agent", "and", "are", "assistant", "build", "for", "from", "have", "help", "into", "mission", "role", "scope", "that", "the", "this", "user", "with", "your"]);
