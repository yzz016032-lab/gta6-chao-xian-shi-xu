(() => {
  'use strict';
  const D = window.Tideline;
  const T = window.THREE;
  const MARINE = {
    mainDock: { minX: 336, maxX: 378, minZ: 199, maxZ: 217 },
    islandDock: { minX: 528, maxX: 584, minZ: 130, maxZ: 140.5 },
    island: { x: 631, z: 139, rx: 66, rz: 47 },
    job: { x: 354, z: 208 },
    launch: { x: 365, z: 220.9, yaw: Math.PI / 2 },
    mainLanding: { x: 365, z: 215.5 },
    islandBerth: { x: 541, z: 144.5, yaw: Math.PI / 2 },
    islandLanding: { x: 541, z: 139.3 },
    panel: { x: 614, z: 139 },
    buoy: { x: 470, z: 246 },
  };

  const tower = { x: 649, z: 134, lens: 23.85 };
  const deckHeight = .22;
  const landColor = new T.Color('#6f7b5d');
  const sandColor = new T.Color('#cbb692');
  const beachColor = new T.Color('#b6ae98');
  const seaSand = new T.Color('#4a8a85');

  const capeNoise = [
    'varying vec3 vCapePoint;',
    'float capeHash(vec2 p){ vec3 q=fract(vec3(p.xyx)*vec3(.1031,.0967,.1173)); q+=dot(q,q.yzx+33.33); return fract((q.x+q.y)*q.z); }',
    'float capeNoise(vec2 p){ vec2 i=floor(p),f=fract(p); f=f*f*(3.-2.*f);',
    '  return mix(mix(capeHash(i),capeHash(i+vec2(1,0)),f.x),mix(capeHash(i+vec2(0,1)),capeHash(i+1.),f.x),f.y); }',
  ].join('\n');

  function capeFinish(material, pattern, shading, relief = '') {
    material.customProgramCacheKey = () => 'cape-' + pattern;
    material.onBeforeCompile = shader => {
      shader.vertexShader = 'varying vec3 vCapePoint;\n' + shader.vertexShader.replace('#include <worldpos_vertex>', [
        '#include <worldpos_vertex>',
        'vec4 capePoint=vec4(transformed,1.);',
        '#ifdef USE_INSTANCING',
        '  capePoint=instanceMatrix*capePoint;',
        '#endif',
        'vCapePoint=(modelMatrix*capePoint).xyz;',
      ].join('\n'));
      shader.fragmentShader = capeNoise + '\n' + shader.fragmentShader.replace('#include <color_fragment>',
        '#include <color_fragment>\n' + shading);
      if (relief) shader.fragmentShader = shader.fragmentShader.replace('#include <normal_fragment_maps>',
        '#include <normal_fragment_maps>\n' + relief);
    };
    return material;
  }

  const capeRelief = [
    'vec3 capeDx=dFdx(-vViewPosition), capeDy=dFdy(-vViewPosition);',
    'vec3 capeS=cross(capeDy,normal), capeT=cross(normal,capeDx);',
    'float capeArea=dot(capeDx,capeS);',
    'normal=normalize(max(1e-8,abs(capeArea))*normal-sign(capeArea)*(dFdx(capeHeight)*capeS+dFdy(capeHeight)*capeT));',
  ].join('\n');

  function islandTerrain(scene) {
    const { x, z, rx, rz } = MARINE.island;
    const angles = 84;
    const rings = [.16, .32, .48, .62, .75, .86, .95, 1, 1.025, 1.057];
    const heights = rings.map(radius => radius > 1 ? .20 - (radius - 1) * 12.7 : .2);
    const points = [[x, .2, z]];
    const colors = [landColor.r, landColor.g, landColor.b];
    const shade = new T.Color();
    for (let row = 0; row < rings.length; row++) {
      const radius = rings[row];
      for (let i = 0; i < angles; i++) {
        const a = i / angles * Math.PI * 2;
        const edge = 1 + (.006 + (1 - radius) * .022) * Math.sin(a * 3.7 + radius * 7) + .007 * Math.sin(a * 9);
        const px = x + Math.cos(a) * rx * radius * edge;
        const pz = z + Math.sin(a) * rz * radius * edge;
        const wash = .5 + Math.sin(radius * 13 + a * 5) * .26 + Math.sin(a * 13 - radius * 18) * .15;
        const moss = Math.max(0, Math.min(1, (radius - .5) * 2.8 + ((px < x - 26) ? .33 : 0) + wash * .25));
        const height = heights[row] + (radius <= 1 ? Math.min(.024, Math.abs(pz - 139) * .0015) * Math.sin(a * 7 + radius * 47) : 0);
        shade.copy(landColor).lerp(sandColor, moss);
        if (radius > .94) shade.lerp(beachColor, Math.min(.75, (radius - .94) * 8.5));
        if (radius > 1) shade.lerp(seaSand, Math.min(.96, (radius - 1) * 14));
        shade.multiplyScalar(.86 + wash * .22);
        points.push([px, height, pz]);
        colors.push(shade.r, shade.g, shade.b);
      }
    }
    const triangles = [];
    for (let i = 0; i < angles; i++) triangles.push(1 + i, 0, 1 + (i + 1) % angles);
    for (let row = 1; row < rings.length; row++) {
      for (let i = 0; i < angles; i++) {
        const j = (i + 1) % angles;
        const inner = 1 + (row - 1) * angles;
        const outer = 1 + row * angles;
        triangles.push(outer + i, inner + i, outer + j, outer + j, inner + i, inner + j);
      }
    }
    const geometry = new T.BufferGeometry();
    geometry.setAttribute('position', new T.Float32BufferAttribute(points.flat(), 3));
    geometry.setAttribute('color', new T.Float32BufferAttribute(colors, 3));
    geometry.setIndex(triangles);
    geometry.computeVertexNormals();
    const terrain = capeFinish(new T.MeshStandardMaterial({ color: '#ffffff', roughness: .91, vertexColors: true }), 'soil', [
      'vec2 sand=vCapePoint.xz;',
      'float dunes=capeNoise(sand*vec2(.25,.19));',
      'float patches=capeNoise(sand*.71);',
      'float gritFade=1.-smoothstep(.026,.16,length(fwidth(sand)));',
      'float grit=capeHash(floor(sand*27.));',
      'float growth=smoothstep(.4,.69,dunes*.76+patches*.24)*smoothstep(-.07,.20,vCapePoint.y);',
      'float castOff=1.-smoothstep(.0,5.6,abs(sand.y-139.));',
      'float stubble=growth*(1.-.63*castOff);',
      'diffuseColor.rgb*=mix(vec3(.86,.80,.76),vec3(.79,1.05,.89),stubble);',
      'diffuseColor.rgb*=.89+patches*.19+(grit-.48)*gritFade*.25;',
      'float capeHeight=(patches-.5)*.055+(capeNoise(sand*9.)-.5)*gritFade*.019;',
    ].join('\n'), capeRelief);
    const beach = new T.Mesh(geometry, terrain);
    beach.receiveShadow = true;
    scene.add(beach);

    const surfPoints = [];
    const surfOpacity = [];
    const surfFaces = [];
    for (let i = 0; i <= angles; i++) {
      const a = i / angles * Math.PI * 2;
      const swell = .009 * Math.sin(a * 5 + .8) + .004 * Math.sin(a * 17 - .2);
      const patch = .16 + .81 * Math.pow(.5 + .5 * Math.sin(a * 15 + Math.cos(a * 7) * 2), 1.3);
      for (const [radius, opacity] of [[1.015, 0], [1.028, patch * .17], [1.061, patch * .43], [1.102, 0]]) {
        const r = radius + swell;
        surfPoints.push(x + Math.cos(a) * rx * r, -.447, z + Math.sin(a) * rz * r);
        surfOpacity.push(opacity);
      }
      if (i < angles) {
        for (let j = 0; j < 3; j++) {
          const at = i * 4 + j;
          surfFaces.push(at + 1, at, at + 5, at + 5, at, at + 4);
        }
      }
    }
    const surf = new T.BufferGeometry();
    surf.setAttribute('position', new T.Float32BufferAttribute(surfPoints, 3));
    surf.setAttribute('opacity', new T.Float32BufferAttribute(surfOpacity, 1));
    surf.setIndex(surfFaces);
    const surfMaterial = new T.ShaderMaterial({
      uniforms: { color: { value: new T.Color('#c2ece6') } },
      vertexShader: 'attribute float opacity; varying float vOpacity; varying float vDistance; void main(){ vOpacity=opacity; vDistance=distance(cameraPosition,position); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
      fragmentShader: [
        'uniform vec3 color; varying float vOpacity; varying float vDistance;',
        'void main(){ gl_FragColor=vec4(color,vOpacity*(1.0-smoothstep(36.0,480.0,vDistance)));',
        '#include <tonemapping_fragment>',
        '#include <colorspace_fragment>',
        '}',
      ].join('\n'),
      transparent: true, depthWrite: false,
    });
    scene.add(new T.Mesh(surf, surfMaterial));
  }

  function layeredOutcrop(style) {
    const faces = 20;
    const layers = [
      [-.55, .69], [-.35, .94], [-.05, .99], [.09, .94], [.125, .88],
      [.33, .81], [.39, .76], [.53, .68], [.64, .54], [.69, .40], [.75, .19],
    ];
    const points = [];
    const indices = [];
    for (const [row, [height, radius]] of layers.entries()) {
      for (let i = 0; i < faces; i++) {
        const angle = i * Math.PI * 2 / faces;
        const x = Math.cos(angle);
        const z = Math.sin(angle);
        const shatter = .89 + .11 * Math.cos(3 * angle + .96 + style) + .073 * Math.sin(angle * 7 - row * .36 + style);
        const slope = Math.sin(angle * 2 + .26 + style * 1.9) * .136 + x * (.09 + style * .068);
        const shift = (height + .35) * (.15 + style * .062);
        const edge = x * radius * shatter + shift;
        const fault = .62 + (2 - style) * .12 - height * .28;
        points.push(Math.min(edge, fault) + Math.max(0, edge - fault) * .32,
          height + slope * radius, z * radius * shatter - shift * .71);
        if (row === 0) continue;
        const lower = (row - 1) * faces + i;
        const next = (row - 1) * faces + (i + 1) % faces;
        indices.push(lower, lower + faces, next + faces, lower, next + faces, next);
      }
    }
    const summit = points.length / 3;
    points.push(.15 + style * .07, .751, -.13 - style * .04);
    for (let i = 0; i < faces; i++) {
      const last = (layers.length - 1) * faces;
      indices.push(last + i, summit, last + (i + 1) % faces);
    }
    const geometry = new T.BufferGeometry();
    geometry.setAttribute('position', new T.Float32BufferAttribute(points, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    return geometry;
  }

  function windPines(scene, crowns, branches, timber) {
    const random = D.rng(491719);
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 384;
    const context = canvas.getContext('2d');
    const greens = ['#2f523c', '#3e6245', '#4c734f', '#608659', '#749664', '#92a36c'];
    context.lineCap = 'round';
    for (let i = 0; i < 700; i++) {
      const heading = random() * Math.PI * 2;
      const radius = Math.sqrt(random()) * (.76 + .2 * Math.sin(heading * 5));
      const x = 192 + 181 * Math.cos(heading) * radius;
      const y = 191 + 137 * Math.sin(heading) * radius;
      const sprig = Math.sin(heading) * 2.4 + (random() - .5) * 1.0;
      const strength = 15 + random() * 34;
      context.strokeStyle = greens[Math.min(5, Math.floor(random() * 5.48 + (y < 180 ? .63 : 0)))];
      context.lineWidth = .73 + random() * 3.78;
      context.beginPath();
      for (let side = -2; side <= 2; side++) {
        const angle = sprig + side * .19;
        context.moveTo(x, y);
        context.lineTo(x + Math.sin(angle) * strength, y - Math.cos(angle) * strength);
      }
      context.stroke();
    }
    const map = new T.CanvasTexture(canvas);
    map.colorSpace = T.SRGBColorSpace;
    map.anisotropy = 4;
    const positions = [];
    const normals = [];
    const uvs = [];
    for (const [yaw, pitch] of [[0, -.87], [Math.PI / 3, -.38], [-Math.PI / 3, .24]]) {
      const panel = new T.PlaneGeometry(1.93, 1.64).rotateX(pitch).rotateY(yaw);
      const position = panel.getAttribute('position');
      const normal = panel.getAttribute('normal');
      const uv = panel.getAttribute('uv');
      for (const vertex of panel.index.array) {
        positions.push(position.getX(vertex), position.getY(vertex), position.getZ(vertex));
        normals.push(normal.getX(vertex), normal.getY(vertex), normal.getZ(vertex));
        uvs.push(uv.getX(vertex), uv.getY(vertex));
      }
      panel.dispose();
    }
    const sheets = new T.BufferGeometry();
    sheets.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
    sheets.setAttribute('normal', new T.Float32BufferAttribute(normals, 3));
    sheets.setAttribute('uv', new T.Float32BufferAttribute(uvs, 2));
    const foliage = new T.MeshStandardMaterial({ color: '#ffffff', map, roughness: .93, side: T.DoubleSide, alphaTest: .35 });
    const spreads = [[0, .18, 0, .79], [-.48, -.04, .11, .76], [.54, -.08, .02, .63], [-.18, -.16, .41, .75],
      [.29, -.24, -.42, .65], [.18, .31, .24, .72], [-.66, -.21, -.35, .56], [.62, -.13, .35, .47]];
    const leaves = new T.InstancedMesh(sheets, foliage, crowns.length * spreads.length);
    const trunk = new T.InstancedMesh(new T.CylinderGeometry(.31, .52, 1, 7), timber, branches.length);
    const marker = new T.Object3D();
    const cast = new T.Color();
    let i = 0;
    for (const tuft of crowns) {
      const spin = random() * .48;
      for (const [x, y, z, size] of spreads) {
        marker.position.set(tuft.x + x * tuft.w * 1.2, tuft.y + y * tuft.h, tuft.z + z * tuft.d * 1.55);
        marker.scale.set(tuft.w * size, 1.16 * size, tuft.d * size * 1.23);
        marker.rotation.set((random() - .5) * .36, spin + random() * Math.PI * 2, (random() - .5) * .33);
        marker.updateMatrix();
        leaves.setMatrixAt(i, marker.matrix);
        leaves.setColorAt(i++, cast.setRGB(.82 + random() * .18, .84 + random() * .16, .79 + random() * .19));
      }
    }
    const axis = new T.Vector3(0, 1, 0);
    branches.forEach(([ax, ay, az, bx, by, bz, radius], index) => {
      const direction = new T.Vector3(bx - ax, by - ay, bz - az);
      marker.position.set((ax + bx) * .5, (ay + by) * .5, (az + bz) * .5);
      marker.scale.set(radius, direction.length(), radius);
      marker.quaternion.setFromUnitVectors(axis, direction.normalize());
      marker.updateMatrix();
      trunk.setMatrixAt(index, marker.matrix);
    });
    for (const mesh of [leaves, trunk]) {
      mesh.receiveShadow = true;
      mesh.computeBoundingSphere();
      scene.add(mesh);
    }
  }

  function dressIsland(scene, solid, timber) {
    const outcrops = [
      [580, 129, 4.1, 2.2, 2.7], [589, 123, 6.4, 3.6, 4.2], [598, 115, 6.6, 4.3, 6.8],
      [588, 151, 5.0, 2.1, 3.3], [603, 159, 6.5, 3.0, 4.0], [610, 164, 6.9, 4.3, 7.8],
      [621, 170, 9.1, 6.8, 6.1], [633, 169, 8.6, 8.3, 8.2], [643, 164, 7.8, 7.4, 8.1],
      [648, 171, 11.1, 6.7, 7.2], [657, 159, 9.8, 7.5, 8.3], [668, 156, 8.0, 7.0, 5.9],
      [675, 147, 8.8, 7.5, 8.9], [684, 139, 7.1, 9.2, 5.6], [684, 128, 6.1, 5.8, 7.0],
      [672, 122, 9.0, 6.3, 9.3], [648, 111, 7.5, 6.0, 8.6], [640, 106, 5.9, 3.2, 4.1],
      [619, 111, 5.9, 4.1, 3.9], [626, 104, 6.3, 4.8, 4.5],
    ];
    const rocks = [];
    const brush = [];
    const crowns = [];
    const branches = [];
    const random = D.rng(721144);
    function sampleCluster(x, z, width, height, depth) {
      rocks.push({ x, z, w: width, h: height, d: depth });
      solid(x, z, width * 1.34, depth * 1.38, height * 1.24, false);
      for (let i = 0; i < 4; i++) {
        const a = random() * Math.PI * 2;
        const size = .24 + random() * .89;
        const px = x + Math.cos(a) * width * (.55 + random() * .69);
        const pz = z + Math.sin(a) * depth * (.55 + random() * .67);
        if (Math.abs(pz - 139) < 2.5 && px < 617) continue;
        const { x: ix, z: iz, rx, rz } = MARINE.island;
        if (Math.hypot((px - ix) / rx, (pz - iz) / rz) >= .94) continue;
        const pieces = i < 2 ? rocks : brush;
        pieces.push({ x: px, z: pz, w: size * 1.23, h: size * (i < 2 ? .61 : .94), d: size });
      }
    }
    for (const values of outcrops) sampleCluster(...values);
    for (const [x, z] of [[596, 130], [604, 146], [609, 123], [616, 151], [625, 126], [648, 148]]) {
      for (let i = 0; i < 6; i++) {
        const size = .35 + random() * .72;
        brush.push({ x: x + (random() - .5) * 6, z: z + (random() - .5) * 5, w: size, h: size * .69, d: size });
      }
    }
    for (const [x, z, height, lean] of [[587.8, 132.2, 5.2, 1], [596.2, 147.8, 6.2, -.8], [607.5, 125.3, 7.2, 1],
      [626.1, 148.6, 6.8, 1.24], [666.1, 120.3, 7.9, 1.43]]) {
      branches.push([x, .19, z, x + lean * .45, height * .65, z - .51, .39]);
      branches.push([x + lean * .45, height * .65, z - .51, x + lean * 1.7, height, z - .96, .239]);
      solid(x, z, .68, .62, height * .59, false);
      for (const [dx, dz, top, width] of [[.96, -.28, .92, 2.27], [1.91, -.67, 1.06, 1.71], [.51, .88, .84, 1.42]]) {
        const tipX = x + dx * lean;
        const tipZ = z + dz;
        branches.push([x + lean * .45, height * .62, z - .51, tipX, height * top, tipZ, .169]);
        branches.push([tipX, height * top, tipZ, tipX - width * .5, height * top + .14, tipZ + width * .33, .082]);
        branches.push([tipX, height * top, tipZ, tipX + width * .51, height * top - .083, tipZ - width * .25, .078]);
        crowns.push({ x: tipX, z: tipZ, y: height * top, w: width, h: 1.1, d: width * .76 });
      }
    }
    function scatter(points, geometry, dark, pale, material, casts = false) {
      const mesh = new T.InstancedMesh(geometry, material, points.length);
      const transform = new T.Object3D();
      const color = new T.Color();
      for (const [index, p] of points.entries()) {
        transform.position.set(p.x, p.y ?? p.h * .44 + .14, p.z);
        transform.rotation.set((random() - .5) * .28, random() * Math.PI * 2, (random() - .5) * .32);
        transform.scale.set(p.w, p.h, p.d);
        transform.updateMatrix();
        mesh.setMatrixAt(index, transform.matrix);
        mesh.setColorAt(index, color.copy(dark).lerp(pale, random() * .84));
      }
      mesh.computeBoundingSphere();
      mesh.receiveShadow = true;
      mesh.castShadow = casts;
      scene.add(mesh);
    }
    const limestone = capeFinish(new T.MeshStandardMaterial({ color: '#ffffff', roughness: .87 }), 'strata', [
      'vec3 p=vCapePoint;',
      'float fracture=capeNoise(p.xz*.91+p.y*.25);',
      'float stone=capeNoise(p.xz*2.8+vec2(p.y,-p.y*.62));',
      'float strata=p.y*.67+dot(p.xz,vec2(.12,-.098))+fracture*.31;',
      'float bed=1.-smoothstep(.015,.11,abs(fract(strata+.13)-.49));',
      'float joints=1.-smoothstep(.02,.15,abs(fract(strata*2.01+.26)-.5));',
      'float lamina=bed*.28+joints*.105;',
      'float detail=1.-smoothstep(.04,.32,length(fwidth(p)));',
      'float grit=capeHash(floor((p.xz+vec2(p.y,-p.y*.71))*23.));',
      'float lichen=smoothstep(.63,.86,stone*.57+fracture*.43)*(1.-bed*.75);',
      'diffuseColor.rgb*=.90+fracture*.27-lamina+(grit-.51)*detail*.25;',
      'diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*vec3(1.32,1.22,.72),lichen*.83);',
      'float capeHeight=(stone*.080-lamina*.24)*detail;',
    ].join('\n'), capeRelief);
    const darkRock = new T.Color('#59605b');
    const paleRock = new T.Color('#bbb098');
    const cliffs = rocks.filter(p => p.h > 1.5);
    for (let style = 0; style < 3; style++) {
      scatter(cliffs.filter((p, index) => index % 3 === style), layeredOutcrop(style), darkRock, paleRock, limestone, true);
    }
    scatter(rocks.filter(p => p.h <= 1.5), new T.IcosahedronGeometry(1, 1), darkRock, paleRock, limestone);
    const needles = new T.MeshStandardMaterial({ color: '#fff', roughness: 1, flatShading: false });
    scatter(brush, new T.IcosahedronGeometry(1, 1), new T.Color('#485647'), new T.Color('#84906b'), needles);
    windPines(scene, crowns, branches, timber);
  }

  function addMarineCoast({ scene, box, ground, solid, sign, bar, pole, nightMaterials }) {
    const mat = (color, roughness = .8, extras = {}) => new T.MeshStandardMaterial({ color, roughness, ...extras });
    const wood = mat('#70665d');
    const posts = mat('#5d6565');
    const metal = mat('#253941', .48, { metalness: .28 });
    const rail = mat('#617a7d', .61, { metalness: .2 });
    const stone = mat('#91938a');
    const paint = mat('#ebe3ca', .73);
    const wornRed = mat('#9c5846', .72);
    const ochre = mat('#bd985b', .65);
    const porchGlass = mat('#567a80', .32, { metalness: .13 });
    const roof = mat('#314f54', .70, { metalness: .13 });
    const lantern = mat('#fff3cc', .42, { emissive: '#ffc26e', emissiveIntensity: 1.55 });
    const greenSignal = mat('#b8ffe4', .45, { emissive: '#42e8b8', emissiveIntensity: 1.65 });
    nightMaterials.push([lantern, 3.1], [greenSignal, 2.5]);

    const halo = document.createElement('canvas');
    halo.width = halo.height = 80;
    const context = halo.getContext('2d');
    const haloFade = context.createRadialGradient(40, 40, 0, 40, 40, 39);
    haloFade.addColorStop(0, '#ffffffcc');
    haloFade.addColorStop(.48, '#ffffff5b');
    haloFade.addColorStop(1, '#ffffff00');
    context.fillStyle = haloFade;
    context.fillRect(0, 0, 80, 80);
    const haloTexture = new T.CanvasTexture(halo);
    const haloPaint = mat('#ffdeac', 1, {
      map: haloTexture, emissiveMap: haloTexture, emissive: '#e9a369', depthWrite: false,
      blending: T.AdditiveBlending, transparent: true, opacity: .45,
    });
    nightMaterials.push([haloPaint, .83]);

    const woodGrain = document.createElement('canvas');
    woodGrain.width = woodGrain.height = 128;
    const grain = woodGrain.getContext('2d');
    const random = D.rng(436251);
    grain.fillStyle = '#faf4eb';
    grain.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 144; i++) {
      const across = random() * 128;
      const start = random() * 134 - 10;
      const stop = start + 14 + random() * 73;
      grain.strokeStyle = 'rgba(74,45,19,' + (.02 + random() * .12) + ')';
      grain.lineWidth = .35 + random() * .67;
      grain.beginPath();
      grain.moveTo(across, start);
      grain.bezierCurveTo(across + .47, start + (stop - start) * .33, across - 1.1, stop - 2.7, across + .87, stop);
      grain.stroke();
    }
    const timberMap = new T.CanvasTexture(woodGrain);
    timberMap.colorSpace = T.SRGBColorSpace;
    timberMap.anisotropy = 4;
    const planks = ['#96816d', '#a89077', '#b2987c', '#9c8773', '#a38d75'].map(color => mat(color, .87, { map: timberMap }));
    function floatDeck(rect, stride) {
      const width = rect.maxX - rect.minX;
      const depth = rect.maxZ - rect.minZ;
      const midX = (rect.minX + rect.maxX) / 2;
      const midZ = (rect.minZ + rect.maxZ) / 2;
      box(wood, midX, -.12, midZ, width, .63, depth);
      for (const z of [rect.minZ + .44, rect.maxZ - .44]) {
        box(posts, midX, -.31, z, width, .49, .54);
        ground(wood, midX, z, width, .26, deckHeight + .004);
      }
      const sections = Math.ceil(width / stride);
      const plank = width / sections;
      for (let i = 0; i < sections; i++) {
        ground(planks[(i * 7 + Math.floor(i / 4)) % planks.length], rect.minX + (i + .5) * plank, midZ,
          plank - .024, depth - 1.16, deckHeight);
      }
      for (let x = rect.minX + 2.05; x < rect.maxX - .3; x += 7.5) {
        for (const z of [rect.minZ + 1.13, rect.maxZ - 1.13]) {
          pole(posts, x, -1.53, z, .91, 3.05);
          pole(metal, x, -.65, z, 1.02, .15);
          pole(wood, x, -.16, z, .98, .16);
        }
        bar(posts, x, -1.84, rect.minZ + 1.15, x + 3.93, -.14, rect.minZ + 1.15, .24);
      }
    }
    function fence(ax, az, bx, bz) {
      if (ax === bx) solid(ax, (az + bz) / 2, .16, Math.abs(bz - az), 1.36, false);
      else solid((ax + bx) / 2, az, Math.abs(bx - ax), .16, 1.36, false);
      const span = Math.hypot(bx - ax, bz - az);
      const steps = Math.ceil(span / 2.75);
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const x = ax + (bx - ax) * t;
        const z = az + (bz - az) * t;
        box(metal, x, .72, z, .12, 1.04, .12);
        box(rail, x, .273, z, .22, .094, .22);
      }
      bar(rail, ax, 1.24, az, bx, 1.24, bz, .11, .095);
      bar(metal, ax, .78, az, bx, .78, bz, .056);
    }
    function berthMark(x, z, length) {
      for (let i = 0; i < length; i += 1.07) ground(ochre, x + i, z, .61, .13, deckHeight + .014);
    }
    function dockLamp(x, z) {
      pole(metal, x, 1.42, z, .19, 2.47);
      pole(rail, x, .323, z, .37, .19);
      box(metal, x, 2.751, z, .51, .20, .58);
      box(lantern, x, 2.616, z, .366, .18, .435);
      box(metal, x, 2.499, z, .47, .09, .51);
      ground(haloPaint, x, z, 4.4, 4.4, deckHeight + .017);
    }
    function cleat(x, z, angle = 0) {
      box(rail, x, .26, z, .56, .07, .29, angle);
      box(metal, x, .41, z, .15, .26, .19, angle);
      box(metal, x, .55, z, .45, .12, .13, angle);
    }
    function furniture(x, z) {
      box(wood, x, .62, z, 2.44, .15, .62);
      box(wood, x, .93, z - .27, 2.44, .39, .12);
      for (const offset of [-1.04, 1.04]) box(metal, x + offset, .419, z, .14, .40, .52);
      solid(x, z, 2.46, .64, 1.135, false);
    }

    floatDeck(MARINE.mainDock, .66);
    ground(paint, 336.76, 208, 1.9, 16.33, deckHeight + .019);
    for (const z of [199.67, 216.41]) {
      for (const x of [342.4, 352.3, 374.6]) cleat(x, z);
    }
    fence(337.25, 199.68, 377.56, 199.68);
    fence(337.28, 216.51, 352.1, 216.51);
    fence(374.6, 216.44, 377.55, 216.44);
    fence(377.51, 210.37, 377.51, 216.43);
    fence(377.52, 199.7, 377.52, 202.2);
    berthMark(354.5, 215.96, 19.35);
    for (const x of [355.9, 373.3]) {
      box(metal, x, .38, 216.34, .32, .32, .37);
      box(greenSignal, x, .558, 216.34, .29, .055, .34);
    }
    for (const [x, z] of [[338.75, 215.85], [357.8, 200.45], [367.2, 200.45], [376.82, 213.9]]) dockLamp(x, z);

    const shelterX = 346.95;
    const shelterZ = 203.09;
    for (const x of [341.92, 352.05]) {
      for (const z of [200.73, 205.2]) {
        box(wood, x, 1.64, z, .29, 2.83, .29);
        box(metal, x, .37, z, .37, .31, .37);
        bar(rail, x, 2.39, z, x + (x < shelterX ? .66 : -.66), 3.03, z, .095);
        solid(x, z, .36, .36, 3.12, false);
      }
    }
    box(roof, shelterX, 3.12, shelterZ - 1.2, 11.53, .16, 2.85, 0, .095);
    box(roof, shelterX, 3.12, shelterZ + 1.36, 11.53, .16, 2.73, 0, -.096);
    box(rail, shelterX, 3.298, shelterZ + .04, 11.59, .145, .16);
    box(metal, shelterX, 3.02, 205.86, 11.61, .25, .26);
    box(metal, shelterX, 3.02, 200.36, 11.61, .25, .26);
    box(porchGlass, shelterX, 1.68, 200.71, 9.83, 2.12, .093);
    box(rail, shelterX, 2.76, 200.76, 10.02, .12, .14);
    for (const x of [343.35, 346.15, 349.51]) box(metal, x, 1.69, 200.76, .11, 2.2, .14);
    solid(shelterX, 200.71, 9.9, .15, 2.75, false);
    furniture(344.58, 201.61);
    furniture(348.67, 201.61);
    for (const x of [343.92, 349.96]) {
      box(lantern, x, 2.952, 203.83, 1.58, .082, .17);
      ground(haloPaint, x, 203.83, 5.2, 4.15, deckHeight + .017);
    }
    sign('灯塔湾码头', 'LANTERN BAY LANDING', '#c6f3db', shelterX, 2.72, 205.99, 6.01, 1.18, 0);
    sign('灯塔湾码头', 'LANTERN BAY LANDING', '#c6f3db', 341.76, 2.66, 203.18, 3.91, .98, -Math.PI / 2);

    islandTerrain(scene);
    dressIsland(scene, solid, wood);
    floatDeck(MARINE.islandDock, .68);
    fence(529.24, 130.57, 571.12, 130.57);
    fence(529.21, 139.97, 533.42, 139.97);
    fence(548.97, 139.97, 570.83, 139.97);
    fence(528.62, 130.58, 528.62, 139.96);
    berthMark(534.59, 139.77, 13.3);
    for (const x of [533.65, 549.08]) cleat(x, 139.86);
    for (const x of [532, 545, 557.6, 571]) dockLamp(x, 131.33);
    for (const z of [131.66, 137.32]) {
      box(metal, 533.12, 1.91, z, .3, 3.36, .29);
      box(ochre, 533.12, .54, z, .318, .28, .31);
      solid(533.12, z, .31, .30, 3.59, false);
    }
    box(roof, 533.12, 3.78, 134.49, .37, .32, 6.11);
    sign('岬灯岛', 'CAPE LANTERN', '#ffdda3', 532.916, 3.46, 134.49, 4.91, 1.04, -Math.PI / 2);

    const path = mat('#a49883', .90);
    const trim = mat('#c5b799', .86);
    ground(path, 600.3, 139.29, 39.66, 4.7, .232);
    for (const z of [136.93, 141.65]) ground(trim, 600.32, z, 39.7, .17, .235);
    for (const x of [584.6, 588.46, 592.34, 596.24, 600.2, 604.07, 608, 612, 616, 619.7]) {
      ground(wood, x, 139.29, .026, 4.55, .234);
    }
    for (const x of [583.4, 594.4, 604.45]) dockLamp(x, 136.14);
    box(stone, 617.28, .175, 133.6, 6.14, .10, 5.12);
    box(paint, 617.3, 1.42, 132.43, 5.64, 2.43, 3.54);
    box(roof, 617.3, 2.7, 132.4, 6.28, .22, 4.2, 0, -.086);
    box(porchGlass, 615.58, 1.6, 134.218, 1.64, .83, .06);
    box(metal, 617.96, 1.26, 134.225, 1.19, 1.96, .08);
    box(rail, 617.96, 1.08, 134.289, .11, .18, .07);
    box(lantern, 616.56, 2.52, 134.465, .41, .092, .14);
    box(wornRed, 615.92, .97, 135.67, 1.28, 1.50, .75);
    box(metal, 615.212, 1.08, 135.67, .14, .68, .61);
    box(greenSignal, 615.108, 1.22, 135.69, .09, .22, .37);
    for (const z of [135.48, 135.68, 135.86]) box(lantern, 615.102, .961, z, .05, .071, .071);
    box(metal, 615.08, 1.04, 137.18, .25, 1.64, 1.06);
    box(rail, 614.925, 1.5, 137.18, .12, .38, .918);
    box(greenSignal, 614.848, 1.526, 137.18, .07, .163, .64);
    box(wornRed, 614.824, 1.22, 137.4, .10, .139, .14);
    box(ochre, 614.799, .805, 137.18, .063, .12, .83);
    ground(haloPaint, 614, 137.45, 3.25, 3.31, .237);
    sign('灯塔维护站', 'BEACON CONTROL', '#ffe9ab', 617.21, 2.259, 134.241, 3.53, .74, 0);
    solid(617.3, 132.43, 5.64, 3.54, 2.83);
    solid(615.92, 135.67, 1.28, .75, 1.75, false);
    solid(615.08, 137.18, .30, 1.1, 1.88, false);

    const { x, z, lens } = tower;
    pole(stone, x, .49, z, 15.2, .54);
    pole(posts, x, .91, z, 13.5, .37);
    const profile = [
      [.01, .94], [6.17, .94], [6.17, 1.28], [5.62, 1.48], [5.48, 3.15], [5.34, 3.27],
      [5.16, 5.8], [5.063, 6.82], [5.061, 6.84], [4.954, 7.96], [4.952, 7.98], [4.94, 8.1],
      [4.68, 10.77], [4.39, 13.43], [4.316, 14.22], [4.314, 14.24], [4.199, 15.48], [4.197, 15.50], [4.14, 16.12],
      [3.86, 18.85], [3.78, 20.39], [4.25, 20.68], [4.34, 21.13], [.01, 21.13],
    ];
    const shell = new T.LatheGeometry(profile.map(([r, h]) => new T.Vector2(r, h)), 24);
    const shaftFinish = capeFinish(mat('#efe5cb', .79), 'beacon', [
      'vec3 p=vCapePoint;',
      'float y=p.y;',
      'float wash=capeNoise(vec2(dot(p.xz,vec2(.81,.61))*3.9,y*.24));',
      'float chalk=capeNoise(vec2(dot(p.xz,vec2(.61,-.8))*1.7,y*.92));',
      'float chipped=y+(chalk-.5)*.055;',
      'float fine=max(.004,fwidth(chipped));',
      'float first=smoothstep(6.83-fine,6.83+fine,chipped)*(1.-smoothstep(7.97-fine,7.97+fine,chipped));',
      'float second=smoothstep(14.23-fine,14.23+fine,chipped)*(1.-smoothstep(15.49-fine,15.49+fine,chipped));',
      'float rim=1.-smoothstep(1.48-fine,1.48+fine,chipped)+smoothstep(20.50-fine,20.50+fine,chipped);',
      'diffuseColor.rgb*=mix(vec3(1.),vec3(.62,.175,.115),clamp(first+second+rim,0.,1.));',
      'diffuseColor.rgb*=.81+.20*wash+.13*chalk;',
      'float capeHeight=(chalk-.5)*.042+(wash-.5)*.032;',
    ].join('\n'), capeRelief);
    const shaft = new T.Mesh(shell, shaftFinish);
    shaft.position.set(x, 0, z);
    shaft.castShadow = true;
    shaft.receiveShadow = true;
    scene.add(shaft);
    for (const [y, radius] of [[8.61, 4.9], [16.33, 4.15]]) {
      for (const side of [-1, 1]) {
        box(metal, x + side * radius, y, z, .12, 1.6, .73);
        box(porchGlass, x + side * (radius + .074), y + .06, z, .035, 1.23, .51);
      }
    }
    box(metal, x - 5.56, 2.35, z + .07, .28, 2.71, 1.84);
    box(rail, x - 5.77, 2.35, z + .09, .16, 2.53, 1.56);
    box(ochre, x - 5.884, 2.14, z + .51, .09, .14, .105);
    for (const [i, y] of [[0, .30], [1, .49], [2, .66], [3, .85]]) {
      box(stone, x - 7.09 + i * .35, y, z, 1.74 - i * .33, .17, 2.6);
    }
    pole(metal, x, 21.19, z, 10.15, .36);
    pole(rail, x, 21.43, z, 9.91, .18);
    const railingPosts = 14;
    for (let i = 0; i < railingPosts; i++) {
      const a = i / railingPosts * Math.PI * 2;
      const b = (i + 1) / railingPosts * Math.PI * 2;
      const px = x + Math.cos(a) * 4.78;
      const pz = z + Math.sin(a) * 4.78;
      box(metal, px, 22.04, pz, .102, 1.12, .102);
      for (const height of [21.89, 22.56]) {
        bar(rail, px, height, pz, x + Math.cos(b) * 4.78, height, z + Math.sin(b) * 4.78, .091);
      }
    }
    const chamber = new T.Mesh(new T.CylinderGeometry(2.92, 3.02, 3.12, 10, 1, true), mat('#587a83', .32, {
      transparent: true, opacity: .54, metalness: .18, side: T.DoubleSide, depthWrite: false,
    }));
    chamber.position.set(x, lens, z);
    scene.add(chamber);
    for (let i = 0; i < 10; i++) {
      const a = i / 10 * Math.PI * 2;
      box(metal, x + Math.cos(a) * 2.89, lens, z + Math.sin(a) * 2.89, .17, 3.28, .17);
    }
    pole(metal, x, lens - 1.64, z, 6.60, .35);
    pole(metal, x, lens + 1.63, z, 6.50, .26);
    const crown = new T.Mesh(new T.CylinderGeometry(.66, 3.47, 2.3, 10), roof);
    crown.position.set(x, lens + 2.81, z);
    scene.add(crown);
    pole(wornRed, x, lens + 4.14, z, .72, .49);
    pole(metal, x, lens + 4.77, z, .13, 1.13);
    solid(x, z, 12.6, 12.6, 28.22);
  }

  function makeIslandLight(scene) {
    const spinner = new T.Group();
    spinner.position.set(tower.x, tower.lens, tower.z);
    spinner.visible = false;
    scene.add(spinner);

    const core = new T.MeshStandardMaterial({ color: '#ffe0a1', emissive: '#ffcb7b', emissiveIntensity: 2.6, roughness: .36 });
    const bulb = new T.Mesh(new T.SphereGeometry(.73, 12, 8), core);
    spinner.add(bulb);

    const length = 133;
    const cone = new T.CylinderGeometry(.48, 9.55, length, 20, 1, true);
    cone.rotateZ(Math.PI / 2);
    cone.translate(length / 2 + 2.6, 0, 0);
    const uniforms = { strength: { value: 0 }, color: { value: new T.Color('#ffdfa8') } };
    const material = new T.ShaderMaterial({
      uniforms,
      vertexShader: [
        'varying float vAlong; varying float vSoft;',
        'void main(){',
        '  vec4 world=modelMatrix*vec4(position,1.0);',
        '  vec3 radial=normalize(mat3(modelMatrix)*vec3(0.0,position.y,position.z));',
        '  vAlong=position.x/136.0;',
        '  vSoft=abs(dot(normalize(cameraPosition-world.xyz),radial));',
        '  gl_Position=projectionMatrix*viewMatrix*world;',
        '}',
      ].join('\n'),
      fragmentShader: [
        'uniform vec3 color; uniform float strength; varying float vAlong; varying float vSoft;',
        'void main(){',
        '  float spread=pow(max(0.0,1.0-vAlong),1.8)*smoothstep(0.0,0.11,vAlong);',
        '  gl_FragColor=vec4(color,strength*spread*smoothstep(0.04,0.63,vSoft));',
        '#include <tonemapping_fragment>',
        '#include <colorspace_fragment>',
        '}',
      ].join('\n'),
      side: T.DoubleSide,
      transparent: true, depthWrite: false, blending: T.AdditiveBlending, forceSinglePass: true,
    });
    for (const heading of [0, Math.PI]) {
      const beam = new T.Mesh(cone, material);
      beam.rotation.y = heading;
      spinner.add(beam);
    }
    return (powered, time, night) => {
      spinner.visible = Boolean(powered);
      if (!powered) return;
      spinner.rotation.y = time * .42;
      uniforms.strength.value = .065 + night * .36;
      core.emissiveIntensity = 2.35 + night * 2.42 + .12 * Math.sin(time * 5.2);
    };
  }

  D.MARINE = MARINE;
  D.addMarineCoast = addMarineCoast;
  D.makeIslandLight = makeIslandLight;
})();
