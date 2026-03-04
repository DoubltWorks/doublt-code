import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ApprovalPolicyManager } from '../approval/ApprovalPolicyManager.js';
import { makeApprovalRule } from './fixtures/index.js';

describe('ApprovalPolicyManager', () => {
  let manager: ApprovalPolicyManager;

  beforeEach(() => {
    manager = new ApprovalPolicyManager();
  });

  describe('CRUD operations', () => {
    it('should create a policy with auto-generated IDs', () => {
      const policy = manager.createPolicy('Test', 'Test policy', [
        makeApprovalRule({ toolPattern: 'read', action: 'auto_approve' }),
      ]);
      expect(policy.id).toBeDefined();
      expect(policy.name).toBe('Test');
      expect(policy.description).toBe('Test policy');
      expect(policy.rules).toHaveLength(1);
      expect(policy.rules[0].id).toBeDefined();
      expect(policy.enabled).toBe(true);
    });

    it('should list all policies', () => {
      manager.createPolicy('A', 'desc', []);
      manager.createPolicy('B', 'desc', []);
      expect(manager.listPolicies()).toHaveLength(2);
    });

    it('should update an existing policy', () => {
      const policy = manager.createPolicy('Old', 'old desc', []);
      const updated = manager.updatePolicy(policy.id, { name: 'New' });
      expect(updated).not.toBeNull();
      expect(updated!.name).toBe('New');
      expect(updated!.updatedAt).toBeGreaterThanOrEqual(policy.updatedAt);
    });

    it('should return null when updating non-existent policy', () => {
      expect(manager.updatePolicy('nope', { name: 'X' })).toBeNull();
    });

    it('should delete a policy', () => {
      const policy = manager.createPolicy('Del', 'desc', []);
      expect(manager.deletePolicy(policy.id)).toBe(true);
      expect(manager.listPolicies()).toHaveLength(0);
    });

    it('should return false when deleting non-existent policy', () => {
      expect(manager.deletePolicy('nope')).toBe(false);
    });

    it('should clear active policy when active policy is deleted', () => {
      const policy = manager.createPolicy('Active', 'desc', []);
      manager.setActivePolicy(policy.id);
      expect(manager.getActivePolicy()).not.toBeNull();
      manager.deletePolicy(policy.id);
      expect(manager.getActivePolicy()).toBeNull();
    });
  });

  describe('active policy', () => {
    it('should return null when no active policy', () => {
      expect(manager.getActivePolicy()).toBeNull();
    });

    it('should set and get active policy', () => {
      const policy = manager.createPolicy('P', 'desc', []);
      manager.setActivePolicy(policy.id);
      expect(manager.getActivePolicy()!.id).toBe(policy.id);
    });

    it('should throw when setting non-existent policy as active', () => {
      expect(() => manager.setActivePolicy('nope')).toThrow('not found');
    });
  });

  describe('evaluateToolUse - glob pattern matching', () => {
    it('should return require_confirm when no active policy', () => {
      const result = manager.evaluateToolUse('read', {}, 'sess-1');
      expect(result.action).toBe('require_confirm');
    });

    it('should match exact tool names', () => {
      const policy = manager.createPolicy('Test', 'desc', [
        makeApprovalRule({ toolPattern: 'read', action: 'auto_approve' }),
      ]);
      manager.setActivePolicy(policy.id);

      expect(manager.evaluateToolUse('read', {}, 's').action).toBe('auto_approve');
      expect(manager.evaluateToolUse('write', {}, 's').action).toBe('require_confirm');
    });

    it('should match wildcard patterns', () => {
      const policy = manager.createPolicy('Test', 'desc', [
        makeApprovalRule({ toolPattern: 'file_*', action: 'auto_approve' }),
      ]);
      manager.setActivePolicy(policy.id);

      expect(manager.evaluateToolUse('file_read', {}, 's').action).toBe('auto_approve');
      expect(manager.evaluateToolUse('file_write', {}, 's').action).toBe('auto_approve');
      expect(manager.evaluateToolUse('db_read', {}, 's').action).toBe('require_confirm');
    });

    it('should match catch-all pattern *', () => {
      const policy = manager.createPolicy('Test', 'desc', [
        makeApprovalRule({ toolPattern: 'read', action: 'auto_approve' }),
        makeApprovalRule({ toolPattern: '*', action: 'block' }),
      ]);
      manager.setActivePolicy(policy.id);

      expect(manager.evaluateToolUse('read', {}, 's').action).toBe('auto_approve');
      expect(manager.evaluateToolUse('anything_else', {}, 's').action).toBe('block');
    });

    it('should return the matched rule', () => {
      const policy = manager.createPolicy('Test', 'desc', [
        makeApprovalRule({ toolPattern: 'read', action: 'auto_approve' }),
      ]);
      manager.setActivePolicy(policy.id);

      const result = manager.evaluateToolUse('read', {}, 's');
      expect(result.matchedRule).toBeDefined();
      expect(result.matchedRule!.toolPattern).toBe('read');
    });

    it('should use first matching rule (order matters)', () => {
      const policy = manager.createPolicy('Test', 'desc', [
        makeApprovalRule({ toolPattern: '*', action: 'block' }),
        makeApprovalRule({ toolPattern: 'read', action: 'auto_approve' }),
      ]);
      manager.setActivePolicy(policy.id);

      // First rule (* = block) matches everything
      expect(manager.evaluateToolUse('read', {}, 's').action).toBe('block');
    });

    it('should return require_confirm when policy is disabled', () => {
      const policy = manager.createPolicy('Test', 'desc', [
        makeApprovalRule({ toolPattern: '*', action: 'auto_approve' }),
      ]);
      manager.setActivePolicy(policy.id);
      manager.updatePolicy(policy.id, { enabled: false });

      expect(manager.evaluateToolUse('read', {}, 's').action).toBe('require_confirm');
    });
  });

  describe('risk level detection', () => {
    it('should detect high risk for write/delete/exec tools', () => {
      const item1 = manager.enqueueApproval('s', 'file_write', {});
      expect(item1.riskLevel).toBe('high');

      const item2 = manager.enqueueApproval('s', 'file_delete', {});
      expect(item2.riskLevel).toBe('high');

      const item3 = manager.enqueueApproval('s', 'shell_exec', {});
      expect(item3.riskLevel).toBe('high');

      const item4 = manager.enqueueApproval('s', 'remove_file', {});
      expect(item4.riskLevel).toBe('high');
    });

    it('should detect low risk for read/list/search tools', () => {
      const item1 = manager.enqueueApproval('s', 'file_read', {});
      expect(item1.riskLevel).toBe('low');

      const item2 = manager.enqueueApproval('s', 'list_files', {});
      expect(item2.riskLevel).toBe('low');

      const item3 = manager.enqueueApproval('s', 'search_code', {});
      expect(item3.riskLevel).toBe('low');
    });

    it('should detect medium risk for other tools', () => {
      const item = manager.enqueueApproval('s', 'build_project', {});
      expect(item.riskLevel).toBe('medium');
    });
  });

  describe('presets', () => {
    it('should apply conservative preset', () => {
      const policy = manager.applyPreset('conservative');
      expect(policy.name).toBe('Conservative');
      expect(manager.getActivePolicy()!.id).toBe(policy.id);

      expect(manager.evaluateToolUse('read', {}, 's').action).toBe('auto_approve');
      expect(manager.evaluateToolUse('list', {}, 's').action).toBe('auto_approve');
      expect(manager.evaluateToolUse('search', {}, 's').action).toBe('auto_approve');
      expect(manager.evaluateToolUse('write', {}, 's').action).toBe('require_confirm');
      expect(manager.evaluateToolUse('delete', {}, 's').action).toBe('require_confirm');
    });

    it('should apply moderate preset', () => {
      const policy = manager.applyPreset('moderate');
      expect(policy.name).toBe('Moderate');

      expect(manager.evaluateToolUse('read', {}, 's').action).toBe('auto_approve');
      expect(manager.evaluateToolUse('build', {}, 's').action).toBe('auto_approve');
      expect(manager.evaluateToolUse('test', {}, 's').action).toBe('auto_approve');
      expect(manager.evaluateToolUse('write', {}, 's').action).toBe('require_confirm');
      expect(manager.evaluateToolUse('delete', {}, 's').action).toBe('block');
      expect(manager.evaluateToolUse('exec', {}, 's').action).toBe('block');
    });

    it('should apply permissive preset', () => {
      const policy = manager.applyPreset('permissive');
      expect(policy.name).toBe('Permissive');

      expect(manager.evaluateToolUse('delete', {}, 's').action).toBe('require_confirm');
      expect(manager.evaluateToolUse('remove', {}, 's').action).toBe('require_confirm');
      expect(manager.evaluateToolUse('read', {}, 's').action).toBe('auto_approve');
      expect(manager.evaluateToolUse('write', {}, 's').action).toBe('auto_approve');
    });

    it('should apply full_auto preset (auto-approve everything)', () => {
      const policy = manager.applyPreset('full_auto');
      expect(policy.name).toBe('Full Auto');

      expect(manager.evaluateToolUse('delete', {}, 's').action).toBe('auto_approve');
      expect(manager.evaluateToolUse('remove', {}, 's').action).toBe('auto_approve');
      expect(manager.evaluateToolUse('exec', {}, 's').action).toBe('auto_approve');
      expect(manager.evaluateToolUse('shell_command', {}, 's').action).toBe('auto_approve');
      expect(manager.evaluateToolUse('read', {}, 's').action).toBe('auto_approve');
      expect(manager.evaluateToolUse('write', {}, 's').action).toBe('auto_approve');
    });
  });

  describe('approval queue lifecycle', () => {
    it('should enqueue an approval item with pending status', () => {
      const item = manager.enqueueApproval('sess-1', 'file_write', { path: '/tmp' });
      expect(item.id).toBeDefined();
      expect(item.sessionId).toBe('sess-1');
      expect(item.toolName).toBe('file_write');
      expect(item.status).toBe('pending');
    });

    it('should list only pending approvals', () => {
      manager.enqueueApproval('s', 'tool1', {});
      manager.enqueueApproval('s', 'tool2', {});
      const item3 = manager.enqueueApproval('s', 'tool3', {});

      manager.decideApproval(item3.id, true, 'user');

      expect(manager.listPendingApprovals()).toHaveLength(2);
    });

    it('should approve an item', () => {
      const item = manager.enqueueApproval('s', 'tool', {});
      const decision = manager.decideApproval(item.id, true, 'admin', 'Looks safe');

      expect(decision).not.toBeNull();
      expect(decision!.approved).toBe(true);
      expect(decision!.decidedBy).toBe('admin');
      expect(decision!.reason).toBe('Looks safe');
      expect(decision!.decidedAt).toBeDefined();
    });

    it('should deny an item', () => {
      const item = manager.enqueueApproval('s', 'tool', {});
      const decision = manager.decideApproval(item.id, false, 'admin', 'Too risky');

      expect(decision!.approved).toBe(false);
    });

    it('should return null when deciding on non-existent item', () => {
      expect(manager.decideApproval('nope', true, 'user')).toBeNull();
    });

    it('should return null when deciding on already decided item', () => {
      const item = manager.enqueueApproval('s', 'tool', {});
      manager.decideApproval(item.id, true, 'user');
      expect(manager.decideApproval(item.id, false, 'user')).toBeNull();
    });
  });

  describe('events', () => {
    it('should emit policy:updated on create', () => {
      const handler = vi.fn();
      manager.on('policy:updated', handler);
      manager.createPolicy('P', 'desc', []);
      expect(handler).toHaveBeenCalledOnce();
    });

    it('should emit approval:needed on enqueue', () => {
      const handler = vi.fn();
      manager.on('approval:needed', handler);
      manager.enqueueApproval('s', 'tool', {});
      expect(handler).toHaveBeenCalledOnce();
      expect(handler.mock.calls[0][0].toolName).toBe('tool');
    });

    it('should emit approval:decided on decision', () => {
      const handler = vi.fn();
      manager.on('approval:decided', handler);
      const item = manager.enqueueApproval('s', 'tool', {});
      manager.decideApproval(item.id, true, 'user');
      expect(handler).toHaveBeenCalledOnce();
      expect(handler.mock.calls[0][0].approved).toBe(true);
    });
  });
});
