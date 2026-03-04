export type QuickActionType = 'chat_send' | 'terminal_command' | 'trigger_handoff' | 'approve_all';

export interface QuickAction {
  id: string;
  label: string;
  icon: string;
  action: QuickActionType;
  payload?: string;
}

export interface CommandMacro {
  id: string;
  name: string;
  command: string;
  description: string;
  category: string;
  usageCount: number;
  createdAt: number;
}
