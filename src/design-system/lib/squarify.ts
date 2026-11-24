/**
 * Squarified treemap layout (Bruls et al.): cells close to square, sizes
 * proportional to value. Pure. Output in percent of the box (0–100).
 */
export interface TreemapRect {
  key: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export function squarify(items: { key: string; value: number }[], width = 100, height = 100): TreemapRect[] {
  const list = items.filter((i) => i.value > 0).sort((a, b) => b.value - a.value);
  const total = list.reduce((s, i) => s + i.value, 0);
  if (total <= 0) return [];
  const scale = (width * height) / total;
  const areas = list.map((i) => ({ key: i.key, a: i.value * scale }));
  const out: TreemapRect[] = [];
  let x = 0;
  let y = 0;
  let w = width;
  let h = height;

  const worst = (row: number[], side: number) => {
    const s = row.reduce((a, b) => a + b, 0);
    const max = Math.max(...row);
    const min = Math.min(...row);
    return Math.max((side * side * max) / (s * s), (s * s) / (side * side * min));
  };

  let i = 0;
  while (i < areas.length) {
    const side = Math.min(w, h);
    const row: typeof areas = [areas[i]!];
    i++;
    while (i < areas.length && worst([...row, areas[i]!].map((r) => r.a), side) <= worst(row.map((r) => r.a), side)) {
      row.push(areas[i]!);
      i++;
    }
    const sum = row.reduce((s, r) => s + r.a, 0);
    if (w >= h) {
      // Column on the left of the free space.
      const cw = sum / h;
      let cy = y;
      for (const r of row) {
        const ch = r.a / cw;
        out.push({ key: r.key, x, y: cy, w: cw, h: ch });
        cy += ch;
      }
      x += cw;
      w -= cw;
    } else {
      // Row on top of the free space.
      const rh = sum / w;
      let cx = x;
      for (const r of row) {
        const rw = r.a / rh;
        out.push({ key: r.key, x: cx, y, w: rw, h: rh });
        cx += rw;
      }
      y += rh;
      h -= rh;
    }
  }
  return out;
}
