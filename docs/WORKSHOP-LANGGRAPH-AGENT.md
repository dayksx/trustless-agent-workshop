# Workshop: Build an Agent from Scratch with LangGraph

This workshop helps trainees understand how to build an AI agent that:

1. **Uses a static prompt** when launching
2. **Delegates work** to an external A2A agent (transfer, swap, staking, yield farming, lending)
3. **Exposes an agent card** (A2A) for discovery
4. **Exposes agentURI** (ERC-8004) for onchain agent metadata
5. **Exposes free and paid services** (x402 for paid chat)

## Prerequisites

- Node.js 18+
- [LLM API key](https://platform.openai.com/api-keys) (set `LLM_API_KEY` in `.env`)
- Wallet keys for delegation (Sepolia/Base Sepolia)

## Quick Start

**Create smart accounts first** — you need them to fill `.env` with the smart account addresses:

```bash
pnpm install
cp .env.example .env
# Edit .env with LLM_API_KEY, DELEGATOR_PRIVATE_KEY, DELEGATE_PRIVATE_KEY, BUNDLER_BASE_SEPOLIA_URL

pnpm run workshop create   # Creates smart accounts, prints DELEGATOR_SA_ADDRESS and DELEGATE_SA_ADDRESS
# Add the printed addresses to your .env
```

Then run the workshop:

```bash
pnpm run workshop test     # Test agent (runtime + tools)
pnpm run workshop launch   # Start HTTP server (agent card, free/paid services)
pnpm run workshop register # On-chain agent registration (ERC-8004)
```

The agent runs at `http://localhost:3000`.

### Workshop Modules

| File | Description |
|------|-------------|
| `0-create-smart-accounts` | Create smart accounts (run first, add addresses to `.env`) |
| `1-agent-runtime` | LangGraph workflow (agent, model, tools) |
| `2-agent-tools` | Delegation tools (transfer, swap, staking, yield farming, lending) |
| `3-agent-services` | Express server: /free-service, /paid-service, agent card, agent-uri, x402 |
| `4-agent-registration` | Scripts to register agent on-chain |
| `4-call-agent-services` | CLI to call agent endpoints (agent-card, free, paid, mcp, a2a) |

Run: `pnpm run workshop test` | `pnpm run workshop launch` | `pnpm run workshop register` | `pnpm run call-services [cmd]`

## Step-by-Step: What the Code Does

### 1. Static Prompt

The agent has a fixed system prompt that defines its role:

```typescript
const STATIC_SYSTEM_PROMPT = `You are a transfer coordinator agent. Help users send native tokens (ETH) by delegating to an external A2A transfer agent.`;
```

This prompt is injected on every LLM call. Trainees can edit it to change behavior.

### 2. LangGraph Agent

We use the **Graph API** (as in the LangGraph quickstart):

- **State**: `MessagesAnnotation` (messages + tool calls)
- **Nodes**: `llm` (calls LLM) and `tools` (runs tools)
- **Edges**: START → llm → (tools or END) → llm (if tools)

The agent decides when to call tools based on the user message.

### 3. A2A Delegation Tools

The agent has multiple delegation tools that create ERC-7710 signed delegations and call external A2A agents:

- **delegate_transfer** — Delegates native token (ETH) transfer to an external A2A agent
- **delegate_swap** — Delegates token swap (e.g., ETH ↔ USDC) to an external A2A agent
- **delegate_staking** — Delegates staking operations (workshop placeholder)
- **delegate_yield_farming** — Delegates yield farming (workshop placeholder)
- **delegate_lending** — Delegates lending/borrowing (workshop placeholder)

Each tool creates a signed delegation via `createTransferDelegation` / `createSwapDelegation` and sends it to the external agent via `callExternalAgent`.

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
| POST | `/free-service` | Body: `{ "message": "..." }` — free chat |
| POST | `/paid-service` | Body: `{ "message": "..." }` — x402 paid chat ($0.01 USDC on base-sepolia) |
| POST | `/mcp/v1` | MCP endpoint |
| POST | `/a2a/v1` | A2A endpoint |

## Test With CLI (call-services)

With the server running (`pnpm run workshop launch`):

```bash
pnpm run call-services                    # GET agent-card + agent-uri
pnpm run call-services free --message "Send 0.00042 ETH to 0xA7F36973465b4C3d609961Bc72Cc2E65acE26337"
pnpm run call-services paid --message "..."  # Requires EVM_PRIVATE_KEY + USDC
```

## Test With curl

```bash
curl -X POST http://localhost:3000/free-service \
  -H "Content-Type: application/json" \
  -d '{"message": "Send 0.00042 ETH to 0xA7F36973465b4C3d609961Bc72Cc2E65acE26337"}'
```

The agent will call `delegate_transfer`. If no external agent is running, you may get an error from the tool—but the agent flow itself works.

## Concepts for Trainees

- **Static prompt**: Fixed instructions at launch; no dynamic per-user prompt.
- **Agent**: LLM + tools + graph (LangGraph).
- **A2A**: Agent-to-agent protocol; JSON-RPC over HTTP with `message/send`, `tasks/get`.
- **Agent card**: Self-description for discovery; `/.well-known/agent-card.json`.
- **agentURI**: ERC-8004 agent metadata; links onchain to offchain profile.
- **ERC-7710 delegation**: Delegator signs scope-limited delegations; delegatee redeems on-chain.
- **x402**: HTTP 402 payment protocol for paid services (USDC on base-sepolia).

## Extensions

- Implement `delegate_staking`, `delegate_yield_farming`, `delegate_lending` (currently placeholders).
- Add more tools (e.g., price query, balance check).
- Add MCP server for tool discovery.
- Add streaming responses.
- See [LANGGRAPH-ROUTING-AND-HANDOFFS.md](./LANGGRAPH-ROUTING-AND-HANDOFFS.md) for conditional edges, routing to specialist agents, and handoff patterns.
