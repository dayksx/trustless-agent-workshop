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
pnpm run workshop:1   # Test agent (runtime + tools)
pnpm run workshop:2   # Start HTTP server (agent card, chat)
pnpm run workshop:3   # Test agent with full tools
pnpm run workshop:4   # On-chain agent registration (ERC-8004)
```

The agent runs at `http://localhost:3000`.

## Environment Variables

Copy `.env.example` to `.env` and fill in:

| Variable | Description |
|----------|-------------|
| `LLM_API_KEY` | Your LLM provider API key (e.g. OpenAI) |
| `DELEGATOR_PRIVATE_KEY` | EOA private key for delegation |
| `DELEGATOR_EOA_ADDRESS` | Delegator EOA address |
| `DELEGATEE_ADDRESS` | Delegatee address |
| `DELEGATEE_SA_ADDRESS` | Delegatee smart account address |
| `DELEGATEE_PRIVATE_KEY` | Delegatee private key |
| `BUNDLER_BASE_SEPOLIA_URL` | Bundler URL for Base Sepolia |
| `BUNDLER_SEPOLIA_URL` | Bundler URL for Sepolia |
| `TARGET_ADDRESS` | Target address for transfers |

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm run workshop` | Run workshop (default: test) |
| `pnpm run workshop:1` | Test agent runtime + tools |
| `pnpm run workshop:2` | Start HTTP server |
| `pnpm run workshop:3` | Test agent with full tools |
| `pnpm run workshop:4` | Register agent on-chain |
| `pnpm run eip-7702-gator` | EIP-7702 with Gator |
| `pnpm run eip-7702-erc-7710-gator` | EIP-7702 + ERC-7710 with Gator |
| `pnpm run erc-7710-gator-transfer` | ERC-7710 native token transfer |
| `pnpm run erc-7710-gator-token-period` | ERC-7710 period-based transfer |
| `pnpm run erc-7710-gator-specific-call` | ERC-7710 specific function call |

## Project Structure

```
├── src/
│   ├── workshop/           # LangGraph agent workshop
│   │   ├── 1-agent-runtime.ts   # Agent, model, tools
│   │   ├── 2-agent-tools.ts     # Delegation tools
│   │   ├── 3-agent-services.ts # HTTP server, agent card, x402
│   │   └── 4-agent-registration.ts  # On-chain registration
│   ├── eip-7702-with-gator.ts
│   ├── eip-7702-erc-7710-with-gator.ts
│   └── erc-7710-with-*.ts   # Various ERC-7710 delegation scopes
├── abis/
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
