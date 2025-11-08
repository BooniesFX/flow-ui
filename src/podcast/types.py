# Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
# SPDX-License-Identifier: MIT

from typing import Literal, Optional

from pydantic import BaseModel, Field


class ScriptLine(BaseModel):
    speaker: Literal["male", "female"] = Field(default="male")
    paragraph: str = Field(default="")
    paragraph_zh: Optional[str] = Field(default=None)


class Script(BaseModel):
    locale: Literal["en", "zh", "bilingual"] = Field(default="en")
    lines: list[ScriptLine] = Field(default=[])
