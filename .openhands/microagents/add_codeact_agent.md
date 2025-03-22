---
name: add_codeact_agent
version: 1.0.0
agent: CodeActAgent
triggers:
  - add code act agent
  - create new agent
  - CodeActAgent
---

# Add CodeActAgent Microagent

This microagent provides guidance on how to add a new agent based on the existing `CodeActAgent` in the OpenHands project.

## Overview
The `CodeActAgent` is a minimalist agent that can converse and execute code. It consolidates LLM agents' actions into a unified code action space for simplicity and performance. This microagent will guide you through the steps to create a new agent similar to `CodeActAgent`.

## Steps to Add a New Agent
1. **Create a New Python Class**:  
   - Create a new file in the `openhands/agenthub` directory, e.g., `my_new_agent.py`.  
   - Define a new class that extends the `Agent` class, similar to how `CodeActAgent` is defined.

2. **Initialize the Agent**:  
   - In the `__init__` method, set up any necessary tools and configurations. Use the `get_tools` function to retrieve enabled tools.

3. **Implement Key Methods**:  
   - Implement the `step` method to define how the agent will process actions and interact with the LLM.  
   - Use the `_get_messages` method to construct the message history for the LLM conversation.

4. **Define Tools**:  
   - If your new agent requires specific tools, define them in the `function_calling.py` file.  
   - Use existing tools like `BashTool`, `IPythonTool`, or create new ones as needed.

5. **Testing**:  
   - Ensure that your new agent is thoroughly tested. You can use the existing test framework in the `tests` directory to create unit and integration tests.

6. **Documentation**:  
   - Update relevant documentation to reflect the new agent's capabilities and usage.  
   - Consider adding examples of how to use the new agent in the README files.

## Example Code Snippet
```python
class MyNewAgent(Agent):
    def __init__(self, llm: LLM, config: AgentConfig) -> None:
        super().__init__(llm, config)
        self.tools = get_tools()

    def step(self, state: State) -> Action:
        # Implement your agent's logic here
        pass
```

## Additional Resources
- [OpenHands Documentation](https://docs.all-hands.dev)
- [CodeActAgent Implementation](https://github.com/All-Hands-AI/OpenHands/blob/main/openhands/agenthub/codeact_agent/codeact_agent.py)
- [Function Calling Implementation](https://github.com/All-Hands-AI/OpenHands/blob/main/openhands/agenthub/codeact_agent/function_calling.py)

Feel free to reach out to the community for any questions or assistance while creating your new agent!