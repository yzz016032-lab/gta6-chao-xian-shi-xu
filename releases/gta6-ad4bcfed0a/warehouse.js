(() => {
  'use strict';
  const D = window.Tideline;
  const point = (x, z) => ({ x, z });
  const bounds = { minX: -91, maxX: -41.5, minZ: 230, maxZ: 269 };
  const { minX: west, maxX: east, minZ: north, maxZ: south } = bounds;
  const centerX = (west + east) / 2;
  const centerZ = (north + south) / 2;
  const warehouse = {
    bounds,
    job: point(-18, 257),
    entry: point(east, 257),
    terminal: point(-48.5, 249.5),
    cache: point(-85.3, 239),
    sideExit: point(-81.5, north),
    escapeCar: { x: -20, z: 268.5, yaw: 0 },
    guardRoutes: [
      [point(-53, 247), point(-69, 247), point(-69, 261), point(-53, 261)],
      [point(-71, 245), point(-85.5, 245), point(-85.5, 263), point(-71, 263)],
    ],
    route: [
      point(-40, 257), point(-48.5, 257), point(-48.5, 249.5), point(-48.5, 235),
      point(-83, 235), point(-85.3, 239), point(-81.5, 235), point(-81.5, 226),
      point(-31, 226), point(-20, 268.5),
    ],
  };

  function addWarehouseVisuals({ T, box, ground, solid, sign, bar, pole, streetLight, nightMaterials }) {
    const base = .205;
    const eave = 6.65;
    const doorLow = 252.5;
    const doorHigh = 261.5;
    const clear = 4.47;
    const escapeLow = -83.35;
    const escapeHigh = -79.65;
    const fixtures = [
      [-48, 256, true], [-57, 244, true], [-66, 257, false], [-73, 234, false],
      [-77, 262, true], [-87, 238, true], [-88, 257, false], [-55, 264, true],
    ];
    const lighting = [
      ...fixtures.map(([x, z, warm]) => [x, 5.0, z, warm]),
      [east + 2.2, 4.53, warehouse.entry.z - 3.1, true],
      [east + 2.2, 4.53, warehouse.entry.z + 3.1, true],
    ].map(([x, y, z, warm]) => {
      const position = [x, y, z].map(value => value.toFixed(2)).join(',');
      const light = warm ? 'vec3(1.48,0.90,0.54)' : 'vec3(0.47,0.93,0.98)';
      return 'depotColor += depotFalloff(vDepotPoint, depotNormal, vec3(' + position + ')) * ' + light + ';';
    });
    function makeMaterial(color, roughness = .82, metalness = .05, weathered = false) {
      const material = new T.MeshStandardMaterial({ color, roughness, metalness });
      material.customProgramCacheKey = () => weathered ? 'relay-depot-worn' : 'relay-depot-metal';
      material.onBeforeCompile = shader => {
        shader.vertexShader = 'varying vec3 vDepotPoint;\n' + shader.vertexShader.replace('#include <worldpos_vertex>', [
          '#include <worldpos_vertex>',
          'vec4 depotPoint = vec4(transformed,1.0);',
          '#ifdef USE_INSTANCING',
          '  depotPoint = instanceMatrix * depotPoint;',
          '#endif',
          'vDepotPoint = (modelMatrix * depotPoint).xyz;',
        ].join('\n'));
        shader.fragmentShader = [
          'varying vec3 vDepotPoint;',
          'float depotFalloff(vec3 p, vec3 n, vec3 source) {',
          '  vec3 delta = source - p;',
          '  float distanceSq = max(.10, dot(delta,delta));',
          '  float incidence = max(0.0, dot(n,delta) * inversesqrt(distanceSq));',
          '  return (0.19+incidence*0.81)*max(0.0,1.0-distanceSq*.0049)/(1.0+distanceSq*.059);',
          '}',
          shader.fragmentShader.replace('#include <emissivemap_fragment>', [
            '#include <emissivemap_fragment>',
            'vec3 depotColor = vec3(0.0);',
            'vec3 depotNormal = inverseTransformDirection(normal, viewMatrix);',
            ...lighting,
            weathered ? [
              'vec3 depotGrain = fract(floor(vDepotPoint*21.0)*vec3(.1031,.0973,.1137));',
              'depotGrain += dot(depotGrain,depotGrain.yxz+27.13);',
              'float depotSpeckle = fract((depotGrain.x+depotGrain.y)*depotGrain.z);',
              'float depotNear = 1.0-smoothstep(10.0,35.0,distance(vDepotPoint,cameraPosition));',
              'float depotWear = sin(dot(vDepotPoint,vec3(2.413,.77,1.48))) * sin(dot(vDepotPoint,vec3(-1.39,1.04,2.88)));',
              'diffuseColor.rgb *= 1.0 + .092 * depotWear + .11 * depotNear * (depotSpeckle-.55);',
            ].join('\n') : '',
            'totalEmissiveRadiance += diffuseColor.rgb * depotColor;',
          ].join('\n')),
        ].join('\n');
      };
      return material;
    }
    const lightMaterial = (color, emissive, power) => {
      const material = new T.MeshStandardMaterial({ color, emissive, emissiveIntensity: .45, roughness: .61 });
      nightMaterials.push([material, power]);
      return material;
    };
    const slab = makeMaterial('#646c70', .88, 0, true);
    const apron = makeMaterial('#555d63', .84, 0, true);
    const seams = makeMaterial('#41494e');
    const plaster = makeMaterial('#929e9c', .82, .05, true);
    const basePanel = makeMaterial('#304a54');
    const siding = makeMaterial('#466973', .64, .26, true);
    const ribs = makeMaterial('#648891', .58, .32);
    const roof = makeMaterial('#344a56', .62, .28);
    const metal = makeMaterial('#415560', .52, .36);
    const dark = makeMaterial('#22303a', .78, .24);
    const rubber = makeMaterial('#1f252a', .96, .03);
    const safety = makeMaterial('#d99e36', .60, .16);
    const rust = makeMaterial('#b55844', .78, .18);
    const paper = makeMaterial('#c2bb99');
    const wood = makeMaterial('#7c6957', .92, 0);
    const crateA = makeMaterial('#88765e', .87, .03);
    const crateB = makeMaterial('#696f69', .84, .10);
    const crateC = makeMaterial('#a9906c', .92, 0);
    const skyGlass = lightMaterial('#2d565e', '#3f8585', .8);
    const amberGlass = lightMaterial('#5b5850', '#af7845', .98);
    const tube = lightMaterial('#ffebc2', '#ffcf86', 3.25);
    const relay = lightMaterial('#9cf0ce', '#4df2b8', 2.85);
    const red = lightMaterial('#db6848', '#ff472b', 2.35);
    const monitor = lightMaterial('#284751', '#205a63', .9);
    const paintColors = [basePanel, rust, crateB];
    const crateColors = [crateA, crateB, crateC, wood];
    let seed = 86021;
    function random() {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 4294967296;
    }

    function lampPool(color, opacity) {
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 96;
      const ctx = canvas.getContext('2d');
      const gradient = ctx.createRadialGradient(48, 48, 2, 48, 48, 47);
      gradient.addColorStop(0, '#ffffffff');
      gradient.addColorStop(.34, '#ffffff94');
      gradient.addColorStop(.72, '#ffffff28');
      gradient.addColorStop(1, '#ffffff00');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 96, 96);
      return new T.MeshBasicMaterial({
        color,
        map: new T.CanvasTexture(canvas),
        opacity,
        transparent: true,
        depthWrite: false,
        blending: T.AdditiveBlending,
      });
    }
    const amberPool = lampPool('#e39f59', .27);
    const cyanPool = lampPool('#4d998c', .24);

    function wallSegment(ax, az, bx, bz, outside) {
      const dx = bx - ax;
      const dz = bz - az;
      const length = Math.hypot(dx, dz);
      const x = (ax + bx) / 2;
      const z = (az + bz) / 2;
      const yaw = Math.atan2(-dz, dx);
      const nx = Math.sin(yaw) * outside;
      const nz = Math.cos(yaw) * outside;
      box(plaster, x, 1.33, z, length, 2.26, .39, yaw);
      box(basePanel, x + nx * .047, .68, z + nz * .047, length, .96, .384, yaw);
      box(siding, x, 4.54, z, length, 4.17, .34, yaw);
      box(dark, x, .277, z, length + .05, .135, .47, yaw);
      box(roof, x, 2.515, z, length, .14, .49, yaw);
      box(roof, x, 6.61, z, length + .10, .19, .47, yaw);
      for (let along = .55; along < length - .27; along += .79) {
        const rx = ax + dx * along / length;
        const rz = az + dz * along / length;
        box(ribs, rx + nx * .173, 4.53, rz + nz * .173, .063, 4.09, .070, yaw);
      }
      for (let along = .58; along < length - .44; along += 2.1 + random() * 1.6) {
        const px = ax + dx * along / length;
        const pz = az + dz * along / length;
        box(crateB, px + nx * .200, .50, pz + nz * .200, .24 + random() * .85, .075 + random() * .20, .022, yaw);
      }
      const isLongX = Math.abs(dx) > Math.abs(dz);
      solid(x, z, isLongX ? length : .40, isLongX ? .40 : length, eave);
    }

    function highWindow(x, z, yaw, width, glass) {
      const nx = Math.sin(yaw);
      const nz = Math.cos(yaw);
      const offset = (d, front) => [x + nz * d + nx * front, z - nx * d + nz * front];
      box(dark, x, 4.58, z, width + .24, 1.01, .16, yaw);
      const [gx, gz] = offset(0, .095);
      box(glass, gx, 4.59, gz, width, .75, .06, yaw);
      for (let i = -2; i <= 2; i++) {
        const [rx, rz] = offset(i * width * .168, .134);
        box(metal, rx, 4.59, rz, .064, .81, .075, yaw);
      }
      const [sx, sz] = offset(0, .16);
      box(roof, sx, 4.13, sz, width + .35, .14, .31, yaw);
    }

    function loadingDoor() {
      const z = warehouse.entry.z;
      box(siding, east, (clear + eave) / 2, z, .38, eave - clear, 9);
      box(dark, east, clear + .12, z, .70, .30, 9.42);
      box(ribs, east, clear + .30, z, .78, .17, 9.28);
      for (const end of [doorLow, doorHigh]) {
        box(dark, east, 2.40, end, .81, 4.43, .285);
        box(safety, east + .327, .99, end, .133, 1.60, .316);
        for (let i = 0; i < 4; i++) box(dark, east + .399, .36 + i * .33, end, .031, .14, .33, 0, .42);
        pole(safety, east + .98, .82, end, .24, 1.24);
        pole(dark, east + .98, .288, end, .38, .17);
        box(safety, east - .46, 2.47, end, .24, 4.46, .22);
        box(tube, east - .58, 3.84, end, .14, 1.04, .275);
      }
      box(roof, east + 1.81, 4.786, z, 4.58, .255, 12.66, 0, 0, -.044);
      box(ribs, east + 4.06, 4.69, z, .155, .32, 12.74);
      for (const edge of [-5.88, 5.88]) {
        bar(metal, east + .12, 3.50, z + edge, east + 3.51, 4.68, z + edge, .101);
        box(tube, east + 2.20, 4.608, z + edge * .52, 1.85, .092, .25);
      }
      box(dark, east + .274, 5.56, z, .20, 1.21, 11.45);
      box(safety, east + .30, 6.22, z, .24, .11, 11.65);
      box(red, east + .22, 6.82, z - 5.4, .22, .22, .22);
      box(red, east + .22, 6.82, z + 5.4, .22, .22, .22);
      sign('南埠七码仓', 'BAIXI DEPOT 7', '#ffe5ab', east + .387, 5.58, z, 11.18, 1.14, Math.PI / 2);
      ground(amberPool, east + 3.4, z, 11.0, 13.2, .222);
      ground(safety, east + 4.87, z, .11, 8.52, .217);
      for (let i = 0; i < 7; i++) ground(paper, east + 8.8, z - 3.8 + i * 1.25, 2.9, .16, .216);
    }

    function sideDoor() {
      const x = warehouse.sideExit.x;
      const span = escapeHigh - escapeLow;
      box(siding, x, 4.65, north, span, 4.0, .38);
      box(dark, x, 2.68, north, span + .25, .25, .62);
      for (const edge of [escapeLow, escapeHigh]) {
        box(metal, edge, 1.45, north, .235, 2.50, .72);
        box(safety, edge, .55, north + .277, .235, .65, .155);
      }
      box(relay, x, 2.69, north + .34, .89, .14, .155);
      sign('检修通道', 'SERVICE EXIT', '#9ee2c8', x, 2.98, north + .231, 2.89, .48, 0);
      ground(cyanPool, x, north + .7, 4.7, 6.1, .222);
      ground(paper, x, north - 2.00, 3.4, .115, .215);
    }

    function structure() {
      const width = east - west;
      const depth = south - north;
      ground(slab, centerX, centerZ, width - .12, depth - .12, .211);
      ground(apron, -33.5, 257, 15.45, 23.5, .213);
      for (let x = west + 3.7; x < east; x += 5.9) ground(seams, x, centerZ, .037, depth - .45, .212);
      for (let z = north + 4.2; z < south; z += 5.9) ground(seams, centerX, z, width - .45, .037, .212);

      wallSegment(west, north, escapeLow, north, -1);
      wallSegment(escapeHigh, north, east, north, -1);
      wallSegment(west, south, east, south, 1);
      wallSegment(west, north, west, south, 1);
      wallSegment(east, north, east, doorLow, -1);
      wallSegment(east, doorHigh, east, south, -1);
      // The north wall has a walk-through service entrance.
      loadingDoor();
      sideDoor();
      for (const z of [234.8, 242.1, 248.3, 265.5]) {
        highWindow(east + .186, z, Math.PI / 2, z > 261 ? 3.7 : 4.1, z === 242.1 ? amberGlass : skyGlass);
      }
      for (const x of [-88.1, -75.6, -69.2, -61.5, -53.8, -46.0]) {
        highWindow(x, north - .185, Math.PI, 4.25, x === -61.5 ? amberGlass : skyGlass);
        highWindow(x, south + .185, 0, 4.25, x < -68 ? skyGlass : amberGlass);
      }

      const slope = .088;
      const rise = Math.tan(slope) * depth / 2;
      const roofMidY = eave + rise / 2 + .11;
      for (const side of [-1, 1]) {
        const pitch = side * slope;
        const z = centerZ + side * depth / 4;
        box(roof, centerX, roofMidY, z, width + 1.46, .21, depth / (2 * Math.cos(slope)) + .53, 0, pitch);
        for (let x = west - .43; x <= east + .61; x += 1.14) {
          box(ribs, x, roofMidY + .112, z, .049, .072, depth * .502 + .5, 0, pitch);
        }
        for (let segment = 0; segment < 18; segment++) {
          const z = (side === -1 ? north : south) - side * (.53 + segment * 1.07);
          const high = eave + rise - Math.abs(z - centerZ) * Math.tan(slope);
          for (const x of [west, east]) box(siding, x, (high + eave) * .5, z, .40, high - eave + .09, 1.084);
        }
      }
      box(ribs, centerX, eave + rise + .211, centerZ, width + 1.53, .20, .36);
      for (const x of [-87.0, -77.7, -68.4, -59.1, -49.8, -44.2]) {
        for (const z of [north + .10, south - .10]) {
          box(dark, x, 3.41, z, .23, 6.42, .30);
          box(safety, x, .82, z, .276, 1.17, .335);
        }
        box(metal, x, 5.94, centerZ, .27, .32, depth - .29);
        bar(metal, x, 6.52, north + .1, x, eave + rise - .31, centerZ, .181);
        bar(metal, x, eave + rise - .31, centerZ, x, 6.52, south - .10, .181);
        for (const side of [-1, 1]) {
          bar(metal, x, 5.97, centerZ + side * 5.7, x, 7.61, centerZ + side * 10.0, .093);
          bar(metal, x, 5.96, centerZ + side * 16.1, x, 7.61, centerZ + side * 10.0, .093);
        }
      }
      box(dark, centerX, 5.82, 266.99, width - .45, .31, .30);
      box(rust, centerX, 5.68, 232.12, width - .50, .114, .11);
      box(ribs, -55, 5.60, centerZ, .08, .16, depth - 2.25);

      for (const [x, z, amber] of fixtures) {
        for (const dx of [-.65, .65]) bar(metal, x + dx, 6.21, z, x + dx, 5.14, z, .047);
        box(dark, x, 5.17, z, 2.13, .213, .55);
        box(metal, x, 5.057, z, 2.16, .090, .60);
        box(amber ? tube : relay, x, 4.996, z, 1.78, .069, .24);
        ground(amber ? amberPool : cyanPool, x, z, 11.8, 10.1, .224 + (x + 91) * .000024);
      }
    }

    function cargoBox(x, y, z, w, h, d, material, marked = true) {
      const face = z + d / 2;
      box(material, x, y + h / 2, z, w, h, d);
      for (const offset of [-.39, .39]) {
        box(wood, x + w * offset, y + h * .50, face + .024, w * .081, h * .97, .060);
        box(wood, x + w * offset, y + h * .50, z - d / 2 - .024, w * .081, h * .97, .060);
        box(dark, x + w * offset, y + h + .025, z, w * .054, .055, d + .065);
      }
      box(dark, x, y + h * .48, face + .043, Math.min(.38, w * .30), .07, .043);
      if (marked) {
        box(paper, x - w * .21, y + h * .73, face + .037, w * .19, h * .13, .015);
        box(dark, x - w * .21, y + h * .73, face + .048, w * .14, .017, .013);
      }
    }

    function shelf(x, z, length, depth) {
      const height = 3.38;
      const bays = Math.ceil(length / 2.65);
      const bay = length / bays;
      const levels = [.41, 1.45, 2.50];
      for (const y of levels) {
        box(metal, x, y, z, length, .132, depth);
        for (const side of [-1, 1]) box(safety, x, y, z + side * depth * .49, length + .16, .105, .145);
      }
      for (let post = 0; post <= bays; post++) {
        const px = x - length / 2 + post * bay;
        for (const side of [-1, 1]) {
          const pz = z + side * depth / 2;
          box(metal, px, (height + base) / 2, pz, .087, height - base, .133);
          box(safety, px, .508, pz, .151, .617, .159);
          box(dark, px, .254, pz, .253, .091, .295);
        }
        bar(dark, px, .521, z - depth / 2, px, height - .32, z + depth / 2, .062);
        bar(dark, px, height - .32, z - depth / 2, px, .521, z + depth / 2, .062);
      }
      for (let i = 0; i < bays; i++) {
        const px = x - length / 2 + bay * (i + .5);
        for (const y of levels) {
          const color = crateColors[Math.floor(random() * crateColors.length)];
          const w = bay * (.66 + random() * .19);
          const h = .68 + random() * .25;
          const front = z + (random() - .5) * .21;
          cargoBox(px, y + .066, front, w, h, depth * .79, color, random() > .25);
        }
      }
      solid(x, z, length + .16, depth + .17, height);
    }

    function palletStack(x, z, wide, deep, rows, colorIndex) {
      for (let i = -2; i <= 2; i++) box(wood, x + i * wide * .183, .282, z, wide * .145, .13, deep + .13);
      for (let i = 0; i < rows; i++) {
        cargoBox(x + (i % 2 ? .05 : 0), .349 + i * .70, z - i * .08, wide, .7, deep - i * .075,
          crateColors[(colorIndex + i) % crateColors.length]);
      }
      solid(x, z, wide + .13, deep + .24, .35 + .7 * rows);
    }

    function terminals() {
      const x = -46.55;
      const z = 247.3;
      box(dark, x, .718, z, 2.24, 1.02, .88);
      box(metal, x, 1.270, z, 2.44, .125, 1.07);
      box(ribs, x, .577, z + .448, 1.93, .55, .060);
      for (const dx of [-.60, .62]) {
        box(dark, x + dx, 1.636, z - .21, .61, .335, .111, 0, -.165);
        box(monitor, x + dx, 1.635, z - .142, .515, .264, .031, 0, -.165);
        for (let i = 0; i < 4; i++) {
          box(i === 0 ? relay : skyGlass, x + dx - .22 + (.25 + .035 * i) / 2, 1.559 + i * .047, z - .113,
            .25 + .035 * i, .013, .019, 0, -.165);
        }
      }
      box(dark, x - .58, 1.347, z + .25, .49, .045, .27);
      box(red, x + .82, 1.373, z + .27, .091, .063, .099);
      box(relay, x + .59, 1.374, z + .27, .101, .069, .098);
      box(ribs, x, 2.23, z - .25, 2.39, .57, .09);
      sign('装卸控制台', 'LOADING CONTROL', '#b6f4e2', x, 2.23, z - .195, 2.31, .51, 0);
      for (const dx of [-1.06, 1.06]) bar(metal, x + dx, 1.32, z - .25, x + dx, 2.45, z - .25, .078);
      solid(x, z, 2.35, .91, 1.29);

      const cx = -88.27;
      const cz = warehouse.cache.z;
      box(ribs, cx, 1.39, cz, 1.09, 2.34, 2.37);
      box(dark, cx + .552, 1.40, cz, .119, 2.11, 2.10);
      box(safety, cx + .621, 1.39, cz, .058, 2.13, .07);
      for (const edge of [-.83, .83]) {
        box(metal, cx + .622, 1.52, cz + edge, .071, .83, .082);
        for (let i = 0; i < 4; i++) box(seams, cx + .626, 1.92 - i * .105, cz + edge * .77, .024, .055, .458);
      }
      box(monitor, cx + .642, 1.49, cz + .38, .078, .28, .29);
      box(relay, cx + .687, 1.52, cz + .38, .024, .051, .175);
      sign('信号中继', 'SIGNAL RELAY', '#ffd995', cx + .623, 2.29, cz, 1.51, .37, Math.PI / 2);
      ground(amberPool, cx + 2.2, cz, 5.8, 5.0, .228);
      solid(cx, cz, 1.22, 2.43, 2.58);
    }

    function apronProps() {
      for (const x of [-36.3, -28.7]) {
        ground(safety, x, 267.0, 6.12, .104, .216);
        ground(safety, x, 272.4, 6.12, .104, .216);
        ground(safety, x - 3.01, 269.7, .104, 5.44, .216);
      }
      for (const x of [-35.9, -31.9, -27.9]) {
        pole(dark, x, .248, 278.2, .35, .088);
        pole(safety, x, .785, 278.2, .186, 1.19);
        pole(dark, x, 1.099, 278.2, .19, .14);
      }
      const fx = -56;
      const fz = 223.6;
      for (const dz of [-.87, .87]) {
        for (const dx of [-1.08, 1.04]) {
          box(rubber, fx + dx, .58, fz + dz, .82, .61, .43);
          box(rubber, fx + dx, .58, fz + dz, .66, .45, .435, 0, 0, Math.PI / 4);
          box(metal, fx + dx, .58, fz + dz * 1.26, .281, .281, .070);
        }
      }
      box(safety, fx - .35, .784, fz, 3.3, 1.003, 1.62);
      box(roof, fx - .33, 1.298, fz, 2.27, .093, 1.50);
      box(safety, fx - 1.37, 1.472, fz, 1.22, .47, 1.54);
      box(dark, fx - .33, 1.54, fz, .54, .48, .56, 0, 0, -.075);
      for (const dz of [-.76, .76]) {
        bar(dark, fx - 1.43, 1.26, fz + dz, fx - 1.42, 2.65, fz + dz, .121);
        bar(dark, fx + .89, 1.27, fz + dz, fx + .72, 2.65, fz + dz, .121);
        box(metal, fx + 1.33, 1.66, fz + dz * .83, .18, 2.66, .16);
        box(ribs, fx + 2.33, .383, fz + dz * .81, 1.91, .154, .183);
      }
      box(dark, fx - .28, 2.67, fz, 2.58, .123, 1.72);
      box(red, fx - 1.23, 2.79, fz + .61, .18, .16, .18);
      solid(fx, fz, 3.66, 1.97, 2.67);

      function container(x, z, w, d, color, stacked = false) {
        const height = 2.59;
        const y = base + (stacked ? height + .115 : 0);
        box(color, x, y + height / 2, z, w, height, d);
        for (const side of [-1, 1]) {
          const face = z + side * d / 2;
          for (let xx = x - w * .46; xx < x + w * .47; xx += .41) {
            box(color, xx, y + 1.31, face, .116, 2.26, .16);
          }
          for (const h of [.102, height - .105]) box(metal, x, y + h, face, w + .065, .15, .14);
        }
        for (const side of [-1, 1]) {
          const edge = x + side * w / 2;
          for (const dz of [-.43, -.18, .18, .43]) {
            box(ribs, edge + side * .061, y + 1.34, z + d * dz, .13, 2.28, .06);
          }
        }
        if (!stacked) solid(x, z, w + .13, d + .15, 2.81);
      }
      container(-94.26, 220.17, 9.32, 4.07, paintColors[1]);
      container(-94.24, 220.19, 9.28, 4.03, paintColors[2], true);
      container(-73.74, 216.53, 12.2, 3.44, paintColors[0]);
      container(-68.2, 276.7, 12.11, 3.13, paintColors[0]);
      palletStack(-93.82, 275.3, 4.33, 2.66, 2, 1);
      palletStack(-90.4, 275.55, 2.01, 2.37, 1, 3);
      streetLight(-30.3, 239.8, -Math.PI / 2);
      streetLight(-34.0, 278.4, 0);

      for (const x of [-51.4, -46.73, -42.06]) {
        pole(dark, x, 1.27, 278.0, .108, 2.04);
        if (x > -50) {
          box(metal, x - 2.335, 2.11, 278, 4.71, .095, .095);
          box(metal, x - 2.335, .471, 278, 4.71, .084, .083);
          for (let across = 0; across < 4.62; across += .55) {
            const start = x - 4.63 + across;
            const reach = Math.min(x, start + 1.15);
            const height = .48 + (reach - start) * 1.42;
            bar(ribs, start, .48, 278, reach, height, 278, .026);
            bar(ribs, start, 2.11, 278, reach, 2.59 - height, 278, .026);
          }
        }
      }
      solid(-46.7, 278, 9.52, .13, 1.10);
    }

    // Leave the main crossing and north service aisle clear of the racks.
    structure();
    shelf(-56.8, 239.1, 10.2, 2.4);
    shelf(-71.4, 239.1, 10.2, 2.4);
    shelf(-60.2, 253.6, 10.25, 2.15);
    shelf(-78.0, 253.6, 11.6, 2.15);
    palletStack(-57.7, 267.28, 4.8, 2.33, 2, 0);
    palletStack(-51.4, 267.18, 4.2, 2.41, 1, 2);
    palletStack(-76.1, 267.21, 6.3, 2.37, 2, 1);
    palletStack(-81.35, 267.17, 3.4, 2.33, 3, 3);
    palletStack(-88.6, 260.28, 2.57, 4.5, 3, 0);
    for (const z of [241.2, 243.1]) {
      ground(safety, -49.25, z, .110, 1.38, .216);
      ground(safety, -44.96, z, .110, 1.38, .216);
    }
    terminals();
    apronProps();
  }

  Object.assign(D, { WAREHOUSE: warehouse, addWarehouseVisuals });
})();
