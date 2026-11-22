(() => {
  'use strict';

  const D = window.Tideline;
  const EAST = Math.PI / 2;
  const FLOOR = .202;
  const kits = new WeakMap();
  const shutters = { crop: [557, 124, 981, 502], posts: [], rails: [], metal: true };
  const panels = {
    teal: { crop: [37, 42, 489, 507], posts: [.499], rails: [.86, .27] },
    oak: { crop: [12, 524, 503, 1018], posts: [.310, .552, .788], rails: [.862] },
    blue: { crop: [520, 523, 1015, 1014], posts: [.333, .665], rails: [.846, .268] },
    shutter: shutters,
    shutterReverse: { ...shutters, mirrored: true },
    frosted: { posts: [.335, .665], rails: [.784] },
  };
  const windowCrops = [
    [50, 23, 462, 421], [562, 23, 974, 421],
    [50, 535, 462, 936], [562, 535, 974, 936],
  ];

  const rows = {
    2: [
      { offset: -18.1, depth: 31.2, width: 25, floors: 3, skin: 'rose', name: '旧灯海产', detail: 'LANTERN FISH MARKET', ink: '#ffd193', bays: 5, awning: true,
        frontage: [['teal', 'shutter'], ['oak', 'frosted'], ['blue', 'teal']] },
      { offset: 18.3, depth: 31.5, width: 26, floors: 5, skin: 'slate', name: '白汐邮局', detail: 'BAI XI POST', ink: '#a8e2df', bays: 5, balconies: true,
        frontage: [['frosted', 'blue'], ['oak', 'frosted'], ['frosted', 'blue']] },
    ],
    3: [
      { offset: -20.4, depth: 34.5, width: 26.5, floors: 6, skin: 'limestone', name: '深湾旅馆', detail: 'DEEP BAY HOTEL', ink: '#ffd394', bays: 6, balconies: true, corner: true,
        frontage: [['blue', 'frosted'], ['oak', 'teal'], ['frosted', 'blue']] },
      { offset: 20.5, depth: 33.2, width: 26, floors: 4, skin: 'seafoam', name: '潮汽冰室', detail: 'TIDE CANTEEN', ink: '#8ff5e3', bays: 6, awning: true, terraces: true,
        frontage: [['teal', 'oak'], ['frosted', 'blue'], ['teal', 'shutter']] },
    ],
    4: [
      { offset: 23.0, depth: 28.7, width: 24, floors: 4, skin: 'rose', name: '风信照相馆', detail: 'WIND PHOTO STUDIO', ink: '#ffcea6', bays: 5, awning: true, balconies: true,
        frontage: [['blue', 'frosted'], ['oak', 'frosted'], ['teal', 'blue']] },
    ],
  };

  function surface(T, size, draw, height = size) {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = height;
    draw(canvas.getContext('2d'));
    const texture = new T.CanvasTexture(canvas);
    texture.colorSpace = T.SRGBColorSpace;
    texture.wrapS = texture.wrapT = T.RepeatWrapping;
    texture.anisotropy = 4;
    return texture;
  }

  function workshopEnamel(T) {
    return surface(T, 768, ctx => {
      const ink = '#e9d8ac';
      const base = ctx.createLinearGradient(0, 0, 0, 224);
      base.addColorStop(0, '#285156');
      base.addColorStop(.48, '#1c4145');
      base.addColorStop(1, '#17373b');
      ctx.fillStyle = base;
      ctx.fillRect(0, 0, 768, 224);
      ctx.strokeStyle = '#b4a67f';
      ctx.lineWidth = 2.5;
      ctx.strokeRect(9, 9, 750, 206);
      ctx.fillStyle = '#cd7352';
      ctx.fillRect(16, 195, 736, 7);

      // A spanner and two tide lines form the workshop's enamel badge.
      ctx.save();
      ctx.translate(102, 101);
      ctx.strokeStyle = ink;
      ctx.lineWidth = 4.5;
      ctx.beginPath();
      ctx.arc(0, 0, 63, 0, Math.PI * 2);
      ctx.stroke();
      for (const y of [19, 29]) {
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        ctx.moveTo(-40, y);
        ctx.bezierCurveTo(-24, y - 12, -10, y + 10, 6, y);
        ctx.bezierCurveTo(22, y - 11, 32, y + 2, 41, y - 5);
        ctx.stroke();
      }
      ctx.translate(-1, -13);
      ctx.rotate(.72);
      ctx.fillStyle = ink;
      ctx.beginPath();
      ctx.moveTo(-6, 33);
      ctx.lineTo(-7, -5);
      ctx.bezierCurveTo(-24, -16, -18, -33, -8, -38);
      ctx.lineTo(-7, -23);
      ctx.lineTo(3, -18);
      ctx.lineTo(11, -25);
      ctx.lineTo(10, -39);
      ctx.bezierCurveTo(23, -30, 21, -11, 7, -5);
      ctx.lineTo(6, 33);
      ctx.arc(0, 33, 6, 0, Math.PI);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      ctx.fillStyle = ink;
      ctx.font = '900 81px "Microsoft YaHei UI", "PingFang SC", "Noto Sans CJK SC", sans-serif';
      ctx.textBaseline = 'middle';
      ctx.fillText('潮汛修车铺', 195, 88, 525);
      ctx.fillStyle = '#d4ae7f';
      ctx.font = 'bold 28px "Arial Narrow", "Microsoft YaHei UI", sans-serif';
      ctx.fillText('T I D E   A U T O   W O R K S', 199, 159, 523);
      const wear = D.rng(4827);
      for (let i = 0; i < 180; i++) {
        ctx.fillStyle = i % 3 ? '#e6ddd715' : '#101c1a24';
        ctx.fillRect(wear() * 768, wear() * 224, 1 + wear() * 5, .8 + wear() * 1.4);
      }
      for (const x of [21, 747]) for (const y of [22, 181]) {
        ctx.fillStyle = '#122728';
        ctx.fillRect(x - 2, y - 2, 5, 5);
        ctx.fillStyle = '#b3a68a';
        ctx.fillRect(x - 1, y - 1, 3, 2);
      }
    }, 224);
  }

  function panelGeometry(T, [left, top, right, bottom], mirrored) {
    const edge = 1024;
    const geometry = new T.PlaneGeometry(1, 1);
    const uv = geometry.attributes.uv;
    for (let i = 0; i < uv.count; i++) {
      const u = mirrored ? 1 - uv.getX(i) : uv.getX(i);
      uv.setXY(i, (left + u * (right - left)) / edge, 1 - (bottom - uv.getY(i) * (bottom - top)) / edge);
    }
    return geometry;
  }

  function cornerPlan(west, east, north, south, radius = 0) {
    const points = [[west, north], [west, south]];
    if (radius) {
      for (let i = 0; i <= 6; i++) {
        const a = (6 - i) * Math.PI / 12;
        points.push([east - radius + radius * Math.cos(a), south - radius + radius * Math.sin(a)]);
      }
    } else points.push([east, south]);
    points.push([east, north]);
    return points;
  }

  // Bake each building's different floor shapes and their soffits into one textured stone mesh.
  function concreteMesh(T) {
    const positions = [], normals = [], colors = [], uvs = [], indices = [];
    const palette = new Map();
    let offsetX = 0, offsetZ = 0;
    function offset(x, z) { offsetX = x; offsetZ = z; }
    function vertex(p, height, nx, ny, nz, tint) {
      if (!palette.has(tint)) palette.set(tint, new T.Color(tint));
      const color = palette.get(tint);
      const index = positions.length / 3;
      positions.push(p[0] + offsetX, height, p[1] + offsetZ);
      normals.push(nx, ny, nz);
      colors.push(color.r, color.g, color.b);
      uvs.push(p[0], p[1]);
      return index;
    }
    function edgeNormals(path) {
      return path.map((a, i) => {
        const b = path[(i + 1) % path.length];
        const dx = b[0] - a[0], dz = b[1] - a[1], length = Math.hypot(dx, dz);
        return [-dz / length, dx / length];
      });
    }
    function blend(a, b) {
      if (a[0] * b[0] + a[1] * b[1] < .951) return a;
      const x = a[0] + b[0], z = a[1] + b[1], scale = Math.hypot(x, z);
      return [x / scale, z / scale];
    }
    function wallFace(a, b, nA, nB, low, high, tint) {
      const first = vertex(a, low, nA[0], 0, nA[1], tint);
      vertex(b, low, nB[0], 0, nB[1], tint);
      vertex(b, high, nB[0], 0, nB[1], tint);
      vertex(a, high, nA[0], 0, nA[1], tint);
      indices.push(first, first + 1, first + 2, first, first + 2, first + 3);
    }
    function prism(path, low, high, side, cap = side, soffit = side) {
      const count = path.length;
      const face = edgeNormals(path);
      const bottom = path.map(p => vertex(p, low, 0, -1, 0, soffit));
      const top = path.map(p => vertex(p, high, 0, 1, 0, cap));
      for (let i = 1; i < count - 1; i++) {
        indices.push(top[0], top[i], top[i + 1], bottom[0], bottom[i + 1], bottom[i]);
      }
      for (let i = 0; i < count; i++) {
        const next = (i + 1) % count;
        const a = path[i], b = path[next];
        const nA = blend(face[i], face[(i + count - 1) % count]);
        const nB = blend(face[i], face[next]);
        wallFace(a, b, nA, nB, low, high, side);
      }
    }
    function parapet(outer, inner, low, high, side, cap) {
      const last = outer.length - 1;
      const front = edgeNormals(outer);
      const inward = edgeNormals(inner).map(n => [-n[0], -n[1]]);
      for (let i = 0; i < last; i++) {
        const prev = Math.max(0, i - 1), next = Math.min(i + 1, last - 1);
        wallFace(outer[i],outer[i + 1],blend(front[i],front[prev]),blend(front[i],front[next]),low,high,side);
        wallFace(inner[i + 1],inner[i],blend(inward[i],inward[next]),blend(inward[i],inward[prev]),low,high,side);
        const first = vertex(outer[i], high, 0, 1, 0, cap);
        vertex(outer[i + 1], high, 0, 1, 0, cap);
        vertex(inner[i + 1], high, 0, 1, 0, cap);
        vertex(inner[i], high, 0, 1, 0, cap);
        indices.push(first,first + 1,first + 2,first,first + 2,first + 3);
      }
      for (const [a,b] of [[inner[0],outer[0]],[outer[last],inner[last]]]) {
        const n = edgeNormals([a,b])[0];
        wallFace(a,b,n,n,low,high,side);
      }
    }
    function finish() {
      const geometry = new T.BufferGeometry();
      geometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
      geometry.setAttribute('normal', new T.Float32BufferAttribute(normals, 3));
      geometry.setAttribute('color', new T.Float32BufferAttribute(colors, 3));
      geometry.setAttribute('uv', new T.Float32BufferAttribute(uvs, 2));
      geometry.setIndex(indices);
      return geometry;
    }
    return { offset, prism, parapet, finish };
  }

  function makeKit(api) {
    const { T, nightMaterials, windowPhoto } = api;
    const plane = new T.PlaneGeometry(1, 1);
    const grille = new T.CircleGeometry(.5, 16);
    const random = D.rng(44129);
    const standard = (color, extra) => new T.MeshStandardMaterial({ color, roughness: .79, ...extra });
    const frontAtlas = new T.TextureLoader().load('assets/shoreline-shops.webp');
    frontAtlas.colorSpace = T.SRGBColorSpace;
    frontAtlas.anisotropy = 4;
    const shopfront = standard('#edece2', { map: frontAtlas, roughness: .44, metalness: .09,
      emissive: '#c8ae88', emissiveMap: frontAtlas, emissiveIntensity: .28 });
    const roller = standard('#e2c7b8', { map: frontAtlas, roughness: .72, metalness: .28 });
    nightMaterials.push([shopfront, 1.04]);
    const windowMap = windowPhoto();
    const windowOff = standard('#dbe3e2', { map: windowMap, roughness: .50, metalness: .12 });
    const windowOn = standard('#f7ead6', { map: windowMap, roughness: .56, emissive: '#ffd294',
      emissiveMap: windowMap, emissiveIntensity: .44 });
    nightMaterials.push([windowOn, 1.82]);
    const windowPanes = windowCrops.map(crop => panelGeometry(T, crop, false));
    const photoPanels = Object.fromEntries(Object.entries(panels).map(([name, panel]) => {
      const crop = panel.crop;
      const width = crop ? (crop[2] - crop[0]) / (crop[3] - crop[1]) : 1.11;
      return [name, { ...panel, width, geometry: crop ? panelGeometry(T, crop, panel.mirrored) : plane,
        material: crop ? (panel.metal ? roller : shopfront) : null }];
    }));
    const paintedTile = surface(T, 256, ctx => {
      ctx.fillStyle = '#777777';
      ctx.fillRect(0, 0, 256, 256);
      for (let row = 0; row < 12; row++) {
        for (let col = -1; col < 9; col++) {
          const x = col * 32 + (row % 2) * 16;
          const y = row * 256 / 12;
          const level = Math.round(164 + random() * 70);
          ctx.fillStyle = 'rgb(' + [level, level, level].join(',') + ')';
          ctx.fillRect(x + 1.2, y + 1.5, 30.8, 256 / 12 - 1.5);
          ctx.fillStyle = '#ffffff37';
          ctx.fillRect(x + 1.2, y + 1.5, 30.8, 1.2);
          ctx.fillStyle = '#14141426';
          ctx.fillRect(x + 1.2, y + 256 / 12 - 1.4, 30.8, 1.4);
        }
      }
      for (let i = 0; i < 720; i++) {
        ctx.fillStyle = i % 3 ? '#15151515' : '#ffffff23';
        ctx.fillRect(random() * 256, random() * 256, .4 + random() * 2.3, .6 + random() * 4);
      }
    });

    const plaster = api.surfaceTexture('plaster', true);
    const packedMetal = api.surfaceTexture('metal', true);
    const shutterGrain = surface(T, 256, ctx => {
      const weather = D.rng(31702);
      const base = ctx.createLinearGradient(0, 0, 0, 256);
      base.addColorStop(0, '#b3bec1');
      base.addColorStop(.65, '#a0aeb0');
      base.addColorStop(1, '#707d82');
      ctx.fillStyle = base;
      ctx.fillRect(0, 0, 256, 256);
      for (let row = 0; row < 25; row++) {
        const y = row * 256 / 25;
        ctx.fillStyle = '#31455571';
        ctx.fillRect(0, y, 256, 1.75);
        ctx.fillStyle = '#f2f2e04a';
        ctx.fillRect(0, y + 2, 256, 1.5);
      }
      for (let index = 0; index < 98; index++) {
        ctx.fillStyle = index % 3 ? '#343b3f11' : '#ece2ce15';
        ctx.fillRect(weather() * 256, weather() * 256, .3 + weather() * 1.6, 8 + weather() * 48);
      }
    });
    const shutter = standard('#8b9ca6', { map: shutterGrain, roughness: .66, metalness: .35 });
    function masonry(color, map, scale, options) {
      const material = standard(color, { map, ...options });
      material.customProgramCacheKey = () => 'boulevardSurface:' + scale;
      material.onBeforeCompile = shader => {
        shader.vertexShader = 'varying vec3 boulevardPosition;\n' + shader.vertexShader.replace('#include <worldpos_vertex>', [
          '#include <worldpos_vertex>',
          'vec4 boulevardPoint = vec4(transformed, 1.0);',
          '#ifdef USE_INSTANCING',
          'boulevardPoint = instanceMatrix * boulevardPoint;',
          '#endif',
          'boulevardPosition = (modelMatrix * boulevardPoint).xyz;',
        ].join('\n'));
        shader.fragmentShader = 'varying vec3 boulevardPosition;\n' + shader.fragmentShader.replace('#include <map_fragment>', [
          '#ifdef USE_MAP',
          'vec3 face = abs(normalize(cross(dFdx(boulevardPosition), dFdy(boulevardPosition))));',
          'vec2 projected = face.y > max(face.x, face.z) ? boulevardPosition.xz :',
          '  (face.x > face.z ? boulevardPosition.zy : boulevardPosition.xy);',
          'vec3 ceramic = texture2D(map, projected / ' + scale.toFixed(2) + ').rgb;',
          'float mottling = .66 + .47 * ceramic.r;',
          'float grime = mix(.72, 1.0, smoothstep(.03, 1.53, boulevardPosition.y));',
          'diffuseColor.rgb *= mottling * grime;',
          '#endif',
        ].join('\n'));
      };
      return material;
    }

    function lamp(color, intensity, map = null) {
      const material = standard(color, { emissive: color, emissiveIntensity: .34, roughness: .55, map, emissiveMap: map });
      nightMaterials.push([material, intensity]);
      return material;
    }
    const glassPattern = surface(T, 128, ctx => {
      const gradient = ctx.createLinearGradient(30, 0, 121, 128);
      gradient.addColorStop(0, '#a2bec2');
      gradient.addColorStop(.38, '#5e858f');
      gradient.addColorStop(.45, '#527684');
      gradient.addColorStop(.51, '#3e6875');
      gradient.addColorStop(.76, '#244856');
      gradient.addColorStop(1, '#20343f');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 128, 128);
      for (const [x, width, opacity] of [[20, 1, .18], [53, 5, .075], [96, 2, .16], [110, 1, .12]]) {
        ctx.fillStyle = 'rgba(229,248,250,' + opacity + ')';
        ctx.fillRect(x, 1, width, 126);
      }
      ctx.fillStyle = '#101f2c56';
      ctx.fillRect(0, 0, 128, 6);
      ctx.fillRect(0, 121, 128, 7);
    });
    const curtainPattern = surface(T, 128, ctx => {
      ctx.fillStyle = '#e2e2e2';
      ctx.fillRect(0, 0, 128, 128);
      for (let x = 0; x < 128; x += 13) {
        const fold = ctx.createLinearGradient(x, 0, x + 13, 0);
        fold.addColorStop(0, '#9d9d9d');
        fold.addColorStop(.3, '#dfdfdf');
        fold.addColorStop(.77, '#f1f1f1');
        fold.addColorStop(1, '#a0a0a0');
        ctx.fillStyle = fold;
        ctx.fillRect(x, 0, 13, 128);
      }
      const shadow = ctx.createLinearGradient(0, 0, 0, 128);
      shadow.addColorStop(0, '#654f3c6e');
      shadow.addColorStop(.26, '#654f3c00');
      shadow.addColorStop(.82, '#654f3c00');
      shadow.addColorStop(1, '#654f3c67');
      ctx.fillStyle = shadow;
      ctx.fillRect(0, 0, 128, 128);
    });

    const skins = {
      rose: { wall: masonry('#ce8a74', plaster, 4.4), tile: masonry('#86473f', paintedTile, 2.25), trim: standard('#e8cbb0'), cloth: standard('#ab463e', { roughness: .96 }) },
      slate: { wall: masonry('#809fa9', plaster, 4.05), tile: masonry('#375d6b', paintedTile, 2.25), trim: standard('#bad2d3'), cloth: standard('#2a6e7c', { roughness: .96 }) },
      limestone: { wall: masonry('#d6bc93', plaster, 4.4), tile: masonry('#967c62', paintedTile, 2.25), trim: standard('#f0d7b4'), cloth: standard('#9e6432', { roughness: .96 }) },
      seafoam: { wall: masonry('#91b0a3', plaster, 4.1), tile: masonry('#3e6d65', paintedTile, 2.25), trim: standard('#d1d8bc'), cloth: standard('#31786e', { roughness: .96 }) },
    };
    const enamel = workshopEnamel(T);
    const mats = {
      shutter,
      concrete: masonry('#ffffff', plaster, 3.65, { vertexColors: true }),
      workshopMark: standard('#eee5cc', { map: enamel, roughness: .88, metalness: .025,
        emissive: '#ece1cb', emissiveMap: enamel, emissiveIntensity: .27 }),
      recess: standard('#18262b'), anthracite: standard('#202b34', { metalness: .45, roughness: .36 }),
      metal: masonry('#728287', packedMetal, 2.6, { metalness: .5, roughness: .53 }),
      zinc: standard('#97abaf', { metalness: .45, roughness: .48 }),
      darkRoof: masonry('#38484b', packedMetal, 3.35, { metalness: .27, roughness: .71 }),
      tire: standard('#17232b', { roughness: .94 }), amber: standard('#c58d43', { roughness: .89 }),
      whitePaint: standard('#d1c9a9', { roughness: .92 }),
      windowDark: standard('#4a6977', { map: glassPattern, metalness: .25, roughness: .26 }),
      diffuseGold: lamp('#f6b369', 1.19, curtainPattern),
      warmFixture: lamp('#ffda9c', 2.45), cyanFixture: lamp('#85ffe2', 2.95),
      terracotta: standard('#aa5d45', { roughness: .88 }),
      foliage: standard('#487c53', { roughness: .90 }),
      blossom: standard('#e48870', { roughness: .88 }),
      coralFixture: lamp('#ff8f73', 2.65),
      laundry: ['#ede8dd', '#82b6cc', '#e2927b', '#e7c878'].map(c => standard(c, { roughness: .95 })),
    };
    nightMaterials.push([mats.workshopMark, 1.33]);
    return { plane, grille, skins, mats, random, photoPanels, windowPanes, windowOff, windowOn };
  }

  function architecture(api, kit) {
    const { queue, box, ground, pole, bar, sign, solid, fixture } = api;
    const { plane, grille, skins, mats, random, photoPanels, windowPanes, windowOff, windowOn } = kit;
    const glass = (material, x, y, z, w, h) => queue(plane, material, x, y, z, w, h, 1, EAST);
    const cast = (x, y, z, color, intensity, radius) => fixture?.(x, y, z, color, intensity, radius);
    let blockStone;
    function sculptAt(x, z) {
      if (!blockStone) blockStone = { x, z, mesh: concreteMesh(api.T) };
      blockStone.mesh.offset(x - blockStone.x, z - blockStone.z);
      return blockStone.mesh;
    }
    function finishBlock() {
      if (!blockStone) return;
      queue(blockStone.mesh.finish(), mats.concrete, blockStone.x, 0, blockStone.z, 1, 1, 1);
      blockStone = null;
    }

    function pane(slot, lit, x, y, z, width, height, angle) {
      queue(windowPanes[slot], lit ? windowOn : windowOff, x, y, z, width, height, 1, angle);
    }
    function upperWindow(x, z, y, width, tall, skin, slot, lit, balcony) {
      box(mats.recess, x - .355, y, z, .07, tall + .22, width + .27);
      pane(slot, lit, x - .306, y, z, width - .08, tall - .12, EAST);
      for (const side of [-1, 1]) {
        box(skin.trim, x - .12, y, z + side * (width * .5 + .04), .27, tall + .14, .115);
      }
      box(skin.trim, x - .072, y - tall * .5 - .074, z, .35, .13, width + .30);
      box(skin.tile, x - .036, y - tall * .5 - .139, z, .31, .044, width + .22);
      box(skin.trim, x - .14, y + tall * .5 + .055, z, .25, .11, width + .26);
      if (balcony) {
        box(skin.trim, x + .24, y - tall * .5 - .12, z, .87, .18, width + .46);
        box(skin.tile, x + .24, y - tall * .5 - .219, z, .84, .053, width + .35);
        box(mats.anthracite, x + .642, y - tall * .5 + .56, z, .078, .069, width + .45);
        box(mats.anthracite, x + .642, y - tall * .5 + .09, z, .059, .066, width + .45);
        for (let rail = -2; rail <= 2; rail++) {
          box(mats.anthracite, x + .64, y - tall * .5 + .29, z + rail * width * .225, .051, .49, .045);
        }
        for (const side of [-1, 1]) {
          box(mats.anthracite, x + .235, y - tall * .5 + .55, z + side * (width * .5 + .18), .86, .055, .065);
          bar(mats.anthracite, x + .59, y - tall * .5 - .16, z + side * width * .31,
            x - .13, y - tall * .5 - .50, z + side * width * .31, .082);
        }
        box(mats.terracotta, x + .46, y - tall * .5 + .07, z - width * .24, .26, .20, width * .42);
        box(mats.foliage, x + .46, y - tall * .5 + .23, z - width * .24, .30, .20, width * .46);
        box(mats.blossom, x + .52, y - tall * .5 + .30, z - width * .18, .12, .10, .18);
        if (random() < .48) {
          const rz = z + width * .18;
          box(mats.zinc, x + .52, y + tall * .36, rz, .04, .04, width * .44);
          for (const end of [-1, 1]) box(mats.anthracite, x + .24, y + tall * .36, rz + end * width * .20, .56, .04, .04);
          for (let i = 0; i < 2; i++) {
            const cloth = mats.laundry[Math.floor(random() * mats.laundry.length)];
            box(cloth, x + .52, y + tall * .36 - .28, rz + (i - .5) * .36, .06, .50, .24);
          }
        }
      } else {
        // Protruding 3D window sunshade hood
        box(skin.trim, x + .06, y + tall * .5 + .10, z, .36, .10, width + .34);
        if (random() < .52) {
          const ventZ = z + width * .34;
          const ventY = y - tall * .5 - .43;
          box(mats.zinc, x - .06, ventY, ventZ, .38, .36, .68);
          queue(grille, mats.recess, x + .134, ventY, ventZ - .12, .28, .28, 1, EAST);
          queue(grille, mats.zinc, x + .14, ventY, ventZ - .12, .061, .061, 1, EAST);
          for (let k = -1; k <= 1; k++) {
            box(mats.anthracite, x + .132, ventY + k * .078, ventZ + .173, .028, .023, .189);
          }
        }
      }

    }

    function roof(x, z, width, depth, top, skin, corner) {
      box(mats.darkRoof, x - width * .5, top + .082, z, width - .08, .17, depth - .08);
      box(skin.trim, x - width * .5, top + .205, z, width + .24, .12, depth + .26);
      box(skin.tile, x - .12, top + .445, z, .32, .51, depth + .07);
      for (const side of [-1, 1]) {
        box(skin.wall, x - width * .51, top + .47, z + side * (depth * .5 - .21), width - .48, .55, .40);
      }
      box(skin.tile, x - width * .68, top + .78, z + depth * .08, width * .34, 1.37, depth * .31);
      box(mats.darkRoof, x - width * .68, top + 1.57, z + depth * .08, width * .37, .16, depth * .34);
      for (const sign of [-1, 1]) {
        const rz = z + sign * depth * .28;
        box(mats.metal, x - width * .28, top + .59, rz, 1.35, .89, 1.34);
        box(mats.anthracite, x - width * .28, top + 1.043, rz, 1.11, .072, 1.11);
      }
      const tankX = x - width * .37;
      const tankZ = z - depth * .21;
      box(mats.anthracite, tankX, top + .31, tankZ, 1.79, .30, 1.57);
      pole(mats.metal, tankX, top + 1.116, tankZ, 1.56, 1.37);
      pole(mats.zinc, tankX, top + 1.829, tankZ, 1.47, .14);
      for (const y of [.66, 1.55]) pole(mats.anthracite, tankX, top + y, tankZ, 1.59, .054);
      bar(mats.metal, tankX + .51, top + .79, tankZ, tankX + 1.08, top + .79, tankZ, .11);
      bar(mats.metal, tankX + 1.08, top + .79, tankZ, tankX + 1.08, top + .248, tankZ, .11);
      if (corner) {
        const tx = x - 2.08;
        const tz = z + depth * .31;
        box(skin.wall, tx, top + 1.72, tz, 4.14, 3.4, 4.8);
        box(skin.trim, tx, top + 3.48, tz, 4.49, .28, 5.0);
        box(skin.tile, tx, top + 3.77, tz, 3.72, .37, 4.25);
        box(mats.warmFixture, x + .022, top + 1.85, tz - 2.03, .12, 1.55, .058);
        box(mats.warmFixture, x + .022, top + 1.85, tz + 2.03, .12, 1.55, .058);
        box(mats.warmFixture, tx, top + 3.63, tz, 4.38, .08, 4.90);
        pole(mats.anthracite, tx, top + 4.68, tz, .10, 1.68);
        bar(mats.zinc, tx - .66, top + 4.98, tz, tx + .64, top + 5.33, tz, .049);
      }
    }

    function upperFloors(x, z, width, depth, base, floors, bays, skin, balconies, corner) {
      const spacing = 2.92;
      const height = floors * spacing;
      const top = base + height;
      box(skin.wall, x - (width + .437) * .5, base + height * .5, z, width - .437, height, depth);
      const bayStep = depth / bays;
      const bayWidth = bayStep * .66;
      const opening = 1.73;
      const pipeZ = z - depth * .5 + .24;
      pole(mats.metal, x + .095, base + height * .5, pipeZ, .139, height + .21);
      for (let level = 0; level < floors; level++) {
        const y = base + level * spacing + 1.55;
        pole(mats.anthracite, x + .095, y - 1.14, pipeZ, .174, .08);
        box(skin.tile, x - .208, y - 1.315, z, .43, .49, depth);
        box(skin.wall, x - .195, y + 1.104, z, .44, .46, depth);
        box(skin.trim, x - .15, y + 1.259, z, .47, .085, depth + .12);
        for (let lane = 0; lane <= bays; lane++) {
          const pz = z - depth * .5 + lane * bayStep;
          const edge = lane === 0 || lane === bays;
          box(skin.wall, x - .206, y - .075, pz + (edge ? (lane ? -.26 : .26) : 0), .42, 2.13, edge ? .53 : bayStep - bayWidth);
        }
        for (let lane = 0; lane < bays; lane++) {
          const wz = z + (lane - (bays - 1) / 2) * bayStep;
          const slot = (lane + level * 3 + Math.floor(z * .11)) & 3;
          const lit = random() < .39;
          upperWindow(x, wz, y, bayWidth, opening, skin, slot, lit, balconies && (lane + level * 2) % 4 === 1);
        }
        for (const side of [-1, 1]) {
          const zz = z + side * (depth * .5 + .017);
          for (let lane = 0; lane < 4; lane++) {
            const px = x - width * (.20 + lane * .193);
            queue(plane, mats.recess, px, y, zz, width * .136, 1.76, 1, side > 0 ? 0 : Math.PI);
            pane((lane + level * 3 + side) & 3, random() < .21, px, y, zz + side * .025, width * .119, 1.53, side > 0 ? 0 : Math.PI);
            box(skin.trim, px, y - .86, zz, width * .14, .14, .27);
          }
          if (level % 2 === 0) box(skin.trim, x - width * .50, y - 1.25, zz, width + .14, .12, .09);
        }
      }
      if (corner) {
        for (const side of [-1, 1]) {
          const tz = z + side * (depth * .5 - .66);
          pole(skin.trim, x - .17, base + height / 2, tz, .79, height);
          box(skin.tile, x + .235, base + height / 2, tz, .074, height - .39, .26);
        }
      }
      roof(x, z, width, depth, top, skin, corner);
      return top;
    }

    function awning(skin, x, z, width, y) {
      const segments = Math.round(width / .54);
      const spacing = width / segments;
      for (let step = 0; step < segments; step++) {
        const pz = z + (step - (segments - 1) / 2) * spacing;
        const material = step % 4 === 3 ? skin.trim : skin.cloth;
        box(material, x + .397, y, pz, 1.101, .088, spacing + .004, 0, 0, -.16);
        box(material, x + .932, y - .18, pz, .08, .23, spacing + .003);
      }
      for (const side of [-1, 1]) {
        bar(mats.anthracite, x - .015, y - .56, z + side * width * .46, x + .906, y - .093, z + side * width * .46, .06);
      }
    }

    function framedFront(x, z, width, height, bottom, name, skin) {
      const photo = photoPanels[name];
      const y = bottom + height / 2;
      const top = bottom + height;
      box(mats.recess, x - .489, y, z, .088, height + .15, width + .14);
      queue(photo.geometry, photo.material ?? mats.windowDark, x - .414, y, z, width, height, 1, EAST);

      // The image sits in a real reveal. The outer stone and inner metal catch light at street angles.
      for (const offset of [-1, 1]) {
        box(skin.trim, x - .176, y, z + offset * (width / 2 + .066), .46, height + .15, .156);
        box(mats.anthracite, x - .257, y, z + offset * (width / 2 - .019), .284, height, .057);
      }
      box(skin.trim, x - .115, bottom - .059, z, .54, .119, width + .28);
      box(mats.zinc, x - .066, bottom - .098, z, .445, .041, width + .24);
      box(skin.trim, x - .129, top + .064, z, .405, .139, width + .26);
      for (const u of photo.posts) box(mats.anthracite, x - .287, y, z + (.5 - u) * width, .126, height - .06, .056);
      for (const v of photo.rails) box(mats.anthracite, x - .281, bottom + height * v, z, .13, .052, width - .06);
      if (photo.metal) {
        box(mats.anthracite, x - .171, bottom + .072, z, .179, .125, width + .018);
        box(mats.zinc, x - .296, bottom + .40, z, .18, .095, .29);
      } else if (name === 'oak') {
        for (const u of [.515, .568]) box(mats.amber, x - .234, bottom + height * .52, z + (.5 - u) * width, .092, .162, .044);
      }
    }

    function storefront(x, z, width, depth, spec, skin) {
      const baseHeight = 4.31;
      const bay = depth / 3;
      const portico = spec.terraces ? 2.71 : 0;
      box(skin.wall, x - (width + 1.38) * .5, FLOOR + baseHeight * .5, z - portico * .5, width - 1.38, baseHeight, depth - portico);
      box(skin.tile, x - .713, FLOOR + .105, z, .42, .219, depth);
      for (const side of [-1, 1]) {
        box(skin.tile, x - .62, 2.02, z + side * (depth * .5 - .29), 1.27, 3.73, .58);
      }
      for (const [lane, layout] of spec.frontage.entries()) {
        const cz = z + (lane - 1) * bay;
        const span = bay - 1.08;
        const gap = .52;
        const opening = layout.map(name => {
          const height = name === 'oak' ? 3.08 : 2.91;
          return { name, height, width: photoPanels[name].width * height, bottom: name === 'oak' ? .249 : .419 };
        });
        const pair = opening[0].width + gap + opening[1].width;
        let cursor = cz - pair / 2;
        const shoulder = (span - pair) / 2;
        for (const side of [-1, 1]) {
          box(skin.tile, x - .608, 1.885, cz + side * (pair + span) / 4, 1.17, 3.29, shoulder + .10);
        }
        for (const [index, front] of opening.entries()) {
          const center = cursor + front.width * .5;
          framedFront(x, center, front.width, front.height, front.bottom, front.name, skin);
          cursor += front.width;
          if (index === 0) box(skin.tile, x - .594, 1.885, cursor + gap * .5, 1.17, 3.29, gap - .014);
          cursor += gap;
        }
        if (lane < 2) box(skin.tile, x - .61, 2.03, cz + bay * .5, 1.27, 3.74, .83);
      }
      box(skin.tile, x - .53, 3.976, z, 1.14, .95, depth);
      box(mats.anthracite, x + .008, 3.935, z, .12, .797, Math.min(depth * .64, 15.35));
      sign(spec.name, spec.detail, spec.ink, x + .086, 3.939, z, 5.72, .748, EAST);
      box(skin.trim, x - .045, 4.398, z, .42, .157, depth + .19);
      const glow = spec.skin === 'seafoam' ? mats.cyanFixture : spec.skin === 'rose' ? mats.coralFixture : mats.warmFixture;
      box(glow, x + .137, 3.495, z, .105, .042, Math.min(depth * .62, 14.8));
      for (const side of [-1, 1]) box(glow, x + .075, 3.935, z + side * 3.04, .06, .72, .055);
      // Protruding vertical neon blade sign facing along the boulevard
      const bladeZ = z + (spec.offset > 0 ? -depth * .36 : depth * .36);
      const bladeY = 6.2;
      box(mats.anthracite, x + .54, bladeY, bladeZ, .88, 2.75, .16);
      box(glow, x + .99, bladeY, bladeZ, .07, 2.58, .12);
      box(glow, x + .56, bladeY, bladeZ, .52, 2.42, .20);
      for (const dy of [-.95, .95]) box(mats.anthracite, x + .16, bladeY + dy, bladeZ, .36, .08, .08);
      if (spec.awning) awning(skin, x, z, Math.min(depth * .85, 26), 3.551);
      const color = spec.skin === 'seafoam' ? '#9bfbe4' : '#ffd296';
      cast(x + 1.78, 3.04, z - 4.5, color, 50, 19);
      cast(x + 1.57, 3.09, z + 4.5, '#ffc483', 38, 16.5);
      return FLOOR + baseHeight;
    }

    function streetWindow(x, z, a, b, fraction, width, y, height, tint, slot, lit) {
      const dx = b[0] - a[0], dz = b[1] - a[1], len = Math.hypot(dx, dz);
      const nx = -dz / len, nz = dx / len;
      const angle = Math.atan2(nx, nz);
      const px = x + a[0] + dx * fraction;
      const pz = z + a[1] + dz * fraction;
      box(mats.recess, px + nx * .072, y, pz + nz * .072, width + .16, height + .14, .116, angle);
      pane(slot, lit, px + nx * .138, y, pz + nz * .138, width, height, angle);
      box(tint, px + nx * .09, y - height * .5 - .111, pz + nz * .09, width + .33, .108, .38, angle);
    }

    // The ground-floor footprint stays on the map. Camera contact above follows the stepped outline.
    function tierCollision(x, z, west, east, north, south, radius, low, high) {
      const patch = (left, right, back, front) => solid(x + (left + right) / 2, z + (front + back) / 2,
        right - left, front - back, high, false, low);
      if (!radius) return patch(west, east, north, south);
      patch(west, east - radius, north, south);
      const arc = cornerPlan(west, east, north, south, radius).slice(2, -1);
      for (let i = 1; i < arc.length; i++) {
        patch(arc[i - 1][0], arc[i][0], north, (arc[i - 1][1] + arc[i][1]) * .5);
      }
    }

    function guardCollision(x,z,path,low,high) {
      for (let i = 1; i < path.length; i++) {
        const a = path[i - 1], b = path[i];
        const dx = b[0] - a[0], dz = b[1] - a[1];
        const segments = Math.abs(dx * dz) < .001 ? 1 : 3;
        for (let k = 0; k < segments; k++) {
          const t = (k + .5) / segments;
          solid(x + a[0] + t * dx,z + a[1] + t * dz,Math.abs(dx) / segments + .10,Math.abs(dz) / segments + .10,high,false,low);
        }
      }
    }

    function canteenPortico(stone,x,z,width,depth,base,skin) {
      const south = depth * .5;
      const setback = 2.71;
      const glassZ = z + south - setback;
      const pierZ = south - .36;
      const outline = cornerPlan(-width, .18, south - setback - .1, south + .15);
      stone.prism(outline,base - .41,base - .09,'#6c857c','#a8ae94','#7c8779');
      stone.prism(outline,base - .09,base + .073,'#c4c3a6');
      solid(x - width / 2, z - setback / 2, width, depth - setback, base);
      solid(x - .69, z + (depth - setback) / 2, 1.38, setback, base, false);
      solid(x - width / 2, z + south - setback / 2, width, setback + .28, base + .073, false, base - .41);
      const start = -width + .98, end = -1.85;
      const span = (end - start) / 4;
      for (let index = 0; index <= 4; index++) {
        const px = start + index * span;
        const chamfer = (w, d) => [[px - w, pierZ - d + .12],[px - w,pierZ + d - .12],
          [px - w + .12,pierZ + d],[px + w - .12,pierZ + d],[px + w,pierZ + d - .12],
          [px + w,pierZ - d + .12],[px + w - .12,pierZ - d],[px - w + .12,pierZ - d]];
        stone.prism(chamfer(.42,.43),FLOOR,.72,'#62776f');
        stone.prism(chamfer(.30,.32),.72,base - .69,'#c2b99d');
        stone.prism(chamfer(.44,.44),base - .69,base - .405,'#a6ad97');
        solid(x + px,z + pierZ,.82,.84,base - .41,false);
        if (api.contactShade) ground(api.contactShade,x + px,z + pierZ,1.71,1.65,.196);
        if (index === 4) break;
        const shopX = x + px + span * .5;
        const front = photoPanels[['blue', 'teal', 'oak', 'teal'][index]];
        const h = index === 2 ? 3.05 : 2.46;
        const w = front.width * h;
        const bottom = index === 2 ? .222 : .62;
        box(mats.recess,shopX,bottom + h / 2,glassZ + .087,w + .18,h + .17,.16);
        queue(front.geometry,front.material,shopX,bottom + h / 2,glassZ + .173,w,h,1);
        box(skin.trim,shopX,bottom - .068,glassZ + .12,w + .37,.137,.38);
        box(skin.trim,shopX,bottom + h + .083,glassZ + .12,w + .36,.167,.34);
        box(mats.warmFixture,shopX,base - .445,glassZ + 1.26,1.49,.055,.19);
      }
    }

    function canteenUpper(x, z, width, depth, base, skin) {
      const stone = sculptAt(x, z);
      canteenPortico(stone,x,z,width,depth,base,skin);
      const spacing = 3.08;
      const west = -width + .36;
      const north = -depth * .5 + .27;
      const cream = '#d9ceb0', tile = '#52847b', soffit = '#7f8a7f';
      const setbacks = [0, 0, 2.88, 5.82];
      const top = base + spacing * setbacks.length;
      let crown;
      for (const [level, inset] of setbacks.entries()) {
        const y = base + level * spacing;
        const east = -1.45 - inset;
        const south = depth * .5 - 1.30 - inset * .77;
        const radius = 4.33 + level * .12;
        const line = cornerPlan(west, east, north, south, radius);
        const out = 1.78;
        const deck = cornerPlan(west - .20, east + out, north - .24, south + out, radius + out);
        const rail = cornerPlan(west + 1.0, east + out - .16, north + 2.1, south + out - .16, radius + out - .16);
        crown = { east, south, radius };
        stone.prism(line, y - .025, y + spacing, level > 1 ? '#a9b7a6' : '#91a798');
        stone.prism(deck, y - .29, y + .085, cream, '#a9aa95', soffit);
        stone.prism(deck, y - .366, y - .29, tile);
        const railOutside = cornerPlan(west + 1.0, east + out - .055, north + 2.1, south + out - .055, radius + out - .055);
        stone.parapet(railOutside.slice(1), rail.slice(1), y + .083, y + .56, '#c9c6ac', cream);
        const run = rail.slice(1);
        guardCollision(x,z,run,y + .083,y + .955);
        for (let i = 0; i < run.length - 1; i++) {
          const a = run[i], b = run[i + 1];
          bar(mats.anthracite, x + a[0], y + .91, z + a[1], x + b[0], y + .91, z + b[1], .085);
          const posts = Math.max(1, Math.round(Math.hypot(a[0] - b[0], a[1] - b[1]) / 3.0));
          for (let p = 0; p < posts; p++) {
            const t = p / posts;
            box(mats.zinc, x + a[0] + t * (b[0] - a[0]), y + .73, z + a[1] + t * (b[1] - a[1]), .064, .344, .064);
          }
        }
        const light = Array.from({ length: 20 }, () => random());
        let cell = 0;
        for (let i = 0; i < line.length; i++) {
          const a = line[i], b = line[(i + 1) % line.length];
          const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
          const curved = i >= 2 && i < line.length - 2;
          const panes = curved ? 1 : Math.max(2, Math.floor(length / (i === 0 || i === line.length - 1 ? 6.3 : 4.22)));
          for (let part = 0; part < panes; part++, cell++) {
            const paneWidth = curved ? length * .93 : Math.min(3.67, length / panes * .69);
            streetWindow(x, z, a, b, (part + .5) / panes, paneWidth, y + 1.57, 1.76, skin.trim,
              (part + i + level * 3) & 3, light[cell % light.length] < .44);
          }
        }
        tierCollision(x, z, west, east, north, south, radius, y + .085, y + spacing);
        tierCollision(x, z, west - .20, east + out, north - .24, south + out, radius + out, y - .366, y + .085);
      }

      const roof = cornerPlan(west - .16, crown.east + .71, north - .19, crown.south + .71, crown.radius + .71);
      stone.prism(roof, top - .13, top + .21, cream, '#99a18e', soffit);
      stone.parapet(roof.slice(1), cornerPlan(west - .16, crown.east + .51, north - .19, crown.south + .51, crown.radius + .51).slice(1),
        top + .20, top + .68, '#a9b4a3', cream);
      guardCollision(x,z,roof.slice(1),top + .20,top + .68);
      const pavilionX = x - width + 5.15;
      const pavilionZ = z - 5.5;
      stone.prism(cornerPlan(-width + .72, -width + 5.1, -10.67, -4.81), top + .20, top + 2.97, '#789387');
      for (const offset of [-3.45, 0, 3.45]) {
        const bx = pavilionX + offset + 2.88;
        for (const side of [-1, 1]) {
          const uz = pavilionZ - z + side * 2.64;
          stone.prism(cornerPlan(bx - x - .155,bx - x + .155,uz - .18,uz + .18),top + .255,top + 3.225,cream);
        }
        stone.prism(cornerPlan(bx - x - .185,bx - x + .185,pavilionZ - z - 3.14,pavilionZ - z + 3.14),
          top + 3.145,top + 3.475,cream,cream,soffit);
      }
      for (let i = 0; i < 6; i++)
        box(skin.cloth, pavilionX + 2.88, top + 3.54, pavilionZ + (i - 2.5) * .982, 8.41, .167, .39, 0, -.16);
      tierCollision(x,z,west - .16,crown.east + .71,north - .19,crown.south + .71,crown.radius + .71,top - .13,top + .21);
    }

    function shop(x, z, spec) {
      const skin = skins[spec.skin];
      const base = storefront(x, z, spec.width, spec.depth, spec, skin);
      if (spec.terraces) {
        canteenUpper(x, z, spec.width, spec.depth, base, skin);
        return;
      }
      const top = upperFloors(x, z, spec.width, spec.depth, base, spec.floors, spec.bays, skin, spec.balconies, spec.corner);
      solid(x - spec.width / 2, z, spec.width, spec.depth, top + .73);
      if (spec.corner) {
        const tz = z + spec.depth * .39;
        box(skin.tile, x + .56, base + 3.1, tz, .80, 4.01, 1.12);
        box(mats.warmFixture, x + .972, base + 3.10, tz, .039, 3.44, .096);
        queue(plane, mats.diffuseGold, x + .58, base + 3.88, tz + .565, .73, 1.56, 1);
      }
    }

    function serviceBay(x, z, depth, span, ceiling, skin) {
      const back = x - depth;
      const mid = x - depth * .5;
      const half = span * .5;
      api.shelters?.push({ minX: back, maxX: x, minZ: z - half, maxZ: z + half, ceiling });
      const wall = skins.limestone.wall;
      const red = skins.rose.cloth;
      box(skin.wall, mid, ceiling + .369, z, depth, .738, span);
      box(wall, back - .06, (ceiling + FLOOR) / 2, z, .36, ceiling - FLOOR, span);
      for (const side of [-1, 1]) {
        const wallZ = z + side * (half - .028);
        box(wall, mid, (ceiling + FLOOR) / 2, wallZ + side * .15, depth, ceiling - FLOOR, .356);
        box(skin.tile, mid, .747, wallZ - side * .034, depth, 1.08, .035);
        box(mats.amber, mid, 1.355, wallZ - side * .046, depth, .097, .031);
      }
      box(skin.tile, back + .139, .747, z, .044, 1.08, span);
      box(mats.amber, back + .148, 1.355, z, .041, .097, span);
      for (const along of [.19, .53, .86]) {
        box(mats.anthracite, x - depth * along, ceiling - .11, z, .14, .21, span);
      }

      // The lift arms are folded beside their columns, leaving the full centre lane open.
      for (const side of [-1, 1]) {
        const postZ = z + side * 2.65;
        box(mats.anthracite, mid, .274, postZ, .72, .147, .66);
        box(mats.anthracite, mid, 1.88, postZ, .46, 3.14, .42);
        box(mats.amber, mid + .226, 1.89, postZ, .055, 3.09, .424);
        box(mats.amber, mid - .208, 1.89, postZ, .049, 3.09, .415);
        box(mats.amber, mid, 1.90, postZ + side * .21, .408, 3.07, .043);
        box(mats.metal, mid + .04, 1.85, postZ - side * .216, .24, 2.71, .065);
        box(red, mid + .125, 1.04, postZ - side * .22, .21, .43, .129);
        for (const dx of [-.55, .55]) {
          box(mats.anthracite, mid + dx, .36, postZ - side * .18, 1.0, .15, .21);
          box(mats.amber, mid + dx * 1.74, .432, postZ - side * .18, .213, .13, .25);
        }
        solid(mid, postZ, .72, .66, 3.45, false);
        solid(mid, postZ - side * .18, 2.11, .25, .50, false);
        ground(mats.whitePaint, mid + .69, z + side * 1.45, depth - 1.8, .065, .199);
        const tubeZ = z + side * 1.79;
        box(mats.metal, mid + .1, ceiling - .192, tubeZ, 5.39, .14, .24);
        box(mats.warmFixture, mid + .10, ceiling - .266, tubeZ, 5.18, .035, .165);
      }
      box(mats.anthracite, mid, 3.56, z, .34, .25, 5.76);
      box(mats.amber, mid + .167, 3.55, z, .046, .206, 5.68);
      solid(mid, z, .34, 5.76, 3.69, false, 3.435);

      const benchX = back + .55;
      const benchZ = z - 2.37;
      box(mats.anthracite, benchX, .29, benchZ, .78, .17, 2.28);
      box(mats.zinc, benchX + .035, 1.273, benchZ, .98, .099, 2.40);
      for (const side of [-1, 1]) {
        const cabinet = benchZ + side * .569;
        box(red, benchX, .79, cabinet, .84, .87, 1.123);
        for (let row = 0; row < 4; row++) {
          const y = .529 + row * .185;
          box(mats.anthracite, benchX + .432, y, cabinet, .027, .057, 1.03);
          box(mats.zinc, benchX + .451, y + .03, cabinet, .04, .037, .91);
        }
      }
      solid(benchX + .035, benchZ, .98, 2.4, 1.323, false);
      box(mats.anthracite, back + .178, 2.093, benchZ, .088, 1.22, 2.57);
      box(mats.metal, back + .235, 2.093, benchZ, .044, 1.09, 2.43);
      box(mats.warmFixture, back + .30, 2.77, benchZ, .18, .053, 2.41);
      for (let tool = 0; tool < 6; tool++) {
        const toolZ = benchZ + (tool - 2.5) * .295;
        const length = .29 + (tool % 3) * .086;
        bar(mats.zinc, back + .276, 2.20, toolZ, back + .28, 2.20 - length, toolZ + .032, .044, .045);
        for (const side of [-1, 1]) {
          bar(mats.zinc, back + .276, 2.19, toolZ, back + .277, 2.27, toolZ + side * .063, .039);
        }
      }
      const tireZ = z + 2.91;
      for (let i = 0; i < 3; i++) {
        pole(mats.tire, back + .87, .319 + i * .23, tireZ, .78, .218);
      }
      pole(mats.anthracite, back + .87, .887, tireZ, .425, .016);
      solid(back + .87, tireZ, .73, .73, .90, false);
      box(mats.metal, back + .28, 1.67, z + 1.57, .53, .091, 2.20);
      solid(back + .29, z + 1.57, .56, 2.20, 2.52, false, 1.619);
      for (const wheelZ of [z + 1.09, z + 2.07]) {
        const wheelY = 2.113;
        for (let section = 0; section < 10; section++) {
          const a = section * Math.PI / 5;
          box(mats.anthracite, back + .359, wheelY + Math.cos(a) * .337, wheelZ + Math.sin(a) * .337,
            .26, .124, .246, 0, a);
        }
        queue(grille, mats.recess, back + .494, wheelY, wheelZ, .765, .765, 1, EAST);
        queue(grille, mats.zinc, back + .502, wheelY, wheelZ, .435, .435, 1, EAST);
        queue(grille, mats.recess, back + .509, wheelY, wheelZ, .350, .350, 1, EAST);
        for (let spoke = 0; spoke < 5; spoke++) {
          const a = spoke * Math.PI * .4;
          box(mats.zinc, back + .519, wheelY + Math.cos(a) * .09, wheelZ + Math.sin(a) * .09,
            .029, .202, .044, 0, a);
        }
      }

      // Frosted glass and a sill give the office wall real depth from the entrance.
      const officeX = x - 6.53;
      const officeZ = z - half + .103;
      box(mats.anthracite, officeX, 2.38, officeZ, 2.73, 1.56, .099);
      pane(2, true, officeX, 2.38, officeZ + .057, 2.62, 1.45, 0);
      box(mats.zinc, officeX, 1.571, officeZ + .06, 2.82, .089, .208);
      for (const height of [2.91, 3.04]) {
        bar(mats.metal, x - .47, height, officeZ, officeX + 1.56, height, officeZ, .051);
        bar(mats.metal, officeX + 1.56, height, officeZ, officeX + 1.56, 1.93, officeZ, .052);
      }
      box(mats.zinc, officeX + 1.61, 1.89, officeZ + .07, .29, .49, .155);
      if (api.contactShade) ground(api.contactShade, benchX + .45, benchZ, 1.6, 3.2, .196);
      if (api.lampPool) {
        ground(api.lampPool, mid + .45, z, 9.3, 5.8, .198);
        queue(api.signPlane ?? plane, api.lampPool, back + .175, 2.26, z + .67, 5.46, 3.09, 1, EAST);
        queue(api.signPlane ?? plane, api.lampPool, mid + .42, 2.41, officeZ - .005, 6.94, 2.94, 1);
      }
      cast(mid + .54, 3.54, z, '#ffcc8e', 83, 17);
    }

    function serviceApron(x, z, skin) {
      const run = 2.36;
      const start = .19, end = .023, thickness = .075;
      const mid = x + 2.16 + run * .5;
      const slope = (end - start) / run;
      const angle = Math.atan(slope);
      const center = (start + end) * .5;
      box(api.pavement ?? skin.wall, mid + thickness * .5 * Math.sin(angle), center - thickness * .5 * Math.cos(angle), z,
        Math.hypot(run, end - start), thickness, 8.1, 0, 0, angle);
      api.surface?.(mid, z, run, 8.1, center, slope);
      box(mats.metal, x + .89, .197, z, .29, .011, 7.63);
      for (let slot = -12; slot <= 12; slot++) {
        box(mats.anthracite, x + .89, .204, z + slot * .294, .211, .007, .075);
      }
    }

    function garage(x, z) {
      const skin = skins.slate;
      const width = 25.5;
      const depth = 29.4;
      const base = 4.825;
      const workZ = z + 9.01;
      const workWidth = 7.88;
      const workDepth = 9.20;
      const ceiling = 4.09;
      const top = upperFloors(x, z, width, depth, base, 2, 6, skin, false, false) + .7;
      const rearX = x - (width + workDepth) * .5;
      box(skin.wall, rearX, (base + FLOOR) * .5, z, width - workDepth, base - FLOOR, depth);
      solid(rearX, z, width - workDepth, depth, top);
      for (const [from, to] of [[z - depth * .5, workZ - workWidth * .5], [workZ + workWidth * .5, z + depth * .5]]) {
        const wallZ = (from + to) * .5;
        box(skin.wall, x - (workDepth + 1.12) * .5, (base + FLOOR) * .5, wallZ,
          workDepth - 1.12, base - FLOOR, to - from);
        box(skin.tile, x - .667, .319, wallZ, .41, .234, to - from);
        solid(x - workDepth * .5, wallZ, workDepth, to - from, top);
      }
      solid(x - workDepth * .5, workZ, workDepth, workWidth, top, false, ceiling);
      for (const side of [-1, 1]) {
        box(skin.tile, x - .52, 2.08, z + side * 14.16, 1.13, 3.72, 1.08);
      }
      for (const offset of [-9.05, -.02, 9.01]) {
        const cz = z + offset;
        if (offset < -1) {
          box(mats.recess, x - .335, 1.968, cz, .131, 3.62, 8.13);
          box(mats.shutter, x - .261, 1.884, cz, .188, 3.22, 7.72);
          box(mats.anthracite, x - .16, .442, cz, .14, .237, 7.73);
          box(mats.zinc, x - .053, .751, cz, .085, .088, .37);
        } else if (offset < 1) {
          box(skin.tile, x - .642, 1.934, cz, .29, 3.59, 8.12);
          box(skin.tile, x - .267, 1.924, cz, .54, 3.50, .38);
          const height = 3.12;
          const leaf = photoPanels.shutter.width * height;
          const center = leaf * .5 + .22;
          framedFront(x, cz - center, leaf, height, .306, 'shutter', skin);
          framedFront(x, cz + center, leaf, height, .306, 'shutterReverse', skin);
        } else {
          serviceBay(x, cz, workDepth, workWidth, ceiling, skin);
          serviceApron(x, cz, skin);
          box(mats.shutter, x - .314, 3.70, cz, .21, .61, workWidth - .07);
          box(mats.zinc, x - .194, 3.405, cz, .10, .104, workWidth - .03);
          solid(x - .308, cz, .33, workWidth, ceiling, false, 3.35);
        }
        box(mats.anthracite, x - .082, 3.55, cz, .29, .30, 8.26);
        for (const side of [-1, 1]) {
          box(skin.trim, x - .105, 2.035, cz + side * 4.02, .32, 3.44, .201);
          box(mats.anthracite, x - .045, 2.051, cz + side * 3.91, .175, 3.02, .062);
        }
      }
      for (const offset of [-4.56, 4.49]) {
        box(skin.tile, x - .45, 2.01, z + offset, 1.08, 3.77, .84);
        box(mats.metal, x - .035, 1.47, z + offset, .162, .74, .46);
        box(mats.amber, x + .052, .485, z + offset, .278, .52, .35);
        for (const y of [.32, .49, .64]) box(mats.anthracite, x + .197, y, z + offset, .022, .069, .34, 0, -.23);
      }
      box(skin.tile, x - .51, 4.188, z, 1.09, 1.28, depth);
      const signFace = api.signPlane ?? plane;
      box(mats.anthracite, x + .105, 4.265, z, .239, 1.485, 6.96);
      queue(signFace, mats.workshopMark, x + .232, 4.265, z, 6.76, 1.39, 1, EAST);
      const gable = z + depth * .5;
      box(skin.tile, x - width * .5, .70, gable + .019, width - .12, .99, .14);
      box(mats.amber, x - width * .5, 1.25, gable + .094, width - .26, .104, .033);
      box(mats.anthracite, x - 7.16, 2.745, gable + .139, 10.49, 3.13, .25);
      queue(signFace, mats.workshopMark, x - 7.16, 2.745, gable + .272, 10.26, 2.97, 1);
      for (const along of [4.09, 10.16]) {
        bar(mats.anthracite, x - along, 4.38, gable + .04, x - along, 4.64, gable + .95, .095);
        box(mats.metal, x - along, 4.59, gable + .97, .64, .15, .26, 0, .24);
        box(mats.warmFixture, x - along, 4.519, gable + .94, .55, .035, .19, 0, .24);
      }
      box(skin.trim, x - .063, base + .015, z, .36, .184, depth + .19);
      box(mats.anthracite, x + .398, 3.567, z, 1.16, .12, 27.6, 0, 0, -.082);
      box(mats.cyanFixture, x + .970, 3.516, z, .051, .059, 26.65);
      for (const offset of [-9.0, 0, 9.0]) box(mats.warmFixture, x + .532, 3.466, z + offset, .22, .072, 5.15);
      cast(x + 1.81, 3.14, z - 5.80, '#e8bd8c', 41, 17.5);
      solid(x + .398, z, 1.16, 27.6, 3.71, false, 3.44);

      for (let stall = 0; stall < 6; stall++) {
        ground(mats.whitePaint, x - .55, z + 19.4 + stall * 1.61, 3.25, .071, .205);
      }
      for (let wheel = 0; wheel < 3; wheel++) {
        pole(mats.tire, x - 2.14, FLOOR + .128 + wheel * .235, z + 17.09, .92, .225);
      }
      solid(x - 2.14, z + 17.09, .86, .86, .92, false);
      box(mats.zinc, x - 2.25, .257, z + 21.9, 2.00, .1, .27);
      box(mats.anthracite, x - 2.5, .257, z + 22.43, 2.45, .1, .28);
    }

    function steppedApartments(x, z, w, d) {
      const stone = sculptAt(x, z);
      const skin = skins.limestone;
      const terracotta = '#a96d54', shade = '#746c62', edge = '#d2c2a7', render = '#b9a991';
      const north = -d * .5, south = d * .5;
      const groundTop = 4.44;
      const floor = 3.09;
      stone.prism(cornerPlan(-w, 0, north, south), FLOOR, groundTop, '#6d7775', '#aba38e');
      stone.prism(cornerPlan(-w - .14, .2, north - .18, south + .18), groundTop - .36, groundTop + .08, edge);
      solid(x - w * .5, z, w, d, groundTop + .08);
      for (const part of [-1, 0, 1]) {
        streetWindow(x, z, [-w,south], [0,south], .50 + .263 * part, 4.40, 2.31, 2.28, skin.trim, (part + 3) & 3, part !== 1);
      }

      function wing(west, east, back, front, first, levels, color, galleries) {
        const y0 = groundTop + first * floor;
        const height = y0 + levels * floor;
        const plan = cornerPlan(west, east, back, front);
        stone.prism(plan, y0, height, color, '#afab98');
        tierCollision(x, z, west, east, back, front, 0, y0, height);
        for (let lev = 0; lev < levels; lev++) {
          const y = y0 + lev * floor;
          for (let side = 0; side < plan.length; side++) {
            // The upper wing opens south onto the planted roof of the lower wing.
            if (side === 1 && !galleries && first + lev < 4) continue;
            if (side === 3 && galleries) continue;
            const a = plan[side], b = plan[(side + 1) % plan.length];
            const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
            const n = Math.max(2, Math.floor(length / (side === 0 || side === 3 ? 6.4 : 4.3)));
            for (let k = 0; k < n; k++) {
              streetWindow(x,z,a,b,(k + .5) / n,Math.min(2.8,length / n * .56),y + 1.46,1.67,
                skin.trim,(side + k + lev * 3) & 3, (k * 3 + lev + side) % 6 < 2);
            }
          }
          if (galleries && (lev === 1 || lev === 3)) {
            const balcony = cornerPlan(west + .65, east + 1.39, back + .17, front + 1.73);
            const inside = cornerPlan(west + .65, east + 1.22, back + .17, front + 1.56);
            stone.prism(balcony, y - .235, y + .071, edge, '#9d9e8c', shade);
            stone.parapet(balcony.slice(1),inside.slice(1),y + .07,y + .72,terracotta,edge);
            tierCollision(x,z,west + .65,east + 1.39,back + .17,front + 1.73,0,y - .235,y + .071);
          }
        }
        stone.prism(cornerPlan(west - .18,east + .19,back - .16,front + .17),height - .14,height + .19,edge,'#858c80',shade);
        return height;
      }
      const lowRoof = wing(-w + .38, -2.05, 1.48, south - .24, 0, 4, render, true);
      wing(-w + .43, -.41, north + .30, 1.46, 0, 5, '#c3ae94', false);
      const crown = wing(-w + 3.36, -3.68, north + 1.65, -.27, 5, 2, '#a9846c', false);

      // The gallery, a setback tower and a braced tank house read at boulevard scale.
      for (const end of [-w + .47, -2.10]) {
        box(skin.trim, x + end, lowRoof + .50, z + (south + 2.0) * .5, .27, .82, south - 2.0);
      }
      box(skin.trim, x - w * .5 - .85, lowRoof + .50, z + south - .28, w - 2.18, .82, .26);
      for (const loc of [north + 1.27, -1.26]) {
        const fin = cornerPlan(-.56,.21,loc - .34,loc + .34);
        stone.prism(fin,groundTop - .12,groundTop + floor * 5 + .54,terracotta,'#d4a784',shade);
      }

      const tankX = x - w * .59, tankZ = z + north + 7.1;
      const frameY = crown + 1.91;
      for (const dx of [-2.56, 2.56]) for (const dz of [-2.30, 2.30]) {
        box(mats.anthracite,tankX + dx,frameY,tankZ + dz,.25,3.47,.25);
      }
      for (const dx of [-2.56, 2.56]) {
        bar(mats.metal,tankX + dx,crown + .28,tankZ - 2.3,tankX + dx,crown + 3.42,tankZ + 2.3,.15);
        bar(mats.metal,tankX + dx,crown + .28,tankZ + 2.3,tankX + dx,crown + 3.42,tankZ - 2.3,.15);
      }
      for (const dz of [-2.3, 2.3]) {
        bar(mats.metal,tankX - 2.56,crown + .28,tankZ + dz,tankX + 2.56,crown + 3.42,tankZ + dz,.15);
        box(mats.anthracite,tankX,crown + 3.49,tankZ + dz,5.67,.27,.32);
      }
      box(mats.darkRoof,tankX,crown + 3.63,tankZ,5.68,.21,5.16);
      pole(mats.metal,tankX,crown + 4.94,tankZ,4.26,2.44);
      for (const y of [3.84,4.74,5.85]) pole(mats.anthracite,tankX,crown + y,tankZ,4.34,.115);
      pole(mats.zinc,tankX,crown + 6.21,tankZ,4.42,.19);
    }

    function background(x, z, row, option, terraces) {
      const skin = skins[option === 0 ? 'limestone' : 'slate'];
      const w = 25.5 + option * 2.3;
      const d = 25.6 + option * 2.6;
      if (terraces) return steppedApartments(x, z, w, d);
      const height = 4.2 + (row + 2 + option) * 3.1;
      box(skin.wall, x - w * .5, (height + FLOOR) * .5, z, w, height - FLOOR, d);
      box(skin.tile, x - w * .5, 1.47, z, w + .21, 2.42, d + .18);
      for (let level = 0; level < row + 2 + option; level++) {
        const y = 4.03 + level * 3.1;
        for (let cell = -2; cell <= 2; cell++) {
          const wz = z + cell * d * .169;
          pane((level * 3 + cell) & 3, (level * 7 + cell) % 4 === 0, x + .023, y, wz, 2.37, 1.70, EAST);
          box(skin.trim, x + .08, y - .92, wz, .32, .12, 2.74);
          box(skin.trim, x + .09, y + .92, wz, .32, .11, 2.72);
          if ((cell + level) % 3 === 0) {
            box(skin.trim, x + .38, y - .96, wz, .82, .16, 2.86);
            box(mats.anthracite, x + .76, y - .32, wz, .06, .06, 2.84);
            for (let r = -1; r <= 1; r++) box(mats.anthracite, x + .76, y - .60, wz + r * .92, .05, .52, .05);
            box(mats.terracotta, x + .58, y - .78, wz + .65, .24, .20, .86);
            box(mats.foliage, x + .58, y - .62, wz + .65, .28, .18, .92);
          } else if ((cell + level) % 3 === 1) {
            box(mats.zinc, x + .16, y - 1.22, wz + .88, .34, .38, .62);
          }
        }
        if (level % 2 === 0) box(skin.trim, x + .06, y - 1.26, z, .34, .14, d + .22);
      }
      roof(x, z, w, d, height, skin, false);
      solid(x - w / 2, z, w, d, height + .69);
    }

    return { shop, garage, background, finishBlock };
  }

  function addBoulevardBlock(api, block) {
    const fronts = rows[block.zi];
    if (!fronts) return false;
    let build = kits.get(api.scene);
    if (!build) {
      build = architecture(api, makeKit(api));
      kits.set(api.scene, build);
    }
    const edge = block.x + block.width * .5 - 2.16;
    for (const spec of fronts) build.shop(edge - .032, block.z + spec.offset, spec);
    if (block.zi === 4) build.garage(edge, block.z - 23.2);
    const behind = block.x + .76;
    build.background(behind, block.z - 18.8, block.zi === 3 ? 7 : 6, 0);
    build.background(behind - 1.27, block.z + 19.1, block.zi === 2 ? 7 : 5, 1, block.zi === 3);
    build.finishBlock();
    return true;
  }

  D.addBoulevardBlock = addBoulevardBlock;
})();
