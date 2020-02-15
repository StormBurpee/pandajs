import {Style} from "../../contracts";
import {Parser} from "../index";
import {walk} from "estree-walker";
import {Node} from 'estree';

// @ts-ignore
import parse from 'css-tree/lib/parser/index.js';


export default function parseStyle(parser: Parser, start: number, attributes: Node[]): Style {
    const content_start = parser.getIndex();
    const styles = parser.readUntil(/<\/style>/);
    const content_end = parser.getIndex();

    let ast;

    try {
        ast = parse(styles, {
            positions: true,
            offset: content_start,
        });
    } catch (err) {
        if (err.name === 'CssSyntaxError') {
            parser.error({
                code: `css-syntax-error`,
                message: err.message
            }, err.offset);
        } else {
            throw err;
        }
    }

    ast = JSON.parse(JSON.stringify(ast));

    walk(ast, {
        enter: (node: any) => {
            if (node.type === 'Declaration' && node.value.type === 'Value' && node.value.children.length === 0) {
                parser.error({
                    code: `invalid-declaration`,
                    message: `Declaration cannot be empty`
                }, node.start);
            }

            if (node.loc) {
                node.start = node.loc.start.offset;
                node.end = node.loc.end.offset;
                delete node.loc;
            }
        }
    });

    parser.eat('</style>', true);
    const end = parser.getIndex();

    return {
        type: 'Style',
        start,
        end,
        attributes,
        children: ast.children,
        content: {
            start: content_start,
            end: content_end,
            styles
        }
    };
}
