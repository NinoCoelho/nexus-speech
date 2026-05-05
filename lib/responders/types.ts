export interface AudioSegment {
  id: string;
  data: Buffer;
  mimeType: string;
}

export interface Transcript {
  id: string;
  text: string;
  confidence?: number;
}

export interface Responder {
  transcribe(segment: AudioSegment): Promise<Transcript>;
}