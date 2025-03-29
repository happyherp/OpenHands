import React, { ReactNode } from "react";
import { MessageFormatter } from "./types";
import { ExpandableMessage, ExpandableMessageProps } from "../expandable-message";

export abstract class BaseFormatter implements MessageFormatter {
  protected abstract _makeTitle(): ReactNode;
  abstract _makeContent(): string;

  toExpandableMessage(props: Omit<ExpandableMessageProps, "title" | "content"> = {}): React.ReactElement {
    return (
      <ExpandableMessage
        title={this._makeTitle()}
        content={this._makeContent()}
        {...props}
      />
    );
  }
}