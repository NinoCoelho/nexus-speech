/**
 * @module nexus-speech/responders
 *
 * Concrete responder implementations you can use or extend.
 *
 * | Responder | Purpose |
 * |---|---|
 * | `WhisperResponder` | Transcription via local whisper.cpp server |
 * | `OllamaChat` | LLM chat via local Ollama |
 * | `VoiceChatResponder` | Chains whisper → ollama (sample) |
 * | `OpenAIResponder` | Transcription via OpenAI Whisper API |
 * | `MockResponder` | Returns placeholder text (dev/testing) |
 */

export { WhisperResponder } from "./whisper";
export type { WhisperResponderOptions } from "./whisper";

export { OllamaChat } from "./ollama";
export type { OllamaChatOptions } from "./ollama";

export { OpenAIResponder } from "./openai";
export type { OpenAIResponderOptions } from "./openai";

export { MockResponder } from "./mock";

export { VoiceChatResponder } from "./voice-chat";
export type { VoiceChatResponderOptions } from "./voice-chat";
