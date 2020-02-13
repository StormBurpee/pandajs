import {Ast, Fragment, ParserOptions, Script, Style, TemplateNode} from "../contracts";
import fragment from "./nodes/fragment";

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

    public read(pattern: RegExp) {
        const result = this.match_regex(pattern);
        if (result) this.index += result.length;
        return result;
    }

    public internal_parser_error(err: any) {
        this.error({
            code: `parse-error`,
            message: err.message.replace(/ \(\d+:\d+\)$/, '')
        }, err.pos);
    }

    public error({ code, message }: { code: string; message: string }, index = this.index) {
        error(message, {
            name: 'ParseError',
            code,
            source: this.template,
            start: index,
            filename: this.filename
        });
    }
}

export default function parse(template: string, options: ParserOptions = {}): Ast {
    return {
        html: '',
        css: '',
        instance: '',
        module: ''
    }
}
