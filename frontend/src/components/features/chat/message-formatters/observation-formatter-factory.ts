import { PayloadAction } from "@reduxjs/toolkit";
import { OpenHandsObservation } from "#/types/core/observations";
import {
  ObservationFormatter,
  ObservationFormatterProps,
  I18nHelpers,
} from "./types";
import { DefaultObservationFormatter } from "./observations/default-observation-formatter";
import { RunObservationFormatter } from "./observations/run-observation-formatter";
import { ReadObservationFormatter } from "./observations/read-observation-formatter";

export class ObservationFormatterFactory {
  static createFormatter(
    observation: PayloadAction<OpenHandsObservation>,
    i18n: I18nHelpers,
  ): ObservationFormatter {
    const props: ObservationFormatterProps = { observation, i18n };

    switch (observation.payload.observation) {
      case "run":
        return new RunObservationFormatter(props);
      case "read":
        return new ReadObservationFormatter(props);
      // Add more cases for other observation types as needed
      default:
        return new DefaultObservationFormatter(props);
    }
  }
}
