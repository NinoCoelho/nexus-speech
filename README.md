<p align="center">
  <strong>Nexus Speech</strong>
</p>

<p align="center">
  Plug-and-play voice recording with silence-based chunking, local transcription, and LLM chat. Part of the <a href="https://github.com/NinoCoelho/nexus">Nexus</a> platform, built on <a href="https://github.com/NinoCoelho/loom">Loom</a> patterns.
</p>

---

## What it does

- **Records audio in the browser** with silence detection — speaks, pauses, and each utterance becomes a segment
- **Transcribes locally** via whisper.cpp (no cloud APIs)
- **Responds via LLM** through Ollama (gemma3:1b by default)
- **Pluggable responder interface** — swap whisper for OpenAI, swap Ollama for any LLM, or write your own

## Architecture

```
Browser (React)                     Server (Next.js API)
┌──────────────────┐                ┌─────────────────────┐
│ useAudioRecorder │──blob──▶ POST /api/audio
│  silence detect  │                │  1. ffmpeg webm→wav  │
│  chunk on pause  │                │  2. whisper.cpp      │
│                  │◀─JSON──        │  3. ollama chat      │
│  chat UI         │                │  return text+reply   │
└──────────────────┘                └─────────────────────┘
```

## Quick start

**Prerequisites**: Node.js 18+, [ffmpeg](https://ffmpeg.org/), [whisper-cpp](https://github.com/ggml-org/whisper.cpp), [Ollama](https://ollama.ai)

```bash
# 1. Install
git clone https://github.com/NinoCoelho/nexus-speech.git
cd nexus-speech && npm install

# 2. Download whisper model
mkdir -p ~/Library/Caches/whisper-cpp
curl -L -o ~/Library/Caches/whisper-cpp/ggml-medium.bin \
  https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-medium.bin

# 3. Start whisper server
whisper-server -m ~/Library/Caches/whisper-cpp/ggml-medium.bin --port 8082

# 4. Start Ollama (if not running)
ollama serve
ollama pull gemma3:1b

# 5. Start the app
npm run dev
```

Open http://localhost:3000, click Start, and talk.

## Project structure

```
app/
  api/audio/route.ts    POST endpoint: receive audio → transcribe → respond
  page.tsx              Demo page
  layout.tsx            Root layout
components/
  AudioRecorder.tsx     Chat UI + live responder
hooks/
  useAudioRecorder.ts   Headless recorder hook (silence detection, chunking)
lib/responders/
  types.ts              Responder interface
  whisper.ts            whisper.cpp server (ffmpeg webm→wav → API call)
  ollama.ts             Ollama chat client
  openai.ts             OpenAI Whisper (cloud fallback)
  mock.ts               In-memory mock for dev
```

## Configuration

| Variable | Default | Description |
|---|---|---|
| `OLLAMA_ENDPOINT` | `http://localhost:11434` | Ollama API URL |
| `OLLAMA_MODEL` | `gemma3:1b` | Chat model |
| Whisper model | `ggml-medium.bin` | Set in whisper-server CLI |

## The headless hook

Use `useAudioRecorder` in any React UI:

```tsx
import { useAudioRecorder } from "@/hooks/useAudioRecorder";

function MyChat() {
  const { start, stop, segments, isRecording } = useAudioRecorder(myResponder);

  return (
    <div>
      <button onClick={isRecording ? stop : start}>
        {isRecording ? "Stop" : "Mic"}
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

## Responder interface

Implement this to plug in any transcription or agent backend:

```ts
interface Responder {
  transcribe(segment: AudioSegment): Promise<Transcript>;
}
```

Included responders: `WhisperResponder`, `OllamaLLM`, `OpenAIResponder`, `MockResponder`.

## Relationship to Nexus and Loom

- **[Nexus](https://github.com/NinoCoelho/nexus)** — self-evolving agent platform with vault, skills, and graph. Nexus Speech provides the voice interface layer.
- **[Loom](https://github.com/NinoCoelho/loom)** — composable AI harness framework. The responder pattern follows Loom's pluggable component philosophy.

## License

Apache-2.0
