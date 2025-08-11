import { GoogleGenAI } from "@google/genai";
import { env } from "./env.js";

const genai = new GoogleGenAI({
  vertexai: true,
  project: env.PROJECT,
  location: env.LOCATION,
});

export type WebSearchResult = {
  text: string;
};

export async function webSearch(
  query: string,
  signal: AbortSignal
): Promise<WebSearchResult> {
  const res = await genai.models.generateContent({
    model: env.MODEL,
    contents: [{ role: "user", parts: [{ text: query }] }],
    config: {
      tools: [{ googleSearch: {} }],
      abortSignal: signal,
    },
  });

  const text = (res.candidates?.[0]?.content?.parts || [])
    .map((p) => p.text || "")
    .join("")
    .trim();

  if (!text) {
    return {
      text: `No search results or information found for query: "${query}"`,
    };
  }

  const { groundingSupports, groundingChunks } =
    res.candidates?.[0]?.groundingMetadata || {};

  const insertions: { pos: number; marker: string }[] = (
    groundingSupports || []
  )
    .flatMap((support) => {
      const { segment, groundingChunkIndices } = support;
      if (segment?.endIndex && groundingChunkIndices) {
        const marker = groundingChunkIndices.map((i) => `[${i + 1}]`).join("");
        return { pos: segment.endIndex, marker };
      } else {
        return [];
      }
    })
    .sort((a, b) => b.pos - a.pos);

  let textBytes = new TextEncoder().encode(text);
  for (const { pos, marker } of insertions) {
    const markerBytes = new TextEncoder().encode(marker);
    textBytes = new Uint8Array([
      ...textBytes.slice(0, pos),
      ...markerBytes,
      ...textBytes.slice(pos),
    ]);
  }
  const modifiedText = new TextDecoder().decode(textBytes);

  const sourceList = (groundingChunks || []).map(
    (s, i) =>
      `[${i + 1}] ${s.web?.title || "Untitled"} (${s.web?.uri || "No URL"})`
  );
  const sourceListPart =
    sourceList.length > 0 ? `\n\nSources:\n${sourceList.join("\n")}` : "";

  return {
    text: [
      `Web search results for "${query}":\n\n`,
      modifiedText,
      sourceListPart,
    ].join(""),
  };
}
