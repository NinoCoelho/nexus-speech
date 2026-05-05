"use client";

import { useAudioRecorder, type Responder, type TranscriptionResult } from "../hooks/useAudioRecorder";
import { useRef, useCallback } from "react";

function createLiveResponder(
  getMessages: () => { role: string; content: string }[],
  onBlank: (segmentId: string) => void
): Responder {
  return {
    async transcribe(blob: Blob): Promise<TranscriptionResult> {
      const formData = new FormData();
      formData.append("audio", blob, "segment.webm");
      formData.append("messages", JSON.stringify(getMessages()));

      const resp = await fetch("/api/audio", {
        method: "POST",
        body: formData,
      });

      if (!resp.ok) {
        throw new Error(`Transcription failed: ${resp.statusText}`);
      }

      const data = await resp.json();

      if (data.blank) {
        onBlank(data.segmentId);
        return { text: "", response: "" };
      }

      return { text: data.text || "", response: data.response || "" };
    },
  };
}

export function AudioRecorder() {
  const chatHistoryRef = useRef<{ role: string; content: string; _id?: string }[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const removedRef = useRef<Set<string>>(new Set());

  const handleBlank = useCallback((segmentId: string) => {
    removedRef.current.add(segmentId);
  }, []);

  const responder = createLiveResponder(() => chatHistoryRef.current, handleBlank);

  const { start, pause, release, resume, amend, segments, isRecording, isStarting } =
    useAudioRecorder(responder, {
      silenceThreshold: 0.02,
      silenceMs: 2000,
      chunkMs: 250,
    });

  const visibleSegments = segments.filter((s) => !removedRef.current.has(s.id) && s.text);
  const lastSegment = segments[segments.length - 1];

  if (lastSegment?.state === "done" && lastSegment.text && !chatHistoryRef.current.find((m) => m._id === lastSegment.id)) {
    chatHistoryRef.current.push({ role: "user", content: lastSegment.text, _id: lastSegment.id });
    if (lastSegment.response) {
      chatHistoryRef.current.push({ role: "assistant", content: lastSegment.response });
    }
    setTimeout(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
    }, 50);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "70vh", border: "1px solid #ccc", borderRadius: "8px", overflow: "hidden" }}>
      <div
        ref={scrollRef}
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "16px",
          display: "flex",
          flexDirection: "column",
          gap: "12px",
          backgroundColor: "#fafafa",
        }}
      >
        {visibleSegments.length === 0 && segments.length === 0 && (
          <div style={{ textAlign: "center", color: "#888", marginTop: "40%" }}>
            <p style={{ fontSize: "16px", marginBottom: "4px" }}>Press Start to begin</p>
            <p style={{ fontSize: "13px" }}>Speak naturally &mdash; silence triggers a new segment</p>
          </div>
        )}

        {visibleSegments.map((seg) => (
          <div key={seg.id}>
            {(seg.text || seg.state === "transcribing") && (
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <div
                  style={{
                    maxWidth: "75%",
                    padding: "10px 14px",
                    borderRadius: "16px 16px 4px 16px",
                    backgroundColor: "#3b82f6",
                    color: "white",
                    fontSize: "14px",
                    lineHeight: "1.4",
                  }}
                >
                  {seg.state === "transcribing" ? "..." : seg.text}
                </div>
              </div>
            )}
            {seg.response && (
              <div style={{ display: "flex", justifyContent: "flex-start", marginTop: "4px" }}>
                <div
                  style={{
                    maxWidth: "75%",
                    padding: "10px 14px",
                    borderRadius: "16px 16px 16px 4px",
                    backgroundColor: "#e5e5e5",
                    color: "#333",
                    fontSize: "14px",
                    lineHeight: "1.4",
                  }}
                >
                  {seg.response}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <div
        style={{
          display: "flex",
          gap: "8px",
          padding: "12px 16px",
          borderTop: "1px solid #e5e5e5",
          backgroundColor: "white",
        }}
      >
        <button
          onClick={isRecording ? pause : start}
          disabled={isStarting}
          style={{
            flex: 1,
            padding: "10px",
            borderRadius: "8px",
            border: "none",
            backgroundColor: isRecording ? "#f59e0b" : "#22c55e",
            color: "white",
            fontSize: "14px",
            fontWeight: 500,
            cursor: isStarting ? "not-allowed" : "pointer",
            opacity: isStarting ? 0.6 : 1,
          }}
        >
          {isStarting ? "Starting..." : isRecording ? "Pause" : "Start"}
        </button>
        {isRecording && (
          <button
            onClick={resume}
            style={{
              padding: "10px 16px",
              borderRadius: "8px",
              border: "none",
              backgroundColor: "#3b82f6",
              color: "white",
              fontSize: "14px",
              cursor: "pointer",
            }}
          >
            Resume
          </button>
        )}
        <button
          onClick={() => {
            release();
            chatHistoryRef.current = [];
          }}
          style={{
            padding: "10px 16px",
            borderRadius: "8px",
            border: "1px solid #ccc",
            backgroundColor: "white",
            color: "#666",
            fontSize: "14px",
            cursor: "pointer",
          }}
        >
          Clear
        </button>
      </div>
    </div>
  );
}