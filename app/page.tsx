import { AudioRecorder } from "@/components/AudioRecorder";

export default function Home() {
  return (
    <main style={{ maxWidth: "640px", margin: "0 auto", padding: "24px" }}>
      <h1 style={{ fontSize: "24px", fontWeight: 600, marginBottom: "4px" }}>
        Nexus Speech
      </h1>
      <p style={{ color: "#666", marginBottom: "16px", fontSize: "14px" }}>
        Voice chat with local whisper.cpp + ollama
      </p>

      <AudioRecorder />
    </main>
  );
}