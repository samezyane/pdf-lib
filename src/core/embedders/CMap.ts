import { Glyph } from '@pdf-lib/fontkit';

import { toHexStringOfMinLength } from 'src/utils';

/** [[start, end], mappings] */
type BfRange = [[string, string], string[]];

/** `glyphs` should be an array of unique glyphs sorted by their ID */
export const createCmap = (glyphs: Glyph[]) => {
  const bfRanges: BfRange[] = [];

  let mappings: string[] = [];
  let first: number = glyphs[0].id;

  for (let idx = 0, len = glyphs.length; idx < len; idx++) {
    const currGlyph = glyphs[idx];
    const prevGlyph = glyphs[idx - 1];

    if (idx !== 0 && currGlyph.id - prevGlyph.id !== 1) {
      const last = prevGlyph.id;
      const delimiters: [string, string] = [
        cmapHexFormat(cmapHexString(first)),
        cmapHexFormat(cmapHexString(last)),
      ];
      bfRanges.push([delimiters, mappings]);

      first = currGlyph.id;
      mappings = [];
    }

    mappings.push(
      cmapHexFormat(...currGlyph.codePoints.map(cmapCodePointFormat)),
    );
  }

  const last = glyphs[glyphs.length - 1].id;
  const delimiters: [string, string] = [
    cmapHexFormat(cmapHexString(first)),
    cmapHexFormat(cmapHexString(last)),
  ];
  bfRanges.push([delimiters, mappings]);

  return fillCmapTemplate(bfRanges);
};

/* =============================== Templates ================================ */

// prettier-ignore
const fillBfrangeTemplate = ([[start, end], mappings]: BfRange) => `
${mappings.length} beginbfrange
${start} ${end} [${mappings.join(' ')}]
endbfrange
`.trim();

// prettier-ignore
const fillCmapTemplate = (bfRanges: BfRange[]) => `
/CIDInit /ProcSet findresource begin
12 dict begin
begincmap
/CIDSystemInfo <<
  /Registry (Adobe)
  /Ordering (UCS)
  /Supplement 0
>> def
/CMapName /Adobe-Identity-UCS def
/CMapType 2 def
1 begincodespacerange
<0000><ffff>
endcodespacerange
${bfRanges.map(fillBfrangeTemplate).join('\n')}
endcmap
CMapName currentdict /CMap defineresource pop
end
end
`.trim();

/* =============================== Utilities ================================ */

const cmapHexFormat = (...values: string[]) => `<${values.join('')}>`;

const cmapHexString = (value: number) => toHexStringOfMinLength(value, 4);

const cmapCodePointFormat = (codePoint: number) => {
  if (isUtf8CodePoint(codePoint)) return cmapHexString(codePoint);

  if (isUtf16CodePoint(codePoint)) {
    const hs = highSurrogate(codePoint);
    const ls = lowSurrogate(codePoint);
    return `${cmapHexString(hs)}${cmapHexString(ls)}`;
  }

  const hex = codePoint.toString(16);
  const msg = `0x${hex} is not a valid UTF-8 or UTF-16 codepoint.`;
  throw new Error(msg);
};

// From: https://en.wikipedia.org/wiki/UTF-16#Description
const isUtf8CodePoint = (codePoint: number) =>
  codePoint >= 0 && codePoint <= 0xffff;

// From: https://en.wikipedia.org/wiki/UTF-16#Description
const isUtf16CodePoint = (codePoint: number) =>
  codePoint >= 0x010000 && codePoint <= 0x10ffff;

// From Unicode 3.0 spec, section 3.7:
//   http://unicode.org/versions/Unicode3.0.0/ch03.pdf
const highSurrogate = (codePoint: number) =>
  Math.floor((codePoint - 0x10000) / 0x400) + 0xd800;

// From Unicode 3.0 spec, section 3.7:
//   http://unicode.org/versions/Unicode3.0.0/ch03.pdf
const lowSurrogate = (codePoint: number) =>
  ((codePoint - 0x10000) % 0x400) + 0xdc00;
