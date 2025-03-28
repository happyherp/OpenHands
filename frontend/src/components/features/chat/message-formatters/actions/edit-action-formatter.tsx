import {
  ActionFormatterProps,
} from "../types";
import { DefaultActionFormatter } from "./default-action-formatter";
import { FileEditAction } from "#/types/core/actions";

export class EditActionFormatter extends DefaultActionFormatter {
  constructor(props: ActionFormatterProps) {
    super(props);
  }

  protected override _makeContent(): string {
    const { action } = this.props;
    const editAction = action.payload as FileEditAction;
    
    // For edit actions, we show the path and the edit operation
    const { path } = editAction.args;
    const oldStr = editAction.args.old_str || '';
    const newStr = editAction.args.new_str || '';

    return `Editing file: ${path}\n\nReplacing:\n\`\`\`\n${oldStr}\n\`\`\`\n\nWith:\n\`\`\`\n${newStr}\n\`\`\``;
  }
}
