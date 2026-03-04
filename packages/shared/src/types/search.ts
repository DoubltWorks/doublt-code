export type SearchScope = 'all' | 'workspace' | 'session';
export type SearchResultType = 'message' | 'session' | 'workspace';

export interface SearchQuery {
  query: string;
  scope: SearchScope;
  filters?: {
    type?: SearchResultType;
    dateRange?: { from: number; to: number };
    sessionId?: string;
    workspaceId?: string;
  };
}

export interface SearchResult {
  type: SearchResultType;
  id: string;
  title: string;
  snippet: string;
  matchScore: number;
  timestamp: number;
  sessionId?: string;
  workspaceId?: string;
}

export interface SessionTemplate {
  id: string;
  name: string;
  description: string;
  category: 'code_review' | 'bug_fix' | 'feature_dev' | 'refactoring' | 'custom';
  prompts: string[];
  cwdPattern?: string;
  tags: string[];
  createdAt: number;
  usageCount: number;
}
