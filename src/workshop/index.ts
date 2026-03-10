#!/usr/bin/env node
/**
 * Workshop Index – Single entry point
 *
 * Usage: pnpm run workshop [step]
 *   - create:   Create smart accounts (run first, add addresses to .env)
 *   - test:     Test agent (runtime + tools)
 *   - launch:   Start HTTP server (agent card, free/paid services)
 *   - register: On-chain agent registration (ERC-8004)
 *
 * Default (no argument): show help.
 */

import "dotenv/config";
import { HumanMessage } from "@langchain/core/messages";

// ============================================================================
// ÉTAPE 1: Agent Runtime (1-agent-runtime.ts) & Tools (2-agent-tools.ts) with delegation
// ============================================================================
import { agent } from "./1-agent-runtime";

// ============================================================================
// ÉTAPE 3: Services HTTP (3-agent-services.ts)
// ============================================================================
import { startServer } from "./3-agent-services";

// ============================================================================
// ÉTAPE 4: Registration (4-agent-registration.ts)
// ============================================================================
import { registerAgent } from "./4-agent-registration";
import { createSmartAccounts } from "../lib/create-smart-accounts";
import {
  createTransferDelegation,
  getDelegationContextUserToAgent1,
} from "../lib/delegation";
import { getBalances } from "../lib/balance-service";

// ============================================================================
// RUN
// ============================================================================

async function balances() {
  const { ethUsdPrice, balances } = await getBalances();
  console.log("\n💰 Base Sepolia balances (ETH + USD)\n");
  console.log(`ETH/USD: $${ethUsdPrice.toFixed(2)}\n`);
  for (const b of balances) {
    console.log(`  ${b.label.padEnd(14)} ${b.address}  ${b.eth} ETH  $${b.usd} USD`);
  }
  console.log("");
}

async function test() {
  
  const amount = "0.000000111";
  const when = "now";
  const recipient = process.env.TARGET_ADDRESS!;

  const signedDelegation = await createTransferDelegation(undefined, recipient, amount, null, getDelegationContextUserToAgent1());

  const r = await agent.invoke(
    {
      messages: [new HumanMessage(`Transfer ${amount} ETH to ${recipient} ${when}`)],
    },
    { configurable: { thread_id: "workshop-demo", signedDelegation } }
  );
  console.log("\n 💬 AI response:");
  console.log(r.messages.at(-1)?.content ?? "No response");
}

function printHelp() {
  console.log(`
Workshop: Trustless Agent (LangGraph + ERC-7710)

Usage: pnpm run workshop [step]

Steps:
  create   Create smart accounts first (add printed addresses to .env)
  test     Test agent (runtime + tools)
  launch   Start HTTP server (agent card, free/paid services)
  register On-chain agent registration (ERC-8004)
  balances Show ETH + USD balances for USER_SA, AGENT1_SA, AGENT2_SA (Base Sepolia)

Run 'create' first to get AGENT1_SA_ADDRESS and AGENT2_SA_ADDRESS for .env
`);
}

async function main() {
  const step = process.argv[2];
  switch (step) {
    case "test":
      await test();
      break;
    case "launch":
      await startServer();
      break;
    case "register":
      await registerAgent();
      break;
    case "create":
      await createSmartAccounts();
      break;
    case "balances":
      await balances();
      break;
    default:
      printHelp();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
