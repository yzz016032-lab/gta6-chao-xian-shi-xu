(() => {
  'use strict';

  const D = window.Tideline;
  const PI = Math.PI;
  const signLayouts = [
    { title: '南埠货检', caption: 'SOUTH TERMINAL', code: '02', background: '#233632', edge: '#d9aa72' },
    { title: '货件交接', caption: 'NIGHT TRANSFER', code: 'B', background: '#233632', edge: '#d9aa72' },
    { title: '北桥信号站', caption: 'NORTH BRIDGE RELAY', code: '04', background: '#193940', edge: '#a4d7d7' },
    { title: '检修台', caption: 'RELAY CONTROL', code: '04', background: '#193940', edge: '#a4d7d7' },
    { title: '北桥起跑线', caption: 'HARBOR LOOP START', code: '', background: '#143537', edge: '#a3e4d1' },
    { title: '计时', caption: 'TIMING', code: '', background: '#143537', edge: '#a3e4d1' },
  ];

  function signAtlas(T, nightMaterials) {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    const random = D.rng(809018);
    const panels = [];
    for (const [index, panel] of signLayouts.entries()) {
      const x = (index % 2) * 512;
      const y = Math.floor(index / 2) * 128;
      ctx.save();
      ctx.translate(x, y);
      ctx.fillStyle = panel.background;
      ctx.fillRect(0, 0, 512, 128);
      const wear = ctx.createLinearGradient(0, 0, 0, 124);
      wear.addColorStop(0, 'rgba(225,240,215,.05)');
      wear.addColorStop(.52, 'rgba(11,22,25,.04)');
      wear.addColorStop(1, 'rgba(11,22,25,.27)');
      ctx.fillStyle = wear;
      ctx.fillRect(8, 8, 496, 112);
      ctx.fillStyle = panel.edge;
      ctx.fillRect(13, 16, 4, 93);
      ctx.fillRect(21, 108, 30, 1.7);
      ctx.fillStyle = '#e5e3d2';
      ctx.font = '700 47px "Microsoft YaHei UI", "Noto Sans CJK SC", sans-serif';
      ctx.fillText(panel.title, 31, 70, panel.code ? 357 : 436);
      ctx.fillStyle = panel.edge;
      ctx.font = '700 19px Bahnschrift, "Arial Narrow", sans-serif';
      ctx.fillText(panel.caption, 33, 97, 370);
      if (panel.code) {
        ctx.strokeStyle = panel.edge;
        ctx.lineWidth = 1.6;
        ctx.strokeRect(410, 26, 73, 64);
        ctx.font = '700 37px Bahnschrift, "Arial Narrow", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(panel.code, 446, 70);
        ctx.textAlign = 'start';
      } else {
        ctx.strokeStyle = panel.edge;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(447, 34);
        ctx.lineTo(478, 57);
        ctx.lineTo(447, 80);
        ctx.stroke();
      }
      for (let speck = 0; speck < 280; speck++) {
        ctx.fillStyle = speck % 3 ? 'rgba(12,26,27,.13)' : 'rgba(222,206,157,.12)';
        ctx.fillRect(9 + random() * 494, 9 + random() * 109, .6 + random() * 3.4, .5 + random() * 1.8);
      }
      ctx.restore();
      panels.push([(x + 9) / 1024, 1 - (y + 119) / 512, 494 / 1024, 110 / 512]);
    }
    const map = new T.CanvasTexture(canvas);
    map.colorSpace = T.SRGBColorSpace;
    map.anisotropy = 2;
    const material = new T.MeshStandardMaterial({
      map, emissiveMap: map, emissive: '#cfe8df', emissiveIntensity: .38, roughness: .64,
    });
    nightMaterials.push([material, 1.72]);
    return { material, panels };
  }

  function startPaint(T) {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    const random = D.rng(28411);
    ctx.fillStyle = '#e2dfcc';
    ctx.fillRect(0, 3, 512, 4);
    ctx.fillRect(0, 57, 512, 4);
    for (let i = 0; i < 20; i++) {
      ctx.fillStyle = i % 2 ? '#d9ddc7' : '#b6c5be';
      ctx.fillRect(i * 25.6 + 2, i % 2 ? 31 : 12, 23.6, 20);
    }
    ctx.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < 610; i++) {
      ctx.fillStyle = i % 4 ? 'rgba(0,0,0,.52)' : 'rgba(0,0,0,.88)';
      ctx.fillRect(random() * 512, random() * 64, .4 + random() * 3.1, .4 + random() * 2.2);
    }
    const map = new T.CanvasTexture(canvas);
    map.colorSpace = T.SRGBColorSpace;
    map.anisotropy = 2;
    return new T.MeshStandardMaterial({ color: '#c0c4b5', map, alphaTest: .35, roughness: .92 });
  }

  function addStoryLandmarks({ T, scene, box, ground, bar, nightMaterials, surfaceTexture, fixture }) {
    const metal = surfaceTexture('metal', true);
    const concrete = surfaceTexture('pavement', true);
    const material = (color, roughness, other = {}) => new T.MeshStandardMaterial({ color, roughness, ...other });
    const steel = material('#394b51', .68, { metalness: .27 });
    const zinc = material('#87928c', .72, { metalness: .28 });
    const graphite = material('#202b31', .86);
    const fadedOrange = material('#c26e3a', .66, { metalness: .22 });
    const oldPaint = material('#d4c2a3', .76);
    const siding = material('#78a399', .76, { map: metal, metalness: .20 });
    const apron = material('#a3a49b', .91, { map: concrete });
    const tintedGlass = material('#2c4b58', .24, { metalness: .30 });
    const litGlass = material('#969d88', .36, { emissive: '#c2925d', emissiveIntensity: .24, metalness: .12 });
    const warm = material('#ffe5ba', .45, { emissive: '#ffbd69', emissiveIntensity: .46 });
    const cyan = material('#9cf2e6', .42, { emissive: '#5de8d8', emissiveIntensity: .48 });
    const red = material('#e06850', .48, { emissive: '#ff4e32', emissiveIntensity: .44 });
    nightMaterials.push([warm, 2.45], [cyan, 2.25], [red, 2.15], [litGlass, .92]);
    const signs = signAtlas(T, nightMaterials);
    const signPositions = [], signNormals = [], signUvs = [], signIndices = [];
    function placeSign(index, x, y, z, w, h, yaw) {
      const [u0, v0, du, dv] = signs.panels[index];
      const cosine = Math.cos(yaw);
      const sine = Math.sin(yaw);
      const first = signPositions.length / 3;
      for (const [u, v] of [[0, 0], [1, 0], [1, 1], [0, 1]]) {
        const offset = (u - .5) * w;
        signPositions.push(x + cosine * offset, y + (v - .5) * h, z - sine * offset);
        signNormals.push(sine, 0, cosine);
        signUvs.push(u0 + du * u, v0 + dv * v);
      }
      signIndices.push(first, first + 1, first + 2, first, first + 2, first + 3);
    }
    function finishSigns() {
      const geometry = new T.BufferGeometry();
      geometry.setAttribute('position', new T.Float32BufferAttribute(signPositions, 3));
      geometry.setAttribute('normal', new T.Float32BufferAttribute(signNormals, 3));
      geometry.setAttribute('uv', new T.Float32BufferAttribute(signUvs, 2));
      geometry.setIndex(signIndices);
      const mesh = new T.Mesh(geometry, signs.material);
      mesh.receiveShadow = true;
      scene.add(mesh);
      signPositions.length = signNormals.length = signUvs.length = signIndices.length = 0;
    }

    function freightGate() {
      // Cladding and anchors dress the existing east wall. The canopy stops well before the traffic lanes.
      const faceX = -130.7795;
      const canopyFront = -124.6;
      box(siding, faceX + .067, 5.42, 229.08, .13, 3.30, 25.92);
      box(graphite, faceX + .13, 6.89, 229.08, .22, .17, 25.95);
      box(zinc, faceX + .16, 7.00, 229.08, .33, .08, 26.18);
      box(apron, -127.44, .192, 229.4, 6.64, .02, 25.26);
      box(steel, -127.67, 4.42, 229.15, 6.22, .25, 24.82, 0, 0, -.03);
      box(zinc, -127.7, 4.57, 229.15, 6.33, .09, 24.92, 0, 0, -.03);
      box(fadedOrange, canopyFront, 4.35, 229.15, .23, .47, 24.91);
      box(graphite, canopyFront + .16, 4.14, 229.15, .21, .14, 25.04);
      box(steel, -127.6, 5.64, 216.73, 6.3, 1.24, .19);
      box(fadedOrange, -127.6, 6.29, 216.73, 6.52, .12, .26);
      box(graphite, -127.6, 5.00, 216.73, 6.50, .16, .29);
      placeSign(0, -127.6, 5.64, 216.62, 6.06, 1.11, PI);
      for (const x of [-130.2, -125.0]) {
        box(steel, x, 4.78, 216.84, .19, 1.03, .22);
        bar(steel, x, 4.58, 218.24, x, 5.23, 216.86, .105);
      }
      box(steel, canopyFront + .15, 4.90, 231.45, .23, 1.39, 9.55);
      placeSign(1, canopyFront + .278, 4.90, 231.45, 9.26, 1.27, PI / 2);
      for (const z of [217.67, 227.0, 240.89]) {
        box(graphite, canopyFront - .64, .36, z, .76, .36, .75);
        box(steel, canopyFront - .64, 2.27, z, .35, 3.86, .35);
        box(zinc, canopyFront - .64, 4.16, z, .55, .16, .56);
        bar(steel, canopyFront - .69, 3.12, z, canopyFront - 2.36, 4.14, z, .12);
        box(steel, -127.83, 4.17, z, 5.6, .19, .20);
        box(oldPaint, canopyFront - .442, .65, z, .065, .24, .25);
      }
      for (const z of [221.3, 229.6, 237.82]) {
        box(steel, faceX + .13, 2.12, z, .30, 3.77, 5.55);
        box(graphite, faceX + .287, 2.02, z, .12, 3.35, 5.03);
        box(siding, faceX + .356, 2.02, z, .066, 3.19, 4.80);
        for (let i = 0; i < 11; i++) {
          box(i % 3 ? zinc : steel, faceX + .401, .53 + i * .29, z, .035, .032, 4.78);
        }
        for (const edge of [-2.47, 2.47]) {
          box(steel, faceX + .402, 1.89, z + edge, .19, 3.45, .18);
          box(fadedOrange, faceX + .9, .62, z + edge, .27, .90, .23);
        }
        box(graphite, faceX + .49, 3.64, z, .26, .18, 4.88);
        box(z === 229.6 ? cyan : red, faceX + .63, 3.64, z + 2.15, .07, .12, .12);
        box(warm, -127.63, 4.232, z, .16, .048, 3.45);
        box(graphite, -127.63, 4.30, z, .25, .12, 3.62);
        box(oldPaint, faceX + .437, .71, z, .036, .09, 3.91);
      }
      for (const z of [219.2, 224.16, 229.13, 234.09, 239.05]) {
        box(graphite, faceX + .171, 6.07, z, .17, 1.12, 4.31);
        box(tintedGlass, faceX + .266, 6.07, z, .035, .91, 4.08);
        box(steel, faceX + .298, 6.07, z, .11, .08, 4.13);
      }
      box(siding, faceX + .72, .90, 242.03, 1.14, 1.42, .85);
      box(graphite, faceX + 1.31, .91, 242.03, .10, 1.26, .69);
      box(fadedOrange, faceX + 1.37, 1.23, 242.0, .058, .09, .39);
      box(warm, faceX + 1.399, 1.35, 242.23, .049, .07, .065);
      ground(oldPaint, -124.28, 229.31, .086, 24.06, .216);
      fixture(-126.22, 4.18, 231.45, '#ffd097', 65, 22);
    }

    function signalStation() {
      const x = 113.25;
      const z = -180.78;
      box(apron, x, .224, z, 10.16, .07, 7.16);
      box(graphite, x, .41, z, 9.15, .29, 5.87);
      box(siding, x, 1.92, z, 8.96, 3.05, 5.64);
      box(steel, x, 3.40, z, 9.24, .35, 5.91);
      box(zinc, x, 3.63, z, 9.55, .17, 6.22);
      box(graphite, x + .25, 3.80, z + .10, 8.42, .16, 5.70);
      box(steel, x - .63, 4.01, z - 3.17, 7.36, 1.22, .24);
      placeSign(2, x - .63, 4.01, z - 3.304, 7.15, 1.07, PI);
      box(steel, x - 4.62, 2.99, z - .91, .20, .94, 3.5);
      placeSign(3, x - 4.734, 2.99, z - .91, 3.34, .80, -PI / 2);
      box(cyan, x - .14, 3.25, z - 3.035, 8.02, .048, .046);
      for (const side of [-1, 1]) {
        box(zinc, x + side * 4.49, 1.87, z - 2.818, .16, 2.99, .16);
        box(graphite, x + side * 4.46, 1.89, z, .19, 1.58, 4.25);
        box(litGlass, x + side * 4.57, 1.89, z, .054, 1.37, 4.02);
        for (const mullion of [-1.33, 0, 1.33]) box(zinc, x + side * 4.611, 1.89, z + mullion, .086, 1.42, .066);
        box(steel, x + side * 4.626, 1.14, z, .139, .077, 4.16);
        box(cyan, x + side * 4.645, 3.23, z + .041, .041, .044, 4.65);
      }
      box(steel, x + 4.62, 2.99, z - .91, .20, .94, 3.51);
      placeSign(3, x + 4.733, 2.99, z - .91, 3.37, .80, PI / 2);
      box(steel, x - 2.75, 1.69, z - 2.95, 2.1, 2.58, .19);
      box(tintedGlass, x - 2.75, 2.08, z - 3.06, 1.61, 1.65, .058);
      box(zinc, x - 2.17, 1.56, z - 3.13, .09, .29, .10);
      box(graphite, x + 1.20, 2.02, z - 2.944, 5.37, 1.89, .23);
      box(litGlass, x + 1.20, 2.02, z - 3.082, 5.11, 1.63, .055);
      for (const offset of [-1.45, .30, 2.04, 3.75]) box(zinc, x + offset, 2.02, z - 3.126, .072, 1.75, .069);
      box(steel, x + 1.21, 1.77, z - 3.121, 5.23, .077, .082);
      box(graphite, x + 2.11, 1.61, z - 3.122, 1.44, .38, .058);
      box(warm, x + 1.88, 1.70, z - 3.16, .66, .044, .027);
      box(cyan, x + 2.57, 1.70, z - 3.16, .25, .044, .031);
      box(graphite, x - 2.75, .305, z - 3.16, 2.15, .12, .64);

      const mastX = 115.65;
      const mastZ = -179.80;
      const heights = [3.91, 6.1, 8.42, 10.63, 12.57];
      const radii = [.88, .74, .58, .42, .28];
      const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
      const point = (level, corner) => [
        mastX + corners[corner][0] * radii[level], heights[level], mastZ + corners[corner][1] * radii[level],
      ];
      box(steel, mastX, 3.94, mastZ, 2.30, .17, 2.23);
      for (let level = 0; level < heights.length; level++) {
        for (let i = 0; i < corners.length; i++) {
          const j = (i + 1) % corners.length;
          bar(zinc, ...point(level, i), ...point(level, j), .085);
          if (level + 1 === heights.length) continue;
          bar(steel, ...point(level, i), ...point(level + 1, i), .115);
          bar(zinc, ...point(level, i), ...point(level + 1, j), .068);
          if (level < 2) bar(zinc, ...point(level, j), ...point(level + 1, i), .062);
        }
      }
      bar(steel, mastX, 11.81, mastZ, mastX, 14.12, mastZ, .117);
      box(red, mastX, 14.11, mastZ, .28, .28, .28);
      box(cyan, mastX, 8.42, mastZ, 1.24, .09, 1.24);
      box(cyan, mastX, 10.63, mastZ, .92, .08, .92);
      for (const [y, angle] of [[11.86, .18], [13.04, -.46]]) {
        const xAxis = Math.cos(angle);
        const zAxis = Math.sin(angle);
        const along = s => [mastX + s * xAxis, mastZ + s * zAxis];
        const [ax, az] = along(-1.1);
        const [bx, bz] = along(1.4);
        bar(steel, ax, y, az, bx, y, bz, .068);
        for (const offset of [-.90, -.47, -.05, .36, .77, 1.19]) {
          const [px, pz] = along(offset);
          const width = .41 - offset * .083;
          bar(zinc, px - zAxis * width, y + .019, pz + xAxis * width,
            px + zAxis * width, y + .019, pz - xAxis * width, .045);
        }
      }
      bar(steel, x + 3.96, 3.47, z + 1.47, x + 3.96, 1.17, z + 1.47, .112);
      box(graphite, x + 4.52, 1.10, z + 1.44, .28, .72, 1.19);
      fixture(x - .6, 3.02, z - 3.60, '#a6e4d5', 52, 19);
    }

    function raceTiming() {
      const x = 299.52;
      const z = -84.81;
      const yaw = -1.017;
      const grid = startPaint(T);
      ground(grid, 286.01, -84.58, 14.41, 1.36, .037);
      for (const offset of [-1.98, 1.98]) {
        const atX = x + Math.cos(yaw) * offset;
        const atZ = z - Math.sin(yaw) * offset;
        box(apron, atX, .25, atZ, .84, .14, .78, yaw);
        box(graphite, atX, .43, atZ, .58, .32, .52, yaw);
        box(steel, atX, 2.41, atZ, .23, 3.97, .28, yaw);
        box(zinc, atX - .034, 4.22, atZ, .32, .51, .33, yaw);
        box(fadedOrange, atX, .72, atZ, .28, .14, .33, yaw);
      }
      box(steel, x, 4.68, z, 5.72, 1.35, .37, yaw);
      box(zinc, x, 5.41, z, 5.94, .137, .48, yaw);
      box(graphite, x, 3.98, z, 5.83, .147, .47, yaw);
      const nx = Math.sin(yaw);
      const nz = Math.cos(yaw);
      placeSign(4, x + nx * .20, 4.69, z + nz * .20, 5.46, 1.22, yaw);
      placeSign(4, x - nx * .20, 4.69, z - nz * .20, 5.46, 1.22, yaw + PI);
      box(cyan, x + nx * .221, 3.95, z + nz * .221, 5.69, .055, .05, yaw);
      for (const [idx, offset] of [-1.86, -.93, 0, .93, 1.86].entries()) {
        const atX = x + Math.cos(yaw) * offset;
        const atZ = z - Math.sin(yaw) * offset;
        box(graphite, atX, 3.76, atZ, .36, .34, .30, yaw);
        box(idx === 2 ? cyan : red, atX + nx * .162, 3.83, atZ + nz * .162, .16, .09, .04, yaw);
        box(warm, atX + nx * .162, 3.69, atZ + nz * .162, .16, .09, .04, yaw);
      }
      const cabinetZ = -80.33;
      box(steel, 299.27, 1.17, cabinetZ, .72, 1.85, 1.31);
      box(zinc, 299.27, 2.14, cabinetZ, .84, .12, 1.40);
      box(graphite, 298.877, 1.29, cabinetZ, .10, 1.35, 1.09);
      placeSign(5, 298.819, 1.55, cabinetZ, .98, .335, -PI / 2);
      box(cyan, 298.813, 1.26, cabinetZ + .31, .052, .072, .073);
      box(warm, 298.813, 1.26, cabinetZ + .17, .052, .072, .073);
      fixture(298.65, 3.73, z - .12, '#8ee4d6', 48, 18);
    }

    for (const buildLandmark of [freightGate, signalStation, raceTiming]) {
      buildLandmark();
      finishSigns();
    }
  }

  D.addStoryLandmarks = addStoryLandmarks;
})();
