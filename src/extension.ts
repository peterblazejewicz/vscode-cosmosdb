/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as copypaste from 'copy-paste';
import * as opn from 'opn';
import * as util from "./util";

import { AzureAccount, AzureSession } from './azure-account.api';
import { CosmosDBCommands } from './commands';
import { CosmosDBExplorer } from './explorer';
import { MongoCommands } from './mongo/commands';
import { IMongoServer, MongoDatabaseNode, MongoCommand, MongoCollectionNode } from './mongo/nodes';
import { DocDBDatabaseNode, DocDBCollectionNode } from './docdb/nodes';
import { CosmosDBResourceNode, INode } from './nodes'
import MongoDBLanguageClient from './mongo/languageClient';
import { Reporter } from './telemetry';
import { DocumentClient } from 'documentdb';

let connectedDb: MongoDatabaseNode = null;
let languageClient: MongoDBLanguageClient = null;
let explorer: CosmosDBExplorer;
let lastCommand: MongoCommand;
let documentDBClient: DocumentClient = null;

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
	initAsyncCommand(context, 'cosmosDB.createDocDBDatabase', (node: CosmosDBResourceNode) => createDocDBDatabase(node));
	initAsyncCommand(context, 'cosmosDB.createDocDBCollection', (node: DocDBDatabaseNode) => createDocDBCollection(node));
	initCommand(context, 'cosmosDB.openInPortal', (node: CosmosDBResourceNode) => openInPortal(node));
	initAsyncCommand(context, 'cosmosDB.copyConnectionString', (node: CosmosDBResourceNode) => copyConnectionString(node));

	vscode.window.setStatusBarMessage('Mongo: Not connected');
	initAsyncCommand(context, 'cosmosDB.connectMongoDB', (element: MongoDatabaseNode) => connectToDatabase(element));
	initCommand(context, 'cosmosDB.dropMongoDB', (element: MongoDatabaseNode) => dropDatabase(element));
	initAsyncCommand(context, 'cosmosDB.dropDocDBDatabase', (element: DocDBDatabaseNode) => dropDocDBDatabase(element));
	initAsyncCommand(context, 'cosmosDB.dropDocDBCollection', (element: DocDBCollectionNode) => dropDocDBCollection(element));
	initCommand(context, 'cosmosDB.newMongoScrapbook', () => createScrapbook());
	initCommand(context, 'cosmosDB.executeMongoCommand', () => lastCommand = MongoCommands.executeCommandFromActiveEditor(connectedDb));
	initCommand(context, 'cosmosDB.updateMongoDocuments', () => MongoCommands.updateDocuments(connectedDb, lastCommand));
	initCommand(context, 'cosmosDB.openMongoCollection', (collection: MongoCollectionNode) => {
		connectToDatabase(collection.db);
		lastCommand = MongoCommands.getCommand(`db.${collection.label}.find()`);
		MongoCommands.executeCommand(lastCommand, connectedDb).then(result => util.showResult(result));
	});

	initCommand(context, 'cosmosDB.launchMongoShell', () => launchMongoShell());
	initAsyncCommand(context, 'cosmosDB.openDocDBCollection', async (collection: DocDBCollectionNode) => {
		util.showResult(JSON.stringify(await collection.getDocuments(), null, 2));
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
			throw err;
		} finally {
			const end = Date.now();
			util.sendTelemetry(commandId, { result: result, error: errorData }, { duration: (end - start) / 1000 });
		}
	}));
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
	const result = await vscode.window.showInputBox({ placeHolder: 'mongodb://host:port' });
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
			prompt: 'A collection is required to create a database'
		});
		if (collectionName) {
			const databaseNode = new MongoDatabaseNode(databaseName, server);
			await databaseNode.createCollection(collectionName);
			explorer.refresh(server);
			connectToDatabase(databaseNode);
		}
	}
}

async function createDocDBDatabase(server: CosmosDBResourceNode) {
	const databaseName = await vscode.window.showInputBox({
		placeHolder: 'Database Name',
		ignoreFocusOut: true
	});
	if (databaseName) {
		const masterKey = await server.getPrimaryMasterKey();
		const endpoint = await server.getEndpoint();
		let client = new DocumentClient(endpoint, { masterKey: masterKey });
		client.createDatabase({ id: databaseName }, function (err, created) {
			if (!err) {
				vscode.window.showInformationMessage("Created a db with name " + databaseName);
			} else {
				vscode.window.showErrorMessage(err);
				console.log(err.body);
			}
			explorer.refresh(server);
		}
		);
	}
}

async function createDocDBCollection(db: DocDBDatabaseNode) {
	const collectionName = await vscode.window.showInputBox({
		placeHolder: 'Collection Name',
		ignoreFocusOut: true
	});
	if (collectionName) {
		let masterKey = db.getPrimaryMasterKey();
		let endpoint = db.getEndpoint();
		let options = {};
		let partitionKey: string = await vscode.window.showInputBox({
			prompt: 'Partition Key: Choose a JSON property name that will possibly have a wide range of values',
			ignoreFocusOut: true,
			validateInput: validatePartitionKey
		});
		if (partitionKey) {
			let throughput: number = Number(await vscode.window.showInputBox({
				value: '10000',
				ignoreFocusOut: true,
				prompt: 'Initial throughput capacity, between 2500 and 100,000',
				validateInput: validateThroughput
			}));
			if (throughput) {
				let client = new DocumentClient(await endpoint, { masterKey: await masterKey });
				let options = { offerThroughput: throughput };
				let collectionDef = { id: collectionName, partitionKey: { paths: [partitionKey] } };
				client.createCollection(db.getDbLink(), collectionDef, options, async function (err, created) {
					if (!err) {
						await vscode.window.showInformationMessage("Created a collection with name " + collectionName);
					} else {
						vscode.window.showErrorMessage(err);
						console.log(err.body);
					}
					explorer.refresh(db);
				}
				);
			}
		}
	}
}

async function dropDocDBDatabase(db: DocDBDatabaseNode): Promise<void> {
	let masterKey = db.getPrimaryMasterKey();
	let endpoint = db.getEndpoint();
	let client = new DocumentClient(await endpoint, { masterKey: await masterKey });
	let confirmed = await vscode.window.showInputBox({
		prompt: 'Are you sure to delete Database: ' + db.label + ', and its collections?',
		ignoreFocusOut: true
	});
	if (confirmed) {
		client.deleteDatabase(db.getDbLink(), async function (err) {
			err ? console.log(err) : await vscode.window.showInformationMessage('Database \'' + db.id + '\'deleted ');
			explorer.refresh(db.server);
		});
	}

}

async function dropDocDBCollection(coll: DocDBCollectionNode): Promise<void> {
	let masterKey = coll.db.getPrimaryMasterKey();
	let endpoint = coll.db.getEndpoint();
	let client = new DocumentClient(await endpoint, { masterKey: await masterKey });
	let collLink = coll.db.getDbLink() + '/colls/' + coll.id;
	let confirmed = await vscode.window.showInputBox({
		prompt: 'Are you sure to delete Collection: ' + coll.label + '?',
		ignoreFocusOut: true
	});
	if (confirmed) {

		client.deleteCollection(collLink, async function (err) {
			err ? console.log(err) : await vscode.window.showInformationMessage('Collection \'' + coll.id + '\'deleted ');
			explorer.refresh(coll.db);
		});
	}

}

function validateName(name: string): string | undefined | null {
	if (name.length < 1 || name.length > 255) {
		return "Name must be between 1 \& 255 characters long. "
	}
}

function validatePartitionKey(key: string): string | undefined | null {
	if (key[0] != '/') {
		return "Need a leading forward slash '/' in the partitionKey";
	} else if (/^[#?\\]*$/.test(key)) {
		return "Cannot contain these characters - ?,#,\\, etc."
	}
	return null;
}

function validateThroughput(input: string): string | undefined | null {
	try {
		let value = Number(input);
		if (value < 2500 || value > 100000) {
			return "Value needs to lie between 2500 and 100,000"
		}
	} catch (err) {
		return "Input must be a number"
	}
	return null;
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

function dropDatabase(database: MongoDatabaseNode): void {
	vscode.window.showInformationMessage('Are you sure you want to drop the database \'' + database.id + '\' and its collections?', { modal: true }, 'Drop')
		.then(result => {
			if (result === 'Drop') {
				if (connectedDb && connectedDb.server.id === database.server.id && connectedDb.id === database.id) {
					connectedDb = null;
					languageClient.disconnect();
					vscode.window.setStatusBarMessage('Mongo: Not connected');
				}
				database.drop();
				explorer.refresh(database.server);
			}
		})
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