/*
 * A QR code, encoded here rather than installed.
 *
 * Every surface that offers the app now shows one, and there are only two other
 * ways to get the picture: a dependency, or an image somebody generated once
 * and committed. The image loses the ability to say what it points at — a wrong
 * QR is invisible in review, because the only way to read one is to scan it —
 * and a dependency for a fixed string is heavier than the encoder itself, which
 * is this file. There is no per-request cost either: the one code the site
 * shows is encoded at module load and reused.
 *
 * Byte mode, error correction level M, versions 1 to 10. That covers any URL we
 * would put on a poster; the encoder throws rather than truncating if a caller
 * passes something longer, because a silently shortened QR still scans — to the
 * wrong address.
 *
 * Verified module for module against the `qrcode` npm package and decoded back
 * to the original string with `jsqr`. Reading this code is not a way to find
 * out whether it is right; scanning what it draws is.
 */

/**
 * Per version: error-correction codewords per block, then the two block groups
 * as [count, data codewords each]. Level M only — the table for all four levels
 * is four times the size and nothing here needs the other three.
 */
const ECC_M: Record<number, [number, number, number, number, number]> = {
  1: [10, 1, 16, 0, 0],
  2: [16, 1, 28, 0, 0],
  3: [26, 1, 44, 0, 0],
  4: [18, 2, 32, 0, 0],
  5: [24, 2, 43, 0, 0],
  6: [16, 4, 27, 0, 0],
  7: [18, 4, 31, 0, 0],
  8: [22, 2, 38, 2, 39],
  9: [22, 3, 36, 2, 37],
  10: [26, 4, 43, 1, 44],
};

/** Row and column centres of the alignment patterns, per version. */
const ALIGNMENT: Record<number, number[]> = {
  1: [],
  2: [6, 18],
  3: [6, 22],
  4: [6, 26],
  5: [6, 30],
  6: [6, 34],
  7: [6, 22, 38],
  8: [6, 24, 42],
  9: [6, 26, 46],
  10: [6, 28, 50],
};

/* GF(256), primitive polynomial 0x11d — the field the Reed-Solomon codewords
   live in. Built once; the log table is what makes multiplication a lookup. */
const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);
{
  let x = 1;
  for (let i = 0; i < 255; i++) {
    EXP[i] = x;
    LOG[x] = i;
    x = x << 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
}

const mul = (a: number, b: number) => (a === 0 || b === 0 ? 0 : EXP[LOG[a] + LOG[b]]);

/** The generator polynomial for `degree` error-correction codewords. */
function generator(degree: number): number[] {
  let poly = [1];
  for (let i = 0; i < degree; i++) {
    const next = new Array<number>(poly.length + 1).fill(0);
    for (let j = 0; j < poly.length; j++) {
      next[j] ^= poly[j];
      next[j + 1] ^= mul(poly[j], EXP[i]);
    }
    poly = next;
  }
  return poly;
}

/** Remainder of the data polynomial — one block's error-correction codewords. */
function remainder(data: number[], degree: number): number[] {
  const gen = generator(degree);
  const rem = new Array<number>(degree).fill(0);
  for (const byte of data) {
    const factor = byte ^ rem[0];
    rem.shift();
    rem.push(0);
    for (let i = 0; i < degree; i++) rem[i] ^= mul(gen[i + 1], factor);
  }
  return rem;
}

const dataCodewords = (version: number) => {
  const [, g1, d1, g2, d2] = ECC_M[version];
  return g1 * d1 + g2 * d2;
};

/** Byte mode's character-count indicator is 8 bits up to version 9, then 16. */
const countBits = (version: number) => (version <= 9 ? 8 : 16);

function pickVersion(byteLength: number): number {
  for (let version = 1; version <= 10; version++) {
    const needed = Math.ceil((4 + countBits(version) + byteLength * 8) / 8);
    if (needed <= dataCodewords(version)) return version;
  }
  throw new Error(`qr: ${byteLength} bytes is too long for a version-10 code`);
}

/** Mode, length, payload, terminator and padding — the final data codewords. */
function encodeData(bytes: Uint8Array, version: number): number[] {
  const bits: number[] = [];
  const push = (value: number, length: number) => {
    for (let i = length - 1; i >= 0; i--) bits.push((value >> i) & 1);
  };

  push(0b0100, 4); // byte mode
  push(bytes.length, countBits(version));
  for (const byte of bytes) push(byte, 8);

  const capacity = dataCodewords(version) * 8;
  push(0, Math.min(4, capacity - bits.length)); // terminator
  while (bits.length % 8 !== 0) bits.push(0);

  const codewords: number[] = [];
  for (let i = 0; i < bits.length; i += 8) {
    let byte = 0;
    for (let j = 0; j < 8; j++) byte = (byte << 1) | bits[i + j];
    codewords.push(byte);
  }
  /* The two pad codewords the standard names, alternating. They are not
     arbitrary: a decoder that sees them knows the message ended there. */
  for (let i = 0; codewords.length < dataCodewords(version); i++) {
    codewords.push(i % 2 === 0 ? 0xec : 0x11);
  }
  return codewords;
}

/** Split into blocks, add error correction, and interleave the lot. */
function interleave(codewords: number[], version: number): number[] {
  const [eccPerBlock, g1, d1, g2, d2] = ECC_M[version];

  const dataBlocks: number[][] = [];
  const eccBlocks: number[][] = [];
  let offset = 0;
  for (const [count, size] of [
    [g1, d1],
    [g2, d2],
  ]) {
    for (let i = 0; i < count; i++) {
      const block = codewords.slice(offset, offset + size);
      offset += size;
      dataBlocks.push(block);
      eccBlocks.push(remainder(block, eccPerBlock));
    }
  }

  const out: number[] = [];
  const longest = Math.max(...dataBlocks.map((block) => block.length));
  for (let i = 0; i < longest; i++) {
    for (const block of dataBlocks) if (i < block.length) out.push(block[i]);
  }
  for (let i = 0; i < eccPerBlock; i++) {
    for (const block of eccBlocks) out.push(block[i]);
  }
  return out;
}

/** 1 dark, 0 light. */
type Grid = number[][];

const MASKS: ((row: number, col: number) => boolean)[] = [
  (r, c) => (r + c) % 2 === 0,
  (r) => r % 2 === 0,
  (_r, c) => c % 3 === 0,
  (r, c) => (r + c) % 3 === 0,
  (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0,
  (r, c) => ((r * c) % 2) + ((r * c) % 3) === 0,
  (r, c) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0,
  (r, c) => (((r + c) % 2) + ((r * c) % 3)) % 2 === 0,
];

function drawFunctionPatterns(grid: Grid, reserved: boolean[][], version: number) {
  const size = grid.length;

  const set = (row: number, col: number, dark: boolean) => {
    grid[row][col] = dark ? 1 : 0;
    reserved[row][col] = true;
  };

  /* Finder patterns and their separators, drawn as one 8x8 block per corner so
     the white gutter cannot be forgotten — it is as much a part of the pattern
     as the rings are. */
  for (const [top, left] of [
    [0, 0],
    [0, size - 7],
    [size - 7, 0],
  ]) {
    for (let r = -1; r <= 7; r++) {
      for (let c = -1; c <= 7; c++) {
        const row = top + r;
        const col = left + c;
        if (row < 0 || row >= size || col < 0 || col >= size) continue;
        const ring = Math.max(Math.abs(r - 3), Math.abs(c - 3));
        set(row, col, ring !== 2 && ring <= 3);
      }
    }
  }

  // Timing patterns, running between the finders along row and column 6.
  for (let i = 8; i < size - 8; i++) {
    set(6, i, i % 2 === 0);
    set(i, 6, i % 2 === 0);
  }

  // Alignment patterns, except the three that would sit on a finder.
  const centres = ALIGNMENT[version];
  const last = centres[centres.length - 1];
  for (const row of centres) {
    for (const col of centres) {
      if ((row === 6 && col === 6) || (row === 6 && col === last) || (row === last && col === 6)) continue;
      for (let r = -2; r <= 2; r++) {
        for (let c = -2; c <= 2; c++) {
          set(row + r, col + c, Math.max(Math.abs(r), Math.abs(c)) !== 1);
        }
      }
    }
  }

  // The one module that is dark whatever the data says.
  set(size - 8, 8, true);

  // Format information: written after masking, reserved now so data skips it.
  for (let i = 0; i <= 8; i++) {
    if (!reserved[8][i]) set(8, i, false);
    if (!reserved[i][8]) set(i, 8, false);
  }
  for (let i = 0; i < 8; i++) {
    if (!reserved[8][size - 1 - i]) set(8, size - 1 - i, false);
    if (!reserved[size - 1 - i][8]) set(size - 1 - i, 8, false);
  }

  // Version information, which only exists from version 7 up.
  if (version >= 7) {
    let rem = version;
    for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >> 11) * 0x1f25);
    const info = (version << 12) | rem;
    for (let i = 0; i < 18; i++) {
      const dark = ((info >> i) & 1) === 1;
      set(Math.floor(i / 3), size - 11 + (i % 3), dark);
      set(size - 11 + (i % 3), Math.floor(i / 3), dark);
    }
  }
}

/** The zigzag: two columns at a time, right to left, skipping column 6. */
function placeData(grid: Grid, reserved: boolean[][], codewords: number[]) {
  const size = grid.length;
  let bit = 0;
  let upward = true;

  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5; // column 6 is the vertical timing pattern
    for (let step = 0; step < size; step++) {
      const row = upward ? size - 1 - step : step;
      for (const col of [right, right - 1]) {
        if (reserved[row][col]) continue;
        /* Past the end of the data the remainder bits are zero — a code whose
           capacity is not a whole number of codewords has a few of them. */
        const byte = codewords[bit >> 3] ?? 0;
        grid[row][col] = (byte >> (7 - (bit & 7))) & 1;
        bit++;
      }
    }
    upward = !upward;
  }
}

function writeFormat(grid: Grid, mask: number) {
  const size = grid.length;
  /* Level M is 0b00, so the five data bits are the mask alone — written out in
     full because a different level here would otherwise be silent. */
  const data = (0b00 << 3) | mask;
  let rem = data;
  for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >> 9) * 0x537);
  const info = ((data << 10) | rem) ^ 0x5412;

  /* Written twice, in both corners, so damage to one copy is survivable — and
     the two copies run at right angles to each other. Getting that the wrong
     way round produces a code that differs from a correct one in four modules
     and does not scan at all, which is exactly what the first draft did. */
  for (let i = 0; i <= 5; i++) grid[i][8] = (info >> i) & 1;
  grid[7][8] = (info >> 6) & 1;
  grid[8][8] = (info >> 7) & 1;
  grid[8][7] = (info >> 8) & 1;
  for (let i = 9; i < 15; i++) grid[8][14 - i] = (info >> i) & 1;

  for (let i = 0; i < 8; i++) grid[8][size - 1 - i] = (info >> i) & 1;
  for (let i = 8; i < 15; i++) grid[size - 15 + i][8] = (info >> i) & 1;
}

/** The standard's four penalty rules. The lowest total wins the mask. */
function penalty(grid: Grid): number {
  const size = grid.length;
  let score = 0;

  const line = (cells: number[]) => {
    let run = 1;
    for (let i = 1; i < cells.length; i++) {
      if (cells[i] === cells[i - 1]) {
        run++;
        if (run === 5) score += 3;
        else if (run > 5) score += 1;
      } else {
        run = 1;
      }
    }
    /* Finder-like 1:1:3:1:1 runs, either way round, with four light modules on
       one side — the pattern a scanner could mistake for a corner. */
    const bits = cells.join('');
    for (const pattern of ['10111010000', '00001011101']) {
      let from = bits.indexOf(pattern);
      while (from !== -1) {
        score += 40;
        from = bits.indexOf(pattern, from + 1);
      }
    }
  };

  for (let i = 0; i < size; i++) {
    line(grid[i]);
    line(grid.map((row) => row[i]));
  }

  for (let r = 0; r < size - 1; r++) {
    for (let c = 0; c < size - 1; c++) {
      const first = grid[r][c];
      if (grid[r][c + 1] === first && grid[r + 1][c] === first && grid[r + 1][c + 1] === first) {
        score += 3;
      }
    }
  }

  let dark = 0;
  for (const row of grid) for (const cell of row) dark += cell;
  const percent = (dark * 100) / (size * size);
  score += Math.floor(Math.abs(percent - 50) / 5) * 10;

  return score;
}

/**
 * The modules of a QR code for `text`: true is dark. No quiet zone — the caller
 * draws that, because how much white to leave around it is a layout question.
 */
export function qrMatrix(text: string): boolean[][] {
  const bytes = new TextEncoder().encode(text);
  const version = pickVersion(bytes.length);
  const size = 17 + version * 4;
  const codewords = interleave(encodeData(bytes, version), version);

  const base: Grid = Array.from({ length: size }, () => new Array<number>(size).fill(0));
  const reserved = Array.from({ length: size }, () => new Array<boolean>(size).fill(false));
  drawFunctionPatterns(base, reserved, version);
  placeData(base, reserved, codewords);

  let best: Grid = base;
  let bestScore = Infinity;
  for (let mask = 0; mask < 8; mask++) {
    const grid = base.map((row) => [...row]);
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (!reserved[r][c] && MASKS[mask](r, c)) grid[r][c] ^= 1;
      }
    }
    writeFormat(grid, mask);
    const score = penalty(grid);
    if (score < bestScore) {
      bestScore = score;
      best = grid;
    }
  }

  return best.map((row) => row.map((cell) => cell === 1));
}

/**
 * The same code as one SVG path, on a grid `quiet` modules bigger on every side
 * — that white margin is not decoration, a code without it is hard to scan.
 *
 * One path rather than a rect per module: a version-2 code is 625 modules, and
 * 625 elements is a page of markup for a picture that never changes.
 */
export function qrPath(text: string, quiet = 2): { path: string; size: number } {
  const matrix = qrMatrix(text);
  const parts: string[] = [];

  for (let r = 0; r < matrix.length; r++) {
    /* Runs, not squares: neighbouring dark modules become one rectangle, which
       is smaller markup and free of the hairline seams a renderer can leave
       between two shapes that only touch. */
    let c = 0;
    while (c < matrix.length) {
      if (!matrix[r][c]) {
        c++;
        continue;
      }
      let end = c;
      while (end + 1 < matrix.length && matrix[r][end + 1]) end++;
      parts.push(`M${c + quiet} ${r + quiet}h${end - c + 1}v1h-${end - c + 1}z`);
      c = end + 1;
    }
  }

  return { path: parts.join(''), size: matrix.length + quiet * 2 };
}

const drawn = new Map<string, { path: string; size: number }>();

/**
 * qrPath, remembered for the life of the worker.
 *
 * Four surfaces draw the same code and every page render asks for it again.
 * Encoding one is a millisecond, but it is a millisecond of a request that has
 * a database round trip to make, spent on a picture that has not changed since
 * the process started.
 */
export function qrPathFor(text: string, quiet = 2): { path: string; size: number } {
  const key = `${quiet}\n${text}`;
  const found = drawn.get(key);
  if (found) return found;

  const made = qrPath(text, quiet);
  drawn.set(key, made);
  return made;
}
