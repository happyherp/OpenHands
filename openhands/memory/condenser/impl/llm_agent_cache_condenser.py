from __future__ import annotations

from typing import List

from openhands.controller.state.state import State
from openhands.events.event import Event
from openhands.llm import LLM
from openhands.memory.condenser.condenser import Condenser


class LLMAgentCacheCondenser(Condenser):
    """A condenser that is tightly coupled with an agent to take advantage of LLM caching.
    
    This condenser is designed to be used with LLMCacheCodeAgent. It ensures that the LLM
    instance used by the condenser is the same as the one used by the agent, allowing for
    effective caching of prompts.
    """

    def __init__(self, agent_llm: LLM):
        """Initialize the condenser with the agent's LLM instance.
        
        Args:
            agent_llm: The LLM instance used by the agent. This must be the same instance
                       to ensure caching works properly.
        """
        self.llm = agent_llm
        
        # Verify that the LLM supports caching
        if not self.llm.is_caching_prompt_active():
            # Just log a warning, don't raise an exception
            from openhands.core import logger
            logger.openhands_logger.warning(
                "LLMAgentCacheCondenser: The LLM does not support prompt caching. "
                "This condenser will not provide any performance benefits."
            )
            
        super().__init__()

    def condense(self, events: List[Event]) -> List[Event]:
        """Condense the events using the agent's LLM.
        
        This is a placeholder implementation that currently returns the events unchanged.
        Future implementations will use the agent's LLM to condense the events in a way
        that takes advantage of prompt caching.
        
        Args:
            events: The events to condense.
            
        Returns:
            The condensed events (currently unchanged).
        """
        # For now, just return the events unchanged
        # This will be implemented in the future
        return events