(() => {
  'use strict';
  const T = window.THREE;
  const D = window.Tideline;
  const CARS = [
    { name: '海风 GT', kind: 'hatch', top: 36, power: 12.8, grip: 9.3, color: '#2c6972' },
    { name: '赤潮 RS', kind: 'coupe', top: 43, power: 15.4, grip: 10.1, color: '#bc392c' },
    { name: '邮轮 S', kind: 'sedan', top: 33, power: 11.6, grip: 8.6, color: '#d9bc89' },
    { name: '南埠货车', kind: 'van', top: 28, power: 9.5, grip: 6.65, color: '#7e9b8e' },
  ];
  const PATROL = { name: '白汐巡逻车', kind: 'patrol', top: 36, power: 12.4, grip: 9, color: '#191f30' };
  const tint = (color, k) => new T.Color(color).multiplyScalar(k);

  function makeFactory(scene, surfaceHeight, sky) {
    const box = new T.BoxGeometry(1, 1, 1);
    const round = new T.IcosahedronGeometry(.5, 1);
    const cylinder = new T.CylinderGeometry(.5, .5, 1, 9);
    const cylinderAxle = new T.CylinderGeometry(.5, .5, 1, 12).rotateZ(Math.PI / 2);
    const material = new T.MeshStandardMaterial({ vertexColors: true, roughness: .56, metalness: .26, envMapIntensity: .66 });
    const enamel = new T.MeshPhysicalMaterial({
      vertexColors: true, roughness: .26, metalness: .38, clearcoat: .72, clearcoatRoughness: .16, envMapIntensity: 1.02,
    });
    const glazing = new T.MeshPhysicalMaterial({
      vertexColors: true, roughness: .11, metalness: .18, clearcoat: .88, clearcoatRoughness: .07, envMapIntensity: 1.20,
    });
    const heroEnamel = new T.MeshPhysicalMaterial({
      vertexColors: true, roughness: .20, metalness: .35, clearcoat: .95, clearcoatRoughness: .09, envMapIntensity: 1.24,
    });
    const heroGlazing = new T.MeshPhysicalMaterial({
      vertexColors: true, roughness: .09, metalness: .10, clearcoat: .98, clearcoatRoughness: .05, envMapIntensity: 1.38,
    });
    const skyLight = { value: 1 };
    function varnish(surface, amount) {
      const hasHarbor = Boolean(sky && D.harborReflectionTexture);
      surface.customProgramCacheKey = () => 'hero-sky-' + amount + '-' + hasHarbor;
      surface.onBeforeCompile = shader => {
        shader.uniforms.heroSkyLight = skyLight;
        if (hasHarbor) Object.assign(shader.uniforms, { harborStrip: { value: D.harborReflectionTexture() },
          harborClouds: sky.duskPhoto, harborSun: sky.sun, harborDusk: sky.duskMix, cloudReady: sky.duskImage });
        const harborUniforms = hasHarbor ? 'uniform sampler2D harborStrip,harborClouds; uniform vec3 harborSun; uniform float harborDusk,cloudReady;\n' : '';
        shader.fragmentShader = 'uniform float heroSkyLight;\n' + harborUniforms + shader.fragmentShader.replace('#include <emissivemap_fragment>', [
          '#include <emissivemap_fragment>',
          'vec3 eye = normalize(vViewPosition);',
          'vec3 reflectedSky = inverseTransformDirection(reflect(-eye,normal),viewMatrix);',
          'float lifted = smoothstep(-.16,.59,reflectedSky.y);',
          'float edge = pow(1.0-clamp(dot(eye,normal),0.,1.),3.0);',
          'float warm = pow(max(dot(reflectedSky,vec3(.51,.19,-.839)),0.),11.0);',
          'vec3 air = mix(vec3(.34,.43,.54),vec3(.10,.21,.37),lifted);',
          hasHarbor ? [
            'float altitude = asin(clamp(reflectedSky.y,-1.,1.));',
            'vec2 harborUV = vec2(.5 + atan(reflectedSky.z,reflectedSky.x)*.159155, .5+altitude*.31831);',
            'vec3 surroundings = texture2D(harborStrip,harborUV,.7).rgb;',
            'float bearing = atan(reflectedSky.x,-reflectedSky.z)-atan(harborSun.x,-harborSun.z);',
            'float u = .488 + atan(sin(bearing),cos(bearing))/2.714;',
            'float cloudWeight = harborDusk*cloudReady*smoothstep(.02,.24,reflectedSky.y)*smoothstep(0.,.19,min(u,1.-u));',
            'vec3 clouds = texture2D(harborClouds,vec2(clamp(u,.001,.999),clamp(altitude*.63-.011,0.,.998)),1.).rgb;',
            'vec3 coat = mix(surroundings,clouds,cloudWeight);',
            'totalEmissiveRadiance += heroSkyLight*' + amount.toFixed(2) + '*(coat*(.55+1.45*edge) + air*lifted*.24 + vec3(.30,.16,.07)*warm);',
          ].join('\n') : 'totalEmissiveRadiance += heroSkyLight*' + amount.toFixed(2) + '*(air*lifted*(.24+.76*edge)+vec3(.32,.14,.055)*warm);',
        ].join('\n'));
      };
    }
    varnish(heroEnamel, .35);
    varnish(heroGlazing, .49);
    heroGlazing.transparent = true;
    heroGlazing.depthWrite = false;
    const finishGlazing = heroGlazing.onBeforeCompile;
    heroGlazing.onBeforeCompile = shader => {
      finishGlazing(shader);
      shader.vertexShader = 'varying float gtPrivacy;\n' + shader.vertexShader.replace('#include <begin_vertex>',
        '#include <begin_vertex>\ngtPrivacy = 1. - smoothstep(-1.25,-.24,position.z);');
      shader.fragmentShader = 'varying float gtPrivacy;\n' + shader.fragmentShader.replace('#include <opaque_fragment>',
        'diffuseColor.a = mix(.51,.72,gtPrivacy) + mix(.39,.19,gtPrivacy) * pow(1. - clamp(dot(normal,normalize(vViewPosition)),0.,1.),1.15);\n#include <opaque_fragment>');
    };
    const fabric = new T.MeshStandardMaterial({ vertexColors: true, roughness: .91, metalness: .02 });
    // Our clothing vertices use at most two joints. Reuse their blended
    // transform for position and normal, including the rigid garment panels.
    function skinClothes(shader) {
      shader.vertexShader = shader.vertexShader.replace('#include <skinbase_vertex>', `#ifdef USE_SKINNING
        mat4 joints = getBoneMatrix(skinIndex.x);
        if (skinWeight.y > 0.) joints = joints * skinWeight.x + getBoneMatrix(skinIndex.y) * skinWeight.y;
        mat4 garmentPose = bindMatrixInverse * joints * bindMatrix;
      #endif`).replace('#include <skinnormal_vertex>', `#ifdef USE_SKINNING
        objectNormal = mat3(garmentPose) * objectNormal;
        #ifdef USE_TANGENT
          objectTangent = mat3(garmentPose) * objectTangent;
        #endif
      #endif`).replace('#include <skinning_vertex>', `#ifdef USE_SKINNING
        transformed = (garmentPose * vec4(transformed, 1.)).xyz;
      #endif`);
    }
    fabric.onBeforeCompile = skinClothes;
    const frontLight = new T.MeshStandardMaterial({ color: '#fffaf0', emissive: '#fff1c9', emissiveIntensity: .95 });
    const backLight = new T.MeshStandardMaterial({ color: '#ff4958', emissive: '#ff1630', emissiveIntensity: .92 });
    const brakeLight = new T.MeshStandardMaterial({ color: '#ff8a7a', emissive: '#ff2b1c', emissiveIntensity: 4.1 });
    const heroHeadLight = new T.MeshBasicMaterial({ vertexColors: true });
    const heroTailLight = new T.MeshBasicMaterial({ vertexColors: true });
    const heroBrakeLight = new T.MeshBasicMaterial({ vertexColors: true, color: new T.Color().setScalar(2.8) });
    const redLight = new T.MeshStandardMaterial({ color: '#f75361', emissive: '#ff153e', emissiveIntensity: 3.1 });
    const blueLight = new T.MeshStandardMaterial({ color: '#5fb5f6', emissive: '#2778ff', emissiveIntensity: 3.8 });
    const models = new Map();
    const dummy = new T.Object3D();
    const p = new T.Vector3();
    const n = new T.Vector3();
    const normalMatrix = new T.Matrix3();

    function coloredPart(geometry, color, x = 0, y = 0, z = 0, w = 1, h = 1, d = 1, roll = 0, yaw = 0, pitch = 0) {
      dummy.position.set(x, y, z);
      dummy.scale.set(w, h, d);
      dummy.rotation.set(pitch, yaw, roll, 'YXZ');
      dummy.updateMatrix();
      return { geometry, color: new T.Color(color), matrix: dummy.matrix.clone() };
    }
    const block = (color, ...dimensions) => coloredPart(box, color, ...dimensions);

    function coloredGeometry(parts) {
      const positions = [];
      const normals = [];
      const colors = [];
      const indices = [];
      const uvs = parts.some(part => part.textureRect) ? [] : null;
      const jointIndices = [];
      const jointWeights = [];
      for (const { geometry, color, matrix, skin, textureRect } of parts) {
        const pos = geometry.getAttribute('position');
        const normal = geometry.getAttribute('normal');
        const tintAttribute = geometry.getAttribute('color');
        const uv = uvs ? geometry.getAttribute('uv') : null;
        const uvRect = uvs ? (textureRect ?? [0, 0, 1, 1]) : null;
        const sourceIndex = geometry.getIndex();
        const start = positions.length / 3;
        normalMatrix.getNormalMatrix(matrix);
        for (let i = 0; i < pos.count; i++) {
          p.fromBufferAttribute(pos, i).applyMatrix4(matrix);
          n.fromBufferAttribute(normal, i).applyNormalMatrix(normalMatrix);
          positions.push(p.x, p.y, p.z);
          normals.push(n.x, n.y, n.z);
          if (tintAttribute) {
            colors.push(color.r * tintAttribute.getX(i), color.g * tintAttribute.getY(i), color.b * tintAttribute.getZ(i));
          } else {
            colors.push(color.r, color.g, color.b);
          }
          if (uvRect) {
            const [u, v, w, h] = uvRect;
            uvs.push(u + (uv?.getX(i) ?? 0) * w, v + (uv?.getY(i) ?? 0) * h);
          }
          if (skin) {
            const blend = skin.weight?.(p.y) ?? 0;
            jointIndices.push(skin.primary, skin.secondary ?? 0, 0, 0);
            jointWeights.push(1 - blend, blend, 0, 0);
          }
        }
        const count = sourceIndex?.count ?? pos.count;
        for (let i = 0; i < count; i++) indices.push(start + (sourceIndex ? sourceIndex.getX(i) : i));
      }
      const geometry = new T.BufferGeometry();
      geometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
      geometry.setAttribute('normal', new T.Float32BufferAttribute(normals, 3));
      geometry.setAttribute('color', new T.Float32BufferAttribute(colors, 3));
      geometry.setIndex(indices);
      if (uvs) geometry.setAttribute('uv', new T.Float32BufferAttribute(uvs, 2));
      if (jointIndices.length) {
        geometry.setAttribute('skinIndex', new T.Uint16BufferAttribute(jointIndices, 4));
        geometry.setAttribute('skinWeight', new T.Float32BufferAttribute(jointWeights, 4));
      }
      return geometry;
    }

    function surface(vertices, indices) {
      const geometry = new T.BufferGeometry();
      geometry.setAttribute('position', new T.Float32BufferAttribute(vertices.flat(), 3));
      geometry.setIndex(indices);
      geometry.computeVertexNormals();
      return geometry;
    }
    function sheet(color, a, b, c, d) {
      return coloredPart(surface([a, b, c, d], [0, 1, 2, 0, 2, 3]), color);
    }
    function band(color, profile, start, end) {
      const vertices = [];
      const indices = [];
      for (let i = 0; i < profile.length; i++) {
        vertices.push(profile[i][start], profile[i][end]);
        if (!i) continue;
        const a = (i - 1) * 2;
        const b = i * 2;
        indices.push(a, a + 1, b + 1, a, b + 1, b);
      }
      return coloredPart(surface(vertices, indices), color);
    }
    function cap(color, ring, reverse) {
      const faces = [];
      for (let i = 1; i < ring.length - 1; i++) {
        faces.push(0, reverse ? i + 1 : i, reverse ? i : i + 1);
      }
      return coloredPart(surface(ring, faces), color);
    }
    function mesh(parent, geo, mat, x = 0, y = 0, z = 0, w = 1, h = 1, d = 1) {
      const result = new T.Mesh(geo, mat);
      result.position.set(x, y, z);
      result.scale.set(w, h, d);
      parent.add(result);
      return result;
    }
    function radialTexture() {
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 96;
      const ctx = canvas.getContext('2d');
      const gradient = ctx.createRadialGradient(48, 48, 7, 48, 48, 48);
      gradient.addColorStop(0, '#ffffff');
      gradient.addColorStop(.55, '#ffffffbe');
      gradient.addColorStop(1, '#ffffff00');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 96, 96);
      return new T.CanvasTexture(canvas);
    }
    const glow = radialTexture();
    function beamTexture() {
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 128;
      const ctx = canvas.getContext('2d');
      const image = ctx.createImageData(128, 128);
      for (let y = 0; y < 128; y++) {
        const distance = y / 127;
        const reach = Math.sin(distance * Math.PI) ** 1.08 * (1 - distance * .36);
        const spread = .034 + distance * .205;
        const coreSpread = .018 + distance * .085;
        for (let x = 0; x < 128; x++) {
          const axis = Math.abs(x / 127 - .5);
          const cone = Math.exp(-((axis - .162) ** 2) / (2 * spread * spread));
          const hot = Math.exp(-((axis - .162) ** 2) / (2 * coreSpread * coreSpread)) * .62 * (1 - distance * .55);
          const centerFill = Math.exp(-(axis * axis) / (2 * (.12 + distance * .18) ** 2)) * .22;
          const light = Math.min(1, (cone + hot + centerFill) * reach);
          const offset = (y * 128 + x) * 4;
          image.data[offset] = 255;
          image.data[offset + 1] = Math.round(244 + 11 * hot);
          image.data[offset + 2] = Math.round(218 + 37 * hot);
          image.data[offset + 3] = Math.round(light * 246);
        }
      }
      ctx.putImageData(image, 0, 0);
      return new T.CanvasTexture(canvas);
    }
    function flareTexture() {
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 96;
      const ctx = canvas.getContext('2d');
      const g = ctx.createRadialGradient(48, 48, 2, 48, 48, 48);
      g.addColorStop(0, '#ffffffff');
      g.addColorStop(.22, '#fff7e2d8');
      g.addColorStop(.52, '#ffdba055');
      g.addColorStop(1, '#ffffff00');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 96, 96);
      // Subtle horizontal anamorphic streak for cinematic night headlights
      const streak = ctx.createLinearGradient(0, 48, 96, 48);
      streak.addColorStop(0, '#ffffff00');
      streak.addColorStop(.32, '#ffffff42');
      streak.addColorStop(.5, '#ffffffb0');
      streak.addColorStop(.68, '#ffffff42');
      streak.addColorStop(1, '#ffffff00');
      ctx.fillStyle = streak;
      ctx.fillRect(0, 43, 96, 10);
      return new T.CanvasTexture(canvas);
    }
    const flareMap = flareTexture();
    const decal = new T.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
    const haloPlane = new T.PlaneGeometry(1, 1);
    const shadowMat = new T.MeshBasicMaterial({ color: '#101422', map: glow, transparent: true, depthWrite: false, opacity: .71, polygonOffset: true, polygonOffsetFactor: -2 });
    const pedestrianShadow = shadowMat.clone();
    pedestrianShadow.opacity = .43;
    const headWash = new T.MeshBasicMaterial({ color: '#ffefc4', map: beamTexture(), transparent: true, depthWrite: false, opacity: .26, blending: T.AdditiveBlending });
    const tailWash = new T.MeshBasicMaterial({ color: '#ff2c42', map: glow, transparent: true, depthWrite: false, opacity: .22, blending: T.AdditiveBlending });
    const headHaloMat = new T.MeshBasicMaterial({ color: '#fff3d4', map: flareMap, transparent: true, depthWrite: false, opacity: .45, blending: T.AdditiveBlending, side: T.DoubleSide });
    const tailHaloMat = new T.MeshBasicMaterial({ color: '#ff2c46', map: flareMap, transparent: true, depthWrite: false, opacity: .38, blending: T.AdditiveBlending, side: T.DoubleSide });
    const brakeHaloMat = new T.MeshBasicMaterial({ color: '#ff4233', map: flareMap, transparent: true, depthWrite: false, opacity: .72, blending: T.AdditiveBlending, side: T.DoubleSide });
    const policeRed = new T.MeshBasicMaterial({ color: '#ff2846', map: glow, transparent: true, depthWrite: false, opacity: .52, blending: T.AdditiveBlending });
    const policeBlue = new T.MeshBasicMaterial({ color: '#2b86ff', map: glow, transparent: true, depthWrite: false, opacity: .55, blending: T.AdditiveBlending });

    const lerp = (a, b, t) => a + (b - a) * t;
    const interpolate = (a, b, t) => a.map((v, i) => lerp(v, b[i], t));
    const wheelbase = 1.46;
    const radius = .365;
    const contactPatches = new T.BufferGeometry();
    const contactVertices = [], contactUVs = [], contactIndices = [];
    function contactPatch(x, y, z, halfWidth, halfLength) {
      const index = contactVertices.length / 3;
      contactVertices.push(x - halfWidth, y, z + halfLength, x + halfWidth, y, z + halfLength,
        x + halfWidth, y, z - halfLength, x - halfWidth, y, z - halfLength);
      contactUVs.push(0, 0, 1, 0, 1, 1, 0, 1);
      contactIndices.push(index, index + 1, index + 2, index, index + 2, index + 3);
    }
    contactPatch(0, .011, 0, 1.365, 2.53);
    for (const x of [-.944, .944]) {
      for (const z of [-wheelbase, wheelbase]) contactPatch(x, .014, z, .27, .31);
    }
    contactPatches.setAttribute('position', new T.Float32BufferAttribute(contactVertices, 3));
    contactPatches.setAttribute('uv', new T.Float32BufferAttribute(contactUVs, 2));
    contactPatches.setIndex(contactIndices);
    const bumper = '#222933';
    const rubber = '#191d23';
    const chrome = '#aeb6b1';
    const smokeGlass = '#354857';

    function panel(color, quad, left, right, lower, upper, offset, reverse = false) {
      const sample = (u, v) => interpolate(interpolate(quad[0], quad[1], u), interpolate(quad[3], quad[2], u), v).map((n, i) => n + offset[i]);
      const points = [sample(left, lower), sample(right, lower), sample(right, upper), sample(left, upper)];
      if (reverse) points.reverse();
      return sheet(color, ...points);
    }

    function sampleProfile(form, z) {
      const after = form.findIndex(row => row[0] >= z);
      const end = after < 0 ? form.length - 1 : Math.max(1, after);
      const a = form[end - 1];
      const b = form[end];
      return interpolate(a, b, D.clamp((z - a[0]) / (b[0] - a[0]), 0, 1));
    }
    function bodyRing(form, z) {
      const [, width, y, capWidth, belly] = sampleProfile(form, z);
      const skirt = Math.min(y - .136, belly);
      const side = Math.min(y - .101, skirt + .093);
      return [
        [-width + .075, skirt, z], [width - .075, skirt, z],
        [width, side, z], [width - .012, y - .085, z],
        [capWidth, y, z], [-capWidth, y, z],
        [-width + .012, y - .085, z], [-width, side, z],
      ];
    }
    function bodyShell(form, color) {
      const profile = form.map(row => bodyRing(form, row[0]));
      const bands = [tint(color, .45), tint(color, .65), color, tint(color, 1.16), tint(color, 1.16), tint(color, 1.16), color, tint(color, .65)];
      return [...bands.map((shade, i) => band(shade, profile, i, (i + 1) % bands.length)),
        cap(color, profile[0], true), cap(color, profile.at(-1), false)];
    }

    const heroForm = [
      [-2.274, .755, .683, .718, .343], [-2.231, .865, .784, .815, .299],
      [-2.139, .929, .893, .860, .281], [-1.910, .966, .968, .875, .276],
      [-1.530, 1.000, .984, .867, .273], [-1.175, .989, .984, .850, .269],
      [-.62, .971, .980, .853, .265], [.26, .976, .968, .849, .268],
      [.89, .995, .941, .859, .273], [1.49, 1.011, .909, .867, .278],
      [1.868, .990, .841, .855, .288], [2.111, .939, .767, .816, .292],
      [2.227, .855, .717, .778, .308], [2.274, .772, .653, .743, .342],
    ];
    const sedanForm = [
      [-2.29, .804, .657, .778, .342], [-2.22, .925, .798, .868, .300], [-2.07, .970, .892, .876, .283],
      [-1.67, .996, .935, .872, .278], [-1.05, .987, .944, .865, .269], [.10, .984, .955, .865, .266],
      [1.02, .992, .930, .868, .275], [1.68, 1.008, .882, .875, .281], [2.06, .950, .817, .836, .299],
      [2.22, .888, .759, .823, .313], [2.277, .797, .644, .769, .345],
    ];
    const fleetLooks = {
      hatch: {
        body: heroForm, roof: [-1.883, 1.02, -1.25, .29, 1.573, .961, .679],
        rear: [.666, .702, -2.287, .347, .087], front: [.658, .649, 2.273, .320, .071], grille: [.99, .595, .119], trim: '#172028',
      },
      coupe: {
        body: [
          [-2.30, .795, .640, .754, .297], [-2.24, .912, .788, .846, .257], [-2.09, .964, .880, .870, .246],
          [-1.67, 1.013, .953, .882, .242], [-.94, .988, .934, .856, .237], [.58, .981, .906, .843, .236],
          [1.38, 1.012, .869, .862, .241], [1.89, .985, .804, .845, .250], [2.12, .930, .728, .819, .263],
          [2.25, .856, .652, .791, .275], [2.28, .797, .574, .754, .301],
        ],
        roof: [-1.905, 1.196, -.90, .107, 1.408, .940, .626],
        rear: [.646, .733, -2.273, .383, .062], front: [.675, .613, 2.258, .332, .055], grille: [1.12, .474, .157], trim: '#1d2228',
      },
      sedan: {
        body: sedanForm, roof: [-1.481, 1.03, -.89, .26, 1.555, .942, .699],
        rear: [.713, .711, -2.297, .292, .095], front: [.677, .685, 2.267, .340, .098], grille: [.752, .641, .155], trim: '#20282c',
      },
      van: {
        body: [
          [-2.29, .900, 1.053, .881, .389], [-2.23, 1.013, 1.140, .958, .326], [-2.02, 1.041, 1.170, .963, .299],
          [-1.34, 1.053, 1.169, .959, .294], [-.58, 1.037, 1.158, .958, .290], [.64, 1.027, 1.137, .947, .287],
          [1.39, 1.023, 1.074, .931, .289], [1.91, .995, .976, .916, .304], [2.16, .947, .890, .886, .315],
          [2.25, .884, .844, .857, .339], [2.29, .809, .765, .793, .370],
        ],
        roof: [-2.23, 1.405, -1.964, .39, 2.034, 1.133, .799],
        rear: [.857, .807, -2.304, .112, .287], front: [.700, .804, 2.255, .302, .110], grille: [.921, .708, .167], trim: '#202725',
      },
      patrol: {
        body: sedanForm, roof: [-1.481, 1.03, -.89, .26, 1.555, .942, .699],
        rear: [.713, .711, -2.297, .292, .095], front: [.677, .685, 2.267, .340, .098], grille: [.752, .641, .155], trim: '#181f28',
      },
    };
    function fenderCut(z, height, belly) {
      const t = (Math.abs(z) - wheelbase) / .447;
      const arch = .491 * Math.sqrt(Math.max(0, 1 - t * t));
      return Math.min(height - .156, belly + arch);
    }
    function roundedBody(color, form = heroForm, arcSegments = 16) {
      const stations = form.map(row => row[0]);
      for (const axle of [-wheelbase, wheelbase]) {
        for (let step = 0; step <= arcSegments; step++) stations.push(axle + .447 * Math.cos(step * Math.PI / arcSegments));
      }
      const rings = [...new Set(stations)].sort((a, b) => a - b).map(z => {
        const [, width, height, shoulder, belly] = sampleProfile(form, z);
        const floor = fenderCut(z, height, belly);
        const side = [
          [width - .072, floor, z],
          [width - .038, floor + .016, z],
          [width - .013, Math.max(floor + .025, height - .344), z],
          [width, Math.max(floor + .041, height - .212), z],
          [width - .012, height - .091, z],
          [width - .038, height - .036, z],
          [shoulder, height - .005, z],
          [shoulder * .53, height + .014, z],
        ];
        const other = side.map(([x, y, depth]) => [-x, y, depth]).reverse();
        return [other.pop(), ...side, [0, height + .022, z], ...other];
      });
      const columns = rings[0].length;
      const indices = [];
      for (let row = 1; row < rings.length; row++) {
        for (let col = 0; col < columns; col++) {
          const a = (row - 1) * columns + col;
          const b = row * columns + col;
          const next = (col + 1) % columns;
          indices.push(a, (row - 1) * columns + next, row * columns + next, a, row * columns + next, b);
        }
      }
      const geometry = surface(rings.flat(), indices);
      const shades = [.27, .27, .48, .75, .92, 1, 1.04, 1.055, 1.07, 1.08, 1.07, 1.055, 1.04, 1, .92, .75, .48];
      const vertexColors = new Float32Array(rings.length * columns * 3);
      for (let index = 0; index < rings.length * columns; index++) {
        vertexColors.fill(shades[index % columns], index * 3, index * 3 + 3);
      }
      geometry.setAttribute('color', new T.BufferAttribute(vertexColors, 3));
      return [coloredPart(geometry, color), cap(tint(color, .73), rings[0], true), cap(tint(color, .90), rings.at(-1), false)];
    }

    function curvedSurface(color, quad, limits, bulge, offset, reverse = false, columns = 7, rows = 5, shade = null) {
      const [u0, u1, v0, v1] = limits;
      const vertices = [];
      const indices = [];
      const tones = [];
      for (let row = 0; row < rows; row++) {
        for (let column = 0; column < columns; column++) {
          const u = lerp(u0, u1, column / (columns - 1));
          const v = lerp(v0, v1, row / (rows - 1));
          const crown = Math.sin(Math.PI * u) * Math.sin(Math.PI * v);
          const point = interpolate(interpolate(quad[0], quad[1], u), interpolate(quad[3], quad[2], u), v);
          vertices.push(point.map((n, axis) => n + crown * bulge[axis] + offset[axis]));
          if (shade) {
            const tone = shade(u, v);
            tones.push(tone, tone, tone);
          }
          if (!column || !row) continue;
          const d = row * columns + column;
          const a = d - columns - 1;
          const b = d - columns;
          const c = d - 1;
          indices.push(...(reverse ? [a, d, b, a, c, d] : [a, b, d, a, d, c]));
        }
      }
      const geometry = surface(vertices, indices);
      if (shade) geometry.setAttribute('color', new T.Float32BufferAttribute(tones, 3));
      return coloredPart(geometry, color);
    }
    // Each station describes the outside skin. Width and roof crown are independent
    // so the rear wheelhouses can stand above the base of the glazing.
    const gtBodyStations = [
      [-2.035, .936, 1.051, .842, .298], [-1.90, .995, 1.079, .858, .282],
      [-1.64, 1.043, 1.111, .879, .273], [-1.43, 1.048, 1.118, .869, .269],
      [-1.17, 1.022, 1.091, .866, .265], [-.86, .987, 1.033, .869, .260],
      [-.39, .955, .991, .863, .255], [.08, .954, .973, .859, .252],
      [.57, .977, .962, .860, .257], [.94, .993, .957, .866, .266],
      [1.31, 1.016, .949, .879, .274], [1.55, 1.014, .926, .869, .278],
      [1.87, .989, .844, .849, .287], [2.11, .939, .768, .816, .292],
      [2.227, .855, .717, .778, .308], [2.274, .772, .653, .743, .342],
    ];
    const gtRoofStations = [
      // aperture length, belt z/y/half-width, roof edge z/y/half-width
      [0, -2.032, 1.034, .826, -1.267, 1.445, .602],
      [.13, -1.637, 1.057, .852, -1.067, 1.515, .642],
      [.30, -1.119, 1.032, .867, -.751, 1.559, .673],
      [.55, -.351, .985, .867, -.337, 1.578, .691],
      [.75, .263, .968, .864, -.033, 1.569, .691],
      [1, 1.035, .951, .857, .337, 1.491, .640],
    ];
    function gtSection(stations, location) {
      const index = stations.findIndex(row => row[0] >= location);
      const end = index < 0 ? stations.length - 1 : Math.max(1, index);
      const a = stations[end - 1], b = stations[end];
      const prev = stations[Math.max(0, end - 2)], next = stations[Math.min(stations.length - 1, end + 1)];
      const length = b[0] - a[0], t = D.clamp((location - a[0]) / length, 0, 1);
      // Slope limiting keeps wheel shoulders and the roof tangent through their maxima.
      const tangent = (s, v) => s * v > 0 ? 2 * s * v / (s + v) : 0;
      return a.map((v, i) => {
        const delta = (b[i] - v) / length;
        const m = prev === a ? delta : tangent((v - prev[i]) / (a[0] - prev[0]), delta);
        const n = next === b ? delta : tangent(delta, (next[i] - b[i]) / (next[0] - b[0]));
        return lerp(v, b[i], t * t * (3 - 2 * t)) + length * t * (1 - t) * ((1 - t) * m - t * n);
      });
    }
    function gtGrid(color, cols, rows, point, reverse = false, tone, include) {
      const vertices = [], indices = [], shades = [];
      for (let j = 0; j <= rows; j++) {
        for (let i = 0; i <= cols; i++) {
          const u = i / cols, v = j / rows;
          vertices.push(point(u, v));
          if (tone) {
            const light = tone(u, v);
            shades.push(light, light, light);
          }
          if (!i || !j) continue;
          if (include && !include(i - 1, j - 1)) continue;
          const d = j * (cols + 1) + i, a = d - cols - 2;
          if (reverse) indices.push(a, d, a + 1, a, d - 1, d);
          else indices.push(a, a + 1, d, a, d, d - 1);
        }
      }
      const geometry = surface(vertices, indices);
      if (tone) geometry.setAttribute('color', new T.Float32BufferAttribute(shades, 3));
      return coloredPart(geometry, color);
    }
    function gtFlank(z) {
      const [, width, high, shoulder, belly] = gtSection(gtBodyStations, z);
      const archDist = (Math.abs(z) - wheelbase) / .455;
      const arch = Math.sqrt(Math.max(0, 1 - archDist * archDist));
      const wheel = Math.exp(-Math.pow((Math.abs(z) - wheelbase) / .61, 4));
      const rear = Math.exp(-Math.pow((z + 1.48) / .68, 2));
      const floor = belly + .498 * arch;
      const panelRise = high - floor - .062;
      return [
        [width - .158, floor - .013, z], [width - .067 + .024 * arch, floor, z],
        [width - .046 + .046 * wheel, floor + .025, z], [width - .060 + .061 * wheel, floor + .062, z],
        [width - .075 + .045 * arch, floor + .062 + panelRise * .218, z],
        [width - .033, floor + .062 + panelRise * .50, z], [width, floor + .062 + panelRise * .735, z],
        [width - .008, floor + .062 + panelRise * .855, z], [width - .041, floor + .062 + panelRise * .95, z],
        [shoulder, high - .004, z], [width * .64, high + .004 - .048 * rear, z],
        [width * .35, high + .015 - .071 * rear, z], [0, high + .020 - .078 * rear, z],
      ];
    }
    const gtNoseJoin = 1.986;
    function gtLowerBody(color) {
      const stations = [gtBodyStations[0][0], -1.69, .844, gtNoseJoin];
      for (const axle of [-wheelbase, wheelbase]) {
        for (let i = 0; i <= 15; i++) stations.push(axle + .455 * Math.cos(Math.PI * i / 15));
      }
      for (const [z] of gtBodyStations) {
        if (z < gtNoseJoin && stations.every(sample => Math.abs(sample - z) > .027)) stations.push(z);
      }
      for (let z = -1.94; z < gtNoseJoin; z += .18) {
        if (stations.every(sample => Math.abs(sample - z) > .065)) stations.push(z);
      }
      const profile = stations.sort((a, b) => a - b).map(z => {
        const side = gtFlank(z);
        return [...side, ...side.slice(0, -1).reverse().map(([x, y]) => [-x, y, z])];
      });
      const bands = profile[0].length;
      return [
        gtGrid(color, bands - 1, profile.length - 1, (u, v) =>
          profile[Math.round(v * (profile.length - 1))][Math.round(u * (bands - 1))], false, u => {
          const index = Math.round(Math.min(u, 1 - u) * (bands - 1));
          return [.39, .67, .89, .87, .78, .91, 1.02, 1.06, 1.06, 1.04, 1.03, 1.03, 1.03][index];
        }, (col, row) => col < 9 || col >= bands - 10 || profile[row][0][2] < -1.69 || profile[row + 1][0][2] > .844),
      ];
    }
    // A transverse stamping. The lamp sockets, hatch opening and apron all use
    // this exact compound-curved skin, including the wrap around each quarter.
    const gtTailRows = [
      // centre height/depth, outer width/height, centre recess
      [1.035, -2.035, .842, 1.047, 0], [1.050, -2.133, .864, 1.042, 0],
      [1.021, -2.220, .892, 1.021, 0], [.986, -2.248, .908, .989, 0],
      [.947, -2.243, .921, .953, 0], [.868, -2.214, .932, .889, 0],
      [.803, -2.206, .936, .842, 0], [.752, -2.213, .931, .779, .012],
      [.711, -2.193, .924, .726, .052], [.610, -2.194, .916, .626, .057],
      [.568, -2.208, .909, .583, .026], [.543, -2.239, .901, .550, 0],
      [.515, -2.276, .894, .526, 0], [.461, -2.296, .887, .472, 0],
      [.406, -2.280, .875, .425, 0], [.357, -2.247, .878, .382, 0],
      [.318, -2.178, .864, .337, 0], [.285, -2.035, .778, .285, 0],
    ];
    const gtNoseRows = [
      [.824, 1.986, .83, .806, 0], [.804, 2.078, .85, .800, 0],
      [.786, 2.169, .88, .795, 0], [.770, 2.222, .91, .783, 0],
      [.744, 2.248, .93, .759, 0], [.692, 2.267, .94, .726, 0],
      [.638, 2.257, .94, .675, 0], [.605, 2.237, .94, .632, -.006],
      [.560, 2.219, .93, .581, -.011], [.510, 2.248, .92, .532, -.007],
      [.467, 2.269, .91, .494, 0], [.413, 2.261, .91, .443, 0],
      [.358, 2.233, .89, .381, 0], [.313, 2.160, .87, .334, 0],
      [.279, 1.986, .82, .278, 0],
    ];
    const gtTailEnd = gtFlank(gtBodyStations[0][0]), gtNoseEnd = gtFlank(gtNoseJoin);
    function gtEndWidth(section, height) {
      const side = section.slice(0, 10);
      let end = side.findIndex(row => row[1] >= height);
      end = end < 0 ? side.length - 1 : Math.max(1, end);
      const a = side[end - 1], b = side[end];
      return lerp(a[0], b[0], D.clamp((height - a[1]) / (b[1] - a[1]), 0, 1));
    }
    function gtEndRows(rows, section) {
      return rows.map(([y, z, , edge, well], i) => {
        const edgeY = i === 0 ? section[9][1] : i === rows.length - 1 ? section[0][1] : edge;
        return [y, z, gtEndWidth(section, edgeY), edgeY, well];
      });
    }
    const gtTailStamp = gtEndRows(gtTailRows, gtTailEnd), gtNoseStamp = gtEndRows(gtNoseRows, gtNoseEnd);
    function gtStamp(rows, end, x, row, lift) {
      const index = Math.min(Math.floor(row), rows.length - 2);
      const [y, z, width, edgeY, well] = interpolate(rows[index], rows[index + 1], row - index);
      const a = Math.min(1, Math.abs(x) / width);
      const recess = 1 - T.MathUtils.smoothstep(Math.abs(x), .254, .476);
      let height = lerp(y, edgeY, a * a);
      if (row < 1) {
        const top = end.slice(9).reverse();
        let right = top.findIndex(point => point[0] >= Math.abs(x));
        right = right < 0 ? top.length - 1 : Math.max(1, right);
        const p = top[right - 1], q = top[right];
        const startHeight = lerp(p[1], q[1], D.clamp((Math.abs(x) - p[0]) / (q[0] - p[0]), 0, 1));
        height += (1 - row) * (startHeight - lerp(rows[0][0], rows[0][3], a * a));
      }
      return [x, height, end[0][2] + (z - end[0][2]) * Math.sqrt(Math.max(0, 1 - a * a * a)) + well * recess + lift];
    }
    function gtStampWidth(rows, row) {
      const index = Math.min(Math.floor(row), rows.length - 2);
      return lerp(rows[index][2], rows[index + 1][2], row - index);
    }
    const gtTail = (x, row, lift = 0) => gtStamp(gtTailStamp, gtTailEnd, x, row, -lift);
    const gtNose = (x, row, lift = 0) => gtStamp(gtNoseStamp, gtNoseEnd, x, row, lift);
    function gtSide(side, u, v) {
      const [, z0, h0, w0, z1, h1, w1] = gtSection(gtRoofStations, u);
      const bow = Math.sin(Math.PI * v);
      return [side * (lerp(w0, w1, v) + .036 * bow), lerp(h0, h1, v) + .013 * bow, lerp(z0, z1, v)];
    }
    function gtScreen(rear, s, v) {
      const [x, y, z] = gtSide(1, rear ? 0 : 1, v);
      const crown = 1 - s * s;
      const depth = (rear ? -.092 : .084) * (1 + .33 * Math.sin(Math.PI * v));
      return [s * x, y + crown * lerp(.020, .051, v), z + depth * crown];
    }
    function gtRoof(u, s) {
      const [x, y, z] = gtSide(1, u, 1);
      const crown = 1 - s * s;
      return [s * x, y + .051 * crown, z + crown * lerp(-.092, .084, u)];
    }
    function gtCabin(paint, windows, trim, color, far = false) {
      const density = far ? 3 : 12, half = far ? 1 : 5;
      paint.push(gtGrid(color, density, half + 1, (u, v) => gtRoof(u, 2 * v - 1)));
      const glassTone = (u, v) => .72 + .38 * T.MathUtils.smoothstep(v, .04, .93) + .07 * Math.sin(Math.PI * u);
      for (const rear of [true, false]) {
        const pane = (s, v) => gtScreen(rear, s, v);
        const frame = (s, v) => {
          const width = .89 - .047 * Math.pow(Math.abs(v * 2 - 1), 4);
          const h = .106 + .778 * v;
          return pane(s * width, h);
        };
        const widthAt = v => .89 - .047 * Math.pow(Math.abs(v * 2 - 1), 4);
        const surfaceBand = (material, cols, rows, point, tint) => gtGrid(material, cols, rows, point, rear, tint);
        for (const side of [-1, 1]) {
          paint.push(surfaceBand(color, far ? 1 : 3, half, (u, v) =>
            pane(side * (side === 1 ? lerp(widthAt(v), 1, u) : lerp(1, widthAt(v), u)), .106 + .778 * v)));
        }
        paint.push(surfaceBand(color, density, 2, (u, v) => pane(2 * u - 1, v * .106)),
          surfaceBand(color, density, 2, (u, v) => pane(2 * u - 1, lerp(.884, 1, v))));
        const span = far ? 0 : .018;
        if (!far) {
          for (const side of [-1, 1]) {
            trim.push(surfaceBand('#273237', 1, half, (u, v) =>
              frame(side === 1 ? lerp(1 - span, 1, u) : lerp(-1, -1 + span, u), v)));
          }
          trim.push(surfaceBand('#293236', density, 1, (u, v) => frame((2 * u - 1) * (1 - span), .024 * v)),
            surfaceBand('#293236', density, 1, (u, v) => frame((2 * u - 1) * (1 - span), .98 + .02 * v)));
        }
        windows.push(surfaceBand(rear ? '#405563' : '#506778', density, half, (u, v) =>
          frame((2 * u - 1) * (1 - span), far ? v : lerp(.024, .98, v)), glassTone));
      }
      for (const side of [-1, 1]) {
        const panel = (shade, cols, rows, sample, tone) => gtGrid(shade, cols, rows, sample, side > 0, tone);
        const aft = v => .115 + .10 * Math.pow(Math.abs((v - .60) / .60), 2.1);
        const fore = v => .951 - .017 * Math.pow(Math.abs(v * 2 - 1), 2);
        const bottom = u => .112 + .264 * (1 - T.MathUtils.smoothstep(u, .106, .405));
        const top = u => .907 - .065 * (1 - T.MathUtils.smoothstep(u, .11, .31)) - .026 * T.MathUtils.smoothstep(u, .85, 1);
        const aperture = (u, v) => gtSide(side, u, lerp(bottom(u), top(u), v));
        const point = (u, v) => aperture(lerp(aft(v), fore(v), u), v);
        paint.push(panel(color, density, 2, (u, v) => gtSide(side, u, v * bottom(u))),
          panel(color, density, 2, (u, v) => gtSide(side, u, lerp(top(u), 1, v))),
          panel(color, half, half, (u, v) => aperture(u * aft(v), v)),
          panel(color, 2, half, (u, v) => aperture(lerp(fore(v), 1, u), v)));
        if (far) {
          windows.push(panel('#3b515e', density, half, point, glassTone));
          continue;
        }
        for (const [a, b, low, high] of [[0, .014, 0, 1], [.986, 1, 0, 1], [.014, .986, 0, .028], [.014, .986, .978, 1]]) {
          trim.push(panel('#1d282d', b - a > .5 ? density : 1, high - low > .5 ? half : 1,
            (u, v) => point(lerp(a, b, u), lerp(low, high, v))));
        }
        for (const [a, b, shade] of [[.014, .239, '#354c57'], [.252, .438, '#3c525f'], [.476, .986, '#445b69']]) {
          windows.push(panel(shade, b - a > .4 ? 8 : 4, half - 1,
            (u, v) => point(lerp(a, b, u), lerp(.028, .978, v)), glassTone));
        }
        for (const [a, b] of [[.239, .252], [.438, .476]]) {
          trim.push(panel('#212a2f', 1, half - 1, (u, v) => point(lerp(a, b, u), lerp(.028, .978, v))));
        }
      }
    }
    function cabin(paint, windows, roof, color, van) {
      const [rear, front, rearRoof, frontRoof, roofHeight, sill, roofWidth] = roof;
      const foot = [side => [side * (van ? .925 : .846), sill, rear],
        side => [side * (van ? .925 : .846), van ? 1.095 : .936, front]];
      const top = [side => [side * roofWidth, roofHeight - .025, rearRoof], side => [side * (roofWidth - .02), roofHeight, frontRoof]];
      const rearFrame = [foot[0](-1), foot[0](1), top[0](1), top[0](-1)];
      const frontFrame = [foot[1](-1), foot[1](1), top[1](1), top[1](-1)];
      paint.push(panel(color, rearFrame, 0, 1, 0, 1, [0, 0, 0], true));
      paint.push(panel(color, frontFrame, 0, 1, 0, 1, [0, 0, 0]));
      windows.push(panel(smokeGlass, rearFrame, .075, .925, .12, .875, [0, 0, -.014], true));
      windows.push(panel(smokeGlass, frontFrame, .066, .934, .09, .90, [0, 0, .014]));
      const spineRear = [0, roofHeight + .018, rearRoof];
      const spineFront = [0, roofHeight + .035, frontRoof];
      paint.push(sheet(tint(color, 1.20), top[0](-1), top[1](-1), spineFront, spineRear));
      paint.push(sheet(tint(color, 1.12), spineRear, spineFront, top[1](1), top[0](1)));
      for (const side of [-1, 1]) {
        const sideFrame = [foot[0](side), foot[1](side), top[1](side), top[0](side)];
        const reverse = side === 1;
        const outside = [side * .013, 0, 0];
        paint.push(panel(tint(color, .83), sideFrame, 0, 1, 0, 1, [0, 0, 0], reverse));
        if (!van) windows.push(panel('#303a48', sideFrame, .07, .34, .10, .883, outside, reverse));
        windows.push(panel(smokeGlass, sideFrame, van ? .57 : .375, .934, .10, .883, outside, reverse));
      }
    }

    function fleetCabin(paint, windows, trim, look, color) {
      const { roof, body } = look;
      const [rear, front, rearRoof, frontRoof, roofHeight, rearSill, roofWidth] = roof;
      const frontSill = sampleProfile(body, front)[2] + .016;
      const foot = (side, aft) => [side * (look === fleetLooks.van ? .925 : .846), aft ? rearSill : frontSill, aft ? rear : front];
      const top = (side, aft) => [side * (roofWidth - (aft ? 0 : .021)), roofHeight - (aft ? .012 : 0), aft ? rearRoof : frontRoof];
      const full = [0, 1, 0, 1];
      const curve = (shade, quad, bounds, bow, offset, reverse) => curvedSurface(shade, quad, bounds, bow, offset, reverse, 5, 3);
      const van = look === fleetLooks.van;
      paint.push(curve(tint(color, 1.06), [top(-1, true), top(-1, false), top(1, false), top(1, true)], full, [0, .049, 0], [0, 0, 0]));
      for (const aft of [false, true]) {
        const direction = aft ? -1 : 1;
        const frame = [foot(-1, aft), foot(1, aft), top(1, aft), top(-1, aft)];
        const bow = [0, .018, direction * (van ? .034 : .092)];
        paint.push(curve(color, frame, full, bow, [0, 0, 0], aft));
        if (aft && van) {
          trim.push(curve(tint(color, .39), frame, [.494, .506, .012, .958], bow, [0, 0, -.012], true));
          for (const [left, right] of [[.09, .462], [.538, .91]]) {
            trim.push(curve('#22292c', frame, [left - .018, right + .018, .269, .848], bow, [0, 0, -.014], true));
            windows.push(curve('#4c5b61', frame, [left, right, .306, .812], bow, [0, 0, -.031], true));
          }
        } else {
          trim.push(curve('#20272a', frame, [.065, .935, .09, .92], bow, [0, 0, direction * .013], aft));
          windows.push(curve(aft ? '#415261' : '#506471', frame, [.079, .921, .117, .886], bow, [0, 0, direction * .022], aft));
        }
      }
      for (const side of [-1, 1]) {
        const flank = [foot(side, true), foot(side, false), top(side, false), top(side, true)];
        const bow = [side * .047, .012, 0];
        const reverse = side > 0;
        paint.push(curve(tint(color, .91), flank, full, bow, [0, 0, 0], reverse));
        const divider = look === fleetLooks.coupe ? .421 : van ? .603 : .489;
        const panes = van ? [[divider, .928]] : [[.098, divider - .027], [divider, .93]];
        if (van) {
          trim.push(curve(tint(color, .68), flank, [.077, .538, .183, .852], bow, [side * .012, 0, 0], reverse));
          paint.push(curve(tint(color, .95), flank, [.089, .522, .215, .817], bow, [side * .025, 0, 0], reverse));
          trim.push(curve(tint(color, .45), flank, [.553, .562, .039, .961], bow, [side * .014, 0, 0], reverse));
        }
        for (const [start, end] of panes) {
          trim.push(curve('#242a2d', flank, [start - .010, end + .009, .092, .923], bow, [side * .015, 0, 0], reverse));
          windows.push(curve('#435462', flank, [start, end, .128, .884], bow, [side * .029, 0, 0], reverse));
        }
      }
    }

    const bezels = new T.Shape();
    bezels.moveTo(-.418, -.418);
    bezels.lineTo(.418, -.418);
    bezels.lineTo(.418, .418);
    bezels.lineTo(-.418, .418);
    bezels.closePath();
    const roundedBlock = new T.ExtrudeGeometry(bezels, {
      depth: .836, bevelThickness: .082, bevelSize: .082, bevelSegments: 1, steps: 1,
    }).center();
    const lensBezel = new T.CylinderGeometry(.5, .49, 1, 12).rotateX(Math.PI / 2);

    function gtLamp(side, color, start, end, lower, upper, lift) {
      return gtGrid(color, Math.max(2, Math.ceil((end - start) * 11)), 2, (u, v) => {
        const along = lerp(start, end, u);
        const x = side * lerp(.344, .903, along);
        const top = 4.11 + .61 * Math.pow(1 - along, 2) - .59 * along * along;
        const height = 1.51 * (.54 + .48 * Math.sin(Math.PI * along));
        return gtTail(x, top + height * lerp(lower, upper, v), lift);
      }, side < 0);
    }
    function gtHeadPoint(side, along, level, lift) {
      const x = side * lerp(.363, .893, along);
      const top = 3.76 + .57 * Math.pow(1 - along, 2) - .76 * along;
      return gtNose(x, top + (1.52 + .77 * Math.sin(Math.PI * along)) * level, lift);
    }
    function gtHeadBand(side, shade, a, b, low, high, lift) {
      return gtGrid(shade, Math.max(3, Math.ceil((b - a) * 10)), 2,
        (u, v) => gtHeadPoint(side, lerp(a, b, u), lerp(low, high, v), lift), side > 0);
    }
    function gtProjector(side, shade, center, width, height, lift) {
      return gtGrid(shade, 14, 1, (u, v) => {
        const angle = 2 * Math.PI * u;
        return gtHeadPoint(side, center + width * Math.cos(angle) * v, .59 + height * Math.sin(angle) * v, lift);
      }, side < 0);
    }
    function gtSeam(color, points, thick = .005) {
      const path = new T.CatmullRomCurve3(points.map(point => new T.Vector3(...point)));
      return coloredPart(new T.TubeGeometry(path, Math.ceil(points.length * 1.6), thick, 4, false), color);
    }
    function gtDoor(side, z, height, offset = 0) {
      const flank = gtFlank(z).slice(1, 10);
      let end = flank.findIndex(point => point[1] >= height);
      end = end < 0 ? flank.length - 1 : Math.max(1, end);
      const a = flank[end - 1], b = flank[end];
      const x = lerp(a[0], b[0], D.clamp((height - a[1]) / (b[1] - a[1]), 0, 1));
      return [side * (x + offset), height, z];
    }
    function gtInterior(trim) {
      const cork = '#53514b', seat = '#414749', textile = '#363e41';
      const bolster = (shade, x, z, rows) => gtGrid(shade, 12, rows.length - 1, (u, v) => {
        const [y, width, depth, offset] = rows[Math.round(v * (rows.length - 1))];
        const angle = u * 2 * Math.PI, c = Math.cos(angle), s = Math.sin(angle);
        const rounded = n => Math.sign(n) * Math.pow(Math.abs(n), .67);
        return [x + width * rounded(c), y, z + offset + depth * rounded(s)];
      }, true);
      for (const rear of [true, false]) {
        for (const side of [-1, 1]) {
          const x = side * (rear ? .383 : .397), z = rear ? -1.015 : -.051;
          const y = rear ? -.066 : 0;
          trim.push(bolster(rear ? textile : seat, x, z, [
            [.756 + y, .172, .059, 0], [.822 + y, .215, .082, -.007], [1.058 + y, .219, .094, -.061],
            [1.174 + y, .196, .087, -.102], [1.226 + y, .142, .065, -.111], [1.241 + y, .013, .013, -.111],
          ]));
          trim.push(bolster(rear ? '#424849' : '#4c5050', x, z, [
            [1.220 + y, .090, .049, -.113], [1.246 + y, .120, .065, -.124],
            [1.348 + y, .113, .061, -.139], [1.379 + y, .085, .049, -.139], [1.388 + y, .010, .010, -.139],
          ]));
          if (!rear) {
            for (const edge of [-1, 1]) {
              trim.push(gtSeam('#686960', [[x + edge * .154, .914, z - .129],
                [x + edge * .178, 1.052, z - .150], [x + edge * .152, 1.167, z - .182]], .003));
            }
          }
        }
      }
      const dash = [[.332, .972, .661], [.366, 1.020, .723], [.466, 1.055, .794],
        [.697, 1.057, .817], [.925, 1.000, .826], [.977, .982, .790]];
      trim.push(gtGrid('#353e42', dash.length - 1, 12, (u, v) => {
        const [z, h, width] = dash[Math.round(u * (dash.length - 1))], s = 2 * v - 1;
        return [s * width, h + .025 * (1 - s * s), z + .049 * s * s];
      }), gtGrid('#414748', 5, 6, (u, v) => {
        const s = v * 2 - 1;
        return [s * .835, 1.032 + .020 * s * s, lerp(-1.929, -1.047, u) + .064 * s * s];
      }), block('#333b40', 0, .813, -.49, .187, .199, 1.382),
        gtGrid('#3a4040', 6, 4, (u, v) => {
          const p = gtRoof(u, v * 2 - 1);
          p[1] -= .019;
          return p;
        }, true));
      for (const side of [-1, 1]) {
        trim.push(gtGrid('#394043', 12, 2, (u, v) => {
          const p = gtSide(side, lerp(.039, .959, u), 0);
          return [p[0] - side * lerp(.011, .100, v), p[1] - lerp(.002, .061, v), p[2]];
        }, side > 0));
        for (const [start, end] of [[0, .113], [.957, 1]]) {
          trim.push(gtGrid('#404546', 3, 4, (u, v) => {
            const p = gtSide(side, lerp(start, end, u), v);
            p[0] -= side * .017;
            return p;
          }, side < 0));
        }
      }
      const wheelX = .391, wheelY = 1.079, wheelZ = .297;
      const rim = new T.TorusGeometry(.143, .014, 6, 22);
      trim.push(coloredPart(rim, '#343c40', wheelX, wheelY, wheelZ, 1, 1, 1, 0, 0, .285),
        coloredPart(roundedBlock, '#465052', wheelX, wheelY, wheelZ, .103, .069, .035),
        coloredPart(roundedBlock, cork, wheelX, 1.080, .479, .297, .090, .170));
      for (const [x, y] of [[-.128, .042], [.128, .042], [0, -.125]]) {
        trim.push(gtSeam('#636a67', [[wheelX, wheelY, wheelZ], [wheelX + .76 * x, wheelY + .76 * y, wheelZ + .01],
          [wheelX + x, wheelY + y, wheelZ + .29 * y]], .010));
      }
    }
    function finishedHatch(paint, windows, trim, color) {
      gtCabin(paint, windows, trim, color);
      gtInterior(trim);
      const bevel = (shade, ...dims) => coloredPart(roundedBlock, shade, ...dims);
      const skin = (isNose, col, shade, a, b, r, s, lift = 0, rows = 3) => gtGrid(shade, col, rows, (u, v) => {
        const row = lerp(r, s, v), station = isNose ? gtNoseStamp : gtTailStamp;
        const across = .5 + .5 * Math.sin((u - .5) * Math.PI);
        return (isNose ? gtNose : gtTail)(lerp(a, b, across) * gtStampWidth(station, row), row, lift);
      }, isNose);
      const tailSkin = (...args) => skin(false, ...args);
      const noseSkin = (...args) => skin(true, ...args);
      paint.push(tailSkin(18, color, -1, 1, 0, 17, 0, 17), noseSkin(18, color, -1, 1, 0, 14, 0, 14),
        gtGrid('#252c30', 4, 1, (u, v) => [lerp(-.783, .783, v), .713, lerp(-2.015, 1.834, u)]));
      trim.push(tailSkin(18, '#30383b', -.935, .935, 14.13, 17, .008, 5),
        block(rubber, 0, .301, -.015, 1.45, .105, 4.10),
        bevel('#222a30', 0, .659, -2.154, .433, .143, .029),
        bevel('#263036', 0, .459, 2.271, .359, .105, .021),
        noseSkin(16, '#293237', -.93, .93, 12.21, 14, .006, 3));
      const intake = (start, end, level0, level1, shade, lift) => gtGrid(shade, 16, 3, (u, v) => {
        const height = lerp(level0, level1, v), across = lerp(start, end, u);
        return gtNose(across * lerp(.621, .519, height), 6.82 + 2.91 * height + .21 * across * across, lift);
      }, true);
      trim.push(intake(-1, 1, 0, 1, '#202a30', .008));
      for (const level of [.20, .43, .65, .85]) {
        trim.push(intake(-.962, .962, level, level + .039, '#465052', .014));
      }
      for (const side of [-1, 1]) {
        for (const axle of [-wheelbase, wheelbase]) {
          // The folded metal lip turns into the wheel opening rather than crossing the tire.
          trim.push(gtGrid('#283034', 19, 1, (u, v) => {
            const z = axle + .455 * Math.cos(Math.PI * u);
            const [inside, edge] = gtFlank(z);
            return [side * lerp(inside[0], edge[0], v), lerp(inside[1], edge[1], v) - .003, z];
          }, side < 0));
          trim.push(gtGrid('#22282c', 17, 1, (u, v) => {
            const z = axle + .455 * Math.cos(Math.PI * u), cover = gtFlank(z)[0];
            return [side * lerp(cover[0], .62, v), cover[1] + .008 * v, z];
          }, side > 0), gtGrid('#242b30', 17, 1, (u, v) => {
            const z = axle + .455 * Math.cos(Math.PI * u), h = gtFlank(z)[0][1];
            return [side * .624, lerp(.237, h + .007, v), z];
          }, side < 0));
        }
        const hatchGap = [[.757, 1.0], [.788, 2.7], [.801, 3.8], [.798, 5.9], [.765, 7.2],
          [.697, 9.7], [.637, 10.84], [.509, 11.06], [.281, 11.12], [0, 11.12]];
        trim.push(gtSeam(tint(color, .32), hatchGap.map(([x, row]) => gtTail(x * side, row, .004)), .006));
        trim.push(gtLamp(side, '#292d32', 0, 1, -.10, 1.1, .009),
          gtLamp(side, '#571f29', .017, .976, .05, .92, .012),
          gtLamp(side, '#a69b83', .824, .923, .66, .86, .018));
        // The shut line follows the door stamping over the sill and up into the pillar.
        const doorCut = [[.817, .945], [.852, .839], [.865, .635], [.819, .476], [.72, .419],
          [.46, .408], [-.34, .413], [-.59, .44], [-.742, .516], [-.823, .686], [-.868, .898], [-.792, 1.012]];
        trim.push(gtSeam(tint(color, .47), doorCut.map(([z, y]) => gtDoor(side, z, y, .002)), .0044));
        const shoulder = [[-.89, .909], [-.664, .903], [-.391, .896], [-.109, .891], [.23, .885], [.557, .882], [.728, .892]];
        paint.push(gtSeam(tint(color, .87), shoulder.map(([z, y]) => gtDoor(side, z, y, .002)), .006));
        // A narrow reveal and its pull tab are bedded into the door above the character line.
        const handle = gtDoor(side, -.61, .914, .005);
        trim.push(bevel('#273235', ...handle, .024, .032, .149),
          bevel(tint(color, 1.15), handle[0] + side * .008, handle[1] + .003, handle[2], .024, .017, .105));
        const sill = (u, v) => {
          const z = lerp(-.989, .986, u);
          const rise = .055 * Math.pow(Math.abs(2 * u - 1), 3);
          const height = .288 + rise + .055 * v;
          const sidePoint = gtDoor(side, z, height, .006);
          sidePoint[0] += side * .024 * Math.sin(v * Math.PI);
          return sidePoint;
        };
        trim.push(gtGrid('#30383c', 14, 3, sill, side > 0));
        trim.push(gtHeadBand(side, '#202b31', 0, 1, -.035, 1.03, .007),
          gtHeadBand(side, '#465057', .024, .977, .051, .912, .011),
          gtHeadBand(side, '#303d43', .055, .928, .27, .82, .014));
        for (const center of [.275, .583]) {
          trim.push(gtProjector(side, '#92a09d', center, .112, .285, .020));
        }
        trim.push(gtGrid('#293238', 8, 4, (u, v) => {
          const x = side * lerp(.643 + .041 * v, .826 - .021 * v, u);
          return gtNose(x, 7.74 - .68 * u + v * (2.33 + .46 * u), .008);
        }, side > 0));
        const mount = gtSide(side, .892, .152);
        trim.push(gtSeam('#263339', [mount, [side * .898, 1.020, .620], [side * .984, 1.045, .608]], .024));
        const mirror = [[.442, .045, .013], [.467, .107, .051], [.527, .124, .056],
          [.602, .112, .054], [.660, .076, .042], [.697, .018, .018]];
        const mirrorSection = (u, v) => {
          const [z, w, h] = gtSection(mirror, lerp(.442, .697, u));
          const angle = v * Math.PI * 2;
          return [side * (1.004 + w * Math.cos(angle)), 1.061 + h * Math.sin(angle), z];
        };
        paint.push(gtGrid(tint(color, 1.06), 8, 10, mirrorSection, side > 0));
        windows.push(bevel('#657b85', side * 1.002, 1.058, .468, .188, .064, .016, 0, -side * .12));
        const swage = [.99, 1.23, 1.49, 1.73, 1.98].map(z => {
          const section = gtFlank(z);
          const a = section[9], b = section[10];
          return [side * lerp(a[0], b[0], .55), lerp(a[1], b[1], .55) + .004, z];
        });
        trim.push(gtSeam(tint(color, .57), swage, .004));
        const outlet = gtTail(.607 * side, 15.38, .013);
        trim.push(coloredPart(lensBezel, '#777c7b', ...outlet, .137, .064, .067, 0, -side * .22),
          coloredPart(lensBezel, '#1a2228', outlet[0], outlet[1], outlet[2] - .031, .107, .041, .022, 0, -side * .22));
      }
      // Both wipers lie against the actual curved glass surface.
      const wipe = (rear, path, shade, thickness) => gtSeam(shade, path.map(([s, v]) => {
        const point = gtScreen(rear, s, v);
        point[2] += rear ? -.009 : .009;
        return point;
      }), thickness);
      trim.push(wipe(true, [[.48, .147], [.318, .169], [.099, .220], [-.141, .263]], '#273136', .008),
        wipe(false, [[-.64, .108], [-.39, .14], [-.16, .166], [.02, .178]], '#293237', .007),
        wipe(false, [[.13, .104], [.35, .13], [.62, .152]], '#293237', .007));
      for (const v of [.31, .42, .53, .64, .75]) {
        trim.push(gtGrid('#545953', 16, 1, (u, w) => {
          const p = gtScreen(true, lerp(-.819, .819, u), v + w * .0028);
          p[2] -= .009;
          return p;
        }, true));
      }
      // Sculpted GT aero kit: front chin splitter, rear diffuser fins, roof spoiler with endplates, and chrome beltline trim
      trim.push(
        bevel('#1d2429', 0, .282, 2.248, 1.72, .034, .185),
        bevel('#242b31', 0, .295, -2.238, 1.54, .052, .112),
        bevel(tint(color, .86), 0, 1.495, -1.365, 1.24, .036, .215, 0, 0, -.14),
        bevel('#1e252a', 0, 1.472, -1.315, 1.12, .026, .085),
      );
      for (const fx of [-.42, -.16, .16, .42]) {
        trim.push(bevel('#181f24', fx, .312, -2.265, .026, .092, .105));
      }
      for (const side of [-1, 1]) {
        trim.push(
          bevel('#1c2328', side * .625, 1.488, -1.365, .026, .088, .225),
          bevel('#1e262b', side * .975, .286, .02, .048, .038, 1.98),
          bevel('#20292f', side * .46, .958, 1.46, .21, .016, .24, 0, side * .08, .06),
        );
        const beltTrim = [.12, .35, .58, .78, .94].map(u => {
          const pt = gtSide(side, u, .112);
          return [pt[0] + side * .007, pt[1], pt[2]];
        });
        trim.push(gtSeam('#b9c4c2', beltTrim, .006));
      }
    }
    function fleetBodywork(paint, windows, trim, look, color) {
      const van = look === fleetLooks.van;
      const coupe = look === fleetLooks.coupe;
      const police = look === fleetLooks.patrol;
      const sedan = police || look === fleetLooks.sedan;
      const [headX, headY, headZ, headW, headH] = look.front;
      const [tailX, tailY, tailZ, tailW, tailH] = look.rear;
      const [grilleW, grilleY, grilleH] = look.grille;
      const bezel = (shade, ...dimensions) => coloredPart(roundedBlock, shade, ...dimensions);
      trim.push(
        block(rubber, 0, .363, 0, 1.37, .16, 4.08),
        bezel(look.trim, 0, van ? .486 : .435, -2.224, van ? 1.91 : 1.79, .158, .185),
        bezel(look.trim, 0, van ? .518 : .415, 2.218, 1.76, .155, .187),
        bezel('#1b2429', 0, grilleY, headZ + .031, grilleW, grilleH, .064),
        block('#151e23', 0, .399, 2.306, coupe ? 1.08 : .791, .061, .017),
        block('#313a36', 0, .527, tailZ - .035, .453, .141, .033),
        block('#c9c6b2', 0, .529, tailZ - .056, .401, .105, .013),
        block('#526877', -.162, .528, tailZ - .064, .047, .106, .005),
        block('#bfc6bd', 0, .460, headZ + .064, .342, .094, .015),
        block('#7d8b88', 0, grilleY + grilleH * .39, headZ + .068, .082, .019, .012, .22),
      );
      for (const x of [-.088, -.042, .033, .081, .128]) trim.push(block('#3d4948', x, .526, tailZ - .066, .019, .049, .006));
      for (const fraction of [-.26, 0, .26]) trim.push(block(sedan ? '#8d9490' : '#4b5350', 0,
        grilleY + fraction * grilleH, headZ + .066, grilleW * .88, .012, .009));
      const exhaust = coupe ? [-.65, .65] : [.65];
      for (const x of exhaust) {
        trim.push(coloredPart(cylinder, '#737e7e', x, .338, -2.219, .105, .191, .103, 0, 0, Math.PI / 2));
        trim.push(coloredPart(cylinder, '#161e23', x, .338, -2.318, .072, .019, .070, 0, 0, Math.PI / 2));
      }
      for (const side of [-1, 1]) {
        const handleZ = coupe ? -.509 : -.021;
        const mirrorY = van ? 1.222 : .992;
        const mirrorZ = van ? .818 : .738;
        trim.push(
          bezel('#202729', side * headX, headY, headZ, headW + .062, headH + .058, .108, 0, side * .238),
          bezel('#24262a', side * tailX, tailY, tailZ, tailW + .066, tailH + .054, .071, 0, -side * .185),
          block('#303831', side * .996, .384, -.028, .038, .082, 1.96),
          block(tint(color, .57), side * 1.000, .587, -.16, .019, .023, 1.692),
          block('#2a3337', side * .994, .812, handleZ, .029, .052, .216),
          block(sedan ? chrome : '#7d8682', side * 1.014, .817, handleZ, .013, .017, .153),
          block(tint(color, .41), side * .989, .738, -.704, .018, .274, .019, side * -.051),
          block('#ae7c50', side * .954, .624, -2.06, .033, .035, .108, 0, -side * .25),
          block(look.trim, side * .963, mirrorY - .053, mirrorZ + .025, .128, .064, .094, 0, 0, -.18),
        );
        paint.push(coloredPart(round, tint(color, 1.08), side * 1.051, mirrorY, mirrorZ, .209, .108, .17));
        windows.push(block('#798c91', side * 1.054, mirrorY, mirrorZ - .074, .151, .070, .019));
        if (!coupe) trim.push(block('#586360', side * .999, .813, -.913, .019, .026, .139));
        if (police) {
          trim.push(block('#bec7bd', side * 1.005, .737, -.19, .021, .246, 1.847));
          trim.push(block('#314852', side * 1.020, .724, -.19, .012, .077, .451));
        }
        if (van) {
          trim.push(block(look.trim, side * 1.053, .767, -1.223, .024, .072, 1.081));
          trim.push(block('#929985', side * 1.063, .772, -1.226, .015, .016, 1.018));
          trim.push(block('#b0915d', side * 1.054, 1.047, -.729, .016, .037, .505));
        }
      }
      if (coupe) {
        // Aggressive GT wing on twin stanchions, front carbon splitter, hood scoop & rear diffuser
        paint.push(bezel(tint(color, 1.02), 0, .995, -2.095, 1.78, .046, .225, 0, 0, -.18));
        trim.push(
          bezel('#181f24', 0, .295, 2.255, 1.84, .038, .215),
          bezel('#181f24', 0, .312, -2.238, 1.64, .062, .115),
          bezel('#1d2429', 0, .868, 1.24, .48, .036, .34, 0, 0, -.08),
          block('#d93832', 0, grilleY, headZ + .070, grilleW * .90, .016, .010),
        );
        for (const fx of [-.38, -.13, .13, .38]) trim.push(block('#141a1f', fx, .318, -2.282, .026, .092, .085));
        for (const side of [-1, 1]) {
          trim.push(
            bezel('#1a2126', side * .52, .918, -2.085, .042, .145, .118),
            bezel('#1a2126', side * .888, .992, -2.095, .028, .125, .245),
            bezel('#192126', side * .985, .58, -.68, .032, .165, .44, 0, side * -.08),
          );
        }
      }
      if (look === fleetLooks.hatch) {
        paint.push(bezel(tint(color, .98), 0, 1.575, -1.345, 1.40, .044, .21, 0, 0, -.14));
        trim.push(
          bezel('#1c2429', 0, .312, 2.248, 1.72, .036, .165),
          block('#d94b3b', 0, grilleY - grilleH * .32, headZ + .069, grilleW * .92, .015, .010),
        );
        for (const side of [-1, 1]) trim.push(bezel('#1c2328', side * .695, 1.565, -1.345, .026, .082, .215));
      }
      if (sedan && !police) {
        // Executive chrome grille frame, lower bumper blade, window beltline & trunk lip
        paint.push(bezel(tint(color, 1.04), 0, .938, -2.14, 1.62, .034, .105, 0, 0, -.12));
        trim.push(
          block('#c2cac6', 0, grilleY + grilleH * .50, headZ + .068, grilleW + .04, .018, .014),
          block('#c2cac6', 0, grilleY - grilleH * .50, headZ + .068, grilleW + .04, .018, .014),
          block('#b8c2be', 0, .388, 2.295, 1.46, .018, .018),
        );
        for (const side of [-1, 1]) {
          trim.push(
            block('#c2cac6', side * (grilleW * .5 + .012), grilleY, headZ + .068, .020, grilleH + .02, .014),
            block('#bac4c0', side * .972, .942, -.12, .016, .018, 1.72),
          );
        }
      }
      if (van) {
        // Commercial utility roof rack with side rails, rear step & amber clearance markers
        for (const z of [-1.72, -1.06, -.40]) trim.push(block(look.trim, 0, 2.085, z, 1.56, .048, .068));
        for (const side of [-1, 1]) {
          trim.push(
            block(look.trim, side * .76, 2.105, -1.06, .052, .065, 1.48),
            block('#1a2024', side * .94, .265, -1.94, .042, .165, .024),
          );
        }
        trim.push(bezel('#525b59', 0, .378, -2.315, 1.54, .042, .115));
        for (const x of [-.48, 0, .48]) trim.push(block('#f2a541', x, 2.025, .405, .078, .028, .036));
      }
      if (police) {
        // Interceptor push bumper (bull bar), sleek aero lightbar & twin rear radio antennas
        trim.push(
          block(look.trim, 0, 1.632, .029, 1.46, .092, .295),
          block('#768899', 0, 1.712, .029, .26, .118, .265),
          bezel('#171e24', 0, .595, 2.345, .86, .048, .058),
          bezel('#171e24', 0, .438, 2.345, .86, .048, .058),
        );
        for (const side of [-1, 1]) {
          trim.push(
            bezel('#171e24', side * .38, .535, 2.338, .065, .365, .088),
            coloredPart(cylinder, '#39424a', side * .64, 1.18, -2.02, .012, .56, .012),
          );
        }
      }
    }

    const gtOccupancy = new WeakMap();
    let seatedDriver = null;
    function occupiedTrim(parts) {
      if (!seatedDriver) {
        const skin = '#c48b6b';
        const face = typeof courierHead === 'function' ? courierHead(skin) : faceParts(skin, { hair: '#2e2d2c' }, true);
        const shoulder = contoured('#386c70', [[.788, .138, .083, 0], [.890, .168, .090, -.008],
          [1.041, .177, .105, -.012], [1.116, .187, .103, -.015], [1.164, .110, .077, -.009]], 12);
        const head = coloredPart(coloredGeometry(face), '#ffffff', .394, 1.139, .008, .90, .90, .90);
        shoulder.matrix.premultiply(new T.Matrix4().makeTranslation(.394, 0, .027));
        const driver = [head, shoulder];
        for (const side of [-1, 1]) {
          const hand = [.394 + side * .113, 1.118, .296];
          driver.push(gtSeam('#386c70', [[.394 + side * .148, 1.089, .034], [.394 + side * .179, .989, .128],
            [.394 + side * .129, 1.074, .251]], .034),
            coloredPart(round, skin, ...hand, .056, .066, .06));
        }
        seatedDriver = coloredPart(coloredGeometry(driver), '#ffffff');
      }
      const emptyCount = parts.reduce((sum, part) => sum + (part.geometry.index?.count ?? part.geometry.attributes.position.count), 0);
      const occupied = coloredGeometry([...parts, seatedDriver]);
      const parked = new T.BufferGeometry();
      for (const [key, attribute] of Object.entries(occupied.attributes)) parked.setAttribute(key, attribute);
      parked.setIndex(occupied.index);
      parked.setDrawRange(0, emptyCount);
      const both = { occupied, parked };
      gtOccupancy.set(parked, both);
      gtOccupancy.set(occupied, both);
      return parked;
    }
    function carGeometry(model, color, hero = false) {
      const key = model.kind + ':' + color + (hero ? ':detailed' : '');
      if (models.has(key)) return models.get(key);
      const look = fleetLooks[model.kind] ?? fleetLooks.sedan;
      const { body, roof } = look;
      const painted = hero ? gtLowerBody(color) : roundedBody(color, body, 9);
      const glasses = [];
      const trim = [];
      if (hero) finishedHatch(painted, glasses, trim, color);
      else {
        fleetCabin(painted, glasses, trim, look, color);
        fleetBodywork(painted, glasses, trim, look, color);
      }
      const farPaint = bodyShell(hero ? [
        [-2.28, .794, .906, .748, .325], gtBodyStations[0], gtBodyStations[3], gtBodyStations[6],
        gtBodyStations[9], gtBodyStations[11], gtBodyStations[13], gtBodyStations[15],
      ] : body, color);
      const farGlass = [];
      if (hero) gtCabin(farPaint, farGlass, farGlass, color, true);
      else cabin(farPaint, farGlass, roof, color, look === fleetLooks.van);
      const simpleWheels = [-1, 1].flatMap(side => [-wheelbase, wheelbase].map(z =>
        coloredPart(cylinderAxle, '#252b32', side * .964, radius, z, .231, .712, .712)));
      const geo = {
        paint: coloredGeometry(painted), trim: hero ? occupiedTrim(trim) : coloredGeometry(trim), windows: coloredGeometry(glasses),
        distant: coloredGeometry([...farPaint, ...farGlass, ...simpleWheels, ...(hero ? [-1, 1].flatMap(side => [
          block('#b34346', side * .614, .928, -2.203, .418, .043, .022, side * .047, -side * .403),
          block('#bfbb9b', side * .622, .716, 2.213, .405, .045, .019, -side * .045, side * .378),
        ]) : fleetLamps(look).distant)]),
      };
      models.set(key, geo);
      return geo;
    }
    const wheelProfile = new T.LatheGeometry([
      new T.Vector2(0, -.123), new T.Vector2(.274, -.123), new T.Vector2(.334, -.128),
      new T.Vector2(.36, -.104), new T.Vector2(.365, -.065), new T.Vector2(.365, .065),
      new T.Vector2(.36, .104), new T.Vector2(.334, .128), new T.Vector2(.274, .123), new T.Vector2(0, .123),
    ], 16).rotateZ(Math.PI / 2);
    const wheelGeometry = coloredGeometry([
      coloredPart(wheelProfile, '#1f2328'),
      coloredPart(cylinderAxle, '#8c979e', 0, 0, 0, .256, .528, .528),
      coloredPart(cylinderAxle, '#1e242a', 0, 0, 0, .266, .476, .476),
      coloredPart(cylinderAxle, '#7f878c', 0, 0, 0, .212, .378, .378),
      coloredPart(cylinderAxle, '#b0b8bc', 0, 0, 0, .294, .132, .132),
      ...[-1, 1].flatMap(side => [
        block('#b53a30', side * .096, .112, -.112, .048, .092, .072, 0, 0, .72),
        ...Array.from({ length: 5 }, (_, i) => {
          const ang = i * Math.PI * 2 / 5;
          return [
            block('#cfd8dc', side * .138, Math.cos(ang + .11) * .138, Math.sin(ang + .11) * .138, .022, .188, .022, 0, 0, ang + .15),
            block('#bcc6ca', side * .138, Math.cos(ang - .11) * .138, Math.sin(ang - .11) * .138, .022, .188, .022, 0, 0, ang - .15),
            block('#485258', side * .146, Math.cos(ang) * .048, Math.sin(ang) * .048, .014, .016, .016),
          ];
        }).flat(),
      ]),
    ]);
    const steelWheelGeometry = coloredGeometry([
      coloredPart(wheelProfile, '#24272a'),
      coloredPart(cylinderAxle, '#747c79', 0, 0, 0, .264, .497, .497),
      coloredPart(cylinderAxle, '#454c4b', 0, 0, 0, .272, .425, .425),
      coloredPart(cylinderAxle, '#828783', 0, 0, 0, .292, .211, .211),
      ...[-1, 1].flatMap(side => Array.from({ length: 7 }, (_, i) => {
        const angle = i * Math.PI * 2 / 7;
        return block('#25302e', side * .140, Math.cos(angle) * .161, Math.sin(angle) * .161,
          .009, .045, .083, 0, 0, angle);
      })),
    ]);
    const wheelAtlas = document.createElement('canvas');
    wheelAtlas.width = wheelAtlas.height = 128;
    const tread = wheelAtlas.getContext('2d');
    // Height, roughness and metalness share the RGB channels of a single linear texture.
    tread.fillStyle = '#a0e603';
    tread.fillRect(0, 0, 128, 96);
    tread.fillStyle = '#6ce603';
    for (const y of [42, 48, 54]) tread.fillRect(0, y, 128, 2);
    tread.fillStyle = '#b8e603';
    for (const y of [15, 18, 78, 81]) tread.fillRect(0, y, 128, 1);
    tread.strokeStyle = '#76e603';
    tread.lineWidth = 2;
    for (let i = -32; i < 140; i += 16) {
      tread.beginPath();
      tread.moveTo(i, 29);
      tread.lineTo(i + 13, 48);
      tread.lineTo(i + 2, 67);
      tread.stroke();
    }
    tread.fillStyle = '#a06c94';
    tread.fillRect(0, 96, 128, 16);
    tread.fillStyle = '#a09487';
    tread.fillRect(0, 112, 128, 16);
    const wheelFinish = new T.CanvasTexture(wheelAtlas);
    wheelFinish.wrapS = T.RepeatWrapping;
    const wheelMaterial = new T.MeshStandardMaterial({
      vertexColors: true, roughness: 1, metalness: 1, envMapIntensity: .72,
      roughnessMap: wheelFinish, metalnessMap: wheelFinish, bumpMap: wheelFinish, bumpScale: .009,
    });
    const heroTire = new T.LatheGeometry([
      new T.Vector2(.239, -.126), new T.Vector2(.286, -.132), new T.Vector2(.311, -.129), new T.Vector2(.337, -.119),
      new T.Vector2(.360, -.096), new T.Vector2(.365, -.057), new T.Vector2(.365, .057),
      new T.Vector2(.360, .096), new T.Vector2(.337, .119), new T.Vector2(.311, .129), new T.Vector2(.286, .132),
      new T.Vector2(.239, .126),
    ], 24).rotateZ(Math.PI / 2);
    const alloyRing = new T.LatheGeometry([
      new T.Vector2(.244, -.139), new T.Vector2(.259, -.139), new T.Vector2(.264, -.125),
      new T.Vector2(.264, .125), new T.Vector2(.259, .139), new T.Vector2(.244, .139),
      new T.Vector2(.232, .100), new T.Vector2(.232, -.100), new T.Vector2(.244, -.139),
    ], 22).rotateZ(Math.PI / 2);
    const hubCap = new T.CylinderGeometry(.5, .47, 1, 8).rotateZ(Math.PI / 2);
    function gtWheelBlade(side, angle, branch) {
      const stages = branch === 0
        ? [[.044, 0, .022, .137], [.093, -.006, .018, .112], [.145, .003, .019, .108]]
        : [[.120, -.001, .014, .108], [.182, branch * .026 + .003, .013, .119], [.246, branch * .045 + .011, .011, .137]];
      const bevel = [[-.68, .004], [.68, .004], [1, -.003], [.84, -.023], [-.84, -.023], [-1, -.003], [-.68, .004]];
      return gtGrid('#a0abaa', 6, stages.length - 1, (u, v) => {
        const [reach, offset, width, x] = stages[Math.round(v * (stages.length - 1))];
        const [edge, depth] = bevel[Math.round(u * 6)];
        const cross = offset + width * edge;
        return [side * (x + depth), Math.cos(angle) * reach - Math.sin(angle) * cross, Math.sin(angle) * reach + Math.cos(angle) * cross];
      }, side > 0);
    }
    const wheelsBySide = [-1, 1].map(side => {
      const alloy = [coloredPart(alloyRing, '#8d9999'), coloredPart(hubCap, '#637173', side * .125, 0, 0, .038, .124, .124),
        coloredPart(hubCap, '#899495', side * .144, 0, 0, .013, .064, .064)];
      for (let i = 0; i < 5; i++) {
        const angle = i * Math.PI * 2 / 5;
        for (const branch of [-1, 0, 1]) alloy.push(gtWheelBlade(side, angle, branch));
        alloy.push(coloredPart(hubCap, '#535d60', side * .143, Math.cos(angle) * .049, Math.sin(angle) * .049, .011, .015, .015));
      }
      const rotor = coloredPart(cylinderAxle, '#777a76', side * .035, 0, 0, .057, .394, .394);
      const rubber = coloredPart(heroTire, '#292b2c');
      rubber.textureRect = [0, .266, 8, .716];
      rotor.textureRect = [.5, .063, 0, 0];
      for (const part of alloy) part.textureRect = [.5, .1875, 0, 0];
      return coloredGeometry([rubber, rotor, ...alloy]);
    });
    const calipers = [-1, 1].map(side => coloredGeometry([
      block('#793d27', side * .067, .127, -.135, .064, .108, .087, 0, 0, .65),
      block('#ab6849', side * .101, .134, -.143, .006, .073, .062, 0, 0, .65),
    ]));
    const plateCanvas = document.createElement('canvas');
    plateCanvas.width = 256;
    plateCanvas.height = 72;
    const plateInk = plateCanvas.getContext('2d');
    plateInk.fillStyle = '#d4d6cb';
    plateInk.fillRect(0, 0, 256, 72);
    plateInk.fillStyle = '#28434a';
    plateInk.fillRect(0, 0, 44, 72);
    plateInk.fillStyle = '#dce5cf';
    plateInk.font = '700 31px sans-serif';
    plateInk.fillText('港', 6, 45);
    plateInk.fillStyle = '#242a2b';
    plateInk.font = 'bold 39px monospace';
    plateInk.fillText('BX 3768', 58, 48, 188);
    const plateTexture = new T.CanvasTexture(plateCanvas);
    plateTexture.colorSpace = T.SRGBColorSpace;
    const plateMaterial = new T.MeshStandardMaterial({ map: plateTexture, roughness: .56, metalness: .08, envMapIntensity: .41 });
    const platePlane = new T.PlaneGeometry(1, 1);
    const gtPlates = coloredGeometry([
      { ...coloredPart(platePlane, '#ffffff', 0, .659, -2.171, .406, .112, 1, 0, Math.PI), textureRect: [0, 0, 1, 1] },
      { ...coloredPart(platePlane, '#ffffff', 0, .459, 2.285, .343, .099), textureRect: [0, 0, 1, 1] },
    ]);
    const split = [-1, 1];
    const empty = '#ffffff';
    const lampModels = new Map();
    function fleetLamps(look) {
      if (lampModels.has(look)) return lampModels.get(look);
      const [headX, headY, headZ, headW, headH] = look.front;
      const [tailX, tailY, tailZ, tailW, tailH] = look.rear;
      const van = look === fleetLooks.van;
      const coupe = look === fleetLooks.coupe;
      const head = [];
      const rear = [];
      const brake = [];
      const distant = [];
      for (const side of split) {
        const frontAngle = side * .238;
        const rearAngle = -side * .185;
        head.push(block(empty, side * headX, headY, headZ + .062, headW, headH * (coupe ? .56 : .68), .022, 0, frontAngle));
        if (!coupe) head.push(block(empty, side * headX, headY - headH * .44, headZ + .064, headW * .79, .013, .014, 0, frontAngle));
        rear.push(block(empty, side * tailX, tailY + (van ? .038 : .010), tailZ - .044,
          tailW, tailH * (van ? .66 : .47), .017, 0, rearAngle));
        const brakeLens = van ? [tailX, tailY - .080, tailW * .83, .048] : [tailX, tailY - .033, tailW * .91, .019];
        const [x, y, w, h] = brakeLens;
        brake.push(block(empty, side * x, y, tailZ - .051, w, h, .014, 0, rearAngle));
        distant.push(block('#bba67e', side * headX, headY, headZ + .045, headW, headH, .02, 0, frontAngle),
          block('#a4423e', side * tailX, tailY, tailZ - .038, tailW, tailH, .02, 0, rearAngle));
      }
      if (coupe || look === fleetLooks.hatch) rear.push(block(empty, 0, tailY + .012, tailZ - .035, 1.18, .018, .016));
      if (look === fleetLooks.sedan) rear.push(block(empty, 0, tailY + .018, tailZ - .034, 1.12, .010, .012));
      const lamps = { head: coloredGeometry(head), rear: coloredGeometry(rear), brake: coloredGeometry(brake), distant };
      lampModels.set(look, lamps);
      return lamps;
    }
    const gtRear = coloredGeometry([
      ...split.flatMap(side => [
        gtLamp(side, '#ff243c', .035, .968, .085, .345, .022),
        gtLamp(side, '#c91b30', .24, .78, .70, .86, .022),
      ]),
      gtGrid('#ff273e', 12, 1, (u, v) => gtTail(lerp(-.36, .36, u), 4.62 + v * .16, .019), false),
    ]);
    const gtBrake = coloredGeometry([
      gtGrid('#ff392a', 9, 1, (u, v) => {
        const p = gtScreen(true, lerp(-.285, .285, u), .936 + v * .020);
        p[2] -= .010;
        return p;
      }, true),
      ...split.map(side => gtLamp(side, '#ff462e', .098, .925, .37, .582, .023)),
    ]);
    const gtHead = coloredGeometry(split.flatMap(side => [
      gtHeadBand(side, '#dbd8bc', .055, .941, .075, .181, .020),
      gtProjector(side, '#edeed8', .275, .070, .173, .024),
      gtProjector(side, '#f7ecd5', .583, .081, .191, .024),
    ]));

    function car(model, x, z, yaw, type = 'parked', color = model.color) {
      const root = new T.Group();
      const lod = new T.LOD();
      const near = new T.Group();
      root.add(lod);
      lod.addLevel(near, 0);
      const sprungBody = new T.Group();
      near.add(sprungBody);
      const hero = model.kind === 'hatch' && (type === 'parked' || type === 'player');
      const geometry = carGeometry(model, color, hero);
      const lamps = fleetLamps(fleetLooks[model.kind] ?? fleetLooks.sedan);
      const shell = mesh(sprungBody, geometry.paint, hero ? heroEnamel : enamel);
      const trim = mesh(sprungBody, geometry.trim, material);
      const windows = mesh(sprungBody, geometry.windows, hero ? heroGlazing : glazing);
      shell.receiveShadow = trim.receiveShadow = windows.receiveShadow = true;
      shell.castShadow = hero;
      const distant = new T.Mesh(geometry.distant, material);
      lod.addLevel(distant, type === 'police' ? 62 : 38, .12);
      if (hero) mesh(near, contactPatches, shadowMat);
      else mesh(near, decal, shadowMat, 0, .011, 0, 2.73, 1, 5.06);
      mesh(sprungBody, hero ? gtHead : lamps.head, hero ? heroHeadLight : frontLight);
      mesh(sprungBody, hero ? gtRear : lamps.rear, hero ? heroTailLight : backLight);
      const brake = mesh(sprungBody, hero ? gtBrake : lamps.brake, hero ? heroBrakeLight : brakeLight);
      if (hero) mesh(sprungBody, gtPlates, plateMaterial);
      const wheels = [];
      for (const side of split) {
        for (const axle of split) {
          const hub = new T.Group();
          hub.position.set(side * .944, radius, axle * wheelbase);
          near.add(hub);
          let tire;
          if (hero) {
            tire = new T.Group();
            hub.add(tire);
            const sideIndex = side > 0 ? 1 : 0;
            const wheelMesh = mesh(tire, wheelsBySide[sideIndex], wheelMaterial);
            wheelMesh.castShadow = wheelMesh.receiveShadow = true;
            // The tread is the first range in the combined wheel and defines its shadow silhouette.
            wheelMesh.onBeforeShadow = () => wheelMesh.geometry.setDrawRange(0, heroTire.index.count);
            wheelMesh.onAfterShadow = () => wheelMesh.geometry.setDrawRange(0, Infinity);
            mesh(hub, calipers[sideIndex], material).receiveShadow = true;
          } else {
            tire = mesh(hub, model.kind === 'van' || model.kind === 'patrol' ? steelWheelGeometry : wheelGeometry, material);
            tire.receiveShadow = true;
          }
          wheels.push({ hub, tire, steer: axle > 0 });
        }
      }
      const beam = mesh(near, decal, headWash, 0, .047, 6.25, 4.15, 1, 9.2);
      const rearWash = mesh(near, decal, tailWash, 0, .043, -3.15, 2.75, 1, 3.25);
      const lookSpec = fleetLooks[model.kind] ?? fleetLooks.sedan;
      const [hX, hY, hZ] = lookSpec.front;
      const [tX, tY, tZ] = lookSpec.rear;
      const headHalos = split.map(side => mesh(sprungBody, haloPlane, headHaloMat,
        side * (hero ? .64 : hX), hero ? .69 : hY, (hero ? 2.26 : hZ) + .09, 1.05, .56, 1));
      const tailHalos = split.map(side => mesh(sprungBody, haloPlane, tailHaloMat,
        side * (hero ? .62 : tX), hero ? .90 : tY, (hero ? -2.24 : tZ) - .07, .92, .44, 1));
      const brakeHalos = split.map(side => mesh(sprungBody, haloPlane, brakeHaloMat,
        side * (hero ? .62 : tX), hero ? .86 : tY - .02, (hero ? -2.25 : tZ) - .09, 1.12, .52, 1));
      let police = null;
      if (type === 'police') {
        police = {
          red: mesh(sprungBody, box, redLight, -.49, 1.735, .029, .40, .109, .274),
          blue: mesh(sprungBody, box, blueLight, .49, 1.735, .029, .40, .109, .274),
          redFloor: mesh(near, decal, policeRed, -1.4, .050, -.58, 6.6, 1, 6.3),
          blueFloor: mesh(near, decal, policeBlue, 1.4, .055, -.58, 6.6, 1, 6.3),
          redWash: mesh(distant, box, redLight, -.49, 1.735, .029, .40, .109, .274),
          blueWash: mesh(distant, box, blueLight, .49, 1.735, .029, .40, .109, .274),
        };
      }
      root.position.set(x, .04, z);
      root.rotation.y = yaw;
      scene.add(root);
      const vehicle = { root, sprungBody, wheels, beam, rearWash, headHalos, tailHalos, tail: [brake, ...brakeHalos], police, shell, trim, windows, distant, color, model, type, hero,
        x, z, yaw, vx: 0, vz: 0, pace: 0, speed: 0, lean: 0, steer: 0, roll: 0, stationary: 0, nitro: 1, impact: 0, cooldown: 0 };
      if (model.kind === 'coupe' && D.fitConceptCar) {
        vehicle.assetReady = D.fitConceptCar(vehicle, heroEnamel, frontLight, backLight, brakeLight);
      }
      return vehicle;
    }

    function paint(car, color) {
      if (typeof color !== 'string' || !/^#[0-9a-f]{6}$/i.test(color)) return false;
      if (car.concept) return car.concept.repaint(color);
      const geometry = carGeometry(car.model, color, car.hero);
      car.shell.geometry = geometry.paint;
      car.trim.geometry = car.hero && car.type === 'player' ? gtOccupancy.get(geometry.trim).occupied : geometry.trim;
      car.windows.geometry = geometry.windows;
      car.distant.geometry = geometry.distant;
      car.color = color;
      return true;
    }

    function poseCar(car, dt, night, time) {
      if (car.hero) {
        const cabin = gtOccupancy.get(car.trim.geometry);
        car.trim.geometry = car.type === 'player' ? cabin.occupied : cabin.parked;
      }
      if (surfaceHeight && (car.groundX !== car.x || car.groundZ !== car.z || car.groundYaw !== car.yaw)) {
        const fx = Math.sin(car.yaw), fz = Math.cos(car.yaw);
        let sum = 0, across = 0, along = 0;
        for (const { hub } of car.wheels) {
          const local = hub.position;
          const h = surfaceHeight(car.x + fz * local.x + fx * local.z, car.z - fx * local.x + fz * local.z);
          local.y = radius + h;
          sum += h;
          across += Math.sign(local.x) * h;
          along += Math.sign(local.z) * h;
        }
        car.groundHeight = sum * .25;
        for (const { hub } of car.wheels) hub.position.y -= car.groundHeight;
        car.crossSlope = Math.atan2(across, 4 * .944);
        car.longSlope = -Math.atan2(along, 4 * wheelbase);
        car.groundX = car.x;
        car.groundZ = car.z;
        car.groundYaw = car.yaw;
      }
      car.root.position.set(car.x, car.groundHeight ?? .023, car.z);
      car.root.rotation.y = car.yaw;
      car.sprungBody.rotation.z = (car.crossSlope ?? 0) + D.clamp(car.lean + (car.bodyRoll ?? 0), -.15, .15);
      car.sprungBody.rotation.x = (car.longSlope ?? 0) + (car.bodyPitch ?? 0) - car.impact * .06;
      const forward = car.vx * Math.sin(car.yaw) + car.vz * Math.cos(car.yaw);
      car.roll = (car.roll + forward * dt / .37) % (Math.PI * 2);
      for (const part of car.wheels) {
        if (part.steer) part.hub.rotation.y = car.steer * .38;
        part.tire.rotation.x = car.roll;
      }
      const nightActive = night > .22 && car.type !== 'parked';
      car.beam.visible = nightActive;
      if (car.rearWash) car.rearWash.visible = nightActive;
      if (car.headHalos) for (const halo of car.headHalos) halo.visible = nightActive;
      if (car.tailHalos) for (const halo of car.tailHalos) halo.visible = nightActive;
      for (const part of car.tail) part.visible = Boolean(car.brake);
      if (car.concept) {
        car.concept.rear.material = car.brake ? car.concept.brakeLight : car.concept.runningLight;
        if (car.concept.updateNight) car.concept.updateNight(night, Boolean(car.brake), car.type !== 'parked');
      }
      if (car.police) {
        const phase = Math.floor(time * 8 + (car.flash ?? 0)) % 4;
        car.police.red.visible = car.police.redFloor.visible = car.police.redWash.visible = phase < 2;
        car.police.blue.visible = car.police.blueFloor.visible = car.police.blueWash.visible = phase >= 2;
      }
    }

    function contoured(color, rings, facets = 8) {
      const vertices = [];
      const indices = [];
      const shades = [];
      for (const [y, width, depth, forward = 0, value = 1] of rings) {
        for (let i = 0; i < facets; i++) {
          const angle = (i + .5) / facets * Math.PI * 2;
          vertices.push([width * Math.cos(angle), y, depth * Math.sin(angle) + forward]);
          const shade = value * (.958 + .042 * Math.sin(angle) ** 2);
          shades.push(shade, shade, shade);
        }
      }
      for (let row = 1; row < rings.length; row++) {
        for (let i = 0; i < facets; i++) {
          const a = (row - 1) * facets + i;
          const b = (row - 1) * facets + ((i + 1) % facets);
          const above = row * facets;
          indices.push(a, above + i, above + ((i + 1) % facets), a, above + ((i + 1) % facets), b);
        }
      }
      const top = vertices.length - facets;
      for (let i = 1; i < facets - 1; i++) {
        indices.push(0, i, i + 1, top, top + i + 1, top + i);
      }
      const geometry = surface(vertices, indices);
      geometry.setAttribute('color', new T.Float32BufferAttribute(shades, 3));
      return coloredPart(geometry, color);
    }
    const outfits = [
      { hair: '#28292c', collar: '#b2ae9e', shoe: '#353b3d', hood: false, bag: false, crop: .020 },
      { hair: '#392d2b', collar: '#6a6d64', shoe: '#3d3936', hood: true, bag: false, crop: .043 },
      { hair: '#343436', collar: '#9b8e76', shoe: '#30383b', hood: false, bag: true, crop: .016 },
      { hair: '#251f26', collar: '#8c8879', shoe: '#42433b', hood: true, bag: true, crop: .032 },
    ];
    const sewn = (color, ...dimensions) => coloredPart(roundedBlock, color, ...dimensions);

    // The courier's sculpt lives on the original rig. All cloth, skin and trim are
    // merged below, including the pieces which blend across knees and elbows.
    function sculptedPart(color, vertices, indices) {
      const values = [];
      const positions = vertices.map(([x, y, z, shade = 1]) => {
        values.push(shade, shade, shade);
        return [x, y, z];
      });
      const geometry = surface(positions, indices);
      geometry.setAttribute('color', new T.Float32BufferAttribute(values, 3));
      return coloredPart(geometry, color);
    }
    function roundSculpt(color, rows, facets, point, caps = true) {
      const vertices = [];
      const faces = [];
      for (let j = 0; j < rows.length; j++) {
        for (let i = 0; i < facets; i++) {
          vertices.push(point(rows[j], i * Math.PI * 2 / facets, j));
          if (!j) continue;
          const a = (j - 1) * facets + i;
          const b = (j - 1) * facets + (i + 1) % facets;
          faces.push(a, a + facets, b + facets, a, b + facets, b);
        }
      }
      const top = vertices.length - facets;
      if (caps) for (let i = 1; i < facets - 1; i++) faces.push(0, i, i + 1, top, top + i + 1, top + i);
      return sculptedPart(color, vertices, faces);
    }
    function clothPanel(color, across, high, normal, point) {
      const vertices = [];
      const indices = [];
      const middle = point(.5, .5);
      const tangent = (u, v) => new T.Vector3(...point(u, v).slice(0, 3)).sub(new T.Vector3(...middle.slice(0, 3)));
      const reverse = tangent(.51, .5).cross(tangent(.5, .51)).dot(new T.Vector3(...normal)) < 0;
      for (let j = 0; j <= high; j++) {
        for (let i = 0; i <= across; i++) {
          vertices.push(point(i / across, j / high));
          if (!i || !j) continue;
          const d = vertices.length - 1;
          const a = d - across - 2;
          const b = a + 1;
          const c = d - 1;
          if (reverse) indices.push(a, d, b, a, c, d);
          else indices.push(a, b, d, a, d, c);
        }
      }
      return sculptedPart(color, vertices, indices);
    }
    function welt(color, points, radius, segments = points.length * 2, facets = 5) {
      const path = new T.CatmullRomCurve3(points.map(([x, y, z]) => new T.Vector3(x, y, z)));
      if(radius<=.0022){
        // A four-sided cord keeps its highlight at this size. Long straight
        // stitches need one short segment between sampled points.
        facets=Math.min(facets,4);
        segments=Math.min(segments,points.length+2);
      }
      return coloredPart(new T.TubeGeometry(path, segments, radius, facets, false), color);
    }
    function sampleProfile(rows, y) {
      for (let i = 1; i < rows.length; i++) {
        if (y <= rows[i][0]) {
          const a = rows[i - 1], b = rows[i];
          return interpolate(a, b, D.clamp((y - a[0]) / (b[0] - a[0]), 0, 1));
        }
      }
      return rows[rows.length - 1];
    }
    const bell = value => Math.exp(-value * value);
    const softCorner = (v, exponent) => Math.sign(v) * Math.pow(Math.abs(v), exponent);
    const faceProfile = [
      [.055, .032, .077, .050, .020], [.066, .051, .093, .064, .018], [.081, .065, .096, .080, .012],
      [.099, .081, .100, .085, .010], [.117, .088, .099, .092, .009], [.138, .094, .104, .099, .009],
      [.157, .098, .103, .105, .008], [.175, .099, .101, .109, .008], [.191, .097, .104, .110, .009],
      [.208, .095, .104, .110, .009], [.229, .096, .102, .111, .009], [.251, .094, .101, .108, .009],
      [.281, .084, .093, .098, .009], [.304, .057, .071, .075, .009], [.322, .019, .027, .029, .011],
    ];
    function faceSection(y) {
      let i=1;
      while(i<faceProfile.length-1 && y>faceProfile[i][0]) i++;
      const a=faceProfile[i-1], b=faceProfile[i];
      const left=faceProfile[Math.max(0,i-2)], right=faceProfile[Math.min(faceProfile.length-1,i+1)];
      const height=b[0]-a[0], t=D.clamp((y-a[0])/height,0,1), inv=1-t;
      return a.map((value,j)=>{
        const slopeA=(b[j]-left[j])*height/(b[0]-left[0]);
        const slopeB=(right[j]-value)*height/(right[0]-a[0]);
        return (1+2*t)*inv*inv*value + t*inv*inv*slopeA + t*t*(3-2*t)*b[j]-t*t*inv*slopeB;
      });
    }
    function faceDisplacement(x, y) {
      const cheek = bell((Math.abs(x)-.067)/.030)*bell((y-.151-.31*(Math.abs(x)-.046))/.031);
      const socket = bell((Math.abs(x) - .048) / .022) * bell((y - .181) / .014);
      const brow = bell((Math.abs(x) - .048) / .034) * bell((y - .202) / .012);
      const bridge = bell(x / .016) * bell((y - .163) / .043);
      const noseTip = bell(x/.016)*bell((y-.142)/.012);
      const nostril = bell((Math.abs(x)-.015)/.009)*bell((y-.135)/.008);
      const upperLip = bell(x/.028)*bell((y-.117)/.011);
      const smileLine = bell((Math.abs(x)-.023-(.139-y)*.59)/.009)*bell((y-.127)/.018);
      const chin = bell(x / .030) * bell((y - .077) / .018);
      return .009*cheek-.009*socket+.008*brow+.021*bridge+.028*noseTip+.016*nostril+.0028*upperLip-.0022*smileLine+.008*chin;
    }
    function portraitDepth(x, y) {
      const [, width, depth, , center] = faceSection(y);
      const turn = Math.sqrt(Math.max(.002, 1 - (x / width) ** 2));
      return center + depth * turn + faceDisplacement(x, y) * turn;
    }
    function courierHead(skin) {
      const hair = '#302821';
      const sections=[...faceProfile.map(r=>r[0]),.124,.129,.133,.143,.150,.169,.182,.198].sort((a,b)=>a-b).map(faceSection);
      const parts = [
        contoured(tint(skin, .88), [[-.028, .062, .066, -.004], [.018, .057, .063, -.005],
          [.064, .056, .058, -.004], [.110, .066, .064, -.004]], 16),
        roundSculpt(skin,sections,40,([y,width,front,rear,center],theta)=>{
          const a=theta+.19*Math.sin(2*theta);
          const x=width*Math.cos(a);
          const turn=Math.sin(a);
          const z = center + (turn > 0 ? front : rear) * turn + faceDisplacement(x, y) * Math.max(0, turn);
          const shadow = .10 * bell((Math.abs(x) - .045) / .035) * bell((y - .180) / .015) * Math.max(0, turn);
          const beard = .070 * (1-T.MathUtils.smoothstep(y,.085,.133)) * Math.max(0,turn);
          return [x, y, z, .94 + .06 * Math.max(0, turn) - shadow - beard];
        }),
      ];
      for (const s of split) {
        const ear = (u, v) => {
          const a = u * Math.PI * 2;
          const r = .06 + .94 * v;
          const z = -.004 + .019 * r * Math.cos(a) + .005 * r * Math.sin(a);
          const y = .155 + .035 * r * Math.sin(a);
          const helix = .007 * bell((r - .74) / .21);
          return [s * (.100 + helix + .004 * (1 - r)), y, z, .87 + .16 * bell((r - .76) / .16)];
        };
        parts.push(coloredPart(round, tint(skin,.88), s*.099, .154, -.006, .025, .067, .037));
        parts.push(clothPanel(tint(skin, .95), 16, 4, [s, 0, 0], ear));
        // Both lids meet the globe, with a warm darker upper lash line and a small visible iris.
        const eye = (t, v) => {
          const x = s * (.026 + .040 * t);
          const arch = Math.sin(Math.PI * t);
          const mid = .176 + .0026 * t;
          const y = mid + arch * lerp(-.0046, .0058, v);
          return [x, y, portraitDepth(x, y) + .002 + arch * .0025];
        };
        parts.push(clothPanel('#b8a993', 12, 2, [0, 0, 1], eye));
        for (const upper of [0, 1]) {
          const path = Array.from({ length: 7 }, (_, i) => eye(i / 6, upper));
          parts.push(welt(upper ? '#51392d' : tint(skin, .85), path, upper ? .0015 : .0011, 9));
        }
        const cx = s * .047;
        const cy = .1773;
        const ez = portraitDepth(cx, cy) + .0059;
        parts.push(coloredPart(round, '#534435', cx, cy, ez, .010, .010, .005));
        parts.push(coloredPart(round, '#2c2a24', cx, cy, ez+.0022, .0054, .0063, .0025));
        parts.push(clothPanel(hair, 10, 2, [0, 0, 1], (u, v) => {
          const x = s * (.023 + .052 * u);
          const y = .192 + .009 * Math.sin(u * Math.PI * .91) - .002 * u + v * (.002 + .004 * Math.sin(Math.PI * u));
          return [x, y, portraitDepth(x, y) + .003];
        }));
        const nostrilX=s*.014;
        parts.push(coloredPart(round,tint(skin,.48),nostrilX,.131,portraitDepth(nostrilX,.131)+.0005,.009,.0035,.0022,s*.12));
      }
      const lip = (u, v, upper) => {
        const x = (u - .5) * .055;
        const full = Math.sin(Math.PI * u);
        const middle = .106 + .0018 * Math.cos((u - .5) * Math.PI * 2);
        const cupid = .0023 * bell((Math.abs(x) - .008) / .005);
        const y = middle + (upper ? v * (.0035 * full + cupid) : -v * .005 * full);
        return [x, y, portraitDepth(x, y) + .0014 + full * (.0027 + .0015 * Math.sin(Math.PI * v))];
      };
      parts.push(clothPanel('#a26755', 12, 3, [0, 0, 1], (u, v) => lip(u, v, true)));
      parts.push(clothPanel('#b77e66', 12, 3, [0, 0, 1], (u, v) => lip(u, v, false)));
      parts.push(welt('#714e41', Array.from({ length: 7 }, (_, i) => lip(i / 6, 0, true)), .0009, 9));
      // Short taper at the nape and temples, with the crown swept off a side part.
      const hairStart = parts.length;
      const volume = [[.099,.095,.103,.105],[.124,.100,.108,.111],[.153,.104,.111,.115],
        [.185,.105,.113,.117],[.208,.104,.113,.119],[.236,.105,.114,.119],[.264,.105,.112,.118],
        [.284,.099,.107,.114],[.301,.089,.100,.104],[.316,.078,.086,.091],[.328,.063,.071,.075],
        [.338,.045,.052,.055],[.344,.029,.033,.033],[.347,.010,.012,.010],[.348,.002,.002,.002]];
      function hairPoint(theta, t) {
        const st = Math.sin(theta), ct = Math.cos(theta);
        const front = Math.max(0, st);
        const line = .164 + .043 * front + .056 * st + .013 * front * ct
          - .019 * bell((ct + .40) / .30) * front + .003 * Math.cos(6 * theta);
        const angle = t * Math.PI * .50;
        const sweep = theta - .96 * t - .31 * Math.sin(t*Math.PI);
        const wave = Math.cos(13 * sweep + .74 * Math.sin(3 * sweep));
        const y = lerp(line,.348,Math.sin(angle));
        const [,w,f,b] = sampleProfile(volume,y);
        const [,scalpW,scalpFront,scalpRear] = sampleProfile(faceProfile,y);
        const taper = T.MathUtils.smoothstep(t,0,.18);
        const width = lerp(scalpW+.0018,w,taper);
        const forward = lerp(scalpFront+.0025,f,taper);
        const rear = lerp(scalpRear+.0025,b,taper);
        const ridges = .0028 * wave * Math.sin(Math.PI * t);
        const x = (width + ridges) * ct - .011 * t*t;
        const z = .008 + ((st>0?forward:rear) + ridges) * st + .005 * front * Math.sin(Math.PI * t) + .005 * t*t;
        return [x,y,z,.78+.095*wave*Math.sin(Math.PI*t)+.15*t+.10*Math.max(0,-st)*(1-t)];
      }
      parts.push(roundSculpt(hair, [0, .08, .17, .27, .38, .49, .60, .71, .81, .90, .965, .999], 44,
        (t, a) => hairPoint(a, t)));
      for (let i = 0; i < 14; i++) {
        const begin = i * Math.PI * 2 / 14 + .18;
        parts.push(clothPanel(i%3?'#393026':'#42372c',3,8,[Math.cos(begin+.4),.25,Math.sin(begin+.4)],(u,v)=>{
          const t=.047+v*(.64+.12*Math.sin(i*2));
          const a=begin+.94*t+.31*Math.sin(t*Math.PI)+(u-.5)*(.038+.14*Math.sin(Math.PI*v));
          const [x,y,z]=hairPoint(a,t);
          const lift=.0009+.0023*Math.sin(Math.PI*u)*Math.sin(Math.PI*v);
          return [x+lift*Math.cos(a),y+lift*t*.7,z+lift*Math.sin(a),.81+.19*Math.sin(u*Math.PI)];
        }));
      }
      parts.forEach((part,i)=>{part.surfaceKind=i<hairStart?2:3;});
      return parts;
    }

    const jacketProfile = [
      [.048, .164, .128, .125], [.069, .178, .133, .128], [.108, .185, .134, .133], [.153, .189, .145, .140],
      [.202, .185, .139, .140], [.271, .176, .131, .137], [.342, .183, .145, .148], [.417, .197, .158, .149],
      [.474, .216, .149, .141], [.515, .224, .126, .132], [.545, .203, .111, .124], [.570, .155, .093, .105],
      [.595, .107, .077, .083], [.609, .079, .071, .074],
    ];
    const jacketLevels = [.048, .060, .076, .101, .123, .141, .157, .173, .191, .215, .239, .258, .278, .305,
      .334, .365, .390, .416, .441, .461, .484, .507, .525, .543, .560, .579, .596, .609];
    function jacketPoint(y, a, raise = 0) {
      const [, width, front, rear] = sampleProfile(jacketProfile, y);
      const ct = Math.cos(a), st = Math.sin(a);
      const x = width * softCorner(ct, .85);
      const back = Math.max(0, -st);
      const side = Math.abs(ct);
      const fold = (height, slope, breadth) => bell((y - height - slope * x - .008 * Math.sin(3 * a + height * 7)) / breadth);
      const lower = .010 * fold(.149, .21, .016) - .007 * fold(.172, .18, .012)
        + .010 * fold(.225, -.28, .021) - .006 * fold(.249, -.21, .016);
      const shoulder = .010 * fold(.402, .39, .017) - .006 * fold(.426, .33, .018);
      const spine = (-.009 * bell(x / .025) + .009 * bell((Math.abs(x) - .069) / .040)) * bell((y - .406) / .12);
      const d = lower * (.44 + .56 * side) + shoulder * (.20 + .80 * back) + back * spine;
      const z = .005 + (st > 0 ? front : rear) * softCorner(st, .82) + st * (d + raise);
      const notch = .073 * T.MathUtils.smoothstep(y,.492,.609) * Math.max(0,st)**8;
      return [x + ct * (.3 * d + raise), y-notch, z, .97 + lower * 4 + shoulder * 4 + spine * back * 2];
    }
    function jacketSide(x, y, sign, gap) {
      const [, width] = sampleProfile(jacketProfile, y);
      const radial = D.clamp(softCorner(x / width, 1 / .85), -.996, .996);
      return jacketPoint(y, sign * Math.acos(radial), gap);
    }
    function crossbodyBag(parts) {
      const leather = '#533e2f';
      const canvas = '#986541';
      const bagStart = parts.length;
      // Padded woven strap runs continuously over the collar from the near shoulder.
      function strapPath(v, face) {
        const controls = face < 0 ? [
          [.160, .183], [.127, .280], [.044, .359], [-.041, .437], [-.113, .508], [-.125, .555],
        ] : [[.154, .122], [.150, .216], [.088, .303], [.008, .387], [-.080, .479], [-.125, .555]];
        const line = Math.min(controls.length - 2, Math.floor(v * (controls.length - 1)));
        return interpolate(controls[line], controls[line + 1], v * (controls.length - 1) - line);
      }
      for (const sign of split) {
        function bandPoint(u, v) {
          const [cx, cy] = strapPath(v, sign);
          const w = .0245;
          const offset = (2 * u - 1) * w;
          const shoulder = Math.pow(v, 7);
          const x = cx + offset * (.775 + .225 * shoulder);
          const y = cy + offset * .54 * (1-shoulder);
          const p = jacketSide(x, y, sign, .006 + .002 * Math.sin(Math.PI * u));
          p[3] = .86 + .11 * Math.sin(Math.PI * u) + .11 * bell((u - .08) / .065) + .08 * bell((u - .92) / .062);
          return p;
        }
        parts.push(clothPanel('#544b3c', 6, 21, [0, 0, sign], bandPoint));
        for (const edge of [.08, .92]) {
          parts.push(welt('#806e54', Array.from({length: 10}, (_, i) => bandPoint(edge, i / 9)), .00145, 13, 4));
        }
        if (sign > 0) {
          const rail = (u, v) => { const [x, y, z] = bandPoint(u, v); return [x, y, z + .0027]; };
          const lower = .52;
          const upper = .60;
          parts.push(welt('#a49c81', [rail(.02, lower), rail(.98, lower), rail(.98, upper), rail(.02, upper), rail(.02, lower)], .0027, 10));
        }
      }
      const wrap = (u,v) => {
        const offset=(u-.5)*.049;
        const x=.154+offset*.775;
        const y=.122+offset*.54;
        const [,width]=sampleProfile(jacketProfile,y);
        const from=Math.acos(D.clamp(softCorner(x/width,1/.85),-.99,.99));
        const a=lerp(from,-.51,v);
        const targetY=.218-offset*.89;
        return jacketPoint(lerp(y,targetY,v),a,.006+.002*Math.sin(u*Math.PI));
      };
      parts.push(clothPanel('#554b3b',5,11,[1,0,0],wrap));
      const ringEnd = (u,v) => {
        const [x,y,z]=wrap(u,1);
        return [lerp(x,.197+(u-.5)*.010,v),lerp(y,.205-(u-.5)*.040,v),lerp(z,-.170,v)];
      };
      parts.push(clothPanel('#554b3b',4,4,[1,0,0],ringEnd));
      parts.push(clothPanel('#554b3b', 5, 10, [0, 1, 0], (u, v) => {
        const cx=-.125+(u-.5)*.049;
        const start=jacketSide(cx,.555,1,.006+.002*Math.sin(Math.PI*u));
        const end=jacketSide(cx,.555,-1,.006+.002*Math.sin(Math.PI*u));
        const lift=Math.sin(Math.PI*v);
        return [lerp(start[0],end[0],v)+.004*lift,lerp(start[1],end[1],v)+lift*(.029+.020*(u-.5)),
          lerp(start[2],end[2],v),.91+.10*Math.sin(Math.PI*u)];
      }));
      const bagSections = [[.086,.111,.039], [.098,.137,.044], [.120,.151,.051], [.147,.160,.058],
        [.185,.162,.061], [.247,.162,.056], [.291,.158,.049], [.321,.145,.039], [.337,.124,.029]];
      function pouch(y, a, raise = 0) {
        const [, w, depth] = sampleProfile(bagSections, y);
        const c = Math.cos(a), s = Math.sin(a);
        const across = w * softCorner(c, .53);
        const dimple = .004 * Math.cos(9 * across + 8 * y) + .0025 * Math.cos(36 * across - 17 * y);
        return [.052 + across + c * raise, y - .17 * across, -.170 + (depth + dimple) * softCorner(s, .63) + s * raise,
          .91 + .08 * (1 - Math.abs(c)) + .055 * Math.cos(15 * across)];
      }
      parts.push(roundSculpt(canvas, bagSections, 32, ([y], a) => pouch(y, a)));
      const flap = (u, v, lift = 0) => {
        const x = lerp(-.137, .143, u) * lerp(.89, 1, Math.sin(v * Math.PI * .50));
        const edge = Math.abs(2 * u - 1);
        const y = lerp(.189 + .020 * edge * edge + .002 * Math.sin(7 * u), .325, v);
        const [, w] = sampleProfile(bagSections, y);
        const a = -Math.acos(D.clamp(softCorner(x / w, 1 / .53), -.99, .99));
        const p = pouch(y, a, .010 + lift + .002 * Math.sin(Math.PI * u) * Math.sin(Math.PI * v));
        p[3] *= .91 + .10 * v + .06 * Math.sin(Math.PI * u);
        return p;
      };
      parts.push(clothPanel('#ac7850', 14, 7, [0, 0, -1], flap));
      const flapEdge = [[0,.86], [0,.45], [0,.10], [.08,.01], [.28,0], [.52,0], [.78,0], [.95,.015], [1,.13], [1,.49], [1,.86]];
      parts.push(welt(leather, flapEdge.map(([u,v]) => flap(u,v)), .0033, 25, 6));
      for (const s of split) {
        const a = s > 0 ? -.34 : -Math.PI + .34;
        parts.push(welt('#725138', bagSections.slice(1,-1).map(([y]) => pouch(y, a, .002)), .0036, 12, 4));
      }
      const tab = (u,v) => {
        const x = (u - .5) * .028;
        const y = .150 + v * .071;
        const p = pouch(y, -Math.PI / 2 + .08 + x / .16, .0115);
        p[0] = .064 + x;
        p[1] -= .002;
        return p;
      };
      parts.push(clothPanel(leather, 3, 6, [0,0,-1], tab));
      const clasp = (x,y) => { const p = tab(x,y); p[2] -= .003; return p; };
      parts.push(welt('#b4a27d', [clasp(.06,.43),clasp(.94,.43),clasp(.94,.67),clasp(.06,.67),clasp(.06,.43)], .0024, 10, 5));
      const label = (u,v) => {
        const p=flap(.16+u*.24,.63+v*.14,.002);
        p[2]-=.001;
        return p;
      };
      parts.push(clothPanel('#755b3f',4,2,[0,0,-1],label));
      parts.push(welt('#bd9a69', [label(.10,.35),label(.29,.72),label(.45,.35),label(.60,.67)],.0017,6,4));
      parts.push(welt('#bd9a69',[label(.67,.40),label(.89,.40)],.0014,3,4));
      parts.push(welt('#c08b5f',Array.from({length:10},(_,i)=>flap(.05+.90*i/9,.058,.002)),.00125,12,4));
      for (let i=bagStart;i<parts.length;i++) parts[i].surfaceKind=1;
      return parts;
    }
    function courierJacket(color, pants) {
      const cloth = new T.Color(color).lerp(new T.Color('#51776a'), .38);
      const denim = new T.Color(pants).lerp(new T.Color('#52606b'),.29);
      const yoke = '#365851';
      const seam = a => .420 + .051 * Math.abs(Math.cos(a)) + .018 * Math.max(0,Math.sin(a));
      const parts = [
        contoured(denim, [[-.080,.152,.106],[-.026,.180,.128],[.073,.183,.132],[.126,.166,.108]], 16),
        roundSculpt(cloth, jacketLevels.filter(y=>y>=.101&&y<=.461), 28, (row,a) =>
          jacketPoint(lerp(.101,seam(a),(row-.101)/.360),a),false),
        roundSculpt(yoke,[0,.13,.27,.40,.53,.66,.78,.87,.94,1],28,(t,a)=>jacketPoint(lerp(seam(a),.609,t),a),false),
        roundSculpt(tint(cloth,.68), [.048,.054,.064,.076,.086,.101], 28, (y,a) => {
          const p = jacketPoint(y,a);
          p[3] *= .90 + .10 * Math.cos(62 * (y - .05)) + .06 * Math.cos(a * 15);
          return p;
        }),
        contoured('#aaa089', [[.518,.061,.070,.011], [.539,.074,.083,.013], [.567,.079,.087,.016],
          [.601,.072,.078,.014], [.622,.064,.066,.013]], 24),
      ];
      // The yoke crosses the back and wraps the shoulders. Its scooped lower hem
      // joins the raglan sleeve, above the softer body pleats.
      for (const sign of split) {
        const line = Array.from({length:15},(_,i)=>{
          const a = sign*i/14*Math.PI;
          return jacketPoint(seam(a),a,.0019);
        });
        parts.push(welt('#668076',line,.0020,17,4));
      }
      for (const side of split) {
        const pleat = (u,v) => {
          const y = .221+.202*v;
          const x = side*(.088+.024*v+.008*Math.sin(Math.PI*v)) + (u-.5)*.021*Math.sin(Math.PI*(.11+.78*v));
          const pinch = .0060*Math.sin(Math.PI*u)*Math.sin(Math.PI*v);
          const p = jacketSide(x,y,-1,.0015+pinch);
          p[3] *= .77+.25*u;
          return p;
        };
        parts.push(clothPanel(tint(cloth,.96),4,12,[0,0,-1],pleat));
        // Mirror the front collar leaves and attach their backs to the neck stand.
        const collarLeaf = (u,v) => {
          const a = Math.PI / 2 - side * (.21 + u * (Math.PI-.21));
          const front = Math.max(0,Math.sin(a));
          const th = .584 - .053*front**3;
          const p = jacketPoint(lerp(th,.609,v),a,.004 + .006*Math.sin(Math.PI*v) + .005*(1-v));
          p[1] += .015*v - .015*front**3*(1-v);
          p[3] = .87+.12*v;
          return p;
        };
        parts.push(clothPanel(tint(cloth,.62), 14, 4, [side,0,0], collarLeaf));
        parts.push(welt('#75887c', Array.from({length:8}, (_,i) => collarLeaf(i/7,1)), .0021, 11, 5));
        function pocket(u,v) {
          const y = .194 + v * .101 + (u - .5) * .010;
          return jacketSide(side * (.091 + .059 * v) + (u - .5) * .015, y, 1, .0041 + .0017 * Math.sin(Math.PI*u));
        }
        parts.push(clothPanel(tint(cloth,.73), 3, 9, [0,0,1], pocket));
        parts.push(welt(tint(cloth,.55), Array.from({length:6},(_,i) => pocket(.62, i/5)), .002, 8));
      }
      const zip = (u,v) => {
        const y = lerp(.062,.549,v);
        return jacketSide(.004 + .004 * Math.sin(v * Math.PI * 2) + (u-.5) * .018, y, 1, .0036);
      };
      parts.push(clothPanel(tint(cloth,.64), 3, 22, [0,0,1], zip));
      parts.push(welt('#7c8071', Array.from({length:14}, (_,i) => zip(.44,i/13)), .0019, 21));
      const eyelet = zip(.45,.82);
      parts.push(sewn('#ac9977', eyelet[0], eyelet[1]-.008, eyelet[2]+.004, .006, .021, .005, -.15));
      return crossbodyBag(parts);
    }

    const sleeveProfile = [
      [-.511,.041,.045,.006], [-.476,.047,.051,.005], [-.432,.053,.059,.003], [-.376,.057,.063,-.001],
      [-.325,.063,.068,-.006], [-.278,.063,.068,-.009], [-.223,.064,.071,-.005], [-.157,.068,.075,.001],
      [-.092,.074,.081,.003], [-.040,.078,.082,.005], [.005,.075,.076,.005], [.037,.064,.065,.004], [.059,.035,.041,.000],
    ];
    function courierSleeve(color, side) {
      const cloth = new T.Color(color).lerp(new T.Color('#51776a'), .38);
      function sleeve(y,a,raise = 0) {
        const [,w,d,z] = sampleProfile(sleeveProfile,y);
        const st = Math.sin(a), ct = Math.cos(a);
        const tuck = (height, pitch, spread) => bell((y - height - .036 * pitch * st - .024 * pitch * ct * side) / spread);
        const crease = .008 * tuck(-.275,1,.016) - .007 * tuck(-.301,.8,.013)
          + .007 * tuck(-.341,-.40,.018) - .004 * tuck(-.365,-.5,.014) + .006 * tuck(-.441,.48,.015);
        const inset = .047 * Math.max(0,(y + .019)/.078) + .008 * bell((y+.09)/.14);
        return [-side * inset + ct * (w + crease + raise), y, z + st * (d + crease + raise),
          .96 + .07 * bell((y+.064)/.07) + 4.4 * crease];
      }
      const shoulderSeam = a => -.063 - .026 * Math.cos(a) * side - .018 * Math.sin(a);
      const levels = [-.479,-.460,-.445,-.427,-.401,-.378,-.362,-.345,-.329,-.311,-.296,-.281,
        -.263,-.246,-.218,-.178,-.133,-.095,-.063];
      const parts = [roundSculpt(cloth,levels,16,(row,a)=>
        sleeve(lerp(-.479,shoulderSeam(a),(row+.479)/.416),a),false)];
      parts.push(roundSculpt('#385b53',[0,.19,.38,.57,.73,.85,.94,1],16,(t,a)=>sleeve(lerp(shoulderSeam(a),.059,t),a)));
      const seam = Array.from({length:13}, (_,i) => {const a = i/12*Math.PI*2; return sleeve(shoulderSeam(a),a,.0024);});
      parts.push(welt('#6c8375',seam,.0019,17,4));
      if (side === -1) {
        // Woven sleeve insignia, with a clipped shield and two short wave bars.
        const badge = (u,v,raise=0) => {
          const w = .54 * (.67 + .33 * Math.min(1, v/.27));
          const a = Math.PI + (u-.5)*w*2 - .12;
          return sleeve(-.174 + v*.067,a,.0034+raise);
        };
        parts.push(clothPanel('#494a39',6,6,[-1,0,0],badge));
        for (const [height,ink] of [[.40,'#bd994d'],[.62,'#d9bd75']]) {
          parts.push(welt(ink,[[.19,height+.09],[.49,height-.02],[.82,height+.11]].map(([u,v]) => badge(u,v,.002)),.0026,6));
        }
      }
      return parts;
    }
    function courierHand(skin, cuffs, side) {
      const parts = [
        roundSculpt(cuffs, [-.244,-.239,-.227,-.211,-.202], 20, (y,a) => {
          const w = .043 + (y+.244)*.081;
          const variation = .0012 * Math.cos(12*a);
          return [(w+variation)*Math.cos(a),y,.004+(.047+(y+.244)*.08+variation)*Math.sin(a),.94+.09*Math.cos(12*a)];
        }),
        roundSculpt(skin, [[-.307,.020,.030,.005],[-.299,.024,.035,.004],[-.281,.026,.035,.002],
          [-.260,.023,.030,.003],[-.239,.023,.024,.003],[-.230,.021,.022,.003]], 14, ([y,w,d,z],a) => {
          const turn = Math.cos(a) * side;
          return [w*softCorner(Math.cos(a),.83)+side*.001,y,z+d*softCorner(Math.sin(a),.73),.92+.07*Math.max(0,turn)];
        }),
      ];
      const fingers = [
        [.025,.045,.009,.007], [.008,.052,.010,.003], [-.009,.049,.009,-.001], [-.024,.037,.0075,-.003],
      ];
      for (const [z,length,radius,fan] of fingers) {
        const points = [[0,.55],[.10,.88],[.39,.96],[.62,.81],[.77,.79],[.91,.66],[1,.32]].reverse();
        parts.push(roundSculpt(tint(skin,.98), points, 7, ([t,w],a) => {
          const curl = .003*t + .013*t*t;
          return [side * (.004 - curl) + radius*w*Math.cos(a), -.297-length*t,
            z + fan*t + radius*w*.86*Math.sin(a), .95+.06*Math.sin(Math.PI*t)];
        }));
      }
      parts.push(roundSculpt(skin, [[-.315,.005,-.013,.045],[-.308,.008,-.015,.045],[-.295,.011,-.016,.042],
        [-.283,.013,-.017,.034],[-.268,.012,-.013,.029],[-.260,.007,-.012,.023]], 10,
        ([y,r,x,z],a) => [side*x+r*Math.cos(a),y,z+r*Math.sin(a)]));
      for (let i=1;i<parts.length;i++) parts[i].surfaceKind=2;
      return parts;
    }
    const trouserProfile = [[-.874,.054,.055,0],[-.822,.058,.059,.002],[-.746,.059,.063,-.009],[-.657,.066,.074,-.017],
      [-.562,.064,.070,-.014],[-.487,.062,.067,.001],[-.440,.068,.078,.008],[-.395,.068,.075,.010],
      [-.304,.077,.083,.005],[-.203,.085,.090,-.002],[-.091,.091,.100,-.003],[.008,.094,.105,.000],[.041,.085,.095,.000]];
    function courierTrousers(pants, side) {
      pants = new T.Color(pants).lerp(new T.Color('#52606b'),.29);
      const levels = [-.874,-.854,-.836,-.821,-.801,-.780,-.746,-.704,-.654,-.605,-.558,-.519,-.499,-.484,
        -.469,-.447,-.429,-.404,-.382,-.357,-.308,-.251,-.192,-.134,-.082,-.036,.006,.041];
      function cloth(y,a,raise=0) {
        const [,w,d,offset] = sampleProfile(trouserProfile,y);
        const c=Math.cos(a), s=Math.sin(a);
        const wrinkle = (h,slope,spread) => bell((y-h-.022*slope*c*side-.012*s)/spread);
        const knee = .0065*wrinkle(-.419,.8,.018) -.005*wrinkle(-.449,.62,.015) + .006*wrinkle(-.479,-.85,.019);
        const hem = .006*wrinkle(-.813,-.64,.014) -.005*wrinkle(-.837,-.47,.015);
        const bulge = knee*(.65+.35*Math.max(0,-s))+hem;
        return [(w+raise+bulge)*softCorner(c,.86),y,offset+(d+raise+bulge)*softCorner(s,.88),.95+4.8*bulge];
      }
      const parts = [roundSculpt(pants,levels,16,(y,a)=>cloth(y,a))];
      const pocket = (u,v,raise=0) => {
        const a = (side<0?Math.PI:0) + side * ((u-.5)*1.22-.13);
        const edge = Math.abs(2*u-1);
        const y = lerp(-.275+.019*edge*edge,-.123+.008*u,v);
        return cloth(y,a,.0045+raise+.0024*Math.sin(Math.PI*v)*Math.sin(Math.PI*u));
      };
      parts.push(clothPanel(tint(pants,1.09),7,6,[side,0,0],pocket));
      parts.push(clothPanel(tint(pants,.84),6,3,[side,0,0],(u,v)=>pocket(u,.78+.22*v,.003)));
      const piping = [[0,.87],[0,.37],[0,.11],[.12,.01],[.51,0],[.90,.01],[1,.10],[1,.44],[1,.87]];
      parts.push(welt(tint(pants,1.21),piping.map(([u,v])=>pocket(u,v,.0015)),.0017,14,4));
      const seam = [-.86,-.78,-.68,-.57,-.49,-.42,-.34,-.27].map(y=>cloth(y,side<0 ? Math.PI+.25 : -.25,.0018));
      parts.push(welt(tint(pants,1.12),seam,.0017,13,4));
      return parts;
    }
    function courierBoot(side) {
      const profiles = [[-.080,.061,.122,.045],[-.074,.065,.129,.047],[-.061,.066,.132,.047],
        [-.045,.064,.130,.046],[-.030,.063,.126,.043],[-.011,.060,.116,.037],
        [.010,.057,.093,.024],[.026,.054,.078,.015],[.047,.051,.066,.003],[.078,.046,.056,-.002]];
      function last(y,a,raise=0) {
        const [,w,d,z]=sampleProfile(profiles,y);
        const c=Math.cos(a),s=Math.sin(a);
        const toe=Math.max(0,s);
        const arch=bell((s+.14)/.38)*Math.max(0,-side*c);
        return [.004*side*toe+(w*(1-.16*arch)+raise)*softCorner(c,.77),y,z+(d+raise)*softCorner(s,.82),.92+.10*toe];
      }
      const parts=[
        roundSculpt('#3b3933',profiles.slice(3).map(r=>r[0]),22,(y,a)=>last(y,a)),
        roundSculpt('#242b27',[-.080,-.076,-.068,-.061,-.057],24,(y,a)=>last(y,a,.0017)),
        roundSculpt('#968b70',[-.057,-.053,-.046,-.041],24,(y,a)=>last(y,a,.0017)),
      ];
      const heel=(u,v)=>last(lerp(-.035,.053,v),-Math.PI/2+(u-.5)*1.82,.0025);
      parts.push(clothPanel('#645a45',10,4,[0,0,-1],heel));
      parts.push(welt('#8b8064',Array.from({length:9},(_,i)=>heel(i/8,.87)),.0016,11,4));
      for (const s of split) {
        parts.push(clothPanel('#5a5648',7,4,[s,0,0],(u,v)=>{
          const ang=(s<0?Math.PI:0)+s*lerp(-.44,.91,u);
          return last(lerp(-.028,.035-.043*u,v),ang,.0023);
        }));
      }
      function shoeTop(x,z,raise=0){
        let lower=-.037, upper=.078;
        for(let i=0;i<11;i++){
          const y=(lower+upper)*.5;
          const [,w,d,center]=sampleProfile(profiles,y);
          const c=D.clamp(softCorner((x-side*.002)/w,1/.77),-.99,.99);
          const edge=center+d*softCorner(Math.sqrt(1-c*c),.82);
          if(edge>=z)lower=y;else upper=y;
        }
        return [x,(lower+upper)*.5+raise,z];
      }
      parts.push(clothPanel('#685f4e',7,6,[0,1,0],(u,v)=>shoeTop((u-.5)*lerp(.043,.058,v),lerp(.073,.139,v),.0018)));
      for (let j=0;j<4;j++) {
        const z=.077+j*.0135;
        const w=.029+j*.0011;
        parts.push(welt('#ad9f7f',[shoeTop(-w,z,.0028),shoeTop(0,z+.007,.0047),shoeTop(w,z+.011,.0028)],.0025,6,4));
      }
      parts.push(welt('#80755b',Array.from({length:7},(_,i)=>shoeTop((i-3)*.012,.145-.012*Math.abs(i-3)/3,.0016)),.0017,9,4));
      parts.push(welt('#857552',[[0,.018,-.070],[0,.055,-.066],[0,.076,-.055],[0,.069,-.049]],.004,7,5));
      return parts;
    }

    function hairShell(color, crop) {
      const facets = 12;
      const rings = [
        [.206, .102, .109, .014], [.258, .105, .112, .009], [.301, .088, .099, .006],
        [.326, .055, .074, .007], [.331, .018, .027, .011],
      ];
      const vertices = [];
      const indices = [];
      for (const [row, [y, w, d, front]] of rings.entries()) {
        for (let column = 0; column < facets; column++) {
          const angle = column / facets * Math.PI * 2;
          const wave = Math.sin(angle);
          const hairline = row === 0 ? .057 * wave - crop * Math.max(0, -wave) : 0;
          const part = (row > 0 && row < 4 ? crop * Math.sin(angle * 2 + row) * .19 : 0);
          vertices.push([w * Math.cos(angle), y + hairline + part, d * wave + front]);
          if (!row) continue;
          const a = (row - 1) * facets + column;
          const b = (row - 1) * facets + (column + 1) % facets;
          indices.push(a, a + facets, b + facets, a, b + facets, b);
        }
      }
      const top = vertices.length - facets;
      for (let i = 1; i < facets - 1; i++) indices.push(top, top + i + 1, top + i);
      return coloredPart(surface(vertices, indices), color);
    }

    function faceParts(skin, style) {
      const face = [
        contoured(tint(skin, .89), [[-.025, .061, .064], [.014, .059, .061], [.102, .075, .078, .012]], 10),
        contoured(skin, [[.061, .053, .064, .031, .81], [.098, .079, .085, .025, .92], [.145, .100, .105, .019],
          [.182, .104, .100, .014], [.226, .097, .102, .015], [.272, .085, .094, .014], [.305, .065, .079, .011],
          [.320, .024, .040, .012]], 14),
        contoured(tint(skin, 1.04), [[.124, .018, .015, .113], [.139, .022, .019, .130], [.156, .018, .023, .124], [.19, .010, .012, .115]], 8),
        sewn(tint(skin, .52), 0, .103, .107, .044, .007, .012),
      ];
      for (const side of split) {
        face.push(coloredPart(round, tint(skin, .92), side * .100, .155, .019, .032, .061, .039, side * .13, side * -.13));
        face.push(coloredPart(round, tint(skin, .71), side * .113, .158, .026, .012, .033, .020));
        face.push(sewn(tint(skin, .24), side * .044, .175, .107, .032, .008, .009, side * -.066, side * .27));
        face.push(sewn(tint(style.hair, 1.21), side * .046, .196, .108, .035, .008, .009, side * -.081, side * .27));
      }
      face.push(hairShell(style.hair, style.crop));
      return face;
    }

    function backpack(parts) {
      const canvas = '#524d49';
      const dark = '#3d3634';
      const flap = '#77716a';
      parts.push(
        contoured(dark, [[.149, .107, .055, -.161, .76], [.183, .149, .088, -.187], [.331, .148, .093, -.196],
          [.445, .134, .082, -.188], [.512, .078, .053, -.169, .89]], 12),
        contoured(canvas, [[.183, .085, .038, -.246], [.204, .134, .057, -.242], [.369, .131, .065, -.243],
          [.442, .111, .042, -.229], [.465, .071, .023, -.216]], 12),
        contoured(flap, [[.197, .085, .026, -.293, .86], [.221, .107, .034, -.294], [.284, .111, .034, -.291],
          [.315, .092, .026, -.290]], 10),
        sewn('#313830', .012, .288, -.327, .153, .009, .007, .043),
        sewn('#bdab83', -.058, .285, -.333, .026, .017, .010, -.17),
        sewn('#8b8982', 0, .402, -.287, .127, .021, .009),
        sewn(dark, 0, .500, -.190, .113, .045, .022, 0, 0, .22),
      );
      for (const side of split) {
        parts.push(sewn(dark, side * .141, .385, .143, .037, .288, .024, side * .112, 0, -.151));
        parts.push(sewn(dark, side * .129, .497, .091, .039, .174, .024, side * -.07, 0, -.63));
        parts.push(sewn('#81837a', side * .152, .337, .161, .043, .027, .013, side * .128));
      }
    }

    function coatParts(color, pants, style) {
      const cuff = tint(color, .63);
      const coat = [
        contoured(pants, [[-.076, .151, .104], [-.022, .179, .127], [.073, .184, .132], [.128, .166, .109]], 10),
        contoured(color, [[.073, .179, .133, .001, .61], [.114, .185, .137, .001, .74], [.168, .190, .141, .001, .98], [.244, .176, .132, .001],
          [.348, .184, .141, .008, 1.04], [.436, .207, .143, .009], [.514, .219, .132, .006, 1.05],
          [.562, .192, .114, .003], [.598, .115, .091, .012, .91]], 12),
        contoured(tint(color, .75), [[.551, .113, .104, .017], [.600, .121, .111, .019], [.659, .090, .083, .022]], 10),
        sewn(style.collar, 0, .522, .120, .086, .101, .012),
        sewn(cuff, 0, .332, .147, .009, .376, .011, -.019),
        sewn('#a5a599', -.005, .418, .155, .015, .022, .010),
      ];
      for (const side of split) {
        coat.push(sewn(tint(color, .64), side * .128, .225, .102, .012, .110, .010, side * -.42, side * .475));
        coat.push(sewn(tint(color, 1.18), side * .129, .246, .106, .014, .009, .008, side * -.42, side * .475));
      }
      if (style.hood) {
        coat.push(contoured(tint(color, .73), [[.399, .078, .028, -.130], [.453, .123, .061, -.131],
          [.504, .114, .068, -.120], [.554, .110, .063, -.100], [.590, .082, .048, -.094]], 10));
      }
      if (style.bag) backpack(coat);
      return coat;
    }
    const thigh = .444;
    const shin = .427;
    const hipHeight = .921;
    const actorBounds = new T.Sphere(new T.Vector3(0, .9, 0), 1.16);
    let people = 0;
    let courierFabric;
    function courierMaterial() {
      if (courierFabric) return courierFabric;
      const size = 128;
      const pixels = new Uint8Array(size*size*4);
      let random = 23781;
      for (let y=0;y<size;y++) for (let x=0;x<size;x++) {
        random = (Math.imul(random,1664525)+1013904223)>>>0;
        const noise = random/4294967296-.5;
        const row = Math.floor(y/3);
        const twill = Math.cos((x*32/size+row/4)*Math.PI*2);
        const nap = Math.sin(2*Math.PI*(x/32+y/64))*.5 + Math.cos(2*Math.PI*(x/16-y/32))*.5;
        const o=(y*size+x)*4;
        pixels[o]=128+noise*43+twill*31+nap*16;
        pixels[o+1]=128+noise*57+.50*twill*25+nap*23;
        pixels[o+2]=128+noise*32+nap*9;
        pixels[o+3]=255;
      }
      const weave = new T.DataTexture(pixels,size,size);
      weave.wrapS = weave.wrapT = T.RepeatWrapping;
      weave.magFilter = T.LinearFilter;
      weave.minFilter = T.LinearMipmapLinearFilter;
      weave.generateMipmaps = true;
      weave.needsUpdate = true;
      courierFabric = fabric.clone();
      // Sample in bind-pose coordinates so the grain stays sewn to animated limbs.
      // Mipmaps filter the weave out at normal chase-camera distances.
      courierFabric.onBeforeCompile = shader => {
        skinClothes(shader);
        shader.uniforms.courierWeave = { value:weave };
        const vary = 'varying vec3 vCourierPoint; varying vec3 vCourierNormal; varying float vCourierSurface;';
        shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nattribute float courierSurface;\n'+vary)
          .replace('#include <begin_vertex>', '#include <begin_vertex>\nvCourierPoint=position; vCourierNormal=normal; vCourierSurface=courierSurface;');
        shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nuniform sampler2D courierWeave;\n'+vary)
          .replace('#include <color_fragment>', `#include <color_fragment>
            vec3 axis = pow(abs(normalize(vCourierNormal)),vec3(4.));
            axis /= max(dot(axis,vec3(1.)),.001);
            vec3 clothUV = vCourierPoint*8.;
            vec3 fibres = axis.x*texture2D(courierWeave,clothUV.zy).rgb
              + axis.y*texture2D(courierWeave,clothUV.xz).rgb
              + axis.z*texture2D(courierWeave,clothUV.xy).rgb;
            float dyed = vCourierSurface < .5 ? (fibres.r-.5)*.68
              : vCourierSurface < 1.5 ? (fibres.g-.5)*.79 : (fibres.b-.5)*.28;
            if(vCourierSurface>2.5){
              float azimuth=atan(vCourierPoint.z-.024,vCourierPoint.x+.003);
              float crown=clamp((vCourierPoint.y-1.64)/.232,0.,1.);
              float strands=81.*azimuth-68.*crown+3.5*sin(3.*azimuth-5.*crown);
              dyed += .10*sin(strands)*(1.-smoothstep(.5,2.3,fwidth(strands)));
            }
            diffuseColor.rgb *= 1.+dyed;
          `)
          .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
            if(vCourierSurface>.5) roughnessFactor = (vCourierSurface>2.5 ? .72 : vCourierSurface>1.5 ? .78 : .80)
              + (fibres.g-.5)*.12;
          `);
      };
      courierFabric.customProgramCacheKey = ()=>'courier-weave-v1';
      return courierFabric;
    }
    function bindCharacter(rig, clothes, casts) {
      rig.updateMatrixWorld(true);
      const bones = [];
      const indices = new Map();
      rig.traverse(bone => {
        if (bone === rig) return;
        indices.set(bone, bones.length);
        bones.push(bone);
      });
      const parts = clothes.flatMap(({ bone, pieces, joint, flex }) => {
        const skin = { primary: indices.get(bone) };
        if (joint) {
          const center = joint.matrixWorld.elements[13];
          skin.secondary = indices.get(joint);
          skin.weight = y => 1 - T.MathUtils.smoothstep(y, center - flex, center + flex);
        }
        return pieces.map(part => ({ ...part, matrix: part.matrix.premultiply(bone.matrixWorld), skin }));
      });
      const geometry = coloredGeometry(parts);
      if (casts) {
        const kinds = new Uint8Array(geometry.attributes.position.count);
        let offset=0;
        for(const part of parts){
          const end=offset+part.geometry.attributes.position.count;
          kinds.fill(part.surfaceKind??0,offset,end);
          offset=end;
        }
        geometry.setAttribute('courierSurface',new T.Uint8BufferAttribute(kinds,1));
      }
      const character = new T.SkinnedMesh(geometry, casts ? courierMaterial() : fabric);
      character.add(...rig.children.slice());
      character.bind(new T.Skeleton(bones));
      character.boundingSphere = actorBounds;
      character.receiveShadow = true;
      character.castShadow = casts;
      return character;
    }

    function person(color, pants, skin, player = false) {
      const root = new T.Group();
      const rig = new T.Group();
      const upper = new T.Bone();
      const chest = new T.Bone();
      upper.position.y = hipHeight;
      rig.add(upper);
      upper.add(chest);
      const style = outfits[(people + Math.floor(people / outfits.length)) % outfits.length];
      const cuffs = tint(color, .60);
      const clothes = [];
      function garment(bone, pieces, joint, flex) {
        clothes.push({ bone, pieces, joint, flex });
      }
      const head = new T.Bone();
      head.position.set(0, .602, .015);
      chest.add(head);
      garment(head, player ? courierHead(skin) : faceParts(skin, style));
      garment(chest, player ? courierJacket(color, pants) : coatParts(color, pants, style));
      const limbs = [];
      for (const side of split) {
        const hip = new T.Bone();
        const knee = new T.Bone();
        const boot = new T.Bone();
        hip.position.set(side * .103, hipHeight, 0);
        knee.position.y = -thigh;
        boot.position.y = -shin;
        rig.add(hip);
        hip.add(knee);
        knee.add(boot);
        const leg = player ? courierTrousers(pants, side) : [
          contoured(pants, [[-.887, .046, .050, .005, .78], [-.801, .050, .055, .002, .86], [-.655, .060, .066, -.012, .91],
            [-.543, .062, .068, -.010, .92], [-.465, .066, .070, -.002, .91], [-.424, .068, .072, .002, .95],
            [-.349, .070, .078, .006, .94], [-.244, .078, .086], [-.119, .087, .091, -.006],
            [-.021, .096, .102, .001, 1.06], [.043, .084, .091]], 10),
          contoured(tint(pants, .76), [[-.871, .047, .052], [-.833, .050, .054]], 9),
        ];
        garment(hip, leg, knee, .111);
        if (!player) garment(hip, [
          sewn(tint(pants, .64), side * .083, -.116, .008, .010, .14, .008, side * -.063),
        ]);
        garment(boot, player ? courierBoot(side) : [
          contoured(style.shoe, [[-.063, .058, .120, .052, .82], [-.041, .065, .127, .049], [-.016, .061, .121, .045],
            [.018, .058, .108, .039], [.054, .051, .071, .008], [.071, .048, .053, .005]], 10),
          contoured('#232822', [[-.080, .061, .126, .049], [-.068, .066, .131, .048], [-.053, .066, .131, .048]], 10),
          contoured('#8a8678', [[-.052, .064, .130, .049], [-.039, .064, .129, .049]], 10),
          ...[.045, .068, .089].map((z, i) => block('#76776c', 0, .033 - i * .011, z, .064 - i * .008, .006, .008, 0, .23 * (i % 2 ? -1 : 1))),
        ]);
        const arm = new T.Bone();
        const elbow = new T.Bone();
        arm.position.set(side * .22, .505, .025);
        elbow.position.y = -.277;
        chest.add(arm);
        arm.add(elbow);
        garment(arm, player ? courierSleeve(color, side) : [contoured(color, [[-.521, .040, .044, .002, .76], [-.467, .045, .049, -.004, .88],
          [-.387, .052, .056, -.005, .93], [-.328, .055, .060, -.004, .94], [-.283, .055, .061, -.003, .93],
          [-.241, .059, .064], [-.151, .066, .067], [-.069, .071, .073, .004, 1.09], [.004, .071, .071],
          [.048, .042, .049]], 10)], elbow, .084);
        if (!player) garment(arm, [
          sewn(tint(color, 1.16), side * .064, -.076, -.013, .020, .031, .063, side * -.084),
        ]);
        garment(elbow, player ? courierHand(skin, cuffs, side) : [
          contoured(cuffs, [[-.247, .046, .050], [-.206, .049, .051]]),
          contoured(tint(skin, .95), [[-.329, .024, .022, .009, .81], [-.313, .033, .026, .008], [-.282, .038, .030, .004],
            [-.244, .028, .027]], 8),
          coloredPart(round, skin, -side * .025, -.291, .015, .022, .045, .031, side * .12),
        ]);
        limbs.push({ arm, elbow, hip, knee, boot, side });
      }
      const detail = bindCharacter(rig, clothes, player);
      let distant = null;
      if (player) root.add(detail);
      else {
        const lod = new T.LOD();
        lod.addLevel(detail, 0);
        const silhouette = [
          contoured(color, [[.97, .166, .111], [1.29, .190, .125], [1.48, .176, .105]], 6),
          block(pants, 0, .896, 0, .322, .181, .224),
          contoured(skin, [[1.55, .056, .065], [1.65, .086, .091], [1.76, .087, .097]], 6),
          contoured(style.hair, [[1.72, .091, .102], [1.81, .080, .097], [1.844, .038, .048]], 6),
        ];
        for (const side of split) {
          silhouette.push(block(pants, side * .090, .476, -.012, .131, .861, .139));
          silhouette.push(sewn(color, side * .205, 1.133, .015, .099, .52, .102, -side * .117));
          silhouette.push(block(style.shoe, side * .090, .066, .035, .13, .108, .198));
        }
        if (style.bag) silhouette.push(block('#5e5b50', 0, 1.218, -.164, .217, .295, .168));
        distant = new T.Mesh(coloredGeometry(silhouette), fabric);
        lod.addLevel(distant, 26, .14);
        root.add(lod);
      }
      const shadow = mesh(root, decal, pedestrianShadow, 0, .009, 0, .92, 1, .97);
      scene.add(root);
      return { root, upper, chest, head, limbs, shadow, distant, player, proneRestHeight: style.bag ? .344 : .156,
        breath: 0, gait: (people++ * .367) % 1, stride: 0, crouch: 0, x: 0, z: 0, yaw: 0 };
    }
    function solveLeg(limb, pelvisY, pelvisZ, ankleY, ankleZ, ankleTilt) {
      const dy = pelvisY - ankleY;
      const dz = ankleZ - pelvisZ;
      const length = D.clamp(Math.hypot(dy, dz), .12, thigh + shin - .007);
      const hipOffset = Math.acos(D.clamp((thigh * thigh + length * length - shin * shin) / (2 * thigh * length), -1, 1));
      const bend = Math.PI - Math.acos(D.clamp((thigh * thigh + shin * shin - length * length) / (2 * thigh * shin), -1, 1));
      const hip = -Math.atan2(dz, dy) - hipOffset;
      limb.hip.rotation.x = hip;
      limb.knee.rotation.x = bend;
      limb.boot.rotation.x = ankleTilt - hip - bend;
    }
    function contactHeight(person) {
      if (person.groundY != null) return person.groundY;
      if (surfaceHeight) return surfaceHeight(person.x, person.z);
      const road = D.nearestRoad?.(person.x, person.z);
      if (!road) return .018;
      const gap = Math.hypot(person.x - road.x, person.z - road.z);
      if (gap < D.ROAD / 2) return .026;
      if (person.x > 297 || person.z > 304) return .207;
      if (person.x > -289 && person.x < 275 && person.z > -285 && person.z < 283 && gap > 11.2) return .196;
      return .008;
    }
    function poseStreetReaction(person) {
      const rig = person.distant.parent;
      const r = person.streetReaction;
      if (!r) {
        rig.position.set(0, 0, 0);
        rig.rotation.set(0, 0, 0);
        person.head.rotation.z = 0;
        for (const limb of person.limbs) limb.hip.rotation.z = 0;
        person.shadow.scale.set(.92, 1, .97);
        person.streetPose = null;
        return;
      }
      const flat = r.flat, brace = r.brace, rise = r.rise, side = r.side;
      const pack = person.proneRestHeight > .2 ? 1 : 0;
      const pitch = -1.54 * flat;
      rig.position.set(0, person.proneRestHeight * flat, -Math.sin(pitch) * hipHeight);
      rig.rotation.set(pitch, side * .12 * flat, side * (.045 * flat + .15 * brace));
      person.upper.position.y -= .10 * brace + .16 * rise;
      person.chest.rotation.x += .30 * brace - (.016 + .142 * pack) * flat + .72 * rise;
      person.chest.rotation.y += side * (.105 * flat + .24 * rise);
      person.head.rotation.x += .23 * brace - (.04 + .075 * pack) * flat - .26 * rise;
      person.head.rotation.z = side * (.12 * flat + .08 * rise);
      for (const limb of person.limbs) {
        const near = limb.side === side;
        limb.hip.position.y = person.upper.position.y;
        limb.hip.rotation.x = lerp(limb.hip.rotation.x, (near ? -.21 : -.045) + .13 * pack, flat) - .39 * brace - (near ? .95 : .48) * rise;
        limb.hip.rotation.z = limb.side * (.10 * flat + .07 * brace);
        limb.knee.rotation.x = lerp(limb.knee.rotation.x, (near ? .44 : .22) + .105 * pack, flat) + .52 * brace + 1.24 * rise;
        limb.boot.rotation.x = lerp(limb.boot.rotation.x, -.14, flat) - .16 * brace - .50 * rise;
        limb.arm.rotation.x = lerp(limb.arm.rotation.x, (near ? .30 : .24) + .39 * pack, flat) - .78 * brace - (near ? .78 : .34) * rise;
        limb.arm.rotation.z += limb.side * ((near ? .42 : .23) * flat + .66 * brace + .30 * rise);
        limb.elbow.rotation.x = lerp(limb.elbow.rotation.x, near ? -.38 : -.16, flat) - .61 * brace - .74 * rise;
      }
      person.shadow.scale.set(.92 + .22 * flat, 1, .97 + 1.28 * flat);
      person.streetPose = r;
    }
    function posePerson(person, dt, speed = 0, fleeing = false, crouching = false, eye = null) {
      const reaction = person.streetReaction;
      if (reaction?.kind === 'fatal' && reaction.flat === 1 && person.restingReaction === reaction) return;
      const blend = 1 - Math.exp(-11 * dt);
      person.stride = lerp(person.stride, speed, blend);
      person.crouch = lerp(person.crouch, crouching ? 1 : 0, blend);
      const low = person.crouch;
      const move = D.clamp(person.stride * .71, 0, 1);
      const run = D.clamp((person.stride - 2.8) / 4.5, 0, 1) * (1 - low);
      person.gait = (person.gait + dt * (.72 + person.stride * .241) * move) % 1;
      const phase = person.gait * Math.PI * 2;
      const contact = contactHeight(person);
      person.elevation = lerp(person.elevation ?? contact, contact, 1 - Math.exp(-23 * dt));
      person.root.position.set(person.x, person.elevation, person.z);
      person.root.rotation.y = person.yaw;
      if (person.distant) {
        person.distant.position.y = .024 * Math.sin(phase * 2) * move;
        person.distant.rotation.z = .047 * Math.sin(phase) * move;
        // The 26 m LOD already displays a rigid silhouette. Keep its gait and
        // elevation live and prepare the detailed joints before the switch back.
        if (eye && !reaction && !person.streetPose && (person.x - eye.x) ** 2 + (person.z - eye.z) ** 2 > 32 ** 2) return;
      }
      const pelvisY = hipHeight - .052 * run - .265 * low - move * (.019 + .017 * Math.cos(2 * phase));
      const pelvisZ = -.174 * low + .043 * run;
      person.upper.position.set(Math.sin(phase) * move * .022, pelvisY, pelvisZ);
      person.chest.rotation.set(.045 * move + .164 * run + .397 * low, Math.sin(phase) * move * (.11 + .08 * run), Math.cos(phase) * move * .041);
      person.head.rotation.x = -.1 * run - .262 * low;
      person.head.rotation.y = move < .15 ? .095 * Math.sin(person.gait * 2) : -.032 * Math.sin(phase);
      const rest = person.player ? (1 - move) * (1 - low) : 0;
      if (person.player) {
        person.breath = (person.breath + dt * 1.62) % (Math.PI * 2);
        const inhale = Math.sin(person.breath);
        person.upper.position.x += .012 * rest;
        person.chest.position.y = .0032 * inhale * (1 - run);
        person.chest.rotation.z += (.018 + inhale * .006) * rest;
        person.chest.rotation.y -= .037 * rest;
        person.head.rotation.y += (.075 + Math.sin(person.breath * .5) * .025) * rest;
        person.head.rotation.z = -.014 * rest;
      }
      for (const limb of person.limbs) {
        const stance = lerp(.61, .472, run) + low * .066;
        const swing = (person.gait + (limb.side === -1 ? .5 : 0)) % 1;
        const returnPhase = D.clamp((swing - stance) / (1 - stance), 0, 1);
        const crouchStride = lerp(.628 + .44 * run, .49, low) * move;
        const position = swing < stance ? .5 - swing / stance : -.5 + returnPhase * returnPhase * (3 - 2 * returnPhase);
        const step = Math.sin(returnPhase * Math.PI) * move;
        limb.hip.position.y = pelvisY;
        limb.hip.position.z = pelvisZ;
        solveLeg(limb, pelvisY, pelvisZ, .082 + step * (.113 + .141 * run - .039 * low),
          crouchStride * position + .023 * limb.side + low * .036, step * .185);
        const armPhase = Math.sin(phase + (limb.side === -1 ? Math.PI : 0));
        limb.arm.rotation.x = .016 + (.372 + .372 * run) * armPhase * move - .164 * low;
        limb.arm.rotation.z = limb.side * (.127 + .09 * Number(fleeing) + .113 * low);
        limb.elbow.rotation.x = -.154 - .51 * run - .39 * low - move * D.clamp(-armPhase, 0, 1) * .29;
        if (person.player) {
          limb.arm.rotation.x += limb.side * (.048 + .008 * Math.sin(person.breath)) * rest;
          limb.arm.rotation.z -= limb.side * .070 * rest;
          limb.arm.rotation.y = -limb.side * (.075 + .040 * move);
          limb.elbow.rotation.x -= (.051 - limb.side * .026) * (1 - run);
        }
      }
      if (person.distant) {
        if (reaction || person.streetPose) poseStreetReaction(person);
        person.restingReaction = reaction?.kind === 'fatal' && reaction.flat === 1 ? reaction : null;
      }
    }

    const skidMaterial = new T.MeshBasicMaterial({ color: '#182334', opacity: .48, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 });
    const skidMarks = new T.InstancedMesh(decal, skidMaterial, 250);
    skidMarks.count = 0;
    skidMarks.frustumCulled = false;
    scene.add(skidMarks);
    let skidIndex = 0;
    function skid(car, side, length) {
      const dx = Math.cos(car.yaw);
      const dz = -Math.sin(car.yaw);
      dummy.position.set(car.x + dx * side * .93 + dz * 1.31, .039, car.z + dz * side * .93 - dx * 1.31);
      dummy.rotation.set(0, Math.atan2(car.vx, car.vz), 0);
      dummy.scale.set(.165, 1, length);
      dummy.updateMatrix();
      skidMarks.setMatrixAt(skidIndex, dummy.matrix);
      skidIndex = (skidIndex + 1) % skidMarks.instanceMatrix.count;
      skidMarks.count = Math.max(skidMarks.count, skidIndex);
      skidMarks.instanceMatrix.needsUpdate = true;
    }
    const points = new Float32Array(140 * 3);
    const colors = new Float32Array(points.length);
    const cloud = new T.BufferGeometry();
    cloud.setAttribute('position', new T.BufferAttribute(points, 3).setUsage(T.DynamicDrawUsage));
    cloud.setAttribute('color', new T.BufferAttribute(colors, 3).setUsage(T.DynamicDrawUsage));
    cloud.setDrawRange(0, 0);
    const puff = new T.Points(cloud, new T.PointsMaterial({ vertexColors: true, size: .56, map: glow, transparent: true, depthWrite: false, alphaTest: .07, opacity: .68 }));
    puff.frustumCulled = false;
    scene.add(puff);
    const particles = [];
    const smokeColor = new T.Color('#b8b8a7');
    const sparkColor = new T.Color('#ffb55e');
    const boostColor = new T.Color('#72dedf');
    function particlesAt(x, y, z, kind, count) {
      const current = kind === 'spark' ? sparkColor : kind === 'boost' ? boostColor : smokeColor;
      for (let i = 0; i < count; i++) {
        if (particles.length >= 140) particles.shift();
        const life = kind === 'spark' ? .21 + Math.random() * .37 : .28 + Math.random() * .48;
        particles.push({ x: x + (Math.random() - .5) * .51, y, z: z + (Math.random() - .5) * .51,
          vx: (Math.random() - .5) * (kind === 'spark' ? 10 : 3), vy: Math.random() * 2.3,
          vz: (Math.random() - .5) * (kind === 'spark' ? 10 : 3), time: life, life, color: current });
      }
    }
    function updateParticles(dt) {
      let count = 0;
      for (const item of particles) {
        item.time -= dt;
        if (item.time <= 0) continue;
        item.x += item.vx * dt;
        item.z += item.vz * dt;
        item.y += item.vy * dt;
        particles[count] = item;
        const index = 3 * count++;
        points[index] = item.x;
        points[index + 1] = item.y;
        points[index + 2] = item.z;
        const alpha = Math.sqrt(item.time / item.life);
        colors[index] = item.color.r * alpha;
        colors[index + 1] = item.color.g * alpha;
        colors[index + 2] = item.color.b * alpha;
      }
      particles.length = count;
      cloud.setDrawRange(0, count);
      cloud.attributes.position.needsUpdate = true;
      cloud.attributes.color.needsUpdate = true;
    }

    function lighting(night) {
      skyLight.value = 1 - night * .68;
      frontLight.emissiveIntensity = .58 + night * 2.15;
      backLight.emissiveIntensity = .74 + night * 1.15;
      heroHeadLight.color.setScalar(.86 + night * 2.95);
      heroTailLight.color.setScalar(1.10 + night * 1.65);
      headWash.opacity = .16 + night * .46;
      tailWash.opacity = .08 + night * .30;
      headHaloMat.opacity = .14 + night * .64;
      tailHaloMat.opacity = .12 + night * .52;
      brakeHaloMat.opacity = .44 + night * .46;
    }
    return { car, paint, poseCar, person, posePerson, lighting, particlesAt, updateParticles, skid };
  }

  function createAudio() {
    const Context = window.AudioContext ?? window.webkitAudioContext;
    const tracks = [
      { name: '港湾 FM', bpm: 111, notes: [42, 42, 54, 42, 45, 45, 57, 45, 40, 40, 52, 40, 38, 38, 50, 40], lead: [66, 69, 73, 69, 64, 68, 71, 68] },
      { name: '午夜短波', bpm: 127, notes: [36, 36, 48, 39, 43, 43, 55, 43, 34, 34, 46, 34, 41, 41, 53, 39], lead: [60, 67, 70, 67, 65, 63, 70, 72] },
    ];
    let ctx, master, engine, sub, engineVolume, filter, siren, sirenVolume;
    let enabled = true;
    let station = -1;
    let nextBeat = 0;
    let step = 0;
    const midi = note => 440 * 2 ** ((note - 69) / 12);
    function start() {
      if (!Context) return;
      if (!ctx) {
        try {
          ctx = new Context();
          master = ctx.createGain();
          master.gain.value = enabled ? .28 : 0;
          master.connect(ctx.destination);
          engineVolume = ctx.createGain();
          engineVolume.gain.value = 0;
          filter = ctx.createBiquadFilter();
          filter.type = 'lowpass';
          filter.frequency.value = 110;
          engine = ctx.createOscillator();
          engine.type = 'sawtooth';
          sub = ctx.createOscillator();
          sub.type = 'triangle';
          engine.connect(filter);
          sub.connect(filter);
          filter.connect(engineVolume);
          engineVolume.connect(master);
          engine.start();
          sub.start();
          siren = ctx.createOscillator();
          siren.type = 'triangle';
          sirenVolume = ctx.createGain();
          sirenVolume.gain.value = 0;
          siren.connect(sirenVolume).connect(master);
          siren.start();
        } catch {
          ctx = undefined;
          return;
        }
      }
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    }
    function setEnabled(value) {
      enabled = value;
      if (master) master.gain.setTargetAtTime(value ? .28 : 0, ctx.currentTime, .05);
    }
    function tone(freq, duration, volume, shape, startAt = ctx?.currentTime, endFreq = freq) {
      if (!ctx || !enabled) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const startTime = Math.max(ctx.currentTime, startAt);
      osc.type = shape;
      osc.frequency.setValueAtTime(freq, startTime);
      osc.frequency.exponentialRampToValueAtTime(endFreq, startTime + duration);
      gain.gain.setValueAtTime(.001, startTime);
      gain.gain.exponentialRampToValueAtTime(volume, startTime + .013);
      gain.gain.exponentialRampToValueAtTime(.001, startTime + duration);
      osc.connect(gain).connect(master);
      osc.start(startTime);
      osc.stop(startTime + duration + .02);
    }
    function toggleStation() {
      station = station === tracks.length - 1 ? -1 : station + 1;
      nextBeat = 0;
      step = 0;
      return tracks[station]?.name ?? '';
    }
    function tick(state) {
      if (!ctx) return;
      const moment = ctx.currentTime;
      const speed = state.car?.speed ?? 0;
      const atSea = state.car?.type === 'boat';
      const isDriving = !state.paused && state.car;
      engine.frequency.setTargetAtTime(atSea ? 30 + speed * 2.8 + (state.throttle ? 12 : 0)
        : 38 + (speed % 14) * 3.8 + (state.throttle ? 9 : 0), moment, .11);
      sub.frequency.setTargetAtTime(24 + speed * (atSea ? 1.48 : 1.14), moment, .12);
      engineVolume.gain.setTargetAtTime(isDriving ? .13 + D.clamp(speed / 45, 0, 1) * .20 : 0, moment, .08);
      filter.frequency.setTargetAtTime(110 + speed * (atSea ? 11 : 7.1) + (state.throttle ? 64 : 0), moment, .10);
      const alarm = .5 + .5 * Math.sin(state.clock * Math.PI * 2 * .83);
      siren.frequency.setTargetAtTime(510 + alarm * 415, moment, .08);
      const sirenGain = state.paused || !state.heat ? 0 : D.clamp(1 - state.policeDistance / 112, 0, 1) * .095;
      sirenVolume.gain.setTargetAtTime(sirenGain, moment, .11);
      if (!isDriving || station < 0 || !enabled) {
        nextBeat = 0;
        return;
      }
      const track = tracks[station];
      const length = 30 / track.bpm;
      if (nextBeat < moment - .1) nextBeat = moment + .015;
      while (nextBeat <= moment + .13) {
        tone(midi(track.notes[step % 16]), length * .94, .15, 'triangle', nextBeat);
        if (step % 4 === 0) tone(138, .15, .24, 'sine', nextBeat, 38);
        if (step % 4 === 2) tone(375, .08, .048, 'triangle', nextBeat, 95);
        if (step % 2) tone(midi(track.lead[Math.floor(step / 2) % 8]), length * .83, .040, 'sine', nextBeat);
        step++;
        nextBeat += length;
      }
    }
    return { start, tick, toggleStation, setEnabled,
      nudge: () => tone(75, .17, .55, 'triangle', ctx?.currentTime, 37),
      note: () => { tone(490, .16, .15, 'sine'); if (ctx) tone(740, .22, .13, 'sine', ctx.currentTime + .08); },
      complete: () => { if (ctx) [52, 59, 64, 68].forEach((key, i) => tone(midi(key), .43, .18, 'triangle', ctx.currentTime + i * .10)); },
    };
  }

  Object.assign(D, { CARS, PATROL, makeFactory, createAudio });
})();
