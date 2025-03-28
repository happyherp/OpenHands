import { Trans } from "react-i18next";
import {
  ActionFormatter,
  ActionFormatterProps,
  FormattedMessage,
} from "../types";
import { MonoComponent } from "../../mono-component";

export class DefaultActionFormatter implements ActionFormatter {
  props: ActionFormatterProps;

  constructor(props: ActionFormatterProps) {
    this.props = props;
  }

  format(): FormattedMessage {
    const { action, i18n } = this.props;
    const actionType = action.payload.action;
    const translationId = `ACTION_MESSAGE$${actionType.toUpperCase()}`;

    const title = i18n.exists(translationId) ? (
      <Trans
        i18nKey={translationId}
        values={{ action }}
        components={{
          bold: <strong />,
          path: <MonoComponent />,
          cmd: <MonoComponent />,
        }}
      />
    ) : (
      actionType
    );

    // Default content is empty, specific formatters will override this
    return {
      title,
      content: "",
    };
  }
}
