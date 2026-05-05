import type { AudioSegment, Responder, Transcript } from "./types";
import * as fs from "fs";

const WHISPER_SERVER = "http://localhost:8082";

export class WhisperResponder implements Responder {
  async transcribe(segment: AudioSegment): Promise<Transcript> {
    const audioData = Buffer.from(segment.data);

    if (audioData.length < 1000) {
      return { id: segment.id, text: "[audio too short]", confidence: 0 };
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
        tempWav
      ]);
      proc.on("close", (code: number) => resolve(code ?? 1));
    });

    try { fs.unlinkSync(tempWebm); } catch {}

    if (ffmpegExit !== 0) {
      return { id: segment.id, text: "[conversion failed]", confidence: 0 };
    }

    const wavData = fs.readFileSync(tempWav);
    try { fs.unlinkSync(tempWav); } catch {}

    const formData = new FormData();
    const blob = new Blob([wavData], { type: "audio/wav" });
    formData.append("file", blob, "audio.wav");

    const resp = await fetch(`${WHISPER_SERVER}/inference`, {
      method: "POST",
      body: formData as any,
    });

    if (!resp.ok) {
      return { id: segment.id, text: "[server error]", confidence: 0 };
    }

    const json = await resp.json();
    return {
      id: segment.id,
      text: json.text?.trim() || "[no speech]",
      confidence: 0.9,
    };
  }
}

export const whisperResponder = new WhisperResponder();