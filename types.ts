export enum Sender {
  USER = 'user',
  AI = 'model'
}

export interface Attachment {
  type: 'image' | 'video' | 'audio';
  url: string;
  data: string; // base64
  mimeType: string;
}

export interface Message {
  id: string;
  text: string;
  sender: Sender;
  timestamp: number;
  isError?: boolean;
  attachment?: Attachment;
}

export interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  updatedAt: number;
}

export enum AppMode {
  GENERAL = 'General Chat',
  HOMEWORK = 'Homework Solver',
  CODING = 'Coding Expert',
  CREATIVE = 'Creative Studio',
  VIDEO = 'Video Creator'
}