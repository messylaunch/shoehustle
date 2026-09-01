import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
// The SDK's zod helper is built against zod v4, which ships from this subpath
// in zod 3.25+. Importing from bare "zod" gives v3 schemas the helper rejects.
import * as z from "zod/v4";
import { hasAnthropicKey } from "./config";

// Photo shoe ID.
//
// The model is good at the silhouette and less good at telling near-identical
// colorways apart, which is exactly where being wrong is expensive. So it
// returns ranked candidates rather than one answer, reads the style code off
// the tongue tag when you photograph it, and you always confirm.

const GRADE_CODES = ["DS", "VNDS", "G9", "G8", "G7", "G6"] as const;

const CandidateSchema = z.object({
  brand: z.string().describe("Brand, e.g. Nike, Jordan, New Balance, adidas"),
  model: z
    .string()
    .describe("Model line and silhouette, e.g. '4 Retro', 'Dunk Low', '550'"),
  colorway: z
    .string()
    .describe("Colorway as the resale market names it, e.g. 'Military Black'"),
  styleCode: z
    .string()
    .nullable()
    .describe("Style code if legible in a photo or known with confidence"),
  nickname: z
    .string()
    .nullable()
    .describe("Community nickname if it has one, e.g. 'Bred', 'Panda'"),
  retailUsd: z
    .number()
    .nullable()
    .describe("Original US retail price in dollars, if known"),
  confidence: z.enum(["high", "medium", "low"]),
  reasoning: z
    .string()
    .describe("One short sentence on what in the photo points to this"),
});

const IdentifySchema = z.object({
  candidates: z
    .array(CandidateSchema)
    .describe("Up to three, most likely first"),
  visibleStyleCode: z
    .string()
    .nullable()
    .describe("Style code read directly off a tag in the photos, if present"),
  conditionNotes: z
    .string()
    .describe("What the photos show about wear: creasing, sole, yellowing"),
  suggestedGrade: z
    .enum(GRADE_CODES)
    .nullable()
    .describe("Best guess at condition grade from the photos"),
});

export type IdentifyResult = z.infer<typeof IdentifySchema>;
export type ShoeCandidate = z.infer<typeof CandidateSchema>;

const SYSTEM = `You identify sneakers from photos for a reseller who is about to bid on them.

Getting the model right is easy; getting the colorway right is where money is lost, so:
- Return up to three candidates, most likely first, and be honest with the confidence field.
- If two colorways of the same silhouette look alike in this lighting, return both rather than picking one.
- If a style code is legible anywhere in the photos (tongue label, box end), read it out character by character into visibleStyleCode. It is the shoe's fingerprint and outranks your guess from the silhouette.
- Never invent a style code you cannot actually read. Null is a better answer than a plausible-looking wrong one.

Also grade the condition from what you can see:
- DS: never worn, no creasing, factory-clean sole
- VNDS: tried on at most, no real creasing
- G9: light creasing, clean sole
- G8: obvious creasing, dirty but intact sole
- G7: heavy wear, yellowing, scuffs
- G6: sole separation, holes, heel drag

If the photos don't show enough to grade honestly, say so in conditionNotes and leave suggestedGrade null.`;

export interface PhotoInput {
  /** Raw base64, no data: prefix. */
  data: string;
  mediaType: "image/jpeg" | "image/png" | "image/webp" | "image/gif";
}

export class IdentifyUnavailableError extends Error {
  constructor() {
    super(
      "Photo ID is off. Add ANTHROPIC_API_KEY to your .env file and restart to turn it on — or just type the shoe in by hand.",
    );
    this.name = "IdentifyUnavailableError";
  }
}

/**
 * Identifies a shoe from one or more photos.
 * Throws IdentifyUnavailableError when no API key is configured, so callers
 * can fall back to the manual form rather than showing an error.
 */
export async function identifyShoe(
  photos: PhotoInput[],
  hint?: string,
): Promise<IdentifyResult> {
  if (!hasAnthropicKey) throw new IdentifyUnavailableError();
  if (photos.length === 0) throw new Error("No photos to identify.");

  const client = new Anthropic();

  const content: Anthropic.ContentBlockParam[] = photos.map((photo) => ({
    type: "image" as const,
    source: {
      type: "base64" as const,
      media_type: photo.mediaType,
      data: photo.data,
    },
  }));

  content.push({
    type: "text",
    text: hint?.trim()
      ? `Identify this pair. The seller says: ${hint.trim()}`
      : "Identify this pair.",
  });

  const response = await client.messages.parse({
    model: "claude-opus-5",
    max_tokens: 4000,
    system: SYSTEM,
    messages: [{ role: "user", content }],
    output_config: { format: zodOutputFormat(IdentifySchema) },
  });

  if (response.stop_reason === "refusal") {
    throw new Error(
      "The model declined to read that image. Try a different photo, or type the shoe in by hand.",
    );
  }

  const parsed = response.parsed_output;
  if (!parsed) {
    throw new Error(
      "Couldn't read a result from that photo. Try a clearer side-on shot, or type the shoe in by hand.",
    );
  }

  // A style code read straight off a tag beats the model's recall, so promote
  // it onto the top candidate when the two disagree.
  if (parsed.visibleStyleCode && parsed.candidates.length > 0) {
    parsed.candidates[0].styleCode = parsed.visibleStyleCode;
  }

  return parsed;
}

/** Media type from a browser upload, or null when we can't accept it. */
export function mediaTypeFor(type: string): PhotoInput["mediaType"] | null {
  switch (type) {
    case "image/jpeg":
    case "image/jpg":
      return "image/jpeg";
    case "image/png":
      return "image/png";
    case "image/webp":
      return "image/webp";
    case "image/gif":
      return "image/gif";
    default:
      return null;
  }
}
