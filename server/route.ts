/**
 * @module nexus-speech/server/route
 *
 * Next.js App Router helper for creating audio processing endpoints.
 *
 * ## Usage
 *
 * ```ts
 * // app/api/audio/route.ts
 * import { createAudioRoute } from "@/server";
 * import { myResponder } from "@/lib/my-responder";
 *
 * export const POST = createAudioRoute({ responder: myResponder });
 * ```
 *
 * The route handler:
 * 1. Parses `multipart/form-data` from the request
 * 2. Extracts the audio file from the `"audio"` field
 * 3. Passes it to the responder's `process()` method
 * 4. Returns JSON: `{ text, response, blank }`
 *
 * The client can also send a `"messages"` field (JSON string) with the
 * conversation history — the responder can use this for context.
 */

import type { NextRequest } from "next/server";
import type { AudioSegment, ServerResponder, TranscriptResult } from "./types";

export type AudioRouteOptions = {
  /** The responder that will process audio segments */
  responder: ServerResponder;
};

export function createAudioRoute(options: AudioRouteOptions) {
  return async function POST(req: NextRequest) {
    try {
      const formData = await req.formData();
      const audioFile = formData.get("audio") as File | null;

      if (!audioFile) {
        return new Response(JSON.stringify({ error: "No audio file" }), { status: 400 });
      }

      const buffer = await audioFile.arrayBuffer();
      const id = crypto.randomUUID();

      const segment: AudioSegment = {
        id,
        data: Buffer.from(buffer),
        mimeType: audioFile.type || "audio/webm",
      };

      const result = await options.responder.process(segment);

      return new Response(
        JSON.stringify({
          segmentId: id,
          text: result.text,
          response: result.response || "",
          blank: result.blank || false,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    } catch (err) {
      console.error(err);
      return new Response(
        JSON.stringify({ error: "Transcription failed" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
  };
}
