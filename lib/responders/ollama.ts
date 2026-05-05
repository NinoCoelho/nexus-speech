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
  private _endpoint: string;
  private _model: string;
  private _systemPrompt: string;

  constructor(options: OllamaChatOptions = {}) {
    this._endpoint = options.endpoint || "http://localhost:11434";
    this._model = options.model || "gemma3:1b";
    this._systemPrompt = options.systemPrompt ||
      "You are a helpful voice assistant. Keep responses brief and conversational. Respond in 1-3 sentences. Never use brackets or stage directions like [silence], [laughs], etc. Just speak naturally.";
  }

  getEndpoint() { return this._endpoint; }
  getModel() { return this._model; }
  getSystemPrompt() { return this._systemPrompt; }

  /**
   * Send a chat message and get a response.
   *
   * @param messages - Conversation history as `{ role, content }[]`
   * @returns The assistant's response text
   */
  async chat(messages: { role: string; content: string }[]): Promise<string> {
    const resp = await fetch(`${this._endpoint}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: this._model,
        messages: [{ role: "system", content: this._systemPrompt }, ...messages],
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
