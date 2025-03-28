import { describe, expect, it, vi } from "vitest";
import { screen, fireEvent } from "@testing-library/react";
import { renderWithProviders } from "test-utils";
import { MessageFormatter } from "#/components/features/chat/message-formatter";
import { PayloadAction } from "@reduxjs/toolkit";
import { OpenHandsAction } from "#/types/core/actions";
import { OpenHandsObservation } from "#/types/core/observations";

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

describe("MessageFormatter", () => {
  it("should render a simple message without action or observation", () => {
    renderWithProviders(
      <MessageFormatter message="Simple message" type="thought" />
    );
    expect(screen.getByText("Simple message")).toBeInTheDocument();
  });

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

    renderWithProviders(
      <MessageFormatter 
        message="Running command" 
        type="action" 
        action={action}
      />
    );
    
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

    renderWithProviders(
      <MessageFormatter 
        message="Command executed" 
        type="action" 
        action={action}
        observation={observation}
        success={true}
      />
    );
    
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
          hidden: false
        }
      }
    };

    renderWithProviders(
      <MessageFormatter 
        message="Reading file" 
        type="action" 
        action={action}
      />
    );
    
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
          hidden: false
        }
      }
    };

    renderWithProviders(
      <MessageFormatter 
        message="Writing to file" 
        type="action" 
        action={action}
      />
    );
    
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
          hidden: false
        }
      }
    };

    renderWithProviders(
      <MessageFormatter 
        message="Editing file" 
        type="action" 
        action={action}
      />
    );
    
    expect(screen.getByText("ACTION_MESSAGE$EDIT")).toBeInTheDocument();
  });
});