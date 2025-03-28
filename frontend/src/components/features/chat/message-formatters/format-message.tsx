import React from "react";
import { useTranslation } from "react-i18next";
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
  props: Omit<ExpandableMessageProps, "title" | "content" | "type"> = {}
): React.ReactElement | null {
  // Use the translation hook to get i18n helpers
  const { t, i18n } = useTranslation();
  const i18nHelpers = {
    t,
    exists: i18n.exists.bind(i18n),
  };

  // If we have both an observation and an action, it means the action has been observed
  if (message.observation && message.action && message.type === "action") {
    const formatter = FormatterFactory.createObservationFormatter(message.observation, i18nHelpers);
    return formatter.toExpandableMessage({
      id: message.translationID,
      success: message.success,
      initialExpanded: false,
      type: message.type,
      ...props
    });
  } 
  // If we only have an action, format it as an action
  else if (message.action && message.type === "action") {
    const formatter = FormatterFactory.createActionFormatter(message.action, i18nHelpers);
    return formatter.toExpandableMessage({
      id: message.translationID,
      success: message.success,
      initialExpanded: false,
      type: message.type,
      ...props
    });
  }

  // If we don't have a formatter for this message type, return null
  return null;
}