/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { DocumentClient, QueryIterator, QueryError, FeedOptions } from 'documentdb';
import { IAzureParentTreeItem, IAzureTreeItem, IAzureNode } from 'vscode-azureextensionui';
import { DefaultBatchSize } from '../../constants';

/**
 * This class provides common iteration logic for DocumentDB accounts, databases, and collections
 */
export abstract class DocDBTreeItemBase<T> implements IAzureParentTreeItem {
    public abstract readonly id: string;
    public abstract readonly label: string;
    public abstract readonly contextValue: string;
    public abstract readonly childTypeLabel: string;

    public readonly documentEndpoint: string;
    public readonly masterKey: string;

    private _hasMoreChildren: boolean = true;
    private _iterator: QueryIterator<T> | undefined;

    constructor(documentEndpoint: string, masterKey: string) {
        this.documentEndpoint = documentEndpoint;
        this.masterKey = masterKey;
    }

    public hasMoreChildren(): boolean {
        return this._hasMoreChildren;
    }

    public getDocumentClient(): DocumentClient {
        return new DocumentClient(this.documentEndpoint, { masterKey: this.masterKey });
    }

    public abstract initChild(resource: T): IAzureTreeItem;

    public abstract getIterator(client: DocumentClient, feedOptions: FeedOptions): Promise<QueryIterator<T>>;

    public async loadMoreChildren(_node: IAzureNode, clearCache: boolean): Promise<IAzureTreeItem[]> {
        if (clearCache || this._iterator === undefined) {
            this._hasMoreChildren = true;
            const client = this.getDocumentClient();
            this._iterator = await this.getIterator(client, { maxItemCount: DefaultBatchSize });
        }

        const resources: T[] = [];
        let count: number = 0;
        while (count < DefaultBatchSize) {
            const resource: T | undefined = await new Promise<T | undefined>((resolve, reject) => {
                this._iterator.nextItem((error: QueryError, resource: T | undefined) => {
                    error ? reject(error) : resolve(resource);
                });
            });
            if (resource === undefined) {
                this._hasMoreChildren = false;
                break;
            } else {
                resources.push(resource);
                count += 1;
            }
        }

        return resources.map((resource: T) => this.initChild(resource));
    }
}
