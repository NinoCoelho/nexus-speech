import type { NextRequest } from "next/server";
import { whisperResponder } from "@/lib/responders";

export const dynamic = "force-dynamic";

const OLLAMA_ENDPOINT = process.env.OLLAMA_ENDPOINT || "http://localhost:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "gemma3:1b";

async function chat(messages: { role: string; content: string }[]): Promise<string> {
  const resp = await fetch(`${OLLAMA_ENDPOINT}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      messages,
      stream: false,
    }),
  });

  if (!resp.ok) {
    throw new Error(`Ollama error: ${resp.statusText}`);
  }

  const json = await resp.json();
  return json.message?.content || "";
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const audioFile = formData.get("audio") as File | null;

    if (!audioFile) {
      return new Response(JSON.stringify({ error: "No audio file" }), { status: 400 });
    }

    const buffer = await audioFile.arrayBuffer();
    const id = crypto.randomUUID();

    const segment = {
      id,
      data: Buffer.from(buffer),
      mimeType: audioFile.type || "audio/webm",
    };

    const transcript = await whisperResponder.transcribe(segment);

    const isBlank = !transcript.text || /^\[.*\]$/.test(transcript.text.trim());

    if (isBlank) {
      return new Response(
        JSON.stringify({
          segmentId: transcript.id,
          text: "",
          response: "",
          confidence: transcript.confidence,
          blank: true,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    const chatHistory: { role: string; content: string }[] = [
      {
        role: "system",
        content:
          "You are a helpful voice assistant. Keep responses brief and conversational. Respond in 1-3 sentences.",
      },
    ];

    const prevMessages = formData.get("messages");
    if (prevMessages && typeof prevMessages === "string") {
      try {
        const parsed = JSON.parse(prevMessages);
        chatHistory.push(...parsed);
      } catch {}
    }

    chatHistory.push({ role: "user", content: transcript.text });

    const responseText = await chat(chatHistory);

    return new Response(
      JSON.stringify({
        segmentId: transcript.id,
        text: transcript.text,
        response: responseText,
        confidence: transcript.confidence,
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