import { ObservationFormatterProps } from "../types";
import { DefaultObservationFormatter } from "./default-observation-formatter";
import { IPythonObservation } from "#/types/core/observations";

const MAX_CONTENT_LENGTH = 1000;

export class RunIPythonObservationFormatter extends DefaultObservationFormatter {
  constructor(props: ObservationFormatterProps) {
    super(props);
  }

  override _makeContent(): string {
    const { observation } = this.props;
    const ipythonObservation = observation.payload as IPythonObservation;

    // Format the content with code and output
    let { content } = observation.payload;
    if (content.length > MAX_CONTENT_LENGTH) {
      content = `${content.slice(0, MAX_CONTENT_LENGTH)}...`;
    }

    return `Code:\n\`\`\`\n${ipythonObservation.extras.code}\n\`\`\`\n\nOutput:\n\`\`\`\n${content.trim() || "[Execution finished with no output]"}\n\`\`\``;
  }
}