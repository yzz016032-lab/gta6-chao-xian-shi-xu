(() => {
  'use strict';
  const D = window.Tideline;

  function canvasTexture(T, width, height, paint) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    paint(canvas.getContext('2d'), width, height);
    const texture = new T.CanvasTexture(canvas);
    texture.colorSpace = T.SRGBColorSpace;
    texture.anisotropy = 4;
    return texture;
  }

  function deckPaint(T) {
    const random = D.rng(41414);
    const wood = canvasTexture(T, 512, 512, (ctx, w, h) => {
      const boards = [[166, 136, 102], [154, 124, 92], [174, 144, 108], [146, 118, 90]];
      const image = ctx.createImageData(w, h);
      for (let y = 0; y < h; y++) {
        const run = y / h * Math.PI * 2;
        for (let x = 0; x < w; x++) {
          const edge = x % 128;
          const fiber = x + .50 * Math.sin(run * 3 + x * .13) + 1.1 * Math.sin(run * 2 + x * .039);
          const grain = Math.sin(fiber * .58) * 4.7 + Math.sin(fiber * 1.87 + run) * 4.1;
          const knots = Math.sin(fiber * .067 + Math.sin(run * 2 + x * .24)) * 7.6;
          const wear = Math.cos(x * .078 + run) * Math.sin(run * 4 - x * .03) * 7.4 + (random() - .5) * 12.2;
          const bevel = Math.min(edge, 127 - edge);
          const seam = bevel < 3 ? Math.max(0, .5 - bevel * .17) : 0;
          const light = edge > 2 && edge < 7 ? 11 - edge : 0;
          const index = 4 * (y * w + x);
          const base = boards[Math.floor(x / 128)];
          for (let channel = 0; channel < 3; channel++) {
            image.data[index + channel] = (base[channel] + grain + knots + wear + light) * (1 - seam);
          }
          image.data[index + 3] = 255;
        }
      }
      ctx.putImageData(image, 0, 0);
      for (let x = 0; x < w; x += 128) {
        for (const y of [30, 278]) {
          const offset = x + 9;
          ctx.fillStyle = 'rgba(39,33,28,.49)';
          ctx.beginPath();
          ctx.ellipse(offset, y, 2.8, 1.8, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = 'rgba(218,205,182,.46)';
          ctx.fillRect(offset - 1.7, y - 1, 3, 1);
        }
      }
    });
    wood.wrapS = wood.wrapT = T.RepeatWrapping;
    return wood;
  }

  function wornLabel(T, seed, draw, board = false) {
    const random = D.rng(seed);
    return canvasTexture(T, 512, 256, (ctx, width, height) => {
      draw(ctx, width, height);
      if (!board) ctx.globalCompositeOperation = 'destination-out';
      for (let i = 0; i < 1400; i++) {
        const x = random() * width;
        const y = random() * height;
        ctx.fillStyle = board ? `rgba(196,155,102,${.02 + random() * .1})` : `rgba(0,0,0,${.13 + random() * .64})`;
        ctx.fillRect(x, y, .6 + random() * 6.1, .4 + random() * (i % 20 === 0 ? 12 : 2.1));
      }
    });
  }

  function floorLabel(ctx, lead, caption, rightArrow) {
    ctx.fillStyle = '#d9bb83';
    ctx.strokeStyle = '#d9bb83';
    ctx.lineWidth = 6;
    ctx.strokeRect(16, 16, 480, 224);
    ctx.font = '900 132px "Bahnschrift", "Arial Narrow", sans-serif';
    ctx.fillText(lead, 42, 150, 300);
    ctx.font = '700 28px "Bahnschrift", sans-serif';
    ctx.fillText(caption, 46, 207, 404);
    if (!rightArrow) return;
    ctx.lineWidth = 12;
    ctx.beginPath();
    ctx.moveTo(359, 107);
    ctx.lineTo(451, 107);
    ctx.lineTo(414, 69);
    ctx.moveTo(451, 107);
    ctx.lineTo(414, 145);
    ctx.stroke();
  }

  function mooringRope(T) {
    const knots = [];
    for (let i = 0; i <= 81; i++) {
      const t = i / 81;
      const a = t * 6 * Math.PI;
      const r = .50 - t * .44;
      knots.push(new T.Vector3(Math.cos(a) * r, .061 + Math.sin(a * 1.72) * .024 + t * .073, Math.sin(a) * r * .77));
    }
    return new T.TubeGeometry(new T.CatmullRomCurve3(knots), 58, .037, 6, false);
  }

  function freighterHull(T) {
    const frame = [[-63,.42,2.04],[-58,3.9,1.25],[-51,7.95,.49],[-40,9.18,.10],[-27,9.6,0],
      [25,9.65,0],[42,9.46,.14],[53,8.72,.42],[57,6.82,.65],[59,3.65,.79],[59.5,.47,.86]];
    const profile = [[.61,-3.7],[.91,-1.25],[1,.25],[1.01,.65],[.98,3.7],[.96,4.41]];
    const colorRamp = ['#372d29','#5d3c36','#6e4c42','#283f45','#344e51','#586667'].map(hex => new T.Color(hex));
    const points = [];
    const colors = [];
    const triangles = [];
    const beam = profile.length * 2;
    for (const [i, [z, halfWidth, sheer]] of frame.entries()) {
      for (const sign of [-1, 1]) {
        for (const [j, [width, y]] of profile.entries()) {
          points.push(sign * width * halfWidth, y + sheer, z);
          const color = colorRamp[j];
          colors.push(color.r, color.g, color.b);
          if (!i || !j) continue;
          const at = i * beam + (sign > 0 ? profile.length : 0) + j;
          const back = at - beam;
          if (sign < 0) triangles.push(back - 1, at - 1, at, back - 1, at, back);
          else triangles.push(back - 1, at, at - 1, back - 1, back, at);
        }
      }
      if (i > 0) {
        const rim = i * beam + profile.length - 1;
        const past = rim - beam;
        triangles.push(past, rim, rim + profile.length, past, rim + profile.length, past + profile.length);
      }
    }
    const geometry = new T.BufferGeometry();
    geometry.setAttribute('position', new T.Float32BufferAttribute(points, 3));
    geometry.setAttribute('color', new T.Float32BufferAttribute(colors, 3));
    geometry.setIndex(triangles);
    geometry.computeVertexNormals();
    return geometry;
  }

  function addPortDetail({ T, scene, queue, box, bar, pole, nightMaterials, surfaceTexture, fixture }) {
    const plane = new T.PlaneGeometry(1, 1);
    const mat = (color, roughness, extra = {}) => new T.MeshStandardMaterial({ color, roughness, ...extra });
    const zinc = mat('#7a8680', .66, { metalness: .29 });
    const steel = mat('#3a4d52', .63, { metalness: .28 });
    const paint = mat('#526562', .77, { metalness: .11 });
    const brass = mat('#ac8651', .72, { metalness: .26 });
    const rust = mat('#916250', .82);
    const rubber = mat('#272e31', .96);
    const rope = mat('#b7a183', .92);
    const enamel = mat('#c4bfb0', .78);
    const amber = mat('#ffd99e', .44, { emissive: '#ffb866', emissiveIntensity: .46 });
    const lifeOrange = mat('#e35d36', .62);
    const lifeRingGeo = new T.TorusGeometry(.30, .072, 6, 16);
    nightMaterials.push([amber, 2.35]);
    const cable = mooringRope(T);
    const wood = deckPaint(T);
    const boards = mat('#ffffff', .74, { map: wood, bumpMap: wood, bumpScale: .025 });
    const concrete = mat('#9ca097', .71, {
      map: surfaceTexture('pavement', true), normalMap: surfaceTexture('pavement-normal', false), normalScale: new T.Vector2(.34, .34),
    });
    const pathStone = concrete.clone();
    pathStone.color.set('#c8bda2');
    const faded = map => mat('#fff9eb', .87, { map, transparent: true, opacity: .76, depthWrite: false });

    function tilePanel(material, x, y, z, width, height, repeatU, repeatV, yaw, pitch = 0) {
      const geo = plane.clone();
      const uv = geo.getAttribute('uv');
      for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * repeatU, uv.getY(i) * repeatV);
      const mesh = new T.Mesh(geo, material);
      mesh.position.set(x, y, z);
      mesh.rotation.set(pitch, yaw, 0, 'YXZ');
      mesh.scale.set(width, height, 1);
      mesh.receiveShadow = true;
      scene.add(mesh);
    }
    const tileFloor = (material, x, y, z, w, d, repeatU, repeatV) => tilePanel(material, x, y, z, w, d, repeatU, repeatV, 0, -Math.PI / 2);
    const placard = (material, x, y, z, w, h, yaw) => queue(plane, material, x, y, z, w, h, 1, yaw);
    const floorStencil = (material, x, y, z, w, h, yaw) => queue(plane, material, x, y, z, w, h, 1, yaw, -Math.PI / 2);

    function gangway(dock, berthText, x, z, wide) {
      const length = dock.maxX - dock.minX;
      const depth = dock.maxZ - dock.minZ;
      tileFloor(boards, (dock.maxX + dock.minX) / 2, .222, (dock.maxZ + dock.minZ) / 2,
        length - .07, depth - 1.18, length / 2.64, depth / 7.3);
      for (const side of [-1, 1]) {
        const edge = side < 0 ? dock.minZ : dock.maxZ;
        box(zinc, dock.minX + length / 2, .205, edge - side * .13, length, .07, .20);
        box(steel, dock.minX + length / 2, -.235, edge - side * .10, length, .22, .16);
        for (let p = dock.minX + 3.25; p < dock.maxX - 3; p += 7.5) {
          box(rubber, p, -.054, edge - side * .27, .66, .53, .24);
          box(zinc, p, .247, edge - side * .27, .46, .042, .30);
          // Warm solar dock-edge safety bollard light
          pole(steel, p + 1.85, .44, edge - side * .28, .12, .44);
          pole(amber, p + 1.85, .64, edge - side * .28, .11, .09);
          pole(brass, p + 1.85, .70, edge - side * .28, .14, .04);
        }
      }
      const label = faded(wornLabel(T, 172 + Math.floor(x), ctx => floorLabel(ctx, berthText, 'BAIXI PORT AUTHORITY', true)));
      floorStencil(label, x, .235, z, wide, wide * .53, -Math.PI / 2);
    }

    function dockSign(x, z) {
      const top = 3.56;
      const yaw = -Math.PI / 3;
      const nx = Math.sin(yaw);
      const nz = Math.cos(yaw);
      const board = wornLabel(T, 2817, (ctx, w, h) => {
        ctx.fillStyle = '#18343c';
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = '#bba574';
        ctx.lineWidth = 5;
        ctx.strokeRect(13, 13, w - 26, h - 26);
        ctx.fillStyle = '#e6d8b9';
        ctx.font = '800 79px "Microsoft YaHei UI", "Noto Sans CJK SC", sans-serif';
        ctx.fillText('灯塔湾', 149, 118, 325);
        ctx.font = '700 38px "Bahnschrift", sans-serif';
        ctx.fillText('LANTERN BAY', 152, 176, 318);
        ctx.font = '600 22px "Bahnschrift", sans-serif';
        ctx.fillText('浮动码头   /   FLOATING PIER', 152, 215, 318);
        ctx.fillStyle = '#c7ad70';
        ctx.fillRect(30, 42, 91, 165);
        ctx.fillStyle = '#192e35';
        ctx.font = '900 94px "Bahnschrift", sans-serif';
        ctx.fillText('B', 42, 158, 67);
      }, true);
      const face = mat('#ffffff', .68, { map: board, emissiveMap: board, emissive: '#ead1a8' });
      nightMaterials.push([face, .49]);
      pole(steel, x, 2.06, z, .19, 3.68);
      pole(zinc, x, .37, z, .31, .30);
      box(steel, x, top, z, 3.60, 1.47, .12, yaw);
      placard(face, x + nx * .068, top, z + nz * .068, 3.54, 1.40, yaw);
      box(steel, x + nx * .19, top + .75, z + nz * .19, 2.69, .10, .40, yaw);
      box(amber, x + nx * .27, top + .677, z + nz * .27, 1.78, .07, .12, yaw);
      fixture(x + nx * .73, top + .22, z + nz * .73, '#ffc897', 29, 11);
    }

    function waterfront() {
      const { mainDock, islandDock } = D.MARINE;
      gangway(mainDock, 'B 02', 362, 212.25, 4.15);
      gangway(islandDock, 'C 01', 544.0, 137.3, 2.95);
      dockSign(371.55, 199.73);
      for (const [x, z, yaw, size] of [[352.17, 200.49, .74, 1.17], [367.38, 200.13, .23, 1.19], [546.4, 131.35, 1.9, .98]]) {
        queue(cable, rope, x, .231, z, size, size, size, yaw);
        pole(rust, x + .50, .263, z - .39, .43, .087);
        pole(steel, x + .50, .428, z - .39, .235, .33);
        pole(zinc, x + .50, .606, z - .39, .38, .095);
      }
      for (const x of [342.05, 352.0]) {
        box(zinc, x, .82, 205.21, .323, 1.12, .323);
        box(brass, x, 1.27, 205.39, .31, .105, .025);
        box(amber, x, 1.40, 205.21, .24, .09, .24);
      }
      // Harbor safety life-ring stations on main pier & island pier
      for (const [rx, rz] of [[358.2, 199.85], [378.5, 217.5], [542.6, 131.5]]) {
        pole(steel, rx, .88, rz, .085, 1.35);
        queue(lifeRingGeo, lifeOrange, rx, 1.16, rz + .09, 1, 1, 1, 0);
        box(enamel, rx, 1.44, rz + .09, .14, .09, .16);
        box(enamel, rx, .88, rz + .09, .14, .09, .16);
      }
      for (let x = 341.68; x <= 352.65; x += .64) {
        bar(zinc, x, 3.339, 203.0, x, 3.262, 200.43, .029, .054);
        bar(zinc, x, 3.336, 203.18, x, 3.259, 205.70, .029, .054);
      }
      box(steel, 346.95, 3.072, 206.03, 11.59, .187, .114);
    }

    function headland() {
      tileFloor(pathStone, 600.3, .236, 139.29, 39.6, 4.56, 39.60 / 2.62, 4.56 / 2.62);
      const signal = faded(wornLabel(T, 6564, ctx => floorLabel(ctx, 'C 01', 'SIGNAL SERVICE', false)));
      floorStencil(signal, 610.29, .241, 139.14, 2.79, 1.50, -Math.PI / 2);
      const hut = { x: 617.3, z: 132.43, west: 614.48, east: 620.12 };
      for (let x = 614.28; x < 620.52; x += .48) {
        bar(zinc, x, 2.739, 130.44, x, 3.069, 134.39, .027, .042);
      }
      bar(steel, 614.18, 2.86, 134.46, 620.45, 2.86, 134.46, .094, .118);
      for (const x of [hut.west - .12, hut.east + .12]) {
        bar(steel, x, .39, 133.97, x, 2.59, 133.97, .102);
        bar(zinc, x, 2.59, 133.97, x, 2.84, 134.46, .102);
        box(paint, x, .62, 133.97, .122, .24, .12);
      }
      box(paint, hut.west - .014, .59, hut.z, .043, .60, 3.53);
      box(steel, hut.west - .042, 1.61, 131.69, .090, .94, 1.39);
      box(zinc, hut.west - .097, 1.61, 131.69, .05, .80, 1.24);
      for (let y = 1.27; y <= 1.98; y += .118) {
        box(steel, hut.west - .124, y, 131.69, .044, .040, 1.18, 0, 0, -.24);
      }
      pole(steel, 619.02, 3.66, 131.14, .095, 2.03);
      for (const y of [4.56, 4.42, 4.28]) bar(zinc, 618.41, y, 131.15, 619.62, y, 131.13, .046);
      box(steel, 616.56, 2.47, 134.61, .64, .15, .21);
      box(amber, 616.56, 2.392, 134.61, .48, .04, .13);
      fixture(616.46, 2.46, 135.21, '#ffbe80', 13.8, 13);

      const random = D.rng(130215);
      const tuft = new T.BufferGeometry();
      const blades = [];
      for (let blade = 0; blade < 12; blade++) {
        const a = blade * (Math.PI * 2 / 12) + (random() - .5) * .32;
        const x = Math.cos(a);
        const z = Math.sin(a);
        const edgeX = z * (.021 + random() * .031);
        const edgeZ = -x * (.021 + random() * .031);
        const root = .025 + random() * .08;
        const spread = .12 + random() * .31;
        const tall = .22 + random() * .59;
        const a0 = [x * root - edgeX, 0, z * root - edgeZ];
        const a1 = [x * root + edgeX, 0, z * root + edgeZ];
        const m0 = [x * spread * .59 - edgeX * .61, tall * .68, z * spread * .59 - edgeZ * .61];
        const m1 = [x * spread * .59 + edgeX * .61, tall * .68, z * spread * .59 + edgeZ * .61];
        blades.push(...a0, ...a1, ...m1, ...a0, ...m1, ...m0, ...m0, ...m1, x * spread, tall, z * spread);
      }
      tuft.setAttribute('position', new T.Float32BufferAttribute(blades, 3));
      tuft.computeVertexNormals();
      const cluster = [[587, 134, 4.6, 1], [591, 145, 3.1, 1.8], [599, 132, 5.4, 3], [604, 147, 6.4, 3.3],
        [613, 143.7, 5.1, 1.1], [623, 143.3, 5.1, .7], [627, 131, 5, 2.2], [635, 148.9, 6.4, 5],
        [651, 143.4, 3.6, 2.4], [649, 125.4, 4.8, 1.4], [657.6, 130, 3.3, 1.3]];
      const fronds = new T.InstancedMesh(tuft, mat('#ffffff', .94, { side: T.DoubleSide }), cluster.length * 18);
      const foliage = new T.Color();
      const roots = new T.Color('#455d48');
      const straw = new T.Color('#b8ab70');
      const transform = new T.Object3D();
      let index = 0;
      for (const [x, z, w, d] of cluster) {
        for (let i = 0; i < 18; i++) {
          const size = .39 + random() * .69;
          transform.position.set(x + (random() * 2 - 1) * w, .202, z + (random() * 2 - 1) * d);
          if (Math.abs(transform.position.z - 139.29) < 2.72) continue;
          transform.scale.set(size, size * (.73 + random() * .34), size);
          transform.rotation.y = random() * Math.PI * 2;
          transform.updateMatrix();
          fronds.setMatrixAt(index, transform.matrix);
          fronds.setColorAt(index++, foliage.copy(roots).lerp(straw, random() * .79));
        }
      }
      fronds.count = index;
      fronds.computeBoundingSphere();
      fronds.receiveShadow = true;
      scene.add(fronds);
    }

    function depot() {
      const { bounds, entry } = D.WAREHOUSE;
      const face = bounds.maxX;
      const cladding = mat('#afc0b9', .77, {
        map: surfaceTexture('metal', true), opacity: .52, transparent: true, depthWrite: false, metalness: .17,
      });
      for (const [start, end] of [[230.07, 252.38], [261.72, 268.91]]) {
        const span = end - start;
        tilePanel(cladding, face + .176, 4.56, (start + end) / 2, span, 4.06, span / 5.53, .91, Math.PI / 2);
      }
      tileFloor(concrete, -33.5, .214, 257, 15.41, 23.45, 15.41 / 3.60, 23.45 / 3.60);
      const number = faded(wornLabel(T, 41903, ctx => floorLabel(ctx, '07', 'DEPOT / LOADING ZONE', false)));
      floorStencil(number, -32.5, .217, 265.737, 4.7, 2.55, Math.PI / 2);
      floorStencil(number, -35.06, .216, 248.0, 3.14, 1.66, Math.PI / 2);
      const paintedWall = faded(wornLabel(T, 5238, ctx => {
        ctx.fillStyle = '#ccb98b';
        ctx.font = '900 167px "Bahnschrift", "Arial Narrow", sans-serif';
        ctx.fillText('DEPOT 07', 20, 159, 475);
        ctx.font = '600 34px "Bahnschrift", sans-serif';
        ctx.fillText('白汐港务   /   S. TERMINAL', 27, 218, 458);
      }));
      placard(paintedWall, face + .219, 2.0, 237.14, 6.8, .97, Math.PI / 2);
      for (const z of [231.48, 248.32, 265.9]) {
        bar(paint, face + .253, .26, z, face + .253, 5.45, z, .127);
        bar(zinc, face + .253, 5.45, z, face + .51, 6.18, z, .129);
        for (const y of [.82, 3.28, 5.22]) box(rust, face + .275, y, z, .20, .077, .28);
      }
      for (const z of [244.85, 247.05]) {
        box(steel, face + .259, 2.08, z, .18, 1.15, 1.8);
        box(paint, face + .36, 2.08, z, .052, 1.0, 1.64);
        for (let h = 1.7; h < 2.58; h += .13) box(zinc, face + .395, h, z, .09, .033, 1.62);
      }
      for (const z of [250.73, 263.25]) {
        box(steel, face + 3.61, 4.54, z, 1.45, .14, .43);
        box(amber, face + 3.61, 4.448, z, 1.15, .07, .25);
      }
      fixture(face + 3.8, 4.43, entry.z + 1.3, '#ffc082', 66, 26);
      for (const x of [-73.69, -63.26]) {
        box(zinc, x, 5.4, 276.72, .36, 5.16, .43);
        box(steel, x, 3.03, 276.72, .62, .35, .69);
      }
      box(steel, -68.48, 8.04, 276.72, 12.0, .47, .51);
      box(zinc, -68.48, 8.81, 276.72, 12.0, .16, .39);
      for (let i = 0; i < 6; i++) {
        const x = -74.0 + i * 1.83;
        bar(zinc, x, 8.21, 276.72, x + 1.79, 8.79, 276.72, .095);
      }
      box(amber, -74.05, 7.76, 276.72, .36, .17, .30);
    }

    function roadstead() {
      // The ship sits outside the navigable harbor. The geometry is sparse at its viewing distance.
      const x = 817;
      const z = -124;
      const hull = new T.Mesh(freighterHull(T), mat('#ffffff', .73, { vertexColors: true }));
      hull.position.set(x, 0, z);
      scene.add(hull);
      box(steel, x, 5.12, z + 38, 14.9, 1.42, 28.1);
      box(enamel, x, 8.63, z + 37, 14.3, 5.91, 18.2);
      box(enamel, x, 13.22, z + 34.8, 15.4, 2.92, 6.2);
      box(steel, x, 14.76, z + 34.8, 15.73, .45, 6.69);
      box(steel, x, 13.54, z + 31.61, 14.2, .87, .096);
      box(steel, x, 15.15, z + 43.64, 4.49, 6.51, 4.65);
      box(rust, x, 17.99, z + 43.64, 4.57, 1.09, 4.73);
      for (const side of [-1, 1]) {
        box(steel, x + side * 7.79, 13.54, z + 34.62, .16, .87, 5.20);
        for (let i = 0; i < 4; i++) box(i % 3 ? steel : amber, x + side * 7.22, 9.11, z + 30.6 + i * 3.32, .15, 1.11, 1.56);
        box(amber, x + side * 6.8, 14.27, z + 30.98, .25, .31, .31);
        for (const end of [-39.2, 5.7, 49.5]) box(amber, x + side * 8.55, 5.91, z + end, .35, .42, .40);
      }
      for (let row = 0; row < 5; row++) {
        const pz = z - 42.5 + row * 13.9;
        for (let i = -1; i <= 1; i++) {
          const material = [paint, lifeOrange, brass, rust, zinc][(row * 3 + i + 5) % 5];
          box(material, x + i * 4.83, 5.74, pz, 4.48, 2.59, 12.8);
          if (row > 0 && (row + i) % 4 !== 0) box(material, x + i * 4.83, 8.30, pz, 4.48, 2.52, 12.8);
        }
      }
      pole(steel, x, 16.85, z + 33.1, .40, 5.3);
      bar(zinc, x - 3.6, 18.5, z + 33.1, x + 3.6, 18.5, z + 33.1, .16);
      pole(steel, x, 8.3, z - 53.1, .42, 5.91);
      box(amber, x, 11.33, z - 53.1, .36, .35, .36);
    }

    waterfront();
    headland();
    depot();
    roadstead();
  }

  D.addPortDetail = addPortDetail;
})();
