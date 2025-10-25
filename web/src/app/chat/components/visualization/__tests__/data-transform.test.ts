// Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
// SPDX-License-Identifier: MIT

import { describe, it, expect } from 'vitest';

import { messageToNode, messagesToNodes } from '../data-transform';

describe('data-transform', () => {
  it('transforms a message to a node correctly', () => {
    const message = {
      id: 'test-message',
      agent: 'researcher',
      content: '# Research Task\nThis is a research task',
      isStreaming: false,
      toolCalls: [
        {
          id: 'tool-1',
          name: 'web_search',
          args: { query: 'AI research' },
          result: 'Found 10 results'
        }
      ]
    } as any;
    
    const node = messageToNode(message, 0);
    
    expect(node.id).toBe('test-message');
    expect(node.agent).toBe('researcher');
    expect(node.researchGoal).toBe('Research Task');
    expect(node.status).toBe('completed');
  });
  
  it('handles streaming messages', () => {
    const message = {
      id: 'test-message',
      agent: 'researcher',
      content: 'Researching...',
      isStreaming: true
    } as any;
    
    const node = messageToNode(message, 0);
    
    expect(node.status).toBe('running');
  });
  
  it('transforms multiple messages to nodes', () => {
    const messages = [
      {
        id: 'msg-1',
        agent: 'researcher',
        content: 'Research task 1',
        isStreaming: false
      },
      {
        id: 'msg-2',
        agent: 'coder',
        content: 'Code task 1',
        isStreaming: false
      }
    ] as any;
    
    const nodes = messagesToNodes(messages);
    
    expect(nodes).toHaveLength(2);
    expect(nodes[0]?.agent).toBe('researcher');
    expect(nodes[1]?.agent).toBe('coder');
  });
});