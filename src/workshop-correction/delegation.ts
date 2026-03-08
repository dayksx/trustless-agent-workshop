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

export async function createSwapDelegation(
  tokenIn: string,
  tokenOut: string,
  amountIn: string,
  when?: string | null
): Promise<unknown> {
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
