const fs = require("fs");
const path = require("path");

function normalizeNewlines(s) {
  return s.replace(/\r\n/g, "\n");
}

function preserveNewlinesAsSpaces(s) {
  return s.replace(/[^\n]/g, " ");
}

function stripCssComments(text) {
  const input = normalizeNewlines(text);
  let out = "";
  let i = 0;
  while (i < input.length) {
    const start = input.indexOf("/*", i);
    if (start === -1) {
      out += input.slice(i);
      break;
    }
    const end = input.indexOf("*/", start + 2);
    if (end === -1) {
      out += input.slice(i);
      break;
    }
    out += input.slice(i, start);
    out += preserveNewlinesAsSpaces(input.slice(start, end + 2));
    i = end + 2;
  }
  return out;
}

function getTypescript() {
  const candidates = [
    path.join(__dirname, "..", "packages", "ui", "node_modules", "typescript"),
    path.join(__dirname, "..", "packages", "shared", "node_modules", "typescript"),
    "typescript",
  ];

  for (const c of candidates) {
    try {
      // eslint-disable-next-line import/no-dynamic-require, global-require
      return require(c);
    } catch {
      // continue
    }
  }

  throw new Error("typescript module not found (expected in packages/ui node_modules)");
}

function stripTsJsComments(text, isJsx) {
  const ts = getTypescript();
  const input = normalizeNewlines(text);
  const scanner = ts.createScanner(
    ts.ScriptTarget.Latest,
    false,
    isJsx ? ts.LanguageVariant.JSX : ts.LanguageVariant.Standard,
    input
  );

  let out = "";

  while (true) {
    const kind = scanner.scan();
    const tokenPos = scanner.getTokenPos();
    const textPos = scanner.getTextPos();
    const tokenText = input.slice(tokenPos, textPos);

    if (
      kind === ts.SyntaxKind.SingleLineCommentTrivia ||
      kind === ts.SyntaxKind.MultiLineCommentTrivia
    ) {
      out += preserveNewlinesAsSpaces(tokenText);
    } else {
      out += tokenText;
    }

    if (kind === ts.SyntaxKind.EndOfFileToken) break;
  }

  return out;
}

function isUnderSrcDir(filePath) {
  const normalized = filePath.split(path.sep).join("/");
  return (
    (normalized.includes("/apps/") || normalized.includes("/packages/")) &&
    normalized.includes("/src/")
  );
}

function shouldProcessFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return ext === ".ts" || ext === ".tsx" || ext === ".js" || ext === ".jsx" || ext === ".css";
}

function walk(dir, onFile) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    if (e.name === "node_modules" || e.name === ".next" || e.name === "dist" || e.name === "build") {
      continue;
    }
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, onFile);
    else if (e.isFile()) onFile(full);
  }
}

function processFile(filePath) {
  if (!isUnderSrcDir(filePath)) return { changed: false };
  if (!shouldProcessFile(filePath)) return { changed: false };

  const ext = path.extname(filePath).toLowerCase();
  const original = fs.readFileSync(filePath, "utf8");
  let next = original;

  if (ext === ".css") next = stripCssComments(original);
  else next = stripTsJsComments(original, ext === ".tsx" || ext === ".jsx");

  if (next === original) return { changed: false };

  fs.writeFileSync(filePath, next, "utf8");
  return { changed: true };
}

function main() {
  const repoRoot = path.join(__dirname, "..");
  const targets = [path.join(repoRoot, "apps"), path.join(repoRoot, "packages")].filter((p) =>
    fs.existsSync(p)
  );

  let changedCount = 0;
  let scannedCount = 0;

  for (const t of targets) {
    walk(t, (f) => {
      scannedCount += 1;
      const res = processFile(f);
      if (res.changed) changedCount += 1;
    });
  }

  process.stdout.write(
    JSON.stringify({ scannedFiles: scannedCount, changedFiles: changedCount }) + "\n"
  );
}

main();


