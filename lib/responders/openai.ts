/**
 * @module nexus-speech/responders/openai
 *
 * OpenAI Whisper transcription responder.
 *
 * Uses the OpenAI `/v1/audio/transcriptions` endpoint.
 * Requires `OPENAI_API_KEY` environment variable or constructor argument.
 */

import type { AudioSegment, TranscriptResult } from "@/server/types";

export type OpenAIResponderOptions = {
  /** API key (defaults to `process.env.OPENAI_API_KEY`) */
  apiKey?: string;
};

export class OpenAIResponder {
  private apiKey: string;

  constructor(options: OpenAIResponderOptions = {}) {
    this.apiKey = options.apiKey || process.env.OPENAI_API_KEY || "";
  }

  async process(segment: AudioSegment): Promise<TranscriptResult> {
    const formData = new FormData();
    const uint8Array = new Uint8Array(segment.data);
    const file = new Blob([uint8Array], { type: segment.mimeType });
    formData.append("file", file, "audio.webm");
    formData.append("model", "whisper-1");

    const resp = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${this.apiKey}` },
      body: formData,
    });

    if (!resp.ok) {
      throw new Error(`OpenAI API error: ${resp.statusText}`);
    }

    const json = await resp.json();
    const text = json.text || "";
    return { text };
  }
}
