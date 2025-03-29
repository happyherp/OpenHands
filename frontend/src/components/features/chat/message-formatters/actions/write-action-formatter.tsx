import {
  ActionFormatterProps,
} from "../types";
import { DefaultActionFormatter } from "./default-action-formatter";
import { FileWriteAction } from "#/types/core/actions";

const MAX_CONTENT_LENGTH = 1000;

export class WriteActionFormatter extends DefaultActionFormatter {
  constructor(props: ActionFormatterProps) {
    super(props);
  }

  override _makeContent(): string {
    const { action } = this.props;
    const writeAction = action.payload as FileWriteAction;
    
    // For write actions, we show the path and truncated content
    let content = writeAction.args.content;
    if (content.length > MAX_CONTENT_LENGTH) {
      content = `${content.slice(0, MAX_CONTENT_LENGTH)}...`;
    }

    return `Writing to file: ${writeAction.args.path}\n\n\`\`\`\n${content}\n\`\`\``;
  }
}
