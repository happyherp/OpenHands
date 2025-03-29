from __future__ import annotations

from typing import List, Type

from openhands.agenthub.codeact_agent.codeact_agent import CodeActAgent
from openhands.controller.state.state import State
from openhands.core.config.agent_config import AgentConfig
from openhands.events.event import Event
from openhands.llm import LLM
from openhands.memory.condenser.condenser import Condenser
from openhands.memory.condenser.impl.llm_agent_cache_condenser import LLMAgentCacheCondenser


class LLMCacheCodeAgent(CodeActAgent):
    """A CodeActAgent that uses a specialized condenser to take advantage of LLM caching.
    
    This agent uses the LLMAgentCacheCondenser, which shares the same LLM instance as the agent.
    This allows for effective caching of prompts between the agent and condenser.
    """

    def __init__(
        self,
        llm: LLM,
        config: AgentConfig,
    ) -> None:
        """Initialize the agent with the given LLM and configuration.
        
        Args:
            llm: The LLM to use for generating responses.
            config: The agent configuration.
        """
        # Initialize the parent class
        super().__init__(llm=llm, config=config)
        
        # Override the condenser created by the parent class
        # Create and set the LLMAgentCacheCondenser
        self.condenser = LLMAgentCacheCondenser(agent_llm=llm)
        self._condenser = self.condenser  # For compatibility with our tests

    def condensed_history(self, state: State) -> List[Event]:
        """Get the condensed history using the LLMAgentCacheCondenser.
        
        Args:
            state: The current state.
            
        Returns:
            The condensed history.
        """
        return self._condenser.condensed_history(state)
        
    @classmethod
    def get_condenser_class(cls) -> Type[Condenser]:
        """Get the condenser class used by this agent.
        
        Returns:
            The LLMAgentCacheCondenser class.
        """
        return LLMAgentCacheCondenser