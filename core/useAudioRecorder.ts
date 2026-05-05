/**
 * @module nexus-speech/core/useAudioRecorder
 *
 * Headless React hook for silence-based audio recording and chunking.
 *
 * This hook handles the full lifecycle:
 * 1. Requests microphone access via `getUserMedia`
 * 2. Creates a `MediaRecorder` (WebM/Opus) and `AnalyserNode` for VAD
 * 3. Runs a `requestAnimationFrame` loop to detect silence
 * 4. On silence (configurable threshold + duration), finalizes a chunk
 * 5. Calls the {@link Responder.transcribe} method with the audio blob
 * 6. Auto-restarts recording after each silence-triggered chunk
 *
 * It is fully headless — no UI is rendered. Pair it with any React component.
 *
 * @example
 * ```tsx
 * import { useAudioRecorder, type Responder } from "@/core";
 *
 * const myResponder: Responder = {
 *   async transcribe(blob) {
 *     const resp = await fetch("/api/transcribe", { method: "POST", body: blob });
 *     return resp.json();
 *   },
 * };
 *
 * function MyComponent() {
 *   const { start, pause, resume, segments, isRecording } = useAudioRecorder(myResponder);
 *   return <button onClick={isRecording ? pause : start}>{isRecording ? "Pause" : "Record"}</button>;
 * }
 * ```
 */

import { useState, useEffect, useRef, useCallback } from "react";
import type { TranscriptSegment, TranscriptionResult, Responder, RecorderOptions, UseAudioRecorder } from "./types";

export function useAudioRecorder(
  responder: Responder,
  options: RecorderOptions = {}
): UseAudioRecorder {
  const {
    silenceThreshold = 0.02,
    silenceMs = 2000,
    chunkMs = 250,
  } = options;

  const [segments, setSegments] = useState<TranscriptSegment[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [isStarting, setIsStarting] = useState(false);

  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);

  const chunksRef = useRef<Blob[]>([]);
  const lastVoiceAtRef = useRef<number>(0);
  const isSpeakingRef = useRef<boolean>(false);
  const isAmendingRef = useRef<boolean>(false);
  const isAutoStoppedRef = useRef<boolean>(false);
  const playbackRef = useRef<HTMLAudioElement | null>(null);

  const rmsLevel = useCallback(() => {
    if (!analyserRef.current) return 0;
    const analyser = analyserRef.current;
    const data = new Uint8Array(analyser.fftSize);
    analyser.getByteTimeDomainData(data);
    let sum = 0;
    for (let i = 0; i < data.length; i++) {
      const v = (data[i] - 128) / 128;
      sum += v * v;
    }
    return Math.sqrt(sum / data.length);
  }, []);

  const detect = useCallback(() => {
    const now = performance.now();

    const level = rmsLevel();

    if (level > silenceThreshold) {
      if (playbackRef.current && !playbackRef.current.paused) {
        playbackRef.current.pause();
        playbackRef.current = null;
      }
      isSpeakingRef.current = true;
      lastVoiceAtRef.current = now;
    } else if (isSpeakingRef.current && now - lastVoiceAtRef.current > silenceMs) {
      isSpeakingRef.current = false;
      if (recorderRef.current && recorderRef.current.state === "recording") {
        isAutoStoppedRef.current = true;
        recorderRef.current.stop();
      }
    }

    rafRef.current = requestAnimationFrame(detect);
  }, [rmsLevel, silenceThreshold, silenceMs]);

  const start = async () => {
    if (isRecording || isStarting) return;
    setIsStarting(true);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const audioCtx = new AudioContext();
      audioCtxRef.current = audioCtx;
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 2048;
      source.connect(analyser);
      analyserRef.current = analyser;

      const recorder = new MediaRecorder(stream, {
        mimeType: "audio/webm;codecs=opus",
      });

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        const wasAutoStopped = isAutoStoppedRef.current;
        isAutoStoppedRef.current = false;

        if (!chunksRef.current.length || isAmendingRef.current) {
          if (wasAutoStopped) {
            chunksRef.current = [];
            recorder.start(chunkMs);
            lastVoiceAtRef.current = performance.now();
            isSpeakingRef.current = false;
            detect();
            setIsRecording(true);
          }
          return;
        }

        const blob = new Blob(chunksRef.current, { type: recorder.mimeType });
        chunksRef.current = [];

        const segmentId = crypto.randomUUID();
        const url = URL.createObjectURL(blob);

        setSegments((prev) => [
          ...prev,
          { id: segmentId, audioUrl: url, text: "", state: "transcribing" },
        ]);

        const result = await responder.transcribe(blob);

        let responseAudioUrl: string | undefined;
        if (result.responseAudio) {
          const audioBlob = new Blob(
            [Uint8Array.from(atob(result.responseAudio), (c) => c.charCodeAt(0))],
            { type: "audio/wav" }
          );
          responseAudioUrl = URL.createObjectURL(audioBlob);
        }

        setSegments((prev) =>
          prev.map((s) =>
            s.id === segmentId
              ? { ...s, text: result.text, response: result.response, responseAudioUrl, state: "done" }
              : s
          )
        );

        if (responseAudioUrl) {
          const audio = new Audio(responseAudioUrl);
          playbackRef.current = audio;
          audio.play().catch(() => {});
          audio.onended = () => { playbackRef.current = null; };
        }

        if (wasAutoStopped) {
          recorder.start(chunkMs);
          lastVoiceAtRef.current = performance.now();
          isSpeakingRef.current = false;
          detect();
          setIsRecording(true);
        }
      };

      recorder.start(chunkMs);
      recorderRef.current = recorder;
      lastVoiceAtRef.current = performance.now();
      isSpeakingRef.current = false;
      isAmendingRef.current = false;
      detect();
      setIsRecording(true);
    } finally {
      setIsStarting(false);
    }
  };

  const stop = useCallback(() => {
    if (!isRecording) return;
    if (recorderRef.current && recorderRef.current.state === "recording") {
      recorderRef.current.stop();
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    if (audioCtxRef.current) {
      audioCtxRef.current.close();
      audioCtxRef.current = null;
    }
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    setIsRecording(false);
  }, [isRecording]);

  const pause = useCallback(() => {
    if (!isRecording) return;
    if (recorderRef.current && recorderRef.current.state === "recording") {
      recorderRef.current.stop();
    }
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    setIsRecording(false);
  }, [isRecording]);

  const release = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close();
      audioCtxRef.current = null;
    }
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    recorderRef.current = null;
    analyserRef.current = null;
    setIsRecording(false);
  }, []);

  const amend = useCallback((segmentId: string, newText: string) => {
    setSegments((prev) =>
      prev.map((s) =>
        s.id === segmentId ? { ...s, text: newText, state: "amended" } : s
      )
    );
  }, []);

  const resume = useCallback(() => {
    if (!streamRef.current || !recorderRef.current) return;
    const recorder = recorderRef.current;
    if (recorder.state === "recording") return;
    chunksRef.current = [];
    isAmendingRef.current = true;
    recorder.start(chunkMs);
    lastVoiceAtRef.current = performance.now();
    isSpeakingRef.current = false;
    isAmendingRef.current = false;
    detect();
    setIsRecording(true);
  }, [chunkMs, detect]);

  useEffect(() => {
    return () => { stop(); };
  }, [stop]);

  return { start, stop, pause, release, amend, resume, segments, isRecording, isStarting };
}
