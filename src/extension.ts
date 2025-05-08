import * as vscode from "vscode";
import { pythonDecorationsMap, setupListeners } from "./listener";
import { DecorationType } from "./types";

export function activate(context: vscode.ExtensionContext) {
  console.log('Congratulations, your extension "pylogger" is now active!');

  context.subscriptions.push(
    vscode.commands.registerCommand("pylogger.helloWorld", () => {
      vscode.window.showInformationMessage("Hello World from Inline Logger!");
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("pylogger.printlog", setupListeners)
  );
}

export function deactivate() {
  console.log('Your extension "pylogger" is now deactivated!');

  const editor = vscode.window.activeTextEditor;
  if (editor) {
    editor.setDecorations(DecorationType, []);
  }
  pythonDecorationsMap.clear();
}
