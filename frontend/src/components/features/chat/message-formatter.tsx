import { useTranslation } from "react-i18next";
import { PayloadAction } from "@reduxjs/toolkit";
import { OpenHandsAction } from "#/types/core/actions";
import { OpenHandsObservation } from "#/types/core/observations";
import { FormatterFactory } from "./message-formatters/formatter-factory";
import { ExpandableMessage } from "./expandable-message";

export interface MessageFormatterProps {
  id?: string;
  message: string;
  type: string;
  success?: boolean;
  observation?: PayloadAction<OpenHandsObservation>;
  action?: PayloadAction<OpenHandsAction>;
  initialExpanded?: boolean;
}

export function MessageFormatter({
  id,
  message,
  type,
  success,
  observation,
  action,
  initialExpanded = false,
}: MessageFormatterProps) {
  const { t, i18n } = useTranslation();

  // Format the message based on the type
  let title = message;
  let content = message;

  if (observation && action && type === "action") {
    // If we have both an observation and an action, it means the action has been observed
    const formatter = FormatterFactory.createObservationFormatter(observation, {
      t,
      exists: i18n.exists.bind(i18n),
    });
    const formatted = formatter.format();
    title = formatted.title;
    content = formatted.content || message;
  } else if (action && type === "action") {
    const formatter = FormatterFactory.createActionFormatter(action, {
      t,
      exists: i18n.exists.bind(i18n),
    });
    const formatted = formatter.format();
    title = formatted.title;
    content = formatted.content || message;
  }

  return (
    <ExpandableMessage
      id={id}
      title={title}
      content={content}
      type={type}
      success={success}
      initialExpanded={initialExpanded}
    />
  );
}
