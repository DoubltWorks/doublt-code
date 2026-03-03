import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TaskQueueManager } from '../taskqueue/TaskQueueManager.js';

describe('TaskQueueManager', () => {
  let manager: TaskQueueManager;

  beforeEach(() => {
    vi.useFakeTimers();
    manager = new TaskQueueManager();
  });

  afterEach(() => {
    manager.destroy();
    vi.useRealTimers();
  });

  describe('CRUD operations', () => {
    it('should create a task with queued status', () => {
      const task = manager.createTask('Fix bug', 'Fix the login bug', 'high');
      expect(task.id).toBeDefined();
      expect(task.title).toBe('Fix bug');
      expect(task.description).toBe('Fix the login bug');
      expect(task.priority).toBe('high');
      expect(task.status).toBe('queued');
      expect(task.createdAt).toBeDefined();
    });

    it('should create a task with workspace and session', () => {
      const task = manager.createTask('Task', 'Desc', 'normal', 'ws-1', 'sess-1');
      expect(task.workspaceId).toBe('ws-1');
      expect(task.sessionId).toBe('sess-1');
    });

    it('should get a task by id', () => {
      const task = manager.createTask('T', 'D', 'normal');
      expect(manager.getTask(task.id)).toEqual(task);
    });

    it('should return null for non-existent task', () => {
      expect(manager.getTask('nope')).toBeNull();
    });

    it('should update a task', () => {
      const task = manager.createTask('T', 'D', 'normal');
      const updated = manager.updateTask(task.id, { title: 'Updated' });
      expect(updated).not.toBeNull();
      expect(updated!.title).toBe('Updated');
      expect(updated!.id).toBe(task.id);
    });

    it('should return null when updating non-existent task', () => {
      expect(manager.updateTask('nope', { title: 'X' })).toBeNull();
    });

    it('should delete a task', () => {
      const task = manager.createTask('T', 'D', 'normal');
      expect(manager.deleteTask(task.id)).toBe(true);
      expect(manager.getTask(task.id)).toBeNull();
    });

    it('should return false when deleting non-existent task', () => {
      expect(manager.deleteTask('nope')).toBe(false);
    });

    it('should list all tasks', () => {
      manager.createTask('A', 'D', 'normal');
      manager.createTask('B', 'D', 'high');
      expect(manager.listTasks()).toHaveLength(2);
    });

    it('should list tasks filtered by workspaceId', () => {
      manager.createTask('A', 'D', 'normal', 'ws-1');
      manager.createTask('B', 'D', 'high', 'ws-2');
      manager.createTask('C', 'D', 'low', 'ws-1');

      const ws1Tasks = manager.listTasks('ws-1');
      expect(ws1Tasks).toHaveLength(2);
      expect(ws1Tasks.every(t => t.workspaceId === 'ws-1')).toBe(true);
    });
  });

  describe('priority queue', () => {
    it('should dequeue by priority (critical > high > normal > low)', () => {
      manager.createTask('Low', 'D', 'low');
      manager.createTask('Critical', 'D', 'critical');
      manager.createTask('Normal', 'D', 'normal');
      manager.createTask('High', 'D', 'high');

      const first = manager.dequeueNext();
      expect(first!.priority).toBe('critical');
    });

    it('should dequeue by createdAt when same priority', () => {
      const t1 = manager.createTask('First', 'D', 'normal');
      manager.createTask('Second', 'D', 'normal');

      const next = manager.dequeueNext();
      expect(next!.id).toBe(t1.id);
    });

    it('should only dequeue tasks with queued status', () => {
      const t1 = manager.createTask('T1', 'D', 'high');
      manager.createTask('T2', 'D', 'normal');

      manager.startTask(t1.id);
      const next = manager.dequeueNext();
      expect(next!.priority).toBe('normal');
    });

    it('should return null when no queued tasks', () => {
      const t1 = manager.createTask('T1', 'D', 'normal');
      manager.startTask(t1.id);
      expect(manager.dequeueNext()).toBeNull();
    });
  });

  describe('status transitions', () => {
    it('should transition queued -> running', () => {
      const task = manager.createTask('T', 'D', 'normal');
      const started = manager.startTask(task.id);
      expect(started!.status).toBe('running');
      expect(started!.startedAt).toBeDefined();
    });

    it('should transition running -> completed', () => {
      const task = manager.createTask('T', 'D', 'normal');
      manager.startTask(task.id);
      const completed = manager.completeTask(task.id, 'Done!');
      expect(completed!.status).toBe('completed');
      expect(completed!.result).toBe('Done!');
      expect(completed!.completedAt).toBeDefined();
    });

    it('should transition running -> failed', () => {
      const task = manager.createTask('T', 'D', 'normal');
      manager.startTask(task.id);
      const failed = manager.failTask(task.id, 'Something broke');
      expect(failed!.status).toBe('failed');
      expect(failed!.error).toBe('Something broke');
      expect(failed!.completedAt).toBeDefined();
    });

    it('should transition to cancelled', () => {
      const task = manager.createTask('T', 'D', 'normal');
      const cancelled = manager.cancelTask(task.id);
      expect(cancelled!.status).toBe('cancelled');
      expect(cancelled!.completedAt).toBeDefined();
    });

    it('should return null for non-existent task transitions', () => {
      expect(manager.startTask('nope')).toBeNull();
      expect(manager.completeTask('nope')).toBeNull();
      expect(manager.failTask('nope')).toBeNull();
      expect(manager.cancelTask('nope')).toBeNull();
    });
  });

  describe('getRunningTasks', () => {
    it('should return only running tasks', () => {
      const t1 = manager.createTask('T1', 'D', 'normal');
      const t2 = manager.createTask('T2', 'D', 'high');
      manager.createTask('T3', 'D', 'low');

      manager.startTask(t1.id);
      manager.startTask(t2.id);

      const running = manager.getRunningTasks();
      expect(running).toHaveLength(2);
      expect(running.every(t => t.status === 'running')).toBe(true);
    });
  });

  describe('reorderTasks', () => {
    it('should reorder tasks by provided ID list', () => {
      const t1 = manager.createTask('First', 'D', 'normal');
      const t2 = manager.createTask('Second', 'D', 'normal');
      const t3 = manager.createTask('Third', 'D', 'normal');

      manager.reorderTasks([t3.id, t1.id, t2.id]);
      const list = manager.listTasks();
      expect(list[0].id).toBe(t3.id);
      expect(list[1].id).toBe(t1.id);
      expect(list[2].id).toBe(t2.id);
    });

    it('should preserve unlisted tasks at the end', () => {
      const t1 = manager.createTask('First', 'D', 'normal');
      const t2 = manager.createTask('Second', 'D', 'normal');
      const t3 = manager.createTask('Third', 'D', 'normal');

      manager.reorderTasks([t2.id]);
      const list = manager.listTasks();
      expect(list[0].id).toBe(t2.id);
      expect(list.map(t => t.id)).toContain(t1.id);
      expect(list.map(t => t.id)).toContain(t3.id);
    });
  });

  describe('scheduled tasks', () => {
    it('should schedule a task', () => {
      const task = manager.createTask('Scheduled', 'D', 'normal');
      const scheduled = manager.scheduleTask(task, '*/5 * * * *');
      expect(scheduled.cronExpression).toBe('*/5 * * * *');
      expect(scheduled.enabled).toBe(true);
      expect(scheduled.nextRunAt).toBeDefined();
    });

    it('should unschedule a task', () => {
      const task = manager.createTask('Scheduled', 'D', 'normal');
      manager.scheduleTask(task, '*/5 * * * *');
      expect(manager.unscheduleTask(task.id)).toBe(true);
    });

    it('should create new tasks when scheduled time arrives', () => {
      const task = manager.createTask('Periodic', 'D', 'normal');
      manager.scheduleTask(task, '*/1 * * * *');

      const initialCount = manager.listTasks().length;

      // Advance time past the schedule interval
      vi.advanceTimersByTime(61_000);

      expect(manager.listTasks().length).toBeGreaterThan(initialCount);
    });
  });

  describe('events', () => {
    it('should emit task:created', () => {
      const handler = vi.fn();
      manager.on('task:created', handler);
      manager.createTask('T', 'D', 'normal');
      expect(handler).toHaveBeenCalledOnce();
    });

    it('should emit task:started', () => {
      const handler = vi.fn();
      manager.on('task:started', handler);
      const task = manager.createTask('T', 'D', 'normal');
      manager.startTask(task.id);
      expect(handler).toHaveBeenCalledOnce();
    });

    it('should emit task:completed', () => {
      const handler = vi.fn();
      manager.on('task:completed', handler);
      const task = manager.createTask('T', 'D', 'normal');
      manager.startTask(task.id);
      manager.completeTask(task.id);
      expect(handler).toHaveBeenCalledOnce();
    });

    it('should emit task:failed', () => {
      const handler = vi.fn();
      manager.on('task:failed', handler);
      const task = manager.createTask('T', 'D', 'normal');
      manager.startTask(task.id);
      manager.failTask(task.id, 'err');
      expect(handler).toHaveBeenCalledOnce();
    });

    it('should emit task:cancelled', () => {
      const handler = vi.fn();
      manager.on('task:cancelled', handler);
      const task = manager.createTask('T', 'D', 'normal');
      manager.cancelTask(task.id);
      expect(handler).toHaveBeenCalledOnce();
    });
  });

  describe('destroy', () => {
    it('should clear the schedule interval', () => {
      const spy = vi.spyOn(global, 'clearInterval');
      manager.destroy();
      expect(spy).toHaveBeenCalled();
      spy.mockRestore();
    });
  });
});
