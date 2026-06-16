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

// init variables
const amount = "0.000000111";
const when = "now";
const recipient = process.env.TARGET_ADDRESS!;
// const signedDelegation = await createTransferDelegation(undefined, recipient, amount, null, getDelegationContextUserToAgent1());

// ============================================================================
// RUN
// ============================================================================

async function balances() {
  const { balances } = await getBalances();
  console.log("\n💰 Base Sepolia balances (ETH + USDC)\n");
  for (const b of balances) {
    console.log(`  ${b.label.padEnd(14)} ${b.address}  ${b.eth} ETH  ${b.usdc} USDC`);
  }
  console.log("");
}

async function test() {
  // Input data
  const signedDelegation = undefined;
  const message = `Transfer ${amount} ETH to ${recipient} ${when} and swap 0.1 ETH to $LINEA and stake 0.1 ETH and lend all my $LINEA token `;
  console.log("💬 My message:", message);

  // Agent's workflow invocation
  const agentState = await agent.invoke(
    {
      messages: [new HumanMessage(message)],
    },
    { configurable: { thread_id: "workshop-demo", signedDelegation } }
  );

  // Ouput data
  console.log("\n 💬 AI response:");
  console.log(agentState.messages.at(-1)?.content ?? "No response");
}

function printHelp() {
  console.log(`
    Workshop: Trustless Agent (LangGraph + ERC-7710)

    Usage: pnpm run pnpm run workshop test workshop [step]

    Steps:
      test     Test agent (runtime + tools)
      create   Create smart accounts first (add printed addresses to .env)
      launch   Start HTTP server (agent card, free/paid services)
      register On-chain agent registration (ERC-8004)
      balances Show ETH + USDC balances for USER_SA, AGENT1_SA, AGENT2_SA (Base Sepolia)

    Run 'create' first to get AGENT1_SA_ADDRESS, AGENT2_SA_ADDRESS, and USER_SA_ADDRESS for .env
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
      case "help":
        await printHelp();
        break; 
    default:
      printHelp();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
