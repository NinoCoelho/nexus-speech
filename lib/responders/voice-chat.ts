/**
 * @module nexus-speech/responders/voice-chat
 *
 * A composed responder that chains transcription + LLM chat.
 *
 * This is a sample implementation used by the `examples/voice-chat` app.
 * It:
 * 1. Transcribes audio via {@link WhisperResponder}
 * 2. Sends the transcription to {@link OllamaChat} for a response
 * 3. Returns both text and response
 *
 * You can swap in any combination of transcriber + LLM by implementing
 * your own composed responder.
 */

import type { AudioSegment, TranscriptResult } from "@/server/types";
import { WhisperResponder } from "./whisper";
import { OllamaChat } from "./ollama";

export type VoiceChatResponderOptions = {
  whisper?: { endpoint?: string };
  ollama?: { endpoint?: string; model?: string; systemPrompt?: string };
};

export class VoiceChatResponder {
  private whisper: WhisperResponder;
  private chat: OllamaChat;

  constructor(options: VoiceChatResponderOptions = {}) {
    this.whisper = new WhisperResponder(options.whisper);
    this.chat = new OllamaChat(options.ollama);
  }

  async process(segment: AudioSegment, messages?: { role: string; content: string }[]): Promise<TranscriptResult> {
    const transcript = await this.whisper.process(segment);

    if (transcript.blank || !transcript.text) {
      return { text: "", blank: true };
    }

    const history = messages || [];
    const response = await this.chat.chat([
      ...history,
      { role: "user", content: transcript.text },
    ]);

    return { text: transcript.text, response };
  }
}
