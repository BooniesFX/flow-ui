// Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
// SPDX-License-Identifier: MIT

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    // Try to fetch from backend API
    const backendUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8000';
    const response = await fetch(`${backendUrl}/api/reporters`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      // If backend is not available, return empty array
      console.log('Backend API not available, returning empty reporters');
      return NextResponse.json({ reporters: [] });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching reporters:', error);
    // Return empty array on any error
    return NextResponse.json({ reporters: [] });
  }
}