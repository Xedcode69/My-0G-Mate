"use client";

import { Bot, Brain, ChevronRight, LockKeyhole, Sparkles, type LucideIcon } from "lucide-react";
import { usePrivy } from "@privy-io/react-auth";

export function StarterPage() {
  const { login, ready } = usePrivy();

  return (
    <main className="min-h-screen px-4 py-5 text-ink sm:px-6 lg:px-8">
      <section className="mx-auto grid min-h-[calc(100vh-40px)] max-w-6xl items-center gap-8 lg:grid-cols-[1fr_420px]">
        <div>
          <div className="inline-flex items-center gap-2 rounded-md border border-black/10 bg-white/70 px-3 py-2 text-sm text-black/65">
            <Sparkles className="h-4 w-4 text-ember" />
            Persistent AI companions with decentralized memory
          </div>
          <h1 className="mt-5 max-w-3xl text-5xl font-semibold leading-tight sm:text-6xl">MyMate</h1>
          <p className="mt-4 max-w-2xl text-lg leading-8 text-black/68">
            Create a companion that remembers you, grows through conversation, and archives meaningful memory snapshots with 0G Storage.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <button
              onClick={login}
              disabled={!ready}
              className="inline-flex items-center gap-2 rounded-md bg-ink px-5 py-3 font-medium text-white shadow-sm disabled:opacity-50"
            >
              Sign up / log in
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="rounded-lg border border-black/10 bg-white/80 p-5 shadow-sm">
          <div className="avatar-stage grid min-h-[300px] place-items-center rounded-md border border-black/10">
            <div className="grid h-40 w-40 place-items-center rounded-full bg-ember text-white shadow-lg">
              <Bot className="h-16 w-16" />
            </div>
          </div>
          <div className="mt-5 grid gap-3">
            <Feature icon={LockKeyhole} title="Privy accounts" text="Use email or wallet login with embedded wallet creation." />
            <Feature icon={Brain} title="Living memory" text="Important facts, goals, preferences, and relationship state persist." />
            <Feature icon={Sparkles} title="Progression" text="XP, mood, relationship levels, and visual evolution are ready in V1." />
          </div>
        </div>
      </section>
    </main>
  );
}

function Feature({ icon: Icon, title, text }: { icon: LucideIcon; title: string; text: string }) {
  return (
    <div className="flex gap-3 rounded-md bg-paper p-3">
      <Icon className="mt-1 h-5 w-5 shrink-0 text-ember" />
      <div>
        <div className="font-medium">{title}</div>
        <div className="text-sm text-black/60">{text}</div>
      </div>
    </div>
  );
}
