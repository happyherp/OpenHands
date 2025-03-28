import { useTranslation } from "react-i18next";
import { PayloadAction } from "@reduxjs/toolkit";
import { OpenHandsAction } from "#/types/core/actions";
import { OpenHandsObservation } from "#/types/core/observations";
import { FormatterFactory } from "./message-formatters/formatter-factory";

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
  const i18nHelpers = {
    t,
    exists: i18n.exists.bind(i18n),
  };

  if (observation && action && type === "action") {
    // If we have both an observation and an action, it means the action has been observed
    const formatter = FormatterFactory.createObservationFormatter(observation, i18nHelpers);
    return formatter.toExpandableMessage({
      id,
      success,
      initialExpanded,
      type,
    });
  } else if (action && type === "action") {
    const formatter = FormatterFactory.createActionFormatter(action, i18nHelpers);
    return formatter.toExpandableMessage({
      id,
      success,
      initialExpanded,
      type,
    });
  }

  // Fallback for cases where we don't have a formatter
  return (
    <div className="text-sm">{message}</div>
  );
}
