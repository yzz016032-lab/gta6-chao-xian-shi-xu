(() => {
  'use strict';
  const T = window.THREE;
  const D = window.Tideline;
  const waterY = -.47;
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const utilityProfile = [
    [-3.78, .94, .64, -.53], [-3.56, 1.16, .64, -.66], [-2.80, 1.33, .62, -.71],
    [-1.67, 1.39, .60, -.76], [-.44, 1.42, .61, -.77], [.78, 1.39, .66, -.76],
    [1.84, 1.23, .74, -.64], [2.79, .93, .85, -.46], [3.49, .53, .96, -.28],
    [3.84, .218, 1.01, -.08], [3.98, .045, 1.025, .20],
  ];
  const sportProfile = [
    [-3.91, .94, .51, -.43], [-3.68, 1.19, .53, -.53], [-3.03, 1.32, .54, -.59],
    [-1.86, 1.38, .56, -.66], [-.49, 1.38, .59, -.68], [.83, 1.28, .62, -.66],
    [2.01, 1.05, .67, -.57], [2.97, .74, .73, -.37], [3.60, .43, .82, -.19],
    [3.93, .15, .91, .035], [4.04, .044, .93, .28],
  ];

  function makeBoatArt(scene) {
    const box = new T.BoxGeometry(1, 1, 1);
    const tube = new T.CylinderGeometry(.5, .5, 1, 8);
    const ball = new T.SphereGeometry(.5, 10, 7);
    const tire = new T.TorusGeometry(.5, .109, 5, 14);
    const wheel = new T.TorusGeometry(.46, .04, 6, 16);
    const rounded = new T.BoxGeometry(1, 1, 1, 3, 3, 3);
    const workMat = new T.Object3D();
    const vertex = new T.Vector3();
    const core = new T.Vector3();
    const standard = new T.MeshStandardMaterial({ vertexColors: true, roughness: .62, metalness: .18 });
    const enamel = new T.MeshStandardMaterial({ vertexColors: true, roughness: .22, metalness: .34 });
    const glass = new T.MeshStandardMaterial({ vertexColors: true, roughness: .10, metalness: .32, side: T.DoubleSide });
    const daylight = { value: 1 };
    const fleet = [];

    function finish(material, reflection) {
      material.onBeforeCompile = shader => {
        shader.uniforms.boatDaylight = daylight;
        shader.fragmentShader = 'uniform float boatDaylight;\n' + shader.fragmentShader.replace('#include <opaque_fragment>', [
          'vec3 glossy = inverseTransformDirection(reflect(-normalize(vViewPosition),normal),viewMatrix);',
          'float skyline = smoothstep(-.13,.52,glossy.y);',
          'float rim = pow(1.-max(0.,dot(normal,normalize(vViewPosition))),3.0);',
          'vec3 reflected = mix(vec3(.025,.061,.089),vec3(.237,.355,.534),skyline);',
          'float dusk = pow(max(0.,dot(glossy,normalize(vec3(.37,.23,-.90)))),7.);',
          'reflected += vec3(.38,.155,.069)*dusk;',
          'outgoingLight += reflected*(.39+.51*rim)*boatDaylight*' + reflection + ';',
          '#include <opaque_fragment>',
        ].join('\n'));
      };
      material.customProgramCacheKey = () => 'boat-finish-' + reflection;
    }
    finish(enamel, '.38');
    finish(glass, '.94');

    const roundedPosition = rounded.getAttribute('position');
    const roundedNormal = rounded.getAttribute('normal');
    for (let i = 0; i < roundedPosition.count; i++) {
      vertex.fromBufferAttribute(roundedPosition, i);
      core.set(clamp(vertex.x, -.34, .34), clamp(vertex.y, -.34, .34), clamp(vertex.z, -.34, .34));
      vertex.sub(core).normalize();
      roundedNormal.setXYZ(i, vertex.x, vertex.y, vertex.z);
      vertex.multiplyScalar(.16).add(core);
      roundedPosition.setXYZ(i, vertex.x, vertex.y, vertex.z);
    }

    function part(list, color, position, size, geometry = box, rotation = [0, 0, 0]) {
      workMat.position.fromArray(position);
      workMat.scale.fromArray(size);
      workMat.rotation.set(...rotation, 'YXZ');
      workMat.updateMatrix();
      list.push({ geometry, color: new T.Color(color), matrix: workMat.matrix.clone() });
    }
    function rail(list, color, diameter, start, finish) {
      const from = new T.Vector3(...start);
      const to = new T.Vector3(...finish);
      const direction = to.clone().sub(from);
      workMat.position.copy(from).lerp(to, .5);
      workMat.scale.set(diameter, direction.length(), diameter);
      workMat.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), direction.normalize());
      workMat.updateMatrix();
      list.push({ geometry: tube, color: new T.Color(color), matrix: workMat.matrix.clone() });
    }
    function surface(list, color, points, indices) {
      const geometry = new T.BufferGeometry();
      geometry.setAttribute('position', new T.Float32BufferAttribute(points.flat(), 3));
      geometry.setIndex(indices);
      geometry.computeVertexNormals();
      part(list, color, [0, 0, 0], [1, 1, 1], geometry);
    }
    function glassPanel(list, color, a, b, c, d) {
      surface(list, color, [a, b, c, d], [0, 1, 2, 0, 2, 3]);
    }
    function merge(list, material, parent) {
      const vertices = [], normals = [], colors = [];
      const normal = new T.Vector3();
      const inverse = new T.Matrix3();
      for (const { geometry, color, matrix } of list) {
        const position = geometry.getAttribute('position');
        const direction = geometry.getAttribute('normal');
        const index = geometry.getIndex();
        inverse.getNormalMatrix(matrix);
        const count = index?.count ?? position.count;
        for (let i = 0; i < count; i++) {
          const at = index ? index.getX(i) : i;
          vertex.fromBufferAttribute(position, at).applyMatrix4(matrix);
          normal.fromBufferAttribute(direction, at).applyNormalMatrix(inverse);
          vertices.push(vertex.x, vertex.y, vertex.z);
          normals.push(normal.x, normal.y, normal.z);
          colors.push(color.r, color.g, color.b);
        }
      }
      const combined = new T.BufferGeometry();
      combined.setAttribute('position', new T.Float32BufferAttribute(vertices, 3));
      combined.setAttribute('normal', new T.Float32BufferAttribute(normals, 3));
      combined.setAttribute('color', new T.Float32BufferAttribute(colors, 3));
      const mesh = new T.Mesh(combined, material);
      parent.add(mesh);
      return mesh;
    }

    function hull(list, sport) {
      const rings = (sport ? sportProfile : utilityProfile).map(([z, w, top, keel]) => {
        const half = [[w * .55, keel + .135], [w * .88, top - .48], [w * .97, top - .37],
          [w, top - .161], [w * .994, top - .109], [w * .951, top - .065], [w * .881, top]];
        return [[0, keel, z], ...half.map(([x, y]) => [x, y, z]), ...half.slice().reverse().map(([x, y]) => [-x, y, z])];
      });
      const lower = sport ? '#1b2d38' : '#1f3b45';
      const color = sport ? '#d13e38' : '#1e6478';
      const side = sport ? '#e86851' : '#318490';
      const accent = sport ? '#f5d4aa' : '#f5a962';
      const fender = '#1e2f38';
      const edge = sport ? '#c4463d' : '#d6dac8';
      const deck = sport ? '#7d5b42' : '#5a6e67';
      const paints = [lower, lower, color, side, accent, fender, edge, deck, edge, fender, accent, side, color, lower, lower];
      for (let i = 0; i < paints.length; i++) {
        const points = [];
        const faces = [];
        for (let station = 0; station < rings.length; station++) {
          points.push(rings[station][i], rings[station][(i + 1) % paints.length]);
          if (!station) continue;
          const previous = (station - 1) * 2;
          faces.push(previous, previous + 1, previous + 3, previous, previous + 3, previous + 2);
        }
        surface(list, paints[i], points, faces);
      }
      for (const back of [true, false]) {
        const ring = back ? rings[0] : rings.at(-1);
        const center = [0, ring.reduce((sum, point) => sum + point[1], 0) / ring.length, ring[0][2]];
        const faces = [];
        for (let i = 0; i < ring.length; i++) {
          const next = (i + 1) % ring.length;
          faces.push(0, back ? next + 1 : i + 1, back ? i + 1 : next + 1);
        }
        surface(list, color, [center, ...ring], faces);
      }
    }
    const brightMetal = '#a6bbb9';
    const darkMetal = '#344d53';
    const charcoal = '#263843';

    function harborDetails({ finish, panes, inside }) {
      part(finish, '#c6c6b5', [0, 1.06, 1.08], [1.80, .45, .89], rounded);
      part(finish, '#c9d0c2', [0, 2.06, .24], [2.09, .19, 2.69], rounded);
      part(finish, '#3e6c68', [0, 2.148, .21], [1.73, .08, 2.33], rounded);
      part(finish, '#d78253', [0, 2.235, -.24], [.91, .18, 1.12], rounded);
      part(inside, charcoal, [0, 1.27, .81], [1.65, .10, .51], rounded);
      part(inside, '#aab6a0', [.36, .91, .13], [.44, .28, .51], rounded);
      part(inside, '#aab6a0', [.36, 1.105, -.083], [.44, .39, .14], rounded);
      part(inside, charcoal, [.36, 1.294, .66], [.32, .32, .107], wheel, [-.16, 0, 0]);
      rail(inside, '#c7bb98', .059, [.36, 1.16, .65], [.36, 1.41, .67]);
      part(inside, '#31577c', [-.25, 1.326, .76], [.38, .105, .07], rounded);
      part(inside, '#5a8580', [.19, 1.32, .77], [.16, .08, .06], rounded);
      for (const side of [-1, 1]) {
        const frontLower = [side * .90, 1.24, 1.49];
        const frontUpper = [side * .83, 1.969, 1.17];
        const rearUpper = [side * .93, 1.969, -.93];
        rail(inside, brightMetal, .055, frontLower, frontUpper);
        rail(inside, brightMetal, .052, [side * .89, .69, -.93], rearUpper);
        rail(inside, brightMetal, .045, rearUpper, frontUpper);
        const lowerCenter = [side * .029, 1.245, 1.505];
        const topCenter = [side * .024, 1.967, 1.176];
        glassPanel(panes, '#3f5964', lowerCenter, frontLower, frontUpper, topCenter);
        glassPanel(panes, '#304956', frontLower, [side * .915, 1.24, .59], [side * .87, 1.962, .50], frontUpper);
        rail(inside, darkMetal, .061, frontLower, [side * .925, 1.24, .52]);
        rail(inside, darkMetal, .055, [side * .89, 1.24, .54], [side * .863, 1.95, .50]);
        part(inside, '#52635a', [side * .92, .745, -1.74], [.40, .286, 1.59], rounded);
        part(inside, '#c7c2a8', [side * .90, .902, -1.75], [.49, .113, 1.66], rounded);
        part(inside, '#a2a794', [side * 1.139, .98, -1.74], [.14, .27, 1.62], rounded);
        for (const z of [-2.68, -.90, 2.64, 3.29]) {
          const x = side * (z > 3 ? .409 : z > 2 ? .851 : 1.18);
          rail(inside, brightMetal, .039, [x, z > 2 ? .81 : .58, z], [x, z > 2 ? 1.15 : 1.035, z]);
        }
        rail(inside, brightMetal, .043, [side * 1.18, 1.035, -2.68], [side * 1.18, 1.035, -.90]);
        rail(inside, brightMetal, .043, [side * .851, 1.15, 2.64], [side * .409, 1.15, 3.29]);
        rail(inside, brightMetal, .043, [side * .409, 1.15, 3.29], [0, 1.15, 3.54]);
        rail(inside, charcoal, .14, [side * 1.265, .37, -2.84], [side * 1.416, .44, -1.07]);
        part(finish, '#3b454b', [side * .49, .24, -3.80], [.44, .478, .31], rounded);
        part(finish, '#2a3943', [side * .49, .52, -3.78], [.47, .16, .38], rounded);
        part(inside, '#82928f', [side * .49, .14, -3.92], [.36, .046, .049]);
      }
      rail(inside, '#acb8a6', .047, [0, 1.245, 1.504], [0, 1.969, 1.175]);
      rail(inside, brightMetal, .051, [-.40, .98, 2.86], [.40, .98, 2.86]);
      part(inside, '#757d72', [0, .85, 2.71], [.61, .12, .54], rounded);
      rail(inside, brightMetal, .036, [-.909, 1.45, -.93], [-.68, 1.46, -.975]);
      part(inside, '#e48050', [-.68, 1.22, -.97], [.48, .48, .17], tire);
      part(inside, '#eee1bc', [-.68, 1.455, -1.025], [.10, .075, .079], rounded);
      part(inside, '#eee1bc', [-.68, .985, -1.025], [.10, .075, .079], rounded);
      rail(inside, brightMetal, .055, [0, 2.16, .12], [0, 2.65, .26]);
      rail(inside, brightMetal, .032, [-.23, 2.60, .24], [.23, 2.60, .24]);
      rail(inside, '#677971', .028, [-.68, 2.14, .89], [-.73, 2.96, .985]);
      // Compact marine radar dome & bow searchlight housing
      part(finish, '#eef1e6', [0, 2.34, .64], [.62, .22, .62], tube);
      part(inside, charcoal, [0, 1.09, 3.42], [.22, .16, .20], rounded);
    }

    function sportDetails({ finish, panes, inside }) {
      part(finish, '#ad453f', [0, .74, -2.36], [2.05, .29, 1.92], rounded, [.04, 0, 0]);
      part(finish, '#323940', [0, .904, -2.40], [1.12, .115, 1.62], rounded);
      part(finish, '#d3755d', [0, .743, 1.66], [1.64, .165, 1.51], rounded, [-.027, 0, 0]);
      part(finish, '#e8c2a2', [0, .873, 2.17], [.145, .018, 1.20], rounded, [-.063, 0, 0]);
      part(inside, '#343c41', [0, .81, .70], [1.97, .32, .54], rounded);
      part(inside, '#354248', [0, .709, -.37], [.237, .22, 1.42], rounded);
      part(inside, '#cabba3', [0, .798, -1.38], [1.73, .17, .474], rounded);
      part(inside, '#cabba3', [0, .979, -1.574], [1.68, .314, .146], rounded);
      const windshieldBottom = [[-1.023, .838, 1.20], [-.61, .875, 1.532], [0, .893, 1.666], [.61, .875, 1.532], [1.023, .838, 1.20]];
      const windshieldTop = [[-.94, 1.184, .868], [-.574, 1.353, 1.215], [0, 1.406, 1.326], [.574, 1.353, 1.215], [.94, 1.184, .868]];
      for (let i = 1; i < windshieldBottom.length; i++) {
        glassPanel(panes, '#3e555e', windshieldBottom[i - 1], windshieldBottom[i], windshieldTop[i], windshieldTop[i - 1]);
        rail(inside, '#92958c', .032, windshieldTop[i - 1], windshieldTop[i]);
        rail(inside, '#354147', .048, windshieldBottom[i - 1], windshieldBottom[i]);
      }
      for (const side of [-1, 1]) {
        part(inside, '#a69a83', [side * .53, .759, -.298], [.48, .20, .61], rounded);
        part(inside, '#d4c6ab', [side * .53, 1.008, -.59], [.47, .49, .166], rounded, [-.18, 0, 0]);
        part(inside, '#beaa8e', [side * .53, 1.025, -.485], [.29, .382, .088], rounded, [-.18, 0, 0]);
        part(inside, '#a95b4d', [side * .64, 1.014, -.43], [.045, .315, .040], rounded, [-.18, 0, 0]);
        part(inside, '#403e3a', [side * .98, .783, -.27], [.406, .106, 1.54], rounded);
        part(finish, '#d99275', [side * .52, .83, 1.454], [.22, .16, .268], rounded);
        rail(inside, '#b9b8ab', .036, [side * .84, .708, -1.69], [side * .91, .719, -2.02]);
        rail(inside, '#b9b8ab', .036, [side * .91, .719, -2.02], [side * .91, .719, -2.61]);
        for (const z of [-2.52, -2.72, -2.92]) part(inside, '#141e26', [side * .365, .964, z], [.30, .029, .095], rounded, [0, side * -.18, 0]);
        part(inside, '#53666a', [side * .46, .257, -3.89], [.29, .23, .229], tube, [Math.PI / 2, 0, 0]);
      }
      part(inside, '#242a30', [.45, 1.035, .57], [.31, .31, .102], wheel, [-.26, 0, 0]);
      rail(inside, '#b7a49d', .035, [.45, .89, .54], [.45, 1.148, .59]);
      part(inside, '#708e91', [.44, 1.071, .823], [.297, .08, .07], rounded);
      rail(inside, '#c0b3a6', .044, [-.20, .908, 3.03], [.20, .908, 3.03]);
      // Sleek swept-back sport wakeboard/radar arch & teak swim platform accent
      part(finish, '#9c714e', [0, .59, -3.54], [1.78, .07, .56], rounded);
      for (const side of [-1, 1]) {
        rail(inside, '#d8e0de', .052, [side * 1.12, .76, -.78], [side * .88, 1.82, -1.36]);
        rail(inside, '#2b363d', .038, [side * 1.10, .76, -1.24], [side * .88, 1.78, -1.36]);
      }
      rail(inside, '#d8e0de', .055, [-.88, 1.82, -1.36], [.88, 1.82, -1.36]);
      part(inside, charcoal, [0, .86, 3.42], [.18, .12, .18], rounded);
    }

    function helmsman(parent, sport) {
      const pilot = new T.Group();
      const shapes = [];
      const jacket = '#3d7980';
      const trim = '#688e8a';
      const skin = '#c89272';
      part(shapes, jacket, [0, .232, .016], [.399, .463, .276], rounded, [.17, 0, 0]);
      part(shapes, trim, [0, .395, -.023], [.286, .172, .329], ball);
      rail(shapes, skin, .112, [0, .409, .071], [0, .527, .093]);
      part(shapes, skin, [0, .563, .112], [.206, .257, .214], ball);
      part(shapes, '#3e3029', [0, .606, .082], [.211, .182, .201], ball);
      part(shapes, '#30474d', [0, .665, .124], [.215, .094, .227], ball);
      part(shapes, '#30474d', [0, .64, .234], [.183, .027, .139], rounded);
      for (const side of [-1, 1]) {
        const elbow = [side * .229, .211, .216];
        const hand = [side * .105, .322, .398];
        rail(shapes, jacket, .103, [side * .173, .339, .04], elbow);
        rail(shapes, trim, .091, elbow, hand);
        part(shapes, skin, hand, [.075, .075, .075], ball);
        rail(shapes, '#343b45', .136, [side * .101, .039, .031], [side * .128, -.027, .309]);
        rail(shapes, '#343b45', .124, [side * .128, -.027, .309], [side * .142, -.25, .347]);
        part(shapes, '#293135', [side * .142, -.255, .396], [.127, .088, .192], rounded);
      }
      pilot.position.set(sport ? .49 : .36, sport ? .80 : 1.01, sport ? -.33 : -.11);
      merge(shapes, standard, pilot);
      pilot.visible = false;
      parent.add(pilot);
      return pilot;
    }

    function signal(color) {
      return new T.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: .58, roughness: .28 });
    }
    const portLight = signal('#ff4d4d');
    const starboardLight = signal('#4ff2ba');
    const houseLight = signal('#ffe5ad');
    const bowLight = signal('#fff5db');
    const deckStripLight = signal('#7decf2');
    const beaconLight = signal('#ffac45');
    const haloGeo = new T.PlaneGeometry(1, 1);
    const haloCanvas = document.createElement('canvas');
    haloCanvas.width = haloCanvas.height = 64;
    const hCtx = haloCanvas.getContext('2d');
    const hGrad = hCtx.createRadialGradient(32, 32, 2, 32, 32, 32);
    hGrad.addColorStop(0, '#ffffffff');
    hGrad.addColorStop(.35, '#ffffffa8');
    hGrad.addColorStop(1, '#ffffff00');
    hCtx.fillStyle = hGrad;
    hCtx.fillRect(0, 0, 64, 64);
    const haloTex = new T.CanvasTexture(haloCanvas);
    const makeHaloMat = hex => new T.MeshBasicMaterial({
      color: hex, map: haloTex, transparent: true, depthWrite: false, opacity: .45, blending: T.AdditiveBlending, side: T.DoubleSide,
    });
    const portHaloMat = makeHaloMat('#ff4a4a');
    const starHaloMat = makeHaloMat('#45f0b8');
    const warmHaloMat = makeHaloMat('#ffdf9e');
    const bowWashGeo = new T.PlaneGeometry(3.8, 7.6).rotateX(-Math.PI / 2);
    const bowWashMat = new T.MeshBasicMaterial({
      color: '#ffe9b8', map: haloTex, transparent: true, depthWrite: false, opacity: .22, blending: T.AdditiveBlending,
    });
    function navLamp(parent, material, x, y, z, w, h, depth) {
      const lamp = new T.Mesh(ball, material);
      lamp.position.set(x, y, z);
      lamp.scale.set(w, h, depth);
      parent.add(lamp);
      return lamp;
    }
    function transomBadge(parent, sport) {
      const canvas = document.createElement('canvas');
      canvas.width = 256;
      canvas.height = 80;
      const graphic = canvas.getContext('2d');
      graphic.fillStyle = sport ? '#822f28' : '#17454d';
      graphic.fillRect(0, 0, 256, 80);
      graphic.fillStyle = sport ? '#ffdbbc' : '#e1e0c6';
      graphic.font = 'bold 31px "Microsoft YaHei", sans-serif';
      graphic.textAlign = 'center';
      graphic.textBaseline = 'middle';
      graphic.fillText(sport ? '飞潮' : '岬湾接驳', 128, 38);
      graphic.fillStyle = '#bbcebf';
      graphic.fillRect(17, 67, 222, 2);
      const map = new T.CanvasTexture(canvas);
      map.colorSpace = T.SRGBColorSpace;
      const plate = new T.Mesh(new T.PlaneGeometry(sport ? .80 : .51, sport ? .17 : .143), new T.MeshStandardMaterial({ map, roughness: .67 }));
      plate.position.set(0, sport ? .313 : .399, sport ? -3.917 : -3.787);
      plate.rotation.y = Math.PI;
      parent.add(plate);
    }

    const contactCanvas = document.createElement('canvas');
    contactCanvas.width = contactCanvas.height = 96;
    const contactGraphic = contactCanvas.getContext('2d');
    const contactEdge = contactGraphic.createRadialGradient(48, 48, 10, 48, 48, 47);
    contactEdge.addColorStop(0, '#ffffffaa');
    contactEdge.addColorStop(.48, '#ffffffaa');
    contactEdge.addColorStop(1, '#ffffff00');
    contactGraphic.fillStyle = contactEdge;
    contactGraphic.fillRect(0, 0, 96, 96);
    const contactMaterial = new T.MeshBasicMaterial({
      color: '#15384a', map: new T.CanvasTexture(contactCanvas), transparent: true, depthWrite: false, opacity: .58,
    });
    const contactPlane = new T.PlaneGeometry(3.47, 8.74).rotateX(-Math.PI / 2);

    function create(kind) {
      const sport = kind === 'sport';
      const root = new T.Group();
      root.position.y = waterY;
      const body = new T.Group();
      root.add(body);
      const contact = new T.Mesh(contactPlane, contactMaterial);
      contact.renderOrder = -1;
      root.add(contact);
      scene.add(root);
      const parts = { finish: [], inside: [], panes: [] };
      hull(parts.finish, sport);
      if (sport) sportDetails(parts);
      else harborDetails(parts);
      merge(parts.finish, enamel, body);
      merge(parts.inside, standard, body);
      merge(parts.panes, glass, body);
      const pPos = [sport ? .97 : 1.0, sport ? .91 : 2.088, sport ? 1.13 : 1.145];
      const sPos = [sport ? -.97 : -1.0, sport ? .91 : 2.088, sport ? 1.13 : 1.145];
      const hPos = [0, sport ? 1.87 : 2.681, sport ? -1.36 : .263];
      const bPos = [0, sport ? .86 : 1.09, 3.53];
      navLamp(body, portLight, ...pPos, .13, .086, .147);
      navLamp(body, starboardLight, ...sPos, .13, .086, .147);
      navLamp(body, houseLight, ...hPos, .118, .145, .118);
      navLamp(body, bowLight, ...bPos, .15, .11, .08);
      // Soft cockpit courtesy LED strip
      const strip = new T.Mesh(box, sport ? deckStripLight : houseLight);
      strip.position.set(0, sport ? .90 : 1.93, sport ? .68 : .28);
      strip.scale.set(sport ? 1.35 : 1.15, .028, .032);
      body.add(strip);
      // Nighttime additive glow halos + bow water reflection
      const halos = [];
      for (const [mat, pos, size] of [[portHaloMat, pPos, .62], [starHaloMat, sPos, .62], [warmHaloMat, hPos, .72], [warmHaloMat, bPos, .88]]) {
        const h = new T.Mesh(haloGeo, mat);
        h.position.set(pos[0], pos[1], pos[2] + (pos === bPos ? .04 : 0));
        h.scale.set(size, size, 1);
        body.add(h);
        halos.push(h);
      }
      const bowWash = new T.Mesh(bowWashGeo, bowWashMat);
      bowWash.position.set(0, .06, 6.2);
      root.add(bowWash);
      transomBadge(body, sport);
      const boat = { root, body, contact, halos, bowWash, pilot: helmsman(body, sport), deckY: sport ? .57 : .61, wakeTime: 0 };
      fleet.push(boat);
      return boat;
    }

    const wakeCapacity = 224;
    const wakeGeometry = new T.InstancedBufferGeometry();
    wakeGeometry.setAttribute('position', new T.Float32BufferAttribute([-.5, -.5, 0, .5, -.5, 0, .5, .5, 0, -.5, .5, 0], 3));
    wakeGeometry.setIndex([0, 1, 2, 0, 2, 3]);
    // The pool stores position, course, and birth data. The shader ages every mark in a single draw.
    const origins = new T.InstancedBufferAttribute(new Float32Array(wakeCapacity * 4), 4).setUsage(T.DynamicDrawUsage);
    const timing = new T.InstancedBufferAttribute(new Float32Array(wakeCapacity * 4), 4).setUsage(T.DynamicDrawUsage);
    wakeGeometry.setAttribute('origin', origins);
    wakeGeometry.setAttribute('timing', timing);
    const wakeUniforms = { clock: { value: 0 }, night: { value: 0 } };
    const wakeMaterial = new T.ShaderMaterial({
      uniforms: wakeUniforms, transparent: true, depthWrite: false, side: T.DoubleSide,
      vertexShader: [
        'attribute vec4 origin,timing;',
        'uniform float clock;',
        'varying vec2 shape;',
        'varying vec4 style;',
        'void main(){',
        '  float age = clock-timing.x;',
        '  float spray = step(.5,abs(timing.w));',
        '  float fade = step(0.,age)*pow(max(0.,1.-age/mix(3.1,.76,spray)),1.65);',
        '  vec2 ahead = origin.zw;',
        '  vec2 crosswind = vec2(ahead.y,-ahead.x);',
        '  vec2 middle = origin.xy;',
        '  vec3 world;',
        '  if(spray>.5){',
        '    middle += crosswind*timing.w*age*(1.6+timing.y*1.8);',
        '    middle -= ahead*age*(1.+timing.y*2.7);',
        '    float lift = sin(clamp(age/.76,0.,1.)*3.14159)*(.37+.63*timing.y);',
        '    world = vec3(middle.x,-.27+lift,middle.y);',
        '    vec3 right = vec3(viewMatrix[0][0],viewMatrix[1][0],viewMatrix[2][0]);',
        '    vec3 up = vec3(viewMatrix[0][1],viewMatrix[1][1],viewMatrix[2][1]);',
        '    world += right*position.x*(.62+age*2.16) + up*position.y*(.66+age*.81);',
        '  } else {',
        '    float width = 2.91 + age*(.69+4.42*timing.y);',
        '    float lengthwise = 1.03 + timing.y*1.87+age*.61;',
        '    middle += crosswind*position.x*width + ahead*(position.y*lengthwise-age*.28);',
        '    world = vec3(middle.x,-.444,middle.y);',
        '  }',
        '  shape = position.xy*2.;',
        '  float visibility = 1.-smoothstep(76.,158.,distance(world,cameraPosition));',
        '  style = vec4(timing.y,timing.z,spray,fade*visibility);',
        '  gl_Position = projectionMatrix*viewMatrix*vec4(world,1.);',
        '}',
      ].join('\n'),
      fragmentShader: [
        'varying vec2 shape;',
        'varying vec4 style;',
        'uniform float night;',
        'float salt(vec2 p){ vec3 a=fract(vec3(p.xyx)*vec3(.1031,.0973,.1099)); a+=dot(a,a.yzx+33.33); return fract((a.x+a.y)*a.z); }',
        'void main(){',
        '  float alpha;',
        '  float grit = salt(floor(shape*25.+style.y*41.));',
        '  if(style.z>.5){',
        '    float edge = 1.-smoothstep(.20,.99,length(shape*vec2(.89,1.)));',
        '    alpha = edge*(.069+grit*.30)*(.47+.53*style.x);',
        '  } else {',
        '    float bend = sin(shape.y*4.7+style.y*5.2)*.10;',
        '    float center = 1.-smoothstep(.13,.37,abs(shape.x-bend));',
        '    float crests = 1.-smoothstep(.043,.24,abs(abs(shape.x+bend*.5)-.68));',
        '    float edge = 1.-smoothstep(.39,1.,abs(shape.y));',
        '    float noise = .55 + sin(shape.y*25.2+shape.x*17.0+style.y*17.)*.13 + grit*.33;',
        '    alpha = edge*(center*.52+crests*.40)*noise*(.42+.58*style.x);',
        '  }',
        '  float intensity = alpha*style.w;',
        '  if(intensity<.004) discard;',
        '  vec3 foamColor = mix(vec3(.72,.85,.83),vec3(.22,.36,.48),night);',
        '  gl_FragColor = vec4(foamColor,intensity);',
        '  #include <tonemapping_fragment>',
        '  #include <colorspace_fragment>',
        '}',
      ].join('\n'),
    });
    const wake = new T.Mesh(wakeGeometry, wakeMaterial);
    wake.name = 'Marine wake';
    wake.frustumCulled = false;
    scene.add(wake);
    let cursor = 0;
    let lastStamp = -Infinity;
    function resetWake() {
      cursor = 0;
      lastStamp = -Infinity;
      wakeGeometry.instanceCount = 0;
      wake.visible = false;
      for (const boat of fleet) boat.wakeTime = 0;
    }
    resetWake();

    function stamp(x, z, fx, fz, clock, throttle, spray = 0) {
      origins.setXYZW(cursor, x, z, fx, fz);
      timing.setXYZW(cursor, clock, throttle, (cursor * .61803398875) % 1, spray);
      origins.needsUpdate = timing.needsUpdate = true;
      wakeGeometry.instanceCount = Math.max(wakeGeometry.instanceCount, cursor + 1);
      wake.visible = true;
      cursor = (cursor + 1) % wakeCapacity;
      lastStamp = clock;
    }

    function pose(boat, dt, clock, night, occupied) {
      const speed = Math.abs(boat.speed ?? 0);
      const pace = clamp(speed / 29, 0, 1);
      const phase = clock * 1.85 + boat.x * .073 + boat.z * .093;
      const heave = Math.sin(phase) * .068 + Math.sin(phase * .59 + 1.5) * .034;
      const steer = clamp(boat.steer ?? 0, -1, 1);
      const trim = clamp(boat.trim ?? 0, -.14, .14);
      const pitch = Math.sin(phase + .43) * .028 - .080 * pace - trim * .52;
      const bank = Math.cos(phase * .79) * .041 - steer * pace * .098;
      const easing = dt === 0 ? 1 : 1 - Math.exp(-7 * dt);
      boat.root.position.set(boat.x, waterY + heave + pace * .058, boat.z);
      boat.contact.position.y = waterY + .013 - boat.root.position.y;
      boat.root.rotation.y = boat.yaw;
      boat.body.rotation.x += (pitch - boat.body.rotation.x) * easing;
      boat.body.rotation.z += (bank - boat.body.rotation.z) * easing;
      boat.pilot.visible = Boolean(occupied);
      boat.pilot.rotation.z = steer * pace * .073;
      daylight.value = 1 - night * .80;
      portLight.emissiveIntensity = starboardLight.emissiveIntensity = .35 + night * 1.85;
      houseLight.emissiveIntensity = .42 + night * 1.65;
      bowLight.emissiveIntensity = .40 + night * 2.35;
      deckStripLight.emissiveIntensity = .30 + night * 1.45;
      portHaloMat.opacity = starHaloMat.opacity = .08 + night * .62;
      warmHaloMat.opacity = .08 + night * .56;
      bowWashMat.opacity = .04 + night * .30;
      const showNight = night > .18;
      if (boat.halos) for (const h of boat.halos) h.visible = showNight;
      if (boat.bowWash) boat.bowWash.visible = showNight && Boolean(occupied);
      wakeUniforms.clock.value = clock;
      wakeUniforms.night.value = night;
      if (wake.visible && (clock < lastStamp || clock - lastStamp > 3.18)) resetWake();
      if (speed < 1.7 || dt <= 0) {
        boat.wakeTime = 0;
        return;
      }
      boat.wakeTime -= dt;
      if (boat.wakeTime > 0) return;
      boat.wakeTime = .136 - pace * .091;
      const fx = Math.sin(boat.yaw);
      const fz = Math.cos(boat.yaw);
      const motion = Math.hypot(boat.vx ?? 0, boat.vz ?? 0);
      const courseX = motion > .72 ? boat.vx / motion : fx;
      const courseZ = motion > .72 ? boat.vz / motion : fz;
      const reverse = fx * courseX + fz * courseZ < -.15;
      const outlet = reverse ? -2.77 : -3.73;
      stamp(boat.x + fx * outlet, boat.z + fz * outlet, courseX, courseZ, clock, pace);
      if (speed < 7.1 || reverse) return;
      for (const side of [-1, 1]) {
        stamp(boat.x + fx * 2.60 + side * fz * .82, boat.z + fz * 2.60 - side * fx * .82, fx, fz, clock, pace, side);
      }
    }

    function makeBuoy(point) {
      const buoy = new T.Group();
      const shapes = [];
      const orange = '#d19149';
      const rust = '#975d36';
      part(shapes, charcoal, [0, .030, 0], [1.02, .248, 1.02], tube);
      part(shapes, '#efba5e', [0, .147, 0], [.94, .272, .94], tube);
      part(shapes, rust, [0, .325, 0], [.663, .246, .663], tube);
      part(shapes, '#e1a352', [0, .56, 0], [.339, .462, .339], tube);
      part(shapes, charcoal, [0, .846, 0], [.326, .110, .326], tube);
      part(shapes, brightMetal, [.10, .76, .083], [.61, .065, .358], rounded, [-.31, 0, .20]);
      part(shapes, '#385975', [.10, .791, .089], [.547, .051, .307], rounded, [-.31, 0, .20]);
      rail(shapes, orange, .052, [0, .773, 0], [0, 1.30, 0]);
      for (const direction of [-1, 1]) {
        rail(shapes, darkMetal, .030, [direction * .128, .893, 0], [direction * .128, 1.225, 0]);
        rail(shapes, darkMetal, .030, [0, .893, direction * .128], [0, 1.225, direction * .128]);
      }
      part(shapes, '#3d5051', [0, 1.202, 0], [.31, .073, .31], tube);
      merge(shapes, standard, buoy);
      const lamp = navLamp(buoy, beaconLight, 0, 1.081, 0, .211, .243, .211);
      const rings = new T.Mesh(new T.RingGeometry(.67, .704, 32).rotateX(-Math.PI / 2),
        new T.MeshBasicMaterial({ color: '#bcdfd5', opacity: .38, transparent: true, depthWrite: false }));
      rings.position.set(point.x, waterY + .029, point.z);
      scene.add(buoy, rings);
      const update = (visible, time) => {
        rings.visible = buoy.visible = visible;
        if (!visible) return;
        buoy.position.set(point.x, waterY + .068 * Math.sin(time * 1.93), point.z);
        buoy.rotation.set(Math.sin(time * 1.53) * .076, time * .43, Math.cos(time * 2.19) * .072);
        lamp.visible = Math.sin(time * 4.7) > -.38;
        beaconLight.emissiveIntensity = 1.20 + .89 * (1 - daylight.value);
        const ripple = time * .45 % 1;
        rings.scale.setScalar(1 + ripple * 1.55);
        rings.material.opacity = (1 - ripple) * .36;
      };
      update(false, 0);
      return update;
    }
    return { create, pose, makeBuoy, resetWake };
  }

  D.makeBoatArt = makeBoatArt;
})();
