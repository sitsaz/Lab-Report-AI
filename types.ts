
export interface Message {
  id: string;
  role: 'user' | 'model';
  text: string;
  provider?: string;
  sources?: { title?: string; uri: string }[];
  conflict?: {
    existing_info: string;
    new_info: string;
    description: string;
    reasoning?: string; // Detailed explanation
    resolved?: boolean;
    resolution?: 'kept_existing' | 'updated_new' | 'combined';
  };
  timestamp: Date;
}

export interface ReportFile {
  name: string;
  content: string; // Current edited content
  originalContent: string; // Baseline content for diffing
  lastModified: number;
}

export interface Task {
  id: string;
  text: string;
  completed: boolean;
}

export interface Citation {
  id: string;
  source: string; // URL or Title
  formatted: string; // The full bibliography entry
  inText: string; // The in-text marker e.g. (Smith, 2023) or [1]
  style: 'APA' | 'IEEE' | 'MLA';
}

export enum AppState {
  IDLE = 'IDLE',
  PROCESSING = 'PROCESSING',
  ERROR = 'ERROR'
}

export type AIProvider = 'gemini' | 'openai' | 'openrouter' | 'avalai';

export interface UsageStats {
  requestsInLastMinute: number;
  totalRequests: number;
  dailyRequestsCount: number;
  totalTokens: number;
  requestTimestamps: number[];
  lastResetDate: string;
}
