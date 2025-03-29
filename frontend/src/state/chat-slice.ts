import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import type { Message } from "#/message";

import {
  OpenHandsObservation,
  CommandObservation,
  IPythonObservation,
} from "#/types/core/observations";
import { OpenHandsAction } from "#/types/core/actions";
import { OpenHandsEventType } from "#/types/core/base";
import { FormatterFactory } from "#/components/features/chat/message-formatters/formatter-factory";

type SliceState = { messages: Message[] };

const HANDLED_ACTIONS: OpenHandsEventType[] = [
  "run",
  "run_ipython",
  "write",
  "read",
  "browse",
  "browse_interactive",
  "edit",
];

const initialState: SliceState = {
  messages: [],
};

export const chatSlice = createSlice({
  name: "chat",
  initialState,
  reducers: {
    addUserMessage(
      state,
      action: PayloadAction<{
        content: string;
        imageUrls: string[];
        timestamp: string;
        pending?: boolean;
      }>,
    ) {
      const message: Message = {
        type: "thought",
        sender: "user",
        content: action.payload.content,
        imageUrls: action.payload.imageUrls,
        timestamp: action.payload.timestamp || new Date().toISOString(),
        pending: !!action.payload.pending,
      };
      // Remove any pending messages
      let i = state.messages.length;
      while (i) {
        i -= 1;
        const m = state.messages[i] as Message;
        if (m.pending) {
          state.messages.splice(i, 1);
        }
      }
      state.messages.push(message);
    },

    addAssistantMessage(state: SliceState, action: PayloadAction<string>) {
      const message: Message = {
        type: "thought",
        sender: "assistant",
        content: action.payload,
        imageUrls: [],
        timestamp: new Date().toISOString(),
        pending: false,
      };
      state.messages.push(message);
    },

    addAssistantAction(
      state: SliceState,
      action: PayloadAction<OpenHandsAction>,
    ) {
      const actionID = action.payload.action;
      if (!HANDLED_ACTIONS.includes(actionID)) {
        return;
      }

      // Use the formatter factory to get the appropriate formatter
      const formatter = FormatterFactory.createActionFormatter(action);
      const translationID = `ACTION_MESSAGE$${actionID.toUpperCase()}`;

      const message: Message = {
        type: "action",
        sender: "assistant",
        translationID,
        eventID: action.payload.id,
        content: formatter._makeContent(), // Use the formatter to generate content
        imageUrls: [],
        timestamp: new Date().toISOString(),
        action, // Store the action in the message
      };

      state.messages.push(message);
    },

    addAssistantObservation(
      state: SliceState,
      observation: PayloadAction<OpenHandsObservation>,
    ) {
      const observationID = observation.payload.observation;
      if (!HANDLED_ACTIONS.includes(observationID)) {
        return;
      }

      const translationID = `OBSERVATION_MESSAGE$${observationID.toUpperCase()}`;
      const causeID = observation.payload.cause;
      const causeMessage = state.messages.find(
        (message) => message.eventID === causeID,
      );

      if (!causeMessage) {
        return;
      }

      causeMessage.translationID = translationID;
      causeMessage.observation = observation;

      // Use the formatter factory to get the appropriate formatter
      const formatter = FormatterFactory.createObservationFormatter(observation);
      
      // Use the formatter to determine success and generate content
      causeMessage.success = formatter.determineSuccess();
      causeMessage.content = formatter._makeContent();
    },

    addErrorMessage(
      state: SliceState,
      action: PayloadAction<{ id?: string; message: string }>,
    ) {
      const { id, message } = action.payload;
      state.messages.push({
        translationID: id,
        content: message,
        type: "error",
        sender: "assistant",
        timestamp: new Date().toISOString(),
      });
    },

    clearMessages(state: SliceState) {
      state.messages = [];
    },
  },
});

export const {
  addUserMessage,
  addAssistantMessage,
  addAssistantAction,
  addAssistantObservation,
  addErrorMessage,
  clearMessages,
} = chatSlice.actions;
export default chatSlice.reducer;
