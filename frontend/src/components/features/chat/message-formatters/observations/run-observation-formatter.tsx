import React, { ReactNode } from "react";
import { ObservationFormatterProps } from "../types";
import { DefaultObservationFormatter } from "./default-observation-formatter";
import { CommandObservation } from "#/types/core/observations";

const trimText = (text: string, maxLength: number): string => {
  if (!text) return "";
  return text.length > maxLength ? `${text.substring(0, maxLength)}...` : text;
};

export class RunObservationFormatter extends DefaultObservationFormatter {
  private processedObservation: ObservationFormatterProps["observation"];

  constructor(props: ObservationFormatterProps) {
    super(props);

    // Process the command to trim it if needed
    const { observation } = props;
    const commandObservation = observation.payload as CommandObservation;
    const trimmedCommand = trimText(commandObservation.extras.command, 80);
    this.processedObservation = {
      ...observation,
      payload: {
        ...observation.payload,
        extras: {
          ...commandObservation.extras,
          command: trimmedCommand,
        },
      } as CommandObservation,
    };
  }

  protected override _makeTitle(): ReactNode {
    // Use the processed observation with trimmed command for the title
    const originalObservation = this.props.observation;
    this.props.observation = this.processedObservation;
    const title = super._makeTitle();
    this.props.observation = originalObservation;
    return title;
  }

  override _makeContent(): string {
    const { observation } = this.props;
    const commandObservation = observation.payload as CommandObservation;

    // Format the content with command and output
    let { content } = observation.payload;
    if (content.length > 1000) {
      content = `${content.slice(0, 1000)}...`;
    }

    return `Command:\n\`${commandObservation.extras.command}\`\n\nOutput:\n\`\`\`\n${content.trim() || "[Command finished execution with no output]"}\n\`\`\``;
  }
  
  /**
   * For run observations, we consider it successful if the exit code is 0
   */
  override determineSuccess(): boolean {
    const { observation } = this.props;
    const commandObservation = observation.payload as CommandObservation;
    return commandObservation.extras.metadata.exit_code === 0;
  }
}
