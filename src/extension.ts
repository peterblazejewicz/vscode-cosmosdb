/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as vscode from 'vscode';
import * as _ from 'underscore';
import * as fs from 'fs';
import * as path from 'path';
import * as copypaste from 'copy-paste';
import * as opn from 'opn';
import * as util from "./util";

import { AzureAccount } from './azure-account.api';
import { CosmosDBCommands } from './commands';
import { CosmosDBExplorer } from './explorer';
import { MongoCommands } from './mongo/commands';
import { IMongoServer, MongoDatabaseNode, MongoCommand, MongoCollectionNode, MongoDocumentNode } from './mongo/nodes';
import { DocDBDatabaseNode, DocDBCollectionNode, DocDBDocumentNode } from './docdb/nodes';
import { CosmosDBResourceNode, INode } from './nodes';
import { DocumentClient } from 'documentdb';
import { DocDBCommands } from './docdb/commands';
import MongoDBLanguageClient from './mongo/languageClient';
import { Reporter } from './telemetry';
import { parse } from 'jsonc-parser';

let connectedDb: MongoDatabaseNode = null;
let languageClient: MongoDBLanguageClient = null;
let explorer: CosmosDBExplorer;
let lastCommand: MongoCommand;
let lastOpenedDocDBDocument: DocDBDocumentNode;
let lastOpenedMongoDocument: MongoDocumentNode;
let lastOpenedDocumentType: DocumentType;
enum DocumentType {
	Mongo,
	DocDB
};

export function activate(context: vscode.ExtensionContext) {
	context.subscriptions.push(new Reporter(context));

	const azureAccount = vscode.extensions.getExtension<AzureAccount>('ms-vscode.azure-account')!.exports;

	languageClient = new MongoDBLanguageClient(context);

	explorer = new CosmosDBExplorer(azureAccount, context.globalState);
	context.subscriptions.push(azureAccount.onFiltersChanged(() => explorer.refresh()));
	context.subscriptions.push(azureAccount.onStatusChanged(() => explorer.refresh()));
	context.subscriptions.push(azureAccount.onSessionsChanged(() => explorer.refresh()));
	vscode.window.registerTreeDataProvider('cosmosDBExplorer', explorer);

	// Commands
	initAsyncCommand(context, 'cosmosDB.createAccount', async () => {
		const account = await CosmosDBCommands.createCosmosDBAccount(azureAccount);
		if (account) {
			explorer.refresh();
		}
	});
	initAsyncCommand(context, 'cosmosDB.attachMongoServer', () => attachMongoServer());
	initCommand(context, 'cosmosDB.refresh', (node: INode) => explorer.refresh(node));
	initAsyncCommand(context, 'cosmosDB.removeMongoServer', (node: INode) => removeMongoServer(node));
	initAsyncCommand(context, 'cosmosDB.createMongoDatabase', (node: IMongoServer) => createMongoDatabase(node));
	initAsyncCommand(context, 'cosmosDB.createDocDBDatabase', (node: CosmosDBResourceNode) => DocDBCommands.createDocDBDatabase(node, explorer));
	initAsyncCommand(context, 'cosmosDB.createDocDBCollection', (node: DocDBDatabaseNode) => DocDBCommands.createDocDBCollection(node, explorer));
	initAsyncCommand(context, 'cosmosDB.createDocDBDocument', (node: DocDBCollectionNode) => DocDBCommands.createDocDBDocument(node, explorer));
	initCommand(context, 'cosmosDB.openInPortal', (node: CosmosDBResourceNode) => openInPortal(node));
	initAsyncCommand(context, 'cosmosDB.copyConnectionString', (node: CosmosDBResourceNode) => copyConnectionString(node));

	vscode.window.setStatusBarMessage('Mongo: Not connected');
	initAsyncCommand(context, 'cosmosDB.connectMongoDB', (element: MongoDatabaseNode) => connectToDatabase(element));
	initAsyncCommand(context, 'cosmosDB.deleteMongoDB', (element: MongoDatabaseNode) => deleteDatabase(element));
	initAsyncCommand(context, 'cosmosDB.deleteDocDBDatabase', (element: DocDBDatabaseNode) => DocDBCommands.deleteDocDBDatabase(element, explorer));
	initAsyncCommand(context, 'cosmosDB.deleteDocDBCollection', (element: DocDBCollectionNode) => DocDBCommands.deleteDocDBCollection(element, explorer));
	initAsyncCommand(context, 'cosmosDB.deleteDocDBDocument', (element: DocDBDocumentNode) => DocDBCommands.deleteDocDBDocument(element, explorer));
	initCommand(context, 'cosmosDB.newMongoScrapbook', () => createScrapbook());
	initAsyncCommand(context, 'cosmosDB.executeMongoCommand', async () => lastCommand = await MongoCommands.executeCommandFromActiveEditor(connectedDb));
	initAsyncCommand(context, 'cosmosDB.update', () => updateConditionally());
	initAsyncCommand(context, 'cosmosDB.openMongoDocument', async (document: MongoDocumentNode) => {
		const canProceed: boolean = await proceedAfterDocumentChange();
		if (canProceed) {
			connectToDatabase(document.collection.db);
			lastCommand = MongoCommands.getCommand(`db.${document.collection.label}.find()`);
			await util.showResult(JSON.stringify(document.data, null, 2), 'document');
			lastOpenedMongoDocument = document;
			lastOpenedDocumentType = DocumentType.Mongo;
		}
	});

	initCommand(context, 'cosmosDB.launchMongoShell', () => launchMongoShell());
	initAsyncCommand(context, 'cosmosDB.openDocDBDocument', async (document: DocDBDocumentNode) => {
		const canProceed: boolean = await proceedAfterDocumentChange();
		if (canProceed) {
			lastOpenedDocDBDocument = document;
			await util.showResult(JSON.stringify(document.data, null, 2), 'document.json');
			lastOpenedDocumentType = DocumentType.DocDB;
		}
	});
}

function initCommand(context: vscode.ExtensionContext, commandId: string, callback: (...args: any[]) => any) {
	initAsyncCommand(context, commandId, (...args: any[]) => Promise.resolve(callback(...args)));
}

function initAsyncCommand(context: vscode.ExtensionContext, commandId: string, callback: (...args: any[]) => Promise<any>) {
	context.subscriptions.push(vscode.commands.registerCommand(commandId, async (...args: any[]) => {
		const start = Date.now();
		let result = 'Succeeded';
		let errorData: string = '';

		try {
			await callback(...args);
		} catch (err) {
			result = 'Failed';
			errorData = util.errToString(err);
			if (err instanceof Error) {
				vscode.window.showErrorMessage(err.message);
			}
			else if (typeof err === "string") {
				vscode.window.showErrorMessage(err);
			}
		} finally {
			const end = Date.now();
			util.sendTelemetry(commandId, { result: result, error: errorData }, { duration: (end - start) / 1000 });
		}
	}));
}

async function updateConditionally(): Promise<void> {
	if (lastOpenedDocumentType === DocumentType.Mongo) {
		await MongoCommands.updateDocuments(connectedDb, lastCommand, lastOpenedMongoDocument);
	}
	else if (lastOpenedDocumentType === DocumentType.DocDB) {
		await DocDBCommands.updateDocDBDocument(lastOpenedDocDBDocument);
	}
}

async function proceedAfterDocumentChange(): Promise<boolean> {
	let oldDocument, newDocument;
	if (lastOpenedDocumentType === undefined) {
		return true;
	}
	try {
		const recentDoc = (lastOpenedDocumentType === DocumentType.DocDB) ? lastOpenedDocDBDocument : lastOpenedMongoDocument;
		oldDocument = recentDoc.data;
		const editor = vscode.window.activeTextEditor;
		newDocument = parse(editor.document.getText());
	}
	catch {
		return true;
	}
	if (!_.isMatch(oldDocument, newDocument)) {
		const confirmed = await vscode.window.showWarningMessage("You may have made changes to the document since the last update. Update again?", "Yes", "No");
		if (!confirmed) {
			return false;
		}
		if (confirmed === "Yes") {
			await updateConditionally();
			return true;
		}
		if (confirmed === "No") {
			return true;
		}
	}
	return true;
}
function createScrapbook(): Thenable<void> {
	return new Promise(() => {
		let uri: vscode.Uri = null;
		let count = 1;
		const max = 99999;
		if (vscode.workspace.workspaceFolders) {
			while (count < max) {
				uri = vscode.Uri.file(path.join(vscode.workspace.rootPath, `Scrapbook-${count}.mongo`));
				if (!vscode.workspace.textDocuments.find(doc => doc.uri.fsPath === uri.fsPath) && !fs.existsSync(uri.fsPath)) {
					break;
				}
				count++;
			}
			if (count === max) {
				vscode.window.showErrorMessage('Could not create new scrapbook.');
				return;
			}
			uri = uri.with({ scheme: 'untitled' });
			vscode.workspace.openTextDocument(uri).then(textDocument => vscode.window.showTextDocument(textDocument));
		}
		else {
			vscode.workspace.openTextDocument({ language: 'mongo' }).then(textDocument => vscode.window.showTextDocument(textDocument));
		}

	});
}

async function attachMongoServer() {
	const result = await vscode.window.showInputBox({
		placeHolder: 'mongodb://host:port',
		ignoreFocusOut: true
	});
	if (result) {
		const insertedNode = await explorer.attachedServersNode.attach(result);
		if (insertedNode) {
			explorer.refresh(explorer.attachedServersNode);
		}
	}
}

async function createMongoDatabase(server: IMongoServer) {
	const databaseName = await vscode.window.showInputBox({ placeHolder: 'Database Name' });
	if (databaseName) {
		const collectionName = await vscode.window.showInputBox({
			placeHolder: 'Collection Name',
			prompt: 'A collection is required to create a database',
			ignoreFocusOut: true
		});
		if (collectionName) {
			const databaseNode = new MongoDatabaseNode(databaseName, server);
			await databaseNode.createCollection(collectionName);
			explorer.refresh(server);
			connectToDatabase(databaseNode);
		}
	}
}


function openInPortal(node: CosmosDBResourceNode) {
	if (node) {
		const portalLink = `https://portal.azure.com/${node.tenantId}/#resource${node.id}`;
		opn(portalLink);
	}
}

async function copyConnectionString(node: IMongoServer) {
	if (node) {
		const connectionString = await node.getConnectionString();
		copypaste.copy(connectionString);
	}
}

async function removeMongoServer(node: INode) {
	const deletedNodes = await explorer.attachedServersNode.remove(node);
	if (deletedNodes) {
		explorer.refresh(explorer.attachedServersNode);
	}
}

async function deleteDatabase(database: MongoDatabaseNode): Promise<void> {
	if (database) {
		const confirmed = await vscode.window.showWarningMessage(`Are you sure you want to delete database '${database.id}' and its collections?`, "Yes");
		if (confirmed === "Yes") {
			if (connectedDb && connectedDb.server.id === database.server.id && connectedDb.id === database.id) {
				connectedDb = null;
				languageClient.disconnect();
				vscode.window.setStatusBarMessage('Mongo: Not connected');
			}
			database.drop();
			explorer.refresh(database.server);
		}
	}
}

async function connectToDatabase(database: MongoDatabaseNode) {
	if (database) {
		connectedDb = database;
		languageClient.connect(database);
		vscode.window.setStatusBarMessage('Mongo: ' + database.server.label + '/' + connectedDb.id);
	}
}

function launchMongoShell() {
	const terminal: vscode.Terminal = vscode.window.createTerminal('Mongo Shell');
	terminal.sendText(`mongo`);
	terminal.show();
}

// this method is called when your extension is deactivated
export function deactivate() {
}