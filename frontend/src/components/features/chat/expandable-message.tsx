import { useState, ReactNode } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { code } from "../markdown/code";
import { ol, ul } from "../markdown/list";
import ArrowUp from "#/icons/angle-up-solid.svg?react";
import ArrowDown from "#/icons/angle-down-solid.svg?react";

export interface ExpandableMessageProps {
  title: ReactNode;
  content: ReactNode;
  initialExpanded?: boolean;
}

export function ExpandableMessage({
  title,
  content,
  initialExpanded = false,
}: ExpandableMessageProps) {
  const [showDetails, setShowDetails] = useState(initialExpanded);

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

  return (
    <div>
      <div className="flex flex-row justify-between items-center w-full">
        <div className="flex items-center">
          {title}
          <button
            type="button"
            onClick={() => setShowDetails(!showDetails)}
            className="cursor-pointer text-left ml-2"
          >
            {showDetails ? (
              <ArrowUp className="h-4 w-4 inline fill-current" />
            ) : (
              <ArrowDown className="h-4 w-4 inline fill-current" />
            )}
          </button>
        </div>
      </div>
      {showDetails && (
        <div className="text-sm overflow-auto mt-2">{renderContent()}</div>
      )}
    </div>
  );
}
