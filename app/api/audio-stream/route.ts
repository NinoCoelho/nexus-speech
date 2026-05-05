import type { NextRequest } from "next/server";
import { WhisperResponder } from "@/lib/responders/whisper";
import { OllamaChat } from "@/lib/responders/ollama";
import { synthesize, wavFromRaw } from "@/lib/tts";

export const dynamic = "force-dynamic";

const whisper = new WhisperResponder({ endpoint: process.env.WHISPER_ENDPOINT || "http://localhost:8082" });
const chat = new OllamaChat({
  endpoint: process.env.OLLAMA_ENDPOINT || "http://localhost:11434",
  model: process.env.OLLAMA_MODEL || "gemma3:1b",
});

function encodeEvent(data: Record<string, unknown>): string {
  return `data: ${JSON.stringify(data)}\n\n`;
}

export async function POST(req: NextRequest) {
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

  const transcript = await whisper.process({
    id,
    data: Buffer.from(buffer),
    mimeType: audioFile.type || "audio/webm",
  });

  if (transcript.blank || !transcript.text) {
    return new Response(
      encodeEvent({ type: "blank" }) + encodeEvent({ type: "done" }),
      { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" } }
    );
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      controller.enqueue(encoder.encode(encodeEvent({ type: "transcript", text: transcript.text })));

      try {
        const fullMessages = [...messages, { role: "user", content: transcript.text }];
        const response = await fetch(`${chat.getEndpoint()}/api/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: chat.getModel(),
            messages: [{ role: "system", content: chat.getSystemPrompt() }, ...fullMessages],
            stream: true,
          }),
        });

        if (!response.ok || !response.body) {
          controller.enqueue(encoder.encode(encodeEvent({ type: "done" })));
          controller.close();
          return;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let sentenceBuffer = "";
        let fullResponse = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;
            try {
              const json = JSON.parse(trimmed);
              const token = json.message?.content || "";
              if (!token) continue;

              fullResponse += token;
              sentenceBuffer += token;

              const match = sentenceBuffer.match(/^([\s\S]*?[.!?])/);
              if (match) {
                const sentence = match[1].trim();
                sentenceBuffer = sentenceBuffer.slice(match[0].length);

                if (sentence && sentence.length > 1) {
                  console.log(`[stream] synthesizing sentence: "${sentence}"`);
                  controller.enqueue(encoder.encode(encodeEvent({ type: "token", text: fullResponse })));

                  try {
                    const rawPcm = await synthesize(sentence);
                    const wav = wavFromRaw(rawPcm);
                    const base64 = wav.toString("base64");
                    console.log(`[stream] audio chunk: ${base64.length} chars`);
                    controller.enqueue(encoder.encode(encodeEvent({ type: "audio", audio: base64 })));
                  } catch (e) {
                    console.error(`[stream] TTS error:`, e);
                  }
                }
              }
            } catch {}
          }
        }

        if (sentenceBuffer.trim().length > 1) {
          console.log(`[stream] final sentence: "${sentenceBuffer.trim()}"`);
          controller.enqueue(encoder.encode(encodeEvent({ type: "token", text: fullResponse })));
          try {
            const rawPcm = await synthesize(sentenceBuffer.trim());
            const wav = wavFromRaw(rawPcm);
            const base64 = wav.toString("base64");
            console.log(`[stream] final audio: ${base64.length} chars`);
            controller.enqueue(encoder.encode(encodeEvent({ type: "audio", audio: base64 })));
          } catch (e) {
            console.error(`[stream] final TTS error:`, e);
          }
        }

        console.log(`[stream] done. full response: "${fullResponse}"`);
        controller.enqueue(encoder.encode(encodeEvent({ type: "response", text: fullResponse })));
        controller.enqueue(encoder.encode(encodeEvent({ type: "done" })));
      } catch (err) {
        console.error("Stream error:", err);
        controller.enqueue(encoder.encode(encodeEvent({ type: "done" })));
      }

      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
}
