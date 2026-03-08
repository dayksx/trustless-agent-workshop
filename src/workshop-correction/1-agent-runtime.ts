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
import { StateGraph, MessagesAnnotation, START, END, MemorySaver } from "@langchain/langgraph";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { SystemMessage, BaseMessage, AIMessage } from "@langchain/core/messages";
import { lendingTool, stakingTool, swapTool, transferTool, yieldFarmingTool } from "./2-agent-tools";

// ============================================================================
// STATIC PROMPT
// ============================================================================

const STATIC_SYSTEM_PROMPT = `You are a transfer coordinator agent. Help users send native tokens (ETH) by delegating to an external A2A transfer agent.`;

// ============================================================================
// MODEL & TOOLS
// ============================================================================

const model = new ChatOpenAI({
  model: "gpt-4o-mini",
  temperature: 0,
  apiKey: process.env.LLM_API_KEY,
});

const tools = [transferTool, swapTool, stakingTool, yieldFarmingTool, lendingTool];
const modelWithTools = model.bindTools(tools);

// ============================================================================
// LANGGRAPH AGENT RUNTIME
// ============================================================================

const toolNode = new ToolNode(tools);
const checkpointer = new MemorySaver();

const agentRuntime = new StateGraph(MessagesAnnotation)
  .addNode(
    "llm",
    // LLM Node
    async (state: { messages: BaseMessage[] }) => {
      const response = await modelWithTools.invoke([
        new SystemMessage(STATIC_SYSTEM_PROMPT),
        ...state.messages,
      ]);
      return { messages: [response] };
    }
  )
  // Tools Node
  .addNode("tools", toolNode)
  // LLM Node's Conditional Edges
  .addConditionalEdges(
    "llm",
    (state: { messages: BaseMessage[] }) => {
      const last = state.messages[state.messages.length - 1];
      return last instanceof AIMessage && last.tool_calls?.length ? "tools" : END;
    },
    ["tools", END]
  )
  .addEdge(START, "llm")
  .addEdge("tools", "llm")
  .compile({ checkpointer });

export { agentRuntime, agentRuntime as agent, STATIC_SYSTEM_PROMPT, model, tools };

