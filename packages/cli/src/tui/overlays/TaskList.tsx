import React from 'react';
import { Box, Text, useInput } from 'ink';

interface TaskItem {
  id: string;
  name: string;
  status: string;
}

interface Props {
  tasks: TaskItem[];
  onClose: () => void;
}

export function TaskList({ tasks, onClose }: Props) {
  useInput((input, key) => {
    if (key.escape || input === 'q') {
      onClose();
    }
  });

  return (
    <Box flexDirection="column" borderStyle="round" borderColor="magenta" paddingX={1}>
      <Text bold color="magenta">Task Queue (Esc close)</Text>
      <Box flexDirection="column" marginTop={1}>
        {tasks.map((task) => {
          const statusColor = task.status === 'running' ? 'green' : task.status === 'queued' ? 'yellow' : 'gray';
          return (
            <Box key={task.id} flexDirection="row" gap={1}>
              <Text color={statusColor}>[{task.status}]</Text>
              <Text>{task.name}</Text>
            </Box>
          );
        })}
        {tasks.length === 0 && (
          <Text dimColor>No tasks in queue.</Text>
        )}
      </Box>
    </Box>
  );
}
