import {
  ActionFormatter,
  ActionFormatterProps,
  FormattedMessage,
} from "../types";
import { DefaultActionFormatter } from "./default-action-formatter";

export class ReadActionFormatter implements ActionFormatter {
  props: ActionFormatterProps;

  defaultFormatter: DefaultActionFormatter;

  constructor(props: ActionFormatterProps) {
    this.props = props;
    this.defaultFormatter = new DefaultActionFormatter(props);
  }

  format(): FormattedMessage {
    const { action } = this.props;
    const { title } = this.defaultFormatter.format();

    // For read actions, we just show the path
    const content = `Reading file: ${action.payload.args.path}`;

    return {
      title,
      content,
    };
  }
}
