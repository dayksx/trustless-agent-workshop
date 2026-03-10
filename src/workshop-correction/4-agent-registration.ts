#!/usr/bin/env node
/**
 * Workshop: Register to ERC-8004 using Agent0 SDK
 *
 * Registers the workshop agent on-chain via the ERC-8004 registry.
 * Uses the Agent0 SDK: https://sdk.ag0.xyz/docs
 *
 * Reads agent metadata, agentURI, agentCard, domains, etc. directly from
 * the agent-service file (3-agent-services.ts) - no fetch.
 *
 * Requires:
 *   - PRIVATE_KEY in .env (wallet with Sepolia ETH for gas)
 *   - Chain: Ethereum Sepolia (11155111)
 *
 * Run: pnpm run workshop:4
 */

import "dotenv/config";
import { SDK as Agent0 } from 'agent0-sdk';
import { baseSepolia } from "viem/chains";

import { agentUri, agentCard, AGENT_URI_PATH, AGENT_CARD_PATH } from './3-agent-services';

const AGENT_SERVICE_URL = process.env.AGENT_SERVICE_URL || "http://localhost:3000";

/** Block explorer base URL and Identity Registry contract per chain */
const CHAIN_EXPLORER_CONTRACT: Record<number, { explorer: string; identityRegistry: string }> = {
  11155111: {
    explorer: 'https://sepolia.etherscan.io',
    identityRegistry: '0x8004a6090Cd10A7288092483047B097295Fb8847',
  },
  84532: {
    explorer: 'https://sepolia.basescan.org',
    identityRegistry: '0x8004A818BFB912233c491871b3d84c89A494BD9e',
  },
  59141: {
    explorer: 'https://sepolia.lineascan.build',
    identityRegistry: '0x8004A818BFB912233c491871b3d84c89A494BD9e',
  },
};

export async function registerAgent(): Promise<void> {
  // -------------------------------------------------------------------------
  // 1. Read data from agent-service file (no fetch)
  // -------------------------------------------------------------------------
  const agentUriHttp = `${AGENT_SERVICE_URL}${AGENT_URI_PATH}`;
  const agentCardHttp = `${AGENT_SERVICE_URL}${AGENT_CARD_PATH}`;

  console.log("✅ Read from agent-service file (3-agent-services.ts):");
  console.log(`   Domains: ${(agentUri.domains ?? []).join(', ') || '(none)'}`);
  console.log(`   Skills:  ${(agentUri.skills ?? []).join(', ') || '(none)'}`);
  console.log(`   Agent URI (metadata): ${agentUriHttp}`);
  console.log(`   Agent Card (A2A):    ${agentCardHttp}`);
  console.log(`   Agent card skills: ${agentCard.skills?.map((s) => s.id).join(', ') || '(none)'}`);
  console.log("\n---\n");

  // -------------------------------------------------------------------------
  // 2. Initialize SDK and create agent from agent-service data
  // -------------------------------------------------------------------------
  const agent0 = new Agent0({
    chainId: baseSepolia.id as number, // Ethereum Sepolia testnet
    rpcUrl: baseSepolia.rpcUrls.default.http[0],
    privateKey: process.env.AGENT1_PRIVATE_KEY, // Optional: private key for signing transactions
  });

  const agent = agent0.createAgent(
    agentUri.name,
    agentUri.description,
    agentUri.image
  );

  // Use HTTP URLs from agent-service file (not IPFS)
  const a2aService = agentUri.services?.find((s) => s.name === 'A2A');
  const mcpService = agentUri.services?.find((s) => s.name === 'MCP');
  console.log("   A2A Service Endpoint: ", a2aService);
  console.log("   MCP Service Endpoint: ", mcpService);
  if (a2aService?.endpoint) await agent.setA2A(a2aService.endpoint);
  if (mcpService?.endpoint) await agent.setMCP(mcpService.endpoint);

  // Configure trust models
  agent.setTrust(false, false); // reputation=true, cryptoEconomic=true

  // Add metadata from agent-service file
  agent.setMetadata({
    checksum: agentUri.checksum,
  });

  // Add OASF skills and domains from agent-service file
  for (const skill of agentUri.skills ?? []) {
    agent.addSkill(skill, true);
  }
  for (const domain of agentUri.domains ?? []) {
    agent.addDomain(domain, true);
  }

  // Set status from agent-service
  agent.setActive((agentUri.active as boolean) ?? true);
  agent.setX402Support(true);

  // Register on-chain (pass HTTP URL string, not the agentUri object)
  const tx = await agent.registerHTTP(agentUriHttp);
  const { result: registrationFile } = await tx.waitConfirmed();

  // Optional: set a dedicated agent wallet on-chain (signature-verified;
// By default, agentWallet starts as the owner wallet; only set this if you want a different one.
// await agent.setWallet('0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb');

  const tokenId = registrationFile.agentId?.includes(':')
    ? registrationFile.agentId.split(':')[1]
    : registrationFile.agentId;
  const chainSlug = baseSepolia.id === 84532 ? 'base' : 'sepolia';
  const discoverUrl = `https://testnet.8004scan.io/agents/${chainSlug}/${tokenId}`;
  const chainConfig = CHAIN_EXPLORER_CONTRACT[baseSepolia.id];
  const contractExplorerUrl = chainConfig
    ? `${chainConfig.explorer}/address/${chainConfig.identityRegistry}#readProxyContract`
    : null;

  console.log('✅ Agent registered!');
  console.log(`   ID: ${registrationFile.agentId}`);
  console.log(`   On-chain URI: ${registrationFile.agentURI}`);
  console.log(`   HTTP agentURI (metadata): ${agentUriHttp}`);
  console.log(`   HTTP agentCard (A2A):     ${agentCardHttp}`);
  if (contractExplorerUrl) {
    console.log(`   Contract on Block Explorer: ${contractExplorerUrl}`);
  }
  console.log(`   Discover on 8004scan (delayed):    ${discoverUrl}`);

  // Retrieve agent from subgraph (async in TypeScript)
  const retrieved = await agent0.getAgent(registrationFile.agentId!);
  console.log(`✅ Retrieved from subgraph: ${retrieved?.name ?? registrationFile.agentId}`);
}
