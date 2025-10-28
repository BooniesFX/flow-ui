// Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
// SPDX-License-Identifier: MIT

import { env } from "~/env";

export function resolveServiceURL(path: string) {
  let BASE_URL = env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/";
  if (!BASE_URL.endsWith("/")) {
    BASE_URL += "/";
  }
  return new URL(path, BASE_URL).toString();
}

// For accessing reports directory files directly (markdown content)
export function resolveReportURL(reportId: string): string {
  return `/api/report/${reportId}`;
}

// For accessing backend API
export function resolveBackendURL(path: string): string {
  return resolveServiceURL(path);
}
