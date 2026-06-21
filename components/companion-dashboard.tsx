"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Activity, Archive, Bot, Brain, CalendarCheck, CircleUserRound, Heart, ImageUp, Loader2, MessageCircle, Pencil, Plus, Save, Sparkles, UserRound, Utensils, X } from "lucide-react";
import { usePrivy } from "@privy-io/react-auth";
import { companionArchetypes, moodLabels, relationshipLabels } from "@/lib/companion/archetypes";
import { portraitDirections, selectPortraitState, type PortraitActivityState, type PortraitVisualState } from "@/lib/companion/portrait-state";
import { cn } from "@/lib/ui";

type CompanionType = "ROBOT" | "PET" | "ANIME_GIRL" | "SPIRIT" | "CUSTOM";
type CompanionMood = "HAPPY" | "NEUTRAL" | "LONELY" | "EXCITED";
type ActivityType = "DAILY_CHECK_IN" | "FEED_COMPANION" | "PLAY_MINI_GAME" | "REFLECTION_PROMPT";

type Companion = {
  id: string;
  name: string;
  type: CompanionType;
  avatarKey: string;
  customTypeName?: string | null;
  avatarImage?: string | null;
  generatedPortrait?: string | null;
  portraitPrompt?: string | null;
  portraitVariants?: Partial<Record<PortraitVisualState, string>> | null;
  level: number;
  xp: number;
  mood: CompanionMood;
  relationshipLevel: number;
  trustScore: number;
  attachmentScore: number;
  evolutionStage: number;
  memories: { id: string; memoryType: string; content: string; importance: number }[];
  chatLogs: { id: string; userMessage: string; companionResponse: string; createdAt: string }[];
};

const activities: { type: ActivityType; label: string; icon: typeof Activity }[] = [
  { type: "DAILY_CHECK_IN", label: "Check in", icon: CalendarCheck },
  { type: "FEED_COMPANION", label: "Feed", icon: Utensils },
  { type: "REFLECTION_PROMPT", label: "Reflect", icon: Brain },
  { type: "PLAY_MINI_GAME", label: "Guess mood", icon: Sparkles }
];

export function CompanionDashboard() {
  const { logout, user } = usePrivy();
  const router = useRouter();
  const [companions, setCompanions] = useState<Companion[]>([]);
  const [activeId, setActiveId] = useState("");
  const [name, setName] = useState("Nova");
  const [type, setType] = useState<CompanionType>("ROBOT");
  const [message, setMessage] = useState("");
  const [reflection, setReflection] = useState("");
  const [moodGuess, setMoodGuess] = useState<CompanionMood>("HAPPY");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [portraitBusy, setPortraitBusy] = useState(false);
  const [portraitState, setPortraitState] = useState<PortraitVisualState>("supportive");
  const [portraitActivity, setPortraitActivity] = useState<PortraitActivityState>("idle");
  const [showCompanionForm, setShowCompanionForm] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileEditing, setProfileEditing] = useState(false);
  const [profileName, setProfileName] = useState("");
  const [profileBusy, setProfileBusy] = useState(false);
  const wallet = user?.wallet?.address?.toLowerCase() ?? "";

  const active = companions.find((companion) => companion.id === activeId) ?? companions[0];
  const archetype = active ? companionArchetypes[active.type] : companionArchetypes[type];
  const activeTypeLabel = active?.customTypeName || archetype.label;
  const messages = useMemo(() => [...(active?.chatLogs ?? [])].reverse(), [active?.chatLogs]);

  useEffect(() => {
    const latest = active?.chatLogs?.[0];
    setPortraitState(latest ? selectPortraitState(latest.userMessage, latest.companionResponse) : "supportive");
    setPortraitActivity("idle");
  }, [active?.id]);

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

  async function createCompanion() {
    setBusy(true);
    try {
      const data = await request<{ companion: Companion }>("/api/companions", {
        method: "POST",
        body: JSON.stringify({ name, type, avatarKey: `${type.toLowerCase()}-default` })
      });
      setCompanions((current) => [data.companion, ...current]);
      setActiveId(data.companion.id);
      setShowCompanionForm(false);
      setStatus(`${data.companion.name} joined you`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to create companion");
    } finally {
      setBusy(false);
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
      const data = await request<{ companion: Companion; response: string; memoriesCreated: number; portraitState: PortraitVisualState }>(`/api/companions/${active.id}/chat`, {
        method: "POST",
        body: JSON.stringify({ message: userMessage })
      });
      replaceCompanion(data.companion);
      setPortraitState(data.portraitState);
      setPortraitActivity("replying");
      window.setTimeout(() => setPortraitActivity("idle"), 1200);
      setStatus(data.memoriesCreated ? `Saved ${data.memoriesCreated} new memory` : "Conversation saved");
    } catch (error) {
      setPortraitActivity("idle");
      setStatus(error instanceof Error ? error.message : "Chat failed");
    } finally {
      setBusy(false);
    }
  }

  async function runActivity(activityType: ActivityType) {
    if (!active) return;
    setBusy(true);
    setPortraitActivity(activityType === "PLAY_MINI_GAME" ? "celebrating" : "thinking");
    try {
      const data = await request<{ companion: Companion; xpEarned: number; guessedCorrectly?: boolean }>(`/api/companions/${active.id}/activities`, {
        method: "POST",
        body: JSON.stringify({ activityType, moodGuess, reflection })
      });
      replaceCompanion(data.companion);
      setReflection("");
      setStatus(`+${data.xpEarned} XP`);
      window.setTimeout(() => setPortraitActivity("idle"), 1200);
    } catch (error) {
      setPortraitActivity("idle");
      setStatus(error instanceof Error ? error.message : "Activity failed");
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
      <header className="mx-auto mb-5 flex max-w-[1440px] flex-wrap items-center justify-between gap-3 rounded-2xl border border-black/10 bg-white/85 px-4 py-3 shadow-sm backdrop-blur sm:px-5">
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
          {active && <button onClick={() => document.getElementById("companion-chat")?.scrollIntoView({ behavior: "smooth", block: "end" })} className="rounded-lg bg-ink px-3 py-2 text-sm font-medium text-white">Chat with {active.name}</button>}
          {active && <button onClick={generatePortrait} disabled={portraitBusy} className="rounded-lg border border-black/10 bg-white p-2 text-sm disabled:opacity-50" aria-label="Generate portrait set" title="Portrait set">{portraitBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageUp className="h-4 w-4" />}</button>}
          {active && <button onClick={createSnapshot} className="rounded-lg border border-black/10 bg-white p-2 text-sm" aria-label="Create snapshot" title="Snapshot"><Archive className="h-4 w-4" /></button>}
        <div className="relative">
          <button onClick={() => setProfileOpen((open) => !open)} className="grid h-11 w-11 place-items-center rounded-full border border-black/10 bg-white text-ink shadow-md transition-transform hover:scale-105" aria-label="Open profile menu" aria-expanded={profileOpen}>
            <CircleUserRound className="h-6 w-6" />
          </button>
          {profileOpen && (
            <div className="absolute right-0 top-14 w-80 overflow-hidden rounded-2xl border border-black/10 bg-white shadow-xl">
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
                {profileEditing && <button onClick={saveProfile} disabled={profileBusy} className="flex w-full items-center justify-center gap-2 rounded-lg bg-ink px-3 py-2.5 text-sm font-medium text-white disabled:opacity-50"><Save className="h-4 w-4" /> Save changes</button>}
                <button onClick={() => { setShowCompanionForm(true); setProfileOpen(false); }} className="flex w-full items-center justify-center gap-2 rounded-lg border border-black/10 bg-white px-3 py-2.5 text-sm font-medium hover:bg-paper"><Plus className="h-4 w-4" /> Add companion</button>
                <button onClick={logout} className="w-full rounded-lg px-3 py-2 text-sm text-black/55 hover:bg-paper hover:text-ink">Log out</button>
              </div>
            </div>
          )}
        </div>
        </div>
      </header>
      <section className="mx-auto grid max-w-[1440px] gap-5 lg:grid-cols-[250px_minmax(0,1fr)_300px]">
        <aside className="h-fit rounded-xl border border-black/10 bg-white/78 p-4 shadow-sm lg:sticky lg:top-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold">Your companions</h2>
              <p className="text-xs text-black/55">Choose who to spend time with.</p>
            </div>
          </div>
          <div className="mt-3 truncate rounded-md bg-paper px-3 py-2 text-[11px] text-black/55">{wallet || "Privy account active"}</div>

          {(companions.length === 0 || showCompanionForm) && <div className="mt-5 space-y-3 rounded-lg border border-black/10 bg-white/60 p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="text-sm font-semibold">Create companion</div>
              {companions.length > 0 && <button onClick={() => setShowCompanionForm(false)} className="rounded p-1 text-black/50 hover:bg-paper" aria-label="Close companion form"><X className="h-4 w-4" /></button>}
            </div>
            <input value={name} onChange={(event) => setName(event.target.value)} className="w-full rounded-md border border-black/10 bg-white px-3 py-2" placeholder="Companion name" />
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(companionArchetypes) as CompanionType[]).map((key) => (
                <button key={key} onClick={() => setType(key)} className={cn("rounded-md border px-3 py-2 text-left text-sm", type === key ? "border-ink bg-ink text-white" : "border-black/10 bg-white")}>
                  {companionArchetypes[key].label}
                </button>
              ))}
            </div>
            <button onClick={createCompanion} disabled={!wallet || busy} className="flex w-full items-center justify-center gap-2 rounded-md bg-ember px-3 py-2 font-medium text-white disabled:opacity-50">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bot className="h-4 w-4" />}
              Create companion
            </button>
          </div>}

          <div className="mt-5 border-t border-black/10 pt-4">
            <div className="mb-2 flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-black/45">
              <span>Companions</span>
              <span>{companions.length}</span>
            </div>
            <div className="space-y-2">
            {companions.map((companion) => (
              <button key={companion.id} onClick={() => setActiveId(companion.id)} className={cn("w-full rounded-lg border p-3 text-left transition-colors", active?.id === companion.id ? "border-ink/30 bg-paper shadow-sm" : "border-black/10 bg-white/60 hover:bg-white")}>
                <div className="font-medium">{companion.name}</div>
                <div className="text-xs text-black/55">
                  L{companion.level} / {relationshipLabels[companion.relationshipLevel]} / {moodLabels[companion.mood]}
                </div>
              </button>
            ))}
            </div>
          </div>
        </aside>

        <section className="overflow-hidden rounded-xl border border-black/10 bg-white/82 shadow-sm">
          <div className="avatar-stage border-b border-black/10 p-5 sm:p-6">
            <div className="grid items-center gap-6 md:grid-cols-[minmax(0,1fr)_260px]">
              <div className="mx-auto grid w-full max-w-[360px] place-items-end md:mx-0">
                <CompanionPortrait companion={active} accent={archetype.accent} fallbackLabel={active?.avatarKey ?? (active?.evolutionStage === 2 ? archetype.stageTwoAvatar : archetype.stageOneAvatar)} visualState={portraitState} activityState={portraitActivity} />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-semibold uppercase tracking-wide text-black/45">{activeTypeLabel}</div>
                <h2 className="mt-1 truncate text-3xl font-semibold tracking-tight">{active?.name ?? "Choose a companion"}</h2>
                <p className="mt-2 text-sm leading-6 text-black/60">{archetype.evolution}</p>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <div className="rounded-xl bg-white/80 p-3 shadow-sm">
                    <div className="text-xs text-black/45">Mood</div>
                    <div className="mt-1 text-sm font-semibold">{moodLabels[active?.mood ?? "NEUTRAL"]}</div>
                  </div>
                  <div className="rounded-xl bg-white/80 p-3 shadow-sm">
                    <div className="text-xs text-black/45">Relationship</div>
                    <div className="mt-1 text-sm font-semibold">{relationshipLabels[active?.relationshipLevel ?? 1]}</div>
                  </div>
                </div>
                <div className="mt-3 rounded-xl bg-white/80 p-3 shadow-sm">
                  <div className="flex items-center justify-between text-xs text-black/50"><span>Level {active?.level ?? 1}</span><span>{active?.xp ?? 0} XP</span></div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-black/[0.08]"><div className="h-full rounded-full bg-ember transition-all" style={{ width: `${Math.min(100, (active?.xp ?? 0) % 100)}%` }} /></div>
                  <div className="mt-1.5 text-xs text-black/45">{100 - ((active?.xp ?? 0) % 100)} XP to the next level</div>
                </div>
                <div className="mt-3 flex gap-2">
                  <button onClick={() => runActivity("DAILY_CHECK_IN")} disabled={!active || busy} className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-black/10 bg-white px-2 py-2 text-sm font-medium disabled:opacity-50"><CalendarCheck className="h-4 w-4" /> Check in</button>
                  <button onClick={() => runActivity("REFLECTION_PROMPT")} disabled={!active || busy} className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-black/10 bg-white px-2 py-2 text-sm font-medium disabled:opacity-50"><Brain className="h-4 w-4" /> Reflect</button>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-paper/45 p-4 sm:p-5">
            <section className="overflow-hidden rounded-xl border border-black/10 bg-white shadow-sm">
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
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div id="companion-chat" className="border-t border-black/10 bg-white/90 p-4">
            <div className="flex gap-2">
              <input value={message} onChange={(event) => setMessage(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void sendMessage(); }} className="min-w-0 flex-1 rounded-md border border-black/10 bg-white px-3 py-2" placeholder="Tell your companion something..." />
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
          <div className="rounded-xl border border-black/10 bg-white/78 p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Growth</h3>
              <span className="rounded-full bg-paper px-2 py-1 text-xs font-medium">Level {active?.level ?? 1}</span>
            </div>
            <div className="mt-4 flex items-end justify-between">
              <div><div className="text-2xl font-semibold">{active?.xp ?? 0}</div><div className="text-xs text-black/50">Total XP</div></div>
              <div className="text-right"><div className="text-sm font-semibold">{100 - ((active?.xp ?? 0) % 100)} XP</div><div className="text-xs text-black/50">to next level</div></div>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-black/[0.08]"><div className="h-full rounded-full bg-ember" style={{ width: `${Math.min(100, (active?.xp ?? 0) % 100)}%` }} /></div>
            <div className="mt-4 grid grid-cols-2 gap-2 border-t border-black/10 pt-3 text-sm">
              <div><div className="text-xs text-black/45">Trust</div><div className="mt-1 font-semibold">{active?.trustScore ?? 0}</div></div>
              <div><div className="text-xs text-black/45">Evolution</div><div className="mt-1 font-semibold">Stage {active?.evolutionStage ?? 1}</div></div>
            </div>
          </div>

          <div className="rounded-xl border border-black/10 bg-white/78 p-4 shadow-sm">
            <div className="flex items-center justify-between"><h3 className="font-semibold">Today</h3><span className="text-xs text-black/45">Small moments count</span></div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {activities.map(({ type: activityType, label, icon: Icon }) => (
                <button key={activityType} onClick={() => runActivity(activityType)} disabled={!active || busy} className="flex items-center gap-2 rounded-lg border border-black/10 bg-white px-3 py-2.5 text-left text-sm transition-colors hover:bg-paper disabled:opacity-50">
                  <Icon className="h-4 w-4 shrink-0" />
                  <span>{label}</span>
                </button>
              ))}
            </div>
            <details className="mt-3 rounded-lg bg-paper px-3 py-2 text-sm">
              <summary className="cursor-pointer font-medium text-black/65">Reflection and mood</summary>
              <select value={moodGuess} onChange={(event) => setMoodGuess(event.target.value as CompanionMood)} className="mt-3 w-full rounded-md border border-black/10 bg-white px-3 py-2 text-sm">
                {Object.keys(moodLabels).map((mood) => (
                  <option key={mood} value={mood}>{moodLabels[mood as CompanionMood]}</option>
                ))}
              </select>
              <textarea value={reflection} onChange={(event) => setReflection(event.target.value)} className="mt-2 min-h-20 w-full rounded-md border border-black/10 bg-white px-3 py-2 text-sm" placeholder="Daily reflection" />
            </details>
          </div>

          <div className="rounded-xl border border-black/10 bg-white/78 p-4 shadow-sm">
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

function CompanionPortrait({ companion, accent, fallbackLabel, visualState, activityState }: { companion?: Companion; accent: string; fallbackLabel: string; visualState: PortraitVisualState; activityState: PortraitActivityState }) {
  const image = companion?.portraitVariants?.[visualState] || companion?.generatedPortrait || companion?.avatarImage;
  const direction = portraitDirections[visualState];

  if (image) {
    return (
      <div className="relative grid min-h-56 w-full place-items-end overflow-hidden rounded-lg bg-white/45 px-6 pt-6 shadow-inner">
        <div className="absolute inset-x-4 top-4 z-10 flex items-center justify-between text-xs font-medium text-black/55">
          <span className="rounded-full bg-white/80 px-2 py-1">{direction.label}</span>
          <span className="rounded-full bg-white/80 px-2 py-1 capitalize">{activityState}</span>
        </div>
        <img key={`${companion?.id}-${visualState}`} src={image} alt={`${companion?.name ?? "Companion"}, ${direction.label.toLowerCase()} scene`} className={cn("living-portrait max-h-64 w-auto object-contain drop-shadow-xl", `living-portrait--${activityState}`)} />
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
