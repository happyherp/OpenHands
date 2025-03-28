import { useState, ReactNode } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Link } from "react-router";
import { code } from "../markdown/code";
import { ol, ul } from "../markdown/list";
import ArrowUp from "#/icons/angle-up-solid.svg?react";
import ArrowDown from "#/icons/angle-down-solid.svg?react";
import CheckCircle from "#/icons/check-circle-solid.svg?react";
import XCircle from "#/icons/x-circle-solid.svg?react";
import { cn } from "#/utils/utils";
import { useConfig } from "#/hooks/query/use-config";

export interface ExpandableMessageProps {
  title: ReactNode;
  content: ReactNode;
  type?: string;
  success?: boolean;
  initialExpanded?: boolean;
  id?: string;
}

export function ExpandableMessage({
  title,
  content,
  type = "default",
  success,
  initialExpanded = false,
  id,
}: ExpandableMessageProps) {
  const [showDetails, setShowDetails] = useState(initialExpanded);
  const { data: config } = useConfig();
  const statusIconClasses = "h-4 w-4 ml-2 inline";

  // If content is a string, render it as Markdown, otherwise render it directly
  const renderContent = () => {
    if (typeof content === "string") {
      return (
        <Markdown
          components={{
            code,
            ul,
            ol,
          }}
          remarkPlugins={[remarkGfm]}
        >
          {content}
        </Markdown>
      );
    }
    return content;
  };

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

  return (
    <div
      className={cn(
        "flex gap-2 items-center justify-start border-l-2 pl-2 my-2 py-2",
        type === "error" ? "border-danger" : "border-neutral-300",
      )}
    >
      <div className="text-sm w-full">
        <div className="flex flex-row justify-between items-center w-full">
          <div className="flex items-center">
            <span
              className={cn(
                "font-bold",
                type === "error" ? "text-danger" : "text-neutral-300",
              )}
            >
              {title}
            </span>
            <button
              type="button"
              onClick={() => setShowDetails(!showDetails)}
              className="cursor-pointer text-left ml-2"
            >
              {showDetails ? (
                <ArrowUp
                  className={cn(
                    "h-4 w-4 inline",
                    type === "error" ? "fill-danger" : "fill-neutral-300",
                  )}
                />
              ) : (
                <ArrowDown
                  className={cn(
                    "h-4 w-4 inline",
                    type === "error" ? "fill-danger" : "fill-neutral-300",
                  )}
                />
              )}
            </button>
          </div>
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
        {showDetails && (
          <div className="text-sm overflow-auto mt-2">{renderContent()}</div>
        )}
      </div>
    </div>
  );
}
