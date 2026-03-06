#!/usr/bin/env node
/**
 * Workshop: Build Agent Runtime
 *
 * LangGraph workflow:
 * - Static system prompt
 * - Model + tools (delegate_transfer from 2-agent-tools)
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
import { SystemMessage, BaseMessage } from "@langchain/core/messages";
import { delegateTransferTool } from "./2-agent-tools";

// ============================================================================
// STATIC PROMPT
// ============================================================================

const STATIC_SYSTEM_PROMPT = `You are a transfer coordinator agent. Help users send native tokens (ETH) by delegating to an external A2A transfer agent.`;

// ============================================================================
// MODEL & TOOLS
// ============================================================================

// add model

// add tools

// ============================================================================
// LANGGRAPH AGENT RUNTIME
// ============================================================================
const toolNode = new ToolNode([]);

const agent = new StateGraph(MessagesAnnotation)
  .addNode(
    "llm", async (state: { messages: BaseMessage[] }) => {
      // workshop placeholder:implement model node
      return { messages: ["placeholder response"] };
    }
  )
  // Tool node
  .addNode("tools", toolNode)
  .addConditionalEdges(
    "llm", (state: { messages: BaseMessage[] }) => {
      // workshop placeholder: implement conditional edge
      return END;
    },
    ["tools", END]
  )
  .addEdge(START, "llm")
  .addEdge("tools", "llm")
  .compile();

export { agent, STATIC_SYSTEM_PROMPT };
