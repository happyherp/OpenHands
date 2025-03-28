import {
  ObservationFormatter,
  ObservationFormatterProps,
  FormattedMessage,
} from "../types";
import { DefaultObservationFormatter } from "./default-observation-formatter";

export class EditObservationFormatter implements ObservationFormatter {
  props: ObservationFormatterProps;

  defaultFormatter: DefaultObservationFormatter;

  constructor(props: ObservationFormatterProps) {
    this.props = props;
    this.defaultFormatter = new DefaultObservationFormatter(props);
  }

  format(): FormattedMessage {
    const { observation } = this.props;
    const { title } = this.defaultFormatter.format();

    // Determine if the edit was successful
    let success = false;
    if (observation.payload.extras.impl_source === "oh_aci") {
      success =
        observation.payload.content.length > 0 &&
        !observation.payload.content.startsWith("ERROR:\n");
    } else {
      success =
        observation.payload.content.length > 0 &&
        !observation.payload.content.toLowerCase().includes("error:");
    }

    // Format the content based on success
    let content;
    if (success) {
      content = `\`\`\`diff\n${observation.payload.extras.diff}\n\`\`\``;
    } else {
      content = observation.payload.content;
    }

    return {
      title,
      content,
    };
  }
}
