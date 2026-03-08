# Workshop Conducting Guide

Facilitator guide for the Trustless Agent Workshop. Use this to structure sessions and ensure trainees hit all key learning points (KLPs).

**For trainees:** A self-paced version with all steps written out is in [WORKSHOP-TRAINEE-GUIDE.md](WORKSHOP-TRAINEE-GUIDE.md). Trainees can follow that guide without a trainer.

---

## Overview

| Step | Module | Command | KLP |
|------|--------|---------|-----|
| 0 | Create smart accounts | `pnpm run workshop create` | Setup prerequisite |
| 1 | Agent runtime | `pnpm run workshop test` | KLP 1 |
| 2 | Tools system | `2-agent-tools.ts` | KLP 2 |
| 3 | On-chain delegation | `2-agent-tools.ts`, `external-agent.ts` | KLP 3 |
| 4 | x402 monetization | `3-agent-services.ts`, `call-services` | KLP 4 |
| 5 | On-chain registration | `pnpm run workshop register` | KLP 5 |

---

## KLP 1: Agent Runtime — Graph Structure & Personalization

**Goal:** Trainees understand the agent runtime functioning and structure, with a mental model of the graph: LLM nodes, tool nodes, and conditional edges. They can personalize the graph for their needs.

### Key Learning Points

- **Graph representation**: The agent is a directed graph of nodes (LLM, tools) connected by edges.
- **LLM node**: Receives messages, optionally calls tools; returns messages.
- **Tool node**: Executes tool calls returned by the LLM.
- **Conditional edges**: The graph branches based on LLM output (e.g., "has tool calls?" → tools or END).
- **State**: `MessagesAnnotation` holds the conversation; flows through the graph.
- **Personalization**: Add/remove nodes, change edges, add conditional branches, swap models.

### Steps for Trainees

1. Open `1-agent-runtime.ts` and locate the graph definition.
2. Identify: `llm` node, `tools` node, `addConditionalEdges`, `addEdge`.
3. Trace a request: START → llm → (tools or END) → if tools, back to llm.
4. **Exercise**: Add a new conditional branch (e.g., route to a "validator" node before END).
5. **Exercise**: Change the system prompt and observe behavior change.

### Code Reference

- `src/workshop/1-agent-runtime.ts` — `StateGraph`, `addNode`, `addConditionalEdges`, `addEdge`, `compile`

---

## KLP 2: Tools System — Extending the LLM with Separation of Concerns

**Goal:** Trainees understand how tools extend LLM capabilities and how to keep a clear separation of concerns (LLM = reasoning, tools = execution).

### Key Learning Points

- **Tools extend the LLM**: The LLM decides *when* and *with what args* to call tools; tools perform actions.
- **Tool schema**: Use Zod (or similar) to define inputs; the LLM receives structured tool descriptions.
- **Separation of concerns**: Tools are pure functions (or async); no LLM logic inside tools. LLM handles orchestration.
- **Composability**: Tools can call external services, APIs, or on-chain logic.

### Steps for Trainees

1. Open `2-agent-tools.ts` and inspect `delegateTransferTool` (or `delegateSwapTool`).
2. Identify: `tool()`, schema (`z.object`), `description`, and the async handler.
3. Trace: User message → LLM chooses tool → tool runs → result returned to LLM.
4. **Exercise**: Add a simple tool (e.g., `getBalance`) with a minimal schema.
5. **Exercise**: Wire the new tool into `1-agent-runtime.ts` and test.

### Code Reference

- `src/workshop/2-agent-tools.ts` — `tool`, `z.object`, delegation helpers
- `src/workshop/1-agent-runtime.ts` — `tools` array, `model.bindTools(tools)`

---

## KLP 3: On-Chain Delegation — Sovereignty, Self-Custody & Least Privilege (ERC-7710)

**Goal:** Trainees understand how on-chain delegation preserves human and AI agent sovereignty through self-custody and least-privilege scopes.

### Key Learning Points

- **Sovereignty**: Users keep control of assets; agents act only within delegated scope.
- **Self-custody**: Keys stay with the user; no third party holds funds.
- **Least privilege**: Delegations are scope-limited (amount, target, function, expiry). The delegatee cannot exceed the scope.
- **ERC-7710**: Standard for signed delegations; delegator signs, delegatee redeems on-chain.
- **Flow**: Delegator (smart account) → signs delegation → delegatee (smart account) → redeems delegation → executes on behalf of delegator.

### Steps for Trainees

1. Open `2-agent-tools.ts` and inspect `createTransferDelegation` / `createSwapDelegation`.
2. Identify: `createDelegation`, `scope` (e.g., `nativeTokenTransferAmount`, `functionCall`), `signDelegation`.
3. Open `external-agent.ts` and trace how the signed delegation is sent to the external agent.
4. **Exercise**: Change the transfer scope (e.g., max amount) and observe the constraint.
5. **Exercise**: Compare `nativeTokenTransferAmount` vs `functionCall` scopes in `DELEGATION-SCOPES-AND-CAVEATS.md`.

### Code Reference

- `src/workshop/2-agent-tools.ts` — `createTransferDelegation`, `createSwapDelegation`
- `src/workshop/external-agent.ts` — `callExternalAgent`
- `docs/DELEGATION-SCOPES-AND-CAVEATS.md` — ERC-7710 scope reference

---

## KLP 4: x402 — Monetizing Agent Services & Calling Paid Endpoints

**Goal:** Trainees understand how to expose x402 endpoints to monetize agent services and how to call those endpoints as a client.

### Key Learning Points

- **x402**: HTTP 402 payment protocol; server declares price, client pays before receiving the response.
- **Exposing paid endpoints**: Use `paymentMiddleware` from `x402-express`; define route and price (e.g., `$0.01`, `base-sepolia`).
- **Calling paid endpoints**: Use `x402-axios` with `withPaymentInterceptor` and a signer (EVM key with USDC).
- **Separation**: Free vs paid services; same agent logic, different routes.

### Steps for Trainees

1. Open `3-agent-services.ts` and locate `paymentMiddleware`, `/paid-service`.
2. Identify: `payTo` address, route config (`price`, `network`).
3. Run `pnpm run workshop launch` and call `/free-service` (no payment).
4. **Exercise**: Call `/paid-service` with `pnpm run call-services paid --message "Hello"` (requires `EVM_PRIVATE_KEY` + USDC).
5. **Exercise**: Inspect `4-call-agent-services.ts` to see how `withPaymentInterceptor` and `createSigner` work.

### Code Reference

- `src/workshop/3-agent-services.ts` — `paymentMiddleware`, `/free-service`, `/paid-service`
- `src/workshop/4-call-agent-services.ts` — `runPaid`, `withPaymentInterceptor`, `createSigner`
- `docs/X402-PAYMENT.md` — x402 technical guide

---

## KLP 5: On-Chain Agent Registration (ERC-8004)

**Goal:** Trainees understand how to register an agent on-chain for discovery and attestation.

### Key Learning Points

- **ERC-8004**: Standard for on-chain agent metadata; links an on-chain record to offchain `agentURI`.
- **agentURI**: URL to `/.well-known/agent-uri.json` (or similar); contains name, description, services, skills.
- **Registration flow**: Build registration payload → submit transaction → agent is discoverable on-chain.
- **Use case**: Other agents or users can discover and verify agents via the registry.

### Steps for Trainees

1. Open `4-agent-registration.ts` and trace the registration flow.
2. Identify: payload construction, transaction submission.
3. Run `pnpm run workshop register` and observe the output.
4. **Exercise**: Modify `agentUri` in `3-agent-services.ts` (e.g., name, description) and re-register.
5. **Exercise**: Query the registry (if applicable) to verify the agent record.

### Code Reference

- `src/workshop/4-agent-registration.ts` — `registerAgent`
- `src/workshop/3-agent-services.ts` — `agentUri`, `AGENT_URI_PATH`

---

## Suggested Workshop Flow

1. **Setup** (15 min): Prerequisites, `.env`, `workshop create`
2. **KLP 1** (20 min): Agent runtime, graph walkthrough, prompt tweak
3. **KLP 2** (25 min): Tools system, add a simple tool
4. **KLP 3** (25 min): Delegation flow, scopes, `createTransferDelegation`
5. **KLP 4** (20 min): x402, free vs paid, `call-services paid`
6. **KLP 5** (15 min): ERC-8004 registration, agentURI
7. **Wrap-up** (10 min): Q&A, extensions, next steps

Total: ~2h 10min (adjust per audience).
