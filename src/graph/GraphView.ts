/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as vscode from 'vscode';

const scheme = "vscode-cosmosdb-graphresults";
const previewUri = scheme + '://';

var results: string = null; // asdf
export class GraphView {
    public constructor(context: vscode.ExtensionContext) {
        let provider = new TextDocumentContentProvider();
        let registration = vscode.workspace.registerTextDocumentContentProvider(scheme, provider);

        context.subscriptions.push(registration);
    }

    public async showResults(id: string, title: string, s: string): Promise<void> {
        try {
            results = s;
            vscode.commands.executeCommand('vscode.previewHtml', vscode.Uri.parse(previewUri + id), vscode.ViewColumn.One, title);
        } catch (reason) {
            vscode.window.showErrorMessage(reason);
        }
    }
}


class TextDocumentContentProvider implements vscode.TextDocumentContentProvider {
    onDidChange?: vscode.Event<vscode.Uri>;
    provideTextDocumentContent(uri: vscode.Uri, token: vscode.CancellationToken): vscode.ProviderResult<string> {
        return results;
    }
}
