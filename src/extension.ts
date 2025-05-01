import * as vscode from "vscode";

export function activate(context: vscode.ExtensionContext) {
  console.log('Congratulations, your extension "inline-logger" is now active!');

  context.subscriptions.push(
    vscode.commands.registerCommand("inline-logger.helloWorld", () => {
      vscode.window.showInformationMessage("Hello World from Inline Logger!");
    })
  );
}

export function deactivate() {}
