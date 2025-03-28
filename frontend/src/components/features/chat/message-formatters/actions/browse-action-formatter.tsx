import {
  ActionFormatter,
  ActionFormatterProps,
  FormattedMessage,
} from "../types";
import { DefaultActionFormatter } from "./default-action-formatter";

export class BrowseActionFormatter implements ActionFormatter {
  props: ActionFormatterProps;

  defaultFormatter: DefaultActionFormatter;

  constructor(props: ActionFormatterProps) {
    this.props = props;
    this.defaultFormatter = new DefaultActionFormatter(props);
  }

  format(): FormattedMessage {
    const { action } = this.props;
    const { title } = this.defaultFormatter.format();

    // For browse actions, we show the URL
    const formattedContent = `Browsing ${action.payload.args.url}`;

    return {
      title,
      content: formattedContent,
    };
  }
}
