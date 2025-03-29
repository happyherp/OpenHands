from __future__ import annotations

from typing import List

from openhands.controller.state.state import State
from openhands.core.message import Message, TextContent
from openhands.events.action.agent import CondensationAction
from openhands.events.event import Event
from openhands.events.observation.agent import AgentCondensationObservation
from openhands.llm import LLM
from openhands.memory.condenser.condenser import Condenser, Condensation, View
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

    def __init__(self, agent_llm: LLM, conversation_memory: ConversationMemory = None, 
                 prompt_manager: PromptManager = None, max_size: int = 100, keep_first: int = 1):
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
                "LLMAgentCacheCondenser: The LLM does not support prompt caching. "
                "This condenser requires prompt caching to be enabled."
            )
            
        super().__init__()

    def should_condense(self, events: List[Event]) -> bool:
        """Determine if the events should be condensed.
        
        Args:
            events: The events to check.
            
        Returns:
            True if the events should be condensed, False otherwise.
        """
        return len(events) > self.max_size

    def condense(self, events: List[Event]) -> List[Event] | View | Condensation:
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
                "LLMAgentCacheCondenser: Missing conversation_memory or prompt_manager. "
                "These are required for the condenser to work properly."
            )
            
        # Process the events into messages using the same format as the agent
        # This ensures we can take advantage of the LLM's cache
        initial_messages = self.conversation_memory.process_initial_messages(
            with_caching=self.llm.is_caching_prompt_active()
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
2. For each message you decide to keep, simply respond with "KEEP: [message number]"
3. For messages you decide to remove, don't mention them
4. Focus on keeping messages that contain:
   - User requirements and constraints
   - Important code changes and decisions
   - Key error messages and debugging information
   - Critical context needed for the current task
5. You can remove messages that:
   - Contain redundant information
   - Show intermediate steps that are no longer relevant
   - Contain verbose output that has already been processed
   
Please respond ONLY with the list of messages to keep in the format "KEEP: [message number]".
Do not include any other text in your response.
"""
        
        # Add the condensation instructions as the last message
        messages.append(
            Message(
                role="user",
                content=[TextContent(text=condensation_instructions)]
            )
        )
        
        # Apply prompt caching to ensure the LLM uses its cache
        if self.llm.is_caching_prompt_active():
            self.conversation_memory.apply_prompt_caching(messages)
        
        # Get the response from the LLM
        response = self.llm.completion(
            messages=self.llm.format_messages_for_llm(messages),
        )
        
        # Parse the response to get the list of messages to keep
        keep_message_indices = []
        response_text = response.choices[0].message.content or ""
        
        for line in response_text.strip().split("\n"):
            line = line.strip()
            if line.startswith("KEEP:"):
                try:
                    index = int(line.replace("KEEP:", "").strip())
                    keep_message_indices.append(index)
                except ValueError:
                    pass
        
        # If we couldn't parse any indices, keep all events
        if not keep_message_indices:
            return View.from_events(events)
        
        # Always keep the first few events (system prompt, initial user message, etc.)
        keep_event_ids = set(event.id for event in events[:self.keep_first])
        
        # Add the events to keep based on the LLM's response
        for index in keep_message_indices:
            if 0 <= index < len(events):
                keep_event_ids.add(events[index].id)
        
        # Create a list of event IDs to forget
        forgotten_event_ids = [event.id for event in events if event.id not in keep_event_ids]
        
        # If there are no events to forget, just return the view
        if not forgotten_event_ids:
            return View.from_events(events)
        
        # Create a summary of what was condensed
        summary = f"The conversation history has been condensed. {len(forgotten_event_ids)} less important messages have been removed to focus on the key information."
        
        # Add metadata for debugging and analysis
        self.add_metadata("response", response.model_dump())
        self.add_metadata("metrics", self.llm.metrics.get())
        self.add_metadata("kept_events", len(keep_event_ids))
        self.add_metadata("forgotten_events", len(forgotten_event_ids))
        
        # Create and return the condensation action
        return Condensation(
            action=CondensationAction(
                forgotten_event_ids=forgotten_event_ids,
                summary=summary,
                summary_offset=self.keep_first,
            )
        )