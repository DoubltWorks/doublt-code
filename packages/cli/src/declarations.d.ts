// Ambient module declarations for uninstalled dependencies.
// These will be replaced by actual @types packages after `pnpm install`.

declare module 'react' {
  export type ReactNode = any;
  export type FC<P = {}> = (props: P) => ReactNode;
  export type Key = string | number;
  export type Dispatch<A> = (value: A) => void;
  export type SetStateAction<S> = S | ((prevState: S) => S);

  export function useState<S>(initialState: S | (() => S)): [S, Dispatch<SetStateAction<S>>];
  export function useEffect(effect: () => (void | (() => void)), deps?: readonly any[]): void;
  export function useCallback<T extends (...args: any[]) => any>(callback: T, deps: readonly any[]): T;
  export function useMemo<T>(factory: () => T, deps: readonly any[]): T;
  export function useRef<T>(initialValue: T): { current: T };
  export function createElement(type: any, props?: any, ...children: any[]): any;

  const React: {
    useState: typeof useState;
    useEffect: typeof useEffect;
    useCallback: typeof useCallback;
    useMemo: typeof useMemo;
    useRef: typeof useRef;
    createElement: typeof createElement;
  };
  export default React;
}

declare module 'react/jsx-runtime' {
  export function jsx(type: any, props: any, key?: any): any;
  export function jsxs(type: any, props: any, key?: any): any;
  export const Fragment: any;
}

declare module 'ws' {
  import { EventEmitter } from 'node:events';

  class WebSocket extends EventEmitter {
    static readonly OPEN: number;
    static readonly CLOSED: number;

    readyState: number;

    constructor(address: string, options?: any);
    send(data: string | Buffer, cb?: (err?: Error) => void): void;
    close(code?: number, reason?: string): void;
    ping(data?: any, mask?: boolean, cb?: (err: Error) => void): void;
    terminate(): void;

    on(event: 'open', listener: () => void): this;
    on(event: 'close', listener: (code: number, reason: Buffer) => void): this;
    on(event: 'message', listener: (data: Buffer | string) => void): this;
    on(event: 'error', listener: (err: Error) => void): this;
    on(event: string, listener: (...args: any[]) => void): this;
  }

  export { WebSocket };
  export default WebSocket;
}

declare module 'commander' {
  class Command {
    name(str: string): this;
    description(str: string): this;
    version(str: string): this;
    command(nameAndArgs: string): Command;
    option(flags: string, description?: string, defaultValue?: string | boolean): this;
    action(fn: (...args: any[]) => void | Promise<void>): this;
    parse(argv?: string[]): this;
  }
  export { Command };
}

declare module 'chalk' {
  interface Chalk {
    (text: string): string;
    bold: Chalk;
    dim: Chalk;
    red: Chalk;
    green: Chalk;
    yellow: Chalk;
    blue: Chalk;
    cyan: Chalk;
    gray: Chalk;
    white: Chalk;
  }
  const chalk: Chalk;
  export default chalk;
}

declare module 'qrcode-terminal' {
  function generate(text: string, opts?: { small?: boolean }, cb?: (qrcode: string) => void): void;
  export { generate };
}

declare module 'ink' {
  import type { ReactNode, FC, Key } from 'react';

  interface RenderOptions {
    stdout?: NodeJS.WriteStream;
    stdin?: NodeJS.ReadStream;
    stderr?: NodeJS.WriteStream;
    debug?: boolean;
    exitOnCtrlC?: boolean;
    patchConsole?: boolean;
  }

  interface Instance {
    rerender: (tree: ReactNode) => void;
    unmount: () => void;
    waitUntilExit: () => Promise<void>;
    cleanup: () => void;
    clear: () => void;
  }

  function render(tree: ReactNode, options?: RenderOptions): Instance;

  interface BoxProps {
    key?: Key;
    flexDirection?: 'row' | 'column' | 'row-reverse' | 'column-reverse';
    flexGrow?: number;
    flexShrink?: number;
    flexBasis?: number | string;
    flexWrap?: 'wrap' | 'nowrap' | 'wrap-reverse';
    alignItems?: 'flex-start' | 'center' | 'flex-end' | 'stretch';
    alignSelf?: 'auto' | 'flex-start' | 'center' | 'flex-end' | 'stretch';
    justifyContent?: 'flex-start' | 'center' | 'flex-end' | 'space-between' | 'space-around' | 'space-evenly';
    width?: number | string;
    height?: number | string;
    minWidth?: number | string;
    minHeight?: number | string;
    padding?: number;
    paddingX?: number;
    paddingY?: number;
    paddingTop?: number;
    paddingBottom?: number;
    paddingLeft?: number;
    paddingRight?: number;
    margin?: number;
    marginX?: number;
    marginY?: number;
    marginTop?: number;
    marginBottom?: number;
    marginLeft?: number;
    marginRight?: number;
    gap?: number;
    columnGap?: number;
    rowGap?: number;
    borderStyle?: 'single' | 'double' | 'round' | 'bold' | 'singleDouble' | 'doubleSingle' | 'classic' | 'arrow';
    borderColor?: string;
    borderTop?: boolean;
    borderBottom?: boolean;
    borderLeft?: boolean;
    borderRight?: boolean;
    overflow?: 'visible' | 'hidden';
    children?: ReactNode;
  }

  interface TextProps {
    key?: Key;
    color?: string;
    backgroundColor?: string;
    bold?: boolean;
    italic?: boolean;
    underline?: boolean;
    strikethrough?: boolean;
    dimColor?: boolean;
    inverse?: boolean;
    wrap?: 'wrap' | 'truncate' | 'truncate-start' | 'truncate-middle' | 'truncate-end';
    children?: ReactNode;
  }

  interface NewlineProps {
    count?: number;
  }

  interface SpacerProps {}

  interface StaticProps<T> {
    items: T[];
    children: (item: T, index: number) => ReactNode;
    style?: BoxProps;
  }

  const Box: FC<BoxProps>;
  const Text: FC<TextProps>;
  const Newline: FC<NewlineProps>;
  const Spacer: FC<SpacerProps>;
  function Static<T>(props: StaticProps<T>): JSX.Element;

  interface UseInputOptions {
    isActive?: boolean;
  }

  interface InputKey {
    upArrow: boolean;
    downArrow: boolean;
    leftArrow: boolean;
    rightArrow: boolean;
    pageDown: boolean;
    pageUp: boolean;
    return: boolean;
    escape: boolean;
    ctrl: boolean;
    shift: boolean;
    tab: boolean;
    backspace: boolean;
    delete: boolean;
    meta: boolean;
  }

  function useInput(inputHandler: (input: string, key: InputKey) => void, options?: UseInputOptions): void;
  function useApp(): { exit: (error?: Error) => void };
  function useStdin(): { stdin: NodeJS.ReadStream; isRawModeSupported: boolean; setRawMode: (mode: boolean) => void; internal_exitOnCtrlC: boolean };
  function useStdout(): { stdout: NodeJS.WriteStream; write: (data: string) => void };
  function useStderr(): { stderr: NodeJS.WriteStream; write: (data: string) => void };
  function useFocus(options?: { autoFocus?: boolean; isActive?: boolean; id?: string }): { isFocused: boolean };
  function useFocusManager(): { focusNext: () => void; focusPrevious: () => void; enableFocus: () => void; disableFocus: () => void; focus: (id: string) => void };

  export {
    render,
    Box,
    Text,
    Newline,
    Spacer,
    Static,
    useInput,
    useApp,
    useStdin,
    useStdout,
    useStderr,
    useFocus,
    useFocusManager,
  };
  export type {
    RenderOptions,
    Instance,
    BoxProps,
    TextProps,
    NewlineProps,
    SpacerProps,
    StaticProps,
    UseInputOptions,
    InputKey,
  };
}

declare module 'ink-text-input' {
  import type { FC } from 'react';

  interface TextInputProps {
    value: string;
    onChange: (value: string) => void;
    onSubmit?: (value: string) => void;
    placeholder?: string;
    focus?: boolean;
    mask?: string;
    showCursor?: boolean;
    highlightPastedText?: boolean;
  }

  const TextInput: FC<TextInputProps>;
  export default TextInput;
}
