export enum Sender {
  USER = 'user',
  AI = 'model'
}

export interface Message {
  id: string;
  text: string;
  sender: Sender;
  timestamp: number;
  isError?: boolean;
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
  CREATIVE = 'Creative Studio'
}