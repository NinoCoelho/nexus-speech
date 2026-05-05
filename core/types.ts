/**
 * @module nexus-speech/core
 *
 * Core types for the nexus-speech framework.
 *
 * The framework is split into two concerns:
 * 1. **Client** — the browser-side recorder hook and types (core/recorder)
 * 2. **Server** — the backend responder interface and utilities (server)
 *
 * This module defines the shared contracts both sides agree on.
 */

/**
 * Represents a single transcribed audio segment produced by the recorder.
 *
 * Lifecycle: `transcribing` → `done` (or `amended` if the user edits the text).
 * Segments with `state === "done"` contain the final transcription and optional LLM response.
 */
export type TranscriptSegment = {
  /** Unique identifier for this segment */
  id: string;
  /** Object URL of the raw audio blob (browser only) */
  audioUrl?: string;
  /** Transcribed text (empty while `state === "transcribing"`) */
  text: string;
  /** LLM response, if the responder provides one */
  response?: string;
  /** Current state of this segment */
  state: "transcribing" | "done" | "amended";
};

/**
 * Result returned by a {@link Responder} after processing an audio blob.
 *
 * - `text` is the transcription.
 * - `response` is an optional LLM reply (set by the responder, not the hook).
 * - `blank` signals the segment contained no speech and should be discarded.
 */
export type TranscriptionResult = {
  /** Transcribed text, or empty string if no speech detected */
  text: string;
  /** Optional LLM-generated response */
  response?: string;
  /** If true, the segment was blank/non-speech and should not be displayed */
  blank?: boolean;
};

/**
 * Client-side responder contract.
 *
 * Implement this interface to connect the recorder hook to any backend.
 * The hook calls `transcribe()` with the raw audio blob and expects
 * a {@link TranscriptionResult} back.
 *
 * @example
 * ```ts
 * const myResponder: Responder = {
 *   async transcribe(blob: Blob): Promise<TranscriptionResult> {
 *     const resp = await fetch("/api/transcribe", {
 *       method: "POST",
 *       body: blob,
 *     });
 *     return resp.json();
 *   },
 * };
 * ```
 */
export type Responder = {
  /**
   * Transcribe an audio blob and optionally generate a response.
   *
   * @param blob - Raw audio data (WebM/Opus from MediaRecorder)
   * @returns Transcription result with optional response
   */
  transcribe: (blob: Blob) => Promise<TranscriptionResult>;
};

/**
 * Configuration options for the audio recorder.
 *
 * @example
 * ```ts
 * useAudioRecorder(responder, {
 *   silenceThreshold: 0.03,  // louder environments
 *   silenceMs: 1500,          // shorter pause before chunking
 *   chunkMs: 200,             // faster data collection
 * });
 * ```
 */
export type RecorderOptions = {
  /**
   * RMS amplitude threshold to consider as "speech".
   * Range: 0.0 (silence) to 1.0 (max).
   * @default 0.02
   */
  silenceThreshold?: number;
  /**
   * Milliseconds of silence before a chunk is finalized.
   * @default 2000
   */
  silenceMs?: number;
  /**
   * Milliseconds between `ondataavailable` events from MediaRecorder.
   * Smaller = more granular chunks, larger = less overhead.
   * @default 250
   */
  chunkMs?: number;
};

/**
 * Return type of {@link useAudioRecorder}.
 */
export type UseAudioRecorder = {
  /** Request microphone access and start recording */
  start: () => Promise<void>;
  /** Stop recording and release all resources (mic, audio context) */
  stop: () => void;
  /** Pause recording but keep the mic stream alive for resume */
  pause: () => void;
  /** Release all resources (mic, audio context, analyser) */
  release: () => void;
  /** Edit the transcribed text of a segment */
  amend: (segmentId: string, newText: string) => void;
  /** Resume recording after a pause (reuses the existing mic stream) */
  resume: () => void;
  /** All recorded segments in order */
  segments: TranscriptSegment[];
  /** Whether the recorder is actively listening */
  isRecording: boolean;
  /** Whether the recorder is in the process of starting up */
  isStarting: boolean;
};
