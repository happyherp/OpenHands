import { PayloadAction } from "@reduxjs/toolkit";
import { OpenHandsAction } from "#/types/core/actions";
import { OpenHandsObservation } from "#/types/core/observations";
import {
  ActionFormatter,
  ActionFormatterProps,
  ObservationFormatter,
  ObservationFormatterProps,
} from "./types";

// Action formatters
import { DefaultActionFormatter } from "./actions/default-action-formatter";
import { RunActionFormatter } from "./actions/run-action-formatter";
import { RunIPythonActionFormatter } from "./actions/run-ipython-action-formatter";
import { ReadActionFormatter } from "./actions/read-action-formatter";
import { WriteActionFormatter } from "./actions/write-action-formatter";
import { EditActionFormatter } from "./actions/edit-action-formatter";
import { BrowseActionFormatter } from "./actions/browse-action-formatter";
import { BrowseInteractiveActionFormatter } from "./actions/browse-interactive-action-formatter";

// Observation formatters
import { DefaultObservationFormatter } from "./observations/default-observation-formatter";
import { RunObservationFormatter } from "./observations/run-observation-formatter";
import { RunIPythonObservationFormatter } from "./observations/run-ipython-observation-formatter";
import { ReadObservationFormatter } from "./observations/read-observation-formatter";
import { WriteObservationFormatter } from "./observations/write-observation-formatter";
import { EditObservationFormatter } from "./observations/edit-observation-formatter";
import { BrowseObservationFormatter } from "./observations/browse-observation-formatter";

export class FormatterFactory {
  static createActionFormatter(
    action: PayloadAction<OpenHandsAction>,
  ): ActionFormatter {
    const props: ActionFormatterProps = { action };

    switch (action.payload.action) {
      case "run":
        return new RunActionFormatter(props);
      case "run_ipython":
        return new RunIPythonActionFormatter(props);
      case "read":
        return new ReadActionFormatter(props);
      case "write":
        return new WriteActionFormatter(props);
      case "edit":
        return new EditActionFormatter(props);
      case "browse":
        return new BrowseActionFormatter(props);
      case "browse_interactive":
        return new BrowseInteractiveActionFormatter(props);
      default:
        return new DefaultActionFormatter(props);
    }
  }

  static createObservationFormatter(
    observation: PayloadAction<OpenHandsObservation>,
  ): ObservationFormatter {
    const props: ObservationFormatterProps = { observation };

    switch (observation.payload.observation) {
      case "run":
        return new RunObservationFormatter(props);
      case "run_ipython":
        return new RunIPythonObservationFormatter(props);
      case "read":
        return new ReadObservationFormatter(props);
      case "write":
        return new WriteObservationFormatter(props);
      case "edit":
        return new EditObservationFormatter(props);
      case "browse":
        return new BrowseObservationFormatter(props);
      default:
        return new DefaultObservationFormatter(props);
    }
  }
}
