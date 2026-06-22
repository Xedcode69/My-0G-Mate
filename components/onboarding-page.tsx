"use client";

import { ChangeEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { usePrivy } from "@privy-io/react-auth";
import { Bot, Cat, Check, ImageUp, Loader2, Plus, Sparkles, UserRound } from "lucide-react";
import { companionArchetypes } from "@/lib/companion/archetypes";
import { agentTemplates, defaultAgentTemplate } from "@/lib/companion/agent-templates";
import type { AgentValidation } from "@/lib/companion/agent-validation";
import { StarterPage } from "@/components/starter-page";
import { cn } from "@/lib/ui";

type CompanionType = "ROBOT" | "PET" | "ANIME_GIRL" | "SPIRIT" | "CUSTOM";

const avatarOptions: Record<CompanionType, { key: string; label: string }[]> = {
  ROBOT: [
    { key: "robot-core", label: "Core" },
    { key: "robot-orbit", label: "Orbit" },
    { key: "robot-spark", label: "Spark" }
  ],
  PET: [
    { key: "pet-paw", label: "Paw" },
    { key: "pet-bloom", label: "Bloom" },
    { key: "pet-zippy", label: "Zippy" }
  ],
  ANIME_GIRL: [
    { key: "anime-mika", label: "Mika" },
    { key: "anime-rin", label: "Rin" },
    { key: "anime-sora", label: "Sora" }
  ],
  SPIRIT: [
    { key: "spirit-wisp", label: "Wisp" },
    { key: "spirit-moon", label: "Moon" },
    { key: "spirit-shrine", label: "Shrine" }
  ],
  CUSTOM: [
    { key: "custom-signal", label: "Signal" },
    { key: "custom-aura", label: "Aura" },
    { key: "custom-mark", label: "Mark" }
  ]
};

const interestOptions = [
  "Sports",
  "Technology",
  "History",
  "Social Media",
  "Politics",
  "Movies",
  "Anime",
  "Gaming",
  "Music",
  "Fitness",
  "Travel",
  "Science"
];

export function OnboardingPage() {
  const { authenticated, ready, user } = usePrivy();
  const router = useRouter();
  const [name, setName] = useState("Nova");
  const [type, setType] = useState<CompanionType>("ROBOT");
  const [customTypeName, setCustomTypeName] = useState("");
  const [avatarKey, setAvatarKey] = useState("robot-core");
  const [avatarImage, setAvatarImage] = useState("");
  const [interests, setInterests] = useState<string[]>(["Technology", "Movies"]);
  const [customInterest, setCustomInterest] = useState("");
  const [agentTemplateId, setAgentTemplateId] = useState(defaultAgentTemplate.id);
  const [agentRole, setAgentRole] = useState(defaultAgentTemplate.role);
  const [agentMission, setAgentMission] = useState(defaultAgentTemplate.mission);
  const [agentScope, setAgentScope] = useState(defaultAgentTemplate.scope.join(", "));
  const [personalContextOpen, setPersonalContextOpen] = useState(true);
  const [agentValidation, setAgentValidation] = useState<AgentValidation | null>(null);
  const [validationBusy, setValidationBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const wallet = user?.wallet?.address?.toLowerCase() ?? "";
  const selectedAgentTemplate = agentTemplates.find((template) => template.id === agentTemplateId) ?? defaultAgentTemplate;
  const selectedTypeLabel = type === "CUSTOM" && customTypeName.trim() ? customTypeName.trim() : companionArchetypes[type].label;
  const canCreate = useMemo(() => {
    const interestsReady = agentTemplateId !== defaultAgentTemplate.id || interests.length > 0;
    const customAgentApproved = agentTemplateId !== "CUSTOM_AGENT" || agentValidation?.status === "APPROVED";
    return Boolean(name.trim() && interestsReady && customAgentApproved && agentRole.trim() && agentMission.trim() && agentScope.split(",").some((item) => item.trim()) && (type !== "CUSTOM" || customTypeName.trim()));
  }, [agentMission, agentRole, agentScope, agentTemplateId, agentValidation?.status, customTypeName, interests.length, name, type]);

  if (!ready) {
    return (
      <main className="grid min-h-screen place-items-center text-ink">
        <Loader2 className="h-7 w-7 animate-spin" />
      </main>
    );
  }

  if (!authenticated) return <StarterPage />;

  async function createCompanion() {
    if (!wallet) {
      setStatus("Your Privy account needs a wallet before creating a companion.");
      return;
    }

    setBusy(true);
    setStatus("");
    try {
      const response = await fetch("/api/companions", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-wallet-address": wallet
        },
        body: JSON.stringify({
          name,
          type,
          customTypeName,
          avatarKey: avatarImage ? "uploaded" : avatarKey,
          avatarImage: avatarImage || undefined,
          interests,
          agentProfile: {
            role: agentRole,
            templateId: agentTemplateId,
            mission: agentMission,
            scope: agentScope.split(",").map((item) => item.trim()).filter(Boolean),
            boundaries: agentTemplates.find((template) => template.id === agentTemplateId)?.boundaries ?? defaultAgentTemplate.boundaries,
            expertise: agentTemplates.find((template) => template.id === agentTemplateId)?.expertise ?? defaultAgentTemplate.expertise,
            successCriteria: agentTemplates.find((template) => template.id === agentTemplateId)?.successCriteria ?? defaultAgentTemplate.successCriteria,
            responseStyle: agentTemplates.find((template) => template.id === agentTemplateId)?.responseStyle ?? defaultAgentTemplate.responseStyle,
            validationStatus: agentValidation?.status,
            validationNotes: agentValidation?.reason
          },
          agentActions: agentTemplateId === "CUSTOM_AGENT" && agentValidation?.status === "APPROVED" ? agentValidation.suggestedActions : undefined
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Unable to create companion");
      router.replace("/");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to create companion");
    } finally {
      setBusy(false);
    }
  }

  function selectType(nextType: CompanionType) {
    setType(nextType);
    setAvatarKey(avatarOptions[nextType][0].key);
  }

  function selectAgentTemplate(templateId: string) {
    const template = agentTemplates.find((item) => item.id === templateId) ?? defaultAgentTemplate;
    setAgentTemplateId(template.id);
    setAgentRole(template.role);
    setAgentMission(template.mission);
    setAgentScope(template.scope.join(", "));
    setPersonalContextOpen(template.id === defaultAgentTemplate.id);
    setAgentValidation(null);
  }

  async function validateAgentDefinition() {
    setValidationBusy(true);
    try {
      const response = await fetch("/api/agent-validation", {
        method: "POST",
        headers: { "content-type": "application/json", "x-wallet-address": wallet },
        body: JSON.stringify({
          role: agentRole,
          mission: agentMission,
          scope: agentScope.split(",").map((item) => item.trim()).filter(Boolean),
          boundaries: selectedAgentTemplate.boundaries,
          expertise: selectedAgentTemplate.expertise,
          successCriteria: selectedAgentTemplate.successCriteria,
          responseStyle: selectedAgentTemplate.responseStyle
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Unable to validate agent");
      setAgentValidation(data.validation);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to validate agent");
    } finally {
      setValidationBusy(false);
    }
  }

  function applyValidationSuggestions() {
    if (!agentValidation) return;
    setAgentRole(agentValidation.suggestedRole);
    setAgentMission(agentValidation.suggestedMission);
    setAgentScope(agentValidation.suggestedScope.join(", "));
    setAgentValidation(null);
  }

  function toggleInterest(interest: string) {
    setInterests((current) => (current.includes(interest) ? current.filter((item) => item !== interest) : [...current, interest]));
  }

  function addCustomInterest() {
    const next = customInterest.trim();
    if (!next) return;
    setInterests((current) => (current.some((item) => item.toLowerCase() === next.toLowerCase()) ? current : [...current, next]));
    setCustomInterest("");
  }

  function uploadAvatar(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setStatus("Please upload an image file.");
      return;
    }
    if (file.size > 700_000) {
      setStatus("Please upload an avatar under 700 KB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setAvatarImage(String(reader.result ?? ""));
      setStatus("");
    };
    reader.readAsDataURL(file);
  }

  return (
    <main className="min-h-screen px-4 py-5 text-ink sm:px-6 lg:px-8">
      <section className="mx-auto grid max-w-6xl gap-5 lg:grid-cols-[360px_minmax(0,1fr)]">
        <aside className="rounded-lg border border-black/10 bg-white/80 p-5 shadow-sm">
          <div className="inline-flex h-11 w-11 items-center justify-center rounded-md bg-ember text-white">
            <Sparkles className="h-5 w-5" />
          </div>
          <h1 className="mt-4 text-3xl font-semibold">Create your companion</h1>
          <p className="mt-3 text-sm leading-6 text-black/62">
            Choose a type, upload or select an avatar, and seed the areas your companion should care about.
          </p>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="mt-5 w-full rounded-md border border-black/10 bg-white px-3 py-2"
            placeholder="Companion name"
          />
          <div className="mt-4 rounded-md bg-paper p-3 text-sm">
            <div className="text-xs uppercase text-black/45">Preview</div>
            <div className="mt-2 flex items-center gap-3">
              <AvatarPreview avatarImage={avatarImage} type={type} />
              <div>
                <div className="font-medium">{name || "Companion"}</div>
                <div className="text-black/55">{selectedTypeLabel}</div>
              </div>
            </div>
          </div>
          {status && <div className="mt-3 text-sm text-ember">{status}</div>}
          <button
            onClick={createCompanion}
            disabled={busy || !canCreate}
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-md bg-ink px-4 py-3 font-medium text-white disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            Start with {name || "companion"}
          </button>
        </aside>

        <div className="space-y-5">
          <section className="rounded-lg border border-black/10 bg-white/80 p-5 shadow-sm">
            <h2 className="text-lg font-semibold">Companion type</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {(Object.keys(companionArchetypes) as CompanionType[]).map((key) => (
                <button
                  key={key}
                  onClick={() => selectType(key)}
                  className={cn("rounded-md border p-4 text-left", type === key ? "border-ink bg-ink text-white" : "border-black/10 bg-white")}
                >
                  <TypeIcon type={key} />
                  <div className="mt-3 font-medium">{companionArchetypes[key].label}</div>
                  <div className={cn("mt-1 text-xs", type === key ? "text-white/70" : "text-black/55")}>{companionArchetypes[key].traits.slice(0, 3).join(", ")}</div>
                </button>
              ))}
            </div>
            {type === "CUSTOM" && (
              <input
                value={customTypeName}
                onChange={(event) => setCustomTypeName(event.target.value)}
                className="mt-4 w-full rounded-md border border-black/10 bg-white px-3 py-2"
                placeholder="Custom type, e.g. Study Coach, Meme Buddy, Trading Analyst"
              />
            )}
          </section>

          <section className="rounded-lg border border-black/10 bg-white/80 p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">Avatar</h2>
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-black/10 bg-white px-3 py-2 text-sm">
                <ImageUp className="h-4 w-4" />
                Upload avatar
                <input type="file" accept="image/*" onChange={uploadAvatar} className="hidden" />
              </label>
            </div>
            {avatarImage && (
              <button onClick={() => setAvatarImage("")} className="mt-3 rounded-md border border-black/10 bg-white px-3 py-2 text-sm text-black/65">
                Use preset avatar instead
              </button>
            )}
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              {avatarOptions[type].map((avatar) => (
                <button
                  key={avatar.key}
                  onClick={() => {
                    setAvatarKey(avatar.key);
                    setAvatarImage("");
                  }}
                  className={cn("avatar-stage rounded-md border p-4 text-center", !avatarImage && avatarKey === avatar.key ? "border-ember ring-2 ring-ember/20" : "border-black/10")}
                >
                  <div className="mx-auto grid h-24 w-24 place-items-center rounded-full text-white shadow-sm" style={{ backgroundColor: companionArchetypes[type].accent }}>
                    <TypeIcon type={type} large />
                  </div>
                  <div className="mt-3 font-medium">{avatar.label}</div>
                </button>
              ))}
            </div>
          </section>

          <details open={personalContextOpen} onToggle={(event) => setPersonalContextOpen(event.currentTarget.open)} className="rounded-lg border border-black/10 bg-white/80 shadow-sm">
            <summary className="flex cursor-pointer list-none items-center justify-between p-5">
              <div><h2 className="text-lg font-semibold">Personal context</h2><p className="mt-1 text-sm text-black/55">{agentTemplateId === defaultAgentTemplate.id ? "Your interests help shape everyday conversation." : "Optional interests that help this focused agent tailor its work."}</p></div>
              <span className="rounded-full bg-paper px-2 py-1 text-xs text-black/55">{interests.length} selected</span>
            </summary>
            <div className="border-t border-black/10 px-5 pb-5 pt-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-black/45">Suggested for {selectedAgentTemplate.label}</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {selectedAgentTemplate.suggestedInterests.map((interest) => (
                  <button key={interest} onClick={() => toggleInterest(interest)} className={cn("rounded-md border px-3 py-2 text-sm", interests.includes(interest) ? "border-mint bg-mint text-white" : "border-mint/30 bg-mint/5 text-black/70")}>
                    {interests.includes(interest) ? "✓ " : "+ "}{interest}
                  </button>
                ))}
              </div>
              <div className="mt-4 text-xs font-semibold uppercase tracking-wide text-black/45">More interests</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {interestOptions.filter((interest) => !selectedAgentTemplate.suggestedInterests.includes(interest)).map((interest) => (
                  <button key={interest} onClick={() => toggleInterest(interest)} className={cn("rounded-md border px-3 py-2 text-sm", interests.includes(interest) ? "border-mint bg-mint text-white" : "border-black/10 bg-white")}>
                    {interest}
                  </button>
                ))}
              </div>
              <div className="mt-4 flex gap-2">
                <input value={customInterest} onChange={(event) => setCustomInterest(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") addCustomInterest(); }} className="min-w-0 flex-1 rounded-md border border-black/10 bg-white px-3 py-2" placeholder="Add another interest" />
                <button onClick={addCustomInterest} className="rounded-md bg-mint px-3 py-2 text-white" aria-label="Add interest"><Plus className="h-4 w-4" /></button>
              </div>
              {interests.length > 0 && <div className="mt-3 flex flex-wrap gap-2">{interests.map((interest) => <button key={interest} onClick={() => toggleInterest(interest)} className="rounded-md bg-paper px-3 py-2 text-sm">{interest} ×</button>)}</div>}
            </div>
          </details>

          <section className="rounded-lg border border-black/10 bg-white/80 p-5 shadow-sm">
            <h2 className="text-lg font-semibold">Your companion's role</h2>
            <p className="mt-1 text-sm text-black/55">Choose a focused role, then tailor what this companion should help with.</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {agentTemplates.map((template) => (
                <button key={template.id} onClick={() => selectAgentTemplate(template.id)} className={cn("rounded-md border p-3 text-left text-sm", agentTemplateId === template.id ? "border-ink bg-ink text-white" : "border-black/10 bg-white")}>
                  <div className="font-medium">{template.label}</div>
                  <div className={cn("mt-1 text-xs", agentTemplateId === template.id ? "text-white/70" : "text-black/50")}>{template.scope.slice(0, 2).join(" · ")}</div>
                </button>
              ))}
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="text-sm font-medium">Role<input value={agentRole} onChange={(event) => { setAgentRole(event.target.value); setAgentValidation(null); }} className="mt-1.5 w-full rounded-md border border-black/10 bg-white px-3 py-2 font-normal" placeholder="e.g. Study coach" /></label>
              <label className="text-sm font-medium">Scope<input value={agentScope} onChange={(event) => { setAgentScope(event.target.value); setAgentValidation(null); }} className="mt-1.5 w-full rounded-md border border-black/10 bg-white px-3 py-2 font-normal" placeholder="Study plans, revision, explanations" /></label>
            </div>
            <label className="mt-3 block text-sm font-medium">Mission<textarea value={agentMission} onChange={(event) => { setAgentMission(event.target.value); setAgentValidation(null); }} className="mt-1.5 min-h-20 w-full rounded-md border border-black/10 bg-white px-3 py-2 font-normal" placeholder="What should this companion help you achieve?" /></label>
            {agentTemplateId === "CUSTOM_AGENT" && <div className="mt-4 rounded-lg bg-paper p-3">
              <div className="text-sm font-semibold">Validate custom agent</div>
              <p className="mt-1 text-xs leading-5 text-black/55">We check that the role, mission, and scope are focused and safe. Creative roles are welcome.</p>
              <button onClick={validateAgentDefinition} disabled={validationBusy || !agentRole.trim() || !agentMission.trim() || !agentScope.trim()} className="mt-3 inline-flex items-center gap-2 rounded-md bg-ink px-3 py-2 text-sm font-medium text-white disabled:opacity-50">{validationBusy && <Loader2 className="h-4 w-4 animate-spin" />} Validate agent design</button>
              {agentValidation && <div className={cn("mt-3 rounded-md p-3 text-sm", agentValidation.status === "APPROVED" ? "bg-mint/10 text-mint" : agentValidation.status === "BLOCKED" ? "bg-ember/10 text-ember" : "bg-white text-black/70")}>
                <div className="font-semibold">{agentValidation.status === "APPROVED" ? "Approved" : agentValidation.status === "BLOCKED" ? "Blocked" : "Needs refinement"}</div>
                <div className="mt-1">{agentValidation.reason}</div>
                {agentValidation.suggestedActions.length > 0 && <div className="mt-3 space-y-1.5"><div className="text-xs font-semibold uppercase tracking-wide opacity-70">Suggested workflows</div>{agentValidation.suggestedActions.map((action) => <div key={action.key} className="rounded-md bg-white/70 px-2.5 py-2 text-xs text-black/70"><span className="font-semibold text-ink">{action.label}</span><span className="ml-1">— {action.description}</span></div>)}</div>}
                {agentValidation.status === "NEEDS_REFINEMENT" && <button onClick={applyValidationSuggestions} className="mt-2 rounded-md border border-black/10 bg-white px-2 py-1.5 text-xs font-medium text-ink">Apply suggested role and scope</button>}
              </div>}
            </div>}
          </section>
        </div>
      </section>
    </main>
  );
}

function AvatarPreview({ avatarImage, type }: { avatarImage: string; type: CompanionType }) {
  if (avatarImage) {
    return <img src={avatarImage} alt="Uploaded avatar preview" className="h-16 w-16 rounded-full object-cover shadow-sm" />;
  }

  return (
    <div className="grid h-16 w-16 place-items-center rounded-full text-white shadow-sm" style={{ backgroundColor: companionArchetypes[type].accent }}>
      <TypeIcon type={type} large />
    </div>
  );
}

function TypeIcon({ type, large = false }: { type: CompanionType; large?: boolean }) {
  const className = large ? "h-9 w-9" : "h-5 w-5";
  if (type === "PET") return <Cat className={className} />;
  if (type === "ANIME_GIRL") return <UserRound className={className} />;
  if (type === "SPIRIT" || type === "CUSTOM") return <Sparkles className={className} />;
  return <Bot className={className} />;
}
