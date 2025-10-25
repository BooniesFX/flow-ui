// Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
// SPDX-License-Identifier: MIT

import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import '@testing-library/jest-dom';

import { AgentNode } from '../agent-node';

describe('AgentNode', () => {
  it('renders correctly with basic props', () => {
    render(
      <AgentNode
        id="test-node"
        agent="researcher"
        label="Researcher"
        researchGoal="Find information about AI"
      />
    );
    
    expect(screen.getByText('Researcher')).toBeInTheDocument();
    expect(screen.getByText('Find information about AI')).toBeInTheDocument();
  });
  
  it('shows status indicator', () => {
    render(
      <AgentNode
        id="test-node"
        agent="researcher"
        label="Researcher"
        status="running"
      />
    );
    
    expect(screen.getByText('Running')).toBeInTheDocument();
  });
});