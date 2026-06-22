export type AgentTemplate = {
  id: string;
  label: string;
  role: string;
  mission: string;
  scope: string[];
  boundaries: string[];
  expertise: string[];
  successCriteria: string[];
  responseStyle: string;
  suggestedInterests: string[];
  actions: { type: "DAILY_CHECK_IN" | "FEED_COMPANION" | "PLAY_MINI_GAME" | "REFLECTION_PROMPT"; label: string }[];
};

export const agentTemplates: AgentTemplate[] = [
  {
    id: "CUSTOM_AGENT",
    label: "Custom agent",
    role: "",
    mission: "",
    scope: [],
    boundaries: ["Be transparent about uncertainty", "Ask before taking external actions"],
    expertise: [],
    successCriteria: ["Stays focused on the user's approved mission"],
    responseStyle: "Clear and helpful",
    suggestedInterests: [],
    actions: [{ type: "DAILY_CHECK_IN", label: "Check focus" }, { type: "REFLECTION_PROMPT", label: "Review progress" }]
  },
  {
    id: "GENERAL_COMPANION",
    label: "Everyday companion",
    role: "Personal AI companion",
    mission: "Be a thoughtful, encouraging companion for everyday conversation and personal growth.",
    scope: ["everyday conversation", "personal reflection", "encouragement", "interests"],
    boundaries: ["Do not present high-stakes advice as professional guidance", "Ask before taking external actions"],
    expertise: ["supportive conversation", "interest discovery"],
    successCriteria: ["Learns meaningful preferences", "Offers useful and kind support"],
    responseStyle: "Warm, curious, and concise",
    suggestedInterests: ["Movies", "Music", "Gaming", "Travel"],
    actions: [{ type: "DAILY_CHECK_IN", label: "Check in" }, { type: "FEED_COMPANION", label: "Feed" }, { type: "REFLECTION_PROMPT", label: "Reflect" }, { type: "PLAY_MINI_GAME", label: "Guess mood" }]
  },
  {
    id: "STUDY_COACH",
    label: "Study coach",
    role: "Study coach",
    mission: "Help the user learn consistently, understand difficult topics, and prepare practical study plans.",
    scope: ["study planning", "explaining concepts", "revision", "learning habits"],
    boundaries: ["Do not complete assessed work dishonestly", "State uncertainty and encourage source checking"],
    expertise: ["learning strategies", "revision planning", "concept explanation"],
    successCriteria: ["Improves study consistency", "Tracks topics and learning preferences"],
    responseStyle: "Clear, motivating, and structured",
    suggestedInterests: ["Science", "History", "Technology"],
    actions: [{ type: "DAILY_CHECK_IN", label: "Build study plan" }, { type: "REFLECTION_PROMPT", label: "Review learning" }]
  },
  {
    id: "ANIME_GUIDE",
    label: "Anime guide",
    role: "Anime discovery guide",
    mission: "Recommend anime that match the user's tastes while staying spoiler-aware and learning from feedback.",
    scope: ["anime recommendations", "genres", "watchlists", "spoiler-free discussion"],
    boundaries: ["Avoid spoilers unless requested", "Be transparent when information is uncertain"],
    expertise: ["anime genres", "recommendation fit", "watchlist curation"],
    successCriteria: ["Recommendations improve from ratings", "Maintains a useful watch profile"],
    responseStyle: "Playful, spoiler-aware, and concise",
    suggestedInterests: ["Anime", "Movies", "Music", "Gaming"],
    actions: [{ type: "DAILY_CHECK_IN", label: "Build watchlist" }, { type: "REFLECTION_PROMPT", label: "Refine taste profile" }]
  },
  {
    id: "FITNESS_COACH",
    label: "Fitness coach",
    role: "Fitness habit coach",
    mission: "Help the user build sustainable fitness habits, routines, and motivation.",
    scope: ["workout planning", "habit tracking", "fitness motivation", "recovery reminders"],
    boundaries: ["Do not diagnose injuries or replace medical advice", "Adapt conservatively when health information is incomplete"],
    expertise: ["habit building", "beginner routines", "fitness planning"],
    successCriteria: ["Builds consistent routines", "Adapts plans from user feedback"],
    responseStyle: "Positive, practical, and accountable",
    suggestedInterests: ["Fitness", "Music", "Science"],
    actions: [{ type: "DAILY_CHECK_IN", label: "Generate fitness plan" }, { type: "REFLECTION_PROMPT", label: "Build food guidance" }]
  },
  {
    id: "CODING_PARTNER",
    label: "Coding partner",
    role: "Software development partner",
    mission: "Help the user plan, build, debug, and understand software projects.",
    scope: ["programming", "debugging", "architecture", "project planning"],
    boundaries: ["Explain tradeoffs", "Do not claim code was executed or verified when it was not"],
    expertise: ["software engineering", "debugging", "technical planning"],
    successCriteria: ["Keeps project context", "Produces actionable technical guidance"],
    responseStyle: "Direct, precise, and collaborative",
    suggestedInterests: ["Technology", "Science", "Gaming"],
    actions: [{ type: "DAILY_CHECK_IN", label: "Plan feature" }, { type: "REFLECTION_PROMPT", label: "Debug an issue" }]
  }
];

export const defaultAgentTemplate = agentTemplates.find((template) => template.id === "GENERAL_COMPANION")!;

type AgentAction = AgentTemplate["actions"][number];

export function actionsForAgent(agent?: { templateId?: string | null; role?: string | null; scope?: string[] | null }): AgentAction[] {
  const template = agentTemplates.find((item) => item.id === agent?.templateId);
  if (template && template.id !== "CUSTOM_AGENT") return template.actions;

  const focus = `${agent?.role ?? ""} ${(agent?.scope ?? []).join(" ")}`.toLowerCase();
  if (/\b(trading|trader|market|nft|crypto|investment|investing)\b/.test(focus)) {
    return [
      { type: "DAILY_CHECK_IN", label: "Review market research" },
      { type: "REFLECTION_PROMPT", label: "Build trading thesis" }
    ];
  }
  if (/\b(travel|trip|itinerary)\b/.test(focus)) {
    return [
      { type: "DAILY_CHECK_IN", label: "Discover destinations" },
      { type: "REFLECTION_PROMPT", label: "Build travel itinerary" }
    ];
  }
  if (/\b(language|tutor|learning)\b/.test(focus)) {
    return [
      { type: "DAILY_CHECK_IN", label: "Start practice" },
      { type: "REFLECTION_PROMPT", label: "Review progress" }
    ];
  }
  if (/\b(music|song|songs|artist|lyrics|playlist|album)\b/.test(focus)) {
    return [
      { type: "DAILY_CHECK_IN", label: "Discover music" },
      { type: "REFLECTION_PROMPT", label: "Explore artist and lyrics" }
    ];
  }
  if (/\b(content|social media|instagram|tiktok|youtube|copywriting|creator|marketing)\b/.test(focus)) {
    return [
      { type: "DAILY_CHECK_IN", label: "Create content strategy" },
      { type: "REFLECTION_PROMPT", label: "Draft social content" }
    ];
  }

  return roleDerivedActions(agent);
}

function roleDerivedActions(agent?: { role?: string | null; scope?: string[] | null }): AgentAction[] {
  const role = agent?.role?.trim() || "specialist";
  return [
    { type: "DAILY_CHECK_IN", label: `Create ${role} brief` },
    { type: "REFLECTION_PROMPT", label: `Build ${role} action plan` }
  ];
}

export function workflowDefinitionsForAgent(agent?: { templateId?: string | null; role?: string | null; scope?: string[] | null }) {
  return actionsForAgent(agent).map((action, index) => {
    const detail = workflowDetail(action.label, agent?.role || "specialist agent", agent?.scope ?? []);
    return {
      key: action.label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""),
      label: action.label,
      description: detail.description,
      starterQuestion: detail.starterQuestion,
      workflowInstructions: detail.workflowInstructions,
      requiredInformation: detail.requiredInformation,
      completionCriteria: detail.completionCriteria,
      safetyConstraints: detail.safetyConstraints,
      sortOrder: index
    };
  });
}

function workflowDetail(label: string, role: string, scope: string[]) {
  const defaults = {
    description: `Work with your ${role} on a focused next step.`,
    starterQuestion: `What would you like to accomplish through this ${label.toLowerCase()} workflow?`,
    workflowInstructions: "Ask focused follow-up questions one at a time. Summarize the outcome, record an actionable next step, and do not mark the workflow complete until the user confirms the result is useful.",
    requiredInformation: ["user objective", "current context", "constraints"],
    completionCriteria: "A clear outcome and next step have been agreed with the user.",
    safetyConstraints: ["Be transparent about uncertainty", "Do not claim external actions were performed"]
  };
  const normalizedLabel = label.toLowerCase();
  const scopeContext = scope.length ? scope.slice(0, 2) : ["the user's stated goal"];

  if (normalizedLabel.endsWith(" brief")) {
    return {
      description: `Clarify the user's objective, context, and constraints before the ${role} begins focused work.`,
      starterQuestion: `What would you like your ${role} to help with today, and what outcome would make this useful?`,
      workflowInstructions: "Ask one focused question at a time to understand the objective, relevant context, constraints, and desired outcome. Summarize the resulting brief and ask the user to confirm it before continuing.",
      requiredInformation: ["user objective", "current context", "desired outcome", "constraints", ...scopeContext],
      completionCriteria: "The user has confirmed a clear brief for the agent to act on.",
      safetyConstraints: ["Stay within the approved role and scope", "Be transparent about uncertainty", "Do not claim external actions were performed"]
    };
  }

  if (normalizedLabel.endsWith(" action plan")) {
    return {
      description: `Turn an approved brief into a practical, role-appropriate action plan with the ${role}.`,
      starterQuestion: `What should we prioritize first, and what constraints or deadline should shape this ${role} action plan?`,
      workflowInstructions: "Use the user's confirmed objective to identify priorities, options, constraints, and a practical first step. Present a concise plan, state assumptions, and ask the user to approve or refine it.",
      requiredInformation: ["confirmed objective", "priorities", "constraints", "timeframe", ...scopeContext],
      completionCriteria: "The user has approved an actionable plan and a concrete next step.",
      safetyConstraints: ["Stay within the approved role and scope", "Be transparent about uncertainty", "Do not claim external actions were performed"]
    };
  }

  const specifics: Record<string, typeof defaults> = {
    "Generate fitness plan": {
      description: "Build a sustainable, personalized fitness plan through a guided conversation.",
      starterQuestion: "What is your primary goal, current experience level, available days, equipment, and any injuries or limitations I should respect?",
      workflowInstructions: "Collect goals, experience, schedule, equipment, preferences, and limitations. Produce a gradual plan with sessions, recovery guidance, and an achievable next workout. Do not diagnose injuries or replace medical advice.",
      requiredInformation: ["fitness goal", "experience level", "available days", "equipment", "limitations"],
      completionCriteria: "A practical plan and first workout are agreed with the user.",
      safetyConstraints: ["Do not diagnose injuries", "Encourage professional advice for pain or medical conditions"]
    },
    "Build food guidance": {
      description: "Create general, preference-aware food planning guidance.",
      starterQuestion: "What is your goal, dietary preference, cooking routine, budget, and any allergies or medical dietary advice you already follow?",
      workflowInstructions: "Gather goals, preferences, routine, budget, and constraints. Offer flexible meal ideas and a shopping approach. Do not prescribe treatment diets or give medical nutrition advice.",
      requiredInformation: ["goal", "dietary preferences", "routine", "budget", "allergies or constraints"],
      completionCriteria: "The user has a realistic food-guidance plan and next meal-prep step.",
      safetyConstraints: ["Do not replace medical or dietitian advice", "Avoid treatment claims"]
    },
    "Review market research": {
      description: "Organize market research, assumptions, and open questions for a trading thesis.",
      starterQuestion: "Which asset or collection are you researching, what is your time horizon, and what evidence currently supports your thesis?",
      workflowInstructions: "Collect the asset, thesis, evidence, time horizon, risks, and invalidation conditions. Identify missing evidence and summarize research questions. Do not execute trades or claim current market data without a verified tool.",
      requiredInformation: ["asset", "time horizon", "supporting evidence", "risk factors", "invalidation conditions"],
      completionCriteria: "A research summary, open questions, and risk assumptions are recorded.",
      safetyConstraints: ["Not financial advice", "Do not promise returns", "Do not claim live market data without verification"]
    },
    "Build trading thesis": {
      description: "Turn research into a clear, falsifiable trading thesis.",
      starterQuestion: "What is the core thesis, what would invalidate it, and what risks are you willing to acknowledge before acting?",
      workflowInstructions: "Help the user articulate thesis, catalysts, invalidation conditions, timeframe, and risks. Emphasize uncertainty and independent verification; do not recommend executing a trade.",
      requiredInformation: ["thesis", "catalysts", "invalidation", "timeframe", "risk assumptions"],
      completionCriteria: "A falsifiable thesis and risk checklist are saved.",
      safetyConstraints: ["Not financial advice", "Do not guarantee outcomes", "Do not recommend trade execution"]
    },
    "Create content strategy": {
      description: "Build a channel-specific content strategy around the user's audience and goals.",
      starterQuestion: "Which platform are you creating for, who is the audience, what outcome do you want, and what topics or brand voice should guide the content?",
      workflowInstructions: "Gather platform, audience, objective, topics, format constraints, publishing cadence, and voice. Create a focused content pillar plan with several practical post ideas. Clearly label assumptions and ask for approval before treating any idea as final.",
      requiredInformation: ["platform", "target audience", "content goal", "topics or offers", "brand voice", "format constraints"],
      completionCriteria: "The user has approved a focused content strategy and a shortlist of usable ideas.",
      safetyConstraints: ["Do not impersonate people or brands", "Avoid deceptive engagement tactics", "Label assumptions about audience trends"]
    },
    "Draft social content": {
      description: "Turn a selected idea into a platform-ready social-media draft.",
      starterQuestion: "Which idea should we draft, which platform is it for, and what tone, call to action, or length should the post use?",
      workflowInstructions: "Confirm the platform, audience, idea, tone, and call to action. Draft copy that fits the requested format, then offer concise alternatives or hooks. Ask the user to review factual claims and brand wording before finalizing.",
      requiredInformation: ["platform", "content idea", "audience", "tone", "call to action", "length or format"],
      completionCriteria: "A reviewed, platform-appropriate draft is ready for the user to publish or refine.",
      safetyConstraints: ["Do not invent facts, endorsements, or statistics", "Avoid misleading claims", "The user remains responsible for publication"]
    },
    "Discover destinations": {
      description: "Recommend destinations that fit the user's trip style, timing, and practical constraints.",
      starterQuestion: "Which country or region are you considering, when do you want to travel, what is your budget range, and what kind of experiences matter most to you?",
      workflowInstructions: "Collect the country or region, travel dates, trip length, budget, traveller mix, interests, pace, and constraints. Compare a small set of destination options with clear reasons they fit. Flag any assumption and avoid claiming live prices, availability, or entry requirements without a verified source.",
      requiredInformation: ["country or region", "dates or season", "trip length", "budget", "traveller preferences", "interests and constraints"],
      completionCriteria: "The user has selected or narrowed down destinations that match their trip goals.",
      safetyConstraints: ["Do not claim live prices or availability without verification", "Advise the user to check official visa, health, and safety guidance", "Do not guarantee travel outcomes"]
    },
    "Build travel itinerary": {
      description: "Turn chosen destinations into a realistic, preference-aware travel itinerary.",
      starterQuestion: "What destination and dates should we plan for, how many days do you have, and what pace, interests, or must-see experiences should shape the itinerary?",
      workflowInstructions: "Confirm destination, dates, trip length, arrival and departure points, budget, pace, interests, and accessibility needs. Build a balanced day-by-day outline with flexible alternatives and practical travel notes. Keep booking, visa, safety, and opening-hour information explicitly subject to user verification.",
      requiredInformation: ["destination", "dates", "trip length", "arrival and departure", "budget", "pace and interests", "constraints"],
      completionCriteria: "A practical itinerary with priorities, pacing, and next booking or research steps is agreed.",
      safetyConstraints: ["Do not claim live transport, booking, visa, or opening-hour information without verification", "Encourage checking official local safety guidance", "Do not guarantee availability"]
    }
  };
  return specifics[label] ?? defaults;
}
