/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as vscode from 'vscode';

const scheme = "vscode-cosmosdb-graphresults";
const previewUri = vscode.Uri.parse(scheme + '://authority/graphresults');

export class GraphView {

    // this.previewWindow = new TextDocumentContentProvider();

    public constructor(context: vscode.ExtensionContext) {
        let provider = new TextDocumentContentProvider();
        let registration = vscode.workspace.registerTextDocumentContentProvider(scheme, provider);

        context.subscriptions.push(registration);
    }

    public async showResults(s: string): Promise<void> {
        try {
            vscode.commands.executeCommand('vscode.previewHtml', previewUri, vscode.ViewColumn.One, 'Gremlin Results');
        } catch (reason) {
            vscode.window.showErrorMessage(reason);
        }
    }
}


class TextDocumentContentProvider implements vscode.TextDocumentContentProvider {
    onDidChange?: vscode.Event<vscode.Uri>;
    provideTextDocumentContent(uri: vscode.Uri, token: vscode.CancellationToken): vscode.ProviderResult<string> {
        return "These are <i>my</i> results";
    }
}
