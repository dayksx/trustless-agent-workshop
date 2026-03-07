/**
 * Workshop: Redeem Delegation from External Agent
 *
 * callExternalAgent - Redeems a delegation locally without calling an external A2A agent.
 *
 * Used by workshop step 3 when EXTERNAL_SWAP_AGENT_URL is not needed:
 * instead of delegating to an external swap agent, this directly redeems the
 * signed delegation on-chain.
 *
 * Requires: DELEGATE_PRIVATE_KEY, BUNDLER_BASE_SEPOLIA_URL
 */

import "dotenv/config";
import { createPublicClient, formatEther, http, parseEther } from "viem";
import { baseSepolia } from "viem/chains";
import { createBundlerClient } from "viem/account-abstraction";
import { privateKeyToAccount } from "viem/accounts";
import { createExecution, ExecutionMode } from "@metamask/delegation-toolkit";
import { DelegationManager } from "@metamask/delegation-toolkit/contracts";
import { Implementation, toMetaMaskSmartAccount } from "@metamask/smart-accounts-kit";

export interface CallExternalAgentParams {
  agentId: number;
  skill: "transfer" | "swap";
  signedDelegation: unknown;
  when?: string | null;
  // transfer-specific
  recipient?: string;
  amount?: string;
  // swap-specific
  tokenIn?: string;
  tokenOut?: string;
  amountIn?: string;
}

/**
 * Redeems a delegation on-chain without calling an external agent.
 * Routes to different redeeming logic based on skill.
 */
export async function callExternalAgent(params: CallExternalAgentParams): Promise<any> {
  const { agentId, skill, signedDelegation } = params;

  switch (skill) {
    case "transfer":
      return redeemDelegationTransfer(params);
    case "swap":
      return redeemDelegationSwap(params);
    default:
      return { error: { message: `Unknown skill: ${skill}` } };
  }
}

/**
 * Placeholder: Redeem transfer delegation on-chain.
 */
async function redeemDelegationTransfer(params: CallExternalAgentParams): Promise<any> {
  const { agentId, signedDelegation, recipient, amount } = params;
  const env = process.env;
  const delegatePrivateKey = env.DELEGATE_PRIVATE_KEY as `0x${string}` | undefined;
  const bundlerBaseSepoliaUrl = env.BUNDLER_BASE_SEPOLIA_URL as string | undefined;

  if (!delegatePrivateKey || !bundlerBaseSepoliaUrl) throw new Error("Missing DELEGATE_PRIVATE_KEY or BUNDLER_BASE_SEPOLIA_URL in environment");
  if (!signedDelegation) throw new Error("Delegation missing signedDelegation");
  if (!recipient || !amount) throw new Error("Missing recipient or amount");

  try {
    const publicClient = createPublicClient({
      chain: baseSepolia,
      transport: http(),
    });

    const bundlerClient = createBundlerClient({
      client: publicClient,
      transport: http(bundlerBaseSepoliaUrl),
      paymaster: process.env.USE_PAYMASTER === "true",
    });

    const delegateAccount = privateKeyToAccount(delegatePrivateKey as `0x${string}`);

    const delegateSmartAccount = await toMetaMaskSmartAccount({
      client: publicClient as any,
      implementation: Implementation.Hybrid,
      deployParams: [delegateAccount.address, [], [], []],
      deploySalt: "0x",
      signer: { account: delegateAccount },
    });

    const execution = createExecution({
      target: recipient as `0x${string}`,
      value: parseEther(amount),
      callData: "0x",
    });

    const { maxFeePerGas, maxPriorityFeePerGas } = await publicClient.estimateFeesPerGas();

    const delegations = [signedDelegation as any];
    const executions = [execution as any];

    const redeemDelegationCalldata = DelegationManager.encode.redeemDelegations({
      delegations: [delegations],
      modes: [ExecutionMode.SingleDefault],
      executions: [executions],
    });

    console.log(`[mock agentId=${agentId}] delegate address:`, delegateSmartAccount.address);
    const userOperationHash = await bundlerClient.sendUserOperation({
      account: delegateSmartAccount,
      calls: [
        { 
          to: delegateSmartAccount.address, 
          data: redeemDelegationCalldata 
        }
      ],
      maxFeePerGas,
      maxPriorityFeePerGas,
    });

    const receipt = await bundlerClient.waitForUserOperationReceipt({
      hash: userOperationHash,
    });

    console.log(
      " Transfer successfully redeemed on-chain \n",
      JSON.stringify(receipt, (_, v) => (typeof v === "bigint" ? v.toString() : v), 2)
    );

    return {
      result: {
        taskId: 1,
        hash: userOperationHash,
        message: "Transfer successfully redeemed on-chain",
      },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Redeem delegation failed:", message);
    if (err instanceof Error && err.stack) {
      console.error(err.stack);
    }
    // Decode allowance-exceeded (0x08c379a0 = Error(string))
    if (message.includes("allowance-exceeded") || message.includes("616c6c6f77616e63652d6578636565646564")) {
      console.error(
        `\n--- NativeTokenTransferAmountEnforcer: allowance-exceeded ---\n` +
          `  The transfer amount exceeds the delegation's maxAmount (caveat).\n` +
          `  Each delegation has a one-time allowance. If you already redeemed this delegation,\n` +
          `  create a fresh one. Ensure the amount in the tool matches the delegation's maxAmount.\n`
      );
    }
    // Decode common simulation revert: 0xb5863604 (may be balance, caveat, or other delegation issue)
    else if (message.includes("0xb5863604")) {
      const delegatorAddr = (signedDelegation as { delegator?: string })?.delegator;
      const amountNeededStr = amount ?? env.REDEEM_VALUE_ETH ?? "0";
      const amountNeededWei = parseEther(amountNeededStr);

      if (delegatorAddr) {
        try {
          const publicClient = createPublicClient({
            chain: baseSepolia,
            transport: http(),
          });
          const balance = await publicClient.getBalance({ address: delegatorAddr as `0x${string}` });
          const isSufficientForTransfer = balance >= amountNeededWei;

          console.error(
            `\n--- Delegator account (0xb5863604) ---\n` +
              `  Smart account:   ${delegatorAddr}\n` +
              `  Current balance: ${formatEther(balance)} ETH\n` +
              `  Transfer amount: ${amountNeededStr} ETH\n`
          );
          if (isSufficientForTransfer) {
            console.error(
              `  Balance is sufficient. 0xb5863604 is likely InvalidDelegate:\n` +
                `  - The delegate in the delegation must match the redeemer (msg.sender).\n` +
                `  - Ensure DELEGATE_PRIVATE_KEY is set when creating delegations (2-agent-tools)\n` +
                `    so the delegator uses the correct DeleGator address, not DELEGATE_EOA_ADDRESS (EOA).\n` +
                `  - Or: DELEGATE_SA_ADDRESS must be the DeleGator address, not the EOA.\n`
            );
          } else {
            console.error(
              `  Insufficient: need at least ${amountNeededStr} ETH (+ gas if not using paymaster).\n` +
                `  Fund: https://www.coinbase.com/faucets/base-ethereum-goerli-faucet\n`
            );
          }
        } catch (balanceErr) {
          console.error(
            `\n--- Delegator account ---\n` +
              `  Smart account: ${delegatorAddr}\n` +
              `  Amount needed: ${amountNeededStr} ETH\n`
          );
        }
      } else {
        console.error(
          "\nTroubleshooting 0xb5863604: Check delegator balance, caveat enforcers, and delegation status."
        );
      }
    }
    return {
      error: {
        message,
      },
    };
  }
}

/**
 * Placeholder: Redeem swap delegation on-chain.
 * TODO: Implement swap delegation redeeming (e.g. DEX interaction).
 */
async function redeemDelegationSwap(params: CallExternalAgentParams): Promise<any> {
  const { agentId, signedDelegation, tokenIn, tokenOut, amountIn } = params;
  // Placeholder: would redeem swap delegation via DEX router, etc.
  console.log(`[mock agentId=${agentId}] redeemDelegationSwap: ${tokenIn} -> ${tokenOut}, amountIn=${amountIn}`);
  return {
    result: {
      taskId: 1,
      hash: "0x" + "0".repeat(64),
      message: "Swap delegation redeem (placeholder)",
    },
  };
}
