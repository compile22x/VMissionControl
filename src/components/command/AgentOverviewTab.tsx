"use client";

/**
 * @module AgentOverviewTab
 * @description Main overview tab showing agent status, services, resources, and logs.
 * @license GPL-3.0-only
 */

import { useEffect } from "react";
import { useAgentStore } from "@/stores/agent-store";
import { AgentStatusCard } from "./shared/AgentStatusCard";
import { ServiceTable } from "./shared/ServiceTable";
import { SystemResourceGauges } from "./shared/SystemResourceGauges";
import { LogViewer } from "./shared/LogViewer";

export function AgentOverviewTab() {
  const connected = useAgentStore((s) => s.connected);
  const status = useAgentStore((s) => s.status);
  const services = useAgentStore((s) => s.services);
  const resources = useAgentStore((s) => s.resources);
  const logs = useAgentStore((s) => s.logs);
  const fetchServices = useAgentStore((s) => s.fetchServices);
  const fetchResources = useAgentStore((s) => s.fetchResources);
  const fetchLogs = useAgentStore((s) => s.fetchLogs);
  const restartService = useAgentStore((s) => s.restartService);

  useEffect(() => {
    if (connected) {
      fetchServices();
      fetchResources();
      fetchLogs();
    }
  }, [connected, fetchServices, fetchResources, fetchLogs]);

  if (!connected || !status) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center space-y-2">
          <p className="text-sm text-text-secondary">
            No agent connected
          </p>
          <p className="text-xs text-text-tertiary">
            Enter the agent URL above and click Connect
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4 max-w-5xl">
      <AgentStatusCard status={status} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ServiceTable services={services} onRestart={restartService} />
        {resources && <SystemResourceGauges resources={resources} />}
      </div>

      <LogViewer logs={logs} onRefresh={fetchLogs} />
    </div>
  );
}
