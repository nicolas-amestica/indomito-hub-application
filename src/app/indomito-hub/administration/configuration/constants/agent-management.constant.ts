import type { AgentKnowledgeEntry, AgentProgram } from '../interfaces/agent-management.interface';

export const AGENT_MODEL_OPTIONS = [
  { label: 'Gemini 3.5 Flash Lite', value: 'gemini-3.5-flash-lite' },
  { label: 'Gemini 2.5 Flash Lite', value: 'gemini-2.5-flash-lite' },
  { label: 'Gemini 2.5 Flash', value: 'gemini-2.5-flash' },
];

export const AGENT_TONE_OPTIONS = [
  { label: 'Amigable y profesional', value: 'Amigable y profesional' },
  { label: 'Cercano y breve', value: 'Cercano y breve' },
  { label: 'Formal y ejecutivo', value: 'Formal y ejecutivo' },
];

export function createKnowledgeEntry(): AgentKnowledgeEntry {
  return { id: crypto.randomUUID(), title: '', category: 'General', questionHints: [], answer: '', active: true, priority: 50, requiresHuman: false };
}

export function createAgentProgram(): AgentProgram {
  return { id: crypto.randomUUID(), name: '', destination: '', country: 'Chile', originRegions: [], originCities: [], description: '', activities: [], durationDays: 5, documentKey: '', fileName: '', active: true, sortOrder: 50 };
}
