import { useQueries, useQuery } from "@tanstack/react-query";
import axios from "axios";
import React from "react";
import { useSelector } from "react-redux";
import { openHands } from "#/api/open-hands-axios";
import { RUNTIME_INACTIVE_STATES } from "#/types/agent-state";
import { RootState } from "#/store";
import { useConversation } from "#/context/conversation-context";

// Host polling settings
const DEFAULT_POLL_INTERVAL = 3000;
const MAX_CONSECUTIVE_FAILURES = 3;
const REDUCED_POLL_INTERVAL = 10000; // Slower polling for problematic hosts

// Store for tracking consecutive failures by host
const failedHostsMap = new Map<string, number>();

// Check if host polling is disabled via environment variable
const isHostPollingDisabled = () => import.meta.env.VITE_DISABLE_HOST_POLLING === "true";

export const useActiveHost = () => {
  const { curAgentState } = useSelector((state: RootState) => state.agent);
  const [activeHost, setActiveHost] = React.useState<string | null>(null);

  const { conversationId } = useConversation();

  const { data } = useQuery({
    queryKey: [conversationId, "hosts"],
    queryFn: async () => {
      const response = await openHands.get<{ hosts: string[] }>(
        `/api/conversations/${conversationId}/web-hosts`,
      );
      return { hosts: Object.keys(response.data.hosts) };
    },
    enabled: !RUNTIME_INACTIVE_STATES.includes(curAgentState) && !isHostPollingDisabled(),
    initialData: { hosts: [] },
    meta: {
      disableToast: true,
    },
  });

  const apps = useQueries({
    queries: data.hosts.map((host) => {
      // Get current failure count for this host
      const failureCount = failedHostsMap.get(host) || 0;
      const isProblematicHost = failureCount >= MAX_CONSECUTIVE_FAILURES;
      
      return {
        queryKey: [conversationId, "hosts", host],
        queryFn: async () => {
          // Skip the request if host polling is disabled
          if (isHostPollingDisabled()) {
            return "";
          }
          
          try {
            // Use timeout to avoid long-hanging requests
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 2000);
            
            await axios.get(host, { 
              signal: controller.signal,
              // Using HEAD instead of GET reduces data transfer
              method: 'HEAD'
            });
            
            clearTimeout(timeoutId);
            
            // Reset failure count on success
            if (failedHostsMap.has(host)) {
              failedHostsMap.set(host, 0);
            }
            
            return host;
          } catch (e) {
            // Increment failure count
            failedHostsMap.set(host, failureCount + 1);
            return "";
          }
        },
        // Use reduced polling frequency for hosts that consistently fail
        refetchInterval: isProblematicHost ? REDUCED_POLL_INTERVAL : DEFAULT_POLL_INTERVAL,
        // Don't refetch on window focus for problematic hosts to reduce console noise
        refetchOnWindowFocus: !isProblematicHost,
        meta: {
          disableToast: true,
        },
      };
    }),
  });

  const appsData = apps.map((app) => app.data);

  React.useEffect(() => {
    const successfulApp = appsData.find((app) => app);
    setActiveHost(successfulApp || "");
  }, [appsData]);

  return { activeHost };
};
