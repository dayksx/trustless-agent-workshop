#!/usr/bin/env node
/**
 * Workshop: Expose Agent Services
 *
 * Express server with:
 * - /chat - Chat endpoint
 * - /.well-known/agent-card.json - A2A agent card
 * - /.well-known/agent-uri.json - ERC-8004 agentURI metadata
 * - x402 payment support (add x402-express middleware when needed)
 *
 * Run: pnpm run workshop:2
 * Requires: OPENAI_API_KEY
 */

import "dotenv/config";
import { randomUUID } from "node:crypto";
import express from "express";
import { paymentMiddleware } from "x402-express";
import { HumanMessage } from "@langchain/core/messages";
import { agent } from "./1-agent-runtime";
import { createTransferDelegation, getDelegationContextUserToAgent1 } from "../lib/delegation";

// ============================================================================
// PORT
// ============================================================================
export const PORT = Number(process.env.PORT) || 3000;

// ============================================================================
// WELL-KNOWN PATHS (ERC-8004 / RFC 8615)
// ============================================================================

export const AGENT_URI_PATH = "/.well-known/agent-uri.json";
export const AGENT_CARD_PATH = "/.well-known/agent-card.json";

// ============================================================================
// AGENT CARD (A2A) - RFC 8615
// ============================================================================

export const agentCard = {
  protocolVersion: "0.3.0",
  name: "Workshop Swap Coordinator",
  description:
    "Minimal LangGraph agent that delegates token swaps to an external A2A swap service.",
  url: "http://localhost:3000",
  preferredTransport: "JSONRPC",
  version: "1.0.0",
  capabilities: { streaming: false },
  defaultInputModes: ["text/plain"],
  defaultOutputModes: ["text/plain"],
  skills: [
    {
      id: "delegate_swap",
      name: "Delegate Swap",
      description: "Delegates token swap to external A2A agent",
      tags: ["swap", "delegation", "defi"],
    },
  ],
  auth: { type: "none" },
};

// ============================================================================
// AGENT URI (ERC-8004) - for discovery
// ============================================================================

// TODO (Step 5): Customize name and description before running workshop register
export const agentUri = {
  type: "https://eips.ethereum.org/EIPS/eip-8004#registration-v1",
  name: "Workshop Swap Coordinator",
  description:
    "Minimal LangGraph agent for the workshop. Delegates swaps to an external A2A service. Exposes agent card and agentURI for discovery.",
  image: "https://placehold.co/512x512/png?text=Agent",
  domains: ["technology/blockchain/defi", "finance_and_business/investment_services"],
  skills: ["tool_interaction/workflow_automation", "agent_orchestration/task_decomposition"],
  version: "1.0.0",
  category: "degen-ai",
  checksum: "0x1234567890123456789012345678901234567890123456789012345678901234",
  services: [
    {
      name: "A2A",
      endpoint: `http://localhost:3000/a2a/v1`,
      version: "0.3.0",
    },
    {
      name: "MCP",
      endpoint: "http://localhost:3000/mcp/v1",
      version: "0.3.0",
    },
    {
      name: "web",
      endpoint: "http://localhost:3000",
    },
    {
      name: "telegram",
      endpoint: "https://t.me/MyBot",
    },
  ],
  active: true,
};

// ============================================================================
// EXPRESS SERVER
// ============================================================================

export const app = express();
app.use(express.json());

// Log when HTTP request meets the facilitator to pay x402
app.use((req, _res, next) => {
  if (req.path === "/paid-service" && req.header("X-PAYMENT")) {
    console.log("💳 x402 facilitator meets the HTTP request to fulfill the payment using the X-PAYMENT header");
  }
  next();
});

// x402: Payment middleware for /paid-service (payTo from env, default test address)
const payTo =
  (process.env.PAY_TO_ADDRESS as `0x${string}`) ||
  "0x224b11F0747c7688a10aCC15F785354aA6493ED6";
app.use(
  paymentMiddleware(payTo, {
    "/paid-service": {
      price: "$0.01",
      network: "base-sepolia",
      config: { description: "Paid chat with Workshop Swap Coordinator" },
    },
  })
);

// Agent card (A2A discovery)
app.get(AGENT_CARD_PATH, (_req, res) => {
  console.log("📄 GET", AGENT_CARD_PATH);
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.json(agentCard);
});

// Agent URI (ERC-8004 metadata)
app.get(AGENT_URI_PATH, (_req, res) => {
  console.log("📄 GET", AGENT_URI_PATH);
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.json(agentUri);
});

// Chat endpoint
app.post("/free-service", async (req, res) => {
  console.log("💬 POST /free-service", req.body);
  const { message } = req.body;
  if (!message || typeof message !== "string") {
    return res.status(400).json({ error: "message (string) required" });
  }

  try {
    const amount = "0.001";
    const when = "now";
    const recipient = process.env.TARGET_ADDRESS!;
    const signedDelegation = await createTransferDelegation(undefined, recipient, amount, null, getDelegationContextUserToAgent1());

    const result = await agent.invoke(
      { messages: [new HumanMessage(message)] },
      { configurable: { thread_id: `workshop-${randomUUID()}`, signedDelegation } }
    );
    const lastMsg = result.messages[result.messages.length - 1];
    const text = lastMsg && "content" in lastMsg ? String(lastMsg.content) : "";
    res.json({ response: text, messages: result.messages.length });
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .json({ error: err instanceof Error ? err.message : "Unknown error" });
  }
});

// x402 payable endpoint (same as /chat, requires payment)
app.post("/paid-service", async (req, res) => {
  console.log("💰 POST /paid-service", req.body.message);
  const { message } = req.body;
  if (!message || typeof message !== "string") {
    return res.status(400).json({ error: "message (string) required" });
  }

  try {
    const amount = "0.001";
    const when = "now";
    const recipient = process.env.TARGET_ADDRESS!;
    const signedDelegation = await createTransferDelegation(undefined, recipient, amount, null, getDelegationContextUserToAgent1());

    const result = await agent.invoke(
      { messages: [new HumanMessage(message)] },
      { configurable: { thread_id: `workshop-${randomUUID()}`, signedDelegation } }
    );
    const lastMsg = result.messages[result.messages.length - 1];
    const text = lastMsg && "content" in lastMsg ? String(lastMsg.content) : "";
    res.json({ response: text, messages: result.messages.length });
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .json({ error: err instanceof Error ? err.message : "Unknown error" });
  }
});

// Basic web landing page
app.get("/", (_req, res) => {
  console.log("🌐 GET /");
  res.setHeader("Content-Type", "text/html");
  res.send(`
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>${agentCard.name}</title></head>
<body>
  <h1>${agentCard.name}</h1>
  <p>${agentCard.description}</p>
</body>
</html>
  `.trim());
});

app.post("/", async (req, res) => {
  console.log("📮 POST /", req.body);
  res.json({ response: "MCP Service" });
});

app.post("/mcp/v1", async (req, res) => {
  console.log("🔌 POST /mcp/v1", req.body);
  res.json({ response: "MCP Service" });
});

app.post("/a2a/v1", async (req, res) => {
  console.log("🤖 POST /a2a/v1", req.body);
  res.json({ response: "A2A Service" });
});

// ============================================================================
// RUN
// ============================================================================

export async function startServer(): Promise<void> {
  if (!process.env.LLM_API_KEY) {
    throw new Error("Set LLM_API_KEY in .env");
  }
  return new Promise((resolve) => {
    app.listen(PORT, () => {
      console.log(`
🧪 Workshop Agent Services at http://localhost:${PORT}

  📁 Agent Card (A2A):     http://localhost:${PORT}${AGENT_CARD_PATH}
  📁 Agent URI (ERC-8004): http://localhost:${PORT}${AGENT_URI_PATH}
  🔗 Service:                 POST http://localhost:${PORT}/free-service   { "message": "Swap 1 ETH to USDC now" }
  🔗 Service (x402):          POST http://localhost:${PORT}/paid-service   { "message": "..." } ($0.01 USDC on base-sepolia)
  🔗 MCP:                  POST http://localhost:${PORT}/mcp/v1
  🔗 A2A:                  POST http://localhost:${PORT}/a2a/v1
  🖥  Web:                  GET  http://localhost:${PORT}/

  💬 curl -X POST http://localhost:${PORT}/free-service -H "Content-Type: application/json" -d '{"message":"Send 0.00042 ETH to 0xA7F36973465b4C3d609961Bc72Cc2E65acE26337"}'
  💬 pnpm run call-services free --message "Send 0.00000042 ETH to 0xA7F36973465b4C3d609961Bc72Cc2E65acE26337"
`);
      resolve();
    });
  });
}
