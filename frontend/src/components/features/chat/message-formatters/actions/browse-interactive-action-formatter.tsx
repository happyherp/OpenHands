import { ActionFormatterProps } from "../types";
import { DefaultActionFormatter } from "./default-action-formatter";
import { BrowseInteractiveAction } from "#/types/core/actions";

export class BrowseInteractiveActionFormatter extends DefaultActionFormatter {
  constructor(props: ActionFormatterProps) {
    super(props);
  }

  override _makeContent(): string {
    const { action } = this.props;
    // For browse_interactive actions, we show the browser actions
    const browseInteractiveAction = action.payload as BrowseInteractiveAction;
    return `**Action:**\n\n\`\`\`python\n${browseInteractiveAction.args.browser_actions}\n\`\`\``;
  }
}
