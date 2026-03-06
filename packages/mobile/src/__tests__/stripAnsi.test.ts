import { describe, it, expect } from 'vitest';
import { stripAnsi } from '../utils/stripAnsi';

describe('stripAnsi', () => {
  it('returns plain text unchanged', () => {
    expect(stripAnsi('hello world')).toBe('hello world');
  });

  it('returns empty string for empty input', () => {
    expect(stripAnsi('')).toBe('');
  });

  it('strips SGR color codes', () => {
    expect(stripAnsi('\x1b[31mred\x1b[0m')).toBe('red');
    expect(stripAnsi('\x1b[1;32mbold green\x1b[0m')).toBe('bold green');
  });

  it('strips multiple SGR sequences', () => {
    expect(stripAnsi('\x1b[31mred\x1b[0m and \x1b[34mblue\x1b[0m')).toBe('red and blue');
  });

  it('strips cursor movement sequences', () => {
    expect(stripAnsi('\x1b[2Jcleared')).toBe('cleared');
    expect(stripAnsi('\x1b[Hhome')).toBe('home');
    expect(stripAnsi('\x1b[10;20Hposition')).toBe('position');
  });

  it('strips CSI sequences with ? modifier', () => {
    expect(stripAnsi('\x1b[?25hvisible')).toBe('visible');
    expect(stripAnsi('\x1b[?25linvisible')).toBe('invisible');
    expect(stripAnsi('\x1b[?2004hbracketed')).toBe('bracketed');
  });

  it('strips OSC sequences (BEL terminated)', () => {
    expect(stripAnsi('\x1b]0;window title\x07content')).toBe('content');
  });

  it('strips OSC sequences (ST terminated)', () => {
    expect(stripAnsi('\x1b]0;window title\x1b\\content')).toBe('content');
  });

  it('strips single-character escape sequences', () => {
    expect(stripAnsi('\x1b=keypad\x1b>normal')).toBe('keypadnormal');
    expect(stripAnsi('\x1b(Bascii')).toBe('ascii');
  });

  it('strips C0 control characters', () => {
    expect(stripAnsi('hello\x07world')).toBe('helloworld');
    expect(stripAnsi('back\x08space')).toBe('backspace');
  });

  it('preserves newlines and tabs', () => {
    expect(stripAnsi('line1\nline2\ttab')).toBe('line1\nline2\ttab');
  });

  it('preserves carriage return', () => {
    expect(stripAnsi('hello\r\nworld')).toBe('hello\r\nworld');
  });

  it('handles mixed ANSI and plain text', () => {
    const input = '\x1b[1m$ \x1b[32mls\x1b[0m\nfile1.txt\nfile2.txt';
    expect(stripAnsi(input)).toBe('$ ls\nfile1.txt\nfile2.txt');
  });

  it('handles large strings efficiently', () => {
    const chunk = '\x1b[31mdata\x1b[0m ';
    const large = chunk.repeat(5000);
    const result = stripAnsi(large);
    expect(result).toBe('data '.repeat(5000));
  });
});
