import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "test-utils";
import { formatMessage } from "#/components/features/chat/message-formatters/format-message";
import { PayloadAction } from "@reduxjs/toolkit";
import { OpenHandsAction } from "#/types/core/actions";
import { OpenHandsObservation } from "#/types/core/observations";
import { Message } from "#/message";

vi.mock("react-i18next", async () => {
  const actual = await vi.importActual("react-i18next");
  return {
    ...actual,
    useTranslation: () => ({
      t: (key: string) => key,
      i18n: {
        changeLanguage: () => new Promise(() => {}),
        language: "en",
        exists: () => true,
      },
    }),
    Trans: ({ i18nKey }: { i18nKey: string }) => <span>{i18nKey}</span>,
  };
});

describe("formatMessage", () => {
  it("should render an action message", () => {
    const action: PayloadAction<OpenHandsAction> = {
      type: "action",
      payload: {
        id: 1,
        action: "run",
        source: "agent",
        message: "Running command",
        timestamp: new Date().toISOString(),
        args: {
          command: "ls -la",
          security_risk: 0,
          confirmation_state: "confirmed",
          thought: "I need to list files",
          hidden: false
        }
      }
    };

    const message: Message = {
      sender: "assistant",
      content: "Running command",
      timestamp: new Date().toISOString(),
      type: "action",
      action
    };

    const formattedMessage = formatMessage(message);
    renderWithProviders(<>{formattedMessage}</>);
    
    expect(screen.getByText("ACTION_MESSAGE$RUN")).toBeInTheDocument();
  });

  it("should render an action message with observation", () => {
    const action: PayloadAction<OpenHandsAction> = {
      type: "action",
      payload: {
        id: 1,
        action: "run",
        source: "agent",
        message: "Running command",
        timestamp: new Date().toISOString(),
        args: {
          command: "ls -la",
          security_risk: 0,
          confirmation_state: "confirmed",
          thought: "I need to list files",
          hidden: false
        }
      }
    };

    const observation: PayloadAction<OpenHandsObservation> = {
      type: "observation",
      payload: {
        id: 2,
        cause: 1,
        observation: "run",
        source: "agent",
        message: "Command executed",
        timestamp: new Date().toISOString(),
        content: "file1.txt\nfile2.txt",
        extras: {
          command: "ls -la",
          metadata: {
            exit_code: 0
          }
        }
      }
    };

    const message: Message = {
      sender: "assistant",
      content: "Command executed",
      timestamp: new Date().toISOString(),
      type: "action",
      action,
      observation,
      success: true
    };

    const formattedMessage = formatMessage(message);
    renderWithProviders(<>{formattedMessage}</>);
    
    expect(screen.getByText("OBSERVATION_MESSAGE$RUN")).toBeInTheDocument();
    expect(screen.getByTestId("status-icon")).toHaveClass("fill-success");
  });

  it("should render a read action message", () => {
    const action: PayloadAction<OpenHandsAction> = {
      type: "action",
      payload: {
        id: 1,
        action: "read",
        source: "agent",
        message: "Reading file",
        timestamp: new Date().toISOString(),
        args: {
          path: "/path/to/file.txt",
          thought: "I need to read this file",
          security_risk: null
        }
      }
    };

    const message: Message = {
      sender: "assistant",
      content: "Reading file",
      timestamp: new Date().toISOString(),
      type: "action",
      action
    };

    const formattedMessage = formatMessage(message);
    renderWithProviders(<>{formattedMessage}</>);
    
    expect(screen.getByText("ACTION_MESSAGE$READ")).toBeInTheDocument();
  });

  it("should render a write action message", () => {
    const action: PayloadAction<OpenHandsAction> = {
      type: "action",
      payload: {
        id: 1,
        action: "write",
        source: "agent",
        message: "Writing to file",
        timestamp: new Date().toISOString(),
        args: {
          path: "/path/to/file.txt",
          content: "Hello, world!",
          thought: "I need to write to this file",
          security_risk: null
        }
      }
    };

    const message: Message = {
      sender: "assistant",
      content: "Writing to file",
      timestamp: new Date().toISOString(),
      type: "action",
      action
    };

    const formattedMessage = formatMessage(message);
    renderWithProviders(<>{formattedMessage}</>);
    
    expect(screen.getByText("ACTION_MESSAGE$WRITE")).toBeInTheDocument();
  });

  it("should render an edit action message", () => {
    const action: PayloadAction<OpenHandsAction> = {
      type: "action",
      payload: {
        id: 1,
        action: "edit",
        source: "agent",
        message: "Editing file",
        timestamp: new Date().toISOString(),
        args: {
          path: "/path/to/file.txt",
          old_str: "Hello, world!",
          new_str: "Hello, OpenHands!",
          thought: "I need to edit this file",
          security_risk: null
        }
      }
    };

    const message: Message = {
      sender: "assistant",
      content: "Editing file",
      timestamp: new Date().toISOString(),
      type: "action",
      action
    };

    const formattedMessage = formatMessage(message);
    renderWithProviders(<>{formattedMessage}</>);
    
    expect(screen.getByText("ACTION_MESSAGE$EDIT")).toBeInTheDocument();
  });

  it("should return null for unsupported message types", () => {
    const message: Message = {
      sender: "assistant",
      content: "Unsupported message",
      timestamp: new Date().toISOString(),
      type: "thought"
    };

    const formattedMessage = formatMessage(message);
    expect(formattedMessage).toBeNull();
  });
});