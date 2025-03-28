import { PayloadAction } from "@reduxjs/toolkit";
import { OpenHandsAction } from "#/types/core/actions";
import { ActionFormatter, ActionFormatterProps, I18nHelpers } from "./types";
import { DefaultActionFormatter } from "./actions/default-action-formatter";
import { RunActionFormatter } from "./actions/run-action-formatter";
import { ReadActionFormatter } from "./actions/read-action-formatter";

export class ActionFormatterFactory {
  static createFormatter(
    action: PayloadAction<OpenHandsAction>,
    i18n: I18nHelpers,
  ): ActionFormatter {
    const props: ActionFormatterProps = { action, i18n };

    switch (action.payload.action) {
      case "run":
        return new RunActionFormatter(props);
      case "read":
        return new ReadActionFormatter(props);
      // Add more cases for other action types as needed
      default:
        return new DefaultActionFormatter(props);
    }
  }
}
