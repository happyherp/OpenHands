import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import toast from "react-hot-toast";
import {
  displayRuntimePullProgress,
  displayRuntimePullComplete,
  displayRuntimePullError,
} from "#/utils/custom-toast-handlers";

// Mock react-hot-toast
vi.mock("react-hot-toast", () => ({
  default: {
    custom: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
    dismiss: vi.fn(),
  },
}));

// Mock react-i18next
const mockT = vi.fn((key: string) => {
  const translations: Record<string, string> = {
    "RUNTIME$PULL_COMPLETE": "Runtime ready! You can now start using OpenHands.",
  };
  return translations[key] || key;
});

// Mock the RuntimePullProgress component
vi.mock("#/components/shared/runtime-pull-progress", () => ({
  RuntimePullProgress: ({ progress, message }: { progress: number; message: string }) => (
    <div data-testid="runtime-pull-progress" data-progress={progress}>
      {message}
    </div>
  ),
}));

describe("Custom Toast Handlers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Make toast.custom return a mock ID
    (toast.custom as any).mockReturnValue("mock-toast-id");
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("displayRuntimePullProgress", () => {
    it("creates new toast on first call", () => {
      displayRuntimePullProgress(25, "Downloading...");

      expect(toast.custom).toHaveBeenCalledTimes(1);
      const [component, options] = (toast.custom as any).mock.calls[0];
      
      expect(options.duration).toBe(Infinity);
      expect(options.position).toBe("top-center");
      expect(options.style.minWidth).toBe("350px");
      // Note: ID is only set on update calls, not initial creation
    });

    it("updates existing toast on subsequent calls", () => {
      // First call
      displayRuntimePullProgress(25, "Starting...");
      const firstCallOptions = (toast.custom as any).mock.calls[0][1];
      const toastId = firstCallOptions.id;

      // Second call
      displayRuntimePullProgress(50, "Halfway...");
      const secondCallOptions = (toast.custom as any).mock.calls[1][1];

      expect(toast.custom).toHaveBeenCalledTimes(2);
      expect(secondCallOptions.id).toBe(toastId); // Same ID for update
    });

    it("passes correct progress and message to component", () => {
      displayRuntimePullProgress(75.5, "Almost done...");

      const [component] = (toast.custom as any).mock.calls[0];
      // The component is a React element, so we check its props
      expect(component.props.progress).toBe(75.5);
      expect(component.props.message).toBe("Almost done...");
    });

    it("maintains toast ID across multiple updates", () => {
      const progressUpdates = [
        { progress: 10, message: "Starting..." },
        { progress: 30, message: "Downloading..." },
        { progress: 60, message: "Extracting..." },
        { progress: 90, message: "Finalizing..." },
      ];

      let toastId: string | undefined;

      progressUpdates.forEach((update, index) => {
        displayRuntimePullProgress(update.progress, update.message);
        
        const options = (toast.custom as any).mock.calls[index][1];
        if (index === 0) {
          toastId = options.id;
        } else {
          expect(options.id).toBe(toastId);
        }
      });

      expect(toast.custom).toHaveBeenCalledTimes(4);
    });

    it("applies correct toast styling", () => {
      displayRuntimePullProgress(40, "Downloading...");

      const [, options] = (toast.custom as any).mock.calls[0];
      expect(options.style).toMatchObject({
        minWidth: "350px",
        background: "#454545",
        border: "1px solid #717888",
        color: "#fff",
        borderRadius: "4px",
      });
    });
  });

  describe("displayRuntimePullComplete", () => {
    it("shows success toast with correct message", () => {
      displayRuntimePullComplete(mockT);

      expect(toast.success).toHaveBeenCalledTimes(1);
      expect(toast.success).toHaveBeenCalledWith(
        "Runtime ready! You can now start using OpenHands.",
        expect.objectContaining({
          duration: 3000,
          position: "top-center",
        })
      );
    });

    it("dismisses progress toast when showing completion", () => {
      // First show progress
      displayRuntimePullProgress(100, "Complete!");
      
      // Then show completion
      displayRuntimePullComplete(mockT);

      expect(toast.dismiss).toHaveBeenCalledTimes(1);
      expect(toast.dismiss).toHaveBeenCalledWith("mock-toast-id");
    });

    it("handles completion without prior progress toast", () => {
      // Show completion without showing progress first
      displayRuntimePullComplete(mockT);

      expect(toast.success).toHaveBeenCalledTimes(1);
      // No dismiss should be called since there's no progress toast to dismiss
      expect(toast.dismiss).toHaveBeenCalledTimes(0);
    });

    it("uses translation function correctly", () => {
      const customT = vi.fn((key: string) => `Translated: ${key}`);
      displayRuntimePullComplete(customT);

      expect(customT).toHaveBeenCalledWith("RUNTIME$PULL_COMPLETE");
      expect(toast.success).toHaveBeenCalledWith(
        "Translated: RUNTIME$PULL_COMPLETE",
        expect.any(Object)
      );
    });
  });

  describe("displayRuntimePullError", () => {
    it("shows error toast with correct message", () => {
      const errorMessage = "Failed to download runtime image";
      displayRuntimePullError(errorMessage);

      expect(toast.error).toHaveBeenCalledTimes(1);
      expect(toast.error).toHaveBeenCalledWith(
        `Runtime download failed: ${errorMessage}`,
        expect.objectContaining({
          duration: 8000,
          position: "top-center",
        })
      );
    });

    it("dismisses progress toast when showing error", () => {
      // First show progress
      displayRuntimePullProgress(50, "Downloading...");
      
      // Then show error
      displayRuntimePullError("Network error");

      expect(toast.dismiss).toHaveBeenCalledTimes(1);
      expect(toast.dismiss).toHaveBeenCalledWith("mock-toast-id");
    });

    it("handles error without prior progress toast", () => {
      displayRuntimePullError("Some error");

      expect(toast.error).toHaveBeenCalledTimes(1);
      // No dismiss should be called since there's no progress toast to dismiss
      expect(toast.dismiss).toHaveBeenCalledTimes(0);
    });

    it("handles empty error message", () => {
      displayRuntimePullError("");

      expect(toast.error).toHaveBeenCalledWith(
        "Runtime download failed: ",
        expect.any(Object)
      );
    });

    it("handles long error messages", () => {
      const longError = "This is a very long error message that describes in detail what went wrong during the Docker image pull process including network timeouts and authentication failures";
      displayRuntimePullError(longError);

      expect(toast.error).toHaveBeenCalledWith(
        `Runtime download failed: ${longError}`,
        expect.any(Object)
      );
    });
  });

  describe("Toast interaction scenarios", () => {
    it("handles complete progress flow", () => {
      // Start progress
      displayRuntimePullProgress(0, "Starting...");
      expect(toast.custom).toHaveBeenCalledTimes(1);

      // Update progress multiple times
      displayRuntimePullProgress(25, "Downloading...");
      displayRuntimePullProgress(50, "Extracting...");
      displayRuntimePullProgress(75, "Finalizing...");
      expect(toast.custom).toHaveBeenCalledTimes(4);

      // Complete successfully
      displayRuntimePullComplete(mockT);
      expect(toast.success).toHaveBeenCalledTimes(1);
      expect(toast.dismiss).toHaveBeenCalledTimes(1);
    });

    it("handles progress flow with error", () => {
      // Start progress
      displayRuntimePullProgress(0, "Starting...");
      displayRuntimePullProgress(30, "Downloading...");
      expect(toast.custom).toHaveBeenCalledTimes(2);

      // Error occurs
      displayRuntimePullError("Network timeout");
      expect(toast.error).toHaveBeenCalledTimes(1);
      expect(toast.dismiss).toHaveBeenCalledTimes(1);
    });

    it("handles multiple error calls", () => {
      displayRuntimePullError("First error");
      displayRuntimePullError("Second error");

      expect(toast.error).toHaveBeenCalledTimes(2);
      // No dismiss calls since there's no progress toast to dismiss
      expect(toast.dismiss).toHaveBeenCalledTimes(0);
    });

    it("handles multiple completion calls", () => {
      displayRuntimePullComplete(mockT);
      displayRuntimePullComplete(mockT);

      expect(toast.success).toHaveBeenCalledTimes(2);
      // No dismiss calls since there's no progress toast to dismiss
      expect(toast.dismiss).toHaveBeenCalledTimes(0);
    });
  });

  describe("Toast options validation", () => {
    it("sets correct duration for progress toast", () => {
      displayRuntimePullProgress(50, "Test");
      
      const [, options] = (toast.custom as any).mock.calls[0];
      expect(options.duration).toBe(Infinity);
    });

    it("sets correct duration for success toast", () => {
      displayRuntimePullComplete(mockT);
      
      const [, options] = (toast.success as any).mock.calls[0];
      expect(options.duration).toBe(3000);
    });

    it("sets correct duration for error toast", () => {
      displayRuntimePullError("Error");
      
      const [, options] = (toast.error as any).mock.calls[0];
      expect(options.duration).toBe(8000);
    });

    it("sets correct position for all toasts", () => {
      displayRuntimePullProgress(50, "Test");
      displayRuntimePullComplete(mockT);
      displayRuntimePullError("Error");

      const progressOptions = (toast.custom as any).mock.calls[0][1];
      const successOptions = (toast.success as any).mock.calls[0][1];
      const errorOptions = (toast.error as any).mock.calls[0][1];

      expect(progressOptions.position).toBe("top-center");
      expect(successOptions.position).toBe("top-center");
      expect(errorOptions.position).toBe("top-center");
    });
  });
});