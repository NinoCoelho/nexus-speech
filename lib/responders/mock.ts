/**
 * @module nexus-speech/responders/mock
 *
 * Mock responder for development and testing.
 * Returns a placeholder string after a configurable delay.
 */

import type { AudioSegment, TranscriptResult } from "@/server/types";

export class MockResponder {
  private delayMs: number;

  constructor(delayMs = 800) {
    this.delayMs = delayMs;
  }

  async process(segment: AudioSegment): Promise<TranscriptResult> {
    await new Promise((r) => setTimeout(r, this.delayMs));
    return {
      text: `Mock transcription of segment ${segment.id.slice(0, 8)}`,
      response: "This is a mock response. Connect a real responder for actual results.",
    };
  }
}
