import { ChatSession } from '../types';

const STORAGE_KEY = 'omnichat_sessions';

export const getSessions = (): ChatSession[] => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (e) {
    console.error('Failed to load sessions', e);
    return [];
  }
};

export const saveSession = (session: ChatSession): ChatSession[] => {
  try {
    const sessions = getSessions();
    const index = sessions.findIndex(s => s.id === session.id);
    
    if (index >= 0) {
      sessions[index] = session;
    } else {
      sessions.unshift(session);
    }
    
    // Sort by updated at desc
    sessions.sort((a, b) => b.updatedAt - a.updatedAt);
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
    return sessions;
  } catch (e) {
    console.error('Failed to save session', e);
    return [];
  }
};

export const deleteSession = (id: string): ChatSession[] => {
  try {
    let sessions = getSessions();
    sessions = sessions.filter(s => s.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
    return sessions;
  } catch (e) {
    console.error('Failed to delete session', e);
    return [];
  }
};
