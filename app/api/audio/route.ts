/**
 * Voice Chat sample — API endpoint.
 *
 * Uses the composed VoiceChatResponder (whisper.cpp + ollama).
 * This is a sample — in your own app, implement ServerResponder
 * with whatever transcription/LLM services you need.
 */

import type { NextRequest } from "next/server";
import { VoiceChatResponder } from "@/lib/responders";

export const dynamic = "force-dynamic";

const responder = new VoiceChatResponder({
  whisper: { endpoint: process.env.WHISPER_ENDPOINT || "http://localhost:8082" },
  ollama: {
    endpoint: process.env.OLLAMA_ENDPOINT || "http://localhost:11434",
    model: process.env.OLLAMA_MODEL || "gemma3:1b",
  },
});

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const audioFile = formData.get("audio") as File | null;

    if (!audioFile) {
      return new Response(JSON.stringify({ error: "No audio file" }), { status: 400 });
    }

    const buffer = await audioFile.arrayBuffer();
    const id = crypto.randomUUID();

    let messages: { role: string; content: string }[] = [];
    const prev = formData.get("messages");
    if (prev && typeof prev === "string") {
      try { messages = JSON.parse(prev); } catch {}
    }

    const result = await responder.process(
      { id, data: Buffer.from(buffer), mimeType: audioFile.type || "audio/webm" },
      messages
    );

    return new Response(
      JSON.stringify({
        segmentId: id,
        text: result.text || "",
        response: result.response || "",
        blank: result.blank || false,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error(err);
    return new Response(
      JSON.stringify({ error: "Transcription failed" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
