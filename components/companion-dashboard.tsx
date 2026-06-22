"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Archive, Bot, Brain, CircleUserRound, Heart, ImageUp, Loader2, MessageCircle, MessageSquarePlus, Pencil, Plus, Save, Sparkles, ThumbsDown, ThumbsUp, X } from "lucide-react";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { companionArchetypes, moodLabels, relationshipLabels } from "@/lib/companion/archetypes";
import { defaultAgentTemplate } from "@/lib/companion/agent-templates";
import { portraitDirections, selectPortraitState, type PortraitActivityState, type PortraitVisualState } from "@/lib/companion/portrait-state";
import type { StructuredResult } from "@/lib/companion/structured-output";
import { companionRegistryConfig, registerCompanionOnchain, updateCompanionArchiveOnchain } from "@/lib/blockchain/companion-registry";
import { cn } from "@/lib/ui";

type CompanionType = "ROBOT" | "PET" | "ANIME_GIRL" | "SPIRIT" | "CUSTOM";
type CompanionMood = "HAPPY" | "NEUTRAL" | "LONELY" | "EXCITED";
type AgentGoal = { id: string; title: string; status: "ACTIVE" | "PAUSED" | "COMPLETE"; priority: number; progress: number; nextStep?: string | null };
type AgentInsights = { role: string; mission: string; capabilities: string[]; learned: { id: string; category: string; content: string; importance: number }[]; feedback: { helpful: number; unhelpful: number; corrected: number } };
type WorkflowAction = { id: string; label: string; description: string; starterQuestion: string };
type ChainStatus = { registryConfigured: boolean; registryStatus: "READY" | "NOT_DEPLOYED" | "UNREACHABLE" | "NOT_CONFIGURED"; storageConfigured: boolean; archiveWorkerConfigured: boolean };
type ArchiveStatus = { snapshot?: { rootHash: string; snapshotVersion: number; anchoredAt?: string | null } | null; latestJob?: { status: string } | null };

type Companion = {
  id: string;
  blockchainId?: string | null;
  name: string;
  type: CompanionType;
  avatarKey: string;
  customTypeName?: string | null;
  avatarImage?: string | null;
  generatedPortrait?: string | null;
  portraitPrompt?: string | null;
  portraitVariants?: Partial<Record<PortraitVisualState, string>> | null;
  agentProfile?: { templateId?: string | null; role?: string | null; scope?: string[] | null } | null;
  level: number;
  mood: CompanionMood;
  relationshipLevel: number;
  trustScore: number;
  attachmentScore: number;
  evolutionStage: number;
  memories: { id: string; memoryType: string; content: string; importance: number }[];
  chatLogs: { id: string; userMessage: string; companionResponse: string; structuredOutput?: StructuredResult | null; createdAt: string }[];
};

export function CompanionDashboard() {
  const { logout, user } = usePrivy();
  const { wallets } = useWallets();
  const router = useRouter();
  const [companions, setCompanions] = useState<Companion[]>([]);
  const [activeId, setActiveId] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [portraitBusy, setPortraitBusy] = useState(false);
  const [portraitState, setPortraitState] = useState<PortraitVisualState>("supportive");
  const [portraitActivity, setPortraitActivity] = useState<PortraitActivityState>("idle");
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileEditing, setProfileEditing] = useState(false);
  const [profileName, setProfileName] = useState("");
  const [profileBusy, setProfileBusy] = useState(false);
  const [agentGoals, setAgentGoals] = useState<AgentGoal[]>([]);
  const [feedbackByChat, setFeedbackByChat] = useState<Record<string, "HELPFUL" | "UNHELPFUL" | "CORRECTED">>({});
  const [correctionChatId, setCorrectionChatId] = useState("");
  const [correctionNote, setCorrectionNote] = useState("");
  const [agentInsights, setAgentInsights] = useState<AgentInsights | null>(null);
  const [workflowActions, setWorkflowActions] = useState<WorkflowAction[]>([]);
  const [workflowBusy, setWorkflowBusy] = useState(false);
  const [chainStatus, setChainStatus] = useState<ChainStatus | null>(null);
  const [archiveStatus, setArchiveStatus] = useState<ArchiveStatus | null>(null);
  const wallet = user?.wallet?.address?.toLowerCase() ?? "";

  const active = companions.find((companion) => companion.id === activeId) ?? companions[0];
  const archetype = active ? companionArchetypes[active.type] : companionArchetypes.ROBOT;
  const activeTypeLabel = active?.customTypeName || archetype.label;
  const agentActionLabel = active?.agentProfile?.role || defaultAgentTemplate.label;
  const browserRegistryConfig = companionRegistryConfig();
  const messages = useMemo(() => [...(active?.chatLogs ?? [])].reverse(), [active?.chatLogs]);
  const latestChat = active?.chatLogs?.[0];
  const recentTopic = conversationTopic(latestChat?.userMessage);
  const currentAgentGoal = agentGoals.find((goal) => goal.status === "ACTIVE");

  useEffect(() => {
    const latest = active?.chatLogs?.[0];
    setPortraitState(latest ? selectPortraitState(latest.userMessage, latest.companionResponse) : "supportive");
    setPortraitActivity("idle");
  }, [active?.id]);

  useEffect(() => {
    if (active?.id && wallet) {
      void loadAgentGoals(active.id);
      void loadAgentInsights(active.id);
      void loadWorkflowActions(active.id);
      void loadArchiveStatus(active.id);
    } else {
      setAgentGoals([]);
      setAgentInsights(null);
      setWorkflowActions([]);
      setArchiveStatus(null);
    }
  }, [active?.id, wallet]);

  useEffect(() => {
    void loadChainStatus();
  }, []);

  useEffect(() => {
    const registrationNotice = window.sessionStorage.getItem("mymate:onchain-registration-notice");
    if (!registrationNotice) return;
    window.sessionStorage.removeItem("mymate:onchain-registration-notice");
    setStatus(registrationNotice);
  }, []);

  useEffect(() => {
    if (wallet) {
      void loadCompanions(wallet);
      void loadProfile();
    }
  }, [wallet]);

  async function request<T>(url: string, init?: RequestInit): Promise<T> {
    const response = await fetch(url, {
      ...init,
      headers: {
        "content-type": "application/json",
        "x-wallet-address": wallet,
        ...(init?.headers ?? {})
      }
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error ?? "Request failed");
    return data;
  }

  async function loadCompanions(address = wallet) {
    if (!address) return;
    const data = await fetch("/api/companions", { headers: { "x-wallet-address": address } }).then((res) => res.json());
    const loaded = data.companions ?? [];
    setCompanions(loaded);
    setActiveId(loaded[0]?.id ?? "");
    if (loaded.length === 0) router.replace("/onboarding");
  }

  async function loadProfile() {
    try {
      const data = await fetch("/api/profile", { headers: { "x-wallet-address": wallet } }).then((response) => response.json());
      if (data.profile?.username) setProfileName(data.profile.username);
    } catch {
      // A profile is created during onboarding, so the dashboard can still work while it is unavailable.
    }
  }

  async function loadAgentGoals(companionId: string) {
    try {
      const data = await fetch(`/api/companions/${companionId}/goals`, { headers: { "x-wallet-address": wallet } }).then((response) => response.json());
      const projectGoals = (data.projects ?? []).flatMap((project: { goals?: AgentGoal[] }) => project.goals ?? []);
      setAgentGoals([...(data.goals ?? []), ...projectGoals]);
    } catch {
      setAgentGoals([]);
    }
  }

  async function loadAgentInsights(companionId: string) {
    try {
      const data = await fetch(`/api/companions/${companionId}/insights`, { headers: { "x-wallet-address": wallet } }).then((response) => response.json());
      setAgentInsights(data.insights ?? null);
    } catch {
      setAgentInsights(null);
    }
  }

  async function loadWorkflowActions(companionId: string) {
    try {
      const data = await fetch(`/api/companions/${companionId}/actions`, { headers: { "x-wallet-address": wallet } }).then((response) => response.json());
      setWorkflowActions(data.actions ?? []);
    } catch {
      setWorkflowActions([]);
    }
  }

  async function loadArchiveStatus(companionId: string) {
    try {
      const data = await fetch(`/api/companions/${companionId}/archive`, { headers: { "x-wallet-address": wallet } }).then((response) => response.json());
      setArchiveStatus(data);
    } catch {
      setArchiveStatus(null);
    }
  }

  async function loadChainStatus() {
    try {
      const data = await fetch("/api/chain-status").then((response) => response.json());
      setChainStatus(data);
    } catch {
      setChainStatus(null);
    }
  }

  async function startWorkflow(action: WorkflowAction) {
    if (!active) return;
    setWorkflowBusy(true);
    setPortraitActivity("thinking");
    try {
      const data = await request<{ companion: Companion; response: string }>(`/api/companions/${active.id}/actions`, {
        method: "POST",
        body: JSON.stringify({ actionId: action.id })
      });
      replaceCompanion(data.companion);
      setPortraitActivity("replying");
      window.setTimeout(() => setPortraitActivity("idle"), 1200);
      setStatus(`${action.label} started`);
      window.setTimeout(() => document.getElementById("companion-chat")?.scrollIntoView({ behavior: "smooth", block: "end" }), 50);
    } catch (error) {
      setPortraitActivity("idle");
      setStatus(error instanceof Error ? error.message : "Unable to start workflow");
    } finally {
      setWorkflowBusy(false);
    }
  }

  async function regenerateWorkflowActions() {
    if (!active) return;
    setWorkflowBusy(true);
    try {
      const data = await request<{ actions: WorkflowAction[] }>(`/api/companions/${active.id}/actions/regenerate`, { method: "POST" });
      setWorkflowActions(data.actions);
      setStatus("Role-specific workflows regenerated");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to regenerate workflows");
    } finally {
      setWorkflowBusy(false);
    }
  }

  async function registerActiveCompanionOnchain() {
    if (!active || !companionRegistryConfig()) return;
    const signingWallet = wallets.find((candidate) => candidate.address.toLowerCase() === wallet);
    if (!signingWallet) {
      setStatus("Your connected wallet is unavailable for 0G registration");
      return;
    }
    setBusy(true);
    try {
      const provider = await signingWallet.getEthereumProvider();
      const registration = await registerCompanionOnchain(provider, active.customTypeName || activeTypeLabel);
      const data = await request<{ companion: { blockchainId: string } }>(`/api/companions/${active.id}/chain`, { method: "PATCH", body: JSON.stringify({ blockchainId: registration.companionId }) });
      setCompanions((current) => current.map((companion) => companion.id === active.id ? { ...companion, blockchainId: data.companion.blockchainId } : companion));
      setStatus("Companion ownership registered on 0G mainnet");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to register companion on 0G mainnet");
    } finally {
      setBusy(false);
    }
  }

  async function syncLatestArchiveOnchain() {
    if (!active?.blockchainId || !companionRegistryConfig()) return;
    const signingWallet = wallets.find((candidate) => candidate.address.toLowerCase() === wallet);
    if (!signingWallet) {
      setStatus("Your connected wallet is unavailable for archive sync");
      return;
    }
    setBusy(true);
    try {
      const archiveResponse = await fetch(`/api/companions/${active.id}/archive`, { headers: { "x-wallet-address": wallet } });
      const archiveData = await archiveResponse.json();
      if (!archiveResponse.ok) throw new Error(archiveData.error ?? "Unable to load latest archive");
      if (!archiveData.snapshot) throw new Error("No encrypted archive exists yet. Create or wait for an archive first.");
      if (archiveData.snapshot.anchoredAt) {
        setStatus("The latest encrypted archive is already anchored on 0G mainnet");
        return;
      }
      const provider = await signingWallet.getEthereumProvider();
      const transaction = await updateCompanionArchiveOnchain(provider, active.blockchainId, archiveData.snapshot.rootHash, archiveData.snapshot.snapshotVersion);
      await request(`/api/companions/${active.id}/archive`, {
        method: "PATCH",
        body: JSON.stringify({ snapshotVersion: archiveData.snapshot.snapshotVersion, transactionHash: transaction.transactionHash })
      });
      await loadArchiveStatus(active.id);
      setStatus("Latest encrypted archive anchored on 0G mainnet");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to sync archive to 0G mainnet");
    } finally {
      setBusy(false);
    }
  }

  async function saveProfile() {
    if (profileName.trim().length < 2) {
      setStatus("Profile name must be at least 2 characters");
      return;
    }
    setProfileBusy(true);
    try {
      await request<{ profile: { username: string } }>("/api/profile", {
        method: "PATCH",
        body: JSON.stringify({ username: profileName.trim() })
      });
      setProfileEditing(false);
      setStatus("Profile saved");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to save profile");
    } finally {
      setProfileBusy(false);
    }
  }

  async function sendFeedback(chatId: string, rating: "HELPFUL" | "UNHELPFUL" | "CORRECTED", note?: string) {
    if (!active) return;
    try {
      await request(`/api/companions/${active.id}/feedback`, {
        method: "POST",
        body: JSON.stringify({ chatId, rating, note })
      });
      setFeedbackByChat((current) => ({ ...current, [chatId]: rating }));
      setCorrectionChatId("");
      setCorrectionNote("");
      setStatus(rating === "HELPFUL" ? "Feedback saved — this was helpful" : "Feedback saved — your companion will adapt");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to save feedback");
    }
  }

  async function sendMessage() {
    if (!active || !message.trim()) return;
    const userMessage = message;
    setMessage("");
    setBusy(true);
    setPortraitActivity("listening");
    setPortraitState(selectPortraitState(userMessage));
    try {
      setPortraitActivity("thinking");
      const data = await request<{ companion: Companion; response: string; memoriesCreated: number; portraitState: PortraitVisualState; workflowCompleted?: boolean; workflowOutcome?: string | null }>(`/api/companions/${active.id}/chat`, {
        method: "POST",
        body: JSON.stringify({ message: userMessage })
      });
      replaceCompanion(data.companion);
      setPortraitState(data.portraitState);
      setPortraitActivity("replying");
      window.setTimeout(() => setPortraitActivity("idle"), 1200);
      setStatus(data.workflowCompleted ? "Workflow completed and outcome saved" : data.memoriesCreated ? `Saved ${data.memoriesCreated} new memory` : "Conversation saved");
    } catch (error) {
      setPortraitActivity("idle");
      setStatus(error instanceof Error ? error.message : "Chat failed");
    } finally {
      setBusy(false);
    }
  }

  async function generatePortrait() {
    if (!active) return;
    setPortraitBusy(true);
    try {
      const data = await request<{ companion: Companion; provider: string }>(`/api/companions/${active.id}/portrait`, { method: "POST" });
      replaceCompanion(data.companion);
      setStatus(data.provider === "fallback" ? "Portrait preview set saved from local fallback" : "Generated five living portrait scenes");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Portrait generation failed");
    } finally {
      setPortraitBusy(false);
    }
  }

  async function createSnapshot() {
    if (!active) return;
    setBusy(true);
    try {
      const data = await request<{ upload: { rootHash: string; provider: string } }>(`/api/companions/${active.id}/snapshots`, { method: "POST" });
      await loadArchiveStatus(active.id);
      setStatus(`Memory snapshot archived: ${data.upload.rootHash.slice(0, 18)}...`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Snapshot failed");
    } finally {
      setBusy(false);
    }
  }

  function replaceCompanion(companion: Companion) {
    setCompanions((current) => current.map((item) => (item.id === companion.id ? companion : item)));
  }

  return (
    <main className="min-h-screen px-4 py-6 text-ink sm:px-6 lg:px-8">
      <header className="relative z-50 mx-auto mb-5 flex max-w-[1440px] flex-wrap items-center justify-between gap-3 rounded-2xl bg-white/80 px-4 py-3 shadow-[0_8px_28px_rgba(20,21,26,0.06)] backdrop-blur sm:px-5">
        <div className="flex min-w-0 items-center gap-4">
          <div className="shrink-0">
            <div className="text-xl font-semibold tracking-tight">MyMate</div>
            <div className="text-xs text-black/50">Your companion space</div>
          </div>
          <div className="hidden h-8 w-px bg-black/10 sm:block" />
          <label className="min-w-0 sm:w-52">
            <span className="sr-only">Active companion</span>
            <select value={active?.id ?? ""} onChange={(event) => setActiveId(event.target.value)} className="w-full truncate rounded-lg border border-black/10 bg-paper px-3 py-2 text-sm font-medium outline-none focus:ring-2 focus:ring-ember/20" disabled={companions.length === 0}>
              {companions.length === 0 ? <option>Choose a companion</option> : companions.map((companion) => <option key={companion.id} value={companion.id}>{companion.name}</option>)}
            </select>
          </label>
        </div>
        <div className="flex items-center gap-2">
          {active && <button onClick={() => { document.getElementById("companion-chat")?.scrollIntoView({ behavior: "smooth", block: "end" }); window.setTimeout(() => document.getElementById("companion-message")?.focus(), 350); }} className="flex items-center gap-2 rounded-lg bg-ink px-3 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-black"><MessageCircle className="h-4 w-4" /><span>Chat with <span className="hidden sm:inline">{active.name}</span><span className="sm:hidden">companion</span></span></button>}
          {active && <div className="flex items-center rounded-lg border border-black/10 bg-white p-1 shadow-sm">
            <button onClick={generatePortrait} disabled={portraitBusy} className="rounded-md p-1.5 text-black/60 transition-colors hover:bg-paper hover:text-ink disabled:opacity-50" aria-label="Generate portrait set" title="Generate portrait set">{portraitBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageUp className="h-4 w-4" />}</button>
            <button onClick={createSnapshot} className="rounded-md p-1.5 text-black/60 transition-colors hover:bg-paper hover:text-ink" aria-label="Create snapshot" title="Create snapshot"><Archive className="h-4 w-4" /></button>
          </div>}
        <div className="relative">
          <button onClick={() => setProfileOpen((open) => !open)} className="grid h-11 w-11 place-items-center rounded-full border border-black/10 bg-white text-ink shadow-md transition-transform hover:scale-105" aria-label="Open profile menu" aria-expanded={profileOpen}>
            <CircleUserRound className="h-6 w-6" />
          </button>
          {profileOpen && (
            <div className="absolute right-0 top-14 z-[60] w-80 overflow-hidden rounded-2xl border border-black/10 bg-white shadow-xl">
              <div className="bg-paper px-4 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-ink text-base font-semibold text-white">
                      {(profileName || "Y").slice(0, 1).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="truncate font-semibold">{profileName || "Your profile"}</div>
                      <div className="text-xs text-black/50">MyMate account</div>
                    </div>
                  </div>
                  <button onClick={() => setProfileOpen(false)} className="rounded-md p-1.5 text-black/45 hover:bg-white" aria-label="Close profile menu"><X className="h-4 w-4" /></button>
                </div>
              </div>
              <div className="space-y-4 p-4">
                <div>
                  <div className="mb-1.5 flex items-center justify-between">
                    <label className="text-xs font-semibold uppercase tracking-wide text-black/45">Display name</label>
                    {!profileEditing && <button onClick={() => setProfileEditing(true)} className="flex items-center gap-1 text-xs font-medium text-ink hover:text-ember"><Pencil className="h-3.5 w-3.5" /> Edit</button>}
                  </div>
                  {profileEditing ? (
                    <input value={profileName} onChange={(event) => setProfileName(event.target.value)} className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm outline-none ring-ember/20 focus:ring-2" placeholder="Your name" autoFocus />
                  ) : (
                    <div className="rounded-lg border border-black/10 bg-white px-3 py-2 text-sm">{profileName || "Add your name"}</div>
                  )}
                </div>
                <div>
                  <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-black/45">Wallet</div>
                  <div className="truncate rounded-lg border border-black/10 bg-white px-3 py-2 font-mono text-xs text-black/60">{wallet}</div>
                </div>
                <div className="rounded-lg bg-paper p-3 text-xs">
                  <div className="flex items-center justify-between"><span className="font-semibold text-black/65">0G status</span><span className={cn("rounded-full px-2 py-0.5", chainStatus?.registryStatus === "READY" ? "bg-mint/15 text-mint" : "bg-white text-black/50")}>{chainStatus?.registryStatus === "READY" ? "Ready" : "Setup needed"}</span></div>
                  <div className="mt-2 space-y-1 text-black/55">
                    <div>Registry: {active?.blockchainId ? `Companion #${active.blockchainId}` : "Not registered"}</div>
                    {!active?.blockchainId && <div>Browser registration: {browserRegistryConfig ? "Available" : "Restart needed after public 0G configuration"}</div>}
                    <div>Archive: {archiveStatus?.snapshot ? `v${archiveStatus.snapshot.snapshotVersion}${archiveStatus.snapshot.anchoredAt ? " · anchored" : " · not anchored"}` : archiveStatus?.latestJob ? `Queued (${archiveStatus.latestJob.status.toLowerCase()})` : "None yet"}</div>
                    <div>Storage: {chainStatus?.storageConfigured ? "0G configured" : "Local fallback"}</div>
                  </div>
                </div>
                {profileEditing && <button onClick={saveProfile} disabled={profileBusy} className="flex w-full items-center justify-center gap-2 rounded-lg bg-ink px-3 py-2.5 text-sm font-medium text-white disabled:opacity-50"><Save className="h-4 w-4" /> Save changes</button>}
                <button onClick={() => { setProfileOpen(false); router.push("/onboarding"); }} className="flex w-full items-center justify-center gap-2 rounded-lg border border-black/10 bg-white px-3 py-2.5 text-sm font-medium hover:bg-paper"><Plus className="h-4 w-4" /> Add companion</button>
                {active && !active.blockchainId && <button onClick={() => void registerActiveCompanionOnchain()} disabled={busy || !browserRegistryConfig} title={browserRegistryConfig ? undefined : "Restart the app after setting NEXT_PUBLIC_COMPANION_REGISTRY_ADDRESS and NEXT_PUBLIC_ZERO_G_CHAIN_ID"} className="w-full rounded-lg border border-black/10 bg-white px-3 py-2.5 text-sm font-medium hover:bg-paper disabled:cursor-not-allowed disabled:opacity-50">{browserRegistryConfig ? `Register ${active.name} on 0G` : "Register on 0G (restart required)"}</button>}
                {active?.blockchainId && browserRegistryConfig && <button onClick={() => void syncLatestArchiveOnchain()} disabled={busy} className="w-full rounded-lg border border-black/10 bg-white px-3 py-2.5 text-sm font-medium hover:bg-paper disabled:opacity-50">Sync latest archive to 0G</button>}
                <button onClick={logout} className="w-full rounded-lg px-3 py-2 text-sm text-black/55 hover:bg-paper hover:text-ink">Log out</button>
              </div>
            </div>
          )}
        </div>
        </div>
      </header>
      <section className="mx-auto grid max-w-[1440px] gap-5 lg:grid-cols-[220px_minmax(0,1fr)_300px]">
        <aside className="h-fit self-start rounded-xl bg-white/72 p-3 shadow-[0_8px_28px_rgba(20,21,26,0.05)] lg:sticky lg:top-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold">Companions</h2>
              <p className="text-xs text-black/55">Your shared space</p>
            </div>
            <span className="rounded-full bg-paper px-2 py-1 text-xs font-medium text-black/55">{companions.length}</span>
          </div>

          <div className="mt-4">
            <div className="space-y-1.5">
            {companions.map((companion) => (
              <button key={companion.id} onClick={() => setActiveId(companion.id)} className={cn("flex w-full items-center gap-2 rounded-lg p-2 text-left transition-colors", active?.id === companion.id ? "bg-paper shadow-sm" : "hover:bg-white")}>
                <MessageAvatar label={companion.name} image={companion.generatedPortrait || companion.avatarImage} kind="companion" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">{companion.name}</div>
                  <div className="truncate text-xs text-black/50">{companion.agentProfile?.role || "Personal AI companion"}</div>
                </div>
                {active?.id === companion.id && <span className="h-2 w-2 shrink-0 rounded-full bg-mint" aria-label="Active companion" />}
              </button>
            ))}
            </div>
          </div>
        </aside>

        <section className="overflow-hidden rounded-xl bg-white/82 shadow-[0_10px_32px_rgba(20,21,26,0.06)]">
          <div className="avatar-stage border-b border-black/10 p-5 sm:p-6">
            <div className="grid items-start gap-5 md:grid-cols-[minmax(0,1.2fr)_300px] md:gap-7">
              <div className="mx-auto grid w-full max-w-[430px] place-items-end md:mx-0">
                <CompanionPortrait companion={active} accent={archetype.accent} fallbackLabel={active?.avatarKey ?? (active?.evolutionStage === 2 ? archetype.stageTwoAvatar : archetype.stageOneAvatar)} visualState={portraitState} activityState={portraitActivity} />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-semibold uppercase tracking-wide text-black/45">{activeTypeLabel}</div>
                <h2 className="mt-1 truncate text-3xl font-semibold tracking-tight">{active?.name ?? "Choose a companion"}</h2>
                <p className="mt-2 text-sm leading-6 text-black/60">{archetype.evolution}</p>
                <div className="mt-3 rounded-xl bg-white/65 p-3 shadow-sm">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-black/45">Right now</div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-xs font-medium text-black/65"><Sparkles className="h-3.5 w-3.5 text-ember" /> Feeling {portraitDirections[portraitState].label.toLowerCase()}</span>
                    <span className="inline-flex max-w-full items-center gap-1.5 truncate rounded-full bg-white px-2.5 py-1 text-xs font-medium text-black/65"><MessageCircle className="h-3.5 w-3.5 text-mint" /> Last discussed: {recentTopic}</span>
                  </div>
                  {currentAgentGoal && <div className="mt-3 rounded-lg bg-white/80 p-2.5">
                    <div className="flex items-center justify-between gap-3"><span className="text-xs font-semibold text-black/55">Current focus</span><span className="text-xs font-medium text-ember">{currentAgentGoal.progress}%</span></div>
                    <div className="mt-1 truncate text-sm font-semibold">{currentAgentGoal.title}</div>
                    {currentAgentGoal.nextStep && <div className="mt-1 text-xs text-black/55">Next: {currentAgentGoal.nextStep}</div>}
                  </div>}
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <div className="rounded-xl bg-white/80 p-3 shadow-sm">
                    <div className="text-xs text-black/45">Mood</div>
                    <div className="mt-1 text-sm font-semibold">{moodLabels[active?.mood ?? "NEUTRAL"]}</div>
                  </div>
                  <div className="rounded-xl bg-white/80 p-3 shadow-sm">
                    <div className="text-xs text-black/45">Relationship</div>
                    <div className="mt-1 text-sm font-semibold">{relationshipLabels[active?.relationshipLevel ?? 1]}</div>
                  </div>
                </div>
                <div className="mt-2 rounded-xl bg-white/80 p-3 shadow-sm">
                  <div className="flex items-center justify-between text-xs text-black/50"><span>Relationship growth</span><span>{active?.trustScore ?? 0}% trust</span></div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-black/[0.08]"><div className="h-full rounded-full bg-mint transition-all" style={{ width: `${Math.min(100, active?.trustScore ?? 0)}%` }} /></div>
                  <div className="mt-1.5 text-xs text-black/45">Grows through useful conversations and completed workflows</div>
                </div>
                {workflowActions.length > 0 && <div className="mt-2 flex gap-2">
                  {workflowActions.slice(0, 2).map((action) => <button key={action.id} onClick={() => void startWorkflow(action)} disabled={!active || workflowBusy} className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-black/10 bg-white px-2 py-2 text-sm font-medium disabled:opacity-50"><Sparkles className="h-4 w-4" /> {action.label}</button>)}
                </div>}
              </div>
            </div>
          </div>

          <div className="bg-paper/45 p-4 sm:p-5">
            <section className="overflow-hidden rounded-xl bg-white/90 shadow-[0_6px_20px_rgba(20,21,26,0.05)]">
              <div className="flex items-center justify-between border-b border-black/10 px-4 py-3">
                <div>
                  <h3 className="text-sm font-semibold">Conversation</h3>
                  <p className="text-xs text-black/50">Chatting with {active?.name ?? "your companion"}</p>
                </div>
                <div className="rounded-full bg-paper px-2.5 py-1 text-xs font-medium text-black/55 capitalize">{portraitActivity}</div>
              </div>
          <div className="h-[240px] space-y-3 overflow-y-auto p-4 sm:p-5 lg:h-[260px]">
            {messages.length === 0 && <p className="text-sm text-black/55">Start a conversation. Your companion will save meaningful memories as you talk.</p>}
            {messages.map((chat) => (
              <div key={chat.id} className="space-y-2">
                <div className="flex items-start justify-end gap-2">
                  <div className="chat-bubble chat-bubble--user max-w-[78%] rounded-lg bg-ink px-3 py-2 text-sm text-white">
                    {chat.userMessage}
                  </div>
                  <MessageAvatar label={profileName || "You"} kind="user" />
                </div>
                <div className="flex items-start gap-2">
                  <MessageAvatar label={active?.name ?? "Companion"} image={active?.generatedPortrait || active?.avatarImage} kind="companion" />
                  <div className="chat-bubble chat-bubble--companion max-w-[78%] rounded-lg bg-paper px-3 py-2 text-sm">
                    {chat.companionResponse}
                    {feedbackByChat[chat.id] ? (
                      <div className="mt-2 text-xs text-black/45">Feedback: {feedbackByChat[chat.id].toLowerCase()}</div>
                    ) : correctionChatId === chat.id ? (
                      <div className="mt-3 flex gap-2">
                        <input value={correctionNote} onChange={(event) => setCorrectionNote(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && correctionNote.trim().length >= 2) void sendFeedback(chat.id, "CORRECTED", correctionNote.trim()); }} className="min-w-0 flex-1 rounded-md border border-black/10 bg-white px-2 py-1.5 text-xs" placeholder="What should be corrected?" autoFocus />
                        <button onClick={() => void sendFeedback(chat.id, "CORRECTED", correctionNote.trim())} disabled={correctionNote.trim().length < 2} className="rounded-md bg-ink px-2 text-xs text-white disabled:opacity-50">Save</button>
                      </div>
                    ) : (
                      <div className="mt-2 flex items-center gap-1">
                        <button onClick={() => void sendFeedback(chat.id, "HELPFUL")} className="rounded p-1 text-black/40 transition-colors hover:bg-white hover:text-mint" title="Helpful" aria-label="Mark response helpful"><ThumbsUp className="h-3.5 w-3.5" /></button>
                        <button onClick={() => void sendFeedback(chat.id, "UNHELPFUL")} className="rounded p-1 text-black/40 transition-colors hover:bg-white hover:text-ember" title="Not helpful" aria-label="Mark response unhelpful"><ThumbsDown className="h-3.5 w-3.5" /></button>
                        <button onClick={() => setCorrectionChatId(chat.id)} className="rounded p-1 text-black/40 transition-colors hover:bg-white hover:text-ink" title="Correct response" aria-label="Correct response"><MessageSquarePlus className="h-3.5 w-3.5" /></button>
                      </div>
                    )}
                  </div>
                </div>
                {chat.structuredOutput && <StructuredResultCard result={chat.structuredOutput} onFollowUp={(followUp) => setMessage(followUp)} />}
              </div>
            ))}
          </div>

          <div id="companion-chat" className="border-t border-black/10 bg-white/90 p-4">
            <div className="flex gap-2">
              <input id="companion-message" value={message} onChange={(event) => setMessage(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void sendMessage(); }} className="min-w-0 flex-1 rounded-md border border-black/10 bg-white px-3 py-2" placeholder="Tell your companion something..." />
              <button onClick={sendMessage} disabled={!active || busy} className="rounded-md bg-mint px-4 py-2 font-medium text-white disabled:opacity-50">
                <MessageCircle className="h-4 w-4" />
              </button>
            </div>
            {status && <div className="mt-2 text-sm text-black/60">{status}</div>}
          </div>
            </section>
          </div>
        </section>

        <aside className="space-y-4 lg:sticky lg:top-5 lg:h-fit">
          <div className="rounded-xl bg-white/72 p-4 shadow-[0_8px_28px_rgba(20,21,26,0.05)]">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Growth</h3>
              <span className="rounded-full bg-paper px-2 py-1 text-xs font-medium">{relationshipLabels[active?.relationshipLevel ?? 1]}</span>
            </div>
            <div className="mt-4 flex items-end justify-between">
              <div><div className="text-2xl font-semibold">{active?.trustScore ?? 0}%</div><div className="text-xs text-black/50">Trust</div></div>
              <div className="text-right"><div className="text-sm font-semibold">{active?.attachmentScore ?? 0}%</div><div className="text-xs text-black/50">Connection</div></div>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-black/[0.08]"><div className="h-full rounded-full bg-mint" style={{ width: `${Math.min(100, active?.trustScore ?? 0)}%` }} /></div>
            <div className="mt-4 grid grid-cols-2 gap-2 border-t border-black/10 pt-3 text-sm">
              <div><div className="text-xs text-black/45">Trust</div><div className="mt-1 font-semibold">{active?.trustScore ?? 0}</div></div>
              <div><div className="text-xs text-black/45">Evolution</div><div className="mt-1 font-semibold">Stage {active?.evolutionStage ?? 1}</div></div>
            </div>
          </div>

          <div className="rounded-xl bg-white/72 p-4 shadow-[0_8px_28px_rgba(20,21,26,0.05)]">
            <div className="flex items-center justify-between gap-2"><h3 className="font-semibold">Agent actions</h3><button onClick={() => void regenerateWorkflowActions()} disabled={!active || workflowBusy} className="text-xs font-medium text-black/50 hover:text-ink disabled:opacity-50" title="Regenerate workflows for this role">Regenerate</button></div>
            <div className="mt-0.5 text-xs text-black/45">{agentActionLabel}</div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {workflowActions.map((action) => <button key={action.id} onClick={() => void startWorkflow(action)} disabled={!active || workflowBusy} className="rounded-lg border border-black/10 bg-white p-3 text-left text-sm transition-colors hover:bg-paper disabled:opacity-50">
                <div className="flex items-center gap-2 font-medium"><Sparkles className="h-4 w-4 shrink-0 text-ember" /> {action.label}</div>
                <div className="mt-1 text-xs leading-4 text-black/50">{action.description}</div>
              </button>)}
            </div>
            {workflowActions.length === 0 && <p className="mt-3 text-sm text-black/50">Loading workflows…</p>}
          </div>

          <div className="rounded-xl bg-white/72 p-4 shadow-[0_8px_28px_rgba(20,21,26,0.05)]">
            <div className="flex items-center justify-between"><h3 className="flex items-center gap-2 font-semibold"><Heart className="h-4 w-4" /> Recent memories</h3><span className="text-xs text-black/45">{active?.memories.length ?? 0}</span></div>
            <div className="mt-3 space-y-2">
              {(active?.memories ?? []).length === 0 && <p className="text-sm text-black/55">No long-term memories yet.</p>}
              {(active?.memories ?? []).slice(0, 3).map((memory) => (
                <div key={memory.id} className="rounded-lg bg-paper p-2.5 text-sm">
                  <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-black/45">{memory.memoryType}</div>
                  {memory.content}
                </div>
              ))}
            </div>
          </div>
          {agentInsights && <details className="group lg:contents">
            <summary className="flex cursor-pointer list-none items-center justify-between rounded-xl bg-white/72 px-4 py-3 font-semibold shadow-[0_8px_28px_rgba(20,21,26,0.05)] lg:hidden">
              <span className="flex items-center gap-2"><Brain className="h-4 w-4" /> Agent learning</span><span className="text-xs font-normal text-black/45">{agentInsights.learned.length}</span>
            </summary>
            <div className="mobile-collapsible mt-2 hidden lg:mt-0 lg:block">
              <div className="rounded-xl bg-white/72 p-4 shadow-[0_8px_28px_rgba(20,21,26,0.05)]">
                <div className="flex items-center justify-between"><h3 className="flex items-center gap-2 font-semibold"><Brain className="h-4 w-4" /> Agent learning</h3><span className="text-xs text-black/45">Context, not retraining</span></div>
                <div className="mt-2 text-xs text-black/55">{agentInsights.role}</div>
                {agentInsights.capabilities.length > 0 && <div className="mt-2 flex flex-wrap gap-1.5">{agentInsights.capabilities.slice(0, 3).map((capability) => <span key={capability} className="rounded-full bg-paper px-2 py-1 text-[11px] text-black/60">{capability}</span>)}</div>}
                <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="rounded-lg bg-paper p-2"><div className="text-sm font-semibold">{agentInsights.feedback.helpful}</div><div className="mt-0.5 text-black/45">Helpful</div></div>
                  <div className="rounded-lg bg-paper p-2"><div className="text-sm font-semibold">{agentInsights.feedback.unhelpful}</div><div className="mt-0.5 text-black/45">Unhelpful</div></div>
                  <div className="rounded-lg bg-paper p-2"><div className="text-sm font-semibold">{agentInsights.feedback.corrected}</div><div className="mt-0.5 text-black/45">Corrected</div></div>
                </div>
                {agentInsights.learned.length > 0 && <div className="mt-3 space-y-2">{agentInsights.learned.slice(0, 3).map((memory) => <div key={memory.id} className="rounded-lg bg-paper p-2 text-xs"><div className="mb-1 font-medium uppercase tracking-wide text-black/45">{memory.category}</div><div className="max-h-10 overflow-hidden text-black/65">{memory.content}</div></div>)}</div>}
              </div>
            </div>
          </details>}
        </aside>
      </section>
    </main>
  );
}

function MessageAvatar({ label, image, kind }: { label: string; image?: string | null; kind: "user" | "companion" }) {
  if (image) {
    return <img src={image} alt={`${label} avatar`} className="mt-0.5 h-8 w-8 shrink-0 rounded-full border-2 border-white object-cover shadow-sm" />;
  }

  return (
    <div className={cn("mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full border-2 border-white text-xs font-semibold text-white shadow-sm", kind === "user" ? "bg-ember" : "bg-mint")} aria-label={`${label} avatar`} title={label}>
      {kind === "user" ? label.slice(0, 1).toUpperCase() : <Bot className="h-4 w-4" />}
    </div>
  );
}

function StructuredResultCard({ result, onFollowUp }: { result: StructuredResult; onFollowUp: (followUp: string) => void }) {
  return (
    <section className="ml-10 max-w-[78%] rounded-xl border border-black/10 bg-white p-3 shadow-sm">
      <div className="text-xs font-semibold uppercase tracking-wide text-black/45">{result.type}</div>
      <h4 className="mt-1 font-semibold">{result.title}</h4>
      {result.summary && <p className="mt-1 text-sm text-black/60">{result.summary}</p>}
      <div className="mt-3 space-y-2">
        {result.items.map((item, index) => (
          <div key={`${item.title}-${index}`} className="rounded-lg bg-paper p-2.5">
            <div className="font-medium">{item.title}</div>
            {item.subtitle && <div className="mt-0.5 text-xs text-black/50">{item.subtitle}</div>}
            {item.description && <div className="mt-1 text-sm text-black/65">{item.description}</div>}
            {item.tags && item.tags.length > 0 && <div className="mt-2 flex flex-wrap gap-1">{item.tags.map((tag) => <span key={tag} className="rounded-full bg-white px-2 py-0.5 text-[11px] text-black/55">{tag}</span>)}</div>}
          </div>
        ))}
      </div>
      {result.followUps && result.followUps.length > 0 && <div className="mt-3 flex flex-wrap gap-2">{result.followUps.map((followUp) => <button key={followUp} onClick={() => onFollowUp(followUp)} className="rounded-full border border-black/10 bg-white px-2.5 py-1 text-xs font-medium hover:bg-paper">{followUp}</button>)}</div>}
    </section>
  );
}

function conversationTopic(message?: string) {
  if (!message) return "Getting to know each other";
  if (/\b(anime|movie|film|show|series|character)\b/i.test(message)) return "Movies & anime";
  if (/\b(sport|sports|game|gaming|match|football|soccer|cricket|basketball|esport)\b/i.test(message)) return "Games & sport";
  if (/\b(code|coding|technology|tech|program|debug|computer|software|ai|build|study|work|project)\b/i.test(message)) return "Technology";
  if (/\b(help|support|sad|anxious|anxiety|stressed|overwhelmed|lonely|grief|hurt|sorry|difficult)\b/i.test(message)) return "A supportive conversation";
  if (/\b(reflect|reflection|meaning|life|future|memory|memories|thoughtful|serious|philosophy|purpose)\b/i.test(message)) return "A reflective moment";
  return "Your latest conversation";
}

function CompanionPortrait({ companion, accent, fallbackLabel, visualState, activityState }: { companion?: Companion; accent: string; fallbackLabel: string; visualState: PortraitVisualState; activityState: PortraitActivityState }) {
  const image = companion?.portraitVariants?.[visualState] || companion?.generatedPortrait || companion?.avatarImage;
  const direction = portraitDirections[visualState];

  if (image) {
    return (
      <div className="relative grid min-h-72 w-full place-items-end overflow-hidden rounded-xl bg-white/45 px-6 pt-6 shadow-inner">
        <div className="absolute inset-x-4 top-4 z-10 flex items-center justify-between text-xs font-medium text-black/55">
          <span className="rounded-full bg-white/80 px-2 py-1">{direction.label}</span>
          <span className="rounded-full bg-white/80 px-2 py-1 capitalize">{activityState}</span>
        </div>
        <img key={`${companion?.id}-${visualState}`} src={image} alt={`${companion?.name ?? "Companion"}, ${direction.label.toLowerCase()} scene`} className={cn("living-portrait max-h-80 w-auto object-contain drop-shadow-xl", `living-portrait--${activityState}`)} />
      </div>
    );
  }

  return (
    <div className={cn("living-portrait grid h-56 w-56 place-items-center rounded-full border-4 border-white text-center shadow-lg", `living-portrait--${activityState}`)} style={{ backgroundColor: accent }}>
      <div className="text-white">
        <Sparkles className="mx-auto h-10 w-10" />
        <div className="mt-2 text-xl font-semibold">{fallbackLabel}</div>
      </div>
    </div>
  );
}
