/**
 * PaneManager — cmux-style multi-pane session management.
 *
 * Inspired by tmux's window/pane system but designed for AI sessions:
 * - Window = a group of panes (like tmux windows)
 * - Pane = a view into a single doublt session
 * - Split horizontally/vertically
 * - Navigate with keyboard shortcuts
 *
 * cmux keybindings (similar to tmux with Ctrl-b prefix):
 *   Ctrl-b c     : create new pane/session
 *   Ctrl-b n     : next pane
 *   Ctrl-b p     : previous pane
 *   Ctrl-b %     : split vertically
 *   Ctrl-b "     : split horizontally
 *   Ctrl-b x     : close pane
 *   Ctrl-b d     : detach (go to background)
 *   Ctrl-b w     : list all sessions
 *   Ctrl-b [0-9] : switch to pane by index
 *   Ctrl-b m     : show mobile pairing QR code
 *   Ctrl-b h     : trigger manual handoff
 */

import { EventEmitter } from 'node:events';
import { SessionPane, type PaneLayout } from './SessionPane.js';
import type { SessionId, SessionListItem } from '@doublt/shared';

export class PaneManager extends EventEmitter {
  private panes: SessionPane[] = [];
  private activeIndex = 0;

  get activePane(): SessionPane | undefined {
    return this.panes[this.activeIndex];
  }

  get paneCount(): number {
    return this.panes.length;
  }

  createPane(sessionId: SessionId): SessionPane {
    const pane = new SessionPane(sessionId);
    this.panes.push(pane);

    // Focus the new pane
    this.focusPane(this.panes.length - 1);

    this.emit('pane:created', pane);
    return pane;
  }

  removePane(index: number): boolean {
    if (index < 0 || index >= this.panes.length) return false;

    const pane = this.panes[index];
    this.panes.splice(index, 1);

    // Adjust active index
    if (this.panes.length === 0) {
      this.activeIndex = 0;
    } else if (this.activeIndex >= this.panes.length) {
      this.activeIndex = this.panes.length - 1;
    }

    // Re-focus
    if (this.panes[this.activeIndex]) {
      this.panes[this.activeIndex].focused = true;
    }

    this.emit('pane:removed', pane);
    return true;
  }

  focusPane(index: number): boolean {
    if (index < 0 || index >= this.panes.length) return false;

    // Unfocus current
    if (this.panes[this.activeIndex]) {
      this.panes[this.activeIndex].focused = false;
    }

    this.activeIndex = index;
    this.panes[this.activeIndex].focused = true;
    this.emit('pane:focused', this.panes[this.activeIndex]);
    return true;
  }

  nextPane(): void {
    const next = (this.activeIndex + 1) % this.panes.length;
    this.focusPane(next);
  }

  previousPane(): void {
    const prev = (this.activeIndex - 1 + this.panes.length) % this.panes.length;
    this.focusPane(prev);
  }

  getPaneBySessionId(sessionId: SessionId): SessionPane | undefined {
    return this.panes.find(p => p.sessionId === sessionId);
  }

  getAllPanes(): SessionPane[] {
    return [...this.panes];
  }

  /**
   * Calculate pane layouts for rendering.
   * Simple vertical split layout (can be extended to support grid).
   */
  calculateLayouts(termWidth: number, termHeight: number): PaneLayout[] {
    if (this.panes.length === 0) return [];

    const count = this.panes.length;

    if (count === 1) {
      return [{
        id: this.panes[0].id,
        sessionId: this.panes[0].sessionId,
        row: 0,
        col: 0,
        widthPercent: 100,
        heightPercent: 100,
        focused: this.panes[0].focused,
      }];
    }

    // For 2+ panes: use equal vertical splits
    const widthEach = 100 / count;
    return this.panes.map((pane, i) => ({
      id: pane.id,
      sessionId: pane.sessionId,
      row: 0,
      col: i,
      widthPercent: widthEach,
      heightPercent: 100,
      focused: pane.focused,
    }));
  }

  /**
   * Render the status bar (like tmux's bottom bar).
   * Shows all sessions with their state.
   */
  renderStatusBar(termWidth: number): string {
    const left = this.panes
      .map((p, i) => {
        const indicator = i === this.activeIndex ? '>' : ' ';
        return `${indicator}${p.getStatusLine()}`;
      })
      .join(' | ');

    const right = `doublt-code | ${this.panes.length} sessions`;
    const padding = Math.max(0, termWidth - left.length - right.length);

    return `${left}${' '.repeat(padding)}${right}`;
  }
}
