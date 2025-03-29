from unittest.mock import MagicMock

import pytest

from openhands.llm import LLM
from openhands.memory.condenser.impl.llm_agent_cache_condenser import LLMAgentCacheCondenser


def test_llm_agent_cache_condenser_init():
    """Test that the LLMAgentCacheCondenser initializes correctly."""
    # Mock the LLM
    mock_llm = MagicMock(spec=LLM)
    mock_llm.is_caching_prompt_active.return_value = True
    
    # Create the condenser
    condenser = LLMAgentCacheCondenser(agent_llm=mock_llm)
    
    # Verify that the condenser has the correct LLM
    assert condenser.llm is mock_llm


def test_llm_agent_cache_condenser_condense():
    """Test that the LLMAgentCacheCondenser returns events unchanged."""
    # Mock the LLM
    mock_llm = MagicMock(spec=LLM)
    mock_llm.is_caching_prompt_active.return_value = True
    
    # Create the condenser
    condenser = LLMAgentCacheCondenser(agent_llm=mock_llm)
    
    # Create some mock events
    mock_events = [MagicMock(), MagicMock(), MagicMock()]
    
    # Condense the events
    result = condenser.condense(mock_events)
    
    # Verify that the events are returned unchanged
    assert result == mock_events