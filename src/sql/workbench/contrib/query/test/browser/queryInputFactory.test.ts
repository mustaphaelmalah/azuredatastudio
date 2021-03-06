/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { TestEditorService } from 'vs/workbench/test/browser/workbenchTestServices';
import { URI } from 'vs/base/common/uri';
import { IEditorService } from 'vs/workbench/services/editor/common/editorService';
import { IEditorInput } from 'vs/workbench/common/editor';
import { FileEditorInput } from 'vs/workbench/contrib/files/common/editors/fileEditorInput';
import { workbenchInstantiationService } from 'sql/workbench/test/workbenchTestServices';
import { QueryEditorLanguageAssociation } from 'sql/workbench/contrib/query/browser/queryInputFactory';
import { IObjectExplorerService } from 'sql/workbench/services/objectExplorer/browser/objectExplorerService';
import { ConnectionProfile } from 'sql/platform/connection/common/connectionProfile';
import { TestObjectExplorerService } from 'sql/workbench/services/objectExplorer/test/browser/testObjectExplorerService';
import { TestConnectionManagementService } from 'sql/platform/connection/test/common/testConnectionManagementService';
import { IConnectionProfile } from 'sql/platform/connection/common/interfaces';
import { IConnectionManagementService, IConnectionCompletionOptions, IConnectionCallbacks, IConnectionResult } from 'sql/platform/connection/common/connectionManagement';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { UntitledQueryEditorInput } from 'sql/workbench/common/editor/query/untitledQueryEditorInput';
import { UntitledTextEditorInput } from 'vs/workbench/services/untitled/common/untitledTextEditorInput';
import { IUntitledTextEditorService } from 'vs/workbench/services/untitled/common/untitledTextEditorService';
import { isThenable } from 'vs/base/common/async';

suite('Query Input Factory', () => {

	test('sync query editor input is connected if global connection exists (OE)', () => {
		const editorService = new MockEditorService();
		const instantiationService = workbenchInstantiationService();
		const connectionManagementService = new MockConnectionManagementService();
		instantiationService.stub(IObjectExplorerService, new MockObjectExplorerService());
		instantiationService.stub(IConnectionManagementService, connectionManagementService);
		instantiationService.stub(IEditorService, editorService);
		const queryEditorLanguageAssociation = instantiationService.createInstance(QueryEditorLanguageAssociation);
		const input = instantiationService.createInstance(FileEditorInput, URI.file('/test/file.sql'), undefined, undefined);
		queryEditorLanguageAssociation.convertInput(input);
		assert(connectionManagementService.numberConnects === 1, 'Convert input should have called connect when active OE connection exists');
	});

	test('query editor input is connected if global connection exists (OE)', async () => {
		const editorService = new MockEditorService();
		const instantiationService = workbenchInstantiationService();
		const connectionManagementService = new MockConnectionManagementService();
		instantiationService.stub(IObjectExplorerService, new MockObjectExplorerService());
		instantiationService.stub(IConnectionManagementService, connectionManagementService);
		instantiationService.stub(IEditorService, editorService);
		const queryEditorLanguageAssociation = instantiationService.createInstance(QueryEditorLanguageAssociation);
		const input = instantiationService.createInstance(FileEditorInput, URI.file('/test/file.sql'), undefined, undefined);
		const response = queryEditorLanguageAssociation.convertInput(input);
		assert(isThenable(response));
		await response;
		assert(connectionManagementService.numberConnects === 1, 'Convert input should have called connect when active OE connection exists');
	});

	test('sync query editor input is connected if global connection exists (Editor)', () => {
		const instantiationService = workbenchInstantiationService();
		const editorService = new MockEditorService(instantiationService);
		const connectionManagementService = new MockConnectionManagementService();
		instantiationService.stub(IObjectExplorerService, new MockObjectExplorerService());
		instantiationService.stub(IConnectionManagementService, connectionManagementService);
		instantiationService.stub(IEditorService, editorService);
		const queryEditorLanguageAssociation = instantiationService.createInstance(QueryEditorLanguageAssociation);
		const input = instantiationService.createInstance(FileEditorInput, URI.file('/test/file.sql'), undefined, undefined);
		queryEditorLanguageAssociation.convertInput(input);
		assert(connectionManagementService.numberConnects === 1, 'Convert input should have called connect when active editor connection exists');
	});

	test('query editor input is connected if global connection exists (Editor)', async () => {
		const instantiationService = workbenchInstantiationService();
		const editorService = new MockEditorService(instantiationService);
		const connectionManagementService = new MockConnectionManagementService();
		instantiationService.stub(IObjectExplorerService, new MockObjectExplorerService());
		instantiationService.stub(IConnectionManagementService, connectionManagementService);
		instantiationService.stub(IEditorService, editorService);
		const queryEditorLanguageAssociation = instantiationService.createInstance(QueryEditorLanguageAssociation);
		const input = instantiationService.createInstance(FileEditorInput, URI.file('/test/file.sql'), undefined, undefined);
		const response = queryEditorLanguageAssociation.convertInput(input);
		assert(isThenable(response));
		await response;
		assert(connectionManagementService.numberConnects === 1, 'Convert input should have called connect when active editor connection exists');
	});

	test('sync query editor input is not connected if no global connection exists', () => {
		const instantiationService = workbenchInstantiationService();
		const editorService = new MockEditorService();
		const connectionManagementService = new MockConnectionManagementService();
		instantiationService.stub(IConnectionManagementService, connectionManagementService);
		instantiationService.stub(IEditorService, editorService);
		const queryEditorLanguageAssociation = instantiationService.createInstance(QueryEditorLanguageAssociation);
		const input = instantiationService.createInstance(FileEditorInput, URI.file('/test/file.sql'), undefined, undefined);
		queryEditorLanguageAssociation.syncConvertinput(input);
		assert(connectionManagementService.numberConnects === 0, 'Convert input should not have been called connect when no global connections exist');
	});

	test('async query editor input is not connected if no global connection exists', async () => {
		const instantiationService = workbenchInstantiationService();
		const editorService = new MockEditorService();
		const connectionManagementService = new MockConnectionManagementService();
		instantiationService.stub(IConnectionManagementService, connectionManagementService);
		instantiationService.stub(IEditorService, editorService);
		const queryEditorLanguageAssociation = instantiationService.createInstance(QueryEditorLanguageAssociation);
		const input = instantiationService.createInstance(FileEditorInput, URI.file('/test/file.sql'), undefined, undefined);
		const response = queryEditorLanguageAssociation.convertInput(input);
		assert(isThenable(response));
		await response;
		assert(connectionManagementService.numberConnects === 0, 'Convert input should not have been called connect when no global connections exist');
	});

});

class ServiceAccessor {
	constructor(
		@IUntitledTextEditorService public readonly untitledTextEditorService: IUntitledTextEditorService
	) { }
}

class MockEditorService extends TestEditorService {
	public readonly activeEditor: IEditorInput | undefined = undefined;

	constructor(instantiationService?: IInstantiationService) {
		super();
		if (instantiationService) {
			const workbenchinstantiationService = workbenchInstantiationService();
			const accessor = workbenchinstantiationService.createInstance(ServiceAccessor);
			const service = accessor.untitledTextEditorService;
			const untitledInput = instantiationService.createInstance(UntitledTextEditorInput, service.create({ associatedResource: URI.file('/test/file') }));
			this.activeEditor = instantiationService.createInstance(UntitledQueryEditorInput, '', untitledInput, undefined);
		}
	}
}

class MockObjectExplorerService extends TestObjectExplorerService {
	public getSelectedProfileAndDatabase(): { profile: ConnectionProfile, databaseName: string } {
		return {
			profile: <ConnectionProfile>{}, // Not actually used so fine to cast
			databaseName: ''
		};
	}

	public isFocused(): boolean {
		return true;
	}
}

class MockConnectionManagementService extends TestConnectionManagementService {

	public numberConnects = 0;

	public isProfileConnected(connectionProfile: IConnectionProfile): boolean {
		return true;
	}

	public connect(connection: IConnectionProfile, uri: string, options?: IConnectionCompletionOptions, callbacks?: IConnectionCallbacks): Promise<IConnectionResult> {
		this.numberConnects++;
		return Promise.resolve(undefined);
	}

	public getConnectionProfile(fileUri: string): IConnectionProfile {
		return <IConnectionProfile>{}; // Not actually used so fine to cast
	}
}
