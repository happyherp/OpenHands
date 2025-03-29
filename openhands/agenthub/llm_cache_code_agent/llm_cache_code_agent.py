from __future__ import annotations

from typing import List, Type

from openhands.agenthub.codeact_agent.codeact_agent import CodeActAgent
from openhands.controller.state.state import State
from openhands.core.config.agent_config import AgentConfig
from openhands.events.event import Event
from openhands.llm import LLM
from openhands.memory.condenser.condenser import Condenser
from openhands.memory.condenser.impl.llm_agent_cache_condenser import LLMAgentCacheCondenser
from openhands.memory.conversation_memory import ConversationMemory
from openhands.utils.prompt import PromptManager


class LLMCacheCodeAgent(CodeActAgent):
    """A CodeActAgent that uses a specialized condenser to take advantage of LLM caching.
    
    This agent uses the LLMAgentCacheCondenser, which shares the same LLM instance as the agent.
    This allows for effective caching of prompts between the agent and condenser.
    
    The condenser uses the same prompt format as the agent and appends condensation instructions
    at the end. This allows the LLM to take advantage of the cached prompt and only process the
    new instructions, significantly reducing token usage and costs.
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
        # Create and set the LLMAgentCacheCondenser with the agent's conversation_memory and prompt_manager
        # We need to ensure conversation_memory and prompt_manager are initialized by the parent class
        if not hasattr(self, 'conversation_memory') or not hasattr(self, 'prompt_manager'):
            # This is an experimental feature, so we'll raise an exception if the required
            # attributes are missing to help with debugging
            raise ValueError(
                "LLMCacheCodeAgent: Missing conversation_memory or prompt_manager. "
                "These are required for the agent to work properly."
            )
            
        # Create and set the LLMAgentCacheCondenser
        self.condenser = LLMAgentCacheCondenser(
            agent_llm=llm,
            conversation_memory=self.conversation_memory,
            prompt_manager=self.prompt_manager,
            max_size=100,  # Default max size
            keep_first=1,  # Default keep first
        )
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