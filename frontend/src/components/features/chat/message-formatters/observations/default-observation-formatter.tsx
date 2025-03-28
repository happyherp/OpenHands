import { Trans } from "react-i18next";
import React, { ReactNode } from "react";
import {
  ObservationFormatter,
  ObservationFormatterProps,
  FormattedMessage,
} from "../types";
import { MonoComponent } from "../../mono-component";
import { ExpandableMessage, ExpandableMessageProps } from "../../expandable-message";

export class DefaultObservationFormatter implements ObservationFormatter {
  props: ObservationFormatterProps;

  constructor(props: ObservationFormatterProps) {
    this.props = props;
  }

  protected _makeTitle(): ReactNode {
    const { observation } = this.props;
    const observationType = observation.payload.observation;
    const translationId = `OBSERVATION_MESSAGE$${observationType.toUpperCase()}`;

    return (
      <Trans
        i18nKey={translationId}
        values={{ observation }}
        components={{
          bold: <strong />,
          path: <MonoComponent />,
          cmd: <MonoComponent />,
        }}
        fallback={observationType}
      />
    );
  }

  protected _makeContent(): string {
    // Default content is the observation content
    const { observation } = this.props;
    return observation.payload.content;
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
        type="observation"
        {...props}
      />
    );
  }
}
