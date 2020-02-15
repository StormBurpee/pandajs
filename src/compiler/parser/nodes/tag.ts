import {Parser} from "../index";
import {AttributeNode, Directive, DirectiveType, Script, Style, TemplateNode, TextNode} from "../../contracts";
import {isVoid} from "../../utils/names";
import {closingTagOmitted, decodeCharacterReferences} from "../utils/html";
import parseScript from "../parse/scripts";
import parseStyle from "../parse/styles";

const specials = new Map([
    [
        'script',
        {
            read: parseScript,
            property: 'js',
        },
    ],
    [
        'style',
        {
            read: parseStyle,
            property: 'css',
        },
    ],
]);

const valid_tag_name = /^\!?[a-zA-Z]{1,}:?[a-zA-Z0-9\-]*/;

export default function tag(parser: Parser) {
    const start = parser.incrementIndex();
    let parent = parser.current();

    if (parser.eat('!--')) {
        const data = parser.readUntil(/-->/);
        parser.eat('-->', true, 'Expected closing comment tag ("-->").');

        parser.current().children?.push({
            start,
            end: parser.getIndex(),
            type: 'Comment',
            data,
        });

        return;
    }

    const isClosingTag = parser.eat('/');
    const name = readTagName(parser);
    const type = (/[A-Z]/.test(name[0])) ? 'InlineComponent'
        : name === 'slot' && !parser.isCustomElement() ? 'Slot' : 'Element';

    const element: TemplateNode = {
        start,
        end: 0,
        type,
        name,
        attributes: [],
        children: [],
    };

    parser.allowWhitespace();

    if (isClosingTag) {
        if (isVoid(name)) {
            parser.error({
                code: 'invalid-closing-tag',
                message: `<${name}> does not require a closing tag, and is therefore invalid.`
            });
        }

        parser.eat('>', true);

        while (parent.name !== name) {
            if (parent.type !== 'Element')
                parser.error({
                    code: `invalid-closing-tag`,
                    message: `</${name}> attempted to close an element that was not open`
                }, start);

            parent.end = start;
            parser.popStack();

            parent = parser.current();
        }

        parent.end = parser.getIndex();
        parser.popStack();

        return;
    } else if (closingTagOmitted(parent.name, name)) {
        parent.end = start;
        parser.popStack();
    }

    const uniqueNames: Set<string> = new Set();

    let attribute;
    while ((attribute = readAttribute(parser, uniqueNames))) {
        element.attributes.push(attribute);
        parser.allowWhitespace();
    }

    if (specials.has(name) && parser.getStack().length === 1) {
        const special = specials.get(name);
        if (special === undefined) return;

        parser.eat('>', true);
        const content = special.read(parser, start, element.attributes);
        if (content) {
            if (special?.property === 'js')
                parser.pushJs(content as Script);
            else if (special?.property === 'css')
                parser.pushCss(content as Style);
        }
        return;
    }

    parser.current().children?.push(element);

    const isSelfClosing = parser.eat('/') || isVoid(name);
    parser.eat('>', true);

    if (isSelfClosing) {
        element.end = parser.getIndex();
    } else if (name === 'textarea') {
        // special case
        element.children = readSequence(
            parser,
            () =>
                parser.getTemplate().slice(parser.getIndex(), parser.getIndex() + 11) === '</textarea>'
        );
        parser.read(/<\/textarea>/);
        element.end = parser.getIndex();
    } else if (name === 'script') {
        // special case
        const start = parser.getIndex();
        const data = parser.readUntil(/<\/script>/);
        const end = parser.getIndex();
        element.children?.push({start, end, type: 'Text', data});
        parser.eat('</script>', true);
        element.end = parser.getIndex();
    } else if (name === 'style') {
        // special case
        const start = parser.getIndex();
        const data = parser.readUntil(/<\/style>/);
        const end = parser.getIndex();
        element.children?.push({start, end, type: 'Text', data});
        parser.eat('</style>', true);
    } else {
        parser.getStack().push(element);
    }
}

function readTagName(parser: Parser): string {
    const start = parser.getIndex();
    const name = parser.readUntil(/(\s|\/|>)/);

    // TODO: Support for panda built-in names.

    if (!valid_tag_name.test(name)) {
        parser.error({
            code: `invalid-tag-name`,
            message: `Expected valid tag name`
        }, start);
    }

    return name;
}

function readAttribute(parser: Parser, uniqueNames: Set<string>): Directive | AttributeNode | null {
    const start = parser.getIndex();

    function checkUnique(name: string): void {
        if (uniqueNames.has(name)) {
            parser.error({
                code: `duplicate-attribute`,
                message: 'Attributes defined on an element need to be unique'
            }, start);
        }

        uniqueNames.add(name);
    }

    const name = parser.readUntil(/[\s=\/>"']/);

    if (!name)
        return null;

    let end = parser.getIndex();
    parser.allowWhitespace();

    const colon_index = name.indexOf(':');
    const type = colon_index !== -1 && getDirectiveType(name.slice(0, colon_index));

    let value: any[] = [];
    if (parser.eat('=')) {
        parser.allowWhitespace();
        value = readAttributeValue(parser) ?? [];
        end = parser.getIndex();
    } else if (parser.matchRegex(/["']/)) {
        parser.error({
            code: `unexpected-token`,
            message: `Expected '='`
        }, parser.getIndex());
    }

    if (type) {
        const [directive_name, ...modifiers] = name.slice(colon_index + 1).split('|');

        if (type === 'Binding' && directive_name !== 'this') {
            checkUnique(directive_name);
        } else if (type !== 'EventHandler') {
            checkUnique(name);
        }

        if (value[0]) {
            if ((value as any[]).length > 1 || value[0].type === 'Text') {
                parser.error({
                    code: `invalid-directive-value`,
                    message: `Directive value must be a JavaScript expression enclosed in curly braces`
                }, value[0].start);
            }
        }

        const directive: Directive = {
            start,
            end,
            type,
            name: directive_name,
            modifiers,
            expression: (value[0] && value[0].expression) || null
        };

        if (!directive.expression && (type === 'Binding' || type === 'Class')) {
            directive.expression = {
                start: directive.start + colon_index + 1,
                end: directive.end,
                type: 'Identifier',
                name: directive.name
            } as any;
        }

        return directive;
    }

    checkUnique(name);

    return {
        start,
        end,
        type: 'Attribute',
        name,
        value,
    };
}

function getDirectiveType(name: string): DirectiveType | undefined {
    if (name === 'use') return 'Action';
    if (name === 'bind') return 'Binding';
    if (name === 'class') return 'Class';
    if (name === 'on') return 'EventHandler';
    if (name === 'let') return 'Let';
}

function readAttributeValue(parser: Parser): TemplateNode[] | undefined {
    const quote_mark = parser.eat(`'`) ? `'` : parser.eat(`"`) ? `"` : null;

    const regex = (
        quote_mark === `'` ? /'/ :
            quote_mark === `"` ? /"/ :
                /(\/>|[\s"'=<>`])/
    );

    const value = readSequence(parser, () => !!parser.matchRegex(regex));

    if (quote_mark) parser.incrementIndex();
    return value;
}

function readSequence(parser: Parser, done: () => boolean): TemplateNode[] | undefined {
    let current_chunk: TextNode = {
        start: parser.getIndex(),
        end: 0,
        type: 'Text',
        raw: '',
        data: ''
    };

    function flush() {
        if (current_chunk.raw) {
            current_chunk.data = decodeCharacterReferences(current_chunk.raw);
            current_chunk.end = parser.getIndex();
            chunks.push(current_chunk);
        }
    }

    const chunks: TemplateNode[] = [];

    while (parser.getIndex() < parser.getTemplate().length) {
        if (done()) {
            flush();
            return chunks;
        } else {
            current_chunk.raw += parser.getTemplate()[parser.incrementIndex()];
        }
    }

    parser.error({
        code: `unexpected-eof`,
        message: `Unexpected end of file`
    });
}
