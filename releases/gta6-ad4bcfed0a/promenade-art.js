(() => {
  'use strict';

  const D = window.Tideline;
  const FIRST_Z = -110;
  const LAST_Z = 192;
  const DECK = .218;

  function addPromenadeDetail(api) {
    const { T, queue, box, ground, solid, bar, fixture, nightMaterials, lampPool, contactShade } = api;
    const random = D.rng(81637);
    const range = (a, b) => a + (b - a) * random();
    const material = (color, values) => new T.MeshStandardMaterial({ color, roughness: .82, ...values });

    function texture(width, height, draw) {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      draw(canvas.getContext('2d'), width, height);
      const map = new T.CanvasTexture(canvas);
      map.colorSpace = T.SRGBColorSpace;
      map.wrapS = map.wrapT = T.RepeatWrapping;
      map.anisotropy = 8;
      return map;
    }

    const pavers = texture(256, 256, (ctx, width, height) => {
      const image = ctx.createImageData(width, height);
      for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
          const i = (y * width + x) * 4;
          const row = Math.floor(y / 64);
          const col = Math.floor((x + (row % 2) * 32) / 64);
          const offset = (col * 5 + row * 7) % 11 - 5;
          const wash = (Math.cos(x * Math.PI / 32 + y / 30) + Math.sin(y * Math.PI / 64)) * 3;
          const grain = range(-10, 10);
          const line = Math.min(y % 64, (x + (row % 2) * 32) % 64);
          const age = (line < 2 ? -34 : line === 2 ? -13 : line === 3 ? 11 : 0) + offset + wash + grain;
          image.data[i] = 128 + age;
          image.data[i + 1] = 124 + age;
          image.data[i + 2] = 112 + age;
          image.data[i + 3] = 255;
        }
      }
      ctx.putImageData(image, 0, 0);
    });
    pavers.repeat.set(4, 113);
    const tactileMap = texture(128, 128, ctx => {
      ctx.scale(4 / 3, 4 / 3);
      ctx.fillStyle = '#ae8247';
      ctx.fillRect(0, 0, 96, 96);
      for (let y = 12; y < 96; y += 24) {
        for (let x = 12; x < 96; x += 24) {
          const n = range(-.7, .7);
          ctx.fillStyle = '#805c36';
          ctx.beginPath();
          ctx.arc(x + .8 + n, y + 1.1, 7.4, 0, 2 * Math.PI);
          ctx.fill();
          const stud = ctx.createRadialGradient(x - 2, y - 2, 0, x, y, 7.2);
          stud.addColorStop(0, '#cfa268');
          stud.addColorStop(.64, '#ae814e');
          stud.addColorStop(1, '#9b6f40');
          ctx.fillStyle = stud;
          ctx.beginPath();
          ctx.arc(x, y, 7.1, 0, 2 * Math.PI);
          ctx.fill();
        }
      }
    });
    tactileMap.repeat.set(1, 165);
    const boardGrain = D.rng(98017);
    const timberMap = texture(512, 512, (ctx, width, height) => {
      const image = ctx.createImageData(width, height);
      for (let y = 0; y < height; y += 1) {
        const v = y * Math.PI * 2 / height;
        for (let x = 0; x < width; x += 1) {
          const column = Math.floor(x / 64);
          const across = x % 64;
          const join = (y + 127 * column + 27) % height;
          const plankTone = (column * 9) % 17 - 8;
          const grainA = Math.sin(across * .7 + Math.sin(v * 2 + column) * 2.1);
          const grainB = Math.cos(across * 1.88 + Math.sin(v * 4 + column) * 1.33);
          const grain = grainA * 8 + grainB * 4 + (boardGrain() - .5) * 14;
          const age = Math.cos(v * 2 - column * 3 + across / 31) * 6 + Math.sin(v + column) * 5;
          const rim = Math.min(across, 64 - across);
          const seam = rim < 2 ? -36 : rim < 4 ? -14 : rim === 4 ? 8 : 0;
          const joint = join < 3 ? -26 : join === 3 ? -13 : join === 4 ? 7 : 0;
          const nail = join > 10 && join < 17 && (Math.abs(across - 12) < 2 || Math.abs(across - 51) < 2) ? -26 : 0;
          const wear = grain + age + plankTone + seam + joint + nail;
          const i = (y * width + x) * 4;
          image.data[i] = 137 + wear;
          image.data[i + 1] = 122 + wear;
          image.data[i + 2] = 104 + wear;
          image.data[i + 3] = 255;
        }
      }
      ctx.putImageData(image, 0, 0);
    });
    timberMap.repeat.set(10.65, 72);
    const stone = material('#c3bdb1', { map: pavers, roughness: .94 });
    const tactile = material('#f7e7cf', { map: tactileMap, roughness: .84 });
    const timber = material('#d6bea3', { map: timberMap, roughness: .80 });
    const slate = material('#303c42', { roughness: .72 });
    const iron = material('#223038', { roughness: .50, metalness: .64 });
    const ironEdge = material('#556869', { roughness: .40, metalness: .68 });
    const brassTrim = material('#c8a263', { roughness: .38, metalness: .72 });
    const limestone = material('#948b78', { roughness: .90 });
    const curb = material('#b5a992', { roughness: .85 });
    const mulch = material('#423a2e', { roughness: 1 });
    const terracotta = material('#8c5740', { roughness: .82 });
    const blossom = material('#e88a78', { roughness: .80 });
    const warmLamp = material('#ffe5a8', { emissive: '#ffba5c', emissiveIntensity: 1.75, roughness: .50 });
    const teak = material('#9e724d', { roughness: .64 });
    const leaf = material('#e6f1bd', { vertexColors: true, side: T.DoubleSide, roughness: .84 });
    nightMaterials.push([warmLamp, 3.65]);

    const length = LAST_Z - FIRST_Z;
    const midpoint = (FIRST_Z + LAST_Z) / 2;
    ground(stone, 303.05, midpoint, 9.16, length, DECK);
    ground(timber, 320.8, midpoint, 25.64, length, DECK);
    ground(tactile, 300.18, midpoint, .47, length, DECK + .004);
    ground(slate, 307.69, midpoint, .18, length, DECK + .002);
    ground(curb, 307.82, midpoint, .074, length, DECK + .008);
    for (const z of [-97, -48, 1, 47, 99, 147, 191]) {
      ground(slate, 307.66, z, .38, .76, DECK + .006);
      for (let slot = -3; slot <= 3; slot += 1) ground(ironEdge, 307.66, z + slot * .087, .283, .016, DECK + .01);
    }

    const barkMap = texture(128, 512, (ctx, width, height) => {
      const image = ctx.createImageData(width, height);
      for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
          const u = x / width * 2 * Math.PI;
          const warped = y + 1.2 * Math.sin(4 * u + y * .06) + 1.8 * Math.sin(8 * u - y * .031);
          const notch = (warped % 13 + 13) % 13;
          const scar = notch < 1.2 ? -33 : notch < 2.5 ? -17 : notch < 3.45 ? 15 : 0;
          const longitudinal = Math.cos(33 * u + y * .035) * 7 + Math.cos(65 * u - y * .046) * 6;
          const grain = range(-12, 12);
          const i = (y * width + x) * 4;
          image.data[i] = 111 + scar + longitudinal + grain;
          image.data[i + 1] = 92 + scar + longitudinal + grain;
          image.data[i + 2] = 73 + scar + longitudinal + grain;
          image.data[i + 3] = 255;
        }
      }
      ctx.putImageData(image, 0, 0);
    });
    const bark = material('#cfbd9d', { map: barkMap, roughness: .96, vertexColors: true });
    const fiber = material('#67654a', { roughness: .91 });
    const cap = new T.SphereGeometry(.5, 8, 5);
    const lampBase = new T.CylinderGeometry(.37, .53, 1, 10);
    const glassLens = new T.CylinderGeometry(.51, .44, 1, 8);
    const lampHat = new T.CylinderGeometry(.19, .57, 1, 8);
    const planterDrum = new T.CylinderGeometry(.5, .45, 1, 16);

    function trunkAxis(t) {
      return { x: .13 * t ** 1.8 - .061 * Math.sin(t * Math.PI), z: -.037 * Math.sin(t * Math.PI * .87) };
    }
    function trunkMesh(radial, scars) {
      const point = [];
      const uv = [];
      const colors = [];
      const index = [];
      const weathered = new T.Color('#d5c7a6');
      const fibrous = new T.Color('#867e58');
      for (let y = 0; y <= scars; y += 1) {
        const t = y / scars;
        const center = trunkAxis(t);
        const upperFiber = Math.max(0, (t - .78) / .22);
        for (let s = 0; s <= radial; s += 1) {
          const theta = 2 * Math.PI * s / radial;
          const swell = 1 + .062 * Math.sin(3 * theta + t * 17);
          const taper = .0198 + .0108 * (1 - t) ** 5 + .0105 * upperFiber ** 2;
          const scar = 1 + .09 * (y % 2);
          const radius = taper * swell * scar;
          point.push(center.x + radius * Math.cos(theta), t, center.z + radius * Math.sin(theta));
          uv.push(s / radial, t);
          const color = weathered.clone().lerp(fibrous, upperFiber * .7).multiplyScalar(.84 + .16 * swell);
          colors.push(...color.toArray());
          if (y === scars || s === radial) continue;
          const i = (radial + 1) * y + s;
          index.push(i, i + radial + 1, i + radial + 2, i, i + radial + 2, i + 1);
        }
      }
      const geo = new T.BufferGeometry();
      geo.setAttribute('position', new T.Float32BufferAttribute(point, 3));
      geo.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
      geo.setAttribute('color', new T.Float32BufferAttribute(colors, 3));
      geo.setIndex(index);
      geo.computeVertexNormals();
      return geo;
    }

    function frondMesh(pairCount, arch, droop, shades) {
      const points = [];
      const colors = [];
      const [stemColor, dark, raised, tipColor] = shades.map(value => new T.Color(value));
      const axis = t => [.034 * Math.sin(t * Math.PI), arch * Math.sin(t * Math.PI) - droop * t * t, t];
      function tri(a, b, c, ac, bc = ac, cc = ac) {
        points.push(...a, ...b, ...c);
        colors.push(ac.r, ac.g, ac.b, bc.r, bc.g, bc.b, cc.r, cc.g, cc.b);
      }
      for (let i = 0; i < 12; i += 1) {
        const a = axis(i / 12);
        const b = axis((i + 1) / 12);
        const aw = .0101 * (1 - i / 12) + .0015;
        const bw = .0101 * (1 - (i + 1) / 12) + .0011;
        tri([a[0] - aw, a[1], a[2]], [a[0] + aw, a[1], a[2]], [b[0] + bw, b[1], b[2]], stemColor);
        tri([a[0] - aw, a[1], a[2]], [b[0] + bw, b[1], b[2]], [b[0] - bw, b[1], b[2]], stemColor);
      }
      for (let i = 0; i < pairCount; i += 1) {
        for (const side of [-1, 1]) {
          const t = .15 + (i + (side > 0 ? .28 : 0)) * .79 / pairCount;
          const root = axis(t);
          const volume = Math.sin(Math.PI * (t - .08) / .92) ** .75;
          const span = (.197 + .05 * Math.cos(i * 1.77 + side)) * volume;
          const forward = (.159 - t * .058) * volume + .042;
          const sag = (.042 + .041 * (1 - t)) * volume + (side < 0 ? .009 : 0);
          const edge = (.010 + .006 * volume) * (18 / pairCount) ** .34;
          const tip = [root[0] + side * span, root[1] - sag, root[2] + forward];
          const ridge = [root[0] + side * span * .55, root[1] + .017 * volume, root[2] + forward * .50];
          const alongA = [root[0] + side * span * .37, root[1] - .007, root[2] + forward * .31 - edge];
          const alongB = [root[0] + side * span * .59, root[1] - .021 * volume, root[2] + forward * .58 + edge];
          const vein = raised.clone().multiplyScalar(.94 + .16 * Math.cos(i * .79));
          tri(root, alongA, ridge, dark, dark, vein);
          tri(alongA, tip, ridge, dark, tipColor, vein);
          tri(ridge, tip, alongB, vein, tipColor, dark);
          tri(ridge, alongB, root, vein, dark, dark);
        }
      }
      const geo = new T.BufferGeometry();
      geo.setAttribute('position', new T.Float32BufferAttribute(points, 3));
      geo.setAttribute('color', new T.Float32BufferAttribute(colors, 3));
      geo.computeVertexNormals();
      return geo;
    }

    const trunk = trunkMesh(9, 28);
    const distantTrunk = trunkMesh(8, 15);
    const fullFrond = frondMesh(17, .12, .29, ['#9d9f5f', '#496739', '#86a555', '#567b3f']);
    const crownFrond = frondMesh(14, .095, .15, ['#acaa64', '#5b783c', '#a4b762', '#668b43']);
    const distantFrond = frondMesh(9, .13, .31, ['#9d9f5f', '#4b683c', '#829d50', '#567b3f']);

    function agaveBlade() {
      const point = [], colors = [], index = [];
      const dark = new T.Color('#416149');
      const ridge = new T.Color('#93af85');
      const tip = new T.Color('#c1b47f');
      for (let i = 0; i <= 4; i += 1) {
        const t = i / 4;
        const width = Math.sin(Math.PI * t) ** .84 * .087 + .001;
        const height = .21 * Math.sin(t * Math.PI / 2) - .07 * t ** 4;
        point.push(-width, height, t, 0, height + width * .41, t, width, height, t);
        const edge = dark.clone().lerp(tip, t ** 5);
        const crest = ridge.clone().lerp(tip, t ** 6).multiplyScalar(.65 + .35 * t);
        colors.push(...edge.toArray(), ...crest.toArray(), ...edge.toArray());
        if (i === 4) continue;
        const v = i * 3;
        index.push(v, v + 3, v + 4, v, v + 4, v + 1, v + 1, v + 4, v + 5, v + 1, v + 5, v + 2);
      }
      const geo = new T.BufferGeometry();
      geo.setAttribute('position', new T.Float32BufferAttribute(point, 3));
      geo.setAttribute('color', new T.Float32BufferAttribute(colors, 3));
      geo.setIndex(index);
      geo.computeVertexNormals();
      return geo;
    }
    const blade = agaveBlade();

    function agave(x, y, z, size, turn) {
      for (let i = 0; i < 8; i += 1) {
        const reach = size * (.53 + .06 * i);
        queue(blade, leaf, x, y, z, reach, reach, reach, turn + i * 2.40, -.23 - (i % 4) * .242, (i % 3 - 1) * .21);
      }
    }
    function palm(x, z, height, rotation, detailed) {
      queue(detailed ? trunk : distantTrunk, bark, x, DECK, z, height, height, height, rotation);
      const upper = trunkAxis(1);
      const ax = x + height * (upper.x * Math.cos(rotation) + upper.z * Math.sin(rotation));
      const az = z + height * (upper.z * Math.cos(rotation) - upper.x * Math.sin(rotation));
      const ay = DECK + height;
      queue(cap, fiber, ax, ay - .19, az, height * .079, height * .102, height * .077, rotation);
      const primaryCount = detailed ? 9 : 7;
      for (let i = 0; i < primaryCount; i += 1) {
        const span = height * range(.31, .46);
        const angle = rotation + i * 2 * Math.PI / primaryCount + range(-.11, .11);
        queue(detailed ? fullFrond : distantFrond, leaf, ax, ay - (i % 3) * .11, az,
          span * range(.85, 1.15), span, span, angle, range(-.24, .13), range(-.13, .15));
      }
      for (let i = 0; i < (detailed ? 4 : 3); i += 1) {
        const span = height * range(.24, .38);
        queue(detailed ? crownFrond : distantFrond, leaf, ax, ay + .14, az,
          span * .88, span, span, rotation + i * 2.05 + .38, range(-.65, -.36));
      }
      if (detailed) {
        queue(planterDrum, ironEdge, x, DECK - .022, z, 1.32, .072, 1.42, rotation);
        queue(planterDrum, mulch, x, DECK + .018, z, 1.17, .061, 1.23, rotation);
        for (const [dx, dz] of [[-.36, -.42], [.33, .31]]) agave(x + dx, DECK + .065, z + dz, .48, rotation + dx);
      }
      if (contactShade) ground(contactShade, x, z, 2.2, 2.8, DECK + .002);
      solid(x, z, .49, .51, height, false);
    }

    const palms = [
      [318.9, -105.1, 7.86], [313.3, -84.7, 7.12], [320.8, -63.4, 7.45],
      [315.7, -45.3, 6.85], [319.1, -23.4, 8.21], [314.9, -3.3, 6.53],
      [319.6, 17.3, 8.49], [310.4, 39.7, 6.71], [318.0, 60.3, 7.53],
      [311.8, 80.1, 6.29], [321.2, 101.5, 8.03], [315.4, 118.1, 7.72],
      [311.9, 143.6, 6.86], [318.8, 157.9, 8.63], [313.1, 179.0, 7.21],
    ];
    for (const [x, z, height] of palms) palm(x, z, height, range(-Math.PI, Math.PI), z >= 101);

    function harborLamp(x, z, side) {
      const towardWalk = x + side * 1.71;
      queue(lampBase, iron, x, DECK + .20, z, .46, .4, .46);
      queue(lampBase, ironEdge, x, DECK + .48, z, .26, .16, .26);
      queue(lampBase, iron, x, DECK + 2.38, z, .168, 3.66, .168);
      const curve = [[x, 4.16], [x + .18 * side, 4.67], [x + .63 * side, 4.94], [x + 1.18 * side, 4.97], [towardWalk, 4.72]];
      for (let i = 1; i < curve.length; i += 1) {
        bar(iron, curve[i - 1][0], curve[i - 1][1], z, curve[i][0], curve[i][1], z, .105);
      }
      queue(lampBase, brassTrim, x, DECK + .59, z, .24, .06, .24);
      queue(lampBase, brassTrim, x, DECK + 3.92, z, .21, .07, .21);
      bar(ironEdge, x + .06 * side, 3.92, z, x + .72 * side, 4.78, z, .055);
      queue(lampHat, iron, towardWalk, 4.67, z, .72, .26, .72);
      queue(lampBase, brassTrim, towardWalk, 4.82, z, .16, .11, .16);
      queue(glassLens, warmLamp, towardWalk, 4.48, z, .52, .32, .52);
      queue(lampBase, iron, towardWalk, 4.30, z, .46, .09, .46);
      if (lampPool) ground(lampPool, towardWalk - .36, z, 7.25, 8.05, DECK + .003);
      fixture?.(towardWalk, 4.39, z, '#ffba6b', 42, 23);
      solid(x, z, .44, .44, 4.7, false);
    }
    for (const [x, z, side] of [[309.1, -96, -1], [329, -76, -1], [310.7, -45, -1], [329, -20, -1],
      [309.1, 10.8, -1], [330.1, 44, -1], [309.2, 64, -1], [330.1, 91, -1],
      [309.1, 120.3, -1], [327, 135.3, -1], [309.2, 157.2, -1], [330.7, 184.8, -1]]) {
      harborLamp(x, z, side);
    }

    function seat(x, z) {
      if (contactShade) ground(contactShade, x, z, 1.8, 3.96, DECK + .002);
      for (const zSide of [-1.1, 1.1]) {
        bar(iron, x - .32, DECK, z + zSide, x - .21, DECK + .49, z + zSide, .073, .084);
        bar(iron, x + .29, DECK, z + zSide, x + .23, DECK + .48, z + zSide, .066, .081);
        bar(iron, x - .44, DECK + .97, z + zSide, x - .23, DECK + .42, z + zSide, .078);
        bar(ironEdge, x - .32, DECK + .72, z + zSide, x + .26, DECK + .68, z + zSide, .075);
        box(iron, x, DECK + .43, z + zSide, .62, .069, .13);
      }
      for (let i = 0; i < 5; i += 1) box(teak, x - .24 + i * .117, DECK + .5, z, .094, .067, 2.78);
      for (let i = 0; i < 4; i += 1) box(teak, x - .33 - i * .027, DECK + .68 + i * .093, z, .049, .076, 2.78);
      for (const zSide of [-1.1, 1.1]) {
        box(brassTrim, x + .24, DECK + .68, z + zSide, .07, .07, .09);
        box(brassTrim, x - .30, DECK + .72, z + zSide, .07, .07, .09);
      }
      solid(x - .04, z, .70, 2.78, 1.2, false);
    }
    function garden(x, z, tint) {
      if (contactShade) ground(contactShade, x, z, 3.16, 4.87, DECK + .002);
      queue(planterDrum, limestone, x, DECK + .29, z, 1.68, .55, 3.12);
      queue(planterDrum, curb, x, DECK + .54, z, 1.79, .116, 3.23);
      queue(planterDrum, mulch, x, DECK + .60, z, 1.55, .034, 2.92);
      agave(x, DECK + .60, z - .67, .64, .65 + tint);
      agave(x + .17, DECK + .60, z + .18, .71, 3.3 - tint);
      agave(x - .17, DECK + .60, z + .90, .47, 1.11 + tint);
      // Warm coastal bougainvillea flower clusters nestled among the agaves
      for (const [dx, dz] of [[-.26, -.28], [.22, .56], [-.18, 1.08]]) {
        queue(cap, blossom, x + dx, DECK + .74, z + dz, .26, .20, .26, tint);
      }
      solid(x, z, 1.68, 3.09, .81, false);
    }
    // Wrought-iron waterfront balustrade along sea edge (leaves openings for piers & night market)
    const railX = 333.35;
    for (const [zStart, zEnd] of [[-106, -42], [-28, 28], [52, 99], [131, 186]]) {
      const span = zEnd - zStart;
      const mid = (zStart + zEnd) / 2;
      box(teak, railX, DECK + .96, mid, .11, .055, span);
      box(iron, railX, DECK + .90, mid, .06, .045, span);
      box(iron, railX, DECK + .26, mid, .055, .045, span);
      box(ironEdge, railX, DECK + .58, mid, .032, .032, span);
      for (let pz = zStart; pz <= zEnd + .1; pz += 3.5) {
        box(iron, railX, DECK + .48, pz, .095, .92, .095);
        box(brassTrim, railX, DECK + 1.00, pz, .11, .045, .11);
      }
    }
    for (const [x, z] of [[325.8, 132.4], [328.2, 82.4], [325.5, 36.4], [328, -27.3], [325.3, -81.0]]) {
      seat(x, z);
      garden(x - .55, z + 3.5, range(-1.1, 1.1));
    }
    for (const [x, z] of [[326.8, 143.8], [325.45, 41.95], [328.2, -22.9]]) {
      queue(planterDrum, iron, x, DECK + .4, z, .55, .79, .55);
      queue(planterDrum, ironEdge, x, DECK + .784, z, .584, .115, .58);
      box(terracotta, x, DECK + .648, z - .273, .266, .132, .029);
      solid(x, z, .47, .47, .81, false);
    }
  }

  Object.assign(D, { addPromenadeDetail });
})();
