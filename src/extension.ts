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


// -----------------------------------------------------------------------------
// actiavter
//
export function activate(context: vscode.ExtensionContext) {
	
	console.log('Congratulations, your extension "int2date" is now active!');

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
			if (value === undefined) { return; }
			let date = serialDateToDate(+value);
			if (date === undefined) { return; }
			vscode.window.showInformationMessage('result: ' + dateToStr(date));
		});
	});
	context.subscriptions.push(convertCommand);

	//
	// hover[xml]: hover converted result
	//
	let convertHover = {provideHover(doc: vscode.TextDocument, pos: vscode.Position) {
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
		let date = serialDateToDate(serialDate);
		if (date === undefined) { return Promise.reject("Fail to parse " + serialDate + " as a serial date."); }

		// return value
		return Promise.resolve(new vscode.Hover('as date: ' + dateToStr(date)));
	}};
	context.subscriptions.push(vscode.languages.registerHoverProvider(
		{language: 'xml'}, 
		convertHover
	));
}

// -----------------------------------------------------------------------------
// deactiavter
//
export function deactivate() {}
