import {
  ObservationFormatter,
  ObservationFormatterProps,
  FormattedMessage,
} from "../types";
import { DefaultObservationFormatter } from "./default-observation-formatter";

const trimText = (text: string, maxLength: number): string => {
  if (!text) return "";
  return text.length > maxLength ? `${text.substring(0, maxLength)}...` : text;
};

export class RunObservationFormatter implements ObservationFormatter {
  props: ObservationFormatterProps;

  defaultFormatter: DefaultObservationFormatter;

  constructor(props: ObservationFormatterProps) {
    this.props = props;

    // Process the command to trim it if needed
    const { observation } = props;
    const trimmedCommand = trimText(observation.payload.extras.command, 80);
    const processedObservation = {
      ...observation,
      payload: {
        ...observation.payload,
        extras: {
          ...observation.payload.extras,
          command: trimmedCommand,
        },
      },
    };

    this.defaultFormatter = new DefaultObservationFormatter({
      ...props,
      observation: processedObservation,
    });
  }

  format(): FormattedMessage {
    const { observation } = this.props;
    const { title } = this.defaultFormatter.format();

    // Format the content with command and output
    let { content } = observation.payload;
    if (content.length > 1000) {
      content = `${content.slice(0, 1000)}...`;
    }

    content = `Command:\n\`${observation.payload.extras.command}\`\n\nOutput:\n\`\`\`\n${content.trim() || "[Command finished execution with no output]"}\n\`\`\``;

    return {
      title,
      content,
    };
  }
}
