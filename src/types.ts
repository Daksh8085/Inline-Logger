import * as vscode from "vscode";

export const DecorationType = vscode.window.createTextEditorDecorationType({
  after: {
    color: "grey",
    fontStyle: "italic",
    margin: "0 0 0 1rem",
  },
});
