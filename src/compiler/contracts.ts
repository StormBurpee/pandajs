import {Node, Program} from "estree";

export interface BaseNode {
    start: number;
    end: number;
    type: string;
    children?: TemplateNode[];

    [prop_name: string]: any
}

export interface Fragment extends BaseNode {
    type: 'Fragment';
    children: TemplateNode[];
}

export interface TextNode extends BaseNode {
    type: 'Text';
    data: string
}

export type DirectiveType = 'Action' | 'Binding' | 'Class' | 'EventHandler' | 'Let';

export interface BaseDirective extends BaseNode {
    type: DirectiveType;
    expression: null | Node;
    name: string;
    modifiers: string[];
}

export interface AttributeNode extends BaseNode {
    value: any[]
}

export type Directive = BaseDirective;

export type TemplateNode = TextNode | BaseNode | Directive;

export interface Script extends BaseNode {
    type: 'Script';
    context: string;
    content: Program;
}

export interface Style extends BaseNode {
    type: 'Style';
    attributes: any[];
    children: any[];
    content: {
        start: number;
        end: number;
        styles: string;
    };
}

export interface ParserOptions {
    filename?: string;
    customElement?: boolean
}

export interface Ast {
    html: TemplateNode;
    css: Style;
    script: Script;
    // module: Script;
}

export interface Visitor {
    enter: (node: Node) => void;
    leave?: (node: Node) => void;
}
