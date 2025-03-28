import React, { ReactNode } from "react";
import {
  ActionFormatterProps,
} from "../types";
import { DefaultActionFormatter } from "./default-action-formatter";
import { ActionSecurityRisk } from "#/state/security-analyzer-slice";
import { CommandAction } from "#/types/core/actions";

const trimText = (text: string, maxLength: number): string => {
  if (!text) return "";
  return text.length > maxLength ? `${text.substring(0, maxLength)}...` : text;
};

function getRiskText(risk: ActionSecurityRisk) {
  switch (risk) {
    case ActionSecurityRisk.LOW:
      return "Low Risk";
    case ActionSecurityRisk.MEDIUM:
      return "Medium Risk";
    case ActionSecurityRisk.HIGH:
      return "High Risk";
    case ActionSecurityRisk.UNKNOWN:
    default:
      return "Unknown Risk";
  }
}

export class RunActionFormatter extends DefaultActionFormatter {
  private processedAction: ActionFormatterProps["action"];

  constructor(props: ActionFormatterProps) {
    super(props);

    // Process the command to trim it if needed
    const { action } = props;
    const commandAction = action.payload as CommandAction;
    const trimmedCommand = trimText(commandAction.args.command, 80);
    this.processedAction = {
      ...action,
      payload: {
        ...action.payload,
        args: {
          ...commandAction.args,
          command: trimmedCommand,
        },
      } as CommandAction,
    };
  }

  protected override _makeTitle(): ReactNode {
    // Use the processed action with trimmed command for the title
    const originalAction = this.props.action;
    this.props.action = this.processedAction;
    const title = super._makeTitle();
    this.props.action = originalAction;
    return title;
  }

  protected override _makeContent(): string {
    const { action } = this.props;
    const commandAction = action.payload as CommandAction;
    let content = `Command:\n\`${commandAction.args.command}\``;

    // Add security risk information if awaiting confirmation
    if (commandAction.args.confirmation_state === "awaiting_confirmation") {
      content += `\n\n${getRiskText(commandAction.args.security_risk)}`;
    }

    return content;
  }
}
