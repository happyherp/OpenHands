import { DefaultObservationFormatter } from "./default-observation-formatter";
import { IPythonObservation } from "#/types/core/observations";

const MAX_CONTENT_LENGTH = 1000;

export class RunIPythonObservationFormatter extends DefaultObservationFormatter {
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
  
  /**
   * For IPython observations, we consider it successful if there's no error message
   */
  override determineSuccess(): boolean {
    const { observation } = this.props;
    const content = observation.payload.content;
    return !content.toLowerCase().includes("error:");
  }
}
