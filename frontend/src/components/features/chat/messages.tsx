import React from "react";
import type { Message } from "#/message";
import { ChatMessage } from "#/components/features/chat/chat-message";
import { ConfirmationButtons } from "#/components/shared/buttons/confirmation-buttons";
import { ImageCarousel } from "../images/image-carousel";
import { formatMessage } from "./message-formatters/format-message";

interface MessagesProps {
  messages: Message[];
  isAwaitingUserConfirmation: boolean;
}

export const Messages: React.FC<MessagesProps> = React.memo(
  ({ messages, isAwaitingUserConfirmation }) =>
    messages.map((message, index) => {
      const shouldShowConfirmationButtons =
        messages.length - 1 === index &&
        message.sender === "assistant" &&
        isAwaitingUserConfirmation;

      if (message.type === "error" || message.type === "action") {
        const formattedMessage = formatMessage(message);

        // If we couldn't format the message, show a fallback
        if (!formattedMessage && message.type === "error") {
          return (
            <div key={index} className="text-red-500">
              {message.content}
              {shouldShowConfirmationButtons && <ConfirmationButtons />}
            </div>
          );
        }
        
        // If we couldn't format the action message, create a simple expandable message
        if (!formattedMessage && message.type === "action") {
          return (
            <div key={index}>
              <div className="flex gap-2 items-center justify-start border-l-2 pl-2 my-2 py-2 border-neutral-300">
                <div className="text-sm w-full">
                  <div className="flex flex-row justify-between items-center w-full">
                    <div className="flex items-center">
                      <span className="font-bold text-neutral-300">
                        {message.translationID || "Action"}
                      </span>
                    </div>
                    <span className="flex-shrink-0">
                      {message.success ? (
                        <svg
                          data-testid="status-icon"
                          className="h-4 w-4 ml-2 inline fill-success"
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 512 512"
                        >
                          <path d="M256 512A256 256 0 1 0 256 0a256 256 0 1 0 0 512zM369 209L241 337c-9.4 9.4-24.6 9.4-33.9 0l-64-64c-9.4-9.4-9.4-24.6 0-33.9s24.6-9.4 33.9 0l47 47L335 175c9.4-9.4 24.6-9.4 33.9 0s9.4 24.6 0 33.9z" />
                        </svg>
                      ) : (
                        <svg
                          data-testid="status-icon"
                          className="h-4 w-4 ml-2 inline fill-danger"
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 512 512"
                        >
                          <path d="M256 512A256 256 0 1 0 256 0a256 256 0 1 0 0 512zM175 175c9.4-9.4 24.6-9.4 33.9 0l47 47 47-47c9.4-9.4 24.6-9.4 33.9 0s9.4 24.6 0 33.9l-47 47 47 47c9.4 9.4 9.4 24.6 0 33.9s-24.6 9.4-33.9 0l-47-47-47 47c-9.4 9.4-24.6 9.4-33.9 0s-9.4-24.6 0-33.9l47-47-47-47c-9.4-9.4-9.4-24.6 0-33.9z" />
                        </svg>
                      )}
                    </span>
                  </div>
                  <div className="text-sm overflow-auto mt-2">
                    <p>{message.content}</p>
                  </div>
                </div>
              </div>
              {shouldShowConfirmationButtons && <ConfirmationButtons />}
            </div>
          );
        }
        
        if (formattedMessage) {
          return (
            <div key={index}>
              {formattedMessage}
              {shouldShowConfirmationButtons && <ConfirmationButtons />}
            </div>
          );
        }
      }

      return (
        <ChatMessage
          key={index}
          type={message.sender}
          message={message.content}
        >
          {message.imageUrls && message.imageUrls.length > 0 && (
            <ImageCarousel size="small" images={message.imageUrls} />
          )}
          {shouldShowConfirmationButtons && <ConfirmationButtons />}
        </ChatMessage>
      );
    }),
);

Messages.displayName = "Messages";
