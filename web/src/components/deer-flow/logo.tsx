// Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
// SPDX-License-Identifier: MIT

import Link from "next/link";

export function Logo() {
  return (
    <Link
      className="flex items-center gap-2 opacity-70 transition-opacity duration-300 hover:opacity-100"
      href="/"
    >
      <span className="text-2xl font-bold text-primary">DR</span>
      <span className="font-semibold">Deep Research</span>
    </Link>
  );
}
