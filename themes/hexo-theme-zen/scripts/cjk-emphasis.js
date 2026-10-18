'use strict';

const CJK_CHARACTER = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u;

function findClosingBackticks(source, start, length, limit) {
  let index = start;

  while (index < limit) {
    index = source.indexOf('`', index);
    if (index < 0 || index >= limit) return -1;

    let end = index + 1;
    while (end < limit && source.charAt(end) === '`') end++;
    if (end - index === length) return index;
    index = end;
  }

  return -1;
}

function findTyporaStyleEmphasis(source) {
  let marker = '';
  if (source.startsWith('***')) marker = '***';
  else if (source.startsWith('**')) marker = '**';
  else if (source.startsWith('*')) marker = '*';
  if (!marker || /\s/.test(source.charAt(marker.length))) return null;

  const newline = source.search(/[\r\n]/);
  const limit = newline < 0 ? source.length : newline;

  for (let index = marker.length; index < limit;) {
    const character = source.charAt(index);

    // Leave escaped delimiters and inline code spans to Marked.
    if (character === '\\') {
      index += 2;
      continue;
    }

    if (character === '`') {
      let runEnd = index + 1;
      while (runEnd < limit && source.charAt(runEnd) === '`') runEnd++;
      const runLength = runEnd - index;
      const closing = findClosingBackticks(source, runEnd, runLength, limit);
      index = closing < 0 ? runEnd : closing + runLength;
      continue;
    }

    if (source.startsWith(marker, index)) {
      if (/\s/.test(source.charAt(index - 1))) return null;

      const end = index + marker.length;
      if (end >= limit) return null;
      const nextCharacter = String.fromCodePoint(source.codePointAt(end));
      if (!CJK_CHARACTER.test(nextCharacter)) return null;

      const text = source.slice(marker.length, index);
      if (!text || /^\s|\s$/.test(text)) return null;
      return { marker, raw: source.slice(0, end), text };
    }

    index++;
  }

  return null;
}

hexo.extend.filter.register('marked:extensions', function (extensions) {
  extensions.push({
    name: 'zenTyporaStyleEmphasis',
    level: 'inline',
    childTokens: ['tokens'],
    tokenizer(source) {
      const match = findTyporaStyleEmphasis(source);
      if (!match) return;

      return {
        type: 'zenTyporaStyleEmphasis',
        raw: match.raw,
        style: match.marker.length,
        tokens: this.lexer.inlineTokens(match.text)
      };
    },
    renderer(token) {
      const content = this.parser.parseInline(token.tokens);
      if (token.style === 3) return `<strong><em>${content}</em></strong>`;
      if (token.style === 2) return `<strong>${content}</strong>`;
      return `<em>${content}</em>`;
    }
  });
});
