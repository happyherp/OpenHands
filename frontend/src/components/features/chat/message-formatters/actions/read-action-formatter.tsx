import {
  ActionFormatterProps,
} from "../types";
import { DefaultActionFormatter } from "./default-action-formatter";
import { FileReadAction } from "#/types/core/actions";

export class ReadActionFormatter extends DefaultActionFormatter {
  constructor(props: ActionFormatterProps) {
    super(props);
  }

  protected override _makeContent(): string {
    const { action } = this.props;
    // For read actions, we just show the path
    const readAction = action.payload as FileReadAction;
    return `Reading file: ${readAction.args.path}`;
  }
}
