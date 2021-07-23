'use strict';
import * as vscode from 'vscode';

// -----------------------------------------------------------------------------
// implementations
//
function serialDateToDate(serialDate: number): Date|undefined {
	if (!Number.isInteger(serialDate)) {
		// serial number should be an integer.
		return;
	}
	if (serialDate < 2) {
		// serial date for 0 or 1 is not defined
		// because Date(1900, 1, 1) is the smallest date in JS.
		return;
	}
	return new Date(1900, 1, serialDate - 1);
}

function dateToStr(date: Date): string {
	return date.getFullYear() + '/' + date.getMonth() + '/' + date.getDate();
}

class Int2DateHoverProvider {
	readonly langId: string;
	active: boolean;
	
	constructor(langId: string) {
		this.langId = langId;
		this.active = true;
	}

	provideHover(doc: vscode.TextDocument, pos: vscode.Position) {
		if (!this.active) {
			return Promise.reject("This ");
		}

		// extract an integer
		let targetRange = doc.getWordRangeAtPosition(pos, /\d{1,5}/);		
		if (targetRange === undefined) {
			return Promise.reject("Target is not a serial date");
		}

		// to exclude too large integers.
		let overRange = doc.getWordRangeAtPosition(pos, /\d{6}/);
		if (overRange !== undefined && overRange.start.isEqual(targetRange.start)) {
			return Promise.reject("Target is not a serial date");
		}

		// convert to date
		let serialDate: number = +doc.lineAt(pos.line).text.slice(
			targetRange.start.character, 
			targetRange.end.character
		);
		vscode.extensions.getExtension
		let date = serialDateToDate(serialDate);
		if (date === undefined) {
			return Promise.reject("Fail to parse " + serialDate + " as a serial date."); 
		}

		// return value
		return Promise.resolve(
			new vscode.Hover(serialDate + ' as date: ' + dateToStr(date))
		);
	}
}

class Int2DataHoverProviderManager {
	providers: Array<Int2DateHoverProvider>;

	constructor() {
		this.providers = [];
	}

	providerIndexFor(langId: string): number {
		for (var i=0; i<this.providers.length; ++i) {
			if (this.providers[i].langId === langId) {
				return i;
			}
		}
		return -1;
	}

	isActiveLang(langId: string): boolean {
		let idx = this.providerIndexFor(langId);
		if (idx < 0) {
			return false;
		}
		return this.providers[idx].active;
	}

	dispose() {
		for (var i=0; i<this.providers.length; ++i) {
			this.providers[i].active = false;
		}
		this.providers.splice(0);
	}
}

function getDataHoverProviderManager(context: vscode.ExtensionContext):
	Int2DataHoverProviderManager
{
	var manager = undefined;
	for (var i=0; i<context.subscriptions.length; ++i) {
		if (context.subscriptions[i] instanceof Int2DataHoverProviderManager) {
			manager = context.subscriptions[i] as Int2DataHoverProviderManager;
			break;
		}
	}
	if (manager === undefined) {
		// no manager is found in context.subscriptions
		manager = new Int2DataHoverProviderManager();
		context.subscriptions.push(manager);
	}
	return manager;
}


// -----------------------------------------------------------------------------
// activater
//
export function activate(context: vscode.ExtensionContext) {
	var manager = getDataHoverProviderManager(context);
	//
	// command[int2date.convert]: convert a serial date into a date.
	//
	let convertCommand = vscode.commands.registerCommand('int2date.convert', () => {
		vscode.window.showInputBox({
			prompt: 'serialDate',
			validateInput: param => {
				return (param.match(/^\d{1,5}$/) !== null && 1 < +param)
					? undefined
					: "input: serial date (2~99999)"; 
			}
		}).then((value: string|undefined) => {
			if (value === undefined) {
				return;
			}
			let date = serialDateToDate(+value);
			if (date === undefined) {
				return;
			}
			vscode.window.showInformationMessage('result: ' + dateToStr(date));
		});
	});
	context.subscriptions.push(convertCommand);

	//
	// command[int2date.activateHover]: activate Int2DateHoverProvider on current lang.
	//
	let activateHover = vscode.commands.registerCommand('int2date.activateHover', () => {
		let langId = vscode.window.activeTextEditor?.document.languageId;
		if (langId === undefined) {
			return;
		}

		// check if it is already registered or not.
		if (manager.isActiveLang(langId)) {
			vscode.window.showInformationMessage('Int2Data: Hover is already activated on ' + langId);
			return;
		}

		// register
		let providerIdx = manager.providerIndexFor(langId);
		if (providerIdx < 0) {
			// provider is not managed by the manager. construct newly and register it.
			let provider = new Int2DateHoverProvider(langId);
			manager.providers.push(provider);
			context.subscriptions.push(vscode.languages.registerHoverProvider({language: langId}, provider));
		} else {
			// provider is already managed by the manager but is inactive.
			manager.providers[providerIdx].active = true;
		}
		vscode.window.showInformationMessage('Int2Date: Hover is activated on ' + langId);
	});
	context.subscriptions.push(activateHover);

	//
	// command[int2date.deactiveHover]: deactivate all Int2DateHoverProvider
	//
	let deactiveHover = vscode.commands.registerCommand('int2date.deactiveHover', () => {
		var langIds = [];
		for (var i=0; i<manager.providers.length; ++i) {
			let provider = manager.providers[i];
			if (provider.active) {
				langIds.push(provider.langId);
				provider.active = false;
			}
		}
		let msg = langIds.length === 0
			? 'Int2Date: No Int2Date hover was activated'
			: 'Int2Date: Deactivated hovers on [' + langIds.join(', ') + ']';
		vscode.window.showInformationMessage(msg);
	});
	context.subscriptions.push(deactiveHover);

	//
	// command[int2date.listUpActiveHoverList]: list up Int2DateHoverProvider 
	//
	let listUpActiveHoverList = vscode.commands.registerCommand('int2date.listUpActiveHoverList', () => {
		var activeLangIds = [];
		for (var i=0; i<manager.providers.length; ++i) {
			let provider = manager.providers[i];
			if (provider.active) {
				activeLangIds.push(provider.langId);
			}
		}
		let msg = activeLangIds.length === 0
			? 'Int2Date: No Int2Date hover is activated'
			: 'Int2Date: Int2Date hovers are active on [' + activeLangIds.join(', ') + ']';
		vscode.window.showInformationMessage(msg);
	});
	context.subscriptions.push(listUpActiveHoverList);
}

// -----------------------------------------------------------------------------
// deactivater
//
export function deactivate() {}
