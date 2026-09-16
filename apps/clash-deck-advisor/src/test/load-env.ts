import { readFileSync } from "node:fs";
import path from "node:path";

/** Loads .env.local so evals can reach the live APIs. */
function loadEnvFile(file: string) {
  let contents: string;
  try {
    contents = readFileSync(file, "utf8");
  } catch {
    return;
  }

  for (const line of contents.split("\n")) {
    const trimmed = line.trim();
    if (trimmed === "" || trimmed.startsWith("#") || !trimmed.includes("=")) {
      continue;
    }
    const separator = trimmed.indexOf("=");
    const key = trimmed.slice(0, separator).trim();
    const value = trimmed.slice(separator + 1).trim().replace(/^"|"$/g, "");
    if (value !== "" && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

loadEnvFile(path.resolve(process.cwd(), ".env.local"));
