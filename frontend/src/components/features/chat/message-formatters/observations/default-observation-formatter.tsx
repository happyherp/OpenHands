import { Trans } from "react-i18next";
import React, { ReactNode } from "react";
import { ObservationFormatter, ObservationFormatterProps } from "../types";
import { MonoComponent } from "../../mono-component";
import { ExpandableMessageProps } from "../../expandable-message";
import { BaseFormatter } from "../base-formatter";

export class DefaultObservationFormatter
  extends BaseFormatter
  implements ObservationFormatter
{
  props: ObservationFormatterProps;

  constructor(props: ObservationFormatterProps) {
    super();
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
    const { observation } = this.props;
    return observation.payload.content;
  }

  toExpandableMessage(
    props: Omit<ExpandableMessageProps, "title" | "content"> = {},
  ): React.ReactElement {
    return super.toExpandableMessage({
      type: "observation",
      ...props,
    });
  }
}
