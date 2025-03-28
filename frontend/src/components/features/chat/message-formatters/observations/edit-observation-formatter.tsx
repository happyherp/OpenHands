import {
  ObservationFormatterProps,
} from "../types";
import { DefaultObservationFormatter } from "./default-observation-formatter";
import { EditObservation } from "#/types/core/observations";

export class EditObservationFormatter extends DefaultObservationFormatter {
  constructor(props: ObservationFormatterProps) {
    super(props);
  }

  protected override _makeContent(): string {
    const { observation } = this.props;
    const editObservation = observation.payload as EditObservation;

    // Determine if the edit was successful
    let success = false;
    if (editObservation.extras.impl_source === "oh_aci") {
      success =
        observation.payload.content.length > 0 &&
        !observation.payload.content.startsWith("ERROR:\n");
    } else {
      success =
        observation.payload.content.length > 0 &&
        !observation.payload.content.toLowerCase().includes("error:");
    }

    // Format the content based on success
    if (success) {
      return `\`\`\`diff\n${editObservation.extras.diff}\n\`\`\``;
    } else {
      return observation.payload.content;
    }
  }
}
