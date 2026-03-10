/**
 * Workshop: Delegation helpers (ERC-7710)
 *
 * Constants, shared clients, and delegation creation functions.
 * Used by: 2-agent-tools
 */

import "dotenv/config";
import { randomBytes } from "node:crypto";
import { createPublicClient, http, parseEther } from "viem";
import { baseSepolia } from "viem/chains";
import type { Account } from "viem/accounts";
import { privateKeyToAccount } from "viem/accounts";
import {
  createDelegation,
  Implementation,
  toMetaMaskSmartAccount,
} from "@metamask/smart-accounts-kit";

// ============================================================================
// Delegation context (delegator + delegate)
// ============================================================================

/** Pass any delegator Account and delegate address. Use for custom delegator/delegate pairs. */
export interface DelegationContext {
  delegatorAccount: Account;
  delegateAddress: `0x${string}`;
}

/** Agent1 delegates to Agent2. Requires AGENT1_PRIVATE_KEY, AGENT2_SA_ADDRESS. */
export function getDelegationContextAgent1ToAgent2(): DelegationContext {
  const delegatorPrivateKey = process.env.AGENT1_PRIVATE_KEY as `0x${string}` | undefined;
  if (!delegatorPrivateKey) throw new Error("Missing AGENT1_PRIVATE_KEY in environment");
  const delegateAddress = process.env.AGENT2_SA_ADDRESS as `0x${string}` | undefined;
  if (!delegateAddress) throw new Error("Missing AGENT2_SA_ADDRESS in environment");
  return {
    delegatorAccount: privateKeyToAccount(delegatorPrivateKey),
    delegateAddress,
  };
}

/** User delegates to Agent1. Requires USER_PRIVATE_KEY, AGENT1_SA_ADDRESS. */
export function getDelegationContextUserToAgent1(): DelegationContext {
  const userKey = process.env.USER_PRIVATE_KEY as `0x${string}` | undefined;
  const agent1Sa = process.env.AGENT1_SA_ADDRESS as `0x${string}` | undefined;
  if (!userKey) throw new Error("Missing USER_PRIVATE_KEY in environment");
  if (!agent1Sa) throw new Error("Missing AGENT1_SA_ADDRESS in environment");
  return {
    delegatorAccount: privateKeyToAccount(userKey),
    delegateAddress: agent1Sa,
  };
}

// ============================================================================
// Constants (Base Sepolia)
// ============================================================================

export const USDC = "0x036CbD53842c5426634e7929541eC2318f3dCF7e" as `0x${string}`;
export const WETH = "0x4200000000000000000000000000000000000006" as `0x${string}`;
export const UNISWAP_SWAP_ROUTER_02 =
  "0x94cC0AaC535CCDB3C01d6787D6413C739ae12bc4" as `0x${string}`;

// ============================================================================
// Shared clients (used by all delegation tools)
// ============================================================================

const publicClient = createPublicClient({
  chain: baseSepolia,
  transport: http(),
});

// ============================================================================
// Delegation creation functions
// ============================================================================

export async function createTransferDelegation(
  recipient: string,
  amount: string,
  when?: string | null,
  context?: DelegationContext,
): Promise<unknown> {
  const { delegatorAccount, delegateAddress } = context ?? getDelegationContextAgent1ToAgent2();

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
    caveats: [
      {
        type: "allowedTargets",
        targets: [recipient as `0x${string}`]
      }
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

export async function createSwapDelegation(
  tokenIn: string,
  tokenOut: string,
  amountIn: string,
  when?: string | null,
  context?: DelegationContext,
): Promise<unknown> {
  const { delegatorAccount, delegateAddress } = context ?? getDelegationContextAgent1ToAgent2();

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
    caveats: [],
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
