export type GitFileStatus = 'modified' | 'added' | 'deleted' | 'renamed' | 'untracked';

export interface GitStatus {
  branch: string;
  ahead: number;
  behind: number;
  staged: Array<{ path: string; status: GitFileStatus }>;
  unstaged: Array<{ path: string; status: GitFileStatus }>;
  untracked: string[];
  hasConflicts: boolean;
}

export interface GitCommit {
  hash: string;
  shortHash: string;
  message: string;
  author: string;
  date: number;
  files: string[];
}

export interface GitHunk {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  content: string;
}

export interface GitDiff {
  filePath: string;
  status: GitFileStatus;
  hunks: GitHunk[];
  additions: number;
  deletions: number;
}
