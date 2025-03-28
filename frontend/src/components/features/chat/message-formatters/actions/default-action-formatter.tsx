import { Trans } from "react-i18next";
import React, { ReactNode } from "react";
import {
  ActionFormatter,
  ActionFormatterProps,
  FormattedMessage,
} from "../types";
import { MonoComponent } from "../../mono-component";
import { ExpandableMessage, ExpandableMessageProps } from "../../expandable-message";

export class DefaultActionFormatter implements ActionFormatter {
  props: ActionFormatterProps;

  constructor(props: ActionFormatterProps) {
    this.props = props;
  }

  protected _makeTitle(): ReactNode {
    const { action, i18n } = this.props;
    const actionType = action.payload.action;
    const translationId = `ACTION_MESSAGE$${actionType.toUpperCase()}`;

    return i18n.exists(translationId) ? (
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
  }

  protected _makeContent(): string {
    // Default content is empty, specific formatters will override this
    return "";
  }

  format(): FormattedMessage {
    return {
      title: this._makeTitle(),
      content: this._makeContent(),
    };
  }

  toExpandableMessage(props: Omit<ExpandableMessageProps, "title" | "content"> = {}): React.ReactElement {
    const { title, content } = this.format();
    
    return (
      <ExpandableMessage
        title={title}
        content={content}
        type="action"
        {...props}
      />
    );
  }
}
