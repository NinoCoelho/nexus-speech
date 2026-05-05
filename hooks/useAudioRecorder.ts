import { useState, useEffect, useRef, useCallback } from "react";

export type TranscriptSegment = {
  id: string;
  audioUrl?: string;
  text: string;
  response?: string;
  state: "pending" | "transcribing" | "responding" | "done" | "amended";
};

export type TranscriptionResult = {
  text: string;
  response?: string;
};

export type Responder = {
  transcribe: (blob: Blob) => Promise<TranscriptionResult>;
};

export type RecorderOptions = {
  silenceThreshold?: number;
  silenceMs?: number;
  chunkMs?: number;
};

export type UseAudioRecorder = {
  start: () => Promise<void>;
  stop: () => void;
  pause: () => void;
  release: () => void;
  amend: (segmentId: string, newText: string) => void;
  resume: () => void;
  segments: TranscriptSegment[];
  isRecording: boolean;
  isStarting: boolean;
};

export function useAudioRecorder(
  backendResponder: Responder,
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
    const level = rmsLevel();
    const now = performance.now();

    if (level > silenceThreshold) {
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

        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType,
        });
        chunksRef.current = [];

        const segmentId = crypto.randomUUID();
        const url = URL.createObjectURL(blob);

        setSegments((prev) => [
          ...prev,
          {
            id: segmentId,
            audioUrl: url,
            text: "",
            state: "transcribing",
          },
        ]);

        const result = await backendResponder.transcribe(blob);

        setSegments((prev) =>
          prev.map((s) =>
            s.id === segmentId
              ? { ...s, text: result.text, response: result.response, state: "done" }
              : s
          )
        );

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
        s.id === segmentId
          ? { ...s, text: newText, state: "amended" }
          : s
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
    return () => {
      stop();
    };
  }, [stop]);

  return {
    start,
    stop,
    pause,
    release,
    amend,
    resume,
    segments,
    isRecording,
    isStarting,
  };
}