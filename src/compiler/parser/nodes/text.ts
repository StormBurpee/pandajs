import {Parser} from "../index";
import {decodeCharacterReferences} from '../utils/html';

export default function text(parser: Parser) {
    const start = parser.getIndex();

    let data = '';

    while (
        parser.getIndex() < parser.getTemplate().length &&
        !parser.match('<') //&&
        //!parser.match('{')
        ) {
        data += parser.getTemplate()[parser.incrementIndex()];
    }

    const node = {
        start,
        end: parser.getIndex(),
        type: 'Text',
        raw: data,
        data: decodeCharacterReferences(data),
    };

    parser.current().children?.push(node);
}
