import {isIdentifierStart, isIdentifierChar} from 'acorn';
import {Ast, Fragment, ParserOptions, Script, Style, TemplateNode} from "../contracts";
import {reserved} from "../utils/names";
import fragment from "./nodes/fragment";
import error from "../utils/error";
import full_char_code_at from "../utils/full_char_code_at";

export type ParserState = (parser: Parser) => (ParserState | void);

export class Parser {
    private readonly template: string;
    private readonly filename?: string;
    private readonly customElement?: boolean;

    private index = 0;
    private stack: TemplateNode[] = [];

    private html: Fragment;
    private css: Style[] = [];
    private js: Script[] = [];

    constructor(template: string, options: ParserOptions) {
        this.template = template;
        this.filename = options.filename;
        this.customElement = options.customElement;

        this.html = {
            start: 0,
            end: 0,
            type: 'Fragment',
            children: [],
        };

        this.stack.push(this.html);
        this.parseTemplate();
    }

    private parseTemplate(): void {
        let state: ParserState = fragment;

        while (this.getIndex() < this.getTemplate().length) {
            state = state(this) || fragment;
        }

        if (this.stack.length > 1) {
            const current = this.current();

            const type = current.type === 'Element' ? `<${current.name}>` : 'Block';
            const slug = current.type === 'Element' ? 'element' : 'block';

            this.error({
                code: `unclosed-${slug}`,
                message: `${type} required closing tag`
            }, current.start);
        }

        if (state !== fragment) {
            this.error({
                code: `unexpected-eof`,
                message: 'Unexpected end of file'
            });
        }

        if (this.html.children.length) {
            let start = this.html.children[0].start;
            while (/[ \t\r\n]/.test(this.getTemplate()[start])) start += 1;

            let end = this.html.children[this.html.children.length - 1].end;
            while (/[ \t\r\n]/.test(this.getTemplate()[end - 1])) end -= 1;

            this.html.start = start;
            this.html.end = end;
        } else {
            this.html.start = this.html.end = 0;
        }
    }

    public current(): TemplateNode {
        return this.stack[this.stack.length - 1];
    }

    public match(str: string): boolean {
        return this.template.slice(this.index, this.index + str.length) === str;
    }

    public match_regex(pattern: RegExp) {
        const match = pattern.exec(this.template.slice(this.index));
        if (!match || match.index !== 0) return null;

        return match[0];
    }

    public allow_whitespace() {
        while (
            this.index < this.template.length &&
            /[ \t\r\n]/.test(this.template[this.index])
            ) {
            this.index++;
        }
    }

    public require_whitespace() {
        if (!/[ \t\r\n]/.test(this.template[this.index])) {
            this.error({
                code: `missing-whitespace`,
                message: `Expected whitespace`
            });
        }

        this.allow_whitespace();
    }

    public eat(str: string, required?: boolean, message?: string): boolean {
        if (this.match(str)) {
            this.index += str.length;
            return true;
        }

        if (required) {
            this.error({
                code: `unexpected-${this.index === this.template.length ? 'eof' : 'token'}`,
                message: message || `Expected ${str}`
            });
        }

        return false;
    }

    public read(pattern: RegExp) {
        const result = this.match_regex(pattern);
        if (result) this.index += result.length;
        return result;
    }

    public read_identifier(allow_reserved = false): string | null {
        const start = this.index;

        let i = this.index;

        const code = full_char_code_at(this.template, i);
        if (!isIdentifierStart(code, true)) return null;

        i += code <= 0xffff ? 1 : 2;

        while (i < this.template.length) {
            const code = full_char_code_at(this.template, i);

            if (!isIdentifierChar(code, true)) break;
            i += code <= 0xffff ? 1 : 2;
        }

        const identifier = this.template.slice(this.index, this.index = i);

        if (!allow_reserved && reserved.has(identifier)) {
            this.error({
                code: `unexpected-reserved-word`,
                message: `'${identifier}' is a reserved word in JavaScript and cannot be used here`
            }, start);
        }

        return identifier;
    }

    public read_until(pattern: RegExp): string {
        if (this.index >= this.template.length)
            this.error({
                code: `unexpected-eof`,
                message: 'Unexpected end of input'
            });

        const start = this.index;
        const match = pattern.exec(this.template.slice(start));

        if (match) {
            this.index = start + match.index;
            return this.template.slice(start, this.index);
        }

        this.index = this.template.length;
        return this.template.slice(start);
    }

    public internal_parser_error(err: any) {
        this.error({
            code: `parse-error`,
            message: err.message.replace(/ \(\d+:\d+\)$/, '')
        }, err.pos);
    }

    public error({code, message}: { code: string; message: string }, index = this.index) {
        error(message, {
            name: 'ParseError',
            code,
            source: this.template,
            start: index,
            filename: this.filename
        });
    }

    public getTemplate(): string {
        return this.template;
    }

    public getFilename(): string | undefined {
        return this.filename;
    }

    public isCustomElement(): boolean {
        return this.customElement || false;
    }

    public getIndex(): number {
        return this.index;
    }

    public getStack(): TemplateNode[] {
        return this.stack;
    }

    public getHtml(): Fragment {
        return this.html;
    }

    public getCss(): Style[] {
        return this.css;
    }

    public getJs(): Script[] {
        return this.js;
    }
}

export default function parse(template: string, options: ParserOptions = {}): Ast {
    const parser = new Parser(template, options);

    if (parser.getCss().length > 1) {
        parser.error({
            code: 'multiple-styles',
            message: 'Panda components must only include one style tag.'
        }, parser.getCss()[1].start);
    }

    if (parser.getJs().length > 1) {
        parser.error({
            code: 'multiple-scripts',
            message: 'Panda components must only include one script tag.'
        }, parser.getJs()[1].start);
    }

    return {
        html: parser.getHtml(),
        css: parser.getCss()[0],
        script: parser.getJs()[0]
    }
}
