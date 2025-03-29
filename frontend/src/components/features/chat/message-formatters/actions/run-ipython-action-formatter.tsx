import { DefaultActionFormatter } from "./default-action-formatter";
import { ActionSecurityRisk } from "#/state/security-analyzer-slice";
import { IPythonAction } from "#/types/core/actions";

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

export class RunIPythonActionFormatter extends DefaultActionFormatter {
  override _makeContent(): string {
    const { action } = this.props;
    const ipythonAction = action.payload as IPythonAction;
    let content = `\`\`\`\n${ipythonAction.args.code}\n\`\`\``;

    // Add security risk information if awaiting confirmation
    if (ipythonAction.args.confirmation_state === "awaiting_confirmation") {
      content += `\n\n${getRiskText(ipythonAction.args.security_risk)}`;
    }

    return content;
  }
}
