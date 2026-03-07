import { useEffect, useRef } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import type { ClientMessage, ServerMessage } from '@doublt/shared';

interface TerminalProps {
  sessionId: string;
  isActive: boolean;
  send: (msg: ClientMessage) => void;
  subscribe: (handler: (msg: ServerMessage) => void) => () => void;
  onFocus: () => void;
}

export function Terminal({ sessionId, isActive, send, subscribe, onFocus }: TerminalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const term = new XTerm({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', 'SF Mono', monospace",
      theme: {
        background: '#1e1e2e',
        foreground: '#cdd6f4',
        cursor: '#f5e0dc',
        selectionBackground: '#45475a',
        black: '#45475a',
        red: '#f38ba8',
        green: '#a6e3a1',
        yellow: '#f9e2af',
        blue: '#89b4fa',
        magenta: '#cba6f7',
        cyan: '#94e2d5',
        white: '#bac2de',
        brightBlack: '#585b70',
        brightRed: '#f38ba8',
        brightGreen: '#a6e3a1',
        brightYellow: '#f9e2af',
        brightBlue: '#89b4fa',
        brightMagenta: '#cba6f7',
        brightCyan: '#94e2d5',
        brightWhite: '#a6adc8',
      },
      allowProposedApi: true,
    });

    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();

    term.loadAddon(fitAddon);
    term.loadAddon(webLinksAddon);

    term.open(containerRef.current);
    fitAddon.fit();

    termRef.current = term;
    fitAddonRef.current = fitAddon;

    // Send terminal input to server
    const inputDisposable = term.onData((data) => {
      send({
        type: 'terminal:input',
        input: {
          sessionId,
          data,
          sourceClientId: '',
          timestamp: Date.now(),
        },
      });
    });

    // Send resize events
    const resizeDisposable = term.onResize(({ cols, rows }) => {
      send({
        type: 'terminal:resize',
        resize: {
          sessionId,
          cols,
          rows,
        },
      });
    });

    // Track whether scrollback has been restored to avoid writing output twice
    let scrollbackRestored = false;

    // Listen for terminal output from server
    const unsubscribe = subscribe((msg) => {
      if (msg.type === 'terminal:output' && msg.output.sessionId === sessionId) {
        term.write(msg.output.data);
      }
      // Restore scrollback buffer on session (re)attach
      if (msg.type === 'terminal:scrollback:result' && msg.sessionId === sessionId && !scrollbackRestored) {
        scrollbackRestored = true;
        if (msg.data) {
          term.write(msg.data);
        }
      }
    });

    // ResizeObserver for container size changes
    const observer = new ResizeObserver(() => {
      requestAnimationFrame(() => {
        fitAddon.fit();
      });
    });
    observer.observe(containerRef.current);

    // Initial resize notification
    const { cols, rows } = term;
    send({
      type: 'terminal:resize',
      resize: { sessionId, cols, rows, },
    });

    // Attach to session and request scrollback to restore previous output
    send({ type: 'session:attach', sessionId });
    send({ type: 'terminal:scrollback:request', sessionId });

    return () => {
      send({ type: 'session:detach', sessionId });
      inputDisposable.dispose();
      resizeDisposable.dispose();
      unsubscribe();
      observer.disconnect();
      term.dispose();
      termRef.current = null;
      fitAddonRef.current = null;
    };
  }, [sessionId, send, subscribe]);

  // Focus terminal when pane becomes active
  useEffect(() => {
    if (isActive && termRef.current) {
      termRef.current.focus();
    }
  }, [isActive]);

  return (
    <div
      ref={containerRef}
      onClick={onFocus}
      style={{
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        border: isActive ? '1px solid var(--accent)' : '1px solid transparent',
      }}
    />
  );
}
