import {
  ObservationFormatterProps,
} from "../types";
import { DefaultObservationFormatter } from "./default-observation-formatter";
import { WriteObservation } from "#/types/core/observations";

export class WriteObservationFormatter extends DefaultObservationFormatter {
  constructor(props: ObservationFormatterProps) {
    super(props);
  }

  override _makeContent(): string {
    const { observation } = this.props;
    const writeObservation = observation.payload as WriteObservation;
    
    // For write observations, we show the result
    const path = writeObservation.extras.path || "";
    const success = !observation.payload.content
      .toLowerCase()
      .includes("error:");

    if (success) {
      return `Successfully wrote to file: ${path}`;
    } else {
      return `Failed to write to file: ${path}\n\n${observation.payload.content}`;
    }
  }
}
