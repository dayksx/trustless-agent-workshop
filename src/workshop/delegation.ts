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
import { privateKeyToAccount } from "viem/accounts";
import {
  createDelegation,
  Implementation,
  toMetaMaskSmartAccount,
} from "@metamask/smart-accounts-kit";

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
// Delegation creation functions
// ============================================================================

export async function createTransferDelegation(
  recipient: string,
  amount: string,
  when?: string | null
): Promise<unknown> {
  // TODO: Implement ERC-7710 delegation for native token transfer
  // Hints:
  // 1. Get delegator account (getDelegatorAccount()) and delegate address (getDelegateAddress())
  // 2. Create smart account with toMetaMaskSmartAccount (Implementation.Hybrid)
  // 3. Create delegation with createDelegation({ to, from, environment, scope, salt })
  //    - scope: { type: "nativeTokenTransferAmount", maxAmount: parseEther(amount) }
  // 4. Sign with delegatorSmartAccount.signDelegation({ delegation })
  // 5. Return { ...delegation, signature }
  // See workshop-correction/delegation.ts for the solution.
  throw new Error("TODO: Implement createTransferDelegation");
}

export async function createSwapDelegation(
  tokenIn: string,
  tokenOut: string,
  amountIn: string,
  when?: string | null
): Promise<unknown> {
  // TODO: Implement ERC-7710 delegation for token swap (functionCall scope)
  // Hints:
  // 1. Get delegator account and delegate address
  // 2. Create smart account with toMetaMaskSmartAccount
  // 3. Create delegation with scope: { type: "functionCall", targets: [UNISWAP_SWAP_ROUTER_02], selectors: [...] }
  //    - Use UNISWAP_SWAP_ROUTER_02 constant
  //    - Selectors: exactInputSingle, exactInput, exactOutputSingle, exactOutput (see workshop-correction)
  // 4. Sign and return signed delegation
  // See workshop-correction/delegation.ts for the solution.
  throw new Error("TODO: Implement createSwapDelegation");
}
