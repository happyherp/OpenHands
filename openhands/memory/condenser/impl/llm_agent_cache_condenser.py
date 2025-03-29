from __future__ import annotations

from dataclasses import dataclass
from typing import List

from openhands.core.logger import openhands_logger as logger
from openhands.core.message import Message, TextContent
from openhands.events.action.agent import CondensationAction
from openhands.events.event import Event
from openhands.llm import LLM
from openhands.memory.condenser.condenser import Condensation, Condenser, View
from openhands.memory.conversation_memory import ConversationMemory
from openhands.utils.prompt import PromptManager


class LLMAgentCacheCondenser(Condenser):
    """A condenser that is tightly coupled with an agent to take advantage of LLM caching.

    This condenser is designed to be used with LLMCacheCodeAgent. It ensures that the LLM
    instance used by the condenser is the same as the one used by the agent, allowing for
    effective caching of prompts.

    Instead of creating a separate prompt for condensation, this condenser uses the same
    prompt format as the agent and appends condensation instructions at the end. This allows
    the LLM to take advantage of the cached prompt and only process the new instructions.
    """

    def __init__(
        self,
        agent_llm: LLM,
        conversation_memory: ConversationMemory,
        prompt_manager: PromptManager,
        max_size: int = 100,
        keep_first: int = 1,
    ):
        """Initialize the condenser with the agent's LLM instance.

        Args:
            agent_llm: The LLM instance used by the agent. This must be the same instance
                       to ensure caching works properly.
            conversation_memory: The conversation memory instance used by the agent.
            prompt_manager: The prompt manager instance used by the agent.
            max_size: The maximum number of events to keep before condensing.
            keep_first: The number of events to always keep at the beginning.
        """
        self.llm = agent_llm
        self.conversation_memory = conversation_memory
        self.prompt_manager = prompt_manager
        self.max_size = max_size
        self.keep_first = keep_first

        # Verify that the LLM supports caching
        if not self.llm.is_caching_prompt_active():
            # Raise an exception since this is an experimental feature
            # and we need caching to be enabled for it to work properly
            raise ValueError(
                'LLMAgentCacheCondenser: The LLM does not support prompt caching. '
                'This condenser requires prompt caching to be enabled.'
            )

        super().__init__()

    def should_condense(self, events: List[Event]) -> bool:
        """Determine if the events should be condensed.

        Condensation is triggered in two cases:
        1. When the number of events exceeds max_size
        2. When the last event is from the user and contains the text "CONDENSE!"

        Args:
            events: The events to check.

        Returns:
            True if the events should be condensed, False otherwise.
        """
        # Check if the number of events exceeds max_size
        if len(events) > self.max_size:
            logger.info(f'Condensing events due to max size({self.max_size}) limit.')
            return True

        # Check if the last event is from the user and contains "CONDENSE!"
        if events and len(events) >= 2:  # Need at least 2 events to condense
            last_event = events[-1]
            # Check if it's a user message by checking the source attribute
            try:
                if hasattr(last_event, 'source') and last_event.source == 'user':
                    # Check if the message contains "CONDENSE!"
                    CONDENSATION_TRIGGER_WORD = 'CONDENSE!'
                    if (
                        hasattr(last_event, 'message')
                        and isinstance(last_event.message, str)
                        and CONDENSATION_TRIGGER_WORD in last_event.message
                    ):
                        logger.info(
                            f"Condensing events due to trigger word '{CONDENSATION_TRIGGER_WORD}'."
                        )
                        return True
            except (AttributeError, TypeError):
                # If we can't access the attributes, just continue
                pass

        return False

    def condense(self, events: List[Event]) -> View | Condensation:
        """Condense the events using the agent's LLM.

        This implementation uses the agent's LLM to condense the events in a way that
        takes advantage of prompt caching. It formats the messages in the same way as
        the agent, but adds condensation instructions at the end.

        Args:
            events: The events to condense.

        Returns:
            The condensed events, a View, or a Condensation.
        """
        # If we don't need to condense, just return the events
        if not self.should_condense(events):
            return View.from_events(events)

        # If we don't have the conversation memory or prompt manager, we can't condense
        if not self.conversation_memory or not self.prompt_manager:
            raise ValueError(
                'LLMAgentCacheCondenser: Missing conversation_memory or prompt_manager. '
                'These are required for the condenser to work properly.'
            )

        return self._do_condensation(events)

    def _do_condensation(self, events: List[Event]) -> Condensation | View:
        """Do a condensation for the given events.

        Args:
            events: The events to condense.

        Returns:
            A Condensation or View object based on the condensation process.
        """
        messages = self._build_messages_for_condensation(events)

        # Get the response from the LLM
        response = self.llm.completion(
            messages=self.llm.format_messages_for_llm(messages),
        )
        self.add_metadata('response', response.model_dump())

        rewrite_commands, keep_message_indices = self._parse_condensation_response(
            response
        )
        condensation = self._condense_events(
            events, rewrite_commands, keep_message_indices
        )
        return condensation

    def _build_messages_for_condensation(self, events: List[Event]) -> list[Message]:
        # Process the events into messages using the same format as the agent
        # This ensures we can take advantage of the LLM's cache
        initial_messages = self.conversation_memory.process_initial_messages(
            with_caching=True
        )

        messages = self.conversation_memory.process_events(
            condensed_history=events,
            initial_messages=initial_messages,
            max_message_chars=self.llm.config.max_message_chars,
            vision_is_active=self.llm.vision_is_active(),
        )

        # Add the condensation instructions as a user message at the end
        condensation_instructions = """
I need you to condense our conversation history to make it more efficient. Please:

1. Identify which previous messages can be removed without losing important context
2. You have two options for condensing the conversation:

    Option A - Keep specific messages:
    For each message you decide to keep, respond with "KEEP: [message number]"

    Option B - Rewrite a range of messages:
    You can replace a sequence of messages with a single summary using:

    REWRITE [start-message-number] TO [end-message-number] WITH:
    [new-content]
    END-REWRITE

    This will replace all messages from start to end (inclusive) with a single message containing the new content.

3. You can use both options together. For example:
    KEEP: 5
    KEEP: 8
    REWRITE 10 TO 15 WITH:
    User asked about database schema and agent explained the tables and relationships.
    END-REWRITE
    KEEP: 18

4. Focus on keeping messages that contain:
    - User requirements and constraints
    - Important code changes and decisions
    - Key error messages and debugging information
    - Critical context needed for the current task

5. You can remove or rewrite messages that:
    - Contain redundant information
    - Show intermediate steps that are no longer relevant
    - Contain verbose output that has already been processed

Please respond ONLY with KEEP and REWRITE commands as described above.
Do not include any other text in your response.
"""

        # Add the condensation instructions as the last message
        messages.append(
            Message(role='user', content=[TextContent(text=condensation_instructions)])
        )

        self.conversation_memory.apply_prompt_caching(messages)
        return messages

    def _parse_condensation_response(
        self, response: Message
    ) -> tuple[list[RewriteCommand], list[int]]:
        # Parse the response to get the list of messages to keep and any REWRITE commands
        keep_message_indices = []
        rewrite_commands = []
        rewrite_start = None
        rewrite_end = None
        rewrite_content: list[str] = []

        response_text = response.choices[0].message.content or ''

        lines = response_text.strip().split('\n')
        i = 0
        while i < len(lines):
            line = lines[i].strip()

            # Process KEEP commands
            if line.startswith('KEEP:'):
                try:
                    index = int(line.replace('KEEP:', '').strip())
                    keep_message_indices.append(index)
                except ValueError:
                    pass
                i += 1

            # Process REWRITE commands
            elif line.startswith('REWRITE ') and ' TO ' in line and ' WITH:' in line:
                try:
                    # Extract the start and end event IDs from the line
                    command_parts = line.split(' WITH:')[0].strip()
                    range_parts = command_parts.replace('REWRITE ', '').split(' TO ')
                    rewrite_start = int(range_parts[0].strip())
                    rewrite_end = int(range_parts[1].strip())

                    # Collect content until END-REWRITE
                    rewrite_content = []
                    i += 1  # Move to the next line after the REWRITE command

                    while i < len(lines) and lines[i].strip() != 'END-REWRITE':
                        rewrite_content.append(lines[i])
                        i += 1

                    if i < len(lines) and lines[i].strip() == 'END-REWRITE':
                        # Found the end marker, create the rewrite command
                        rewrite_commands.append(
                            RewriteCommand(
                                start=rewrite_start,
                                end=rewrite_end,
                                content='\n'.join(rewrite_content),
                            )
                        )

                    # Skip the END-REWRITE line
                    i += 1

                except (ValueError, IndexError) as e:
                    logger.info(
                        f"Error parsing line '{line}': {e}. Skipping this line."
                    )
                    i += 1
            else:
                # Skip any other lines
                i += 1

        return rewrite_commands, keep_message_indices

    def _condense_events(
        self,
        events: List[Event],
        rewrite_commands: list[RewriteCommand],
        keep_message_indices: list[int],
    ) -> Condensation | View:
        # If we couldn't parse any indices and there's no rewrite command, keep all events
        if not keep_message_indices and not rewrite_commands:
            return View.from_events(events)

        # Always keep the first few events (system prompt, initial user message, etc.)
        keep_event_ids = set(event.id for event in events[: self.keep_first])

        summary = ''

        # Add the events to keep based on the LLM's response
        for index in keep_message_indices:
            if 0 <= index < len(events):
                keep_event_ids.add(events[index].id)

        # Create a list of event IDs to forget
        forgotten_event_ids = [
            event.id for event in events if event.id not in keep_event_ids
        ]

        for rewrite_command in rewrite_commands:
            # Get the range of events to rewrite
            start_idx = rewrite_command.start
            end_idx = rewrite_command.end

            # Validate the range
            if 0 <= start_idx < len(events) and 0 <= end_idx < len(events):
                # Add events in the rewrite range to forgotten_event_ids (except those in keep_first)
                for i in range(start_idx, end_idx + 1):
                    if i >= self.keep_first:  # Don't remove events in keep_first
                        event_id = events[i].id
                        if event_id in keep_event_ids:
                            keep_event_ids.remove(event_id)
                        if event_id not in forgotten_event_ids:
                            forgotten_event_ids.append(event_id)

                summary += rewrite_command.content + '\n'
            else:
                logger.info(
                    f'Invalid range for REWRITE command: {start_idx} to {end_idx}. Skipping this command.'
                )
                summary += (
                    f'The conversation history has been condensed. {len(forgotten_event_ids)} less important messages have been removed to focus on the key information.'
                    + '\n'
                )
        else:
            summary += (
                f'The conversation history has been condensed. {len(forgotten_event_ids)} less important messages have been removed to focus on the key information.'
                + '\n'
            )

        # Add metadata for debugging and analysis
        self.add_metadata('metrics', self.llm.metrics.get())
        self.add_metadata('kept_events', len(keep_event_ids))
        self.add_metadata('forgotten_events', len(forgotten_event_ids))

        # Create and return the condensation action
        return Condensation(
            action=CondensationAction(
                forgotten_event_ids=forgotten_event_ids,
                summary=summary,
                summary_offset=self.keep_first,
            )
        )


@dataclass
class RewriteCommand:
    """Represents a rewrite command parsed from the LLM response."""

    start: int
    end: int
    content: str
