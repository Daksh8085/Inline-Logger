import * as vscode from "vscode";
import { runInstrumentedCode } from "./instrumentedRunner";
import { DecorationType } from "./types";
import debounce from "lodash/debounce";

export const pythonDecorationsMap = new Map<
  string,
  vscode.DecorationOptions[]
>();

export function setupListeners(): void {
  console.log("setupListeners");

  // Handle already open tab
  async function initializeOpenEditors() {
    console.log("[PYLOGGER] Initializing already open editors");

    for (const editor of vscode.window.visibleTextEditors) {
      const document = editor.document;
      if (document.languageId !== "python") {
        continue;
      }

      const diagnostics = vscode.languages.getDiagnostics(document.uri);
      if (diagnostics.length > 0) {
        console.log(
          `[PYLOGGER] Found ${diagnostics.length} diagnostics in ${document.uri}`,
          `[PYLOGGER] Skipping ${document.uri.toString()} error found`
        );
        continue;
      }

      console.log(`[PYLOGGER] Processing ${document.uri.toString()}`);

      const PythonLogDecorations = await runInstrumentedCode(document);
      pythonDecorationsMap.set(document.uri.toString(), PythonLogDecorations);
      editor.setDecorations(DecorationType, PythonLogDecorations);
    }
  }

  async function updateDecorations(document: vscode.TextDocument) {
    const diagnostics = vscode.languages.getDiagnostics(document.uri);
    if (diagnostics.length > 0) {
      console.log(`[PYLOGGER] Skipping ${document.uri.toString()} error found`);
      return;
    }

    console.log(`[PYLOGGER] Processing ${document.uri.toString()}`);

    const PythonLogDecorations = await runInstrumentedCode(document);
    pythonDecorationsMap.set(document.uri.toString(), PythonLogDecorations);

    const editor = vscode.window.activeTextEditor;
    if (editor && editor.document.uri.toString() === document.uri.toString()) {
      editor.setDecorations(DecorationType, PythonLogDecorations);
    }
  }

  // Debouned function to avoid too frequent runs
  const debouncedUpdateDecorations = debounce(
    async (document: vscode.TextDocument) => {
      const editor = vscode.window.activeTextEditor;
      if (
        !editor ||
        editor.document.uri.toString() !== document.uri.toString()
      ) {
        console.log(`[PYLOGGER] Skipping ${document.uri.toString()}`);
        return;
      }

      const diagnostics = vscode.languages.getDiagnostics(document.uri);
      if (diagnostics.length > 0) {
        console.log(
          `[PYLOGGER] Skipping ${document.uri.toString()} error found`
        );
        return;
      }

      console.log(`[PYLOGGER] Processing ${document.uri.toString()}`);

      const PythonLogDecorations = await runInstrumentedCode(document);
      pythonDecorationsMap.set(document.uri.toString(), PythonLogDecorations);

      editor.setDecorations(DecorationType, PythonLogDecorations);
    },
    300
  );

  // On Save
  vscode.workspace.onDidSaveTextDocument(async (document) => {
    if (document.languageId !== "python") {
      return;
    }

    debouncedUpdateDecorations(document);
  });

  // On Change
  vscode.workspace.onDidChangeTextDocument(async (event) => {
    if (event.document.languageId !== "python") {
      return;
    }

    const editor = vscode.window.activeTextEditor;
    if (
      !editor ||
      editor.document.uri.toString() !== event.document.uri.toString()
    ) {
      console.log(`[PYLOGGER] Skipping ${event.document.uri.toString()}`);
      return;
    }

    const documentUri = event.document.uri.toString();

    // Check if only newLines
    const newLines = event.contentChanges.filter(
      (change) => change.text === "\n"
    );
    if (newLines.length > 0) {
      console.log(`[PYLOGGER] Skipping ${event.document.uri.toString()}`);

      const PythonLogDecorations = pythonDecorationsMap.get(documentUri) ?? [];
      editor.setDecorations(DecorationType, PythonLogDecorations);
      return;
    }

    debouncedUpdateDecorations(event.document);
  });

  // On Open
  vscode.workspace.onDidOpenTextDocument(async (document) => {
    if (document.languageId !== "python") {
      return;
    }

    // Delay a tiny bit
    await new Promise((resolve) => setTimeout(resolve, 500));

    debouncedUpdateDecorations(document);
  });

  // onClose
  vscode.workspace.onDidCloseTextDocument((document) => {
    if (document.languageId !== "python") {
      console.log(`[PYLOGGER] Skipping ${document.uri.toString()}`);
      return;
    }

    console.log(`[PYLOGGER] Closing ${document.uri.toString()}`);
    pythonDecorationsMap.delete(document.uri.toString());

    const editor = vscode.window.activeTextEditor;
    if (editor && editor.document.uri.toString() === document.uri.toString()) {
      editor.setDecorations(DecorationType, []);
    }
  });

  vscode.window.onDidChangeActiveTextEditor((editor) => {
    if (!editor || editor.document.languageId !== "python") {
      return;
    }

    const PythonLogDecorations =
      pythonDecorationsMap.get(editor.document.uri.toString()) ?? [];
    editor.setDecorations(DecorationType, PythonLogDecorations);
  });

  initializeOpenEditors();
}
