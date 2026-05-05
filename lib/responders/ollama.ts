/**
 * @module nexus-speech/responders/ollama
 *
 * Ollama LLM chat client for generating responses to transcribed text.
 *
 * This is NOT a transcription responder — it generates chat responses
 * using a local Ollama model (e.g. gemma3:1b).
 *
 * Typically used as a second step after transcription:
 * 1. WhisperResponder processes the audio → text
 * 2. OllamaChat generates a response to the text
 *
 * @example
 * ```ts
 * const chat = new OllamaChat();
 * const response = await chat.chat("Hello, how are you?");
 * ```
 */

export type OllamaChatOptions = {
  /** Ollama API endpoint (default: `http://localhost:11434`) */
  endpoint?: string;
  /** Model name (default: `gemma3:1b`) */
  model?: string;
  /** System prompt (default: brief voice assistant) */
  systemPrompt?: string;
};

export class OllamaChat {
  private endpoint: string;
  private model: string;
  private systemPrompt: string;

  constructor(options: OllamaChatOptions = {}) {
    this.endpoint = options.endpoint || "http://localhost:11434";
    this.model = options.model || "gemma3:1b";
    this.systemPrompt = options.systemPrompt ||
      "You are a helpful voice assistant. Keep responses brief and conversational. Respond in 1-3 sentences.";
  }

  /**
   * Send a chat message and get a response.
   *
   * @param messages - Conversation history as `{ role, content }[]`
   * @returns The assistant's response text
   */
  async chat(messages: { role: string; content: string }[]): Promise<string> {
    const resp = await fetch(`${this.endpoint}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: this.model,
        messages: [{ role: "system", content: this.systemPrompt }, ...messages],
        stream: false,
      }),
    });

    if (!resp.ok) {
      throw new Error(`Ollama error: ${resp.statusText}`);
    }

    const json = await resp.json();
    return json.message?.content || "";
  }
}
