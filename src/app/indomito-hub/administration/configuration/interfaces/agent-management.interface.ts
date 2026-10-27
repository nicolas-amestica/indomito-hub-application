export interface AgentPersonality {
  displayName: string;
  role: string;
  tone: string;
  language: string;
  responseStyle: string;
  useEmoji: boolean;
  greeting: string;
  closing: string;
  forbiddenPhrases: string[];
  additionalInstructions: string;
}

export interface AgentGenerationSettings {
  model: string;
  temperature: number;
  topP: number;
  maxMessageLength: number;
  maxHistoryTurns: number;
  debounceMs: number;
  rateLimitMax: number;
  rateLimitWindowSeconds: number;
}

export interface AgentPolicies {
  offerMeetings: boolean;
  humanHandoffEnabled: boolean;
  handoffWhatsAppEnabled: boolean;
  handoffEmailEnabled: boolean;
  handoffPhone: string;
  handoffEmail: string;
  explainProgramDifferences: boolean;
  sendSernaturWithQuotations: boolean;
  handoffConfirmation: string;
  fallbackResponse: string;
}

export interface AgentCommercialPolicy {
  id: string;
  title: string;
  content: string;
  active: boolean;
  sortOrder: number;
}

export interface AgentKnowledgeEntry {
  id: string;
  title: string;
  category: string;
  questionHints: string[];
  answer: string;
  active: boolean;
  priority: number;
  requiresHuman: boolean;
}

export interface AgentProgram {
  id: string;
  name: string;
  destination: string;
  destinations?: string[];
  country: string;
  originRegions: string[];
  originCities: string[];
  description: string;
  activities: string[];
  durationDays: number;
  documentKey: string;
  fileName: string;
  active: boolean;
  sortOrder: number;
}

export interface AgentManagedConfig {
  personality: AgentPersonality;
  generation: AgentGenerationSettings;
  policies: AgentPolicies;
  commercialPolicies: AgentCommercialPolicy[];
  knowledge: AgentKnowledgeEntry[];
  programs: AgentProgram[];
}

export interface AgentConfigRevision {
  version: string;
  status: 'draft' | 'published';
  updatedAt: string;
  publishedAt?: string;
  config: AgentManagedConfig;
}

export interface AgentManagementSnapshot {
  draft: AgentConfigRevision;
  published: AgentConfigRevision | null;
  versions: AgentConfigRevision[];
}
