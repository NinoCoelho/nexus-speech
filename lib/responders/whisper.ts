/**
 * @module nexus-speech/responders/whisper
 *
 * Responder that uses a local whisper.cpp server for transcription.
 *
 * Requires:
 * - `whisper-server` running (e.g. `whisper-server -m ggml-medium.bin --port 8082`)
 * - `ffmpeg` on PATH for WebM → WAV conversion
 *
 * Flow:
 * 1. Write WebM audio to temp file
 * 2. Convert to 16kHz mono WAV via ffmpeg
 * 3. POST WAV to whisper-server `/inference` endpoint
 * 4. Return transcribed text
 */

import type { AudioSegment, TranscriptResult } from "@/server/types";
import * as fs from "fs";

export type WhisperResponderOptions = {
  /** Whisper server URL (default: `http://localhost:8082`) */
  endpoint?: string;
};

export class WhisperResponder {
  private endpoint: string;

  constructor(options: WhisperResponderOptions = {}) {
    this.endpoint = options.endpoint || "http://localhost:8082";
  }

  async process(segment: AudioSegment): Promise<TranscriptResult> {
    const audioData = Buffer.from(segment.data);

    if (audioData.length < 1000) {
      return { text: "", blank: true };
    }

    const tempWav = `/tmp/whisper-${segment.id}.wav`;
    const tempWebm = `/tmp/whisper-${segment.id}.webm`;

    fs.writeFileSync(tempWebm, audioData);

    const ffmpegExit = await new Promise<number>((resolve) => {
      const proc = require("child_process").spawn("ffmpeg", [
        "-y", "-hide_banner",
        "-f", "webm", "-i", tempWebm,
        "-ar", "16000", "-ac", "1",
        "-c:a", "pcm_s16le",
        tempWav,
      ]);
      proc.on("close", (code: number) => resolve(code ?? 1));
    });

    try { fs.unlinkSync(tempWebm); } catch {}

    if (ffmpegExit !== 0) {
      return { text: "", blank: true };
    }

    const wavData = fs.readFileSync(tempWav);
    try { fs.unlinkSync(tempWav); } catch {}

    const formData = new FormData();
    const blob = new Blob([wavData], { type: "audio/wav" });
    formData.append("file", blob, "audio.wav");

    const resp = await fetch(`${this.endpoint}/inference`, {
      method: "POST",
      body: formData as any,
    });

    if (!resp.ok) {
      return { text: "", blank: true };
    }

    const json = await resp.json();
    const text = json.text?.trim() || "";

    if (!text || /^\[.*\]$/.test(text)) {
      return { text: "", blank: true };
    }

    return { text };
  }
}
