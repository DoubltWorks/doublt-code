export {
  makeSession,
  makeClient,
  makeChatMessage,
  makeTokenUsage,
  makeTask,
  makeActivityEvent,
  makeApprovalRule,
  makeSearchQuery,
  makeHandoffData,
  resetCounter,
} from '../../../../shared/src/__tests__/fixtures/index.js';

import { SessionManager } from '../../session/SessionManager.js';
import { WorkspaceManager } from '../../workspace/WorkspaceManager.js';

export function makeSessionManager(): SessionManager {
  return new SessionManager();
}

export function makeWorkspaceManager(sm?: SessionManager): WorkspaceManager {
  return new WorkspaceManager(sm ?? new SessionManager());
}
