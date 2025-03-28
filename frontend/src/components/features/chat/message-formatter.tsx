import { useTranslation } from "react-i18next";
import { PayloadAction } from "@reduxjs/toolkit";
import { OpenHandsAction } from "#/types/core/actions";
import { OpenHandsObservation } from "#/types/core/observations";
import { ActionFormatterFactory } from "./message-formatters/action-formatter-factory";
import { ObservationFormatterFactory } from "./message-formatters/observation-formatter-factory";
import { ExpandableMessage } from "./expandable-message";

export interface MessageFormatterProps {
  id?: string;
  message: string;
  type: string;
  success?: boolean;
  observation?: PayloadAction<OpenHandsObservation>;
  action?: PayloadAction<OpenHandsAction>;
}

export function MessageFormatter({
  id,
  message,
  type,
  success,
  observation,
  action,
}: MessageFormatterProps) {
  const { t, i18n } = useTranslation();

  // Format the message based on the type
  let title = message;
  let content = message;

  if (observation && action && type === "action") {
    // If we have both an observation and an action, it means the action has been observed
    const formatter = ObservationFormatterFactory.createFormatter(observation, {
      t,
      exists: i18n.exists.bind(i18n),
    });
    const formatted = formatter.format();
    title = formatted.title;
    content = formatted.content || message;
  } else if (action && type === "action") {
    const formatter = ActionFormatterFactory.createFormatter(action, {
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
      initialExpanded={false}
    />
  );
}
