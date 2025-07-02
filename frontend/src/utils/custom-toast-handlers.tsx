import { CSSProperties } from "react";
import toast, { ToastOptions } from "react-hot-toast";
import { RuntimePullProgress } from "#/components/shared/runtime-pull-progress";

const TOAST_STYLE: CSSProperties = {
  background: "#454545",
  border: "1px solid #717888",
  color: "#fff",
  borderRadius: "4px",
};

const TOAST_OPTIONS: ToastOptions = {
  position: "top-right",
  style: TOAST_STYLE,
};

export const displayErrorToast = (error: string) => {
  toast.error(error, TOAST_OPTIONS);
};

export const displaySuccessToast = (message: string) => {
  toast.success(message, TOAST_OPTIONS);
};

let runtimePullToastId: string | null = null;

export const displayRuntimePullProgress = (
  progress: number,
  message: string,
) => {
  if (runtimePullToastId) {
    // Update existing toast
    toast.custom(
      <RuntimePullProgress progress={progress} message={message} />,
      {
        id: runtimePullToastId,
        duration: Infinity, // Keep showing until manually dismissed
        position: "top-center",
        style: {
          ...TOAST_STYLE,
          minWidth: "350px",
        },
      },
    );
  } else {
    // Create new toast
    runtimePullToastId = toast.custom(
      <RuntimePullProgress progress={progress} message={message} />,
      {
        duration: Infinity, // Keep showing until manually dismissed
        position: "top-center",
        style: {
          ...TOAST_STYLE,
          minWidth: "350px",
        },
      },
    );
  }
};

export const dismissRuntimePullProgress = () => {
  if (runtimePullToastId) {
    toast.dismiss(runtimePullToastId);
    runtimePullToastId = null;
  }
};

export const displayRuntimePullError = (error: string) => {
  dismissRuntimePullProgress();
  toast.error(`Runtime download failed: ${error}`, {
    ...TOAST_OPTIONS,
    duration: 8000, // Show error longer
    position: "top-center",
  });
};

export const displayRuntimePullComplete = (t: (key: string) => string) => {
  dismissRuntimePullProgress();
  toast.success(t("RUNTIME$PULL_COMPLETE"), {
    ...TOAST_OPTIONS,
    duration: 3000,
    position: "top-center",
  });
};
