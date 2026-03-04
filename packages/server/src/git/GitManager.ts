import { EventEmitter } from 'events';
import { execFile } from 'child_process';
import { promisify } from 'util';
import type { GitStatus, GitCommit, GitDiff, GitFileStatus, GitHunk } from '@doublt/shared';

const execFileAsync = promisify(execFile);

/**
 * GitManager — Monitors git status for session working directories.
 *
 * Provides:
 * - Status polling (branch, staged, unstaged, untracked)
 * - Commit history retrieval
 * - Diff viewing (staged and unstaged)
 *
 * Emits:
 * - git:status_changed({ sessionId, status })
 * - git:new_commit({ sessionId, commit })
 */
export class GitManager extends EventEmitter {
  private watchedPaths = new Map<string, { sessionId: string; lastBranch: string | null }>();
  private pollInterval: ReturnType<typeof setInterval> | null = null;

  constructor() {
    super();
  }

  startWatching(sessionId: string, cwd: string): void {
    this.watchedPaths.set(cwd, { sessionId, lastBranch: null });
    if (!this.pollInterval) {
      this.pollInterval = setInterval(() => this.pollAll(), 10_000);
    }
  }

  stopWatching(cwd: string): void {
    this.watchedPaths.delete(cwd);
    if (this.watchedPaths.size === 0 && this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }

  private async pollAll(): Promise<void> {
    for (const [cwd, info] of this.watchedPaths) {
      try {
        const status = await this.getStatus(cwd);
        if (status.branch !== info.lastBranch) {
          info.lastBranch = status.branch;
          this.emit('git:status_changed', { sessionId: info.sessionId, status });
        }
      } catch {
        // Not a git repo or git not available
      }
    }
  }

  async getStatus(cwd: string): Promise<GitStatus> {
    const [branchResult, statusResult] = await Promise.all([
      execFileAsync('git', ['branch', '--show-current'], { cwd }).catch(() => ({ stdout: '' })),
      execFileAsync('git', ['status', '--porcelain=v1', '-b'], { cwd }).catch(() => ({ stdout: '' })),
    ]);

    const branch = branchResult.stdout.trim() || 'HEAD';
    const lines = statusResult.stdout.trim().split('\n').filter(Boolean);

    let ahead = 0;
    let behind = 0;
    const staged: GitStatus['staged'] = [];
    const unstaged: GitStatus['unstaged'] = [];
    const untracked: string[] = [];
    let hasConflicts = false;

    for (const line of lines) {
      if (line.startsWith('##')) {
        const aheadMatch = line.match(/ahead (\d+)/);
        const behindMatch = line.match(/behind (\d+)/);
        if (aheadMatch) ahead = parseInt(aheadMatch[1], 10);
        if (behindMatch) behind = parseInt(behindMatch[1], 10);
        continue;
      }

      const x = line[0];
      const y = line[1];
      const path = line.slice(3);

      if (x === 'U' || y === 'U' || (x === 'A' && y === 'A') || (x === 'D' && y === 'D')) {
        hasConflicts = true;
      }

      if (x === '?') {
        untracked.push(path);
      } else {
        if (x !== ' ' && x !== '?') {
          staged.push({ path, status: parseGitStatus(x) });
        }
        if (y !== ' ' && y !== '?') {
          unstaged.push({ path, status: parseGitStatus(y) });
        }
      }
    }

    return { branch, ahead, behind, staged, unstaged, untracked, hasConflicts };
  }

  async getLog(cwd: string, count = 20): Promise<GitCommit[]> {
    const separator = '---COMMIT---';
    const format = `${separator}%n%H%n%h%n%s%n%an%n%at`;

    try {
      const result = await execFileAsync(
        'git',
        ['log', `--format=${format}`, `-n${count}`, '--name-only'],
        { cwd },
      );

      const commits: GitCommit[] = [];
      const blocks = result.stdout.split(separator).filter(Boolean);

      for (const block of blocks) {
        const lines = block.trim().split('\n');
        if (lines.length < 5) continue;

        commits.push({
          hash: lines[0],
          shortHash: lines[1],
          message: lines[2],
          author: lines[3],
          date: parseInt(lines[4], 10) * 1000,
          files: lines.slice(5).filter(Boolean),
        });
      }

      return commits;
    } catch {
      return [];
    }
  }

  async getDiff(cwd: string, filePath?: string, staged = false): Promise<GitDiff[]> {
    const args = ['diff'];
    if (staged) args.push('--cached');
    if (filePath) args.push('--', filePath);

    try {
      const result = await execFileAsync('git', args, { cwd });
      return parseDiffOutput(result.stdout);
    } catch {
      return [];
    }
  }

  shutdown(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
    this.watchedPaths.clear();
  }
}

function parseGitStatus(code: string): GitFileStatus {
  switch (code) {
    case 'M': return 'modified';
    case 'A': return 'added';
    case 'D': return 'deleted';
    case 'R': return 'renamed';
    default: return 'untracked';
  }
}

function parseDiffOutput(output: string): GitDiff[] {
  const diffs: GitDiff[] = [];
  const fileParts = output.split(/^diff --git /m).filter(Boolean);

  for (const part of fileParts) {
    const lines = part.split('\n');
    const headerMatch = lines[0]?.match(/a\/(.+) b\/(.+)/);
    if (!headerMatch) continue;

    const filePath = headerMatch[2];
    let status: GitFileStatus = 'modified';
    let additions = 0;
    let deletions = 0;
    const hunks: GitHunk[] = [];

    for (const line of lines) {
      if (line.startsWith('new file')) status = 'added';
      else if (line.startsWith('deleted file')) status = 'deleted';
      else if (line.startsWith('rename')) status = 'renamed';
    }

    const hunkRegex = /^@@ -(\d+),?(\d*) \+(\d+),?(\d*) @@/;
    let currentHunk: GitHunk | null = null;

    for (const line of lines) {
      const hunkMatch = line.match(hunkRegex);
      if (hunkMatch) {
        if (currentHunk) hunks.push(currentHunk);
        currentHunk = {
          oldStart: parseInt(hunkMatch[1], 10),
          oldLines: parseInt(hunkMatch[2] || '1', 10),
          newStart: parseInt(hunkMatch[3], 10),
          newLines: parseInt(hunkMatch[4] || '1', 10),
          content: line + '\n',
        };
      } else if (currentHunk) {
        currentHunk.content += line + '\n';
        if (line.startsWith('+') && !line.startsWith('+++')) additions++;
        if (line.startsWith('-') && !line.startsWith('---')) deletions++;
      }
    }
    if (currentHunk) hunks.push(currentHunk);

    diffs.push({ filePath, status, hunks, additions, deletions });
  }

  return diffs;
}
