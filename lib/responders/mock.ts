import type { AudioSegment, Responder, Transcript } from "./types";

export class MockResponder implements Responder {
  async transcribe(segment: AudioSegment): Promise<Transcript> {
    await new Promise((r) => setTimeout(r, 800));
    const text = `Mock transcription of segment ${segment.id.slice(0, 8)}`;
    return { id: segment.id, text, confidence: 0.95 };
  }
}

export const mockResponder = new MockResponder();