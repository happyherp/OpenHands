import React from "react";

import { Message } from "#/message";
import { FormatterFactory } from "./formatter-factory";
import { ExpandableMessageProps } from "../expandable-message";

/**
 * Creates an expandable message component for a given message
 *
 * @param message The message to format
 * @param props Additional props to pass to the expandable message component
 * @returns A React element representing the formatted message
 */
export function formatMessage(
  message: Message,
  props: Omit<ExpandableMessageProps, "title" | "content" | "type"> = {},
): React.ReactElement | null {
  // If we have both an observation and an action, it means the action has been observed
  if (message.observation && message.action && message.type === "action") {
    const formatter = FormatterFactory.createObservationFormatter(
      message.observation,
    );
    return formatter.toExpandableMessage({
      id: message.translationID,
      success: message.success,
      initialExpanded: false,
      type: message.type,
      ...props,
    });
  }
  // If we only have an action, format it as an action
  if (message.action && message.type === "action") {
    const formatter = FormatterFactory.createActionFormatter(message.action);
    return formatter.toExpandableMessage({
      id: message.translationID,
      success: message.success,
      initialExpanded: false,
      type: message.type,
      ...props,
    });
  }

  // If we don't have a formatter for this message type, return null
  return null;
}
