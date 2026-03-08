# Trustless Agent Workshop

Build AI agents that act on behalf of users without holding their private keys. This workshop demonstrates fine-grain agent runtime and tooling development, least-privilege delegation with transparent authority boundaries, and agent-to-agent coordination with internet-native payment.

**You will use:**

- **LangGraph** — agent orchestration
- **Express** — HTTP services
- **x402** — paid endpoints
- **MetaMask Smart Accounts Kit** — ERC-7710 delegation
- **Agent0** — ERC-8004 identity registration

By the end, you will know how to develop from scratch an agent that can reason, act on-chain via delegated authority, and monetize access securely.

---

## Project Structure

| Directory | Description |
|-----------|--------------|
| `src/workshop/` | **Your workspace** — code with TODOs for you to implement |
| `src/workshop-correction/` | **Reference solution** — complete implementation when you're stuck |

---

## Quick Start

```bash
pnpm install
cp .env.example .env
# Edit .env with LLM_API_KEY, DELEGATOR_PRIVATE_KEY, DELEGATE_PRIVATE_KEY, BUNDLER_BASE_SEPOLIA_URL

pnpm run workshop create   # Creates smart accounts — add printed addresses to .env
pnpm run workshop test     # Test your agent
pnpm run workshop launch   # Start HTTP server
pnpm run workshop register # On-chain registration (ERC-8004)
```

---

## Trainee Guide — Complete Workshop

Follow these steps in order. Each step has **code to implement** (TODOs in `src/workshop/`). Use `src/workshop-correction/` as reference.

---

### Step 0: Setup & Create Smart Accounts

**Goal:** Get the project running and create smart accounts for delegation.

1. **Install and configure:**
   ```bash
   pnpm install
   cp .env.example .env
   ```

2. **Edit `.env`** with:
   - `LLM_API_KEY` — [Anthropic](https://console.anthropic.com/), [OpenAI](https://platform.openai.com/), [Groq](https://console.groq.com/), etc.
   - `DELEGATOR_PRIVATE_KEY` — delegator EOA (0x...)
   - `DELEGATE_PRIVATE_KEY` — delegatee EOA (0x...)
   - `BUNDLER_BASE_SEPOLIA_URL` — [Pimlico](https://dashboard.pimlico.io/) (Base Sepolia)

3. **Create smart accounts:**
   ```bash
   pnpm run workshop create
   ```

4. **Add printed addresses to `.env`:**
   ```
   DELEGATOR_SA_ADDRESS=0x...
   DELEGATE_SA_ADDRESS=0x...
   ```

5. **Verify:** `pnpm run workshop test` — will throw "TODO: Implement LLM invoke" until Step 1 is done.

---

### Step 1: Implement LLM Node (1-agent-runtime.ts)

**Goal:** Implement the LLM node so it invokes the model with the system prompt and user messages.

1. **Open** `src/workshop/1-agent-runtime.ts`.

2. **Find** the `llm` node callback (around line 70). It currently throws a TODO error.

3. **Implement** the invoke:
   - Call `modelWithTools.invoke([new SystemMessage(STATIC_SYSTEM_PROMPT), ...state.messages])`
   - Return `{ messages: [response] }`

4. **Verify:** `pnpm run workshop test` — the agent should run (may not route to tools yet until Step 2).

---

### Step 2: Fix the Conditional Edge (1-agent-runtime.ts)

**Goal:** Route to the tools node when the LLM returns tool calls. Currently the graph always goes to END, so tools never run.

1. **Open** `src/workshop/1-agent-runtime.ts`.

2. **Find** the `addConditionalEdges` callback (around line 85). It currently returns `END` always.

3. **Implement** the routing logic:
   - Get the last message: `const last = state.messages[state.messages.length - 1]`
   - Return `"tools"` if the last message is an `AIMessage` with `tool_calls`, else `END`
   - Hint: `last instanceof AIMessage && last.tool_calls?.length ? "tools" : END`

4. **Verify:** `pnpm run workshop test` — the agent should now route to tools. Without tools in the array (Step 3), the LLM won't have any tools to call. Complete Step 3 next.

---

### Step 3: Add Tools to the Agent (1-agent-runtime.ts)

**Goal:** Import tools from `2-agent-tools.ts` and add them to the `tools` array so the LLM can use them.

1. **Open** `src/workshop/1-agent-runtime.ts`.

2. **Add the import** at the top (around line 34):
   ```typescript
   import { transferTool } from "./2-agent-tools";
   ```

3. **Add tools to the array** (around line 56):
   ```typescript
   const tools = [transferTool];
   ```

4. **Optional:** Add more tools (`swapTool`, `stakingTool`, etc.) from `2-agent-tools.ts`.

5. **Inspect** `src/workshop/2-agent-tools.ts` to see how `transferTool` and `swapTool` work — they call `createTransferDelegation` / `createSwapDelegation` then `callExternalAgent`.

6. **Verify:** `pnpm run workshop test` — the agent should now have access to tools. You may see "TODO: Implement createTransferDelegation" when a transfer is attempted (expected until Step 4).

---

### Step 4: Implement ERC-7710 Delegation (delegation.ts)

**Goal:** Implement `createTransferDelegation` and `createSwapDelegation`. This is the core of the workshop.

1. **Open** `src/workshop/delegation.ts`.

2. **Implement `createTransferDelegation`:**
   - Get `delegatorAccount` (getDelegatorAccount()) and `delegateAddress` (getDelegateAddress())
   - Create smart account with `toMetaMaskSmartAccount` (Implementation.Hybrid)
   - Create delegation with `createDelegation({ to, from, environment, scope, salt })`
     - `scope: { type: "nativeTokenTransferAmount", maxAmount: parseEther(amount) }`
   - Sign with `delegatorSmartAccount.signDelegation({ delegation })`
   - Return `{ ...delegation, signature }`
   - **Reference:** `src/workshop-correction/delegation.ts`

3. **Implement `createSwapDelegation`:**
   - Same pattern, but `scope: { type: "functionCall", targets: [UNISWAP_SWAP_ROUTER_02], selectors: [...] }`
   - Selectors: `exactInputSingle`, `exactInput`, `exactOutputSingle`, `exactOutput` (see workshop-correction)

4. **Verify:** `pnpm run workshop test` — send "Send 0.00042 ETH to 0xA7F36973465b4C3d609961Bc72Cc2E65acE26337". The agent should execute the transfer (if delegator has ETH on Base Sepolia).

---

### Step 5: Add x402 Payment for /paid-service (3-agent-services.ts)

**Goal:** Expose `/paid-service` with x402 payment — clients pay $0.01 USDC before getting a response.

1. **Open** `src/workshop/3-agent-services.ts`.

2. **Find** the TODO for x402 payment middleware (around line 110). The `payTo` address is already defined.

3. **Implement** the payment middleware:
   - Add `app.use(paymentMiddleware(payTo, { ... }))` before the route handlers
   - Configure `/paid-service` with `price: "$0.01"`, `network: "base-sepolia"`, and a `config.description`
   - **Reference:** `src/workshop-correction/3-agent-services.ts`

4. **Verify:** Without the middleware, `/paid-service` works like `/free-service`. With it, clients get HTTP 402 and must pay before the response.

---

### Step 6: Launch HTTP Server & Test Endpoints

**Goal:** Run the agent over HTTP and test free/paid services.

1. **Start the server:**
   ```bash
   pnpm run workshop launch
   ```

2. **Test free endpoint:**
   ```bash
   pnpm run call-services free --message "Send 0.00042 ETH to 0xA7F36973465b4C3d609961Bc72Cc2E65acE26337"
   ```
   Or with curl:
   ```bash
   curl -X POST http://localhost:3000/free-service \
     -H "Content-Type: application/json" \
     -d '{"message": "Hello"}'
   ```

3. **Test paid endpoint** (requires `EVM_PRIVATE_KEY` + USDC on Base Sepolia):
   ```bash
   pnpm run call-services paid --message "Hello"
   ```

---

### Step 7: On-Chain Agent Registration (ERC-8004)

**Goal:** Register your agent on-chain so it's discoverable.

1. **Customize** `src/workshop/3-agent-services.ts`:
   - Edit `agentUri.name` and `agentUri.description` (TODO comment in file)

2. **Run registration:**
   ```bash
   pnpm run workshop register
   ```
   Requires `DELEGATOR_PRIVATE_KEY` with Sepolia ETH for gas.

3. **Verify:** Fetch `http://localhost:3000/.well-known/agent-uri.json` (with server running) to see your metadata.

---

## Summary — What You Implement

| File | What to implement |
|------|-------------------|
| `1-agent-runtime.ts` | LLM node: invoke `modelWithTools.invoke([...])` and return `{ messages: [response] }` |
| `1-agent-runtime.ts` | Conditional edge: route to `"tools"` when LLM returns tool calls |
| `1-agent-runtime.ts` | Add tools: import `transferTool` from `./2-agent-tools` and add to `tools` array |
| `delegation.ts` | `createTransferDelegation` — ERC-7710 delegation for native transfer |
| `delegation.ts` | `createSwapDelegation` — ERC-7710 delegation for token swap |
| `3-agent-services.ts` | x402 payment middleware for `/paid-service` ($0.01 USDC on base-sepolia) |
| `3-agent-services.ts` | (Optional) Customize `agentUri.name` and `agentUri.description` |

---

## Commands Reference

| Command | Description |
|---------|-------------|
| `pnpm run workshop create` | Create smart accounts (add addresses to .env) |
| `pnpm run workshop test` | Test agent (runtime + tools) |
| `pnpm run workshop launch` | Start HTTP server at http://localhost:3000 |
| `pnpm run workshop register` | On-chain agent registration (ERC-8004) |
| `pnpm run call-services [cmd]` | Call endpoints: `free`, `paid`, `agent-card`, `agent-uri`, etc. |
| `pnpm run workshop:correction [step]` | Run reference solution |

---

## Environment Variables

| Variable | When | Description |
|---------|------|-------------|
| `DELEGATOR_PRIVATE_KEY` | Before create | Delegator EOA private key |
| `DELEGATE_PRIVATE_KEY` | Before create | Delegatee EOA private key |
| `BUNDLER_BASE_SEPOLIA_URL` | Before create | Pimlico bundler URL |
| `DELEGATOR_SA_ADDRESS` | After create | Printed by `workshop create` |
| `DELEGATE_SA_ADDRESS` | After create | Printed by `workshop create` |
| `LLM_API_KEY` | For test/launch | Your LLM provider API key |
| `EVM_PRIVATE_KEY` | For paid-service | EOA with USDC on Base Sepolia |

---

## Project Structure

```
src/
├── workshop/                    # Your workspace
│   ├── 0-create-smart-accounts.ts
│   ├── 1-agent-runtime.ts       # TODO: LLM invoke, conditional edge, add tools to array
│   ├── 2-agent-tools.ts         # transferTool, swapTool (call delegation)
│   ├── 3-agent-services.ts      # TODO: x402 payment for /paid-service; HTTP server, agent card
│   ├── 4-agent-registration.ts
│   ├── 4-call-agent-services.ts
│   ├── delegation.ts            # TODO: createTransferDelegation, createSwapDelegation
│   └── external-agent.ts
└── workshop-correction/         # Reference solution
```

---

## Documentation

- [WORKSHOP-TRAINEE-GUIDE.md](docs/WORKSHOP-TRAINEE-GUIDE.md) – Detailed self-paced guide with KLPs
- [WORKSHOP-CONDUCTING.md](docs/WORKSHOP-CONDUCTING.md) – Facilitator guide
- [WORKSHOP-LANGGRAPH-AGENT.md](docs/WORKSHOP-LANGGRAPH-AGENT.md) – Technical overview
- [X402-PAYMENT.md](docs/X402-PAYMENT.md) – x402 payment protocol
- [DELEGATION-SCOPES-AND-CAVEATS.md](docs/DELEGATION-SCOPES-AND-CAVEATS.md) – ERC-7710 scopes
- [USER-OPERATION-ERRORS.md](docs/USER-OPERATION-ERRORS.md) – UserOp error handling

---

## Tech Stack

- **LangGraph** – Agent workflow
- **LangChain** – LLM integration
- **viem** – Ethereum
- **MetaMask Smart Accounts Kit** – Delegation (ERC-7710)
- **x402-express** – HTTP 402 payment

## License

MIT
