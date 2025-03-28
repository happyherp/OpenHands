import {
  ActionFormatter,
  ActionFormatterProps,
  FormattedMessage,
} from "../types";
import { DefaultActionFormatter } from "./default-action-formatter";
import { ActionSecurityRisk } from "#/state/security-analyzer-slice";

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

export class RunActionFormatter implements ActionFormatter {
  props: ActionFormatterProps;

  defaultFormatter: DefaultActionFormatter;

  constructor(props: ActionFormatterProps) {
    this.props = props;

    // Process the command to trim it if needed
    const { action } = props;
    const trimmedCommand = trimText(action.payload.args.command, 80);
    const processedAction = {
      ...action,
      payload: {
        ...action.payload,
        args: {
          ...action.payload.args,
          command: trimmedCommand,
        },
      },
    };

    this.defaultFormatter = new DefaultActionFormatter({
      ...props,
      action: processedAction,
    });
  }

  format(): FormattedMessage {
    const { action } = this.props;
    const { title } = this.defaultFormatter.format();

    let content = `Command:\n\`${action.payload.args.command}\``;

    // Add security risk information if awaiting confirmation
    if (action.payload.args.confirmation_state === "awaiting_confirmation") {
      content += `\n\n${getRiskText(action.payload.args.security_risk as unknown as ActionSecurityRisk)}`;
    }

    return {
      title,
      content,
    };
  }
}
