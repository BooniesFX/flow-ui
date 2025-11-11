# Deep Research

[![Python 3.12+](https://img.shields.io/badge/python-3.12+-blue.svg)](https://www.python.org/downloads/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> Deep Exploration and Efficient Research Flow

**Deep Research** is an AI-powered deep research framework that combines language models with specialized tools for web search, crawling, and code execution to generate comprehensive research reports.

## 📑 Table of Contents

- [🚀 Quick Start](#quick-start)
- [🌟 Features](#features)
- [🏗️ Architecture](#architecture)
- [🛠️ Development](#development)
- [📚 Examples](#examples)
- [📜 License](#license)

## Quick Start

### Recommended Tools

- **[`uv`](https://docs.astral.sh/uv/getting-started/installation/):** Python environment and dependency management
- **[`nvm`](https://github.com/nvm-sh/nvm):** Node.js version management
- **[`pnpm`](https://pnpm.io/installation):** Node.js package management

### Environment Requirements

- **Python:** Version `3.12+`
- **Node.js:** Version `22+`

### Installation

```bash
# Clone the repository
git clone https://github.com/BooniesFX/flow-ui
cd deer-flow

# Install Python dependencies
uv sync

# Install web UI dependencies
cd web
pnpm install
cd ..
```


### Running the Application

#### Console UI

```bash
uv run main.py
```

#### Web UI

```bash
# Start both backend and frontend servers
# On macOS/Linux
./bootstrap.sh -d

# On Windows
bootstrap.bat -d
```

Open your browser and visit [`http://localhost:3000`](http://localhost:3000)

> **Note:** By default, the backend binds to 127.0.0.1. To allow external connections, modify the bootstrap script to use `--host 0.0.0.0`. Ensure proper security measures before exposing to external networks.

## Features

### Core Capabilities

- 🤖 **LLM Integration**
  - Support for multiple LLM providers via [litellm](https://docs.litellm.ai/docs/providers)
  - OpenAI-compatible API interface
  - Multi-tier LLM system for different task complexities

### Tools and Integrations

- 🔍 **Search and Retrieval**
  - Multiple search engines: Tavily, Brave Search, DuckDuckGo, Arxiv, Searx/SearxNG
  - Web crawling with Jina
  - Advanced content extraction

- 📃 **RAG Integration**
  - Support for private knowledge bases via [RAGFlow](https://github.com/infiniflow/ragflow)
  - File mention support in input

- 🔗 **MCP Integration**
  - Seamless integration with Model Context Protocol
  - Expand capabilities for private domain access and knowledge graphs

### Research Workflow

- 💬 **Intelligent Clarification**
  - Multi-turn dialogue to clarify vague research topics
  - Improve research precision and reduce ineffective searches
  - Configurable enable/disable control

- 🧠 **Human-in-the-Loop**
  - Interactive modification of research plans
  - Natural language feedback support
  - Auto-acceptance option for streamlined workflow

- 📝 **Report Editing**
  - Notion-like block editing interface
  - AI-assisted refinements (polishing, shortening, expansion)
  - Powered by [tiptap](https://tiptap.dev/)

## Architecture

This framework implements a modular multi-agent system built on LangGraph:

![Architecture Diagram](./assets/architecture.png)

### Key Components

1. **Coordinator**: Entry point managing workflow lifecycle
2. **Planner**: Strategic task decomposition and planning
3. **Research Team**: Specialized agents for execution
   - **Researcher**: Web search and information gathering
   - **Coder**: Code analysis and execution
4. **Reporter**: Final report generation and formatting

## Supported Search Engines

- **Tavily** (default): AI-specialized search API
  - Requires `TAVILY_API_KEY`
  - Sign up: https://app.tavily.com/home


## Development

### Testing

```bash
# Run all tests
make test

# Run specific test file
pytest tests/integration/test_workflow.py

# Run with coverage
make coverage
```

### Code Quality

```bash
# Run linting
make lint

# Format code
make format
```

### Debugging with LangGraph Studio

This framework uses LangGraph for workflow architecture. Use LangGraph Studio to debug and visualize workflows in real-time.

#### Running LangGraph Studio

**macOS:**

```bash
uvx --refresh --from "langgraph-cli[inmem]" --with-editable . --python 3.12 langgraph dev --allow-blocking
```

**Windows/Linux:**

```bash
pip install -e .
pip install -U "langgraph-cli[inmem]"
langgraph dev
```

### Checkpointing

The framework supports workflow checkpointing with PostgreSQL and MongoDB:

- In-memory store for caching streaming messages
- Automatic persistence on completion or interruption
- Replay support for conversations

Configure in `.env`:

```bash
LANGGRAPH_CHECKPOINT_SAVER=true
LANGGRAPH_CHECKPOINT_DB_URL="mongodb://localhost:27017/"
# or
# LANGGRAPH_CHECKPOINT_DB_URL="postgresql://localhost:5432/postgres"
```

> **Note:** For PostgreSQL, use `langgraph-checkpoint-postgres==2.0.21` due to known issues in later versions. See [issue #5557](https://github.com/langchain-ai/langgraph/issues/5557).


> **Warning:** For production deployments, add authentication and evaluate security for MCPServer and Python REPL.

## Examples

### Command Line Usage

```bash
# Run with a specific query
uv run main.py "What factors are influencing AI adoption in healthcare?"

# Run with custom parameters
uv run main.py --max_plan_iterations 3 "How does quantum computing impact cryptography?"

# Interactive mode
uv run main.py --interactive

# View all options
uv run main.py --help
```

### Sample Research Reports

1. [OpenAI Sora Report](examples/openai_sora_report.md) - Analysis of OpenAI's Sora AI tool
2. [Agent to Agent Protocol](examples/what_is_agent_to_agent_protocol.md) - Google's A2A protocol overview
3. [What is MCP?](examples/what_is_mcp.md) - Model Context Protocol analysis
4. [Bitcoin Price Fluctuations](examples/bitcoin_price_fluctuation.md) - Market trend analysis
5. [What is LLM?](examples/what_is_llm.md) - Large Language Models exploration
6. [Claude for Deep Research](examples/how_to_use_claude_deep_research.md) - Best practices guide
7. [AI in Healthcare](examples/AI_adoption_in_healthcare.md) - Adoption factors analysis
8. [Quantum Computing & Cryptography](examples/Quantum_Computing_Impact_on_Cryptography.md) - Impact analysis
9. [Cristiano Ronaldo Highlights](examples/Cristiano_Ronaldo's_Performance_Highlights.md) - Performance analysis

### Interactive Mode

```bash
uv run main.py --interactive
```

1. Select your preferred language
2. Choose from built-in questions or ask your own
3. Review and approve the research plan
4. Get a comprehensive research report

### Human-in-the-Loop

The framework supports interactive plan review and modification:

1. **Plan Review**: Review generated research plans before execution
2. **Feedback**: 
   - Accept: `[ACCEPTED]`
   - Edit: `[EDIT PLAN] Add more steps about technical implementation`
3. **Auto-acceptance**: Enable via API with `auto_accepted_plan: true`

API Example:

```json
{
  "messages": [{ "role": "user", "content": "What is quantum computing?" }],
  "thread_id": "my_thread_id",
  "auto_accepted_plan": false,
  "feedback": "[EDIT PLAN] Include more about quantum algorithms"
}
```

## License

This project is licensed under the [MIT License](./LICENSE).

## Acknowledgments

This project is built upon the incredible work of the open-source community:

- **[LangChain](https://github.com/langchain-ai/langchain)**: LLM framework
- **[LangGraph](https://github.com/langchain-ai/langgraph)**: Multi-agent orchestration
- **[Novel](https://github.com/steven-tey/novel)**: Notion-style editor
- **[RAGFlow](https://github.com/infiniflow/ragflow)**: Private knowledge base integration
