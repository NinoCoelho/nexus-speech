/**
 * @module nexus-speech/tts
 *
 * Text-to-speech using piper-tts (same engine as Nexus).
 *
 * Calls the `piper` CLI binary to synthesize WAV audio from text.
 * Voices live in `~/.nexus/tts/piper/`.
 *
 * Requires: `pip install piper-tts`
 */

import { spawn } from "child_process";
import * as fs from "fs";
import * as path from "path";

const VOICES_DIR = path.join(process.env.HOME || "/tmp", ".nexus", "tts", "piper");
const DEFAULT_VOICE = "en_US-amy-medium";

const EMOJI_RE = /\p{Extended_Pictographic}/gu;
const SYMBOL_RE = /[\u2000-\u2BFF\u3000-\u303F\uFE00-\uFE0F]/g;
const EXTRANEOUS_RE = /\s{2,}/g;

export function normalizeForTTS(text: string): string {
  return text
    .replace(EMOJI_RE, "")
    .replace(SYMBOL_RE, "")
    .replace(EXTRANEOUS_RE, " ")
    .trim();
}

export type SynthesizeOptions = {
  voice?: string;
};

export async function synthesize(
  text: string,
  options: SynthesizeOptions = {}
): Promise<Buffer> {
  const voice = options.voice || DEFAULT_VOICE;
  const modelPath = path.join(VOICES_DIR, `${voice}.onnx`);
  const configPath = path.join(VOICES_DIR, `${voice}.onnx.json`);

  if (!fs.existsSync(modelPath) || !fs.existsSync(configPath)) {
    throw new Error(`Piper voice not found: ${voice}. Check ~/.nexus/tts/piper/`);
  }

  const cleaned = normalizeForTTS(text);

  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];

    const proc = spawn("python3", [
      "-m", "piper",
      "--model", modelPath,
      "--config", configPath,
      "--output-raw",
    ]);

    proc.stdout.on("data", (d: Buffer) => chunks.push(d));
    proc.stderr.on("data", () => {});

    proc.stdin.write(cleaned);
    proc.stdin.end();

    proc.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`piper exited with code ${code}`));
        return;
      }
      resolve(Buffer.concat(chunks));
    });

    proc.on("error", reject);
  });
}

export function wavFromRaw(rawPcm: Buffer, sampleRate = 22050): Buffer {
  const bufSize = 44 + rawPcm.length;
  const buf = Buffer.alloc(bufSize);

  buf.write("RIFF", 0);
  buf.writeUInt32LE(bufSize - 8, 4);
  buf.write("WAVE", 8);
  buf.write("fmt ", 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(sampleRate * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write("data", 36);
  buf.writeUInt32LE(rawPcm.length, 40);
  rawPcm.copy(buf, 44);

  return buf;
}
