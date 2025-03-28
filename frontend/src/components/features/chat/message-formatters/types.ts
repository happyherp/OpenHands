import { PayloadAction } from "@reduxjs/toolkit";
import { ReactNode } from "react";
import { OpenHandsAction } from "#/types/core/actions";
import { OpenHandsObservation } from "#/types/core/observations";
import { ExpandableMessageProps } from "../expandable-message";
import React from "react";

export interface FormattedMessage {
  title: ReactNode;
  content: string;
}

export interface MessageFormatter {
  format(): FormattedMessage;
  toExpandableMessage(props?: Omit<ExpandableMessageProps, "title" | "content">): React.ReactElement;
}

export interface ActionFormatterProps {
  action: PayloadAction<OpenHandsAction>;
}

export interface ObservationFormatterProps {
  observation: PayloadAction<OpenHandsObservation>;
}

export interface ActionFormatter extends MessageFormatter {
  props: ActionFormatterProps;
}

export interface ObservationFormatter extends MessageFormatter {
  props: ObservationFormatterProps;
}
