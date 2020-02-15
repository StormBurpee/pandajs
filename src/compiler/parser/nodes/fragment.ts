import {Parser} from "../index";
import text from "./text";
import tag from "./tag";

export default function fragment(parser: Parser) {
    if (parser.match('<'))
        return tag;

    return text;
}
