import {
  ActionFormatter,
  ActionFormatterProps,
  FormattedMessage,
} from "../types";
import { DefaultActionFormatter } from "./default-action-formatter";

export class BrowseInteractiveActionFormatter implements ActionFormatter {
  props: ActionFormatterProps;

  defaultFormatter: DefaultActionFormatter;

  constructor(props: ActionFormatterProps) {
    this.props = props;
    this.defaultFormatter = new DefaultActionFormatter(props);
  }

  format(): FormattedMessage {
    const { action } = this.props;
    const { title } = this.defaultFormatter.format();

    // For browse_interactive actions, we show the browser actions
    const formattedContent = `**Action:**\n\n\`\`\`python\n${action.payload.args.browser_actions}\n\`\`\``;

    return {
      title,
      content: formattedContent,
    };
  }
}
