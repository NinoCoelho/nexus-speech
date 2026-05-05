import type { AudioSegment, Responder, Transcript } from "./types";

export class OllamaResponder implements Responder {
  private endpoint: string;
  private model: string;

  constructor(endpoint = "http://localhost:11434", model = "gemma3:1b") {
    this.endpoint = endpoint;
    this.model = model;
  }

  async transcribe(segment: AudioSegment): Promise<Transcript> {
    const formData = new FormData();
    const file = new Blob([new Uint8Array(segment.data)]);
    formData.append("file", file, "audio.webm");
    formData.append("model", "whisper-tiny");

    return {
      id: segment.id,
      text: "[use whisper for transcription]",
      confidence: 0.5,
    };
  }
}

export class OllamaLLM implements Responder {
  private endpoint: string;
  private model: string;
  private systemPrompt: string;

  constructor(
    endpoint = "http://localhost:11434",
    model = "gemma3:1b",
    systemPrompt = "You are a helpful voice assistant. Keep responses brief and conversational."
  ) {
    this.endpoint = endpoint;
    this.model = model;
    this.systemPrompt = systemPrompt;
  }

  async chat(prompt: string): Promise<string> {
    const resp = await fetch(`${this.endpoint}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: this.model,
        messages: [
          { role: "system", content: this.systemPrompt },
          { role: "user", content: prompt },
        ],
        stream: false,
      }),
    });

    if (!resp.ok) {
      throw new Error(`Ollama error: ${resp.statusText}`);
    }

    const json = await resp.json();
    return json.message?.content || "";
  }

  async transcribe(segment: AudioSegment): Promise<Transcript> {
    return {
      id: segment.id,
      text: "[use whisper for transcription]",
      confidence: 0.5,
    };
  }
}

export const ollamaLLM = new OllamaLLM();