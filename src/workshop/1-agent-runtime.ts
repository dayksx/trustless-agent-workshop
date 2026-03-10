#!/usr/bin/env node
/**
 * Workshop: Build Agent Runtime
 *
 * LangGraph workflow:
 * - Static system prompt
 * - Model + tools (transfer from 2-agent-tools)
 * - Agent graph (llm → tools → llm)
 *
 * Run: pnpm run workshop:1
 * Requires: Your LLM provider's API key in .env (e.g. OPENAI_API_KEY, ANTHROPIC_API_KEY)
 */

import "dotenv/config";
// Pick one based on your LLM provider (install: pnpm add @langchain/<package>)
// import { ChatOpenAI } from "@langchain/openai";           // OPENAI_API_KEY        → gpt-4o-mini, gpt-4o
// import { ChatAnthropic } from "@langchain/anthropic";    // ANTHROPIC_API_KEY     → claude-3-5-sonnet, claude-3-haiku
// import { ChatGoogleGenerativeAI } from "@langchain/google-genai"; // GOOGLE_GENERATIVE_AI_API_KEY → gemini-1.5-flash, gemini-1.5-pro
// import { ChatVertexAI } from "@langchain/google-vertexai"; // GOOGLE_VERTEX_AI_*  → gemini-1.5-flash (GCP)
// import { ChatGroq } from "@langchain/groq";              // GROQ_API_KEY          → llama-3.1-70b-versatile, mixtral-8x7b
// import { ChatMistralAI } from "@langchain/mistralai";    // MISTRAL_API_KEY       → mistral-small, mistral-large
// import { ChatCohere } from "@langchain/cohere";          // COHERE_API_KEY        → command-r-plus
// import { ChatDeepSeek } from "@langchain/deepseek";      // DEEPSEEK_API_KEY      → deepseek-chat
// import { ChatCerebras } from "@langchain/cerebras";      // CEREBRAS_API_KEY      → llama-3.3-70b
// import { ChatCloudflareWorkersAI } from "@langchain/cloudflare"; // CLOUDFLARE_API_TOKEN → @cf/meta/llama-3.1-8b-instruct
// import { BedrockChat } from "@langchain/aws";            // AWS credentials       → anthropic.claude-3-5-sonnet
// import { ChatOllama } from "@langchain/ollama";         // (local, no key)       → llama3.2, mistral
// import { ChatFireworks } from "@langchain/community";    // FIREWORKS_API_KEY     → accounts/fireworks/models/llama-v3p1-70b
// import { ChatOpenRouter } from "@langchain/community";   // OPENROUTER_API_KEY    → anthropic/claude-3.5-sonnet, openai/gpt-4o
import { ChatOpenAI } from "@langchain/openai";
import { StateGraph, START, END, MemorySaver } from "@langchain/langgraph";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { SystemMessage, BaseMessage, AIMessage } from "@langchain/core/messages";
// TODO: Import tools from ./2-agent-tools (transferTool, swapTool, stakingTool, yieldFarmingTool, lendingTool)
import { AgentStateAnnotation } from "../lib/agent-state";

// ============================================================================
// STATIC PROMPT
// ============================================================================

const STATIC_SYSTEM_PROMPT = `You are a transfer coordinator agent. Help users send native tokens (ETH) by delegating to an external A2A transfer agent.`;

// ============================================================================
// MODEL & TOOLS
// ============================================================================
// TODO: Configure your LLM model (ChatOpenAI, ChatAnthropic, ChatGroq, etc.)
// See commented imports at top of file. Set LLM_API_KEY in .env.
const model = new ChatOpenAI({
  model: "gpt-4o-mini",
  temperature: 0,
  apiKey: process.env.LLM_API_KEY,
});

// TODO: Import tools from ./2-agent-tools and add to the array. Start with transferTool.
// Example: import { transferTool, swapTool, stakingTool, yieldFarmingTool, lendingTool } from "./2-agent-tools"; const tools = [transferTool, swapTool, ...];
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const tools: any[] = [];
const modelWithTools = model.bindTools(tools);

// ============================================================================
// LANGGRAPH AGENT RUNTIME
// ============================================================================

const toolNode = new ToolNode(tools);
const checkpointer = new MemorySaver();

const agent = new StateGraph(AgentStateAnnotation)
  .addNode(
    "llm",
    // TODO: Implement LLM node — invoke modelWithTools with system prompt + state.messages, return { messages: [response] }
    // Hint: const response = await modelWithTools.invoke([new SystemMessage(STATIC_SYSTEM_PROMPT), ...state.messages]);
    //       return { messages: [response] };
    async (state: typeof AgentStateAnnotation.State) => {
      throw new Error("TODO: Implement LLM invoke — call modelWithTools.invoke([new SystemMessage(STATIC_SYSTEM_PROMPT), ...state.messages]) and return { messages: [response] }");
    }
  )
  .addNode("tools", toolNode)
  // TODO: Implement routing — return "tools" when the last message has tool_calls, else END
  // Hint: const last = state.messages[state.messages.length - 1];
  //       return last instanceof AIMessage && last.tool_calls?.length ? "tools" : END;
  .addConditionalEdges(
    "llm",
    (state: typeof AgentStateAnnotation.State) => {
      return END; // TODO: replace with proper routing logic above
    },
    ["tools", END]
  )
  .addEdge(START, "llm")
  .addEdge("tools", "llm")
  .compile({ checkpointer });

export { agent, agent as agentRuntime, AgentStateAnnotation, STATIC_SYSTEM_PROMPT, model, tools };
