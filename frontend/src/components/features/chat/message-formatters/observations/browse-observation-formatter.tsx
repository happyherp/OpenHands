import {
  ObservationFormatterProps,
} from "../types";
import { DefaultObservationFormatter } from "./default-observation-formatter";
import { BrowseObservation } from "#/types/core/observations";

const MAX_CONTENT_LENGTH = 1000;

export class BrowseObservationFormatter extends DefaultObservationFormatter {
  constructor(props: ObservationFormatterProps) {
    super(props);
  }

  protected override _makeContent(): string {
    const { observation } = this.props;
    const browseObservation = observation.payload as BrowseObservation;

    // For browse observations, we show the URL and content
    let content = `**URL:** ${browseObservation.extras.url}\n`;

    if (browseObservation.extras.error) {
      content += `\n\n**Error:**\n${browseObservation.extras.error}\n`;
    }

    content += `\n\n**Output:**\n${observation.payload.content}`;

    if (content.length > MAX_CONTENT_LENGTH) {
      content = `${content.slice(0, MAX_CONTENT_LENGTH)}...(truncated)`;
    }

    return content;
  }
}
