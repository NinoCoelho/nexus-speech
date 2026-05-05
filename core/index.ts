/**
 * @module nexus-speech/core
 *
 * Reusable client-side framework for silence-based audio recording.
 *
 * Exports:
 * - {@link useAudioRecorder} — headless React hook
 * - All shared types ({@link TranscriptSegment}, {@link Responder}, etc.)
 *
 * ## Quick start
 *
 * ```tsx
 * import { useAudioRecorder, type Responder } from "@/core";
 *
 * const responder: Responder = {
 *   async transcribe(blob) {
 *     const resp = await fetch("/api/audio", { method: "POST", body: blob });
 *     return resp.json();
 *   },
 * };
 *
 * function MyVoiceUI() {
 *   const { start, pause, segments, isRecording } = useAudioRecorder(responder);
 *   // render your UI
 * }
 * ```
 */

export { useAudioRecorder } from "./useAudioRecorder";
export type {
  TranscriptSegment,
  TranscriptionResult,
  Responder,
  RecorderOptions,
  UseAudioRecorder,
} from "./types";
