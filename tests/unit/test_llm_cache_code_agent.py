from unittest.mock import MagicMock

import pytest

from openhands.agenthub.llm_cache_code_agent import LLMCacheCodeAgent
from openhands.core.config.agent_config import AgentConfig
from openhands.core.config.condenser_config import NoOpCondenserConfig
from openhands.llm import LLM
from openhands.memory.condenser.impl.llm_agent_cache_condenser import LLMAgentCacheCondenser


def test_llm_cache_code_agent_init():
    """Test that the LLMCacheCodeAgent initializes correctly."""
    # Mock the LLM config
    mock_llm_config = MagicMock()
    mock_llm_config.model = "gpt-4"
    
    # Mock the LLM
    mock_llm = MagicMock(spec=LLM)
    mock_llm.is_caching_prompt_active.return_value = True
    mock_llm.config = mock_llm_config
    
    # Mock the agent config with required attributes
    mock_config = MagicMock(spec=AgentConfig)
    mock_config.codeact_enable_browsing = False
    mock_config.codeact_enable_jupyter = False
    mock_config.codeact_enable_llm_editor = False
    mock_config.condenser = None  # Set to None to bypass Condenser.from_config
    
    # Create the agent
    agent = LLMCacheCodeAgent(
        llm=mock_llm,
        config=mock_config,
    )
    
    # Verify that the agent has a LLMAgentCacheCondenser
    assert isinstance(agent._condenser, LLMAgentCacheCondenser)
    
    # Verify that the condenser uses the same LLM as the agent
    assert agent._condenser.llm is mock_llm


def test_llm_cache_code_agent_condenser_class():
    """Test that the LLMCacheCodeAgent returns the correct condenser class."""
    assert LLMCacheCodeAgent.get_condenser_class() is LLMAgentCacheCondenser


def test_llm_cache_code_agent_condensed_history():
    """Test that the LLMCacheCodeAgent uses its condenser for condensed_history."""
    # Mock the LLM config
    mock_llm_config = MagicMock()
    mock_llm_config.model = "gpt-4"
    
    # Mock the LLM
    mock_llm = MagicMock(spec=LLM)
    mock_llm.is_caching_prompt_active.return_value = True
    mock_llm.config = mock_llm_config
    
    # Mock the agent config with required attributes
    mock_config = MagicMock(spec=AgentConfig)
    mock_config.codeact_enable_browsing = False
    mock_config.codeact_enable_jupyter = False
    mock_config.codeact_enable_llm_editor = False
    mock_config.condenser = None  # Set to None to bypass Condenser.from_config
    
    # Create the agent
    agent = LLMCacheCodeAgent(
        llm=mock_llm,
        config=mock_config,
    )
    
    # Mock the state
    mock_state = MagicMock()
    
    # Mock the condenser's condensed_history method
    agent._condenser.condensed_history = MagicMock()
    
    # Call the agent's condensed_history method
    agent.condensed_history(mock_state)
    
    # Verify that the condenser's condensed_history method was called
    agent._condenser.condensed_history.assert_called_once_with(mock_state)