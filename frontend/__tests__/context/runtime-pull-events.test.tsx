import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WsClientProvider } from "#/context/ws-client-provider";
import {
  displayRuntimePullProgress,
  displayRuntimePullComplete,
  displayRuntimePullError,
} from "#/utils/custom-toast-handlers";

// Mock socket.io-client
const mockSocket = {
  on: vi.fn(),
  off: vi.fn(),
  emit: vi.fn(),
  disconnect: vi.fn(),
  connect: vi.fn(),
  connected: false,
};

vi.mock("socket.io-client", () => ({
  default: vi.fn(() => mockSocket),
  io: vi.fn(() => mockSocket),
}));

// Mock react-i18next
const mockT = vi.fn((key: string) => {
  const translations: Record<string, string> = {
    "RUNTIME$PULL_COMPLETE": "Runtime ready! You can now start using OpenHands.",
  };
  return translations[key] || key;
});

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: mockT,
  }),
}));

// Mock custom toast handlers
vi.mock("#/utils/custom-toast-handlers", () => ({
  displayRuntimePullProgress: vi.fn(),
  displayRuntimePullComplete: vi.fn(),
  displayRuntimePullError: vi.fn(),
  displayErrorToast: vi.fn(),
  displaySuccessToast: vi.fn(),
}));

// Mock other dependencies
vi.mock("#/hooks/query/use-config", () => ({
  useConfig: () => ({ data: {} }),
}));

vi.mock("#/hooks/use-conversation-id", () => ({
  useConversationId: () => "test-conversation-id",
}));

vi.mock("#/hooks/query/use-active-conversation", () => ({
  useActiveConversation: () => ({ data: null }),
}));

vi.mock("#/hooks/use-optimistic-user-message", () => ({
  useOptimisticUserMessage: () => ({
    setOptimisticUserMessage: vi.fn(),
    clearOptimisticUserMessage: vi.fn(),
  }),
}));

vi.mock("#/hooks/query/use-user-preferences", () => ({
  useUserPreferences: () => ({ data: {} }),
}));

vi.mock("#/hooks/query/use-conversation", () => ({
  useConversation: () => ({ data: null }),
}));

describe("Runtime Pull Events in WsClientProvider", () => {
  let eventHandler: (event: any) => void;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Capture the event handler when socket.on is called
    mockSocket.on.mockImplementation((eventName: string, handler: any) => {
      if (eventName === "oh_event") {
        eventHandler = handler;
      }
    });
  });

  const renderProvider = () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    
    return render(
      <QueryClientProvider client={queryClient}>
        <WsClientProvider>
          <div data-testid="child">Test Child</div>
        </WsClientProvider>
      </QueryClientProvider>
    );
  };

  describe("handleRuntimePullEvent function", () => {
    beforeEach(() => {
      renderProvider();
    });

    it("handles runtime_pull_start event", () => {
      const event = {
        runtime_pull_event: true,
        id: "runtime_pull_start",
        data: "Starting download...",
      };

      eventHandler(event);

      expect(displayRuntimePullProgress).toHaveBeenCalledWith(
        0,
        "Starting download..."
      );
    });

    it("handles runtime_pull_progress event with valid data", () => {
      const event = {
        runtime_pull_event: true,
        id: "runtime_pull_progress",
        data: {
          overall_pct: 45.5,
          message: "Downloading sandbox runtime (45.5%)",
        },
      };

      eventHandler(event);

      expect(displayRuntimePullProgress).toHaveBeenCalledWith(
        45.5,
        "Downloading sandbox runtime (45.5%)"
      );
    });

    it("handles runtime_pull_progress event with invalid data", () => {
      const event = {
        runtime_pull_event: true,
        id: "runtime_pull_progress",
        data: "invalid data format",
      };

      eventHandler(event);

      // Should not call the progress handler with invalid data
      expect(displayRuntimePullProgress).not.toHaveBeenCalled();
    });

    it("handles runtime_pull_progress event with null data", () => {
      const event = {
        runtime_pull_event: true,
        id: "runtime_pull_progress",
        data: null,
      };

      eventHandler(event);

      expect(displayRuntimePullProgress).not.toHaveBeenCalled();
    });

    it("handles runtime_pull_complete event", () => {
      const event = {
        runtime_pull_event: true,
        id: "runtime_pull_complete",
        data: "Success message",
      };

      eventHandler(event);

      expect(displayRuntimePullComplete).toHaveBeenCalledWith(mockT);
    });

    it("handles runtime_pull_failed event", () => {
      const event = {
        runtime_pull_event: true,
        id: "runtime_pull_failed",
        data: "Network timeout error",
      };

      eventHandler(event);

      expect(displayRuntimePullError).toHaveBeenCalledWith(
        "Network timeout error"
      );
    });

    it("handles unknown runtime pull event type", () => {
      const event = {
        runtime_pull_event: true,
        id: "unknown_event_type",
        data: "some data",
      };

      // Should not throw an error
      expect(() => eventHandler(event)).not.toThrow();

      // Should not call any toast handlers
      expect(displayRuntimePullProgress).not.toHaveBeenCalled();
      expect(displayRuntimePullComplete).not.toHaveBeenCalled();
      expect(displayRuntimePullError).not.toHaveBeenCalled();
    });

    it("ignores events without runtime_pull_event flag", () => {
      const event = {
        id: "runtime_pull_start",
        data: "Starting download...",
      };

      eventHandler(event);

      expect(displayRuntimePullProgress).not.toHaveBeenCalled();
    });

    it("handles events with missing id field", () => {
      const event = {
        runtime_pull_event: true,
        data: "some data",
      };

      expect(() => eventHandler(event)).not.toThrow();
      expect(displayRuntimePullProgress).not.toHaveBeenCalled();
    });

    it("handles events with missing data field", () => {
      const event = {
        runtime_pull_event: true,
        id: "runtime_pull_start",
      };

      eventHandler(event);

      expect(displayRuntimePullProgress).toHaveBeenCalledWith(0, undefined);
    });
  });

  describe("Event flow scenarios", () => {
    beforeEach(() => {
      renderProvider();
    });

    it("handles complete pull flow", () => {
      // Start event
      eventHandler({
        runtime_pull_event: true,
        id: "runtime_pull_start",
        data: "Starting...",
      });

      // Progress events
      eventHandler({
        runtime_pull_event: true,
        id: "runtime_pull_progress",
        data: { overall_pct: 25, message: "Downloading..." },
      });

      eventHandler({
        runtime_pull_event: true,
        id: "runtime_pull_progress",
        data: { overall_pct: 75, message: "Extracting..." },
      });

      // Complete event
      eventHandler({
        runtime_pull_event: true,
        id: "runtime_pull_complete",
        data: "Success!",
      });

      expect(displayRuntimePullProgress).toHaveBeenCalledTimes(3);
      expect(displayRuntimePullProgress).toHaveBeenNthCalledWith(1, 0, "Starting...");
      expect(displayRuntimePullProgress).toHaveBeenNthCalledWith(2, 25, "Downloading...");
      expect(displayRuntimePullProgress).toHaveBeenNthCalledWith(3, 75, "Extracting...");
      expect(displayRuntimePullComplete).toHaveBeenCalledTimes(1);
    });

    it("handles pull flow with error", () => {
      // Start event
      eventHandler({
        runtime_pull_event: true,
        id: "runtime_pull_start",
        data: "Starting...",
      });

      // Progress event
      eventHandler({
        runtime_pull_event: true,
        id: "runtime_pull_progress",
        data: { overall_pct: 30, message: "Downloading..." },
      });

      // Error event
      eventHandler({
        runtime_pull_event: true,
        id: "runtime_pull_failed",
        data: "Network error",
      });

      expect(displayRuntimePullProgress).toHaveBeenCalledTimes(2);
      expect(displayRuntimePullError).toHaveBeenCalledWith("Network error");
      expect(displayRuntimePullComplete).not.toHaveBeenCalled();
    });
  });

  describe("Progress data validation", () => {
    beforeEach(() => {
      renderProvider();
    });

    it("handles progress data with decimal values", () => {
      const event = {
        runtime_pull_event: true,
        id: "runtime_pull_progress",
        data: {
          overall_pct: 33.33,
          message: "Downloading (33.33%)",
        },
      };

      eventHandler(event);

      expect(displayRuntimePullProgress).toHaveBeenCalledWith(
        33.33,
        "Downloading (33.33%)"
      );
    });

    it("handles progress data with zero percent", () => {
      const event = {
        runtime_pull_event: true,
        id: "runtime_pull_progress",
        data: {
          overall_pct: 0,
          message: "Initializing...",
        },
      };

      eventHandler(event);

      expect(displayRuntimePullProgress).toHaveBeenCalledWith(
        0,
        "Initializing..."
      );
    });

    it("handles progress data with 100 percent", () => {
      const event = {
        runtime_pull_event: true,
        id: "runtime_pull_progress",
        data: {
          overall_pct: 100,
          message: "Download complete",
        },
      };

      eventHandler(event);

      expect(displayRuntimePullProgress).toHaveBeenCalledWith(
        100,
        "Download complete"
      );
    });

    it("handles progress data with missing overall_pct", () => {
      const event = {
        runtime_pull_event: true,
        id: "runtime_pull_progress",
        data: {
          message: "Downloading...",
        },
      };

      eventHandler(event);

      expect(displayRuntimePullProgress).toHaveBeenCalledWith(
        undefined,
        "Downloading..."
      );
    });

    it("handles progress data with missing message", () => {
      const event = {
        runtime_pull_event: true,
        id: "runtime_pull_progress",
        data: {
          overall_pct: 50,
        },
      };

      eventHandler(event);

      expect(displayRuntimePullProgress).toHaveBeenCalledWith(
        50,
        undefined
      );
    });

    it("handles progress data with extra fields", () => {
      const event = {
        runtime_pull_event: true,
        id: "runtime_pull_progress",
        data: {
          overall_pct: 60,
          message: "Downloading...",
          extra_field: "should be ignored",
          layer_id: "layer123",
        },
      };

      eventHandler(event);

      expect(displayRuntimePullProgress).toHaveBeenCalledWith(
        60,
        "Downloading..."
      );
    });
  });

  describe("Translation integration", () => {
    beforeEach(() => {
      renderProvider();
    });

    it("passes translation function to complete handler", () => {
      const event = {
        runtime_pull_event: true,
        id: "runtime_pull_complete",
        data: "Success",
      };

      eventHandler(event);

      expect(displayRuntimePullComplete).toHaveBeenCalledWith(mockT);
    });

    it("uses translation function correctly", () => {
      const event = {
        runtime_pull_event: true,
        id: "runtime_pull_complete",
        data: "Success",
      };

      eventHandler(event);

      // The mock should have been called with the translation function
      const calledT = displayRuntimePullComplete.mock.calls[0][0];
      expect(typeof calledT).toBe("function");
      
      // Test that the translation function works
      expect(calledT("RUNTIME$PULL_COMPLETE")).toBe(
        "Runtime ready! You can now start using OpenHands."
      );
    });
  });

  describe("Error handling robustness", () => {
    beforeEach(() => {
      renderProvider();
    });

    it("handles malformed event objects", () => {
      const malformedEvents = [
        null,
        undefined,
        "string instead of object",
        123,
        [],
        { runtime_pull_event: "not boolean" },
      ];

      malformedEvents.forEach((event) => {
        expect(() => eventHandler(event)).not.toThrow();
      });
    });

    it("handles events with circular references", () => {
      const circularEvent: any = {
        runtime_pull_event: true,
        id: "runtime_pull_start",
        data: "test",
      };
      circularEvent.self = circularEvent;

      expect(() => eventHandler(circularEvent)).not.toThrow();
    });
  });
});