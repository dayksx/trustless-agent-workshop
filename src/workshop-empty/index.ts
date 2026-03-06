#!/usr/bin/env node
/**
 * Workshop Index – Point d'entrée unique
 *
 * Importe les objets/fonctions des étapes 1→4 et exécute selon l'étape demandée.
 *
 * Usage: pnpm run workshop [1|2|3|4]
 *   - 1: Test agent (runtime + tools)
 *   - 2: Démarrer le serveur HTTP (agent card, chat)
 *   - 3: Test agent (même que 1, tools de 2-agent-tools)
 *   - 4: Enregistrement on-chain (ERC-8004)
 *
 * Par défaut (sans argument): affiche l'aide.
 */

import "dotenv/config";
import { HumanMessage } from "@langchain/core/messages";

// ============================================================================
// ÉTAPE 1: Agent Runtime (1-agent-runtime.ts)
// ============================================================================
import { agent, STATIC_SYSTEM_PROMPT, model, tools } from "./1-agent-runtime";

// ============================================================================
// ÉTAPE 2: Tools (2-agent-tools.ts)
// ============================================================================
import { delegateTransferTool, createTransferDelegation } from "./2-agent-tools";

// ============================================================================
// ÉTAPE 3: Services HTTP (3-agent-services.ts)
// ============================================================================
import {
  agentCard,
  agentUri,
  AGENT_URI_PATH,
  AGENT_CARD_PATH,
  startServer,
  PORT,
} from "./3-agent-services";

// ============================================================================
// ÉTAPE 4: Registration (4-agent-registration.ts)
// ============================================================================
import { registerAgent } from "./4-agent-registration";

// ============================================================================
// RUN
// ============================================================================

async function test() {
  // Placeholder for workshop
  // TODO: Implement agent runtime execution with static system prompt
  //
}


async function main() {
  const step = process.argv[2];
  console.log("step", step);
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
    default:
      test();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
