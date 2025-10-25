import { parse } from "best-effort-json-parser";

export function parseJSON<T>(json: string | null | undefined, fallback: T) {
  if (!json) {
    return fallback;
  }
  try {
    const raw = json
      .trim()
      .replace(/^```json\s*/, "")
      .replace(/^```js\s*/, "")
      .replace(/^```ts\s*/, "")
      .replace(/^```plaintext\s*/, "")
      .replace(/^```\s*/, "")
      .replace(/\s*```$/, "");
    return parse(raw) as T;
  } catch (error) {
    console.warn("JSON parsing failed:", {
      input: json.substring(0, 200) + (json.length > 200 ? "..." : ""),
      error: error instanceof Error ? error.message : String(error)
    });
    return fallback;
  }
}

export function parseJSONWithDetails<T>(
  json: string | null | undefined, 
  fallback: T
): { result: T; error: string | null; warnings: string[] } {
  if (!json) {
    return { result: fallback, error: null, warnings: ["Input is empty or null"] };
  }
  
  const warnings: string[] = [];
  
  try {
    const raw = json
      .trim()
      .replace(/^```json\s*/, "")
      .replace(/^```js\s*/, "")
      .replace(/^```ts\s*/, "")
      .replace(/^```plaintext\s*/, "")
      .replace(/^```\s*/, "")
      .replace(/\s*```$/, "");
    
    // Check for common JSON issues
    if (raw.includes("'")) {
      warnings.push("Contains single quotes - may not be valid JSON");
    }
    if (raw.includes("undefined")) {
      warnings.push("Contains 'undefined' values");
    }
    if (!raw.startsWith("{") && !raw.startsWith("[")) {
      warnings.push("Does not start with { or [ - may not be valid JSON");
    }
    
    const result = parse(raw) as T;
    return { result, error: null, warnings };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("JSON parsing error:", {
      input: json.substring(0, 200) + (json.length > 200 ? "..." : ""),
      error: errorMessage
    });
    
    return { 
      result: fallback, 
      error: `JSON parsing failed: ${errorMessage}`,
      warnings
    };
  }
}
