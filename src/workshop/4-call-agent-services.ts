#!/usr/bin/env node
/**
 * Workshop: Call Agent Services via CLI
 *
 * Tests different agent service endpoints from the command line.
 * Requires the agent server to be running (pnpm run workshop launch).
 *
 * Usage:
 *   pnpm run call-services [command] [options]
 *
 * Commands:
 *   agent-card     GET /.well-known/agent-card.json
 *   agent-uri      GET /.well-known/agent-uri.json
 *   free           POST /free-service { message }
 *   paid           POST /paid-service { message } (x402 - requires EVM_PRIVATE_KEY + USDC)
 *   mcp            POST /mcp/v1
 *   a2a            POST /a2a/v1
 *   all            Run all GET endpoints (agent-card, agent-uri)
 *
 * Options:
 *   --url <url>    Base URL (default: http://localhost:3000)
 *   --message <m>  Message for free/paid (default: "Hello")
 */

import "dotenv/config";
import { withPaymentInterceptor, createSigner, decodeXPaymentResponse } from "x402-axios";
import axios from "axios";

const DEFAULT_BASE = "http://localhost:3000";
const AGENT_CARD_PATH = "/.well-known/agent-card.json";
const AGENT_URI_PATH = "/.well-known/agent-uri.json";

type Command =
  | "agent-card"
  | "agent-uri"
  | "free"
  | "paid"
  | "mcp"
  | "a2a"
  | "all";

function parseArgs(): { command: Command; baseUrl: string; message: string } {
  const args = process.argv.slice(2);
  let command: Command = "all";
  let baseUrl = DEFAULT_BASE;
  let message = "Hello";

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--url" && args[i + 1]) {
      baseUrl = args[++i].replace(/\/$/, "");
    } else if (args[i] === "--message" && args[i + 1]) {
      message = args[++i];
    } else if (!args[i].startsWith("--")) {
      command = args[i] as Command;
    }
  }

  return { command, baseUrl, message };
}

async function get(url: string): Promise<unknown> {
  const res = await fetch(url);
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`GET ${url} → ${res.status}: ${text}`);
  }
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function post(url: string, body: object): Promise<unknown> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`POST ${url} → ${res.status}: ${text}`);
  }
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function runAgentCard(baseUrl: string): Promise<void> {
  const url = `${baseUrl}${AGENT_CARD_PATH}`;
  console.log(`\n→ GET ${url}`);
  const data = await get(url);
  console.log(JSON.stringify(data, null, 2));
}

async function runAgentUri(baseUrl: string): Promise<void> {
  const url = `${baseUrl}${AGENT_URI_PATH}`;
  console.log(`\n→ GET ${url}`);
  const data = await get(url);
  console.log(JSON.stringify(data, null, 2));
}

async function runFree(baseUrl: string, message: string): Promise<void> {
  const url = `${baseUrl}/free-service`;
  console.log(`\n→ POST ${url} { message: "${message}" }`);
  const data = await post(url, { message });
  console.log(JSON.stringify(data, null, 2));
}

async function runPaid(baseUrl: string, message: string): Promise<void> {
  const privateKey = process.env.USER_PRIVATE_KEY as `0x${string}` | undefined;
  if (!privateKey) {
    console.error(`❌ USER_PRIVATE_KEY is required for paid-service (x402 payment).`);
    throw new Error("Missing EVM_PRIVATE_KEY");
  }

  const signer = await createSigner("base-sepolia", privateKey);
  const api = withPaymentInterceptor(
    axios.create({ baseURL: baseUrl }),
    signer
  );

  console.log(`\n→ POST ${baseUrl}/paid-service { message: "${message}" } (x402)`);
  try {
    // call with x402 payment interceptor
    const response = await api.post("/paid-service", { message });

    console.log(JSON.stringify(response.data, null, 2));

    const paymentResponseHeader = response.headers["x-payment-response"] ?? response.headers["X-PAYMENT-RESPONSE"];
    if (paymentResponseHeader) {
      try {
        const decoded = decodeXPaymentResponse(paymentResponseHeader);
        console.log("\n✓ Facilitator response (X-PAYMENT-RESPONSE):", JSON.stringify(decoded, (_, v) => (typeof v === "bigint" ? v.toString() : v), 2));
      } catch {
        console.log("\n✓ Payment settled (X-PAYMENT-RESPONSE header present)");
      }
    }
  } catch (err: unknown) {
    const axiosErr = err as { response?: { status?: number; data?: unknown; headers?: Record<string, string> } };
    if (axiosErr.response) {
      console.error("\n❌ Facilitator / server response:", JSON.stringify(axiosErr.response.data, null, 2));
      console.error("   Status:", axiosErr.response.status);
      if (axiosErr.response.data && typeof axiosErr.response.data === "object" && "error" in axiosErr.response.data) {
        console.error("   Error:", (axiosErr.response.data as { error?: string }).error);
      }
    }
    throw err;
  }
}

async function runMcp(baseUrl: string): Promise<void> {
  const url = `${baseUrl}/mcp/v1`;
  console.log(`\n→ POST ${url}`);
  const data = await post(url, {});
  console.log(JSON.stringify(data, null, 2));
}

async function runA2a(baseUrl: string): Promise<void> {
  const url = `${baseUrl}/a2a/v1`;
  console.log(`\n→ POST ${url}`);
  const data = await post(url, {});
  console.log(JSON.stringify(data, null, 2));
}

function printHelp(): void {
  console.log(`
Workshop: Call Agent Services via CLI

Usage: pnpm run call-services [command] [options]

Commands:
  agent-card     GET /.well-known/agent-card.json (A2A discovery)
  agent-uri      GET /.well-known/agent-uri.json (ERC-8004 metadata)
  free           POST /free-service { message }
  paid           POST /paid-service { message } (x402, needs EVM_PRIVATE_KEY + USDC)
  mcp            POST /mcp/v1
  a2a            POST /a2a/v1
  all            Run agent-card + agent-uri (default)

Options:
  --url <url>    Base URL (default: http://localhost:3000)
  --message <m>  Message for free/paid (default: "Hello")

Examples:
  pnpm run call-services
  pnpm run call-services agent-card
  pnpm run call-services free --message "Swap 0.001 ETH to USDC"
  pnpm run call-services paid --message "Swap 0.001 ETH to USDC"  # needs EVM_PRIVATE_KEY
`);
}

async function main(): Promise<void> {
  const { command, baseUrl, message } = parseArgs();

  const validCommands: Command[] = [
    "agent-card",
    "agent-uri",
    "free",
    "paid",
    "mcp",
    "a2a",
    "all",
  ];
  if (!validCommands.includes(command)) {
    console.error(`Unknown command: ${command}`);
    printHelp();
    process.exit(1);
  }

  console.log(`Base URL: ${baseUrl}`);

  try {
    switch (command) {
      case "agent-card":
        await runAgentCard(baseUrl);
        break;
      case "agent-uri":
        await runAgentUri(baseUrl);
        break;
      case "free":
        await runFree(baseUrl, message);
        break;
      case "paid":
        await runPaid(baseUrl, message);
        break;
      case "mcp":
        await runMcp(baseUrl);
        break;
      case "a2a":
        await runA2a(baseUrl);
        break;
      case "all":
        await runAgentCard(baseUrl);
        await runAgentUri(baseUrl);
        break;
    }
  } catch (err) {
    console.error("\nError:", err instanceof Error ? err.message : err);
    process.exit(1);
  }
}

main();
