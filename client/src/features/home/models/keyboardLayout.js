// Key positions in keyboard units (1u = one standard key), so the rendered keyboard matches specs.layout.
// Each key: { x, z, w, accent } where x/z are the key's top-left corner.

const ALPHA_ROWS = [
  [...Array(13).fill(1), 2],
  [1.5, ...Array(12).fill(1), 1.5],
  [1.75, ...Array(11).fill(1), 2.25],
  [2.25, ...Array(10).fill(1), 2.75],
  [1.25, 1.25, 1.25, 6.25, 1.25, 1.25, 1.25, 1.25],
];

function rowKeys(widths, z, x0 = 0, accentIndexes = []) {
  let x = x0;
  return widths.map((w, i) => {
    const key = { x, z, w, accent: accentIndexes.includes(i) };
    x += w;
    return key;
  });
}

function alphaBlock(z0) {
  return ALPHA_ROWS.flatMap((widths, r) => {
    const accents = r === 0 ? [0] : r === 2 ? [widths.length - 1] : [];
    return rowKeys(widths, z0 + r, 0, accents);
  });
}

function functionRow(z, gaps) {
  // Esc, then F1-F12 in groups of four with gaps between groups.
  const keys = [{ x: 0, z, w: 1, accent: true }];
  let x = 1 + gaps[0];
  for (let group = 0; group < 3; group++) {
    for (let k = 0; k < 4; k++) keys.push({ x: x + k, z, w: 1, accent: false });
    x += 4 + gaps[group + 1];
  }
  return keys;
}

const column = (x, rows, z0, accentRows = []) =>
  rows.map((r) => ({ x, z: z0 + r, w: 1, accent: accentRows.includes(r) }));

export function keyboardLayout(layout = '75') {
  switch (layout) {
    case '60':
      return { keys: alphaBlock(0), width: 15, depth: 5 };
    case '65':
      return { keys: [...alphaBlock(0), ...column(15, [0, 1, 2, 3, 4], 0, [3, 4])], width: 16, depth: 5 };
    case 'tkl': {
      const nav = [
        ...column(15.25, [0, 1], 1.25),
        ...column(16.25, [0, 1], 1.25),
        ...column(17.25, [0, 1], 1.25),
        { x: 16.25, z: 4.25, w: 1, accent: true },
        { x: 15.25, z: 5.25, w: 1, accent: true },
        { x: 16.25, z: 5.25, w: 1, accent: true },
        { x: 17.25, z: 5.25, w: 1, accent: true },
      ];
      return {
        keys: [...functionRow(0, [1, 0.5, 0.5, 0]), ...alphaBlock(1.25), ...nav],
        width: 18.25,
        depth: 6.25,
      };
    }
    case 'full': {
      const tkl = keyboardLayout('tkl');
      const numpad = [0, 1, 2, 3].flatMap((c) => column(18.5 + c, [0, 1, 2, 3, 4], 1.25));
      return { keys: [...tkl.keys, ...numpad], width: 22.5, depth: 6.25 };
    }
    case '75':
    default:
      return {
        keys: [
          ...functionRow(0, [0, 0, 0, 0]).concat([
            { x: 13, z: 0, w: 1 },
            { x: 14, z: 0, w: 1 },
            { x: 15, z: 0, w: 1 },
          ]),
          ...alphaBlock(1),
          ...column(15, [0, 1, 2, 3, 4], 1, [3, 4]),
        ],
        width: 16,
        depth: 6,
      };
  }
}
