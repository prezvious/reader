const fs = require('fs');
const path = require('path');

const sourceDir = 'C:/Users/prezv/Downloads/phosphor-icons/SVGs/regular';
const outputPath = path.join(__dirname, '..', 'icon', 'phosphor-sprite.svg');

const icons = [
  'arrow-clockwise',
  'arrow-counter-clockwise',
  'arrow-left',
  'arrow-right',
  'bookmark-simple',
  'caret-down',
  'caret-up',
  'check-circle',
  'clock',
  'clock-counter-clockwise',
  'envelope-simple',
  'eye',
  'file-text',
  'google-logo',
  'heart',
  'house',
  'image-square',
  'link-simple',
  'list',
  'lock-simple',
  'magnifying-glass',
  'moon',
  'newspaper-clipping',
  'note-pencil',
  'quotes',
  'sign-out',
  'sparkle',
  'squares-four',
  'sun',
  'text-b',
  'text-italic',
  'text-underline',
  'user-circle',
  'warning-circle',
  'x'
];

function buildSymbol(name) {
  const filePath = path.join(sourceDir, `${name}.svg`);
  const svg = fs.readFileSync(filePath, 'utf8').trim();
  const viewBoxMatch = svg.match(/viewBox="([^"]+)"/);
  if (!viewBoxMatch) {
    throw new Error(`Missing viewBox for ${name}`);
  }

  let body = svg
    .replace(/^[\s\S]*?<svg[^>]*>/, '')
    .replace(/<\/svg>\s*$/, '')
    .trim();

  body = body.replace(/<rect[^>]*width="256"[^>]*height="256"[^>]*fill="none"\s*\/?>/g, '').trim();

  return `  <symbol id="${name}" viewBox="${viewBoxMatch[1]}">\n    ${body}\n  </symbol>`;
}

function main() {
  const symbols = icons.map(buildSymbol).join('\n');
  const sprite = [
    '<svg xmlns="http://www.w3.org/2000/svg" style="display:none">',
    symbols,
    '</svg>',
    ''
  ].join('\n');

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, sprite, 'utf8');
  console.log(`Wrote ${outputPath}`);
}

main();
