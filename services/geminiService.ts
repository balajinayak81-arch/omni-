import { GoogleGenAI, Chat, Content, Modality } from "@google/genai";
import { SYSTEM_INSTRUCTION } from "../constants";
import { Message, Sender, AppMode, Attachment } from "../types";

let ai: GoogleGenAI | null = null;
let chatSession: Chat | null = null;

export const initializeGemini = () => {
  // Always use process.env.API_KEY
  if (!process.env.API_KEY) {
    console.error("API_KEY is missing from environment variables.");
    return;
  }
  // Re-initialize to ensure fresh key usage if needed (though env var is static usually)
  ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
};

export const createNewChat = (history: Message[] = [], mode: AppMode = AppMode.GENERAL) => {
  if (!ai) initializeGemini();
  if (!ai) throw new Error("Gemini AI client not initialized");

  // Select model based on mode
  let modelName = 'gemini-2.5-flash';
  
  if (mode === AppMode.GENERAL) {
    modelName = 'gemini-2.5-flash-lite-latest';
  } else if (mode === AppMode.CODING || mode === AppMode.HOMEWORK) {
    modelName = 'gemini-2.5-flash'; // Use standard flash for reasoning
  }

  // Convert internal Message format to Gemini Content format
  const geminiHistory: Content[] = history
    .filter(msg => !msg.isError && !msg.attachment) // Filter out messages with attachments for history to keep context clean for now, or handle them if supported
    .map(msg => ({
      role: msg.sender,
      parts: [{ text: msg.text }]
    }));

  chatSession = ai.chats.create({
    model: modelName,
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
  attachment: Attachment | undefined,
  mode: AppMode,
  onChunk: (text: string) => void
): Promise<string> => {
  if (!ai) initializeGemini();
  if (!ai) throw new Error("AI Client not ready");

  // Dynamic Model Selection for Single Turn with Attachments
  if (attachment) {
    // If we have an attachment, we use generateContentStream instead of chat for this turn to allow changing models
    // Video requires Pro
    // Audio requires Flash
    let model = 'gemini-2.5-flash';
    if (attachment.type === 'video') {
      model = 'gemini-3-pro-preview';
    } else if (attachment.type === 'audio') {
      model = 'gemini-2.5-flash';
    }

    const parts: any[] = [
      {
        inlineData: {
          mimeType: attachment.mimeType,
          data: attachment.data
        }
      }
    ];
    
    if (text) {
      parts.push({ text });
    }

    const response = await ai.models.generateContentStream({
      model,
      contents: { parts },
      config: {
        systemInstruction: SYSTEM_INSTRUCTION
      }
    });

    let fullText = "";
    for await (const chunk of response) {
      const chunkText = chunk.text;
      if (chunkText) {
        fullText += chunkText;
        onChunk(fullText);
      }
    }
    return fullText;

  } else {
    // Standard Chat Flow
    if (!chatSession) createNewChat(history, mode);
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
  }
};

export const generateVideo = async (prompt: string): Promise<string> => {
  // Check for API Key selection for Veo
  const win = window as any;
  if (win.aistudio && win.aistudio.hasSelectedApiKey) {
    const hasKey = await win.aistudio.hasSelectedApiKey();
    if (!hasKey) {
      await win.aistudio.openSelectKey();
      // Re-init AI with potentially new key in environment (although strictly the key is injected)
      // We must rely on the environment variable being updated or the client picking it up.
      // The prompt says "Create a new GoogleGenAI instance right before making an API call"
      initializeGemini();
    }
  }
  
  if (!ai) initializeGemini();
  if (!ai) throw new Error("AI Client not ready");

  let operation = await ai.models.generateVideos({
    model: 'veo-3.1-fast-generate-preview',
    prompt: prompt,
    config: {
      numberOfVideos: 1,
      resolution: '720p',
      aspectRatio: '16:9'
    }
  });

  // Polling
  while (!operation.done) {
    await new Promise(resolve => setTimeout(resolve, 5000));
    operation = await ai.operations.getVideosOperation({operation: operation});
  }

  const videoUri = operation.response?.generatedVideos?.[0]?.video?.uri;
  if (!videoUri) throw new Error("No video generated");

  return `${videoUri}&key=${process.env.API_KEY}`;
};

export const generateSpeech = async (text: string): Promise<ArrayBuffer> => {
  if (!ai) initializeGemini();
  if (!ai) throw new Error("AI Client not ready");

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-preview-tts",
    contents: [{ parts: [{ text }] }],
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: 'Kore' },
        },
      },
    },
  });

  const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  if (!base64Audio) throw new Error("No audio generated");

  const binaryString = atob(base64Audio);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
};