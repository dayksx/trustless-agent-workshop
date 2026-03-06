# Workshop: Build an Agent from Scratch with LangGraph

This workshop helps trainees understand how to build an AI agent that:

1. **Uses a static prompt** when launching
2. **Delegates work** to an external A2A agent (e.g., swap at a certain time)
3. **Exposes an agent card** (A2A) for discovery
4. **Exposes agentURI** (ERC-8004) for onchain agent metadata

## Prerequisites

- Node.js 18+
- [OpenAI API key](https://platform.openai.com/api-keys) (set `OPENAI_API_KEY` in `.env`)

## Quick Start

```bash
cd examples
pnpm install
pnpm run workshop:4
```

The agent runs at `http://localhost:3000`.

### Workshop Modules

| File | Description |
|------|-------------|
| `1-agent-runtime` | LangGraph workflow (agent, model, tools) |
| `2-agent-tools` | Delegation tools (createTransferDelegation, delegateTransferTool) |
| `3-agent-services` | Express server: /chat, agent card, agent-uri, x402 |
| `4-agent-registration` | Scripts to register agent on-chain |

Run: `pnpm run workshop:1` (test agent) | `pnpm run workshop:2` (start server) | `pnpm run workshop:4` (print registration payload)

## Step-by-Step: What the Code Does

### 1. Static Prompt

The agent has a fixed system prompt that defines its role:

```typescript
const STATIC_SYSTEM_PROMPT = `You are a swap coordinator agent...`;
```

This prompt is injected on every LLM call. Trainees can edit it to change behavior.

### 2. LangGraph Agent

We use the **Graph API** (as in the LangGraph quickstart):

- **State**: `MessagesAnnotation` (messages + tool calls)
- **Nodes**: `llm` (calls Claude) and `tools` (runs tools)
- **Edges**: START → llm → (tools or END) → llm (if tools)

The agent decides when to call tools based on the user message.

### 3. A2A Delegation Tool

The `delegate_swap` tool sends a JSON-RPC `message/send` request to an external A2A agent:

```typescript
const request = {
  jsonrpc: "2.0",
  method: "message/send",
  params: { message: { role: "user", parts: [{ type: "text", text: prompt }] } },
};
await fetch(`${EXTERNAL_SWAP_AGENT_URL}/a2a/v1/`, { ... });
```

Set `EXTERNAL_SWAP_AGENT_URL` to point to your swap agent (e.g., the multichain-agent at `http://localhost:8001`).

### 4. Agent Card (A2A)

Served at `/.well-known/agent-card.json` (RFC 8615). Other agents discover this agent via:

```
GET https://your-agent/.well-known/agent-card.json
```

The card includes: name, description, skills, protocol version, URL.

### 5. Agent URI (ERC-8004)

Served at `/.well-known/agent.json`. This is the offchain metadata referenced by `agentURI` in ERC-8004 registries. It includes:

- `type`: EIP-8004 registration format
- `name`, `description`, `image`
- `services`: A2A endpoint, web endpoint

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | Info |
| GET | `/.well-known/agent-card.json` | A2A agent card |
| GET | `/.well-known/agent-uri.json` | ERC-8004 agentURI metadata |
| POST | `/chat` | Body: `{ "message": "Swap 1 ETH to USDC now" }` |

## Test Without External Agent

```bash
curl -X POST http://localhost:3000/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Swap 1 ETH to USDC now"}'
```

The agent will call `delegate_swap`. If no swap agent is running, you'll get an error from the tool—but the agent flow itself works.

## Test With External Agent

1. Start the multichain-agent (or another A2A swap agent) on port 8001.
2. Set `EXTERNAL_SWAP_AGENT_URL=http://localhost:8001` in `.env`.
3. Run the workshop agent and send the same prompt.

## Concepts for Trainees

- **Static prompt**: Fixed instructions at launch; no dynamic per-user prompt.
- **Agent**: LLM + tools + graph (LangGraph).
- **A2A**: Agent-to-agent protocol; JSON-RPC over HTTP with `message/send`, `tasks/get`.
- **Agent card**: Self-description for discovery; `/.well-known/agent-card.json`.
- **agentURI**: ERC-8004 agent metadata; links onchain to offchain profile.

## Extensions

- Add more tools (e.g., price query, balance check).
- Add delegation support (pass user delegation to the external agent).
- Add MCP server for tool discovery.
- Add streaming responses.
