/**
 * Workshop: Delegate to External Agent
 *
 * Delegation tools:
 * - createSwapDelegation: Creates ERC-7710 signed delegation for token swaps
 * - swapTool: LangChain tool that delegates to an external A2A swap agent
 * - createTransferDelegation: Creates ERC-7710 signed delegation for native token transfer
 * - transferTool: LangChain tool that delegates a simple native token transfer
 *
 * Used by: 1-agent-runtime
 */

import "dotenv/config";
import { tool } from "@langchain/core/tools";
import * as z from "zod";
import { createTransferDelegation, createSwapDelegation } from "../lib/delegation";
import { callExternalAgent } from "../lib/external-agent";

// ============================================================================
// Tools
// ============================================================================

export const transferTool = tool(
  async ({ recipient, amount, when }, config?: any) => {
    console.log("Tool invoked: transfer");
    try {

      const parentDelegation = config?.configurable?.signedDelegation;
      const signedDelegation = await createTransferDelegation(parentDelegation, recipient, amount, when);
      const data = await callExternalAgent({
        agentId: 1,
        skill: "transfer",
        signedDelegation,
        parentDelegation,
        recipient,
        amount,
        when,
      });

      if (data.error) {
        return JSON.stringify({ error: data.error.message });
      }

      return JSON.stringify({
        taskId: 1, // TODO: replace with data.result?.taskId,
        message: `Transfer successfully executed on-chain on behalf of the delegator. Transaction hash: <replace with data.result?.hash>`,
      });
    } catch (error: any) {
      return JSON.stringify({
        error: error.message,
      });
    }
  },
  {
    name: "transfer",
    description:
      "Delegates a native token transfer to an external A2A agent. Use when the user wants to send ETH (or native token) to a recipient. Requires recipient address and amount. Optional: when (timestamp or 'now').",
    schema: z.object({
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

export const swapTool = tool(
  async ({ tokenIn, tokenOut, amountIn, when }) => {
    console.log("Tool invoked: swap");
    try {
      // TODO: Implement swap flow (same pattern as transferTool):
      // 1. createSwapDelegation(tokenIn, tokenOut, amountIn, when)
      // 2. callExternalAgent({ agentId: 2, skill: "swap", signedDelegation, tokenIn, tokenOut, amountIn, when })
      // 3. If data.error, return JSON.stringify({ error: data.error.message })
      // 4. Else return JSON.stringify({ taskId, message }) with the result

      return JSON.stringify({
        taskId: 1, // TODO: replace with data.result?.taskId,
        message: `Swap successfully executed on-chain on behalf of the delegator. Transaction hash: <replace with data.result?.hash>`,
      });
    } catch (error: any) {
      return JSON.stringify({
        error: error.message,
      });
    }
  },
  {
    name: "swap",
    description:
      "Delegates a token swap to an external A2A agent. Use when the user wants to swap one token for another. Requires tokenIn, tokenOut, and amountIn. Optional: when (timestamp or 'now').",
    schema: z.object({
      tokenIn: z.string().describe("Token in (e.g., 'ETH')"),
      tokenOut: z.string().describe("Token out (e.g., 'USDC')"),
      amountIn: z.string().describe("Amount in (e.g., '0.001')"),
      when: z
        .string()
        .optional()
        .nullable()
        .describe("When to execute: 'now' or ISO timestamp"),
    }),
  }
);

export const stakingTool = tool(
  async ({ amount, when }) => {
    console.log("Tool invoked: staking");
    try {
      // TODO: Implement staking flow (same pattern as transferTool):
      // 1. createStakingDelegation(amount, when)
      // 2. callExternalAgent({ agentId: 3, skill: "staking", signedDelegation, amount, when })
      // 3. If data.error, return JSON.stringify({ error: data.error.message })
      // 4. Else return JSON.stringify({ taskId, message }) with the result

      return JSON.stringify({
        taskId: 1, // TODO: replace with data.result?.taskId,
        message: `Staking / Unstaking successfully executed on-chain on behalf of the delegator. Transaction hash: 0x0000000000000000000000000000000000000000000000000000000000000000`,
      });
    } catch (error: any) {
      return JSON.stringify({
        error: error.message,
      });
    }
  },
  {
    name: "staking",
    description:
      "Delegates a staking operation to an external A2A agent. Use when the user wants to stake ETH (or native token). Requires amount and when. Optional: when (timestamp or 'now').",
    schema: z.object({
      amount: z.string().describe("Amount to stake in ETH (e.g., '0.001')"),
      when: z
        .string()
        .optional()
        .nullable()
        .describe("When to execute: 'now' or ISO timestamp"),
    }),
  }
);

export const yieldFarmingTool = tool(
  async ({ amount, when }) => {
    console.log("Tool invoked: yield_farming");
    try {
      // TODO: Implement yield farming flow (same pattern as transferTool):
      // 1. createYieldFarmingDelegation(amount, when)
      // 2. callExternalAgent({ agentId: 4, skill: "yield_farming", signedDelegation, amount, when })
      // 3. If data.error, return JSON.stringify({ error: data.error.message })
      // 4. Else return JSON.stringify({ taskId, message }) with the result

      return JSON.stringify({
        taskId: 1, // TODO: replace with data.result?.taskId,
        message: `Yield farming successfully executed on-chain on behalf of the delegator. Transaction hash: 0x0000000000000000000000000000000000000000000000000000000000000000`,
      });
    } catch (error: any) {
      return JSON.stringify({
        error: error.message,
      });
    }
  },
  {
    name: "yield_farming",
    description:
      "Delegates a yield farming operation to an external A2A agent. Use when the user wants to farm yield. Requires amount and when. Optional: when (timestamp or 'now').",
    schema: z.object({
      amount: z.string().describe("Amount to farm in ETH (e.g., '0.001')"),
      when: z
        .string()
        .optional()
        .nullable()
        .describe("When to execute: 'now' or ISO timestamp"),
    }),
  }
);

export const lendingTool = tool(
  async ({ amount, when }) => {
    console.log("Tool invoked: lending");
    try {
      // TODO: Implement lending flow (same pattern as transferTool):
      // 1. createLendingDelegation(amount, when)
      // 2. callExternalAgent({ agentId: 5, skill: "lending", signedDelegation, amount, when })
      // 3. If data.error, return JSON.stringify({ error: data.error.message })
      // 4. Else return JSON.stringify({ taskId, message }) with the result

      return JSON.stringify({
        taskId: 1, // TODO: replace with data.result?.taskId,
        message: `Lending / Borrowing successfully executed on-chain on behalf of the delegator. Transaction hash: 0x0000000000000000000000000000000000000000000000000000000000000000`,
      });
    } catch (error: any) {
      return JSON.stringify({
        error: error.message,
      });
    }
  },
  {
    name: "lending",
    description:
      "Delegates a lending operation to an external A2A agent. Use when the user wants to lend ETH (or native token). Requires amount and when. Optional: when (timestamp or 'now').",
    schema: z.object({
      amount: z.string().describe("Amount to lend in ETH (e.g., '0.001')"),
      when: z
        .string()
        .optional()
        .nullable()
        .describe("When to execute: 'now' or ISO timestamp"),
    }),
  }
);

// Re-export delegation functions for consumers that import from 2-agent-tools
export {
  createTransferDelegation,
  createSwapDelegation,
  type DelegationContext,
  getDelegationContextAgent1ToAgent2,
  getDelegationContextUserToAgent1,
} from "../lib/delegation";
