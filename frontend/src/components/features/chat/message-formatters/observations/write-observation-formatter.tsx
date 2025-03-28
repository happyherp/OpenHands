import {
  ObservationFormatter,
  ObservationFormatterProps,
  FormattedMessage,
} from "../types";
import { DefaultObservationFormatter } from "./default-observation-formatter";

export class WriteObservationFormatter implements ObservationFormatter {
  props: ObservationFormatterProps;

  defaultFormatter: DefaultObservationFormatter;

  constructor(props: ObservationFormatterProps) {
    this.props = props;
    this.defaultFormatter = new DefaultObservationFormatter(props);
  }

  format(): FormattedMessage {
    const { observation } = this.props;
    const { title } = this.defaultFormatter.format();

    // For write observations, we show the result
    const path = observation.payload.extras.path || "";
    const success = !observation.payload.content
      .toLowerCase()
      .includes("error:");

    let content;
    if (success) {
      content = `Successfully wrote to file: ${path}`;
    } else {
      content = `Failed to write to file: ${path}\n\n${observation.payload.content}`;
    }

    return {
      title,
      content,
    };
  }
}
