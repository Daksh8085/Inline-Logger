import * as vscode from "vscode";
import * as fs from "fs";
import * as tmp from "tmp";
import { exec } from "child_process";

export async function runInstrumentedCode(
  document: vscode.TextDocument
): Promise<vscode.DecorationOptions[]> {
  console.log(`[PYLOGGER] Running instrumented code`);

  const originalCode: string = document.getText();
  const lines: string[] = originalCode.split("\n");
  const instrumentedLines: string[] = [];

  console.log(`[PYLOGGER] Document has ${lines.length} lines`);

  let insideMain: boolean = false;
  let mainIndentLevel: number | null = null;
  let insideTopLevelCondition: boolean = false;
  let previousConditions: string[] = [];

  lines.forEach((line, index) => {
    const stripped: string = line.trim();
    const instrumented: string[] = [];
    const indent = line.match(/^\s*/)?.[0] ?? "";
    const lineNumber = index + 1;
    const indentLevel = indent.length;

    if (/^def\s+main\s*\(\s*\)\s*:\s*$/.test(stripped)) {
      insideMain = true;
      mainIndentLevel = indentLevel;
      console.log(`[PYLOGGER] Found main at line ${lineNumber}`);
    } else if (
      insideMain &&
      indentLevel <= (mainIndentLevel ?? 0) &&
      stripped !== ""
    ) {
      insideMain = false;
      mainIndentLevel = null;
      console.log(`[PYLOGGER] Found end of main at line ${lineNumber}`);
    }

    const inGlobalScope = indentLevel === 0;
    const allowlog = inGlobalScope || insideMain;

    // Start of top-level if/elif/else block
    if (inGlobalScope && /^\s*(if|elif|else).*":\s*$/.test(stripped)) {
      if (!insideTopLevelCondition) {
        insideTopLevelCondition = true;
      }

      const condMatch = stripped.match(/^\s*(if|elif)\s+(.*):$/);
      const condition = condMatch?.[2]?.trim();

      if (condition) {
        // For 'if' and 'elif'
        let fullCondition = "";
        if (previousConditions.length > 0) {
          const negated = previousConditions
            .map((c) => `not(${c})`)
            .join(" and ");
          fullCondition = `${negated} and ${condition}`;
        } else {
          fullCondition = condition;
        }

        instrumentedLines.push(
          `${indent}print("[LINE ${lineNumber}]", ${fullCondition})`
        );
        instrumentedLines.push(`${indent}if ${fullCondition}:`);
        previousConditions.push(condition);
        return;
      } else {
        // ELSE BLOCK
        if (previousConditions.length > 0) {
          const negated = previousConditions
            .map((c) => `not(${c})`)
            .join(" and ");
          instrumentedLines.push(`${indent}if ${negated}:`);
          return;
        }
      }
    }

    if (
      inGlobalScope &&
      insideTopLevelCondition &&
      stripped !== "" &&
      !/^\s*(if|elif|else).*:\s*$/.test(stripped)
    ) {
      previousConditions = [];
      insideTopLevelCondition = false;
    }

    if (allowlog || insideTopLevelCondition) {
      // Return statement logging
      if (/^\s*return\s*.+/.test(line)) {
        const returnExpr = line.trim().slice(7);
        instrumented.push(
          `${indent}print("[LINE ${lineNumber}]", ${returnExpr})`
        );
      }
    }

    instrumented.push(line);

    if (allowlog || insideTopLevelCondition) {
      // Variable assignment
      if (/^\s*[a-zA-Z0-9_]*\s*=/.test(line)) {
        const match = line.match(/^\s*([a-zA-Z0-9_]*)\s*=/);
        const varName = match?.[1];
        if (varName) {
          instrumented.push(
            `${indent}print("[LINE ${lineNumber}]", ${varName})`
          );
        }
      }

      // Print() logging
      const printMatch = stripped.match(/^print\s*\((.+)\)/);
      if (printMatch && printMatch[1]) {
        instrumented.push(
          `${indent}print("[LINE ${lineNumber}]", ${printMatch[1]})`
        );
      }
    }

    instrumentedLines.push(...instrumented);
  });

  const instrumentedCode = instrumentedLines.join("\n");
  console.log(`[PYLOGGER] Instrumented code:\n${instrumentedCode}\n`);

  const decorations = await executeInstrumentedCode(instrumentedCode, lines);
  console.log(`[PYLOGGER] Decorations:\n${JSON.stringify(decorations)}`);
  return decorations;
}

function executeInstrumentedCode(
  code: string,
  originalCode: string[]
): Promise<vscode.DecorationOptions[]> {
  return new Promise((resolve) => {
    tmp.file({ postfix: ".py" }, (err, path, _fd, cleanup) => {
      if (err) {
        console.error(`[PYLOGGER] Error creating temp file`, err);
        return resolve([]);
      }

      fs.writeFileSync(path, code);
      console.log(`[PYLOGGER] Wrote instrumented code to ${path}`);

      exec(`python "${path}"`, (error, stdout, stderr) => {
        const decorations: vscode.DecorationOptions[] = [];
        const lines = stdout.split("\n");

        console.log(`[PYLOGGER] stdout:\n${stdout}`);
        if (stderr) {
          console.error(`[PYLOGGER] stderr:\n${stderr}`);
        }
        if (error) {
          console.error(`[PYLOGGER] errorMessage:\n${error.message}`);
          console.error(`[PYLOGGER] errorOutput:\n${error.stdout}`);
        }

        for (const line of lines) {
          const match = line.trim().match(/^\[LINE (\d+)\] (.+)$/);
          if (match) {
            const lineNum = parseInt(match[1]) - 1;
            if (lineNum < 0 || lineNum >= originalCode.length) {
              continue;
            }

            const content = match[2];
            const range = new vscode.Range(
              new vscode.Position(lineNum, originalCode[lineNum].length),
              new vscode.Position(lineNum, originalCode[lineNum].length)
            );

            decorations.push({
              range,
              renderOptions: {
                after: {
                  contentText: ` ${content}`,
                  color: "#FF0000",
                  fontStyle: "italic",
                  margin: "0 0 0 1rem",
                },
              },
            });

            console.log(
              `[PYLOGGER] Decoration for line ${lineNum + 1}: ${content}`
            );
          }
        }

        cleanup();
        resolve(decorations);
      });
    });
  });
}
