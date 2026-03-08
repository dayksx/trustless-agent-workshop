# Trustless Agent Workshop — Trainee Guide

**Self-paced guide.** Follow this document step by step to complete the workshop on your own, without a trainer. Each section includes key learning points (KLPs), instructions, and exercises.

---

## Before You Start

**What you'll build:** An AI agent that uses LangGraph, delegates on-chain actions via ERC-7710, exposes free and paid services (x402), and registers on-chain (ERC-8004).

**What you need:**
- Node.js 18+
- pnpm (or npm)
- LLM API key — [Anthropic](https://console.anthropic.com/), [Google AI](https://aistudio.google.com/apikey), [Groq](https://console.groq.com/), [Mistral](https://console.mistral.ai/), etc.
- Bundler API key — [Pimlico](https://dashboard.pimlico.io/)
- Two EOA private keys (for delegator and delegatee) with testnet ETH on Base Sepolia

---

## Step 0: Setup & Create Smart Accounts

### What you'll learn
- How to configure the project and create smart accounts
- Why smart account addresses must be in `.env` before running the agent

### Instructions

1. **Clone and install:**
   ```bash
   pnpm install
   ```

2. **Create your `.env` file:**
   ```bash
   cp .env.example .env
   ```

3. **Edit `.env`** and fill in at minimum:
   - `LLM_API_KEY` — your LLM provider API key
   - `DELEGATOR_PRIVATE_KEY` — delegator EOA private key (0x...)
   - `DELEGATE_PRIVATE_KEY` — delegatee EOA private key (0x...)
   - `BUNDLER_BASE_SEPOLIA_URL` — Pimlico bundler URL (e.g. `https://api.pimlico.io/v2/base-sepolia/rpc?apikey=YOUR_KEY`)

4. **Create smart accounts:**
   ```bash
   pnpm run workshop create
   ```

5. **Copy the printed addresses** into your `.env`:
   - `DELEGATOR_SA_ADDRESS=0x...`
   - `DELEGATE_SA_ADDRESS=0x...`

6. **Verify:** Run `pnpm run workshop test`. If it runs without "Missing DELEGATE_SA_ADDRESS" (or similar), setup is complete.

---

## Step 1: Agent Runtime — Graph Structure & Personalization (KLP 1)

### What you'll learn
- The agent is a **graph** of nodes (LLM, tools) connected by edges
- **LLM node**: receives messages, optionally calls tools
- **Tool node**: executes tool calls
- **Conditional edges**: the graph branches based on LLM output (e.g. "has tool calls?" → tools or END)
- **State**: messages flow through the graph
- You can personalize by adding nodes, changing edges, or swapping models

### Instructions

1. **Open** `src/workshop/1-agent-runtime.ts`.

2. **Locate the graph definition** (around line 63). You should see:
   - `new StateGraph(MessagesAnnotation)`
   - `.addNode("llm", ...)` — the LLM node
   - `.addNode("tools", toolNode)` — the tool execution node
   - `.addConditionalEdges("llm", ..., ["tools", END])` — branches to tools or END
   - `.addEdge(START, "llm")` and `.addEdge("tools", "llm")`

3. **Trace the flow** for a user message:
   - START → `llm` → (if LLM returns tool calls) → `tools` → back to `llm` → … → END

4. **Run the agent:**
   ```bash
   pnpm run workshop test
   ```
   You should see the agent respond. The test sends: "Lend 0.000042 ETH to 0xA7F36973465b4C3d609961Bc72Cc2E65acE26337".

5. **Exercise — Change the system prompt:**
   - Find `STATIC_SYSTEM_PROMPT` in `1-agent-runtime.ts`
   - Change it to: `You are a helpful DeFi assistant. Be concise.`
   - Run `pnpm run workshop test` again and observe the difference

6. **Exercise — Add a conditional branch (optional):**
   - Try adding a simple "validator" node that logs and passes through, then add an edge from `llm` to it before END
   - See [LangGraph docs](https://langchain-ai.github.io/langgraph/) for `addNode` and `addEdge` usage

---

## Step 2: Tools System — Extending the LLM (KLP 2)

### What you'll learn
- **Tools extend the LLM**: the LLM decides *when* and *with what args* to call tools; tools perform actions
- **Tool schema**: Zod defines inputs; the LLM gets structured descriptions
- **Separation of concerns**: LLM = reasoning, tools = execution
- Tools can call external services, APIs, or on-chain logic

### Instructions

1. **Open** `src/workshop/2-agent-tools.ts`.

2. **Inspect** `delegateTransferTool` (around line 63):
   - `tool(async ({ recipient, amount, when }) => { ... }, { name, description, schema })`
   - The `schema` uses `z.object({ recipient, amount, when })` — the LLM uses this to know what to pass
   - The `description` tells the LLM when to use this tool

3. **Trace the flow:**
   - User: "Send 0.001 ETH to 0x..."
   - LLM receives the message + tool descriptions
   - LLM returns a tool call: `delegate_transfer` with `{ recipient: "0x...", amount: "0.001" }`
   - Tool runs → result returned to LLM → LLM formats the final reply

4. **Open** `src/workshop/1-agent-runtime.ts` and find:
   - `tools` array (line ~52)
   - `model.bindTools(tools)` — this gives the LLM access to the tools

5. **Exercise — Add a simple tool:**
   - In `2-agent-tools.ts`, add a new tool, e.g.:
     ```typescript
     export const getBalanceTool = tool(
       async ({ address }) => `Balance check for ${address} (placeholder)`,
       {
         name: "get_balance",
         description: "Get ETH balance for an address",
         schema: z.object({ address: z.string().describe("Ethereum address") }),
       }
     );
     ```
   - In `1-agent-runtime.ts`, add `getBalanceTool` to the `tools` array and import it
   - Run `pnpm run workshop test` and ask something like "What's the balance of 0x123...?" to see if the LLM uses it

---

## Step 3: On-Chain Delegation — Sovereignty & Least Privilege (KLP 3)

### What you'll learn
- **Sovereignty**: users keep control; agents act only within delegated scope
- **Self-custody**: keys stay with the user; no third party holds funds
- **Least privilege**: delegations are scope-limited (amount, target, function, expiry)
- **ERC-7710**: delegator signs; delegatee redeems on-chain
- **Flow**: Delegator signs → Delegatee redeems → Executes on behalf of delegator

### Instructions

1. **Open** `src/workshop/2-agent-tools.ts`.

2. **Inspect** `createTransferDelegation` (around line 235):
   - `createDelegation({ to, from, environment, scope, salt })`
   - `scope: { type: "nativeTokenTransferAmount", maxAmount: parseEther(amount) }` — limits how much can be transferred
   - `delegatorSmartAccount.signDelegation({ delegation })` — the delegator signs

3. **Inspect** `createSwapDelegation` (around line 273):
   - `scope: { type: "functionCall", targets: [...], selectors: [...] }` — limits which contract functions can be called
   - Compare with transfer: different scope types for different use cases

4. **Open** `src/workshop/external-agent.ts`:
   - Find where the signed delegation is sent to the external agent
   - Trace how `callExternalAgent` uses the delegation

5. **Read** `docs/DELEGATION-SCOPES-AND-CAVEATS.md`:
   - Skim the scope types (`nativeTokenTransferAmount`, `functionCall`, etc.)
   - Understand how each limits what the delegatee can do

6. **Exercise — Change the transfer scope:**
   - In `createTransferDelegation`, change `maxAmount` to a smaller value (e.g. `parseEther("0.0001")`)
   - Run a transfer and observe that the delegation cannot exceed that amount

---

## Step 4: x402 — Monetizing & Calling Paid Endpoints (KLP 4)

### What you'll learn
- **x402**: HTTP 402 payment protocol; server declares price, client pays before response
- **Exposing paid endpoints**: `paymentMiddleware` from `x402-express`; define route and price
- **Calling paid endpoints**: `x402-axios` with `withPaymentInterceptor` and a signer (EVM key with USDC)
- Free vs paid: same agent logic, different routes

### Instructions

1. **Open** `src/workshop/3-agent-services.ts`.

2. **Locate** `paymentMiddleware` (around line 108):
   - `payTo` — address that receives payment
   - Route config: `"/paid-service": { price: "$0.01", network: "base-sepolia" }`

3. **Locate** `/free-service` and `/paid-service`:
   - Both call the same agent; only `/paid-service` requires payment

4. **Start the server:**
   ```bash
   pnpm run workshop launch
   ```

5. **Call the free endpoint:**
   ```bash
   pnpm run call-services free --message "Send 0.00042 ETH to 0xA7F36973465b4C3d609961Bc72Cc2E65acE26337"
   ```
   Or with curl:
   ```bash
   curl -X POST http://localhost:3000/free-service \
     -H "Content-Type: application/json" \
     -d '{"message": "Hello"}'
   ```

6. **Call the paid endpoint** (requires `EVM_PRIVATE_KEY` in `.env` and USDC on Base Sepolia):
   - Add `EVM_PRIVATE_KEY` to `.env` (EOA with USDC; get test USDC from [Coinbase faucet](https://www.coinbase.com/faucets/base-ethereum-goerli-faucet))
   ```bash
   pnpm run call-services paid --message "Hello"
   ```

7. **Open** `src/workshop/4-call-agent-services.ts`:
   - Find `runPaid` — it uses `createSigner` and `withPaymentInterceptor`
   - The interceptor handles the 402 flow: get price → pay → retry request

8. **Read** `docs/X402-PAYMENT.md` for the full technical flow.

---

## Step 5: On-Chain Agent Registration (KLP 5)

### What you'll learn
- **ERC-8004**: on-chain agent metadata; links registry record to offchain `agentURI`
- **agentURI**: URL to `/.well-known/agent-uri.json`; contains name, description, services, skills
- **Registration**: build payload → submit transaction → agent is discoverable on-chain

### Instructions

1. **Open** `src/workshop/4-agent-registration.ts`:
   - Trace how the registration payload is built
   - Find where the transaction is submitted

2. **Open** `src/workshop/3-agent-services.ts`:
   - Find `agentUri` — this object is served at `/.well-known/agent-uri.json`
   - It includes `name`, `description`, `services`, `skills`, etc.

3. **Run registration:**
   ```bash
   pnpm run workshop register
   ```
   Observe the output (transaction hash, etc.).

4. **Exercise — Modify and re-register:**
   - In `3-agent-services.ts`, change `agentUri.name` and `agentUri.description`
   - Run `pnpm run workshop register` again
   - Fetch `http://localhost:3000/.well-known/agent-uri.json` (with server running) to verify the metadata

---

## Summary: Key Learning Points

| KLP | Topic | Takeaway |
|-----|-------|----------|
| 1 | Agent runtime | Graph of LLM + tool nodes; conditional edges; personalize by changing nodes/edges |
| 2 | Tools system | LLM decides when to call tools; tools execute; clear separation of concerns |
| 3 | On-chain delegation | Sovereignty, self-custody, least privilege via ERC-7710 scoped delegations |
| 4 | x402 | Expose paid endpoints with `paymentMiddleware`; call with `withPaymentInterceptor` |
| 5 | ERC-8004 | Register agent on-chain; `agentURI` links to offchain metadata |

---

## Next Steps

- Implement `delegate_staking`, `delegate_yield_farming`, `delegate_lending` (currently placeholders in `2-agent-tools.ts`)
- Add more tools (e.g. price query, balance check)
- Add streaming responses
- Explore [DELEGATION-SCOPES-AND-CAVEATS.md](DELEGATION-SCOPES-AND-CAVEATS.md) for advanced delegation patterns
