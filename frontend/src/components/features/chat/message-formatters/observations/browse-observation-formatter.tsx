import {
  ObservationFormatter,
  ObservationFormatterProps,
  FormattedMessage,
} from "../types";
import { DefaultObservationFormatter } from "./default-observation-formatter";

const MAX_CONTENT_LENGTH = 1000;

export class BrowseObservationFormatter implements ObservationFormatter {
  props: ObservationFormatterProps;

  defaultFormatter: DefaultObservationFormatter;

  constructor(props: ObservationFormatterProps) {
    this.props = props;
    this.defaultFormatter = new DefaultObservationFormatter(props);
  }

  format(): FormattedMessage {
    const { observation } = this.props;
    const { title } = this.defaultFormatter.format();

    // For browse observations, we show the URL and content
    let content = `**URL:** ${observation.payload.extras.url}\n`;

    if (observation.payload.extras.error) {
      content += `\n\n**Error:**\n${observation.payload.extras.error}\n`;
    }

    content += `\n\n**Output:**\n${observation.payload.content}`;

    if (content.length > MAX_CONTENT_LENGTH) {
      content = `${content.slice(0, MAX_CONTENT_LENGTH)}...(truncated)`;
    }

    return {
      title,
      content,
    };
  }
}
