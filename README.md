<p align="center">
  <strong>Nexus Speech</strong>
</p>

<p align="center">
  A plug-and-play voice framework — headless React recorder hook, pluggable server responders, and a sample voice chat app. Part of the <a href="https://github.com/NinoCoelho/nexus">Nexus</a> platform.
</p>

---

## Architecture

```
nexus-speech/
├── core/                  Reusable client framework (headless hook + types)
│   ├── types.ts           TranscriptSegment, Responder, RecorderOptions, etc.
│   ├── useAudioRecorder.ts  Silence-based recording hook
│   └── index.ts           Public API
│
├── server/                Reusable server framework (responder interface + route helper)
│   ├── types.ts           AudioSegment, TranscriptResult, ServerResponder
│   ├── route.ts           createAudioRoute() — one-liner Next.js endpoint
│   └── index.ts           Public API
│
├── lib/responders/        Concrete responder implementations
│   ├── whisper.ts         whisper.cpp server (ffmpeg webm→wav → API)
│   ├── ollama.ts          Ollama LLM chat client
│   ├── openai.ts          OpenAI Whisper API
│   ├── voice-chat.ts      Composed: whisper + ollama
│   └── mock.ts            Placeholder for dev/testing
│
├── components/            Sample UI components
│   └── AudioRecorder.tsx  VoiceChat — chat-style bubble UI
│
└── app/                   Sample Next.js app (voice chat demo)
    └── api/audio/route.ts POST endpoint using VoiceChatResponder
```

The **framework** is `core/` + `server/` — copy these into any Next.js project.

The **sample app** (`app/`, `components/`, `lib/responders/`) demonstrates a complete voice chat using local whisper.cpp + ollama.

---

## Framework: `core/` (client)

### `useAudioRecorder(responder, options?)`

Headless React hook that handles the full audio recording lifecycle:

1. Requests microphone access
2. Creates a `MediaRecorder` (WebM/Opus) + `AnalyserNode` for VAD
3. Runs a `requestAnimationFrame` loop to detect silence
4. On silence (configurable threshold + duration), finalizes a chunk
5. Calls `responder.transcribe(blob)` with the audio
6. Auto-restarts recording after each silence-triggered chunk

```tsx
import { useAudioRecorder, type Responder } from "@/core";

const responder: Responder = {
  async transcribe(blob) {
    const resp = await fetch("/api/audio", { method: "POST", body: blob });
    return resp.json(); // { text, response?, blank? }
  },
};

function MyVoiceUI() {
  const { start, pause, resume, release, segments, isRecording } =
    useAudioRecorder(responder, {
      silenceThreshold: 0.02, // RMS amplitude for "speech"
      silenceMs: 2000,        // ms of silence before chunk
      chunkMs: 250,           // ms between MediaRecorder data events
    });

  return (
    <div>
      <button onClick={isRecording ? pause : start}>
        {isRecording ? "Pause" : "Record"}
      </button>
      {segments.map((s) => (
        <div key={s.id}>
          <p>{s.text}</p>
          {s.response && <p>{s.response}</p>}
        </div>
      ))}
    </div>
  );
}
```

### Return type

| Field | Type | Description |
|---|---|---|
| `start()` | `() => Promise<void>` | Request mic + begin recording |
| `stop()` | `() => void` | Stop and release everything |
| `pause()` | `() => void` | Stop recording, keep mic alive |
| `resume()` | `() => void` | Resume from pause |
| `release()` | `() => void` | Release all resources |
| `amend(id, text)` | `(string, string) => void` | Edit a segment's text |
| `segments` | `TranscriptSegment[]` | All recorded segments |
| `isRecording` | `boolean` | Actively recording |
| `isStarting` | `boolean` | Waiting for mic permission |

### `TranscriptSegment`

```ts
{
  id: string;           // unique ID
  audioUrl?: string;    // blob URL (browser only)
  text: string;         // transcribed text
  response?: string;    // LLM response (if responder provides one)
  state: "transcribing" | "done" | "amended";
}
```

### `Responder` (client-side contract)

```ts
interface Responder {
  transcribe(blob: Blob): Promise<TranscriptionResult>;
}

interface TranscriptionResult {
  text: string;
  response?: string;
  blank?: boolean;
}
```

---

## Framework: `server/` (backend)

### `ServerResponder` interface

Implement this to process audio on the server:

```ts
interface ServerResponder {
  process(segment: AudioSegment): Promise<TranscriptResult>;
}
```

### `createAudioRoute({ responder })`

One-liner to create a Next.js App Router POST handler:

```ts
// app/api/audio/route.ts
import { createAudioRoute } from "@/server";
import { myResponder } from "@/lib/my-responder";

export const POST = createAudioRoute({ responder: myResponder });
```

The route:
1. Parses `multipart/form-data` (expects `"audio"` field)
2. Optionally reads `"messages"` field for chat history
3. Calls `responder.process(segment)`
4. Returns `{ text, response, blank }`

### `AudioSegment` (server-side)

```ts
{
  id: string;        // unique ID
  data: Buffer;      // raw audio bytes
  mimeType: string;  // e.g. "audio/webm;codecs=opus"
}
```

---

## Built-in responders (`lib/responders/`)

| Class | Purpose | Requires |
|---|---|---|
| `WhisperResponder` | Transcription via whisper.cpp server | `whisper-server` + `ffmpeg` |
| `OllamaChat` | LLM chat responses via Ollama | `ollama` running |
| `VoiceChatResponder` | Chains whisper → ollama (sample) | Both of the above |
| `OpenAIResponder` | Transcription via OpenAI API | `OPENAI_API_KEY` |
| `MockResponder` | Placeholder for dev/testing | Nothing |

### Composing a responder

```ts
import { VoiceChatResponder } from "@/lib/responders";

const responder = new VoiceChatResponder({
  whisper: { endpoint: "http://localhost:8082" },
  ollama: { endpoint: "http://localhost:11434", model: "gemma3:1b" },
});
```

Or build your own by implementing `ServerResponder`:

```ts
import type { ServerResponder, AudioSegment, TranscriptResult } from "@/server";

class MyResponder implements ServerResponder {
  async process(segment: AudioSegment): Promise<TranscriptResult> {
    const text = await myTranscriptionService(segment.data);
    const response = await myLLM(text);
    return { text, response };
  }
}
```

---

## Sample app: voice chat

The included Next.js app demonstrates a voice chat using local services.

### Prerequisites

- Node.js 18+
- [ffmpeg](https://ffmpeg.org/)
- [whisper.cpp](https://github.com/ggml-org/whisper.cpp) (`brew install whisper-cpp`)
- [Ollama](https://ollama.ai) with a model pulled (e.g. `gemma3:1b`)

### Run

```bash
# 1. Install
git clone https://github.com/NinoCoelho/nexus-speech.git
cd nexus-speech && npm install

# 2. Download whisper model (first time only)
mkdir -p ~/Library/Caches/whisper-cpp
curl -L -o ~/Library/Caches/whisper-cpp/ggml-medium.bin \
  https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-medium.bin

# 3. Start whisper server
whisper-server -m ~/Library/Caches/whisper-cpp/ggml-medium.bin --port 8082 &

# 4. Start Ollama (if not running)
ollama serve &
ollama pull gemma3:1b

# 5. Start the app
npm run dev
```

Open http://localhost:3000 and talk.

### Configuration

| Variable | Default | Description |
|---|---|---|
| `WHISPER_ENDPOINT` | `http://localhost:8082` | Whisper server URL |
| `OLLAMA_ENDPOINT` | `http://localhost:11434` | Ollama API URL |
| `OLLAMA_MODEL` | `gemma3:1b` | Chat model |

---

## Using the framework in your own project

Copy `core/` and `server/` into your Next.js project, then:

```tsx
// 1. Implement a client-side responder
const myResponder: Responder = {
  async transcribe(blob) {
    const resp = await fetch("/api/my-endpoint", { method: "POST", body: blob });
    return resp.json();
  },
};

// 2. Use the hook
const { start, stop, segments } = useAudioRecorder(myResponder);

// 3. On the server, create an endpoint
export const POST = createAudioRoute({ responder: myServerResponder });
```

---

## Relationship to Nexus and Loom

- **[Nexus](https://github.com/NinoCoelho/nexus)** — self-evolving agent platform with vault, skills, and graph. Nexus Speech provides the voice interface layer.
- **[Loom](https://github.com/NinoCoelho/loom)** — composable AI harness framework. The responder pattern follows Loom's pluggable component philosophy.

## License

Apache-2.0
