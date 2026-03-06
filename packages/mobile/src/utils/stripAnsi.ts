/**
 * Strip ANSI escape sequences from a string.
 * Covers CSI (with ? modifier), OSC, single-char escapes, SS2/SS3, and C0 controls.
 */
export function stripAnsi(str: string): string {
  return str.replace(
    // eslint-disable-next-line no-control-regex
    /\x1b(?:\[[0-9;?]*[ -/]*[A-Za-z@-~]|\][^\x07\x1b]*(?:\x07|\x1b\\)|[()#][A-Za-z0-9]|[A-Za-z=>])|[\x00-\x08\x0b-\x0c\x0e-\x1f\x7f]/g,
    ''
  );
}
