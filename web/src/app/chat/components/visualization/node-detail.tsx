// Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
// SPDX-License-Identifier: MIT

"use client";

import { motion, AnimatePresence } from "framer-motion";
import { 
  AlertTriangle, 
  BookOpenText, 
  FileText, 
  PencilRuler, 
  Search,
  X,
  RotateCcw,
  Copy
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { useMemo, useState } from "react";
import SyntaxHighlighter from "react-syntax-highlighter";
import { docco } from "react-syntax-highlighter/dist/esm/styles/hljs";
import { dark } from "react-syntax-highlighter/dist/esm/styles/prism";

import { Markdown } from "~/components/deer-flow/markdown";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { ScrollArea } from "~/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { cn } from "~/lib/utils";

import type { ToolCallRuntime } from "~/core/messages";

export interface NodeDetailProps {
  nodeId: string;
  agent: string;
  researchGoal?: string;
  content?: string;
  toolCalls?: ToolCallRuntime[];
  error?: string;
  reasoningContent?: string;
  className?: string;
  onClose?: () => void;
  onRetry?: (nodeId: string) => void;
}

export function NodeDetail({
  nodeId,
  agent,
  researchGoal,
  content,
  toolCalls = [],
  error,
  reasoningContent,
  className,
  onClose,
  onRetry,
}: NodeDetailProps) {
  const t = useTranslations("chat.research");
  const { resolvedTheme } = useTheme();
  const [copied, setCopied] = useState(false);

  // Parse tool call results
  const parsedToolCalls = useMemo(() => {
    return toolCalls.map(toolCall => {
      try {
        if (toolCall.result) {
          return {
            ...toolCall,
            parsedResult: JSON.parse(toolCall.result)
          };
        }
        return toolCall;
      } catch {
        return toolCall;
      }
    });
  }, [toolCalls]);

  // Handle copy to clipboard
  const handleCopy = () => {
    const textToCopy = [
      `Agent: ${agent}`,
      researchGoal && `Research Goal: ${researchGoal}`,
      content && `Content: ${content}`,
      error && `Error: ${error}`,
      reasoningContent && `Reasoning: ${reasoningContent}`
    ].filter(Boolean).join('\n\n');
    
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Render tool call content based on tool type
  const renderToolCallContent = (toolCall: ToolCallRuntime & { parsedResult?: any }) => {
    if (toolCall.result?.startsWith("Error")) {
      return (
        <div className="bg-red-50 border-l-4 border-red-400 p-3 dark:bg-red-950 dark:border-red-600">
          <div className="flex items-center">
            <AlertTriangle className="h-5 w-5 text-red-400 mr-2" />
            <span className="font-medium text-red-700 dark:text-red-300">
              Error in {toolCall.name || 'unknown tool'}
            </span>
          </div>
          <div className="mt-2 text-sm text-red-600 dark:text-red-300">
            {toolCall.result.replace(/^Error:\s*/, '')}
          </div>
          <div className="mt-2 flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => onRetry?.(nodeId)}
              className="px-3 py-1 bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300 rounded text-xs hover:bg-red-200 dark:hover:bg-red-800"
            >
              <RotateCcw className="h-3 w-3 mr-1" />
              Retry
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => navigator.clipboard.writeText(toolCall.result || '')}
              className="px-3 py-1 bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 rounded text-xs hover:bg-gray-200 dark:hover:bg-gray-700"
            >
              <Copy className="h-3 w-3 mr-1" />
              Copy Error
            </Button>
          </div>
        </div>
      );
    }

    switch (toolCall.name) {
      case "web_search":
        return renderWebSearchResult(toolCall);
      case "crawl_tool":
        return renderCrawlResult(toolCall);
      case "python_repl_tool":
        return renderPythonResult(toolCall);
      case "local_search_tool":
        return renderRetrieverResult(toolCall);
      default:
        return renderMCPResult(toolCall);
    }
  };

  const renderWebSearchResult = (toolCall: ToolCallRuntime & { parsedResult?: any }) => {
    const results = Array.isArray(toolCall.parsedResult) ? toolCall.parsedResult : [];
    const query = (toolCall.args as { query?: string })?.query || "";
    
    return (
      <div className="space-y-4">
        <div className="flex items-center text-sm text-muted-foreground">
          <Search className="h-4 w-4 mr-2" />
          <span>Searching for: {query}</span>
        </div>
        <div className="grid grid-cols-1 gap-2">
          {results.map((result: any, index: number) => (
            <div key={`search-${index}-${result.title}`} className="p-3 bg-muted rounded-md">
              <div className="font-medium">{result.title}</div>
              <div className="text-sm text-muted-foreground mt-1 line-clamp-2">
                {result.content}
              </div>
              {result.url && (
                <a 
                  href={result.url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-xs text-blue-500 hover:underline mt-1 inline-block"
                >
                  View source
                </a>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderCrawlResult = (toolCall: ToolCallRuntime & { parsedResult?: any }) => {
    const url = (toolCall.args as { url?: string })?.url || "";
    
    return (
      <div className="space-y-4">
        <div className="flex items-center text-sm text-muted-foreground">
          <BookOpenText className="h-4 w-4 mr-2" />
          <span>Reading: {url}</span>
        </div>
        {toolCall.result && (
          <div className="p-3 bg-muted rounded-md max-h-40 overflow-y-auto">
            <div className="text-sm">{toolCall.result}</div>
          </div>
        )}
      </div>
    );
  };

  const renderPythonResult = (toolCall: ToolCallRuntime & { parsedResult?: any }) => {
    const code = (toolCall.args as { code?: string })?.code || "";
    
    return (
      <div className="space-y-4">
        <div className="flex items-center text-sm text-muted-foreground">
          <PencilRuler className="h-4 w-4 mr-2" />
          <span>Running Python Code</span>
        </div>
        <div className="bg-muted rounded-md p-2">
          <SyntaxHighlighter
            language="python"
            style={resolvedTheme === "dark" ? dark : docco}
            customStyle={{
              background: "transparent",
              margin: 0,
              padding: 0,
            }}
          >
            {code.trim()}
          </SyntaxHighlighter>
        </div>
        {toolCall.result && (
          <div className="bg-muted rounded-md p-2">
            <div className="font-medium text-sm mb-1">Output:</div>
            <SyntaxHighlighter
              language="plaintext"
              style={resolvedTheme === "dark" ? dark : docco}
              customStyle={{
                background: "transparent",
                margin: 0,
                padding: 0,
              }}
            >
              {toolCall.result}
            </SyntaxHighlighter>
          </div>
        )}
      </div>
    );
  };

  const renderRetrieverResult = (toolCall: ToolCallRuntime & { parsedResult?: any }) => {
    const documents = Array.isArray(toolCall.parsedResult) ? toolCall.parsedResult : [];
    const keywords = (toolCall.args as { keywords?: string })?.keywords || "";
    
    return (
      <div className="space-y-4">
        <div className="flex items-center text-sm text-muted-foreground">
          <Search className="h-4 w-4 mr-2" />
          <span>Retrieving documents for: {keywords}</span>
        </div>
        <div className="grid grid-cols-1 gap-2">
          {documents.map((doc: any, index: number) => (
            <div key={`doc-${index}-${doc.title}`} className="p-3 bg-muted rounded-md">
              <div className="font-medium">{doc.title}</div>
              <div className="text-sm text-muted-foreground mt-1 line-clamp-2">
                {doc.content}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderMCPResult = (toolCall: ToolCallRuntime & { parsedResult?: any }) => {
    return (
      <div className="space-y-4">
        <div className="flex items-center text-sm text-muted-foreground">
          <PencilRuler className="h-4 w-4 mr-2" />
          <span>Running {toolCall.name || 'MCP tool'}</span>
        </div>
        {toolCall.result && (
          <div className="bg-muted rounded-md p-2">
            <SyntaxHighlighter
              language="json"
              style={resolvedTheme === "dark" ? dark : docco}
              customStyle={{
                background: "transparent",
                margin: 0,
                padding: 0,
              }}
            >
              {toolCall.result.trim()}
            </SyntaxHighlighter>
          </div>
        )}
      </div>
    );
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, x: 300 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 300 }}
        className={cn("h-full flex flex-col", className)}
      >
        <Card className="h-full flex flex-col">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-lg font-medium">
              Node Details
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={handleCopy}
              >
                {copied ? "Copied!" : "Copy"}
              </Button>
              {onRetry && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onRetry(nodeId)}
                >
                  <RotateCcw className="h-4 w-4" />
                </Button>
              )}
              <Button
                size="sm"
                variant="ghost"
                onClick={onClose}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="flex-grow overflow-hidden">
            <ScrollArea className="h-full">
              <div className="space-y-6 pr-4">
                {/* Agent and Research Goal */}
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-8 h-8 rounded-lg bg-blue-500 flex items-center justify-center">
                      <span className="text-white font-bold text-sm">
                        {agent.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <h3 className="font-semibold text-blue-900 dark:text-blue-100">
                        {agent.charAt(0).toUpperCase() + agent.slice(1)}
                      </h3>
                      <div className="text-sm text-blue-700 dark:text-blue-300 capitalize">
                        Agent Type
                      </div>
                    </div>
                  </div>
                  
                  {researchGoal && (
                    <div className="mt-4 pt-4 border-t border-blue-200 dark:border-blue-800">
                      <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2 flex items-center gap-2">
                        🎯 Research Objective
                      </h4>
                      <div className="text-sm text-blue-800 dark:text-blue-200 bg-blue-50 dark:bg-blue-900/50 rounded-md p-3">
                        {researchGoal}
                      </div>
                    </div>
                  )}
                </div>

                {/* Error Section */}
                {error && (
                  <div className="bg-gradient-to-r from-red-50 to-orange-50 dark:from-red-900/20 dark:to-orange-900/20 rounded-lg p-4 border border-red-200 dark:border-red-800">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-8 h-8 rounded-lg bg-red-500 flex items-center justify-center">
                        <span className="text-white font-bold">⚠️</span>
                      </div>
                      <div>
                        <h3 className="font-semibold text-red-900 dark:text-red-100">
                          Execution Error
                        </h3>
                        <div className="text-sm text-red-700 dark:text-red-300">
                          Something went wrong
                        </div>
                      </div>
                    </div>
                    <div className="mt-3 pt-3 border-t border-red-200 dark:border-red-800">
                      <div className="text-sm text-red-800 dark:text-red-200 bg-red-50 dark:bg-red-900/50 rounded-md p-3 font-mono">
                        {error}
                      </div>
                    </div>
                  </div>
                )}

                {/* Content Tabs */}
                <Tabs defaultValue="content" className="w-full">
                  <TabsList className="grid w-full grid-cols-3 bg-muted/50 rounded-lg p-1">
                    <TabsTrigger value="content" className="data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-md">
                      📄 Content
                    </TabsTrigger>
                    <TabsTrigger value="toolcalls" className="data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-md">
                      🔧 Tool Calls
                    </TabsTrigger>
                    <TabsTrigger value="reasoning" className="data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-md">
                      🧠 Reasoning
                    </TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="content" className="mt-4">
                    {content ? (
                      <div className="bg-gradient-to-br from-slate-50 to-gray-100 dark:from-slate-800 dark:to-gray-900 rounded-lg border border-slate-200 dark:border-slate-700 p-6">
                        <div className="text-sm leading-relaxed">
                          <Markdown>{content}</Markdown>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-12 text-muted-foreground bg-muted/50 rounded-lg border-2 border-dashed border-muted-300/50">
                        <div className="text-4xl mb-2">📝</div>
                        <div className="text-sm">No content available</div>
                      </div>
                    )}
                  </TabsContent>
                  
                  <TabsContent value="toolcalls" className="mt-4">
                    {parsedToolCalls.length > 0 ? (
                      <div className="space-y-4">
                        {parsedToolCalls.map((toolCall, index) => (
                          <div key={toolCall.id || index} className="bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 rounded-lg border border-blue-200 dark:border-blue-800 overflow-hidden">
                            <div className="flex items-start gap-3">
                              <div className="w-2 h-2 rounded-full bg-blue-500 mt-1 flex-shrink-0"></div>
                              <div className="flex-grow min-w-0">
                                <div className="font-semibold text-blue-900 dark:text-blue-100 text-sm">
                                  {toolCall.name || 'Unknown Tool'}
                                </div>
                                <div className="text-xs text-blue-700 dark:text-blue-300 uppercase tracking-wider">
                                  Tool Call #{index + 1}
                                </div>
                              </div>
                            </div>
                            <div className="flex-grow mt-3">
                              {renderToolCallContent(toolCall)}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-12 text-muted-foreground bg-muted/50 rounded-lg border-2 border-dashed border-muted-300/50">
                        <div className="text-6xl mb-2">🔧</div>
                        <div className="text-sm">No tool calls executed</div>
                      </div>
                    )}
                  </TabsContent>
                  
                  <TabsContent value="reasoning" className="mt-4">
                    {reasoningContent ? (
                      <div className="bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-lg border border-purple-200 dark:border-purple-800 p-6">
                        <div className="flex items-center gap-3 mb-4">
                          <div className="w-8 h-8 rounded-lg bg-purple-500 flex items-center justify-center">
                            <span className="text-white font-bold text-lg">🧠</span>
                          </div>
                          <div>
                            <h3 className="font-semibold text-purple-900 dark:text-purple-100">
                              Agent Reasoning
                            </h3>
                            <div className="text-sm text-purple-700 dark:text-purple-300">
                              Chain of thought and analysis process
                            </div>
                          </div>
                        </div>
                        <div className="text-sm leading-relaxed bg-purple-50 dark:bg-purple-900/50 rounded-md p-4">
                          <Markdown>{reasoningContent}</Markdown>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-12 text-muted-foreground bg-muted/50 rounded-lg border-2 border-dashed border-muted-300/50">
                        <div className="text-6xl mb-2">🧠</div>
                        <div className="text-sm">No reasoning content available</div>
                      </div>
                    )}
                  </TabsContent>
                </Tabs>
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </motion.div>
    </AnimatePresence>
  );
}