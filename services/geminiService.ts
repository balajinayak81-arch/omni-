import { GoogleGenAI, Chat, Content } from "@google/genai";
import { SYSTEM_INSTRUCTION } from "../constants";
import { Message, Sender } from "../types";

let ai: GoogleGenAI | null = null;
let chatSession: Chat | null = null;

export const initializeGemini = () => {
  if (!process.env.API_KEY) {
    console.error("API_KEY is missing from environment variables.");
    return;
  }
  ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
};

export const createNewChat = (history: Message[] = []) => {
  if (!ai) initializeGemini();
  if (!ai) throw new Error("Gemini AI client not initialized");

  // Convert internal Message format to Gemini Content format
  const geminiHistory: Content[] = history
    .filter(msg => !msg.isError) // Filter out error messages
    .map(msg => ({
      role: msg.sender,
      parts: [{ text: msg.text }]
    }));

  chatSession = ai.chats.create({
    model: 'gemini-2.5-flash',
    config: {
      systemInstruction: SYSTEM_INSTRUCTION,
      temperature: 0.7,
    },
    history: geminiHistory
  });
  return chatSession;
};

export const sendMessageStream = async (
  text: string, 
  history: Message[],
  onChunk: (text: string) => void
): Promise<string> => {
  if (!ai) initializeGemini();
  if (!chatSession) createNewChat(history);
  if (!chatSession) throw new Error("Failed to create chat session");

  try {
    const result = await chatSession.sendMessageStream({ message: text });
    
    let fullText = "";
    for await (const chunk of result) {
      const chunkText = chunk.text;
      if (chunkText) {
        fullText += chunkText;
        onChunk(fullText);
      }
    }
    return fullText;
  } catch (error) {
    console.error("Gemini API Error:", error);
    throw error;
  }
};
