import {Script} from "../../contracts";
import {Parser} from "../index";
import {Node, Program} from 'estree';
import * as acorn from '../acorn';

const scriptClosingTag = '</script>';

export default function parseScript(parser: Parser, start: number, attributes: Node[]): Script {
    const scriptStart = parser.getIndex();
    const scriptEnd = parser.getTemplate().indexOf(scriptClosingTag, scriptStart);

    if (scriptEnd === -1)
        parser.error({
            code: 'unclosed-script',
            message: `Expected closing '${scriptClosingTag}' tag.`
        });

    const source = ' '.repeat(scriptStart) + parser.getTemplate().slice(scriptStart, scriptEnd);
    parser.setIndex(scriptEnd + scriptClosingTag.length);

    let ast: Program;

    try {
        ast = acorn.parse(source) as any as Program;
    } catch (err) {
        parser.internalParserError(err);
    }

    (ast as any).start = scriptStart;

    return {
        type: 'Script',
        start,
        end: parser.getIndex(),
        // TODO: Support contexts?
        context: 'default',
        content: ast,
    };
}
