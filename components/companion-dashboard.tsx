"use client";

import { useEffect, useMemo, useState } from "react";
import { Activity, Archive, Bot, Brain, CalendarCheck, Heart, Loader2, MessageCircle, Sparkles, Utensils } from "lucide-react";
import { usePrivy } from "@privy-io/react-auth";
import { companionArchetypes, moodLabels, relationshipLabels } from "@/lib/companion/archetypes";
import { cn } from "@/lib/ui";

type CompanionType = "ROBOT" | "PET" | "ANIME_GIRL" | "SPIRIT";
type CompanionMood = "HAPPY" | "NEUTRAL" | "LONELY" | "EXCITED";
type ActivityType = "DAILY_CHECK_IN" | "FEED_COMPANION" | "PLAY_MINI_GAME" | "REFLECTION_PROMPT";

type Companion = {
  id: string;
  name: string;
  type: CompanionType;
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
  const [companions, setCompanions] = useState<Companion[]>([]);
  const [activeId, setActiveId] = useState("");
  const [name, setName] = useState("Nova");
  const [type, setType] = useState<CompanionType>("ROBOT");
  const [message, setMessage] = useState("");
  const [reflection, setReflection] = useState("");
  const [moodGuess, setMoodGuess] = useState<CompanionMood>("HAPPY");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const wallet = user?.wallet?.address?.toLowerCase() ?? "";

  const active = companions.find((companion) => companion.id === activeId) ?? companions[0];
  const archetype = active ? companionArchetypes[active.type] : companionArchetypes[type];
  const messages = useMemo(() => [...(active?.chatLogs ?? [])].reverse(), [active?.chatLogs]);

  useEffect(() => {
    if (wallet) void loadCompanions(wallet);
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
    setCompanions(data.companions ?? []);
    setActiveId(data.companions?.[0]?.id ?? "");
  }

  async function createCompanion() {
    setBusy(true);
    try {
      const data = await request<{ companion: Companion }>("/api/companions", {
        method: "POST",
        body: JSON.stringify({ name, type })
      });
      setCompanions((current) => [data.companion, ...current]);
      setActiveId(data.companion.id);
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
    try {
      const data = await request<{ companion: Companion; response: string; memoriesCreated: number }>(`/api/companions/${active.id}/chat`, {
        method: "POST",
        body: JSON.stringify({ message: userMessage })
      });
      replaceCompanion(data.companion);
      setStatus(data.memoriesCreated ? `Saved ${data.memoriesCreated} new memory` : "Conversation saved");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Chat failed");
    } finally {
      setBusy(false);
    }
  }

  async function runActivity(activityType: ActivityType) {
    if (!active) return;
    setBusy(true);
    try {
      const data = await request<{ companion: Companion; xpEarned: number; guessedCorrectly?: boolean }>(`/api/companions/${active.id}/activities`, {
        method: "POST",
        body: JSON.stringify({ activityType, moodGuess, reflection })
      });
      replaceCompanion(data.companion);
      setReflection("");
      setStatus(`+${data.xpEarned} XP`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Activity failed");
    } finally {
      setBusy(false);
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
    <main className="min-h-screen px-4 py-5 text-ink sm:px-6 lg:px-8">
      <section className="mx-auto grid max-w-7xl gap-4 lg:grid-cols-[320px_minmax(0,1fr)_320px]">
        <aside className="rounded-lg border border-black/10 bg-white/78 p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold">MyMate</h1>
              <p className="text-sm text-black/60">Persistent AI companions</p>
            </div>
            <button
              onClick={logout}
              className="rounded-md bg-ink px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
              disabled={busy}
            >
              Log out
            </button>
          </div>
          <div className="mt-3 truncate rounded-md bg-paper px-3 py-2 text-xs text-black/55">
            {wallet || "Privy account active"}
          </div>

          <div className="mt-5 space-y-3">
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="w-full rounded-md border border-black/10 bg-white px-3 py-2"
              placeholder="Companion name"
            />
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(companionArchetypes) as CompanionType[]).map((key) => (
                <button
                  key={key}
                  onClick={() => setType(key)}
                  className={cn("rounded-md border px-3 py-2 text-left text-sm", type === key ? "border-ink bg-ink text-white" : "border-black/10 bg-white")}
                >
                  {companionArchetypes[key].label}
                </button>
              ))}
            </div>
            <button
              onClick={createCompanion}
              disabled={!wallet || busy}
              className="flex w-full items-center justify-center gap-2 rounded-md bg-ember px-3 py-2 font-medium text-white disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bot className="h-4 w-4" />}
              Create companion
            </button>
          </div>

          <div className="mt-5 space-y-2">
            {companions.map((companion) => (
              <button
                key={companion.id}
                onClick={() => setActiveId(companion.id)}
                className={cn("w-full rounded-md border p-3 text-left", active?.id === companion.id ? "border-ink bg-white" : "border-black/10 bg-white/60")}
              >
                <div className="font-medium">{companion.name}</div>
                <div className="text-xs text-black/55">
                  L{companion.level} / {relationshipLabels[companion.relationshipLevel]} / {moodLabels[companion.mood]}
                </div>
              </button>
            ))}
          </div>
        </aside>

        <section className="overflow-hidden rounded-lg border border-black/10 bg-white/82 shadow-sm">
          <div className="avatar-stage relative min-h-[240px] border-b border-black/10 p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-sm font-medium text-black/55">{archetype.background}</div>
                <h2 className="mt-1 text-3xl font-semibold">{active?.name ?? "Choose a companion"}</h2>
                <p className="mt-2 max-w-xl text-sm text-black/65">{archetype.evolution}</p>
              </div>
              {active && (
                <button onClick={createSnapshot} className="rounded-md border border-black/10 bg-white px-3 py-2 text-sm">
                  <Archive className="inline h-4 w-4" /> Snapshot
                </button>
              )}
            </div>
            <div className="mx-auto mt-6 grid h-36 w-36 place-items-center rounded-full border-4 border-white text-center shadow-lg" style={{ backgroundColor: archetype.accent }}>
              <div className="text-white">
                <Sparkles className="mx-auto h-8 w-8" />
                <div className="mt-2 text-xl font-semibold">{active?.evolutionStage === 2 ? archetype.stageTwoAvatar : archetype.stageOneAvatar}</div>
              </div>
            </div>
          </div>

          <div className="h-[420px] space-y-3 overflow-y-auto p-4">
            {messages.length === 0 && <p className="text-sm text-black/55">Start a conversation. Your companion will save meaningful memories as you talk.</p>}
            {messages.map((chat) => (
              <div key={chat.id} className="space-y-2">
                <div className="ml-auto max-w-[78%] rounded-lg bg-ink px-3 py-2 text-sm text-white">{chat.userMessage}</div>
                <div className="max-w-[78%] rounded-lg bg-paper px-3 py-2 text-sm">{chat.companionResponse}</div>
              </div>
            ))}
          </div>

          <div className="border-t border-black/10 p-4">
            <div className="flex gap-2">
              <input
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") void sendMessage();
                }}
                className="min-w-0 flex-1 rounded-md border border-black/10 bg-white px-3 py-2"
                placeholder="Tell your companion something..."
              />
              <button onClick={sendMessage} disabled={!active || busy} className="rounded-md bg-mint px-4 py-2 font-medium text-white disabled:opacity-50">
                <MessageCircle className="h-4 w-4" />
              </button>
            </div>
            {status && <div className="mt-2 text-sm text-black/60">{status}</div>}
          </div>
        </section>

        <aside className="space-y-4">
          <div className="rounded-lg border border-black/10 bg-white/78 p-4 shadow-sm">
            <h3 className="font-semibold">Growth</h3>
            <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
              <Metric label="Level" value={active?.level ?? 1} />
              <Metric label="XP" value={active?.xp ?? 0} />
              <Metric label="Trust" value={active?.trustScore ?? 0} />
              <Metric label="Stage" value={active?.evolutionStage ?? 1} />
            </div>
          </div>

          <div className="rounded-lg border border-black/10 bg-white/78 p-4 shadow-sm">
            <h3 className="font-semibold">Activities</h3>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {activities.map(({ type: activityType, label, icon: Icon }) => (
                <button key={activityType} onClick={() => runActivity(activityType)} disabled={!active || busy} className="rounded-md border border-black/10 bg-white p-3 text-sm disabled:opacity-50">
                  <Icon className="mb-2 h-4 w-4" />
                  {label}
                </button>
              ))}
            </div>
            <select value={moodGuess} onChange={(event) => setMoodGuess(event.target.value as CompanionMood)} className="mt-3 w-full rounded-md border border-black/10 bg-white px-3 py-2 text-sm">
              {Object.keys(moodLabels).map((mood) => (
                <option key={mood} value={mood}>
                  {moodLabels[mood as CompanionMood]}
                </option>
              ))}
            </select>
            <textarea
              value={reflection}
              onChange={(event) => setReflection(event.target.value)}
              className="mt-3 min-h-20 w-full rounded-md border border-black/10 bg-white px-3 py-2 text-sm"
              placeholder="Daily reflection"
            />
          </div>

          <div className="rounded-lg border border-black/10 bg-white/78 p-4 shadow-sm">
            <h3 className="flex items-center gap-2 font-semibold">
              <Heart className="h-4 w-4" /> Memories
            </h3>
            <div className="mt-3 space-y-2">
              {(active?.memories ?? []).length === 0 && <p className="text-sm text-black/55">No long-term memories yet.</p>}
              {(active?.memories ?? []).map((memory) => (
                <div key={memory.id} className="rounded-md bg-paper p-2 text-sm">
                  <div className="text-xs uppercase text-black/45">{memory.memoryType} / {memory.importance}</div>
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

function Metric({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-md bg-paper p-3">
      <div className="text-xs text-black/50">{label}</div>
      <div className="text-xl font-semibold">{value}</div>
    </div>
  );
}
