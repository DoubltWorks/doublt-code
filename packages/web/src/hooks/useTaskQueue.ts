import { useEffect, useState, useCallback } from 'react';
import type { ClientMessage, ServerMessage, Task, TaskPriority } from '@doublt/shared';
import type { ConnectionState } from './useWebSocket';

interface UseTaskQueueReturn {
  tasks: Task[];
  createTask: (title: string, description: string, priority: TaskPriority) => void;
  updateTask: (taskId: string, updates: Partial<Pick<Task, 'title' | 'description' | 'priority' | 'status'>>) => void;
  deleteTask: (taskId: string) => void;
}

export function useTaskQueue(
  send: (msg: ClientMessage) => void,
  subscribe: (handler: (msg: ServerMessage) => void) => () => void,
  connectionState: ConnectionState,
): UseTaskQueueReturn {
  const [tasks, setTasks] = useState<Task[]>([]);

  useEffect(() => {
    const unsubscribe = subscribe((msg) => {
      switch (msg.type) {
        case 'task:list:result':
          setTasks(msg.tasks);
          break;
        case 'task:created':
          setTasks((prev) => {
            if (prev.some((t) => t.id === msg.task.id)) return prev;
            return [...prev, msg.task];
          });
          break;
        case 'task:updated':
          setTasks((prev) => prev.map((t) => (t.id === msg.task.id ? msg.task : t)));
          break;
        case 'task:deleted':
          setTasks((prev) => prev.filter((t) => t.id !== msg.taskId));
          break;
      }
    });
    return unsubscribe;
  }, [subscribe]);

  useEffect(() => {
    if (connectionState === 'connected') {
      send({ type: 'task:list' });
    }
  }, [connectionState, send]);

  const createTask = useCallback(
    (title: string, description: string, priority: TaskPriority) => {
      send({ type: 'task:create', title, description, priority });
    },
    [send],
  );

  const updateTask = useCallback(
    (taskId: string, updates: Partial<Pick<Task, 'title' | 'description' | 'priority' | 'status'>>) => {
      send({ type: 'task:update', taskId, updates });
    },
    [send],
  );

  const deleteTask = useCallback(
    (taskId: string) => {
      send({ type: 'task:delete', taskId });
    },
    [send],
  );

  return { tasks, createTask, updateTask, deleteTask };
}
