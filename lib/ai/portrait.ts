import type { Companion, Memory } from "@prisma/client";
import { companionArchetypes } from "@/lib/companion/archetypes";
import { portraitDirections, portraitVisualStates, type PortraitVisualState } from "@/lib/companion/portrait-state";

type PortraitCompanion = Companion & { memories: Memory[] };

type PortraitResult = {
  image: string;
  prompt: string;
  provider: "openai" | "fallback";
};

type PortraitSetResult = PortraitResult & {
  variants: Record<PortraitVisualState, string>;
};

export async function generateCompanionPortrait(companion: PortraitCompanion): Promise<PortraitResult> {
  const prompt = buildPortraitPrompt(companion);
  const apiKey = process.env.IMAGE_API_KEY || process.env.LLM_API_KEY;
  const model = process.env.IMAGE_MODEL || "gpt-image-1";

  if (!apiKey) {
    return {
      image: companion.avatarImage || buildFallbackPortrait(companion),
      prompt,
      provider: "fallback"
    };
  }

  const generated = companion.avatarImage
    ? await editPortraitFromAvatar({ apiKey, model, avatarImage: companion.avatarImage, prompt })
    : await generatePortraitFromPrompt({ apiKey, model, prompt });

  return {
    image: generated,
    prompt,
    provider: "openai"
  };
}

export async function generateCompanionPortraitSet(companion: PortraitCompanion): Promise<PortraitSetResult> {
  const base = await generateCompanionPortrait(companion);
  if (base.provider === "fallback") {
    return {
      ...base,
      variants: Object.fromEntries(portraitVisualStates.map((state) => [state, base.image])) as Record<PortraitVisualState, string>
    };
  }

  const apiKey = process.env.IMAGE_API_KEY || process.env.LLM_API_KEY;
  const model = process.env.IMAGE_MODEL || "gpt-image-1";
  if (!apiKey) throw new Error("Image API key is unavailable");

  const variants = {} as Record<PortraitVisualState, string>;
  for (const state of portraitVisualStates) {
    const direction = portraitDirections[state];
    const variantPrompt = [
      `Keep the exact same companion identity, face, hair or defining features, art style, clothing identity, and framing as the reference portrait for ${companion.name}.`,
      `Change only the scene direction: ${direction.expression}, ${direction.pose}, ${direction.lighting}, ${direction.background}.`,
      "Keep it polished 2D app-ready character art with no text, logos, or extra characters."
    ].join(" ");
    variants[state] = await editPortraitFromAvatar({ apiKey, model, avatarImage: base.image, prompt: variantPrompt });
  }

  return { ...base, variants };
}

function buildPortraitPrompt(companion: PortraitCompanion) {
  const archetype = companionArchetypes[companion.type];
  const typeLabel = companion.customTypeName || archetype.label;
  const interests = companion.memories
    .filter((memory) => memory.memoryType === "interest_area")
    .slice(0, 8)
    .map((memory) => memory.content)
    .join(", ");

  return [
    `Create a polished 2D virtual AI companion portrait for ${companion.name}.`,
    `Companion type: ${typeLabel}.`,
    `Core traits: ${archetype.traits.join(", ")}.`,
    interests ? `User-selected interests to subtly inspire details: ${interests}.` : "Keep details broadly appealing and personal.",
    "The character should face forward as if standing in front of the user in a companion dashboard.",
    "Style: clean app-ready character art, expressive eyes, friendly presence, full upper body or bust, transparent or simple light background, no text, no logos, no extra characters."
  ].join(" ");
}

async function generatePortraitFromPrompt({ apiKey, model, prompt }: { apiKey: string; model: string; prompt: string }) {
  const response = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({ model, prompt, size: "1024x1024" })
  });

  return readImageResponse(response);
}

async function editPortraitFromAvatar({ apiKey, model, avatarImage, prompt }: { apiKey: string; model: string; avatarImage: string; prompt: string }) {
  const { blob, filename } = await imageToBlob(avatarImage);
  const form = new FormData();
  form.append("model", model);
  form.append("prompt", `${prompt} Use the uploaded avatar as the primary identity reference while transforming it into a coherent companion character.`);
  form.append("size", "1024x1024");
  form.append("image", blob, filename);

  const response = await fetch("https://api.openai.com/v1/images/edits", {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}` },
    body: form
  });

  return readImageResponse(response);
}

async function readImageResponse(response: Response) {
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error?.message || "Unable to generate companion portrait");
  }

  const b64 = data.data?.[0]?.b64_json;
  if (b64) return `data:image/png;base64,${b64}`;

  const url = data.data?.[0]?.url;
  if (url) return url;

  throw new Error("Image provider returned no portrait image");
}

async function imageToBlob(image: string) {
  if (!image.startsWith("data:")) {
    const response = await fetch(image);
    if (!response.ok) throw new Error("Unable to use the generated portrait as an identity reference");
    const mime = response.headers.get("content-type") || "image/png";
    return { blob: await response.blob(), filename: `portrait.${mime.split("/")[1] || "png"}` };
  }

  return dataUrlToBlob(image);
}

function dataUrlToBlob(dataUrl: string) {
  const [meta, base64] = dataUrl.split(",");
  const mime = meta.match(/data:(.*?);base64/)?.[1] || "image/png";
  const ext = mime.split("/")[1] || "png";
  const bytes = Buffer.from(base64, "base64");
  return {
    blob: new Blob([bytes], { type: mime }),
    filename: `avatar.${ext}`
  };
}

function buildFallbackPortrait(companion: Companion) {
  const archetype = companionArchetypes[companion.type];
  const label = companion.customTypeName || archetype.stageOneAvatar;
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
      <rect width="512" height="512" rx="64" fill="#f7f4ef"/>
      <circle cx="256" cy="210" r="118" fill="${archetype.accent}"/>
      <circle cx="216" cy="194" r="16" fill="#fff"/>
      <circle cx="296" cy="194" r="16" fill="#fff"/>
      <path d="M204 258c32 28 72 28 104 0" stroke="#fff" stroke-width="18" stroke-linecap="round" fill="none"/>
      <path d="M132 438c22-86 75-132 124-132s102 46 124 132" fill="${archetype.accent}" opacity="0.82"/>
      <text x="256" y="472" text-anchor="middle" font-family="Arial" font-size="30" font-weight="700" fill="#14151a">${escapeSvg(label).slice(0, 18)}</text>
    </svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

function escapeSvg(value: string) {
  return value.replace(/[&<>"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[character] || character);
}
