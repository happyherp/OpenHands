import {
  ActionFormatter,
  ActionFormatterProps,
  FormattedMessage,
} from "../types";
import { DefaultActionFormatter } from "./default-action-formatter";

const MAX_CONTENT_LENGTH = 1000;

export class WriteActionFormatter implements ActionFormatter {
  props: ActionFormatterProps;

  defaultFormatter: DefaultActionFormatter;

  constructor(props: ActionFormatterProps) {
    this.props = props;
    this.defaultFormatter = new DefaultActionFormatter(props);
  }

  format(): FormattedMessage {
    const { action } = this.props;
    const { title } = this.defaultFormatter.format();

    // For write actions, we show the path and truncated content
    let { content } = action.payload.args;
    if (content.length > MAX_CONTENT_LENGTH) {
      content = `${content.slice(0, MAX_CONTENT_LENGTH)}...`;
    }

    const formattedContent = `Writing to file: ${action.payload.args.path}\n\n\`\`\`\n${content}\n\`\`\``;

    return {
      title,
      content: formattedContent,
    };
  }
}
