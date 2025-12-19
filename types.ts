export type AIProvider = 'gemini' | 'openai' | 'openrouter' | 'avalai';

export interface Message {
  id: string;
  role: 'user' | 'model';
  text: string;
  provider?: AIProvider;
  sources?: { title?: string; uri: string }[];
  conflict?: {
    existing_info: string;
    new_info: string;
    description: string;
    reasoning?: string;
    resolved?: boolean;
    resolution?: 'kept_existing' | 'updated_new' | 'combined';
  };
  timestamp: Date;
}

export interface ReportFile {
  name: string;
  content: string;
  originalContent: string;
  lastModified: number;
}

export interface Task {
  id: string;
  text: string;
  completed: boolean;
}

export interface Citation {
  id: string;
  source: string;
  formatted: string;
  inText: string;
  style: 'APA' | 'IEEE' | 'MLA';
}

export interface UsageStats {
  requestsInLastMinute: number;
  totalRequests: number;
  dailyRequestsCount: number;
  totalTokens: number;
  requestTimestamps: number[];
  lastResetDate: string;
}

export enum AppState {
  IDLE = 'IDLE',
  PROCESSING = 'PROCESSING',
  ERROR = 'ERROR'
}