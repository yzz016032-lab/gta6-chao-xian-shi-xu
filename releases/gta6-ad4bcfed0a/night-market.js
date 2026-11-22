(() => {
  'use strict';

  const D = window.Tideline;
  const DECK = .218;
  const FRONT = 328.78;
  const BACK = 333.78;
  const FASCIA = 326.56;
  const FACE_WEST = -Math.PI / 2;

  function canvasCanopy(T) {
    const positions = [], colors = [], indices = [];
    const profile = [[-.5, -.35], [-.5, 0], [-.37, .11], [-.13, .25], [.17, .40], [.5, .51]];
    const panels = 15;
    for (let panel = 0; panel < panels; panel++) {
      const tint = panel % 3 === 1 ? .73 : .96;
      const left = panel / panels - .5;
      const right = (panel + 1) / panels - .5;
      const middle = (left + right) * .5;
      const start = positions.length / 3;
      for (const [row, [x, y]] of profile.entries()) {
        const seam = row === 0 ? -.013 : .023;
        positions.push(x, y, left, x + (row ? 0 : -.014), y + seam, middle, x, y, right);
        const edge = tint * (row ? .86 : .63);
        const face = tint * (row ? 1 : .85);
        colors.push(edge, edge, edge, face, face, face, edge, edge, edge);
        if (!row) continue;
        const bottom = start + (row - 1) * 3;
        for (let side = 0; side < 2; side++) {
          const a = bottom + side;
          indices.push(a, a + 1, a + 3, a + 1, a + 4, a + 3);
        }
      }
    }
    const geometry = new T.BufferGeometry();
    geometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new T.Float32BufferAttribute(colors, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    return geometry;
  }

  function mountMarketSigns(T, scene, layouts, plaques, nightMaterials) {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    const random = D.rng(11720);
    for (const [index, layout] of layouts.entries()) {
      ctx.save();
      ctx.translate(0, index * 128);
      ctx.fillStyle = layout.signBase;
      ctx.fillRect(0, 0, 512, 128);
      ctx.strokeStyle = layout.accent;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(10, 11, 492, 106);
      ctx.fillStyle = layout.accent;
      ctx.fillRect(382, 27, 1.5, 75);
      ctx.font = '900 55px "Microsoft YaHei UI", "PingFang SC", "Noto Sans CJK SC", sans-serif';
      ctx.fillText(layout.name, 31, 71, 338);
      ctx.font = '700 17px Bahnschrift, "Arial Narrow", sans-serif';
      ctx.fillText(layout.caption, 33, 96, 323);
      ctx.lineWidth = 2.4;
      for (const y of [49, 63, 77]) {
        ctx.beginPath();
        ctx.moveTo(415, y + 5);
        ctx.bezierCurveTo(428, y - 9, 437, y - 8, 449, y + 2);
        ctx.bezierCurveTo(461, y + 11, 469, y + 4, 477, y - 1);
        ctx.stroke();
      }
      for (let fleck = 0; fleck < 220; fleck++) {
        ctx.fillStyle = fleck % 3 ? '#131d1e2a' : '#eed5a91f';
        ctx.fillRect(7 + random() * 498, 7 + random() * 113, .7 + random() * 2.6, .45 + random() * .83);
      }
      ctx.restore();
    }

    const positions = [], normals = [], uvs = [], indices = [];
    for (const { index, x, y, z, width, height, yaw } of plaques) {
      const sin = Math.sin(yaw), cos = Math.cos(yaw);
      const first = positions.length / 3;
      for (const [u, v] of [[0, 0], [1, 0], [1, 1], [0, 1]]) {
        const side = (u - .5) * width;
        positions.push(x + side * cos, y + (v - .5) * height, z - side * sin);
        normals.push(sin, 0, cos);
        uvs.push((5 + u * 502) / 512, 1 - (index * 128 + 5 + (1 - v) * 118) / 512);
      }
      indices.push(first, first + 1, first + 2, first, first + 2, first + 3);
    }
    const geometry = new T.BufferGeometry();
    geometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('normal', new T.Float32BufferAttribute(normals, 3));
    geometry.setAttribute('uv', new T.Float32BufferAttribute(uvs, 2));
    geometry.setIndex(indices);
    const atlas = new T.CanvasTexture(canvas);
    atlas.colorSpace = T.SRGBColorSpace;
    atlas.anisotropy = 4;
    const ink = new T.MeshStandardMaterial({ map: atlas, emissiveMap: atlas, emissive: '#ffd59c', emissiveIntensity: .46, roughness: .72 });
    nightMaterials.push([ink, 1.85]);
    scene.add(new T.Mesh(geometry, ink));
  }

  function addNightMarket({ T, scene, queue, box, ground, solid, bar, pole, surfaceTexture, nightMaterials, fixture, lampPool, contactShade }) {
    const material = (color, roughness = .78, options = {}) => new T.MeshStandardMaterial({ color, roughness, ...options });
    const steel = material('#253639', .67, { metalness: .32 });
    const zinc = material('#849084', .53, { metalness: .40 });
    const timber = material('#9b7352', .79);
    const pale = material('#d2bc99', .87);
    const inside = material('#6e7d71', .81, { emissive: '#625442', emissiveIntensity: .32 });
    const slats = material('#819c8a', .74, { metalness: .22, map: surfaceTexture('metal', true) });
    const kraft = material('#c28b57', .96);
    const red = material('#9c5843', .68);
    const sea = material('#6f9a9a', .75);
    const warm = material('#ffe5b8', .48, { emissive: '#ffae4d', emissiveIntensity: .68 });
    const lanternRed = material('#e85c42', .52, { emissive: '#ff6438', emissiveIntensity: .64 });
    const ember = material('#ff8340', .58, { emissive: '#ff511c', emissiveIntensity: .85 });
    const norenCloth = material('#b8593f', .90);
    const mint = material('#a2dfd0', .52, { emissive: '#6bc9b4', emissiveIntensity: .34 });
    const lanternGlobe = new T.SphereGeometry(.5, 10, 8);
    nightMaterials.push([warm, 2.55], [lanternRed, 2.35], [ember, 2.1], [mint, 1.05], [inside, 1.05]);

    const awning = canvasCanopy(T);
    const stalls = [
      { z: 107.04, width: 5.36, name: '赤陶食档', caption: 'CLAY POT KITCHEN', cloth: '#d47c5a', accent: '#ffd09c', signBase: '#5e2e24', frontPaint: red },
      { z: 114.4, width: 6.52, name: '白汐夜市', caption: 'ORDER PICKUP', cloth: '#87ab8d', accent: '#ffe09e', signBase: '#214d40', frontPaint: sea },
      { z: 122, width: 5.7, name: '灯塔画铺', caption: 'HARBOR PRINTS', cloth: '#699db0', accent: '#cef2ec', signBase: '#264d61', frontPaint: pale },
    ];
    const placards = [];

    for (const [index, { z, width, cloth, frontPaint }] of stalls.entries()) {
      const shellX = (FRONT + BACK) / 2;
      const depth = BACK - FRONT;
      const half = width / 2;
      const signWidth = width * .67;
      const clothMaterial = material(cloth, .91, { vertexColors: true, side: T.DoubleSide });
      if (contactShade) ground(contactShade, shellX, z, depth + .88, width + 1.34, DECK + .004);
      if (lampPool) ground(lampPool, FRONT - 1.7, z, 6.47, width + .39, DECK + .005);
      box(steel, shellX, DECK + .083, z, depth + .1, .15, width);
      box(timber, shellX, DECK + .145, z, depth - .17, .04, width - .16);
      box(inside, BACK - .1, 1.79, z, .19, 2.94, width - .15);
      box(slats, BACK + .005, 1.78, z, .025, 2.83, width - .24);
      box(slats, shellX, 3.37, z, depth + .41, .15, width + .17, 0, 0, .052);
      box(steel, shellX, 3.25, z, depth + .49, .17, width + .27, 0, 0, .052);
      for (const side of [-1, 1]) {
        const edge = z + side * (half - .09);
        box(inside, shellX, 1.66, edge, depth - .12, 2.76, .15);
        box(slats, shellX, 1.64, edge + side * .079, depth - .24, 2.68, .024);
        box(zinc, shellX, 1.17, edge + side * .096, depth - .23, .084, .046);
        for (const x of [FRONT + .09, BACK - .1]) {
          box(steel, x, 1.79, edge, .18, 2.92, .18);
          box(zinc, x, .43, edge, .25, .15, .25);
        }
        box(steel, shellX, 3.14, edge, depth + .15, .14, .13);
        bar(steel, FRONT + .018, 2.43, edge, FASCIA + .26, 2.91, edge, .085);
      }
      box(steel, FRONT + .02, 3.08, z, .21, .24, width + .02);
      queue(awning, clothMaterial, (FASCIA + FRONT) / 2, 2.90, z, FRONT - FASCIA + .11, .72, width + .35);
      box(steel, FASCIA, 2.926, z, .19, .073, width + .43);
      box(timber, FASCIA - .06, 3.31, z, .16, .76, signWidth + .13);
      box(zinc, FASCIA - .068, 3.705, z, .22, .045, signWidth + .22);
      placards.push({ index, x: FASCIA - .147, y: 3.31, z, width: signWidth, height: .69, yaw: FACE_WEST });
      box(steel, FRONT + .38, 2.82, z, .19, .075, width - 1.05);
      box(warm, FRONT + .37, 2.773, z, .09, .034, width - 1.21);
      for (const offset of [-.34, 0, .34]) {
        const lampZ = z + offset * width;
        pole(steel, FRONT - .79, 2.888, lampZ, .042, .34);
        pole(steel, FRONT - .79, 2.73, lampZ, .19, .055);
        queue(lanternGlobe, offset === 0 ? warm : lanternRed, FRONT - .79, 2.56, lampZ, .28, .34, .28);
        pole(steel, FRONT - .79, 2.39, lampZ, .16, .045);
        pole(red, FRONT - .79, 2.30, lampZ, .038, .16);
      }
      // Warm fairy-bulb strip along the front canopy edge
      const bulbs = 7;
      for (let b = 0; b < bulbs; b++) {
        const bz = z + ((b + .5) / bulbs - .5) * (width - .3);
        queue(lanternGlobe, b % 2 ? warm : lanternRed, FASCIA - .06, 2.86, bz, .078, .088, .078);
      }
      // Hanging cloth noren flaps under the front awning for street-market atmosphere
      for (let flap = -2; flap <= 2; flap++) {
        box(index === 0 ? norenCloth : index === 1 ? sea : pale, FRONT - .10, 2.56, z + flap * (width * .175), .022, .44, width * .145);
      }
      box(steel, FRONT + .16, .71, z, .20, .94, width - .25);
      box(frontPaint, FRONT + .053, .705, z, .024, .74, width - .53);
      box(timber, FRONT + .025, .47, z, .047, .079, width - .69);
      box(timber, FRONT + .34, 1.23, z, .96, .12, width - .19);
      box(zinc, FRONT - .145, 1.242, z, .042, .047, width - .22);
      box(steel, BACK - .44, 1.08, z, .70, 1.45, width - .39);
      box(timber, BACK - .46, 1.81, z, .72, .088, width - .36);
      solid(shellX - .04, z, depth + .38, width + .16, 3.51);
    }

    const kitchen = stalls[0].z;
    fixture(FRONT - .62, 2.58, kitchen, '#ffb670', 46, 16);
    box(zinc, FRONT + .26, 1.34, kitchen - 1.32, .57, .097, 1.72);
    // Glowing charcoal grill bed & stacked bamboo steamers on the counter
    box(ember, FRONT + .26, 1.40, kitchen - 1.32, .42, .035, 1.44);
    for (const sz of [kitchen + .22, kitchen + .56]) {
      pole(kraft, FRONT + .22, 1.44, sz, .34, .18);
      pole(timber, FRONT + .22, 1.56, sz, .35, .14);
      pole(pale, FRONT + .22, 1.66, sz, .33, .06);
    }
    // Cozy low market dining table & wooden stools tucked right beside the stall apron (outside main walkway)
    box(timber, FRONT - 1.35, DECK + .54, kitchen - 1.85, .74, .06, .92);
    for (const [dx, dz] of [[-.30, -.38], [.30, -.38], [-.30, .38], [.30, .38]]) {
      box(steel, FRONT - 1.35 + dx, DECK + .27, kitchen - 1.85 + dz, .05, .52, .05);
    }
    for (const [sx, sz] of [[-1.35, -2.56], [-1.35, -1.14], [-1.96, -1.85]]) {
      box(red, FRONT + sx, DECK + .36, kitchen + sz, .32, .05, .32);
      box(steel, FRONT + sx, DECK + .18, kitchen + sz, .22, .34, .22);
    }
    for (const [offset, diameter, tint] of [[-1.82, .39, red], [-1.31, .42, pale], [-.78, .33, red], [.71, .34, sea], [1.12, .33, pale], [1.53, .34, sea]]) {
      const stack = offset > 0;
      const x = FRONT + (stack ? .8 : .22);
      pole(tint, x, stack ? 1.4 : 1.53, kitchen + offset, diameter, stack ? .22 : .34);
      pole(stack ? pale : zinc, x, stack ? 1.51 : 1.704, kitchen + offset, diameter + .025, .027);
      if (!stack) pole(steel, x, 1.745, kitchen + offset, .091, .082);
    }
    for (const offset of [-1.75, -1.06, .41, 1.27, 1.78]) {
      box(offset > 0 ? red : kraft, BACK - .59, 1.98, kitchen + offset, .31, .255, .32);
    }

    const pickup = stalls[1].z;
    fixture(FRONT - .87, 2.54, pickup, '#ffc07e', 56, 18);
    box(steel, FRONT - .17, .84, pickup, .15, .38, 1.12);
    box(mint, FRONT - .255, .99, pickup, .026, .039, .91);
    box(zinc, FRONT + .17, 1.327, pickup - 1.48, .52, .075, .70);
    box(steel, FRONT + .39, 1.51, pickup - 1.54, .25, .37, .34, 0, 0, -.2);
    box(mint, FRONT + .25, 1.56, pickup - 1.54, .024, .20, .254, 0, 0, -.2);
    box(timber, BACK - .46, 2.27, pickup, .68, .064, 4.44);
    box(kraft, BACK - .40, 2.42, pickup + 1.48, .52, .25, 1.21);
    box(pale, BACK - .55, 2.42, pickup + 1.04, .222, .065, .36);
    box(zinc, BACK - .42, 2.48, pickup - 1.21, .50, .32, .84);
    for (const [offset, width, height, depth] of [[-.50, .48, .27, .62], [.22, .71, .43, .66], [1.37, .47, .22, .39], [1.84, .36, .31, .47]]) {
      box(kraft, FRONT + .28, 1.291 + height / 2, pickup + offset, width, height, depth);
      box(pale, FRONT + .28, 1.294 + height, pickup + offset, .09, .008, depth + .001);
      box(pale, FRONT + .273 - width / 2, 1.35 + height * .35, pickup + offset + depth * .15, .014, .069, .12);
    }
    box(steel, FRONT - .70, 2.38, pickup + 3.36, 1.49, .60, .19);
    bar(zinc, FRONT - .08, 2.67, pickup + 3.34, FRONT - 1.13, 2.84, pickup + 3.34, .056);
    placards.push({ index: 3, x: FRONT - .70, y: 2.38, z: pickup + 3.463, width: 1.35, height: .49, yaw: 0 },
      { index: 3, x: FRONT - .70, y: 2.38, z: pickup + 3.254, width: 1.35, height: .49, yaw: Math.PI });
    mountMarketSigns(T, scene, [...stalls, { name: '取件', caption: 'PICKUP', accent: '#cae7d7', signBase: '#2e5046' }], placards, nightMaterials);
    for (const side of [-1, 1]) {
      ground(mint, 323.65, pickup + side * .83, 2.56, .064, DECK + .012);
      ground(mint, 322.39, pickup + side * .666, .046, .37, DECK + .012);
      ground(mint, 324.91, pickup + side * .666, .046, .37, DECK + .012);
    }

    const gallery = stalls[2].z;
    fixture(FRONT - .53, 2.54, gallery, '#ffbe82', 42, 15);
    const mural = new T.TextureLoader().load('assets/night-market-mural.webp');
    mural.colorSpace = T.SRGBColorSpace;
    mural.anisotropy = 4;
    const paint = material('#fffaf0', .92, { map: mural, emissiveMap: mural, emissive: '#d2c0a8', emissiveIntensity: .26 });
    nightMaterials.push([paint, .58]);
    const artX = FRONT - .13;
    const artZ = gallery - .41;
    const artY = 1.79;
    const artWidth = 3.24;
    const artHeight = artWidth * 2 / 3;
    box(steel, artX + .064, artY, artZ, .14, artHeight + .18, artWidth + .17);
    box(timber, artX - .016, artY, artZ, .047, artHeight + .126, artWidth + .124);
    queue(new T.PlaneGeometry(1, 1), paint, artX - .042, artY, artZ, artWidth, artHeight, 1, FACE_WEST);
    for (const y of [artY - artHeight / 2 + .08, artY + artHeight / 2 - .08]) {
      for (const z of [artZ - artWidth / 2, artZ + artWidth / 2]) box(zinc, artX - .06, y, z, .045, .10, .088);
    }
    box(timber, FRONT + .51, 1.69, gallery + 1.91, .52, .09, 1.08);
    for (const [index, paper] of [pale, red, sea, kraft].entries()) {
      box(paper, FRONT + .43 + index * .09, 1.91 + index * .038, gallery + 1.56 + index * .17,
        .039, .39 + index * .06, .26, 0, 0, -.22);
    }

    for (let i = 1; i < stalls.length; i++) {
      const before = stalls[i - 1];
      const after = stalls[i];
      const low = before.z + (before.width + .36) / 2;
      const high = after.z - (after.width + .36) / 2;
      const midpoint = (low + high) / 2;
      const cable = [[low, 3.17], [midpoint, 2.92], [high, 3.17]];
      for (let segment = 1; segment < cable.length; segment++) {
        const [start, startY] = cable[segment - 1];
        const [end, endY] = cable[segment];
        bar(steel, FASCIA - .02, startY, start, FASCIA - .02, endY, end, .023);
      }
      for (const [idx, offset] of [-.42, -.14, .14, .42].entries()) {
        const y = Math.abs(offset) > .25 ? 3.01 : 2.91;
        box(steel, FASCIA - .027, y + .032, midpoint + offset, .075, .07, .075);
        queue(lanternGlobe, idx % 2 ? warm : lanternRed, FASCIA - .026, y - .11, midpoint + offset, .21, .26, .21);
        box(steel, FASCIA - .027, y - .24, midpoint + offset, .065, .04, .065);
      }
    }
  }

  D.addNightMarket = addNightMarket;
})();
