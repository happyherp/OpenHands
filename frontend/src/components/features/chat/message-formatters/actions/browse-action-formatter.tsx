import {
  ActionFormatterProps,
} from "../types";
import { DefaultActionFormatter } from "./default-action-formatter";
import { BrowseAction } from "#/types/core/actions";

export class BrowseActionFormatter extends DefaultActionFormatter {
  constructor(props: ActionFormatterProps) {
    super(props);
  }

  override _makeContent(): string {
    const { action } = this.props;
    // For browse actions, we show the URL
    const browseAction = action.payload as BrowseAction;
    return `Browsing ${browseAction.args.url}`;
  }
}
