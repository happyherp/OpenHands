import { Trans } from "react-i18next";
import React, { ReactNode } from "react";
import {
  ActionFormatter,
  ActionFormatterProps,
} from "../types";
import { MonoComponent } from "../../mono-component";
import { ExpandableMessageProps } from "../../expandable-message";
import { BaseFormatter } from "../base-formatter";

export class DefaultActionFormatter extends BaseFormatter implements ActionFormatter {
  props: ActionFormatterProps;

  constructor(props: ActionFormatterProps) {
    super();
    this.props = props;
  }

  protected _makeTitle(): ReactNode {
    const { action } = this.props;
    const actionType = action.payload.action;
    const translationId = `ACTION_MESSAGE$${actionType.toUpperCase()}`;

    return (
      <Trans
        i18nKey={translationId}
        values={{ action }}
        components={{
          bold: <strong />,
          path: <MonoComponent />,
          cmd: <MonoComponent />,
        }}
        fallback={actionType}
      />
    );
  }

  protected _makeContent(): string {
    return "";
  }

  toExpandableMessage(props: Omit<ExpandableMessageProps, "title" | "content"> = {}): React.ReactElement {
    return super.toExpandableMessage({
      type: "action",
      ...props
    });
  }
}
