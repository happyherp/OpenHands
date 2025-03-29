import { ObservationFormatterProps } from "../types";
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
  
  /**
   * For read operations, we consider it successful if there's content and no error
   */
  override determineSuccess(): boolean {
    const { observation } = this.props;
    const content = observation.payload.content;
    
    if (observation.payload.extras.impl_source === "oh_aci") {
      return content.length > 0 && !content.startsWith("ERROR:\n");
    } else {
      return content.length > 0 && !content.toLowerCase().includes("error:");
    }
  }
}
