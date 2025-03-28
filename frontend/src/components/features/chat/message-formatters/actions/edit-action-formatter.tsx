import {
  ActionFormatter,
  ActionFormatterProps,
  FormattedMessage,
} from "../types";
import { DefaultActionFormatter } from "./default-action-formatter";

export class EditActionFormatter implements ActionFormatter {
  props: ActionFormatterProps;

  defaultFormatter: DefaultActionFormatter;

  constructor(props: ActionFormatterProps) {
    this.props = props;
    this.defaultFormatter = new DefaultActionFormatter(props);
  }

  format(): FormattedMessage {
    const { action } = this.props;
    const { title } = this.defaultFormatter.format();

    // For edit actions, we show the path and the edit operation
    const { path, old_str: oldStr, new_str: newStr } = action.payload.args;

    const formattedContent = `Editing file: ${path}\n\nReplacing:\n\`\`\`\n${oldStr}\n\`\`\`\n\nWith:\n\`\`\`\n${newStr}\n\`\`\``;

    return {
      title,
      content: formattedContent,
    };
  }
}
