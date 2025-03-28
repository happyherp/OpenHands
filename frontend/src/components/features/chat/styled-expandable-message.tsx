import { ReactNode } from "react";
import { Link } from "react-router";
import CheckCircle from "#/icons/check-circle-solid.svg?react";
import XCircle from "#/icons/x-circle-solid.svg?react";
import { cn } from "#/utils/utils";
import { useConfig } from "#/hooks/query/use-config";
import { ExpandableMessage } from "./expandable-message";

interface StyledExpandableMessageProps {
  title: ReactNode;
  content: ReactNode;
  type: string;
  success?: boolean;
  initialExpanded?: boolean;
  id?: string;
}

export function StyledExpandableMessage({
  title,
  content,
  type,
  success,
  initialExpanded = false,
  id,
}: StyledExpandableMessageProps) {
  const { data: config } = useConfig();
  const statusIconClasses = "h-4 w-4 ml-2 inline";

  // Special case for out of credits message
  if (
    config?.FEATURE_FLAGS.ENABLE_BILLING &&
    config?.APP_MODE === "saas" &&
    id === "STATUS$ERROR_LLM_OUT_OF_CREDITS"
  ) {
    return (
      <div
        data-testid="out-of-credits"
        className="flex gap-2 items-center justify-start border-l-2 pl-2 my-2 py-2 border-danger"
      >
        <div className="text-sm w-full">
          <div className="font-bold text-danger">{title}</div>
          <Link
            className="mt-2 mb-2 w-full h-10 rounded flex items-center justify-center gap-2 bg-primary text-[#0D0F11]"
            to="/settings/billing"
          >
            Upgrade Plan
          </Link>
        </div>
      </div>
    );
  }

  // Create a styled title with status icon if needed
  const styledTitle = (
    <div className="flex items-center justify-between w-full">
      <span
        className={cn(
          "font-bold",
          type === "error" ? "text-danger" : "text-neutral-300",
        )}
      >
        {title}
      </span>
      {type === "action" && success !== undefined && (
        <span className="flex-shrink-0">
          {success ? (
            <CheckCircle
              data-testid="status-icon"
              className={cn(statusIconClasses, "fill-success")}
            />
          ) : (
            <XCircle
              data-testid="status-icon"
              className={cn(statusIconClasses, "fill-danger")}
            />
          )}
        </span>
      )}
    </div>
  );

  return (
    <div
      className={cn(
        "flex gap-2 items-center justify-start border-l-2 pl-2 my-2 py-2",
        type === "error" ? "border-danger" : "border-neutral-300",
      )}
    >
      <div className="text-sm w-full">
        <ExpandableMessage
          title={styledTitle}
          content={content}
          initialExpanded={initialExpanded}
        />
      </div>
    </div>
  );
}
