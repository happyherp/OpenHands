import { Trans } from "react-i18next";
import {
  ObservationFormatter,
  ObservationFormatterProps,
  FormattedMessage,
} from "../types";
import { MonoComponent } from "../../mono-component";

export class DefaultObservationFormatter implements ObservationFormatter {
  props: ObservationFormatterProps;

  constructor(props: ObservationFormatterProps) {
    this.props = props;
  }

  format(): FormattedMessage {
    const { observation, i18n } = this.props;
    const observationType = observation.payload.observation;
    const translationId = `OBSERVATION_MESSAGE$${observationType.toUpperCase()}`;

    const title = i18n.exists(translationId) ? (
      <Trans
        i18nKey={translationId}
        values={{ observation }}
        components={{
          bold: <strong />,
          path: <MonoComponent />,
          cmd: <MonoComponent />,
        }}
      />
    ) : (
      observationType
    );

    // Default content is the observation content
    return {
      title,
      content: observation.payload.content,
    };
  }
}
