# Trustless Agent Workshop 🤖

Build AI agents that act on behalf of users without holding their private keys. This workshop demonstrates fine-grain agent runtime and tooling development, least-privilege delegation with transparent authority boundaries, and agent-to-agent coordination with internet-native payment.

**You will use:**

- **LangGraph** — agent orchestration
- **Express** — HTTP services
- **x402** — paid endpoints
- **MetaMask Smart Accounts Kit** — ERC-7710 delegation
- **Agent0** — ERC-8004 identity registration

By the end, you will know how to develop from scratch an agent that can reason, act on-chain via delegated authority, and monetize access securely. ✨

---

## Project Structure

| Directory | Description |
|-----------|--------------|
| `src/workshop/` | **Your workspace** — code with TODOs for you to implement |
| `src/workshop-correction/` | **Reference solution** — complete implementation when you're stuck |

---

## Prerequisites

Before starting, ensure you have:

| Requirement | Details |
|-------------|---------|
| **Node.js** | v18+ (LTS recommended) |
| **pnpm** | v10+ (project uses `pnpm` as package manager) |
| **LLM API key** | From [Anthropic](https://console.anthropic.com/), [OpenAI](https://platform.openai.com/), [Groq](https://console.groq.com/), or compatible provider |
| **Ethereum wallets** | At least two EOA private keys (delegator + delegatee); a **third** EOA (`USER_PRIVATE_KEY`) is required for `pnpm run workshop test` (user→Agent 1 delegation) and `pnpm run call-services paid` (x402) |
| **Pimlico account** | [Pimlico](https://dashboard.pimlico.io/) bundler URL for Base Sepolia |
| **Testnet funds** | Base Sepolia ETH for delegator (transfers); optional: USDC for paid-service testing |
| **`TARGET_ADDRESS`** | Checksummed `0x…` address — the **only** recipient allowed by the transfer delegation (`allowedTargets` caveat). Set it before `workshop test` and HTTP demos; user-signed delegations in this repo scope native ETH sends to this address |
| **Basic TypeScript** | Familiarity with async/await, imports, and basic object manipulation |

---

## Quick Start

```bash
pnpm install
cp .env.example .env
# Edit .env with LLM_API_KEY, AGENT1_PRIVATE_KEY, AGENT2_PRIVATE_KEY, USER_PRIVATE_KEY, BUNDLER_BASE_SEPOLIA_URL, TARGET_ADDRESS

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
   - `AGENT1_PRIVATE_KEY` — delegator EOA (0x...)
   - `AGENT2_PRIVATE_KEY` — delegatee EOA (0x...)
   - `USER_PRIVATE_KEY` — third EOA for the **user** role: signs ERC-7710 delegations to Agent 1 in `pnpm run workshop test`, and pays USDC on `/paid-service` when using `pnpm run call-services paid` (x402). Must be distinct from the agent keys unless you know what you are doing.
   - `BUNDLER_BASE_SEPOLIA_URL` — [Pimlico](https://dashboard.pimlico.io/) (Base Sepolia)
   - `TARGET_ADDRESS` — recipient address for **transfer delegation** (ERC-7710 caveat `allowedTargets`): the delegate may send native ETH **only** to this address. Used by `pnpm run workshop test`, `/free-service`, and `/paid-service` when building `createTransferDelegation(..., recipient, ...)`. Use the same address in natural-language transfer requests (e.g. Step 4 verify example) or on-chain redemption will not match the delegation.

3. **Create smart accounts:**
   ```bash
   pnpm run workshop create
   ```

4. **Add printed addresses to `.env`:**
   ```
   AGENT1_SA_ADDRESS=0x...
   AGENT2_SA_ADDRESS=0x...
   USER_SA_ADDRESS=0x...
   ```

   **`AGENT1_SA_ADDRESS` / `AGENT2_SA_ADDRESS`** — emitted by `pnpm run workshop create` (MetaMask Hybrid smart accounts for `AGENT1_PRIVATE_KEY` and `AGENT2_PRIVATE_KEY` on Base Sepolia).

   **`USER_SA_ADDRESS`** — the MetaMask Hybrid **smart account** address for `USER_PRIVATE_KEY` (same counterfactual derivation as the agent SAs: `Implementation.Hybrid` with the same deploy params as in `src/lib/create-smart-accounts.ts`). `workshop create` does **not** print this line; add it yourself if you want a correct “User (SA)” row in `pnpm run workshop balances` or to fund that address with test ETH. You can obtain it by running the same `toMetaMaskSmartAccount` logic locally with `USER_PRIVATE_KEY`, or any tool that computes the Hybrid SA for that EOA on Base Sepolia. If omitted or invalid, `balances` still runs but shows the user row as not set.

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

6. **Verify:** `pnpm run workshop test` — the agent should now have access to tools. Until you wire every tool in `2-agent-tools.ts`, some skills may still return placeholder TODO messages (see Step 4).

---

### Step 4: ERC-7710 Delegation — reference & extensions (delegation.ts)

**Goal:** Understand how signed delegations power the tools, then optionally implement or extend them yourself. The heavy lifting is already in the repo as a **reference**.

1. **Read** `src/lib/delegation.ts`. **`createTransferDelegation`** is fully implemented: MetaMask smart account (`toMetaMaskSmartAccount`, `Implementation.Hybrid`), `createDelegation` with scope `nativeTokenTransferAmount`, caveat `allowedTargets` for least privilege, and `signDelegation`. Use it as the **canonical pattern** for any new delegation you add.

2. **`createSwapDelegation`** in the same file shows a second scope type: `functionCall` with `targets` (e.g. `UNISWAP_SWAP_ROUTER_02`) and Uniswap V3 **selectors** (`exactInputSingle`, `exactInput`, `exactOutputSingle`, `exactOutput`). Same sign-and-return shape as the transfer helper.

3. **Workshop track:** If your `src/workshop/2-agent-tools.ts` still has TODOs, wire each tool like `transferTool` — call the matching `create*Delegation`, then `callExternalAgent` with the right `skill`. **`src/workshop-correction/`** mirrors the intended end state.

4. **Going further:** You can enrich the agent with more LangChain tools by repeating this pattern: a `create…Delegation` (appropriate scopes and caveats) + a tool that forwards to `callExternalAgent`. Examples to explore on your own: **swap** (already sketched above), **bridge**, extra caveats, or additional external skills — without changing the runtime, only the tool surface.

5. **Verify:** Set `TARGET_ADDRESS` in `.env` to the recipient you name in the prompt (must match the address in the signed delegation). Run `pnpm run workshop test` — e.g. `Send 0.00042 ETH to 0x…` with the same `0x…` as `TARGET_ADDRESS`. The transfer should execute on-chain if the delegator has ETH on Base Sepolia.

---

### Step 5: Add x402 Payment for /paid-service (3-agent-services.ts)

**Goal:** Expose `/paid-service` with x402 payment — clients pay $0.01 USDC before getting a response.

1. **Open** `src/workshop/3-agent-services.ts`.

2. **Find** the `POST /paid-service` handler (around line 160). It currently **throws first** with `throw new Error("TODO: Implement x402 payment for /paid-service");` — that line is a stub so the paid route does not run until you wire x402.

3. **Implement** x402 (see `src/workshop-correction/3-agent-services.ts`):
   - After the JSON middleware and the small logging middleware (the block that logs when `X-PAYMENT` is present on `/paid-service`), define a `payTo` address (`process.env.PAY_TO_ADDRESS` or the same fallback as the correction) and add `app.use(paymentMiddleware(payTo, { "/paid-service": { price: "$0.01", network: "base-sepolia", config: { description: "…" } } }))` **before** the route handlers that serve `/free-service` and `/paid-service`.
   - **Remove** the `throw new Error("TODO: …")` at the top of the `/paid-service` handler so the handler body runs after payment.

4. **Verify:** Before the middleware and without removing the throw, `/paid-service` fails with that TODO error. After wiring x402, unauthenticated clients get HTTP **402** until they pay; then the handler behaves like `/free-service` (same agent invoke and delegation), with payment enforced by the middleware.

---

### Step 6: Launch HTTP Server & Test Endpoints

**Goal:** Run the agent over HTTP and test free/paid services.

1. **Start the server:**
   ```bash
   pnpm run workshop launch
   ```

2. **Test free endpoint** (set `TARGET_ADDRESS` in `.env` to the recipient in your message — the server pre-signs a delegation for that address):
   ```bash
   pnpm run call-services free --message "Send 0.00042 ETH to 0xYourTargetAddress..."
   ```
   Or with curl:
   ```bash
   curl -X POST http://localhost:3000/free-service \
     -H "Content-Type: application/json" \
     -d '{"message": "Hello"}'
   ```

3. **Test paid endpoint** (requires `USER_PRIVATE_KEY` + USDC on Base Sepolia):
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
   Requires `AGENT1_PRIVATE_KEY` with Sepolia ETH for gas.

3. **Verify:** Fetch `http://localhost:3000/.well-known/agent-uri.json` (with server running) to see your metadata.

---

## Summary — What You Implement

| File / config | What to implement |
|------|-------------------|
| `.env` | Set `TARGET_ADDRESS` — sole allowed recipient for native transfer delegations (`allowedTargets`) |
| `1-agent-runtime.ts` | LLM node: invoke `modelWithTools.invoke([...])` and return `{ messages: [response] }` |
| `1-agent-runtime.ts` | Conditional edge: route to `"tools"` when LLM returns tool calls |
| `1-agent-runtime.ts` | Add tools: import `transferTool` from `./2-agent-tools` and add to `tools` array |
| `lib/delegation.ts` | `createTransferDelegation` — ERC-7710 delegation for native transfer (include `allowedTargets` for recipient) |
| `lib/delegation.ts` | `createSwapDelegation` — ERC-7710 delegation for token swap |
| `3-agent-services.ts` | x402: add `paymentMiddleware` for `/paid-service`, remove the stub `throw` in the `POST /paid-service` handler ($0.01 USDC on base-sepolia) |
| `3-agent-services.ts` | (Optional) Customize `agentUri.name` and `agentUri.description` |

---

## Commands Reference

| Command | Description |
|---------|-------------|
| `pnpm run workshop create` | Create smart accounts (add addresses to .env) |
| `pnpm run workshop balances` | Show ETH + on-chain USDC for `USER_SA_ADDRESS`, `AGENT1_SA_ADDRESS`, `AGENT2_SA_ADDRESS` (Base Sepolia) |
| `pnpm run workshop test` | Test agent (runtime + tools) |
| `pnpm run workshop launch` | Start HTTP server at http://localhost:3000 |
| `pnpm run workshop register` | On-chain agent registration (ERC-8004) |
| `pnpm run call-services [cmd]` | Call endpoints: `free`, `paid`, `agent-card`, `agent-uri`, etc. |
| `pnpm run workshop:correction [step]` | Run reference solution |

---

## Environment Variables

| Variable | When | Description |
|---------|------|-------------|
| `AGENT1_PRIVATE_KEY` | Before create | Delegator EOA private key |
| `AGENT2_PRIVATE_KEY` | Before create | Delegatee EOA private key |
| `BUNDLER_BASE_SEPOLIA_URL` | Before create | Pimlico bundler URL |
| `AGENT1_SA_ADDRESS` | After create | Printed by `workshop create` |
| `AGENT2_SA_ADDRESS` | After create | Printed by `workshop create` |
| `USER_PRIVATE_KEY` | Before test / paid CLI | User EOA: delegation to Agent 1 (`workshop test`); x402 signer for `call-services paid` |
| `USER_SA_ADDRESS` | Optional | User’s Hybrid smart account address — for `pnpm run workshop balances` and funding; not printed by `workshop create` |
| `TARGET_ADDRESS` | Before test / launch | Only allowed recipient for native ETH transfer delegations (`allowedTargets` caveat). Used when signing delegations in `workshop test` and in `/free-service` / `/paid-service` |
| `LLM_API_KEY` | For test/launch | Your LLM provider API key |

---

## Project Structure

```
src/
├── lib/                         # Shared (trainees don't modify)
│   ├── agent-state.ts
│   ├── balance-service.ts
│   ├── call-agent-services.ts   # CLI: pnpm run call-services
│   ├── create-smart-accounts.ts # pnpm run workshop create
│   ├── delegation.ts
│   └── external-agent.ts
├── workshop/                    # Your workspace
│   ├── 1-agent-runtime.ts      # TODO: LLM invoke, conditional edge, add tools to array
│   ├── 2-agent-tools.ts         # transferTool, swapTool (call delegation)
│   ├── 3-agent-services.ts      # TODO: stub throw in POST /paid-service; add x402 middleware; HTTP server, agent card
│   ├── 4-agent-registration.ts
│   └── index.ts
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
