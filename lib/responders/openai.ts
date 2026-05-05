import type { AudioSegment, Responder, Transcript } from "./types";

export class OpenAIResponder implements Responder {
  private apiKey: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.OPENAI_API_KEY || "";
  }

  async transcribe(segment: AudioSegment): Promise<Transcript> {
    const formData = new FormData();
    const uint8Array = new Uint8Array(segment.data);
    const file = new Blob([uint8Array], { type: segment.mimeType });
    formData.append("file", file, "audio.webm");
    formData.append("model", "whisper-1");

    const resp = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: formData,
    });

    if (!resp.ok) {
      throw new Error(`OpenAI API error: ${resp.statusText}`);
    }

    const json = await resp.json();
    return {
      id: segment.id,
      text: json.text || "",
      confidence: 1,
    };
  }
}