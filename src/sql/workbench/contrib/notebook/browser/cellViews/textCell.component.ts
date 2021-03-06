/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import 'vs/css!./textCell';
import 'vs/css!./media/markdown';
import 'vs/css!./media/highlight';

import { OnInit, Component, Input, Inject, forwardRef, ElementRef, ChangeDetectorRef, ViewChild, OnChanges, SimpleChange, HostListener, ViewChildren, QueryList } from '@angular/core';

import { localize } from 'vs/nls';
import { IWorkbenchThemeService } from 'vs/workbench/services/themes/common/workbenchThemeService';
import * as themeColors from 'vs/workbench/common/theme';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { Emitter } from 'vs/base/common/event';
import { URI } from 'vs/base/common/uri';
import * as DOM from 'vs/base/browser/dom';

import { toDisposable } from 'vs/base/common/lifecycle';
import { IMarkdownRenderResult } from 'vs/editor/contrib/markdown/markdownRenderer';
import { NotebookMarkdownRenderer } from 'sql/workbench/contrib/notebook/browser/outputs/notebookMarkdown';
import { CellView } from 'sql/workbench/contrib/notebook/browser/cellViews/interfaces';
import { ICellModel } from 'sql/workbench/services/notebook/browser/models/modelInterfaces';
import { NotebookModel } from 'sql/workbench/services/notebook/browser/models/notebookModel';
import { ISanitizer, defaultSanitizer } from 'sql/workbench/services/notebook/browser/outputs/sanitizer';
import { CellToggleMoreActions } from 'sql/workbench/contrib/notebook/browser/cellToggleMoreActions';
import { CodeComponent } from 'sql/workbench/contrib/notebook/browser/cellViews/code.component';
import { BaseTextEditor } from 'vs/workbench/browser/parts/editor/textEditor';
import { NotebookRange } from 'sql/workbench/services/notebook/browser/notebookService';
import { IColorTheme } from 'vs/platform/theme/common/themeService';

export const TEXT_SELECTOR: string = 'text-cell-component';
const USER_SELECT_CLASS = 'actionselect';


@Component({
	selector: TEXT_SELECTOR,
	templateUrl: decodeURI(require.toUrl('./textCell.component.html'))
})
export class TextCellComponent extends CellView implements OnInit, OnChanges {
	@ViewChild('preview', { read: ElementRef }) private output: ElementRef;
	@ViewChild('moreactions', { read: ElementRef }) private moreActionsElementRef: ElementRef;
	@ViewChildren(CodeComponent) private markdowncodeCell: QueryList<CodeComponent>;

	@Input() cellModel: ICellModel;

	@Input() set model(value: NotebookModel) {
		this._model = value;
	}

	@Input() set activeCellId(value: string) {
		this._activeCellId = value;
	}

	@Input() set hover(value: boolean) {
		this._hover = value;
		if (!this.isActive()) {
			// Only make a change if we're not active, since this has priority
			this.updateMoreActions();
		}
	}

	@HostListener('document:keydown.escape', ['$event'])
	handleKeyboardEvent() {
		if (this.isEditMode) {
			this.toggleEditMode(false);
		}
		this.cellModel.active = false;
		this._model.updateActiveCell(undefined);
	}

	@HostListener('document:keydown.meta.a', ['$event'])
	onkeydown(e) {
		// use preventDefault() to avoid invoking the editor's select all
		// select the active .
		e.preventDefault();
		document.execCommand('selectAll');
	}

	private _content: string | string[];
	private _lastTrustedMode: boolean;
	private isEditMode: boolean;
	private _sanitizer: ISanitizer;
	private _model: NotebookModel;
	private _activeCellId: string;
	private readonly _onDidClickLink = this._register(new Emitter<URI>());
	public readonly onDidClickLink = this._onDidClickLink.event;
	private _cellToggleMoreActions: CellToggleMoreActions;
	private _hover: boolean;
	private markdownRenderer: NotebookMarkdownRenderer;
	private markdownResult: IMarkdownRenderResult;

	constructor(
		@Inject(forwardRef(() => ChangeDetectorRef)) private _changeRef: ChangeDetectorRef,
		@Inject(IInstantiationService) private _instantiationService: IInstantiationService,
		@Inject(IWorkbenchThemeService) private themeService: IWorkbenchThemeService,
	) {
		super();
		this.isEditMode = true;
		this._cellToggleMoreActions = this._instantiationService.createInstance(CellToggleMoreActions);
		this.markdownRenderer = this._instantiationService.createInstance(NotebookMarkdownRenderer);
		this._register(toDisposable(() => {
			if (this.markdownResult) {
				this.markdownResult.dispose();
			}
		}));
	}

	//Gets sanitizer from ISanitizer interface
	private get sanitizer(): ISanitizer {
		if (this._sanitizer) {
			return this._sanitizer;
		}
		return this._sanitizer = defaultSanitizer;
	}

	get model(): NotebookModel {
		return this._model;
	}

	get activeCellId(): string {
		return this._activeCellId;
	}
	/**
	 * Returns the code editor of makrdown cell in edit mode.
	 */
	getEditor(): BaseTextEditor | undefined {
		if (this.markdowncodeCell.length > 0) {
			return this.markdowncodeCell.first.getEditor();
		}
		return undefined;
	}

	private setLoading(isLoading: boolean): void {
		this.cellModel.loaded = !isLoading;
		this._changeRef.detectChanges();
	}

	ngOnInit() {
		this._register(this.themeService.onDidColorThemeChange(this.updateTheme, this));
		this.updateTheme(this.themeService.getColorTheme());
		this._cellToggleMoreActions.onInit(this.moreActionsElementRef, this.model, this.cellModel);
		this.setFocusAndScroll();
		this._register(this.cellModel.onOutputsChanged(e => {
			this.updatePreview();
		}));
	}

	ngOnChanges(changes: { [propKey: string]: SimpleChange }) {
		for (let propName in changes) {
			if (propName === 'activeCellId') {
				let changedProp = changes[propName];
				this._activeCellId = changedProp.currentValue;
				this.toggleUserSelect(this.isActive());
				// If the activeCellId is undefined (i.e. in an active cell update), don't unnecessarily set editMode to false;
				// it will be set to true in a subsequent call to toggleEditMode()
				if (changedProp.previousValue !== undefined) {
					this.toggleEditMode(false);
				}
				break;
			}
		}
	}

	public cellGuid(): string {
		return this.cellModel.cellGuid;
	}

	public get isTrusted(): boolean {
		return this.model.trustedMode;
	}

	public get notebookUri(): URI {
		return this.model.notebookUri;
	}

	/**
	 * Updates the preview of markdown component with latest changes
	 * If content is empty and in non-edit mode, default it to 'Double-click to edit'
	 * Sanitizes the data to be shown in markdown cell
	 */
	private updatePreview(): void {
		let trustedChanged = this.cellModel && this._lastTrustedMode !== this.cellModel.trustedMode;
		let cellModelSourceJoined = Array.isArray(this.cellModel.source) ? this.cellModel.source.join('') : this.cellModel.source;
		let contentJoined = Array.isArray(this._content) ? this._content.join('') : this._content;
		let contentChanged = contentJoined !== cellModelSourceJoined || cellModelSourceJoined.length === 0;
		if (trustedChanged || contentChanged) {
			this._lastTrustedMode = this.cellModel.trustedMode;
			if ((!cellModelSourceJoined) && !this.isEditMode) {
				this._content = localize('doubleClickEdit', "Double-click to edit");
			} else {
				this._content = this.cellModel.source;
			}

			this.markdownRenderer.setNotebookURI(this.cellModel.notebookModel.notebookUri);
			this.markdownResult = this.markdownRenderer.render({
				isTrusted: true,
				value: Array.isArray(this._content) ? this._content.join('') : this._content
			});
			this.markdownResult.element.innerHTML = this.sanitizeContent(this.markdownResult.element.innerHTML);
			this.setLoading(false);
			let outputElement = <HTMLElement>this.output.nativeElement;
			outputElement.innerHTML = this.markdownResult.element.innerHTML;
			this.cellModel.renderedOutputTextContent = this.getRenderedTextOutput();
		}
	}

	//Sanitizes the content based on trusted mode of Cell Model
	private sanitizeContent(content: string): string {
		if (this.cellModel && !this.cellModel.trustedMode) {
			content = this.sanitizer.sanitize(content);
		}
		return content;
	}

	// Todo: implement layout
	public layout() {
	}

	private updateTheme(theme: IColorTheme): void {
		let outputElement = <HTMLElement>this.output.nativeElement;
		outputElement.style.borderTopColor = theme.getColor(themeColors.SIDE_BAR_BACKGROUND, true).toString();

		let moreActionsEl = <HTMLElement>this.moreActionsElementRef.nativeElement;
		moreActionsEl.style.borderRightColor = theme.getColor(themeColors.SIDE_BAR_BACKGROUND, true).toString();
	}

	public handleContentChanged(): void {
		this.updatePreview();
	}

	public toggleEditMode(editMode?: boolean): void {
		this.isEditMode = editMode !== undefined ? editMode : !this.isEditMode;
		this.updateMoreActions();
		this.updatePreview();
		this._changeRef.detectChanges();
	}

	private updateMoreActions(): void {
		if (!this.isEditMode && (this.isActive() || this._hover)) {
			this.toggleMoreActionsButton(true);
		}
		else {
			this.toggleMoreActionsButton(false);
		}
	}

	private toggleUserSelect(userSelect: boolean): void {
		if (!this.output) {
			return;
		}
		if (userSelect) {
			DOM.addClass(this.output.nativeElement, USER_SELECT_CLASS);
		} else {
			DOM.removeClass(this.output.nativeElement, USER_SELECT_CLASS);
		}
	}

	private setFocusAndScroll(): void {
		this.toggleEditMode(this.isActive());

		if (this.output && this.output.nativeElement) {
			(<HTMLElement>this.output.nativeElement).scrollTo({ behavior: 'smooth' });
		}
	}

	protected isActive() {
		return this.cellModel && this.cellModel.id === this.activeCellId;
	}

	protected toggleMoreActionsButton(isActiveOrHovered: boolean) {
		this._cellToggleMoreActions.toggleVisible(!isActiveOrHovered);
	}

	public deltaDecorations(newDecorationRange: NotebookRange, oldDecorationRange: NotebookRange): void {
		if (oldDecorationRange) {
			this.removeDecoration(oldDecorationRange);
		}

		if (newDecorationRange) {
			this.addDecoration(newDecorationRange);
		}
	}

	private addDecoration(range: NotebookRange): void {
		if (range && this.output && this.output.nativeElement) {
			let children = this.getHtmlElements();
			let ele = children[range.startLineNumber - 1];
			if (ele) {
				DOM.addClass(ele, 'rangeHighlight');
				ele.scrollIntoView({ behavior: 'smooth' });
			}
		}
	}

	private removeDecoration(range: NotebookRange): void {
		if (range && this.output && this.output.nativeElement) {
			let children = this.getHtmlElements();
			let ele = children[range.startLineNumber - 1];
			if (ele) {
				DOM.removeClass(ele, 'rangeHighlight');
			}
		}
	}

	private getHtmlElements(): any[] {
		let hostElem = this.output.nativeElement;
		let children = [];
		for (let element of hostElem.children) {
			if (element.nodeName.toLowerCase() === 'table') {
				// add table header and table rows.
				children.push(element.children[0]);
				for (let trow of element.children[1].children) {
					children.push(trow);
				}
			} else if (element.children.length > 1) {
				children = children.concat(this.getChildren(element));
			} else {
				children.push(element);
			}
		}
		return children;
	}

	private getChildren(parent: any): any[] {
		let children: any = [];
		if (parent.children.length > 1 && parent.nodeName.toLowerCase() !== 'li' && parent.nodeName.toLowerCase() !== 'p') {
			for (let child of parent.children) {
				children = children.concat(this.getChildren(child));
			}
		} else {
			return parent;
		}
		return children;
	}

	private getRenderedTextOutput(): string[] {
		let textOutput: string[] = [];
		let elements = this.getHtmlElements();
		elements.forEach(element => {
			if (element && element.innerText) {
				textOutput.push(element.innerText);
			} else {
				textOutput.push('');
			}
		});
		return textOutput;
	}
}
