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
import { createPublicClient, http, parseEther, parseUnits } from "viem";
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
// Constants (Base Sepolia)
// ============================================================================

const USDC = "0x036CbD53842c5426634e7929541eC2318f3dCF7e" as `0x${string}`;
const WETH = "0x4200000000000000000000000000000000000006" as `0x${string}`;
const UNISWAP_SWAP_ROUTER_02 =
  "0x94cC0AaC535CCDB3C01d6787D6413C739ae12bc4" as `0x${string}`;

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
  const delegateAddress = process.env.DELEGATE_SA_ADDRESS as `0x${string}` | undefined;
  if (!delegateAddress) throw new Error("Missing DELEGATE_SA_ADDRESS in environment");
  return delegateAddress;
}

// ============================================================================
// Tools
// ============================================================================

export const delegateTransferTool = tool(
  async ({ recipient, amount, when }) => {
    console.log("Tool invoked: delegate_transfer");
    try {
      const signedDelegation = await createTransferDelegation(recipient, amount, when);

      const data = await callExternalAgent({ agentId: 1, skill: "transfer", signedDelegation, recipient, amount, when });

      if (data.error) {
        return JSON.stringify({ error: data.error.message });
      }

      return JSON.stringify({
        taskId: data.result?.taskId,
        message: `Transfer successfully executed on-chain on behalf of the delegator. Transaction hash: ${data.result?.hash}`,
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

export const delegateSwapTool = tool(
  async ({ tokenIn, tokenOut, amountIn, when }) => {
    console.log("Tool invoked: delegate_swap");
    try {
      const signedDelegation = await createSwapDelegation(tokenIn, tokenOut, amountIn, when);

      const data = await callExternalAgent({ agentId: 1, skill: "swap", signedDelegation, tokenIn, tokenOut, amountIn, when });

      if (data.error) {
        return JSON.stringify({ error: data.error.message });
      }
    return JSON.stringify({
      taskId: data.result?.taskId,
      message: `Swap successfully executed on-chain on behalf of the delegator. Transaction hash: ${data.result?.hash}`,
    });
    
    } catch (error: any) {
      return JSON.stringify({ 
        error: error.message 
      });
    }
  },
  {
    name: "delegate_swap",
    description:
      "Delegates a token swap to an external A2A agent. Use when the user wants to swap one token for another. Requires tokenIn, tokenOut, and amountIn. Optional: when (timestamp or 'now').",
    schema:
      z.object({
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

export const delegateStakingTool = tool(
  async ({ amount, when }) => {
    console.log("Tool invoked: delegate_staking");
    try {
      // workshop placeholder: implement tool
      return JSON.stringify({
        taskId: 0,
        message: `Staking / Unstaking successfully executed on-chain on behalf of the delegator. Transaction hash: 0x0000000000000000000000000000000000000000000000000000000000000000`,
      });
    } catch (error: any) {
      return JSON.stringify({ 
        error: error.message 
      });
    }
  },
  {
    name: "delegate_staking",
    description: "Delegates a staking operation to an external A2A agent. Use when the user wants to stake ETH (or native token). Requires amount and when. Optional: when (timestamp or 'now').",
    schema:
      z.object({
        amount: z.string().describe("Amount to stake in ETH (e.g., '0.001')"),
        when: z
          .string()
          .optional()
          .nullable()
          .describe("When to execute: 'now' or ISO timestamp"),
      }),
  }
);

export const delegateYieldFarmingTool = tool(
  async ({ amount, when }) => {
    console.log("Tool invoked: delegate_yield_farming");
    try {
      // workshop placeholder: implement tool
      return JSON.stringify({
        taskId: 0,
        message: `Yield farming successfully executed on-chain on behalf of the delegator. Transaction hash: 0x0000000000000000000000000000000000000000000000000000000000000000`,
      });
    } catch (error: any) {
      return JSON.stringify({ 
        error: error.message 
      });
    }
  },
  {
    name: "delegate_yield_farming",
    description: "Delegates a yield farming operation to an external A2A agent. Use when the user wants to farm yield. Requires amount and when. Optional: when (timestamp or 'now').",
    schema:
      z.object({
        amount: z.string().describe("Amount to farm in ETH (e.g., '0.001')"),
        when: z
          .string()
          .optional()
          .nullable()
          .describe("When to execute: 'now' or ISO timestamp"),
      }),
  }
);

export const delegateLendingTool = tool(
  async ({ amount, when }) => {
    console.log("Tool invoked: delegate_lending");
    try {
      // workshop placeholder: implement tool
      return JSON.stringify({
        taskId: 0,
        message: `Lending / Borrowing successfully executed on-chain on behalf of the delegator. Transaction hash: 0x0000000000000000000000000000000000000000000000000000000000000000`,
      });
    } catch (error: any) {
      return JSON.stringify({ 
        error: error.message 
      });
    }
  },
  {
    name: "delegate_lending",
    description: "Delegates a lending operation to an external A2A agent. Use when the user wants to lend ETH (or native token). Requires amount and when. Optional: when (timestamp or 'now').",
    schema:
      z.object({
        amount: z.string().describe("Amount to lend in ETH (e.g., '0.001')"),
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
  const delegatorAccount = getDelegatorAccount();
  const delegateAddress = getDelegateAddress();

  const delegatorSmartAccount = await toMetaMaskSmartAccount({
    client: publicClient as any,
    implementation: Implementation.Hybrid,
    deployParams: [delegatorAccount.address, [], [], []],
    deploySalt: "0x",
    signer: { account: delegatorAccount },
  });


  const salt = (`0x` + randomBytes(32).toString("hex")) as `0x${string}`;
  const delegation = createDelegation({
    to: delegateAddress,
    from: delegatorSmartAccount.address,
    environment: delegatorSmartAccount.environment,
    scope: {
      type: "nativeTokenTransferAmount",
      maxAmount: parseEther(amount),
    },
    salt,
  });

  console.log(" == delegation object == \n", delegation);

  const signature = await delegatorSmartAccount.signDelegation({ delegation });

  const signedDelegation = {
    ...delegation,
    signature,
  };

  return signedDelegation;
}

export async function createSwapDelegation(tokenIn: string, tokenOut: string, amountIn: string, when?: string | null): Promise<unknown> {
  // TODO: Implement swap delegation creation
  const delegatorAccount = getDelegatorAccount();
  const delegateAddress = getDelegateAddress();

  const delegatorSmartAccount = await toMetaMaskSmartAccount({
    client: publicClient as any,
    implementation: Implementation.Hybrid,
    deployParams: [delegatorAccount.address, [], [], []],
    deploySalt: "0x",
    signer: { account: delegatorAccount },
  });

  const salt = (`0x` + randomBytes(32).toString("hex")) as `0x${string}`;

  const delegation = createDelegation({
    from: delegatorSmartAccount.address,
    to: delegateAddress,
    environment: delegatorSmartAccount.environment,
    scope: {
      type: "functionCall",
      targets: [UNISWAP_SWAP_ROUTER_02],
      selectors: [
        "exactInputSingle((address,address,uint24,address,uint256,uint256,uint256,uint160))",
        "exactInput((bytes,address,uint256,uint256))",
        "exactOutputSingle((address,address,uint24,address,uint256,uint256,uint256,uint160))",
        "exactOutput((bytes,address,uint256,uint256))",
      ],
    },
    caveats: [
      { type: "valueLte", maxValue: parseEther(amountIn) },
      { type: "erc20TransferAmount", tokenAddress: WETH, maxAmount: parseUnits("0.0001", 18) },
      { type: "erc20TransferAmount", tokenAddress: USDC, maxAmount: parseUnits("50", 6) },
    ],
    salt,
  });

  console.log(" == delegation object == \n", delegation);

  const signature = await delegatorSmartAccount.signDelegation({ delegation });

  const signedDelegation = {
    ...delegation,
    signature,
  };
  
  return signedDelegation;
}