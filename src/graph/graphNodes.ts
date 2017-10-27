/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as vscode from 'vscode';
import * as path from 'path';
import { Command } from 'vscode';
import { DocumentClient } from 'documentdb';
import gremlin = require('gremlin');
import { INode } from '../nodes';
import * as util from "./../util";
import { GraphView } from "./GraphView";

//asdf
// export interface IGraphServer extends INode {
// 	getPrimaryMasterKey(): string;
// 	getEndpoint(): string;
// }

// interface IResultsChannel {
// 	showResults(s: string);
// }

// class ResultsChannel implements IResultsChannel {
// 	private _graphViewer: GraphView;
// 	constructor(context: vscode.ExtensionContext) {
// 		this._graphViewer = new GraphView();
// 		this._graphViewer.activate(context);
// 	}

// 	showResults(s: string) {
// 		this._graphViewer.showResults(s);
// 	}
// }

export class GraphDatabaseNode implements INode {
	public readonly contextValue: string = "cosmosGraphDatabase";

	private _graphEndpoint: string;
	private _graphPort: number;

	// asdf pass in channel instead of context
	constructor(readonly id: string, private readonly _masterKey: string, private readonly _documentEndpoint: string, private readonly _graphView: GraphView, readonly server: INode) {
		this._parseEndpoint(_documentEndpoint);
	}

	private _parseEndpoint(documentEndpoint: string): void {
		// Document endpoint: https://<graphname>.documents.azure.com:443/
		// Gremlin endpoint: stephwegraph1.graphs.azure.com
		let [, address, , port] = this._documentEndpoint.match(/^[^:]+:\/\/([^:]+)(:([0-9]+))?\/?$/);
		this._graphEndpoint = address.replace(".documents.azure.com", ".graphs.azure.com");
		console.assert(this._graphEndpoint.match(/\.graphs\.azure\.com$/), "Unexpected endpoint format");
		this._graphPort = parseInt(port || "443");
		console.assert(this._graphPort > 0, "Unexpected port");
	}

	getMasterKey(): string {
		return this._masterKey;
	}

	get documentEndpoint(): string {
		return this._documentEndpoint;
	}

	get graphEndpoint(): string {
		return this._graphEndpoint;
	}

	get graphPort(): number {
		return this._graphPort;
	}

	get label(): string {
		return this.id + " (cosmosGraphDatabase)"; // asdf
	}

	//asdf
	// get resultsChannel(): IResultsChannel {
	// 	return this._resultsChannel;
	// }

	get graphView(): GraphView {
		return this._graphView;
	}

	get iconPath(): any {
		return {
			// asdf
			light: path.join(__filename, '..', '..', '..', '..', 'resources', 'icons', 'theme-agnostic', 'Azure Graph - database LARGE.svg'), //asdf
			dark: path.join(__filename, '..', '..', '..', '..', 'resources', 'icons', 'theme-agnostic', 'Azure Graph - database LARGE.svg')
		};
	}

	readonly collapsibleState = vscode.TreeItemCollapsibleState.Collapsed;

	public getGraphLink(): string {
		return 'dbs/' + this.id;
	}

	async getChildren(): Promise<INode[]> {
		const dbLink: string = this.getGraphLink();
		const parentNode = this;
		const client = new DocumentClient(this.documentEndpoint, { masterKey: this.getMasterKey() });
		let collections = await this.listCollections(dbLink, client);
		return collections.map(collection => new GraphNode(collection.id, parentNode));
	}

	private async listCollections(databaseLink, client): Promise<any> {
		let collections = await client.readCollections(databaseLink);
		return await new Promise<any[]>((resolve, reject) => {
			collections.toArray((err, cols: Array<Object>) => err ? reject(err) : resolve(cols));
		});
	}

}

export class GraphNode implements INode {

	readonly collapsibleState = vscode.TreeItemCollapsibleState.None;

	constructor(readonly id: string, readonly graphDBNode: GraphDatabaseNode) {
	}

	readonly contextValue: string = "cosmosGraph";

	get label(): string {
		this.read();
		return this.id + " cosmosGraph"; //asdf
	}

	get iconPath(): any {
		return {
			light: path.join(__filename, '..', '..', '..', '..', 'resources', 'icons', 'theme-agnostic', 'Azure DocumentDB - DocDB collections LARGE.svg'),
			dark: path.join(__filename, '..', '..', '..', '..', 'resources', 'icons', 'theme-agnostic', 'Azure DocumentDB - DocDB collections LARGE.svg'),
		};
	}

	getCollLink(): string {
		return this.graphDBNode.getGraphLink() + '/colls/' + this.id;
	}

	async getChildren(): Promise<INode[]> {
		return null;
	}

	private async read(): Promise<string> {
		const config = {
			endpoint: this.graphDBNode.graphEndpoint,
			primaryKey: this.graphDBNode.getMasterKey(),
			database: this.graphDBNode.id,
			collection: this.id
		};

		const client = gremlin.createClient(
			this.graphDBNode.graphPort,
			config.endpoint,
			{
				"session": false,
				"ssl": this.graphDBNode.graphPort === 443 || this.graphDBNode.graphPort === 8080,
				"user": `/dbs/${config.database}/colls/${config.collection}`,
				"password": config.primaryKey
			});

		let s: string;
		client.execute('g.V()', {}, (err, results) => {
			if (err) return console.error(err);
			console.log(results);
			console.log();
			s = JSON.stringify(results, null, 2);
			//util.showResult(s, "results.graphson");
			this.graphDBNode.graphView.showResults("id#1", "Gremlin results", s);
		});

		return Promise.resolve(s);
	}
}

//asdf
// export class DocDBDocumentNode implements INode {
// 	data: IDocDBDocumentSpec;
// 	constructor(readonly id: string, readonly collection: DocDBCollectionNode, payload: IDocDBDocumentSpec) {
// 		this.data = payload;
// 	}

// 	readonly contextValue: string = "cosmosDBDocument";

// 	get label(): string {
// 		return this.id;
// 	}

// 	getDocLink(): string {
// 		return this.collection.getCollLink() + '/docs/' + this.id;
// 	}

// 	get iconPath(): any {
// 		return {
// 			light: path.join(__filename, '..', '..', '..', '..', 'resources', 'icons', 'theme-agnostic', 'Azure DocumentDB - document 2 LARGE.svg'),
// 			dark: path.join(__filename, '..', '..', '..', '..', 'resources', 'icons', 'theme-agnostic', 'Azure DocumentDB - document 2 LARGE.svg'),
// 		};
// 	}
// 	readonly collapsibleState = vscode.TreeItemCollapsibleState.None;

// 	readonly command: Command = {
// 		command: 'cosmosDB.openDocDBDocument',
// 		arguments: [this],
// 		title: ''
// 	};
// }

