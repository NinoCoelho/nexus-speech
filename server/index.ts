/**
 * @module nexus-speech/server
 *
 * Reusable server-side framework for building audio processing backends.
 *
 * Exports:
 * - Types: {@link AudioSegment}, {@link TranscriptResult}, {@link ServerResponder}
 * - {@link createAudioRoute} — one-liner Next.js App Router endpoint
 */

export type { AudioSegment, TranscriptResult, ServerResponder } from "./types";
export { createAudioRoute } from "./route";
