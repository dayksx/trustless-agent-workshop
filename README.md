# Trustless Agent Workshop

Examples and workshop for building AI agents with **EIP-7702**, **ERC-7710** delegation, and related patterns. Uses LangGraph for the agent runtime and MetaMask Smart Accounts Kit for delegation.

## Prerequisites

- **Node.js** 18+
- **pnpm** (recommended) or npm
- **LLM API key** (OpenAI, Anthropic, etc.) for the agent
- **Wallet keys** for delegation examples (Sepolia/Base Sepolia)

## Quick Start

```bash
pnpm install
cp .env.example .env
# Edit .env with your API keys and addresses
```

### Workshop (LangGraph Agent)

```bash
pnpm run workshop test     # Test agent (runtime + tools)
pnpm run workshop launch   # Start HTTP server (agent card, chat)
pnpm run workshop register # On-chain agent registration (ERC-8004)
pnpm run workshop create   # Create smart accounts
```

The agent runs at `http://localhost:3000`.

### Create Smart Accounts

```bash
pnpm run create-smart-accounts
```

## Environment Variables

Copy `.env.example` to `.env` and fill in:

| Variable | Description |
|----------|-------------|
| `LLM_API_KEY` | Your LLM provider API key (e.g. OpenAI) |
| `DELEGATOR_PRIVATE_KEY` | Delegator EOA private key |
| `DELEGATOR_EOA_ADDRESS` | Delegator EOA address |
| `DELEGATOR_SA_ADDRESS` | Delegator smart account address |
| `DELEGATE_EOA_ADDRESS` | Delegatee EOA address |
| `DELEGATE_SA_ADDRESS` | Delegatee smart account address |
| `DELEGATE_PRIVATE_KEY` | Delegatee private key |
| `BUNDLER_BASE_SEPOLIA_URL` | Bundler URL for Base Sepolia |
| `BUNDLER_SEPOLIA_URL` | Bundler URL for Sepolia |
| `TARGET_ADDRESS` | Target address for transfers |

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm run workshop [step]` | Run workshop (step: `test`, `launch`, `register`, `create`) |
| `pnpm run create-smart-accounts` | Create smart accounts |

## Project Structure

```
├── src/
│   ├── workshop/              # LangGraph agent workshop (complete)
│   │   ├── 0-create-smart-accounts.ts
│   │   ├── 1-agent-runtime.ts  # Agent, model, tools
│   │   ├── 2-agent-tools.ts   # Delegation tools
│   │   ├── 3-agent-services.ts # HTTP server, agent card, x402
│   │   ├── 4-agent-registration.ts # On-chain registration
│   │   └── external-agent.ts
│   └── workshop-empty/        # Starter template for workshop
│       ├── 1-agent-runtime.ts
│       ├── 2-agent-tools.ts
│       ├── 3-agent-services.ts
│       ├── 4-agent-registration.ts
│       └── external-agent.ts
├── docs/
└── .env.example
```

## Documentation

- [WORKSHOP-LANGGRAPH-AGENT.md](docs/WORKSHOP-LANGGRAPH-AGENT.md) – Workshop guide
- [DELEGATION-SCOPES-AND-CAVEATS.md](docs/DELEGATION-SCOPES-AND-CAVEATS.md) – ERC-7710 scopes reference
- [USER-OPERATION-ERRORS.md](docs/USER-OPERATION-ERRORS.md) – UserOp error handling
- [redeemDelegations-fr.md](docs/redeemDelegations-fr.md) – French delegation docs

## Tech Stack

- **LangGraph** – Agent workflow
- **LangChain** – LLM integration (OpenAI, Anthropic, etc.)
- **viem** – Ethereum interactions
- **MetaMask Smart Accounts Kit** – Delegation framework
- **x402-express** – HTTP 402 payment protocol

## License

MIT
