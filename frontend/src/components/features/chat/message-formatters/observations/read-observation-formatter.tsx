import {
  ObservationFormatterProps,
} from "../types";
import { DefaultObservationFormatter } from "./default-observation-formatter";
import { ReadObservation } from "#/types/core/observations";

export class ReadObservationFormatter extends DefaultObservationFormatter {
  constructor(props: ObservationFormatterProps) {
    super(props);
  }

  override _makeContent(): string {
    const { observation } = this.props;
    // For read observations, we format the content as code
    return `\`\`\`\n${observation.payload.content}\n\`\`\``;
  }
}
