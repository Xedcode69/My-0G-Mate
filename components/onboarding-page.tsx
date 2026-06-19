"use client";

import { ChangeEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { usePrivy } from "@privy-io/react-auth";
import { Bot, Cat, Check, ImageUp, Loader2, Plus, Sparkles, UserRound } from "lucide-react";
import { companionArchetypes } from "@/lib/companion/archetypes";
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
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const wallet = user?.wallet?.address?.toLowerCase() ?? "";
  const selectedTypeLabel = type === "CUSTOM" && customTypeName.trim() ? customTypeName.trim() : companionArchetypes[type].label;
  const canCreate = useMemo(() => {
    return Boolean(name.trim() && interests.length > 0 && (type !== "CUSTOM" || customTypeName.trim()));
  }, [customTypeName, interests.length, name, type]);

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
        body: JSON.stringify({ name, type, customTypeName, avatarKey: avatarImage ? "uploaded" : avatarKey, avatarImage: avatarImage || undefined, interests })
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

          <section className="rounded-lg border border-black/10 bg-white/80 p-5 shadow-sm">
            <h2 className="text-lg font-semibold">Personalized areas</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {interestOptions.map((interest) => (
                <button
                  key={interest}
                  onClick={() => toggleInterest(interest)}
                  className={cn("rounded-md border px-3 py-2 text-sm", interests.includes(interest) ? "border-mint bg-mint text-white" : "border-black/10 bg-white")}
                >
                  {interest}
                </button>
              ))}
            </div>
            <div className="mt-4 flex gap-2">
              <input
                value={customInterest}
                onChange={(event) => setCustomInterest(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") addCustomInterest();
                }}
                className="min-w-0 flex-1 rounded-md border border-black/10 bg-white px-3 py-2"
                placeholder="Add another area"
              />
              <button onClick={addCustomInterest} className="rounded-md bg-mint px-3 py-2 text-white">
                <Plus className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {interests.map((interest) => (
                <button key={interest} onClick={() => toggleInterest(interest)} className="rounded-md bg-paper px-3 py-2 text-sm">
                  {interest}
                </button>
              ))}
            </div>
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