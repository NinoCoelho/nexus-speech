/**
 * @module nexus-speech/server
 *
 * Server-side types for the nexus-speech backend responder framework.
 *
 * The server framework defines the contract for processing audio segments
 * on the backend. A {@link ServerResponder} takes raw audio bytes and returns
 * a transcription (and optionally an LLM response).
 *
 * ## Implementing a responder
 *
 * ```ts
 * import { type ServerResponder, type AudioSegment, type TranscriptResult } from "@/server";
 *
 * export class MyResponder implements ServerResponder {
 *   async process(segment: AudioSegment): Promise<TranscriptResult> {
 *     const text = await callWhisper(segment.data);
 *     const response = await callLLM(text);
 *     return { text, response };
 *   }
 * }
 * ```
 *
 * ## Using the route helper
 *
 * ```ts
 * // app/api/audio/route.ts
 * import { createAudioRoute } from "@/server";
 * import { myResponder } from "@/lib/my-responder";
 *
 * export const POST = createAudioRoute({ responder: myResponder });
 * ```
 */

/**
 * Raw audio segment received by the server.
 */
export interface AudioSegment {
  /** Unique identifier */
  id: string;
  /** Raw audio bytes */
  data: Buffer;
  /** MIME type (e.g. `"audio/webm;codecs=opus"`) */
  mimeType: string;
}

/**
 * Result returned by a {@link ServerResponder} after processing audio.
 */
export interface TranscriptResult {
  /** Transcribed text, or empty string if no speech detected */
  text: string;
  /** Optional LLM response */
  response?: string;
  /** If true, the segment was blank/non-speech and should be discarded */
  blank?: boolean;
}

/**
 * Server-side responder interface.
 *
 * Implement this to create a pluggable audio processing pipeline.
 * The framework calls `process()` with each audio segment and expects
 * a {@link TranscriptResult} back.
 *
 * A typical implementation:
 * 1. Converts audio to a format the transcription service expects
 * 2. Calls the transcription service (e.g. whisper.cpp, OpenAI Whisper)
 * 3. Optionally calls an LLM to generate a response
 * 4. Returns the result
 */
export interface ServerResponder {
  /**
   * Process an audio segment and return transcription + optional response.
   *
   * @param segment - Raw audio data
   * @returns Transcription result
   */
  process(segment: AudioSegment): Promise<TranscriptResult>;
}
