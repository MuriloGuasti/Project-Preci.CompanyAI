import React from 'react';
import { WorkflowCanvas } from '../components/agents/WorkflowCanvas';
import { NodeDrawer } from '../components/agents/NodeDrawer';
import { AiWorkflowDrawer } from '../components/agents/AiWorkflowDrawer';
import { ExecutionLogsModal } from '../components/agents/ExecutionLogsModal';

export const AgentsPage: React.FC = () => {
  return (
    <div className="relative w-full h-full flex flex-col overflow-hidden">
      <WorkflowCanvas />
      <NodeDrawer />
      <AiWorkflowDrawer />
      <ExecutionLogsModal />
    </div>
  );
};
