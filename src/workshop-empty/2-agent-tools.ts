/**
 * Workshop: Delegate to External Agent
 *
 * Delegation tools:
 * - createSwapDelegation: Creates ERC-7710 signed delegation for token swaps
 * - delegateSwapTool: LangChain tool that delegates to an external A2A swap agent
 * - createTransferDelegation: Creates ERC-7710 signed delegation for native token transfer
 * - delegateTransferTool: LangChain tool that delegates a simple native token transfer
 *
 * Used by: 1-agent-runtime
 */

import "dotenv/config";
import { randomBytes } from "node:crypto";
import { tool } from "@langchain/core/tools";
import * as z from "zod";
import { createPublicClient, http, parseEther } from "viem";
import { baseSepolia } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import {
  createDelegation,
  Implementation,
  toMetaMaskSmartAccount,
} from "@metamask/smart-accounts-kit";
import {
  callExternalAgent
} from "./external-agent";

// ============================================================================
// Shared clients (used by all delegation tools)
// ============================================================================

const publicClient = createPublicClient({
  chain: baseSepolia,
  transport: http(),
});

function getDelegatorAccount() {
  const delegatorPrivateKey = process.env.DELEGATOR_PRIVATE_KEY as `0x${string}` | undefined;
  if (!delegatorPrivateKey) throw new Error("Missing DELEGATOR_PRIVATE_KEY in environment");
  return privateKeyToAccount(delegatorPrivateKey);
}

function getDelegateAddress(): `0x${string}` {
  const delegateAddress = process.env.DELEGATEE_SA_ADDRESS as `0x${string}` | undefined;
  if (!delegateAddress) throw new Error("Missing DELEGATEE_SA_ADDRESS in environment");
  return delegateAddress;
}

// ============================================================================
// Tools
// ============================================================================

export const delegateTransferTool = tool(
  async ({ recipient, amount, when }) => {
    try {
        // workshop placeholder: implement tool
      return JSON.stringify({
        taskId: 0,
        message: `Delegation successfully redeemed on-chain. Transaction hash: 0x0000000000000000000000000000000000000000000000000000000000000000`,
      });

    } catch (error: any) {
      return JSON.stringify({ 
        error: error.message 
      });
    }
  },
  {
    name: "delegate_transfer",
    description:
      "Delegates a native token transfer to an external A2A agent. Use when the user wants to send ETH (or native token) to a recipient. Requires recipient address and amount. Optional: when (timestamp or 'now').",
    schema: 
    z.object({
      recipient: z.string().describe("Recipient address (0x...)"),
      amount: z.string().describe("Amount to transfer in ETH (e.g., '0.001')"),
      when: z
        .string()
        .optional()
        .nullable()
        .describe("When to execute: 'now' or ISO timestamp"),
    }),
  }
);


// ============================================================================
// Functions
// ============================================================================

export async function createTransferDelegation(recipient: string, amount: string, when?: string | null): Promise<unknown> {


  return {"signedDelegation placeholder"};
}
