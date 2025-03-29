import { ObservationFormatterProps } from "../types";
import { DefaultObservationFormatter } from "./default-observation-formatter";
import { EditObservation } from "#/types/core/observations";

export class EditObservationFormatter extends DefaultObservationFormatter {
  constructor(props: ObservationFormatterProps) {
    super(props);
  }

  override _makeContent(): string {
    const { observation } = this.props;
    const editObservation = observation.payload as EditObservation;

    // Format the content based on success
    if (this.determineSuccess()) {
      return `\`\`\`diff\n${editObservation.extras.diff}\n\`\`\``;
    }
    return observation.payload.content;
  }
  
  /**
   * For edit operations, we consider it successful if there's content and no error
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
