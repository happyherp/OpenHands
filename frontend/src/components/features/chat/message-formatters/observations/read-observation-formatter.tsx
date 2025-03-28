import {
  ObservationFormatter,
  ObservationFormatterProps,
  FormattedMessage,
} from "../types";
import { DefaultObservationFormatter } from "./default-observation-formatter";

export class ReadObservationFormatter implements ObservationFormatter {
  props: ObservationFormatterProps;

  defaultFormatter: DefaultObservationFormatter;

  constructor(props: ObservationFormatterProps) {
    this.props = props;
    this.defaultFormatter = new DefaultObservationFormatter(props);
  }

  format(): FormattedMessage {
    const { observation } = this.props;
    const { title } = this.defaultFormatter.format();

    // For read observations, we format the content as code
    const content = `\`\`\`\n${observation.payload.content}\n\`\`\``;

    return {
      title,
      content,
    };
  }
}
