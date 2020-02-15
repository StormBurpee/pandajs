export default function fullCharCodeAt(str: string, i: number): number {
    const code = str.charCodeAt(i);
    if (code <= 0xd7ff || code >= 0xe000) return code;

    const next = str.charCodeAt(i + 1);
    return (code << 10) + next - 0x35fdc00;
}
