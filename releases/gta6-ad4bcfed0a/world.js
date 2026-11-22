(() => {
  'use strict';

  const T = window.THREE;
  const X = [-300, -207, -111, -13, 88, 187, 286];
  const Z = [-296, -196, -97, 0, 100, 200, 294];
  const BOUNDS = { minX: -326, maxX: 339, minZ: -324, maxZ: 328 };
  const ROAD = 18;
  const JOBS = [
    { name: '夜班交接', type: '限时送件', place: '潮汛修车铺', x: 279.3, z: 126.2, reward: 420, detail: '替林鹭赶上货场的交班时间。' },
    { name: '回声货柜', type: '取件 / 追逐', place: '南埠货场', x: -105, z: 236, reward: 720, detail: '从货场取件，甩开追车再交货。' },
    { name: '环湾夜跑', type: '环线计时赛', place: '北桥起跑线', x: 291, z: -97, reward: 560, detail: '沿路穿过九道计时门，刷新个人纪录。' },
    { name: '雨夜断讯', type: '潜入 / 撤离', place: '南埠七码仓', x: -18, z: 257, reward: 1080, detail: '潜入有人值守的仓库取回录音，再穿过雨夜送到潮汛里。' },
    { name: '孤灯返航', type: '海上回收 / 登岛', place: '灯塔湾码头', x: 354, z: 208, reward: 1380, detail: '到海湾回收备用电源，登上岬灯岛恢复航标，再回码头报到。' },
  ];
  const HUB = { x: 294, z: 161, angle: Math.PI };
  const DELIVERY = { x: -108, z: 203, place: '南埠货场入口' };
  const STASH = { x: 92, z: -193, place: '北桥信号站' };
  const RACE = [
    { x: 290, z: -196 }, { x: 190, z: -196 }, { x: 88, z: -196 },
    { x: -13, z: -196 }, { x: -13, z: -97 }, { x: 88, z: -97 },
    { x: 88, z: 0 }, { x: 187, z: 0 }, { x: 286, z: 0 },
  ];
  const TAPES = [
    { x: 318, z: 272, name: '灯塔回波' }, { x: 323, z: 66, name: '沿岸慢速' },
    { x: 313, z: -156, name: '海面偏北' }, { x: 49, z: 49, name: '旧城公园实录' },
    { x: -177, z: 251, name: '吊机采样' }, { x: -251, z: -3, name: '凌晨小食档' },
    { x: -310, z: -147, name: '末班车' }, { x: 77, z: -250, name: '屋顶天线' },
    { x: 141, z: 305, name: '盐水留声' }, { x: -103, z: 74, name: '巷口频段' },
  ];

  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
  const angleDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));

  function rng(seed) {
    return () => {
      seed = (Math.imul(1664525, seed) + 1013904223) >>> 0;
      return seed / 4294967296;
    };
  }
  function nearest(values, pos) {
    return values.reduce((best, value) => Math.abs(value - pos) < Math.abs(best - pos) ? value : best);
  }
  function nearestRoad(x, z) {
    const nx = nearest(X, x);
    const nz = nearest(Z, z);
    return Math.abs(nx - x) < Math.abs(nz - z) ? { x: nx, z, axis: 'z' } : { x, z: nz, axis: 'x' };
  }
  function roadJunctions(p) {
    const vertical = p.axis === 'z';
    const values = vertical ? Z : X;
    const value = vertical ? p.z : p.x;
    const right = values.findIndex(v => v >= value);
    const pair = right < 0 ? [values.at(-1)] : right === 0 ? [values[0]] : [values[right - 1], values[right]];
    return pair.map(v => vertical ? { x: p.x, z: v } : { x: v, z: p.z });
  }
  function routeBetween(a, b) {
    const from = nearestRoad(a.x, a.z);
    const to = nearestRoad(b.x, b.z);
    if ((from.x === to.x && from.axis === 'z' && to.axis === 'z') ||
        (from.z === to.z && from.axis === 'x' && to.axis === 'x')) {
      return [from, to, b];
    }
    let shortest = Infinity;
    let route = [];
    for (const start of roadJunctions(from)) {
      for (const end of roadJunctions(to)) {
        const length = distance(from, start) + Math.abs(end.x - start.x) + Math.abs(end.z - start.z) + distance(end, to);
        if (length >= shortest) continue;
        shortest = length;
        const corner = to.axis === 'z' ? { x: end.x, z: start.z } : { x: start.x, z: end.z };
        route = [from, start, corner, end, to, b].filter((point, index, points) => !index || distance(point, points[index - 1]) > .1);
      }
    }
    return route;
  }
  function district(p) {
    if (window.Tideline.islandAccess?.(p.x, p.z) && p.type !== 'boat') return '岬灯岛';
    if (p.type === 'boat') return '白汐湾';
    if (p.x > 257) return '灯塔湾';
    if (p.z > 172) return '南埠货场';
    if (p.z < -108 && p.x > -170) return '北桥商务区';
    if (p.x > 154) return '潮汛里';
    return '旧城';
  }

  function finishBuild(steps) {
    let step = steps.next();
    while (!step.done) step = steps.next();
    return step.value;
  }
  function build(scene) {
    return finishBuild(buildSteps(scene));
  }
  function* buildSteps(scene, instancePaint = false) {
    const random = rng(48327);
    const range = (low, high) => low + random() * (high - low);
    const choose = values => values[Math.floor(random() * values.length)];
    const unit = new T.BoxGeometry(1, 1, 1);
    const plane = new T.PlaneGeometry(1, 1);
    const cylinder = new T.CylinderGeometry(.5, .5, 1, 10);
    const tapered = new T.CylinderGeometry(.31, .5, 1, 8);
    const lowSphere = new T.IcosahedronGeometry(.5, 1);
    const batches = new Map();
    const streetBatches = [];
    const closeStreetBatches = [];
    const dummy = new T.Object3D();
    const obstacles = new Map();
    const surfaces = new Map();
    const shelters = [];
    const contactCasters = [];
    const shadeSize = 384, shadeOrigin = -340, shadeSpan = 700;
    const shadePixels = new Uint8Array(shadeSize * shadeSize * 4).fill(255);
    const streetShade = new T.DataTexture(shadePixels, shadeSize, shadeSize, T.RGBAFormat);
    streetShade.name = 'Static street contact shading';
    streetShade.minFilter = streetShade.magFilter = T.LinearFilter;
    const footprints = [];
    const signMaterials = new Map();
    const nightMaterials = [];
    const fixtures = [];
    let boulevard = false;
    const roadReflection = {
      image: { value: null },
      projection: { value: new T.Matrix4() },
      strength: { value: 0 },
      waterStrength: { value: 0 },
    };
    const wet = { value: .64 };
    const raining = { value: 0 };
    const weatherTime = { value: 0 };
    const surfaceDetail = { value: 1 };
    const roadSun = { value: new T.Vector3(.31, .29, -.95).normalize() };
    const roadTint = { value: new T.Color('#ffcd97') };
    const roadSky = { value: new T.Color('#56708e') };
    const roadHorizon = { value: new T.Color('#d4a89f') };
    const textureLoader = new T.TextureLoader();
    const textures = {};
    const windowPhotoReady = { value: 0 };
    const assetPaths = {
      asphalt: 'assets/asphalt.webp', 'asphalt-normal': 'assets/asphalt-normal.webp',
      pavement: 'assets/pavement.webp', 'pavement-normal': 'assets/pavement-normal.webp',
      plaster: 'assets/plaster.webp', metal: 'assets/metal.webp',
    };

    function surfaceTexture(name, srgb) {
      if (textures[name]) return textures[name];
      const texture = textureLoader.load(assetPaths[name]);
      texture.wrapS = texture.wrapT = T.RepeatWrapping;
      texture.colorSpace = srgb ? T.SRGBColorSpace : T.NoColorSpace;
      texture.anisotropy = 4;
      textures[name] = texture;
      return texture;
    }
    function windowPhoto() {
      if (!textures.windows) {
        textures.windows = textureLoader.load('assets/harbor-windows.webp', () => { windowPhotoReady.value = 1; });
        textures.windows.colorSpace = T.SRGBColorSpace;
        textures.windows.anisotropy = 4;
      }
      return textures.windows;
    }

    const mat = (color, extra) => new T.MeshStandardMaterial({ color, roughness: .86, ...extra });
    const palette = (colors, extra) => colors.map(color => mat(color, extra));
    const asphalt = mat('#444a4b', { roughness: .87 });
    const roadMark = mat('#d8d6c4', { roughness: .78 });
    const roadGold = mat('#dfa84b', { roughness: .76 });
    const seams = mat('#2a3334');
    const cement = mat('#8b8a7d', { roughness: .87 });
    const curb = mat('#b3a494');
    const boardwalk = mat('#987968');
    const boardSeam = mat('#765f58');
    const grass = mat('#4b715e');
    const soil = mat('#735846');
    const steel = mat('#323c46', { metalness: .38 });
    const steelPale = mat('#799694', { metalness: .18 });
    const trim = mat('#c0aa98');
    const brick = mat('#926251');
    const roof = mat('#58595d');
    const door = mat('#2b454c');
    const white = mat('#f0dabb');
    const rust = mat('#a45146');
    const tar = mat('#404652');
    const gold = mat('#dca35b');
    const parkWater = mat('#4aafa8', { metalness: .38, roughness: .31 });
    function weatherSurface(material, pattern, size = 2, normalMap = null) {
      const isAsphalt = pattern === 'asphalt';
      const isWall = pattern === 'plaster' || pattern === 'metal';
      const albedo = pattern === 'timber' ? null : surfaceTexture(pattern, true);
      const detail = normalMap ? surfaceTexture(normalMap, false) : null;
      material.customProgramCacheKey = () => 'baixi-weather-' + pattern;
      material.onBeforeCompile = shader => {
        Object.assign(shader.uniforms, { baixiWet: wet, baixiRain: raining, baixiTime: weatherTime, baixiSun: roadSun, baixiDetail: surfaceDetail,
          streetShade: { value: streetShade },
          baixiSunColor: roadTint, baixiAlbedo: { value: albedo }, baixiNormalMap: { value: detail } });
        if (isAsphalt) Object.assign(shader.uniforms, { roadMirror: roadReflection.image, mirrorProject: roadReflection.projection,
          mirrorStrength: roadReflection.strength, roadSky, roadHorizon });
        shader.vertexShader = 'varying vec3 vBaixiPosition,vBaixiFacing;\n' + shader.vertexShader.replace('#include <worldpos_vertex>', [
          '#include <worldpos_vertex>',
          'vec4 baixiPosition = vec4(transformed,1.0);',
          '#ifdef USE_INSTANCING',
          '  baixiPosition = instanceMatrix * baixiPosition;',
          '#endif',
          'vBaixiPosition = (modelMatrix * baixiPosition).xyz;',
          'vBaixiFacing = inverseTransformDirection(normalize(transformedNormal),viewMatrix);',
        ].join('\n'));
        shader.fragmentShader = [
          'varying vec3 vBaixiPosition,vBaixiFacing;',
          'uniform float baixiWet,baixiRain,baixiTime,baixiDetail; uniform sampler2D streetShade;',
          'uniform vec3 baixiSun,baixiSunColor;',
          isAsphalt ? 'uniform sampler2D roadMirror; uniform mat4 mirrorProject; uniform float mirrorStrength; uniform vec3 roadSky,roadHorizon;' : '',
          albedo ? 'uniform sampler2D baixiAlbedo;' : '',
          detail ? 'uniform sampler2D baixiNormalMap;' : '',
          'float saltNoise(vec2 v){ vec3 a = fract(vec3(v.xyx) * vec3(.1031,.0973,.1099)); a += dot(a,a.yzx+33.33); return fract((a.x+a.y)*a.z); }',
          'float tideNoise(vec2 p){vec2 f=fract(p),k=f*f*(3.-2.*f),i=floor(p);return mix(mix(saltNoise(i),saltNoise(i+vec2(1,0)),k.x),mix(saltNoise(i+vec2(0,1)),saltNoise(i+1.),k.x),k.y);}',
          shader.fragmentShader.replace('#include <color_fragment>', [
            '#include <color_fragment>',
            'vec2 surface = vBaixiPosition.xz;',
            'vec3 face = abs(normalize(vBaixiFacing));',
            'vec2 surfaceUV = surface/' + size.toFixed(2) + ';',
            'float stain = tideNoise(surface*.24);',
            'float detailFade = 0.0, pores = .12*(stain-.5);',
            'if(baixiDetail>.5){',
            '  detailFade = 1.0-smoothstep(.07,.65,max(length(dFdx(surface)),length(dFdy(surface))));',
            '  float fleck = saltNoise(floor(surface*31.0)), grain = saltNoise(floor(surface*2.6));',
            '  pores += (grain*.11+fleck*.13-.12)*detailFade;',
            '}',
            isWall ? [
              'vec3 p = vBaixiPosition/' + size.toFixed(2) + ';',
              'vec3 detailCol;',
              'if(baixiDetail>.5){',
              '  vec3 planar = pow(face,vec3(6.0)); planar /= dot(planar,vec3(1.));',
              '  detailCol = texture2D(baixiAlbedo,p.yz).rgb*planar.x + texture2D(baixiAlbedo,p.xz).rgb*planar.y + texture2D(baixiAlbedo,p.xy).rgb*planar.z;',
              '}else{',
              '  vec2 uv = face.y>max(face.x,face.z) ? p.xz : face.x>face.z ? p.yz : p.xy;',
              '  detailCol = texture2D(baixiAlbedo,uv).rgb;',
              '}',
              'float wallSeaLevel = .89+.11*smoothstep(.18,2.5,vBaixiPosition.y);',
              'diffuseColor.rgb *= wallSeaLevel * mix(.75,1.23,smoothstep(.10,.65,dot(detailCol,vec3(.21,.72,.07))));',
            ].join('\n') : albedo ? [
              'vec3 detailCol = texture2D(baixiAlbedo,surfaceUV).rgb;',
              'float aggregate = dot(detailCol,vec3(.21,.72,.07));',
              'diffuseColor.rgb *= ' + (isAsphalt ? 'mix(.70,1.30,smoothstep(.035,.32,aggregate));' : 'mix(.73,1.30,smoothstep(.085,.58,aggregate));'),
            ].join('\n') : '',
            'float pooled = baixiDetail>.5 ? tideNoise(surface*vec2(.20,.39))*.66+tideNoise(surface*.82)*.26+tideNoise(surface*3.1)*.08 : mix(stain,.52,.10);',
            'float puddle = baixiWet*smoothstep(.43,.76,pooled)*pow(face.y,4.0);',
            'float contact = texture2D(streetShade,(surface-vec2(' + shadeOrigin.toFixed(1) + '))/' + shadeSpan.toFixed(1) + ').r;',
            'diffuseColor.rgb *= mix(contact,1.0,smoothstep(.35,3.2,vBaixiPosition.y));',
            'diffuseColor.rgb *= (1.0 + pores)*(1.0-puddle*' + (isAsphalt ? '.28' : '.15') + ');',
          ].join('\n')).replace('#include <roughnessmap_fragment>', [
            '#include <roughnessmap_fragment>',
            'roughnessFactor *= 1.0-puddle*' + (isAsphalt ? '.56' : '.24') + ';',
          ].join('\n')).replace('#include <normal_fragment_maps>', [
            '#include <normal_fragment_maps>',
            detail ? [
              'if(baixiDetail>.5){',
              '  vec2 grit = texture2D(baixiNormalMap,surfaceUV).xy*2.0-1.0;',
              '  vec3 surfaceX = transformDirection(vec3(1,0,0),viewMatrix);',
              '  vec3 surfaceZ = transformDirection(vec3(0,0,1),viewMatrix);',
              '  normal = normalize(normal+(surfaceX*grit.x+surfaceZ*grit.y)*(.31-.17*puddle)*face.y*detailFade);',
              '}',
            ].join('\n') : '',
          ].join('\n')).replace('#include <emissivemap_fragment>', [
            '#include <emissivemap_fragment>',
            isAsphalt ? [
              'vec3 eye = normalize(cameraPosition-vBaixiPosition);',
              'vec3 glintNormal = normalize(vec3((stain-.5)*.13,1.,(pooled-.5)*.10));',
              'float angle = pow(1.0-max(0.,eye.y),3.0);',
              'float shine = pow(max(0.,dot(reflect(-baixiSun,glintNormal),eye)),11.);',
              'float ripple = baixiDetail>.5 ? sin(length(fract(surface*1.77)-.5)*35.0-baixiTime*11.0) : 0.0;',
              'float brine = angle*(.10+stain*.29)+.73*shine;',
              'totalEmissiveRadiance += baixiSunColor*puddle*brine*.19*(1.+ripple*.097*baixiRain*detailFade);',
              'if(mirrorStrength>.01){',
              '  vec4 reflected = mirrorProject*vec4(vBaixiPosition,1.);',
              '  vec2 at = reflected.xy/max(.01,reflected.w);',
              '  float edgeFade = smoothstep(.012,.109,min(min(at.x,at.y),1.0-max(at.x,at.y)))*step(.02,reflected.w);',
              '  float wash = tideNoise(surface*.58+vec2(.8,4.9));',
              '  vec2 perturb = vec2(stain-.5,wash-.5) * (.010+baixiRain*.009) + vec2(ripple,-ripple)*baixiRain*.0016*detailFade;',
              '  float mirrorPuddle = smoothstep(.53,.74,pooled);',
              '  float blurBias = 2.38*(1.-mirrorPuddle)+baixiRain*.69;',
              '  vec3 reflectedLight = texture2D(roadMirror,clamp(at+perturb,.001,.999),blurBias).rgb;',
              '  float glaze = (.23+.77*angle)*baixiWet*mirrorStrength*edgeFade*(.026+.47*mirrorPuddle);',
              '  totalEmissiveRadiance += reflectedLight*glaze*vec3(.88,.97,.98);',
              '} else {',
              '  vec3 skyGlaze = mix(roadHorizon,roadSky,clamp(.33+eye.y*.48+(1.-pooled)*.12,0.,1.));',
              '  totalEmissiveRadiance += skyGlaze * angle * (.018*baixiWet+.23*puddle);',
              '}',
            ].join('\n') : '',
          ].join('\n')),
        ].join('\n');
      };
    }
    weatherSurface(asphalt, 'asphalt', 2.65, 'asphalt-normal');
    weatherSurface(cement, 'pavement', 1.8, 'pavement-normal');
    weatherSurface(boardwalk, 'timber', 2.4);
    const shopColors = palette(['#a65b53', '#678782', '#8c6a55', '#555c83', '#3d797d', '#ae7864']);
    const cityColors = palette(['#ba9f84', '#ab8d83', '#9da8a6', '#b0aaa0', '#bcb496', '#ad796f', '#89949d', '#c89475']);
    const towerColors = palette(['#607d8a', '#64758c', '#7f818e', '#8ca29d', '#9a909e', '#697681']);
    for (const coating of cityColors) weatherSurface(coating, 'plaster', 2);
    weatherSurface(steelPale, 'metal', 1.8);
    const leafColors = palette(['#3f7d54', '#4d874e', '#659651', '#82af63']);
    const blossomColors = palette(['#e27f6a', '#eab968', '#d9768d'], { roughness: .88 });
    const trunk = mat('#8d7562');
    const bark = mat('#64574b');
    const rootGrate = mat('#414c48', { metalness: .43 });
    const glass = palette(['#394e60', '#50606d', '#415a61', '#506f7e'], { metalness: .33, roughness: .38 });
    const lightGlass = palette(['#d0a86d', '#e0bc81', '#a7bcb1'], { roughness: .61 });
    for (const m of lightGlass) {
      m.emissive.copy(m.color);
      nightMaterials.push([m, 1.35]);
    }
    const containerMats = palette(['#bd6955', '#658788', '#565e80', '#a99164', '#a5a491', '#75795c']);
    const lampBulb = mat('#fff0cc', { emissive: '#ffc46e', emissiveIntensity: .48 });
    nightMaterials.push([lampBulb, 2.6]);
    const tealBulb = mat('#b4ffea', { emissive: '#56f7d4', emissiveIntensity: .95 });
    nightMaterials.push([tealBulb, 3.0]);
    const softLamp = document.createElement('canvas');
    softLamp.width = softLamp.height = 96;
    const lampContext = softLamp.getContext('2d');
    const poolGradient = lampContext.createRadialGradient(48, 48, 0, 48, 48, 48);
    poolGradient.addColorStop(0, '#ffffffff');
    poolGradient.addColorStop(.42, '#ffffff82');
    poolGradient.addColorStop(1, '#ffffff00');
    lampContext.fillStyle = poolGradient;
    lampContext.fillRect(0, 0, 96, 96);
    const lampPool = new T.MeshBasicMaterial({ color: '#f3b772', map: new T.CanvasTexture(softLamp),
      transparent: true, opacity: 0, depthWrite: false, blending: T.AdditiveBlending });
    const reflectedLamp = lampPool.clone();
    reflectedLamp.color.set('#ffd093');
    const contactShade = new T.MeshBasicMaterial({ color: '#192426', map: lampPool.map,
      transparent: true, opacity: .46, depthWrite: false });

    function queue(geo, material, x, y, z, w, h, d, yaw = 0, pitch = 0, roll = 0) {
      const architecture = geo === unit && h > 2.3 && Math.min(w, d) > 1.25;
      const scenic = boulevard && geo !== plane && (geo !== unit || (Math.min(w, h, d) > .22 && Math.max(w, h, d) > 1.8));
      const casts = material.isMeshStandardMaterial && !material.transparent && (architecture || scenic || material.userData.castShadow === true);
      const narrowTrim = geo === unit && Math.min(w, h, d) < .145 && Math.max(w, h, d) < 3.8;
      const tinyDecal = geo === plane && pitch === -Math.PI / 2 && w * h < .13;
      const detail = geo.userData.closeStreet === true || (!casts && !material.transparent && (narrowTrim || tinyDecal));
      const id = geo.id + ':' + material.id + (casts ? ':shadow' : '');
      if (!batches.has(id)) batches.set(id, { geo, material, casts, core: [], detail: [] });
      dummy.position.set(x, y, z);
      dummy.scale.set(w, h, d);
      dummy.rotation.set(pitch, yaw, roll, 'YXZ');
      dummy.updateMatrix();
      batches.get(id)[detail ? 'detail' : 'core'].push(dummy.matrix.clone());
    }
    const box = (m, x, y, z, w, h, d, yaw, pitch, roll) => queue(unit, m, x, y, z, w, h, d, yaw, pitch, roll);
    const pole = (m, x, y, z, w, h, d = w) => queue(cylinder, m, x, y, z, w, h, d);
    function ground(m, x, z, w, d, y = .035) {
      queue(plane, m, x, y, z, w, d, 1, 0, -Math.PI / 2);
    }
    function bar(m, ax, ay, az, bx, by, bz, width, depth = width) {
      const a = new T.Vector3(ax, ay, az);
      const b = new T.Vector3(bx, by, bz);
      const difference = b.clone().sub(a);
      const orientation = new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 1, 0), difference.clone().normalize());
      const angles = new T.Euler().setFromQuaternion(orientation, 'YXZ');
      box(m, (ax + bx) / 2, (ay + by) / 2, (az + bz) / 2, width, difference.length(), depth, angles.y, angles.x, angles.z);
    }
    function indexBox(grid, item) {
      for (let gx = Math.floor(item.left / 40); gx <= Math.floor(item.right / 40); gx++) {
        if (!grid.has(gx)) grid.set(gx, new Map());
        const column = grid.get(gx);
        for (let gz = Math.floor(item.top / 40); gz <= Math.floor(item.bottom / 40); gz++) {
          if (!column.has(gz)) column.set(gz, []);
          column.get(gz).push(item);
        }
      }
    }
    function solid(x, z, w, d, height = 6, visibleOnMap = true, minY = 0) {
      const item = { x, z, w, d, height, minY, left: x - w / 2, right: x + w / 2, top: z - d / 2, bottom: z + d / 2 };
      indexBox(obstacles, item);
      if (visibleOnMap) footprints.push(item);
      if (minY < .35 && height > 2.4 && w * d > 3) contactCasters.push(item);
    }
    function* bakeStreetShade() {
      // Store broad, soft contact shadows once. Runtime cost stays one filtered ground sample.
      const texels = shadeSize / shadeSpan;
      for (let i = 0; i < contactCasters.length; i++) {
        const box = contactCasters[i];
        const reach = clamp(box.height * .21, 1.9, 5.4);
        const x1 = Math.max(0, Math.floor((box.left - reach - shadeOrigin) * texels));
        const x2 = Math.min(shadeSize - 1, Math.ceil((box.right + reach - shadeOrigin) * texels));
        const z1 = Math.max(0, Math.floor((box.top - reach - shadeOrigin) * texels));
        const z2 = Math.min(shadeSize - 1, Math.ceil((box.bottom + reach - shadeOrigin) * texels));
        for (let z = z1; z <= z2; z++) {
          const wz = shadeOrigin + (z + .5) / texels;
          const dz = Math.max(box.top - wz, 0, wz - box.bottom);
          for (let x = x1; x <= x2; x++) {
            const wx = shadeOrigin + (x + .5) / texels;
            const dx = Math.max(box.left - wx, 0, wx - box.right);
            const weight = Math.max(0, 1 - Math.sqrt(dx * dx + dz * dz) / reach);
            const pixel = (z * shadeSize + x) * 4;
            shadePixels[pixel] = Math.min(shadePixels[pixel], 255 - Math.round(82 * weight * weight));
          }
        }
        if ((i & 31) === 31) yield;
      }
      contactCasters.length = 0;
      streetShade.needsUpdate = true;
    }
    function surface(x, z, w, d, height, slopeX = 0) {
      indexBox(surfaces, { left: x - w / 2, right: x + w / 2, top: z - d / 2, bottom: z + d / 2, x, height, slopeX });
    }
    function surfaceHeight(x, z) {
      const items = surfaces.get(Math.floor(x / 40))?.get(Math.floor(z / 40));
      let height = .023;
      if (items) for (const item of items) {
        if (x >= item.left && x <= item.right && z >= item.top && z <= item.bottom)
          height = Math.max(height, item.height + (x - item.x) * item.slopeX);
      }
      if (x > 331 && window.Tideline.marineWalkable?.(x, z)) height = Math.max(height, .22);
      return height;
    }
    function blockedAt(x, z, radius, height = 0) {
      for (let gx = Math.floor((x - radius) / 40); gx <= Math.floor((x + radius) / 40); gx++) {
        const column = obstacles.get(gx);
        if (!column) continue;
        for (let gz = Math.floor((z - radius) / 40); gz <= Math.floor((z + radius) / 40); gz++) {
          const items = column.get(gz);
          if (!items) continue;
          for (const item of items) {
            if (height < item.minY || height >= item.height) continue;
            const dx = x - clamp(x, item.left, item.right);
            const dz = z - clamp(z, item.top, item.bottom);
            if (dx * dx + dz * dz < radius * radius) return true;
          }
        }
      }
      return false;
    }
    // First contact along a segment, including thin walls and the undersides of raised floors.
    function clearFraction(ax, ay, az, bx, by, bz, radius) {
      const dx = bx - ax, dy = by - ay, dz = bz - az;
      const ix = dx ? 1 / dx : 0, iy = dy ? 1 / dy : 0, iz = dz ? 1 / dz : 0;
      const lastX = Math.floor((Math.max(ax, bx) + radius) / 40);
      const lastZ = Math.floor((Math.max(az, bz) + radius) / 40);
      const firstZ = Math.floor((Math.min(az, bz) - radius) / 40);
      let limit = 1;
      for (let gx = Math.floor((Math.min(ax, bx) - radius) / 40); gx <= lastX; gx++) {
        const column = obstacles.get(gx);
        if (!column) continue;
        for (let gz = firstZ; gz <= lastZ; gz++) {
          const items = column.get(gz);
          if (!items) continue;
          for (const box of items) {
            const left = box.left - radius, right = box.right + radius;
            const near = box.top - radius, far = box.bottom + radius;
            const floor = box.minY - radius, roof = box.height + radius;
            if ((!dx && (ax < left || ax > right)) || (!dy && (ay < floor || ay > roof)) ||
                (!dz && (az < near || az > far))) continue;
            const entry = Math.max(0, dx ? ((dx > 0 ? left : right) - ax) * ix : 0,
              dy ? ((dy > 0 ? floor : roof) - ay) * iy : 0, dz ? ((dz > 0 ? near : far) - az) * iz : 0);
            if (entry >= limit) continue;
            const exit = Math.min(1, dx ? ((dx > 0 ? right : left) - ax) * ix : 1,
              dy ? ((dy > 0 ? roof : floor) - ay) * iy : 1, dz ? ((dz > 0 ? far : near) - az) * iz : 1);
            if (entry <= exit) limit = entry;
          }
        }
      }
      return limit;
    }
    function collision(x, z, radius, height = 0) {
      const mainland = x >= BOUNDS.minX + radius && x <= BOUNDS.maxX - radius &&
        z >= BOUNDS.minZ + radius && z <= BOUNDS.maxZ - radius;
      if (!mainland && !window.Tideline.marineWalkable?.(x, z, radius)) return true;
      return blockedAt(x, z, radius, height);
    }
    // Project the actual vehicle footprint onto both sets of box axes.
    function vehicleBlocked(x, z, yaw, width, length, height) {
      const fx = Math.sin(yaw), fz = Math.cos(yaw);
      const sx = Math.abs(fx), sz = Math.abs(fz);
      const extentX = sz * width + sx * length, extentZ = sx * width + sz * length;
      if (x - extentX < BOUNDS.minX || x + extentX > BOUNDS.maxX || z - extentZ < BOUNDS.minZ || z + extentZ > BOUNDS.maxZ) {
        for (let side = -1; side <= 1; side += 2) {
          for (let end = -1; end <= 1; end += 2) {
            const px = x + side * fz * width + end * fx * length;
            const pz = z - side * fx * width + end * fz * length;
            if ((px < BOUNDS.minX || px > BOUNDS.maxX || pz < BOUNDS.minZ || pz > BOUNDS.maxZ) &&
                !window.Tideline.marineWalkable?.(px, pz)) return true;
          }
        }
      }
      for (let gx = Math.floor((x - extentX) / 40); gx <= Math.floor((x + extentX) / 40); gx++) {
        const column = obstacles.get(gx);
        if (!column) continue;
        for (let gz = Math.floor((z - extentZ) / 40); gz <= Math.floor((z + extentZ) / 40); gz++) {
          const items = column.get(gz);
          if (!items) continue;
          for (const item of items) {
            if (item.minY >= height) continue;
            const dx = x - item.x, dz = z - item.z, w = item.w * .5, d = item.d * .5;
            if (Math.abs(dx) < extentX + w && Math.abs(dz) < extentZ + d &&
                Math.abs(dx * fz - dz * fx) < width + sz * w + sx * d &&
                Math.abs(dx * fx + dz * fz) < length + sx * w + sz * d) return true;
          }
        }
      }
      return false;
    }
    function occluded(a, b, interval = 4, height = 1.8) {
      const length = distance(a, b);
      for (let t = interval; t < length - Math.min(2, interval); t += interval) {
        if (collision(a.x + (b.x - a.x) * t / length, a.z + (b.z - a.z) * t / length, .19, height)) return true;
      }
      return false;
    }

    function signTexture(label, detail, color) {
      const id = label + ':' + detail + ':' + color;
      if (signMaterials.has(id)) return signMaterials.get(id);
      const canvas = document.createElement('canvas');
      canvas.width = 512;
      canvas.height = 128;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#162a3a';
      ctx.fillRect(0, 0, 512, 128);
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, 9, 128);
      ctx.fillRect(510, 0, 2, 128);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = '900 51px "Microsoft YaHei UI", "Noto Sans CJK SC", sans-serif';
      ctx.fillText(label, 260, 47, 460);
      ctx.font = 'bold 19px monospace';
      ctx.fillStyle = '#d6e5d9';
      ctx.fillText(detail, 260, 96, 450);
      const texture = new T.CanvasTexture(canvas);
      texture.colorSpace = T.SRGBColorSpace;
      texture.anisotropy = 4;
      const material = new T.MeshStandardMaterial({ map: texture, emissiveMap: texture, emissive: '#e0e5ff', emissiveIntensity: .38, roughness: .75 });
      nightMaterials.push([material, 1.8]);
      signMaterials.set(id, material);
      return material;
    }
    function sign(label, detail, color, x, y, z, w, h, yaw) {
      queue(plane, signTexture(label, detail, color), x, y, z, w, h, 1, yaw);
    }
    function fixture(x, y, z, color, intensity, range) {
      fixtures.push({ x, y, z, color: new T.Color(color), intensity, range });
    }
    const boulevardAssets = { T, scene, queue, box, ground, solid, surface, shelters, pavement: cement, signPlane: plane, sign, bar, pole, nightMaterials,
      streetLight, planter, surfaceTexture, fixture, windowPhoto, windowPhotoReady, lampPool, contactShade };

    function streetLight(x, z, yaw = 0) {
      const dx = Math.sin(yaw);
      const dz = Math.cos(yaw);
      pole(steel, x, 2.6, z, .16, 5.2);
      pole(steelPale, x, .24, z, .36, .48);
      pole(steel, x, .54, z, .25, .14);
      bar(steel, x, 4.98, z, x + dx * 1.28, 5.62, z + dz * 1.28, .125);
      bar(steelPale, x, 4.55, z, x + dx * .68, 5.28, z + dz * .68, .055);
      box(steel, x + dx * 1.38, 5.63, z + dz * 1.38, .58, .18, 1.06, yaw);
      box(steelPale, x + dx * 1.38, 5.73, z + dz * 1.38, .48, .05, .92, yaw);
      box(lampBulb, x + dx * 1.38, 5.49, z + dz * 1.38, .50, .11, .88, yaw);
      ground(lampPool, x + dx * 2.25, z + dz * 2.25, 8.2, 8.2, .22);
      ground(reflectedLamp, x + dx * 4.45, z + dz * 4.45, 6.2, 17.5, .043);
      fixture(x + dx * 1.38, 5.08, z + dz * 1.38, '#ffd296', 105, 21);
      solid(x, z, .26, .26, 5.25, false);
    }
    function bench(x, z, yaw = 0) {
      const dx = Math.sin(yaw);
      const dz = Math.cos(yaw);
      box(boardwalk, x, .55, z, 2.45, .12, .63, yaw);
      box(boardwalk, x + dx * .28, .95, z + dz * .28, 2.45, .34, .11, yaw);
      for (const side of [-1, 1]) box(steel, x + side * dz * .9, .34, z - side * dx * .9, .15, .47, .66, yaw);
      solid(x, z, Math.abs(dz) * 2.45 + Math.abs(dx) * .65, Math.abs(dx) * 2.45 + Math.abs(dz) * .65, 1.12, false);
    }
    function palmMap(width, height, draw) {
      const canvas = document.createElement('canvas');
      canvas.width = width; canvas.height = height;
      draw(canvas.getContext('2d'), width, height);
      const map = new T.CanvasTexture(canvas);
      map.colorSpace = T.SRGBColorSpace;
      map.anisotropy = 4;
      return map;
    }
    const palmInk = rng(751243);
    trunk.color.set('#e2d8bf');
    trunk.map = palmMap(128, 512, (ctx, w, h) => {
      const base = ctx.createLinearGradient(0, 0, 0, h);
      base.addColorStop(0, '#828452');
      base.addColorStop(.16, '#8b8165');
      base.addColorStop(.36, '#a0937f');
      base.addColorStop(.78, '#ac9b86');
      base.addColorStop(1, '#807568');
      ctx.fillStyle = base; ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 660; i++) {
        ctx.fillStyle = i % 3 ? '#493e3624' : '#dacbaf33';
        ctx.fillRect(palmInk() * w, palmInk() * h, .45 + palmInk(), 2 + palmInk() * 13);
      }
      for (let y = 4; y < h; y += 9 + palmInk() * 6) {
        const wave = palmInk() * Math.PI * 2;
        for (const [shift, ink, breadth] of [[0, '#554e419a', 2.0], [2.18, '#d1bea082', 1.35]]) {
          ctx.beginPath();
          for (let x = 0; x <= w; x += 4) {
            const at = y + shift + 1.31 * Math.sin(wave + x / w * Math.PI * 4) + .56 * Math.sin(x / w * Math.PI * 6);
            if (x) ctx.lineTo(x, at); else ctx.moveTo(x, at);
          }
          ctx.strokeStyle = ink; ctx.lineWidth = breadth; ctx.stroke();
        }
      }
    });
    const palmTrunk = new T.BufferGeometry();
    {
      const positions = [], uvs = [], indices = [];
      const rings = [[0, .268], [.095, .205], [.81, .141], [.95, .161], [1, .117]];
      for (const [level, [height, radius]] of rings.entries()) {
        for (let j = 0; j <= 8; j++) {
          const a = j * Math.PI / 4;
          const bend = Math.sin(Math.PI * height);
          positions.push(Math.cos(a) * radius + .064 * bend, height, Math.sin(a) * radius - .044 * bend);
          uvs.push(j / 8, height);
          if (level && j) {
            const n = level * 9 + j;
            indices.push(n - 10, n - 1, n, n - 10, n, n - 9);
          }
        }
      }
      const crown = (rings.length - 1) * 9;
      for (let j = 1; j < 7; j++) indices.push(crown, crown + j + 1, crown + j);
      palmTrunk.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
      palmTrunk.setAttribute('uv', new T.Float32BufferAttribute(uvs, 2));
      palmTrunk.setIndex(indices);
      palmTrunk.computeVertexNormals();
    }
    const featherMap = palmMap(256, 512, (ctx, w, h) => {
      const green = ['#4f833e','#669a49','#477a3f','#82ab4e','#649041','#52813c'];
      for (let pair = 0; pair < 27; pair++) {
        for (const side of [-1, 1]) {
          const t = .012 + (pair + (side > 0 ? .42 : 0)) / 30;
          const y = (1 - t) * h, advance = (.13 - t * .049) * h;
          const span = (.394 + palmInk() * .099) * w;
          const root = w * .5 + side * .6;
          const tip = root + side * span;
          ctx.fillStyle = green[(pair + (side > 0 ? 2 : 0)) % green.length];
          ctx.beginPath(); ctx.moveTo(root, y + 1.9);
          ctx.bezierCurveTo(root + side * span * .22, y - 2, root + side * span * .64, y - advance * .64, tip, y - advance);
          ctx.bezierCurveTo(root + side * span * .70, y - advance * .70 + 9.5, root + side * span * .30, y - advance * .22 + 13.4, root, y + 4.0);
          ctx.fill();
        }
      }
      ctx.fillStyle = '#a7a160'; ctx.beginPath(); ctx.moveTo(w * .479, h); ctx.lineTo(w * .501, 1); ctx.lineTo(w * .522, h); ctx.fill();
    });
    const frondMaterial = mat('#e3e9cd', { map: featherMap, alphaTest: .29, side: T.DoubleSide, roughness: .91 });
    const pinnaMaterial = mat('#dce4bb', { vertexColors: true, side: T.DoubleSide, roughness: .9 });
    const frond = new T.BufferGeometry();
    const pinnae = new T.BufferGeometry();
    const axis = t => [.036 * Math.sin(t * Math.PI), .22 * Math.sin(t * Math.PI) - .28 * t * t, t];
    {
      const positions = [], uvs = [], indices = [];
      for (const [row,t] of [0,.27,.56,.81,1].entries()) {
        const [x,y,z] = axis(t);
        const spread = .207 * Math.sin(t * Math.PI) ** .71;
        for (const side of [-1,0,1]) {
          positions.push(x + side * spread, y - Math.abs(side) * spread * (.27 + .29 * t), z + Math.abs(side) * .029 * Math.sin(t * Math.PI));
          uvs.push((side + 1) / 2, t);
        }
        if (!row) continue;
        for (let col = 0; col < 2; col++) {
          const a = (row - 1) * 3 + col;
          if (row !== 1) indices.push(a, a + 3, a + 1);
          if (row !== 4) indices.push(a + 1, a + 3, a + 4);
        }
      }
      frond.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
      frond.setAttribute('uv', new T.Float32BufferAttribute(uvs, 2));
      frond.setIndex(indices);
      frond.computeVertexNormals();

      const points = [], colors = [];
      const dark = new T.Color('#526e3e'), green = new T.Color('#76954c'), straw = new T.Color('#909d58');
      function point(p, color) { points.push(...p); colors.push(color.r, color.g, color.b); }
      for (let pair = 0; pair < 8; pair++) for (const side of [-1,1]) {
        const t = .15 + (pair + (side > 0 ? .39 : 0)) * .092;
        const [x,y,z] = axis(t);
        const reach = (.19 + .048 * Math.cos(pair * 1.81 + side)) * Math.sin(t * Math.PI) ** .63;
        const drop = (.081 + pair * .0065) * Math.sin(t * Math.PI);
        const root = [x,y - .003,z];
        const ridge = [x + side * reach * .53,y - .019,z + .062];
        const edge = [x + side * reach * .50,y - .039,z + .095];
        const tip = [x + side * reach,y - drop,z + .158];
        point(root,dark); point(ridge,green); point(edge,dark);
        point(ridge,green); point(tip,straw); point(edge,dark);
      }
      pinnae.setAttribute('position', new T.Float32BufferAttribute(points,3));
      pinnae.setAttribute('color', new T.Float32BufferAttribute(colors,3));
      pinnae.computeVertexNormals();
      pinnae.userData.closeStreet = true;
    }
    for (const material of leafColors) material.side = T.DoubleSide;
    function palm(x, z, height = range(5.1, 8.7)) {
      const tilt = range(-.15, .15);
      const topX = x - Math.sin(tilt) * height * .46;
      const footX = x + Math.sin(tilt) * height * .38;
      const deck = surfaceHeight(footX, z);
      const dx = topX - footX;
      queue(palmTrunk, trunk, footX, deck, z, 1, Math.hypot(dx, height), 1, 0, 0, Math.atan2(-dx, height));
      solid(footX, z, .53, .53, height * .6, false);
      const start = range(0, Math.PI);
      const crown = deck + height;
      function leaf(span, angle, pitch, roll, y) {
        queue(frond, frondMaterial, topX, y, z, span, span, span, angle, pitch, roll);
        queue(pinnae, pinnaMaterial, topX, y, z, span, span, span, angle, pitch, roll);
      }
      for (let i = 0; i < 7; i++) {
        const spread = range(1.65, 3.27);
        const lift = random();
        const roll = range(-.08, .28);
        const upper = i === 1 || i === 4;
        const span = (.43 * height + spread * .26) * (upper ? .79 : 1);
        leaf(span,start + i * .897 + (lift - .5) * .16,upper ? -.46 - lift * .13 : .12 - lift * .16,roll - .10,crown + (upper ? .01 : -.06));
      }
      leaf(height * .32,start + .45,-.91,.13,crown + .013);
    }
    const treeRandom = rng(155927);
    const leafCard = document.createElement('canvas');
    leafCard.width = leafCard.height = 128;
    const leafInk = leafCard.getContext('2d');
    const leafTones = ['#3f6c37', '#588643', '#6d9646', '#82a052', '#9fb061', '#4d773e'];
    for (let i = 0; i < 138; i++) {
      const angle = treeRandom() * Math.PI * 2;
      const reach = .95 * Math.sqrt(treeRandom());
      const x = 64 + Math.cos(angle) * reach * 58;
      const y = 64 + Math.sin(angle) * reach * 49;
      leafInk.fillStyle = leafTones[i % leafTones.length];
      leafInk.beginPath();
      leafInk.ellipse(x, y, 1.4 + treeRandom() * 4.05, 2.4 + treeRandom() * 4.8, angle + treeRandom() * .75, 0, Math.PI * 2);
      leafInk.fill();
    }
    const foliageTexture = new T.CanvasTexture(leafCard);
    foliageTexture.colorSpace = T.SRGBColorSpace;
    foliageTexture.anisotropy = 4;
    const foliage = mat('#c6c8af', { map: foliageTexture, alphaTest: .33, side: T.DoubleSide });
    foliage.userData.castShadow = true;
    const crowns = Array.from({ length: 3 }, () => {
      const vertices = [], uvs = [], indices = [];
      const up = new T.Vector3();
      const lateral = new T.Vector3();
      for (let i = 0; i < 65; i++) {
        const turn = treeRandom() * Math.PI * 2;
        const level = treeRandom() * 1.83 - .93;
        const radius = Math.sqrt(1 - level * level) * (.54 + treeRandom() * .46);
        const x = Math.cos(turn) * radius * .55;
        const z = Math.sin(turn) * radius * .48;
        const y = level * .49 + Math.abs(x) * .17;
        const yaw = turn * 1.36;
        const tilt = (treeRandom() - .48) * 1.74;
        lateral.set(Math.cos(yaw), 0, Math.sin(yaw)).multiplyScalar(.185 + treeRandom() * .11);
        up.set(-Math.sin(yaw) * Math.sin(tilt), Math.cos(tilt), Math.cos(yaw) * Math.sin(tilt)).multiplyScalar(.13 + treeRandom() * .132);
        const start = vertices.length / 3;
        for (const [right, top] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
          vertices.push(x + right * lateral.x + top * up.x, y + top * up.y, z + right * lateral.z + top * up.z);
        }
        uvs.push(0, 0, 1, 0, 1, 1, 0, 1);
        indices.push(start, start + 1, start + 2, start, start + 2, start + 3);
      }
      const geo = new T.BufferGeometry();
      geo.setAttribute('position', new T.Float32BufferAttribute(vertices, 3));
      geo.setAttribute('uv', new T.Float32BufferAttribute(uvs, 2));
      geo.setIndex(indices);
      geo.computeVertexNormals();
      return geo;
    });
    function deciduous(x, z, height) {
      const turn = Math.abs(x * 37 + z * 13);
      const bendX = Math.sin(turn) * .24;
      const bendZ = Math.cos(turn) * .20;
      solid(x + bendX * .35, z + bendZ * .35, height * .076, height * .076, height * .59, false);
      queue(tapered, bark, x + bendX * .35, height * .29, z + bendZ * .35, height * .081, height * .59, height * .081,
        0, bendZ * .09, -bendX * .12);
      for (let i = 0; i < 5; i++) {
        const yaw = turn + i * 2.4;
        const dx = Math.sin(yaw) * height * (.16 + (i % 3) * .064);
        const dz = Math.cos(yaw) * height * (.20 + (i % 2) * .058);
        bar(bark, x + bendX * .5, height * (.29 + i * .036), z + bendZ * .5,
          x + bendX + dx, height * (.70 + i * .027), z + bendZ + dz, height * (.039 - i * .004));
      }
      queue(crowns[Math.floor(turn) % crowns.length], foliage, x + bendX, height * .77, z + bendZ,
        height * .93, height * .77, height * .92, turn);
    }
    function planter(x, z, color = leafColors[2]) {
      box(steelPale, x, .40, z, 2.4, .42, 1.31);
      box(curb, x, .63, z, 2.48, .08, 1.39);
      box(soil, x, .67, z, 2.17, .05, 1.08);
      for (const shift of [-.75, 0, .75]) {
        const top = .90 + random() * .15;
        queue(lowSphere, color, x + shift, top, z, .84, .72, .84);
        if (shift === 0) queue(lowSphere, choose(blossomColors), x + .18, top + .26, z + .12, .28, .22, .28);
      }
      solid(x, z, 2.4, 1.31, .71, false);
    }

    function trafficSignal(x, z, yaw, stop) {
      const matLight = stop ? rust : tealBulb;
      const dx = Math.sin(yaw);
      const dz = Math.cos(yaw);
      pole(steel, x, 1.88, z, .19, 3.67);
      solid(x, z, .20, .20, 4.41, false);
      box(steel, x, 3.91, z, .47, .99, .37, yaw);
      for (let row = 0; row < 3; row++) {
        const y = 4.21 - row * .30;
        const material = row === (stop ? 0 : 2) ? matLight : tar;
        queue(cylinder, material, x + dx * .201, y, z + dz * .201, .21, .10, .21, yaw, Math.PI / 2);
        box(steel, x + dx * .24, y + .10, z + dz * .24, .27, .055, .13, yaw);
      }
    }

    function roadNetwork() {
      box(cement, 6.5, -.29, 2, 665, .54, 652);
      for (const x of X) {
        ground(asphalt, x, 0, ROAD, 647, .018);
        for (const [side, col] of [[-1, roadMark], [1, roadMark]]) {
          for (let i = 0; i < Z.length - 1; i++) {
            const end = Z[i + 1] - 10.5;
            const start = Z[i] + 10.5;
            ground(col, x + side * 7.65, (start + end) / 2, .12, end - start, .026);
          }
        }
        for (let z = -314; z < 324; z += 6.3) {
          if (Math.abs(nearest(Z, z) - z) < 12) continue;
          ground(roadGold, x - .23, z, .12, 3.1, .027);
          ground(roadGold, x + .23, z, .12, 3.1, .027);
          ground(roadMark, x - 3.9, z, .09, 2.1, .026);
          ground(roadMark, x + 3.9, z, .09, 2.1, .026);
        }
      }
      for (const z of Z) {
        ground(asphalt, -1, z, 648, ROAD, .019);
        for (const side of [-1, 1]) {
          for (let i = 0; i < X.length - 1; i++) {
            const end = X[i + 1] - 10.5;
            const start = X[i] + 10.5;
            ground(roadMark, (start + end) / 2, z + side * 7.65, end - start, .12, .026);
          }
        }
        for (let x = -316; x < 318; x += 6.3) {
          if (Math.abs(nearest(X, x) - x) < 12) continue;
          ground(roadGold, x, z, 3.1, .15, .027);
          ground(roadMark, x, z - 3.9, 2.1, .09, .026);
          ground(roadMark, x, z + 3.9, 2.1, .09, .026);
        }
      }
      for (const x of X) {
        for (const z of Z) {
          for (const side of [-1, 1]) {
            for (let lane = -6.4; lane < 7; lane += 2) {
              ground(roadMark, x + lane, z + side * 10.35, .82, 1.74, .03);
              ground(roadMark, x + side * 10.35, z + lane, 1.74, .82, .03);
            }
            ground(roadMark, x + side * 3.8, z + side * 11.75, 6.8, .36, .029);
            ground(roadMark, x + side * 11.75, z - side * 3.8, .36, 6.8, .029);
          }
          streetLight(x + 10.8, z + 11.5, -Math.PI / 2);
          streetLight(x - 10.8, z - 11.5, Math.PI / 2);
          if (x === 286 || (Math.abs(x) < 109 && Math.abs(z) < 220)) {
            trafficSignal(x + 10.9, z + 9.4, Math.PI / 2, true);
            trafficSignal(x - 10.9, z - 9.4, Math.PI, false);
          }
        }
      }
      for (let i = 0; i < 200; i++) {
        const x = range(-291, 278);
        const z = choose(Z) + range(-6.7, 6.7);
        if (Math.abs(x - nearest(X, x)) < 14) continue;
        ground(seams, x, z, range(.12, .3), range(.2, 2.1), .024);
      }
    }

    function streetEdges() {
      const art = rng(649812);
      for (const x of X.slice(0, -1)) {
        for (let i = 0; i < Z.length - 2; i++) {
          const low = Z[i];
          const high = Z[i + 1];
          for (const side of [-1, 1]) {
            if (x === X[0] && side < 0) continue;
            const atX = x + side * 12.92;
            const atZ = low + (high - low) * (.34 + art() * .33);
            if (blockedAt(atX, atZ, 2.7)) continue;
            const bed = art() > .24;
            if (bed) {
              ground(rootGrate, atX, atZ, 1.43, 1.58, .197);
              ground(soil, atX, atZ, .74, .91, .202);
              deciduous(atX, atZ, 5.05 + art() * 2.1);
            }
            if (art() > .56 && !blockedAt(atX, atZ + 4.6, 1.4)) bench(atX, atZ + 4.6, -side * Math.PI / 2);
          }
        }
      }
      for (const x of X) {
        for (const z of Z) {
          const atX = x + 8.23;
          for (const side of [-1, 1]) {
            const atZ = z + side * (16 + art() * 4.3);
            ground(rootGrate, atX, atZ, .48, .78, .027);
            for (let i = -2; i <= 2; i++) ground(seams, atX, atZ + i * .128, .36, .042, .032);
          }
        }
      }
    }

    function facade(x, y, z, w, depth, floors, spacing, deco) {
      const step = deco ? 3.05 : 3.3;
      const gap = deco ? 3.05 : 3.2;
      const columnsWide = Math.max(2, Math.floor(w / gap) - 1);
      const columnsDeep = Math.max(2, Math.floor(depth / gap) - 1);
      for (let level = 0; level < floors; level++) {
        const row = y + level * spacing;
        for (const side of [-1, 1]) {
          for (let i = 0; i < columnsWide; i++) {
            const col = (i - (columnsWide - 1) / 2) * gap;
            const material = random() < .13 ? choose(lightGlass) : choose(glass);
            queue(plane, material, x + col, row, z + side * (depth / 2 + .044), step * (deco ? .58 : .8), deco ? 1.56 : 1.92, 1, side === 1 ? 0 : Math.PI);
          }
          for (let i = 0; i < columnsDeep; i++) {
            const col = (i - (columnsDeep - 1) / 2) * gap;
            const material = random() < .13 ? choose(lightGlass) : choose(glass);
            queue(plane, material, x + side * (w / 2 + .044), row, z + col, step * (deco ? .58 : .8), deco ? 1.56 : 1.92, 1, side * Math.PI / 2);
          }
        }
        if (deco && level % 2 === 0) box(trim, x, row - 1.32, z, w + .28, .22, depth + .28);
      }
    }
    const shopSigns = [
      ['十七码头', 'PIER 17', '#ffd993'], ['潮汽冰室', 'TIDE CANTEEN', '#9ae9de'],
      ['海角便利', 'CAPE MART', '#ffb98e'], ['麦穗茶座', 'WHEAT TEA', '#e7e3a5'],
      ['白汐邮局', 'POST OFFICE', '#aff4d8'], ['回声唱片', 'ECHO RECORDS', '#ffa8c0'],
      ['深湾旅馆', 'DEEP BAY INN', '#ffd397'],
    ];
    function building(x, z, w, d, height, tower, front = 0, shop = false) {
      const h = height;
      if (window.Tideline.addDistrictArchitecture?.(boulevardAssets, { x, z, w, d, height, tower, front, shop })) {
        // Preserve the established lot layouts. The old facade and shop dressing shared the site's placement seed.
        const drawsForWindows = (wide, deep, floors, gap) => 4 * floors *
          (Math.max(2, Math.floor(wide / gap) - 1) + Math.max(2, Math.floor(deep / gap) - 1));
        let draws = 1 + drawsForWindows(w, d, Math.max(1, Math.floor((h - 3.1) / 3.15)), tower ? 3.2 : 3.05);
        if (tower && h > 39) draws += 1 + drawsForWindows(w * .72, d * .72, Math.max(1, Math.floor(h * .20 / 3.5)), 3.2);
        if (shop) draws += 3;
        for (let i = 0; i < draws; i++) random();
        solid(x, z, w, d, tower && h > 39 ? h * 1.2 : h + .65);
        return;
      }
      const color = choose(tower ? towerColors : cityColors);
      box(tar, x, .33, z, w + .65, .31, d + .6);
      box(color, x, h / 2 + .24, z, w, h, d);
      box(tower ? steelPale : trim, x, h + .37, z, w + .45, .52, d + .45);
      box(roof, x, h + .8, z, w * .95, .22, d * .95);
      box(tower ? color : tar, x - w * .19, h + 1.51, z + d * .23, w * .28, 1.58, d * .26);
      facade(x, tower ? 3.5 : 4.4, z, w, d, Math.max(1, Math.floor((h - 3.1) / 3.15)), 3.15, !tower);
      if (tower && h > 39) {
        const peakH = h * .20;
        box(color, x, h + peakH / 2, z, w * .72, peakH, d * .72);
        facade(x, h + 2.4, z, w * .72, d * .72, Math.max(1, Math.floor(peakH / 3.5)), 3.18, false);
        box(steelPale, x, h + peakH, z, w * .73, .46, d * .74);
        if (random() < .63) {
          pole(steel, x + 2, h + peakH + 5, z, .22, 10);
          box(tealBulb, x + 2, h + peakH + 10.1, z, .37, .37, .37);
        }
      }
      if (tower) {
        const baseHeight = Math.min(8.7, h / 2.7);
        box(steelPale, x, baseHeight - .11, z, w + .8, .32, d + .70);
        for (const side of [-1, 1]) {
          box(steelPale, x + w * .37 * side, h / 2 + .15, z + d / 2 + .18, .55, h, .45);
          box(steelPale, x + w * .37 * side, h / 2 + .15, z - d / 2 - .18, .55, h, .45);
          box(glass[1], x, 2.08, z + side * (d / 2 + .081), w - 4.0, 3.34, .25);
          for (let b = -w / 2 + 2.3; b < w / 2 - 2.0; b += 3.2) {
            box(steelPale, x + b, 2.16, z + side * (d / 2 + .24), .24, 3.54, .28);
          }
        }
      }
      if (shop) {
        const dx = Math.sin(front);
        const dz = Math.cos(front);
        const depth = Math.abs(dx) > .5 ? w : d;
        const width = Math.abs(dx) > .5 ? d : w;
        const facadeX = x + dx * (depth / 2 + .14);
        const facadeZ = z + dz * (depth / 2 + .14);
        const storefrontW = Math.min(width - 2, 10.5);
        box(door, facadeX, 1.8, facadeZ, storefrontW, 3.03, .37, front);
        const warmGlazing = choose(lightGlass);
        for (const section of [-1, 1]) {
          const pw = storefrontW * section * .26;
          const gx = facadeX + dz * pw + dx * .22;
          const gz = facadeZ - dx * pw + dz * .22;
          box(warmGlazing, gx, 1.83, gz, storefrontW * .32, 1.94, .17, front);
          box(steel, gx + dx * .106, 1.83, gz + dz * .106, storefrontW * .335, .096, .054, front);
          box(steel, gx + dx * .107, 1.83, gz + dz * .107, .096, 1.946, .054, front);
        }
        const awningColor = choose(shopColors);
        box(awningColor, facadeX + dx * 1.05, 3.55, facadeZ + dz * 1.05, storefrontW + .65, .27, 2.1, front, .13);
        for (let x = -storefrontW * .5 + .34; x < storefrontW * .52; x += .75) {
          box(trim, facadeX + dz * x + dx * 2.08, 3.41, facadeZ - dx * x + dz * 2.08, .21, .29, .07, front);
        }
        const words = choose(shopSigns);
        sign(...words, facadeX + dx * .32, 4.69, facadeZ + dz * .32, Math.min(storefrontW, 9), 2.13, front);
        ground(lampPool, facadeX + dx * 2.4, facadeZ + dz * 2.4, Math.abs(dx) > .5 ? 5.3 : storefrontW,
          Math.abs(dx) > .5 ? storefrontW : 5.3, .212);
      }
      solid(x, z, w, d, tower && h > 39 ? h * 1.2 : h + .65);
    }

    function lot(x, z, w, d) {
      box(curb, x, .04, z, w + .36, .17, d + .36);
      box(cement, x, .12, z, w, .14, d);
      surface(x, z, w + .36, d + .36, .125);
      surface(x, z, w, d, .19);
    }
    function park(x, z, w, d) {
      box(grass, x, .242, z, w - 9, .18, d - 9);
      surface(x, z, w - 9, d - 9, .342);
      ground(curb, x, z, w - 9, 5, .342);
      ground(curb, x, z, 5, d - 9, .343);
      pole(trim, x, .46, z, 15.2, .48, 15.2);
      pole(parkWater, x, .72, z, 13.4, .09, 13.4);
      pole(steelPale, x, 1.3, z, .82, 1.3);
      pole(parkWater, x, 2.0, z, 3.6, .22);
      solid(x, z, 10, 10, .85, false);
      for (const sx of [-1, 1]) {
        for (const sz of [-1, 1]) {
          deciduous(x + sx * 25, z + sz * 25, range(4.7, 6.4));
          deciduous(x + sx * 16, z + sz * 16, range(4.5, 5.4));
          bench(x + sx * 12, z + sz * 4, sz > 0 ? 0 : Math.PI);
        }
      }
      sign('白汐公园', 'BAIXI COMMONS', '#b6efad', x + 10, 2.22, z + d / 2 - 2, 6.5, 1.85, 0);
    }
    function container(x, z, color, tall = false, yaw = 0) {
      const w = 13.4;
      const d = 4.4;
      const y = tall ? 4.58 : 2.3;
      box(color, x, y - 1.07, z, w, 2.18, d, yaw);
      const dx = Math.cos(yaw);
      const dz = -Math.sin(yaw);
      for (let i = -6; i < 6.6; i += .8) {
        box(color, x + i * dx - dz * 2.22, y - 1.02, z + i * dz + dx * 2.22, .17, 1.97, .18, yaw);
        box(color, x + i * dx + dz * 2.22, y - 1.02, z + i * dz - dx * 2.22, .17, 1.97, .18, yaw);
      }
      if (!tall) solid(x, z, Math.abs(dx) > .5 ? w : d, Math.abs(dx) > .5 ? d : w, 4.6);
    }
    function warehouse(x, z, w, d, color, label) {
      box(color, x, 3.96, z, w, 7.45, d);
      box(roof, x - w * .24, 7.85, z, w * .55, .47, d + .8, 0, 0, .21);
      box(roof, x + w * .24, 7.85, z, w * .55, .47, d + .8, 0, 0, -.21);
      for (const part of [-.29, 0, .29]) {
        box(door, x + w * part, 2, z + d / 2 + .09, w * .23, 3.7, .23);
        for (let y = .5; y < 4; y += .5) box(steelPale, x + w * part, y, z + d / 2 + .24, w * .22, .059, .026);
      }
      for (let wx = x - w / 2 + 1; wx < x + w / 2; wx += 5.7) box(glass[2], wx, 6.15, z + d / 2 + .13, 3.2, .73, .15);
      if (label) sign(label, 'SOUTH TERMINAL', '#ffda95', x, 5.05, z + d / 2 + .29, 11, 2.86, 0);
      solid(x, z, w, d, 9.1);
    }
    function garage(x, z) {
      box(cityColors[0], x, 2.74, z, 19, 5.3, 29);
      box(shopColors[4], x, 5.63, z, 20.6, .43, 30.3);
      box(rust, x + 10.25, 3.86, z, 26, .16, 1.54, Math.PI / 2, .09);
      for (const offset of [-8.4, 0, 8.4]) {
        box(steel, x + 9.55, 1.75, z + offset, .28, 3.2, 6.7);
        box(choose(lightGlass), x + 9.71, 2.85, z + offset, .12, .6, 6.4);
        for (let y = .44; y < 2.45; y += .38) box(steelPale, x + 9.72, y, z + offset, .043, .07, 6.25);
      }
      sign('潮汛修车铺', 'TIDE AUTO WORKS', '#96f6db', x + 9.78, 4.70, z, 14.2, 2.3, Math.PI / 2);
      box(tealBulb, x + 10.27, 3.68, z, .15, .13, 20.6);
      solid(x, z, 19, 29, 5.81);
    }
    function* blocks() {
      for (let xi = 0; xi < X.length - 1; xi++) {
        for (let zi = 0; zi < Z.length - 1; zi++) {
          const width = X[xi + 1] - X[xi] - 22.7;
          const depth = Z[zi + 1] - Z[zi] - 22.7;
          const x = (X[xi] + X[xi + 1]) / 2;
          const z = (Z[zi] + Z[zi + 1]) / 2;
          lot(x, z, width, depth);
          if (xi === 5 && zi >= 2 && zi <= 4 && window.Tideline.addBoulevardBlock) {
            boulevard = true;
            const built = window.Tideline.addBoulevardBlock(boulevardAssets, { zi, x, z, width, depth });
            boulevard = false;
            if (built) continue;
          }
          if (xi === 3 && zi === 3) {
            park(x, z, width, depth);
            continue;
          }
          if (xi === 5 && zi === 4) {
            garage(263, 127);
            building(216, 143, 27, 35, 16.9, false, Math.PI, true);
            building(261, 176, 24, 19, 9.1, false, Math.PI / 2, true);
            for (let k = 0; k < 6; k++) ground(roadMark, 274, 146 + k * 6.2, 6.2, .14, .206);
            palm(270, 153);
            continue;
          }
          if (xi === 2 && zi === 5 && window.Tideline.addWarehouseVisuals) {
            window.Tideline.addWarehouseVisuals({ T, box, ground, solid, sign, bar, pole, nightMaterials, streetLight, planter });
            continue;
          }
          if (zi === 5 && xi < 5) {
            warehouse(x, z - 18, width * .77, 27, choose(containerMats), xi === 1 ? '南埠货场' : '');
            for (let c = 0; c < 4; c++) {
              const cx = x + (c % 2 ? 13 : -13);
              const cz = z + 10 + Math.floor(c / 2) * 10;
              if (xi === 1 && c === 2) continue;
              container(cx, cz, choose(containerMats));
              if (random() < .6) container(cx, cz, choose(containerMats), true);
            }
            continue;
          }
          const tower = zi < 2 && xi > 0 && xi < 5;
          for (const sx of [-1, 1]) {
            for (const sz of [-1, 1]) {
              const w = width * range(.26, .41);
              const d = depth * range(.25, .41);
              const maxShiftX = Math.max(0, width * .5 - w * .5 - width * .235 - .5);
              const maxShiftZ = Math.max(0, depth * .5 - d * .5 - depth * .235 - .5);
              const bx = x + sx * width * .235 + range(-Math.min(2.4, maxShiftX), Math.min(2.4, maxShiftX));
              const bz = z + sz * depth * .235 + range(-Math.min(2.4, maxShiftZ), Math.min(2.4, maxShiftZ));
              const tier = random();
              const height = tower
                ? (tier < .28 ? range(19, 32) : tier < .72 ? range(34, 54) : range(55, 74)) * (xi === 3 ? 1.14 : 1)
                : (tier < .32 ? range(7.6, 13.5) : tier < .76 ? range(14.5, xi === 5 ? 23 : 26) : range(27, xi === 5 ? 31 : 36));
              building(bx, bz, w, d, height, tower, xi === 5 && sx > 0 ? Math.PI / 2 : sz > 0 ? 0 : Math.PI, !tower && (xi === 5 || random() < .64));
            }
          }
          if (xi === 5) palm(x + width / 2 - 2, z - 2);
          else if (!tower && random() < .62) deciduous(x + width / 2 - 3, z, range(4.5, 6.8));
        }
        yield;
      }
      for (let z = -285; z < 290; z += 43) {
        if (Math.abs(nearest(Z, z) - z) < 13) continue;
        bench(-317, z, Math.PI / 2);
        deciduous(-317, z + 5, 5.2);
      }
      for (let x = -277; x < 260; x += 57) {
        building(x, -314, range(24, 34), range(12, 16), range(9.5, 36), false, 0, random() < .45);
      }
    }

    function crane(x, z, yaw = 0, height = 19) {
      const tangent = Math.cos(yaw);
      const normal = Math.sin(yaw);
      const coord = (a, b) => [x + a * tangent + b * normal, z + b * tangent - a * normal];
      const spar = (material, a, ah, b, c, ch, d, width) => {
        const aa = coord(a, b);
        const bb = coord(c, d);
        bar(material, aa[0], ah, aa[1], bb[0], ch, bb[1], width);
      };
      const yellow = choose([gold, rust]);
      for (const a of [-4.4, 4.4]) {
        for (const b of [-3.6, 3.6]) spar(yellow, a, .1, b, a * .48, height, b * .47, .65);
        spar(steel, a, 1.6, -3.6, a * .55, height - 2, 2.05, .22);
        spar(steel, a, 1.6, 3.6, a * .55, height - 2, -2.05, .22);
      }
      const tip = height + 11;
      for (const b of [-.82, .82]) {
        spar(yellow, -6.5, height, b, 22.4, tip, b, .47);
        spar(yellow, -6.5, height - 2, b, 22.4, tip - 1.4, b, .42);
        for (let i = -5; i < 21; i += 3) {
          spar(yellow, i, height - 1.6 + (i + 6) * .38, b, i + 2.9, height + (i + 9) * .38, b, .17);
        }
      }
      spar(steel, 20.8, tip - 1.7, 0, 20.8, height - 6, 0, .08);
      const c = coord(20.8, 0);
      box(steel, c[0], height - 6, c[1], 1, .52, .65);
      box(glass[2], x, height, z, 3.7, 2.8, 3.5, yaw);
    }
    function shoreline() {
      const promenade = window.Tideline.addPromenadeDetail;
      const redesigned = z => promenade && z >= -110 && z <= 192;
      lot(317.3, 2, 40.8, 650);
      ground(boardwalk, 320, 1.5, 27.8, 650, .202);
      surface(320, 1.5, 27.8, 650, .202);
      if (promenade) surface(316.05, 41, 35.16, 302, .218);
      ground(curb, 334, 0, 1.2, 652, .213);
      for (let z = -319; z < 324; z += 2.1) ground(boardSeam, 320, z, 27.4, .05, .211);
      for (let z = -319; z < 326; z += 13.7) {
        if (redesigned(z)) continue;
        palm(311.5 + range(-1.6, 1.6), z);
        if (Math.round(z) % 2) {
          bench(327.3, z + 4.6, Math.PI / 2);
          planter(326.4, z - 1.8);
        }
      }
      for (const z of [135, 156, 180, 228, 255, -22, -50, -146]) {
        if (!redesigned(z)) planter(304.4, z, leafColors[1]);
      }
      for (const z of [143, 185, 214, 257, -54, -118]) {
        for (let i = 0; i < 3; i++) {
          pole(steelPale, 299.8, .43, z + i * 1.66, .22, .82);
          pole(rust, 299.8, .82, z + i * 1.66, .23, .14);
          solid(299.8, z + i * 1.66, .23, .23, .89, false);
        }
      }
      for (const [z, label] of [[149, '灯塔湾步道'], [-82, '海湾渡轮'], [239, '灯塔入口']]) {
        box(steel, 320.9, 1.20, z, .25, 2.36, 1.07);
        solid(320.9, z, .29, 1.09, 2.39, false);
        sign(label, 'COASTAL WALK', '#ffe3ac', 320.74, 1.57, z, 1.8, .81, -Math.PI / 2);
        sign(label, 'COASTAL WALK', '#ffe3ac', 321.06, 1.57, z, 1.8, .81, Math.PI / 2);
      }
      for (let z = -313; z < 326; z += 28.1) {
        if (!redesigned(z)) streetLight(331, z, -Math.PI / 2);
      }
      let railStart, railEnd;
      for (let z = -320; z < 326; z += 3.65) {
        if (z > 195.3 && z < 219) {
          if (railStart != null) solid(336.5, (railStart + railEnd) / 2, .19, railEnd - railStart, 1.60, false);
          railStart = null;
          continue;
        }
        railStart ??= z - .095;
        railEnd = z + 3.665;
        box(steel, 336.5, .83, z, .19, 1.43, .19);
        box(steelPale, 336.5, 1.52, z + 1.83, .17, .15, 3.67);
        box(steelPale, 336.5, .62, z + 1.83, .078, .085, 3.67);
      }
      solid(336.5, (railStart + railEnd) / 2, .19, railEnd - railStart, 1.60, false);
      ground(boardwalk, 4, 315, 652, 21, .21);
      surface(4, 315, 652, 21, .21);
      let lastRailX;
      for (let x = -317; x < 328; x += 5.6) {
        box(steel, x, .85, 326, .23, 1.4, .24);
        box(steelPale, x + 2.8, 1.54, 326, 5.63, .18, .16);
        lastRailX = x + 5.615;
      }
      solid((lastRailX - 317.115) / 2, 326, lastRailX + 317.115, .24, 1.63, false);
      for (const [x, z] of [[-234, 354], [-143, 352], [-54, 360], [47, 352]]) {
        box(boardwalk, x, -.22, z, 28, 1.1, 55);
        crane(x, z - 5, -Math.PI / 4, range(14.6, 22.2));
      }
      for (const [z, w] of [[-250, 80], [-158, 44], [40, 31]]) {
        box(boardwalk, 336 + w / 2, -.31, z, w, 1.03, 14.8);
        if (w > 35) crane(342 + w / 2, z, -1.2, 17);
        for (let x = 344; x < 336 + w; x += 8) pole(steel, x, -2.1, z - 6.1, .9, 6.4);
      }
      for (const [x, z] of [[385, 34], [410, -171]]) {
        box(tar, x, .15, z, 8.9, 2.9, 24.1);
        box(white, x, 1.81, z, 8.95, .66, 25.5);
        box(rust, x, 1.23, z, 9.03, .25, 25.8);
        box(tar, x, .39, z - 12.7, 7.45, 2.32, 2.0);
        box(white, x, 1.8, z - 12.8, 7.45, .69, 2.5);
        box(white, x, 3.2, z - 3.9, 7.16, 2.19, 11.7);
        box(glass[1], x, 3.56, z - 9.78, 6.7, .76, .23);
        for (const side of [-1, 1]) {
          for (let s = -8.1; s < 1; s += 2.03) box(choose(lightGlass), x + side * 3.62, 3.61, z + s, .17, .66, 1.20);
          box(steelPale, x + side * 4.28, 2.46, z + 4.65, .14, .13, 14.5);
        }
        box(steel, x, 4.27, z - 4.1, 7.45, .21, 12.1);
        pole(steel, x, 5.5, z - 5.6, .24, 2.82);
        box(tealBulb, x, 6.90, z - 5.6, .33, .29, .33);
      }
      pole(trim, 324, .5, 291, 13, .75);
      queue(tapered, white, 324, 4.75, 291, 6.2, 8.2, 6.2);
      pole(rust, 324, 5.00, 291, 5.32, 1.51);
      pole(steelPale, 324, 8.88, 291, 5.05, .35);
      pole(tealBulb, 324, 9.94, 291, 3.27, 1.97);
      queue(tapered, rust, 324, 11.35, 291, 5.0, 1.25, 5.0);
      pole(steel, 324, 12.05, 291, .15, 1.4);
      solid(324, 291, 5.2, 5.2, 11.75);
    }

    roadNetwork();
    yield;
    yield* blocks();
    streetEdges();
    shoreline();
    yield;
    if (window.Tideline.addPromenadeDetail) {
      boulevard = true;
      window.Tideline.addPromenadeDetail(boulevardAssets);
      boulevard = false;
    }
    yield;
    window.Tideline.addMarineCoast?.({ T, scene, box, ground, solid, sign, bar, pole, nightMaterials, streetLight, planter });
    window.Tideline.addPortDetail?.(boulevardAssets);
    yield;
    window.Tideline.addStoryLandmarks?.(boulevardAssets);
    window.Tideline.addNightMarket?.(boulevardAssets);
    yield* bakeStreetShade();
    for (const [x, z, label, direction] of [[302, 113, '灯塔湾', 0], [101, -210, '北桥商务区', 0], [-98, 212, '南埠货场', Math.PI], [-27, 16, '旧城', 0]]) {
      pole(steel, x - 2, 2.14, z, .14, 4.15);
      pole(steel, x + 2, 2.14, z, .14, 4.15);
      sign(label, 'BAIXI HARBOR', '#bee3d8', x, 3.82, z + .09, 5.7, 1.33, direction);
    }
    // Opaque, uniformly painted props can share a draw even when their paint,
    // roughness and metalness differ. Keep maps, signs and animated materials separate.
    const animatedMaterials = new Set(nightMaterials.map(([material]) => material));
    const paintKeys = new Map(), drawGroups = new Map();
    function paintKey(material) {
      if (!instancePaint) return material.uuid;
      if (paintKeys.has(material)) return paintKeys.get(material);
      let key = material.uuid;
      if (material.type === 'MeshStandardMaterial' && !material.transparent && !material.emissive.getHex() &&
          !animatedMaterials.has(material) && material.onBeforeCompile === T.Material.prototype.onBeforeCompile &&
          !Object.values(material).some(value => value?.isTexture)) {
        const properties = material.toJSON();
        for (const field of ['uuid', 'name', 'metadata', 'userData', 'color', 'roughness', 'metalness']) delete properties[field];
        key = JSON.stringify(properties);
      }
      paintKeys.set(material, key);
      return key;
    }
    for (const batch of batches.values()) {
      const key = batch.geo.id + ':' + Number(batch.casts) + ':' + paintKey(batch.material);
      if (!drawGroups.has(key)) drawGroups.set(key, []);
      drawGroups.get(key).push(batch);
    }
    function streetPaint(original) {
      const result = original.clone();
      result.color.setRGB(1, 1, 1);
      result.roughness = result.metalness = 1;
      result.onBeforeCompile = shader => {
        const varyings = 'varying vec3 vStreetInk;\nvarying vec2 vStreetFinish;\n';
        shader.vertexShader = 'attribute vec3 streetInk;\nattribute vec2 streetFinish;\n' + varyings +
          shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvStreetInk = streetInk; vStreetFinish = streetFinish;');
        shader.fragmentShader = varyings + shader.fragmentShader
          .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb *= vStreetInk;')
          .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor *= vStreetFinish.x;')
          .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nmetalnessFactor *= vStreetFinish.y;');
      };
      result.customProgramCacheKey = () => 'baixi-static-instance-paint-v1';
      return result;
    }
    for (const groups of drawGroups.values()) {
      const { geo, material, casts } = groups[0];
      const mainCount = groups.reduce((n, group) => n + group.core.length, 0);
      const count = groups.reduce((n, group) => n + group.detail.length, mainCount);
      const pooled = groups.length > 1;
      const ink = pooled ? new T.InstancedInterleavedBuffer(new Float32Array(count * 5), 5).setUsage(T.DynamicDrawUsage) : null;
      let geometry = geo;
      if (ink) {
        // Geometry attributes and indices are immutable and shared with the source.
        geometry = new T.BufferGeometry();
        geometry.setIndex(geo.index);
        for (const [name, attribute] of Object.entries(geo.attributes)) geometry.setAttribute(name, attribute);
        geometry.setDrawRange(geo.drawRange.start, geo.drawRange.count);
        geometry.setAttribute('streetInk', new T.InterleavedBufferAttribute(ink, 3, 0));
        geometry.setAttribute('streetFinish', new T.InterleavedBufferAttribute(ink, 2, 3));
      }
      const mesh = new T.InstancedMesh(geometry, pooled ? streetPaint(material) : material, count);
      mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);
      let coreIndex = 0, detailIndex = mainCount;
      for (const group of groups) {
        const m = group.material;
        for (const list of [group.core, group.detail]) {
          for (const matrix of list) {
            const index = list === group.core ? coreIndex++ : detailIndex++;
            mesh.setMatrixAt(index, matrix);
            if (ink) {
              const base = index * 5;
              m.color.toArray(ink.array, base);
              ink.array[base + 3] = m.roughness;
              ink.array[base + 4] = m.metalness;
            }
          }
        }
      }
      mesh.matrixAutoUpdate = false;
        mesh.matrixWorldAutoUpdate = false;
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingSphere();
      mesh.receiveShadow = material.isMeshStandardMaterial && !material.transparent;
      mesh.castShadow = casts && mesh.receiveShadow;
      scene.add(mesh);
      if (!geo.boundingBox) geo.computeBoundingBox();
      const center = geo.boundingBox.getCenter(new T.Vector3());
      const half = geo.boundingBox.getSize(new T.Vector3()).multiplyScalar(.5);
      const matrices = mesh.instanceMatrix.array.slice();
      const bounds = new Float32Array(mesh.count * 5);
      for (let i = 0; i < mesh.count; i++) {
        const offset = i * 16;
        const xx = matrices[offset];
        const xy = matrices[offset + 4];
        const xz = matrices[offset + 8];
        const zx = matrices[offset + 2];
        const zy = matrices[offset + 6];
        const zz = matrices[offset + 10];
        const yx = matrices[offset + 1], yy = matrices[offset + 5], yz = matrices[offset + 9];
        bounds[i * 5] = xx * center.x + xy * center.y + xz * center.z + matrices[offset + 12];
        bounds[i * 5 + 1] = yx * center.x + yy * center.y + yz * center.z + matrices[offset + 13];
        bounds[i * 5 + 2] = zx * center.x + zy * center.y + zz * center.z + matrices[offset + 14];
        const x = Math.abs(xx) * half.x + Math.abs(xy) * half.y + Math.abs(xz) * half.z;
        const y = Math.abs(yx) * half.x + Math.abs(yy) * half.y + Math.abs(yz) * half.z;
        const z = Math.abs(zx) * half.x + Math.abs(zy) * half.y + Math.abs(zz) * half.z;
        bounds[i * 5 + 3] = Math.hypot(x, z);
        bounds[i * 5 + 4] = Math.hypot(x, y, z);
      }
      const visibleIndices = Int32Array.from({ length: mesh.count }, (_, i) => i);
      const batch = { mesh, matrices, bounds, visibleIndices, mainCount, ink, paints: ink?.array.slice() };
      streetBatches.push(batch);
      if (geo.userData.closeStreet) closeStreetBatches.push(batch);
      if (streetBatches.length % 12 === 0) yield;
    }
    batches.clear();
    drawGroups.clear();
    paintKeys.clear();

    const streetPosition = new T.Vector3(Infinity, 0, 0), streetRotation = new T.Quaternion();
    const streetFrustum = new T.Frustum(), streetProjection = new T.Matrix4();
    let streetFov, streetAspect;
    let streetDistance = 0;

    function uploadSpan(attribute, start, end) {
      // An off-screen batch can still have a previous range awaiting upload.
      const prior = attribute.updateRanges[0];
      if (prior) {
        start = Math.min(start, prior.start);
        end = Math.max(end, prior.start + prior.count);
      }
      attribute.clearUpdateRanges();
      attribute.addUpdateRange(start, end - start);
      attribute.needsUpdate = true;
    }
    function setDetail(full, range = full ? 0 : 244) {
      if (Boolean(surfaceDetail.value) === full && streetDistance === range) return;
      surfaceDetail.value = Number(full);
      const restore = streetDistance && !range;
      streetDistance = range;
      streetPosition.x = Infinity;
      if (!restore) return;
      for (const { mesh, matrices, visibleIndices, ink, paints } of streetBatches) {
        mesh.instanceMatrix.array.set(matrices);
        if (ink) {
          ink.array.set(paints);
          uploadSpan(ink, 0, paints.length);
        }
        for (let i = 0; i < visibleIndices.length; i++) visibleIndices[i] = i;
        mesh.instanceMatrix.clearUpdateRanges();
        mesh.instanceMatrix.addUpdateRange(0, matrices.length);
        mesh.instanceMatrix.needsUpdate = true;
        mesh.count = matrices.length / 16;
        mesh.visible = mesh.count > 0;
      }
    }

    function updateVisibleStreet(camera) {
      if (!streetDistance && !closeStreetBatches.length) return;
      if (streetPosition.distanceToSquared(camera.position) < 16 && streetAspect === camera.aspect &&
          Math.abs(camera.fov - streetFov) < 1 && Math.abs(streetRotation.dot(camera.quaternion)) > .9976) return;
      streetPosition.copy(camera.position);
      streetRotation.copy(camera.quaternion);
      streetAspect = camera.aspect;
      streetFov = camera.fov;
      const { x, y, z } = streetPosition;
      const range = Math.ceil(streetDistance * Math.max(1, camera.aspect / 2.4));
      camera.updateMatrixWorld();
      streetFrustum.setFromProjectionMatrix(streetProjection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
      const trimRange = surfaceDetail.value > .5 ? 67 : 37;
      for (const { mesh, matrices, bounds, visibleIndices, mainCount, ink, paints } of streetDistance ? streetBatches : closeStreetBatches) {
        const upload = mesh.instanceMatrix;
        let count = 0, firstDirty = visibleIndices.length, lastDirty = -1;
        for (let i = 0, at = 0; i < visibleIndices.length; i++, at += 5) {
          const px = bounds[at], py = bounds[at + 1], pz = bounds[at + 2];
          const dx = px - x, dz = pz - z, span = dx * dx + dz * dz;
          const reach = (i < mainCount ? range : trimRange) + bounds[at + 3] + 4;
          if (span > reach * reach) continue;
          if (streetDistance) {
            // Allow four metres and the full camera rotation between culls.
            // High quality also draws mirrors and shadows from outside the main view.
            const dy = py - y, margin = bounds[at + 4] + 4.1 + .17 * Math.sqrt(span + dy * dy);
            let outside = false;
            for (let plane = 0; plane < 4; plane++) {
              const { normal, constant } = streetFrustum.planes[plane];
              if (normal.x * px + normal.y * py + normal.z * pz + constant < -margin) { outside = true; break; }
            }
            if (outside) continue;
          }
          if (visibleIndices[count] !== i) {
            const source = i * 16, dest = count * 16;
            for (let part = 0; part < 16; part++) upload.array[dest + part] = matrices[source + part];
            if (ink) for (let part = 0; part < 5; part++) ink.array[count * 5 + part] = paints[i * 5 + part];
            visibleIndices[count] = i;
            firstDirty = Math.min(firstDirty, count);
            lastDirty = count;
          }
          count++;
        }
        mesh.count = count;
        mesh.visible = count > 0;
        if (lastDirty >= firstDirty) {
          uploadSpan(upload, firstDirty * 16, (lastDirty + 1) * 16);
          if (ink) uploadSpan(ink, firstDirty * 5, (lastDirty + 1) * 5);
        }
      }
    }

    const duskImage = { value: 0 };
    const duskPhoto = textureLoader.load('assets/baixi-dusk.webp', () => { duskImage.value = 1; });
    duskPhoto.colorSpace = T.SRGBColorSpace;
    duskPhoto.anisotropy = 4;
    const headlandReady = { value: 0 };
    const headlandArt = textureLoader.load('assets/harbor-headland.webp', () => { headlandReady.value = 1; });
    headlandArt.colorSpace = T.SRGBColorSpace;
    const skyUniforms = {
      topColor: { value: new T.Color() }, lowColor: { value: new T.Color() },
      sunColor: { value: new T.Color() }, sun: { value: new T.Vector3(.74, .19, -.64).normalize() },
      daylight: { value: 1 }, stars: { value: 0 }, overcast: { value: 0 }, time: weatherTime,
      duskPhoto: { value: duskPhoto }, duskImage, duskMix: { value: 0 },
      headland: { value: headlandArt }, headlandReady, night: { value: 0 },
    };
    const sky = new T.Mesh(new T.SphereGeometry(1250, 32, 20), new T.ShaderMaterial({
      side: T.BackSide, depthWrite: false, uniforms: skyUniforms, fog: false,
      vertexShader: [
        'varying vec3 vDir;',
        'void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      ].join('\n'),
      fragmentShader: [
        'varying vec3 vDir;',
        'uniform vec3 topColor, lowColor, sunColor, sun;',
        'uniform float daylight, stars, overcast, time, duskMix, duskImage, headlandReady, night;',
        'uniform sampler2D duskPhoto, headland;',
        'float hash(vec2 p) { return fract(sin(dot(p,vec2(15.47,87.83)))*43758.545); }',
        'float vaporHash(vec2 p){ vec3 r=fract(vec3(p.xyx)*.1031); r+=dot(r,r.yzx+33.33); return fract((r.x+r.y)*r.z); }',
        'float vaporNoise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);',
        '  return mix(mix(vaporHash(i),vaporHash(i+vec2(1,0)),f.x),mix(vaporHash(i+vec2(0,1)),vaporHash(i+1.),f.x),f.y); }',
        'float cloudFbm(vec2 p){',
        '  return vaporNoise(p) + .49*vaporNoise(p*2.07+vec2(7.1,-3.4)) + .24*vaporNoise(p*4.31+vec2(-4.2,5.8)) + .11*vaporNoise(p*8.4+vec2(5.3,2.1));',
        '}',
        'void main(){',
        '  vec3 d = normalize(vDir); float h = max(0.0,d.y);',
        '  float azimuth = atan(d.x,-d.z);',
        '  float towardSun = max(0.,dot(d,sun));',
        '  float mie = pow(towardSun,4.0);',
        '  float glow = pow(towardSun,11.0);',
        '  float halo = pow(towardSun,110.0);',
        '  float disk = smoothstep(.99988,.99994,towardSun);',
        '  float duskBand = exp(-6.8*max(0.,h-.018));',
        '  vec3 midSky = mix(lowColor,topColor,.46) + sunColor*daylight*duskBand*.09;',
        '  vec3 col = mix(lowColor,midSky,smoothstep(0.,.22,h));',
        '  col = mix(col,topColor,smoothstep(.16,.76,pow(h,.74)));',
        '  col += daylight * sunColor * (.15*duskBand + mie*.12 + glow*.28 + halo*.68);',
        '  vec2 wind = d.xz/(h+.24);',
        '  vec2 bank = vec2(wind.x*.8+wind.y*.36,wind.y*.78-wind.x*.22) + vec2(time*.0024,-time*.0012);',
        '  vec2 layers = bank*vec2(1.75,3.05);',
        '  float shape = cloudFbm(layers);',
        '  vec2 sunShift = normalize(sun.xz + vec2(.001)) * .16;',
        '  float litSample = cloudFbm(layers + sunShift);',
        '  float cloudLight = clamp(.52 + (shape - litSample) * 1.45, 0., 1.);',
        '  float cirrus = smoothstep(.88-overcast*.12,1.38-overcast*.10,vaporNoise(bank*vec2(3.6,1.2)+vec2(time*.004,0.)) + .45*vaporNoise(bank*vec2(7.4,2.8)));',
        '  float horizonMask = smoothstep(.010,.11,h)*(1.-smoothstep(.60,1.,h));',
        '  float clouds = smoothstep(.68-overcast*.15,1.20-overcast*.16,shape)*horizonMask;',
        '  float cloudRim = smoothstep(.64,.92,shape)*(1.-smoothstep(.94,1.24,shape))*horizonMask;',
        '  vec3 cloudBase = mix(topColor*.58 + lowColor*.22, lowColor*.76 + sunColor*.22, cloudLight*.65 + glow*.35);',
        '  vec3 cloudLit = mix(lowColor*.92 + sunColor*.28, sunColor*1.12, glow*.62 + duskBand*.28);',
        '  vec3 cloudColor = mix(cloudBase, cloudLit, clamp(cloudLight*.75 + glow*.35, 0., 1.) * (1.-night*.68));',
        '  col = mix(col, mix(lowColor, sunColor, .35*daylight), cirrus*horizonMask*(.22+overcast*.15)*(1.-night*.55));',
        '  col = mix(col, cloudColor, clouds*(.60+overcast*.32));',
        '  col += sunColor*daylight*cloudRim*(.12 + glow*.34 + duskBand*.18);',
        '  float plate=0.;',
        '  if(duskMix*duskImage>.01){',
        '    float bearing=azimuth-atan(sun.x,-sun.z);',
        '    float offset=atan(sin(bearing),cos(bearing));',
        '    float u=.488+offset/2.714;',
        '    float v=clamp(asin(h)*.63-.011,0.,.998);',
        '    plate=duskMix*duskImage*smoothstep(.004,.055,h)*smoothstep(0.,.19,min(u,1.-u));',
        '    vec3 photo=texture2D(duskPhoto,vec2(clamp(u,.001,.999),v)).rgb;',
        '    photo=mix(photo,vec3(dot(photo,vec3(.2126,.7152,.0722))),.14)*vec3(.92,.91,1.02);',
        '    col=mix(col,photo,plate*.82);',
        '  }',
        '  col += sunColor*daylight*disk*(1.-clouds*.92)*(1.-plate*.65)*3.1;',
        '  float moonMask = night * (1.-overcast*.88);',
        '  float moonDisk = smoothstep(.99982,.99990,towardSun);',
        '  float moonHalo = pow(towardSun,48.0)*.22 + pow(towardSun,180.0)*.34;',
        '  col += vec3(.86,.92,1.0) * moonMask * (moonHalo + moonDisk*1.85) * (1.-clouds*.85);',
        '  vec2 starUV = vec2(azimuth*186.0, d.y*311.0);',
        '  float starSeed = hash(floor(starUV));',
        '  float twinkle = .72 + .28*sin(time*2.6 + starSeed*62.8);',
        '  float star = step(.9935,starSeed) * (1.0-smoothstep(.06,.24,length(fract(starUV)-.5))) * twinkle;',
        '  vec3 starTint = mix(vec3(.82,.90,1.0), vec3(1.0,.92,.76), fract(starSeed*37.1));',
        '  col += starTint * (star * stars * smoothstep(.04,.34,h) * .68);',
        '  float coastU = .5 + (azimuth-.66)/1.91;',
        '  float coastV = (d.y+.023)/.229;',
        '  if(headlandReady>.5 && coastU>0. && coastU<1. && coastV>0. && coastV<1.){',
        '    vec4 relief = texture2D(headland,vec2(coastU,coastV));',
        '    vec3 rock = relief.rgb * mix(vec3(1.22,1.20,1.18),vec3(.24,.34,.50),night);',
        '    vec3 air = mix(lowColor,topColor,mix(.48,.78,smoothstep(.05,.75,coastV)));',
        '    rock = mix(rock,air,.16+.14*(1.-coastV)+overcast*.28);',
        '    float shore = smoothstep(.0,.092,coastV)*smoothstep(.025,.133,min(coastU,1.-coastU));',
        '    col = mix(col,rock,relief.a*shore);',
        '  }',
        '  gl_FragColor = vec4(col,1.0);',
        '  #include <tonemapping_fragment>',
        '  #include <colorspace_fragment>',
        '}',
      ].join('\n'),
    }));
    sky.renderOrder = 900;
    sky.frustumCulled = false;
    scene.add(sky);

    const headland = window.Tideline.MARINE?.island;
    const mainDockRect = window.Tideline.MARINE?.mainDock;
    const islandDockRect = window.Tideline.MARINE?.islandDock;
    const seaUniforms = {
      time: { value: 0 }, base: { value: new T.Color() }, pale: { value: new T.Color() },
      haze: { value: new T.Color() }, shine: { value: new T.Color() },
      skyTop: skyUniforms.topColor, skyLow: skyUniforms.lowColor, sunColor: skyUniforms.sunColor,
      sun: skyUniforms.sun, day: { value: 1 },
      island: { value: headland ? new T.Vector4(headland.x, headland.z, headland.rx, headland.rz) : new T.Vector4(4000, 4000, 1, 1) },
      dockA: { value: mainDockRect ? new T.Vector4(mainDockRect.minX, mainDockRect.minZ, mainDockRect.maxX, mainDockRect.maxZ) : new T.Vector4(4000, 4000, 4001, 4001) },
      dockB: { value: islandDockRect ? new T.Vector4(islandDockRect.minX, islandDockRect.minZ, islandDockRect.maxX, islandDockRect.maxZ) : new T.Vector4(4000, 4000, 4001, 4001) },
      waterMirror: roadReflection.image, mirrorProject: roadReflection.projection, reflection: roadReflection.waterStrength,
      rain: raining,
    };
    const waterGeo = new T.PlaneGeometry(3200, 3200, 128, 128);
    {
      const pos = waterGeo.getAttribute('position');
      const warpAxis = (v, center) => {
        const span = v >= center ? 1600 - center : 1600 + center;
        const t = Math.abs(v - center) / span;
        return center + Math.sign(v - center) * span * (.28 * t + .72 * t * t * t);
      };
      for (let i = 0; i < pos.count; i++) {
        pos.setXY(i, warpAxis(pos.getX(i), 380), warpAxis(pos.getY(i), -140));
      }
      pos.needsUpdate = true;
    }
    const water = new T.Mesh(waterGeo, new T.ShaderMaterial({
      uniforms: seaUniforms,
      vertexShader: [
        'uniform float time;',
        'uniform vec4 island,dockA,dockB;',
        'varying vec3 vWorld;',
        'varying float vWaveH;',
        'float rectDist(vec2 p, vec4 r){ return length(p - clamp(p, r.xy, r.zw)); }',
        'void main(){',
        '  vec4 world = modelMatrix * vec4(position, 1.0);',
        '  vec2 p = world.xz;',
        '  float fromIsland = max(0.0, length((p - island.xy) / island.zw) - 1.0) * island.w;',
        '  float fromCoast = length(p - clamp(p, vec2(-326.0, -324.0), vec2(339.0, 328.0)));',
        '  float fromDock = min(rectDist(p, dockA), rectDist(p, dockB));',
        '  float calm = smoothstep(1.2, 16.0, min(min(fromIsland, fromCoast), fromDock));',
        '  float farFade = 1.0 - smoothstep(420.0, 1300.0, distance(cameraPosition.xz, p));',
        '  float w1 = sin(dot(p, vec2(0.095, 0.062)) + time * 1.15);',
        '  float w2 = sin(dot(p, vec2(-0.145, 0.118)) + time * 1.52 + 1.4);',
        '  float w3 = sin(dot(p, vec2(0.24, -0.175)) - time * 1.95 + 0.7);',
        '  float w4 = sin(dot(p, vec2(-0.052, -0.088)) + time * 0.78);',
        '  float h = (w1 * 0.42 + w2 * 0.28 + w3 * 0.16 + w4 * 0.14);',
        '  float amp = mix(0.014, 0.155, calm) * farFade;',
        '  world.y += h * amp;',
        '  vWorld = world.xyz;',
        '  vWaveH = h * (0.35 + 0.65 * calm);',
        '  gl_Position = projectionMatrix * viewMatrix * world;',
        '}',
      ].join('\n'),
      fragmentShader: [
        'uniform float time,day,reflection,rain;',
        'uniform vec3 base,pale,haze,shine,sun,skyTop,skyLow,sunColor;',
        'uniform vec4 island,dockA,dockB;',
        'uniform sampler2D waterMirror; uniform mat4 mirrorProject;',
        'varying vec3 vWorld;',
        'varying float vWaveH;',
        'float seaHash(vec2 p){ vec3 a = fract(vec3(p.xyx) * vec3(0.1031, 0.0973, 0.1099)); a += dot(a, a.yzx + 33.33); return fract((a.x + a.y) * a.z); }',
        'float seaNoise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(seaHash(i), seaHash(i + vec2(1.0, 0.0)), f.x), mix(seaHash(i + vec2(0.0, 1.0)), seaHash(i + 1.0), f.x), f.y); }',
        'float seaFbm(vec2 p){ return seaNoise(p) * 0.64 + seaNoise(p * 2.13 + vec2(4.7, -3.1)) * 0.36; }',
        'float rectDist(vec2 p, vec4 r){ return length(p - clamp(p, r.xy, r.zw)); }',
        'void main(){',
        '  vec2 p = vWorld.xz;',
        '  vec3 v = normalize(cameraPosition - vWorld);',
        '  float dist = distance(cameraPosition, vWorld);',
        '  float detail = 1.0 - smoothstep(0.09, 1.35, max(length(dFdx(p)), length(dFdy(p))));',
        '  // Multi-directional swells with analytical slope derivatives',
        '  vec2 k1 = vec2(0.095, 0.062); float p1 = dot(p, k1) + time * 1.15;',
        '  vec2 k2 = vec2(-0.145, 0.118); float p2 = dot(p, k2) + time * 1.52 + 1.4;',
        '  vec2 k3 = vec2(0.24, -0.175); float p3 = dot(p, k3) - time * 1.95 + 0.7;',
        '  vec2 k4 = vec2(0.46, 0.34); float p4 = dot(p, k4) + time * 2.25 + sin(p1) * 0.7;',
        '  vec2 k5 = vec2(-0.68, 0.41); float p5 = dot(p, k5) - time * 2.65 + sin(p2) * 0.6;',
        '  float s1 = sin(p1), s2 = sin(p2), s3 = sin(p3), s4 = sin(p4), s5 = sin(p5);',
        '  vec2 slope = k1 * (cos(p1) * 0.52) + k2 * (cos(p2) * 0.36) + k3 * (cos(p3) * 0.24);',
        '  slope += (k4 * (cos(p4) * 0.17) + k5 * (cos(p5) * 0.13)) * detail;',
        '  // Animated micro-ripple normal perturbation',
        '  vec2 uvA = p * 0.36 + vec2(time * 0.28, -time * 0.19);',
        '  vec2 uvB = p * 0.78 + vec2(-time * 0.36, time * 0.31);',
        '  float nA = seaNoise(uvA), nB = seaNoise(uvB);',
        '  float nAx = seaNoise(uvA + vec2(0.18, 0.0)) - nA;',
        '  float nAz = seaNoise(uvA + vec2(0.0, 0.18)) - nA;',
        '  float nBx = seaNoise(uvB + vec2(0.14, 0.0)) - nB;',
        '  float nBz = seaNoise(uvB + vec2(0.0, 0.14)) - nB;',
        '  slope += (vec2(nAx, nAz) * 0.42 + vec2(nBx, nBz) * 0.26) * detail;',
        '  if(rain > 0.02 && detail > 0.05){',
        '    vec2 cell = fract(p * 0.95) - 0.5;',
        '    float seed = seaHash(floor(p * 0.95));',
        '    float rPhase = fract(time * 1.45 + seed);',
        '    float rDist = length(cell);',
        '    float ring = sin((rDist - rPhase * 0.42) * 46.0) * exp(-abs(rDist - rPhase * 0.42) * 26.0) * (1.0 - rPhase);',
        '    slope += normalize(cell + 0.001) * ring * rain * 0.18 * detail;',
        '  }',
        '  vec3 n = normalize(vec3(-slope.x, 1.0, -slope.y));',
        '  float crest = clamp(0.5 + 0.26 * vWaveH + 0.14 * s1 + 0.10 * s2 + (0.08 * s4 + 0.06 * s5) * detail, 0.0, 1.0);',
        '  // Shore and depth distances (coastline, island, docks)',
        '  float fromIsland = max(0.0, length((p - island.xy) / island.zw) - 1.0) * island.w;',
        '  float fromCoast = length(p - clamp(p, vec2(-326.0, -324.0), vec2(339.0, 328.0)));',
        '  float shore = min(fromIsland, fromCoast);',
        '  float dockDist = min(rectDist(p, dockA), rectDist(p, dockB));',
        '  float foamEdgeDist = min(shore, dockDist);',
        '  // Shallow-to-deep water absorption gradient',
        '  float shallows = 1.0 - smoothstep(0.8, 28.0, shore);',
        '  float deepSea = smoothstep(26.0, 210.0, shore);',
        '  vec3 deepColor = base * vec3(0.46, 0.66, 0.88);',
        '  vec3 midColor = base * (0.90 + 0.24 * crest);',
        '  vec3 shallowColor = mix(base, pale, 0.56) * vec3(0.62, 1.28, 1.17);',
        '  vec3 waterBody = mix(midColor, deepColor, deepSea * 0.72);',
        '  waterBody = mix(waterBody, shallowColor, shallows * 0.72);',
        '  // Subtle shallow-water caustic shimmer near shore',
        '  float caustics = pow(seaNoise(p * 0.9 + vec2(time * 0.45, -time * 0.35)), 3.0) * shallows * detail * day;',
        '  waterBody += vec3(0.16, 0.36, 0.34) * caustics * 0.55;',
        '  // Subsurface scattering through backlit wave crests',
        '  float sssView = pow(clamp(dot(v, -sun + n * 0.48), 0.0, 1.0), 3.0);',
        '  float sssCrest = smoothstep(0.32, 0.88, crest) * (0.35 + 0.65 * shallows + 0.55 * sssView);',
        '  waterBody += mix(vec3(0.05, 0.34, 0.34), vec3(0.14, 0.52, 0.46), shallows) * sssCrest * (0.28 + 0.72 * day);',
        '  // Physically grounded Schlick Fresnel + sky reflection',
        '  float ndotv = max(0.0, dot(v, n));',
        '  float fresnel = 0.02 + 0.98 * pow(1.0 - ndotv, 5.0);',
        '  vec3 reflDir = reflect(-v, n);',
        '  float skyElev = clamp(reflDir.y, 0.0, 1.0);',
        '  vec3 skyRefl = mix(skyLow, skyTop, pow(skyElev, 0.58));',
        '  float sunHalo = pow(max(0.0, dot(reflDir, sun)), 6.0);',
        '  skyRefl += sunColor * sunHalo * (0.22 + 0.35 * day) * (1.0 - rain * 0.65);',
        '  vec3 col = mix(waterBody, skyRefl, clamp(fresnel * 0.88 + 0.06, 0.0, 0.92));',
        '  // Planar mirror reflection when enabled',
        '  if(reflection > 0.01){',
        '    vec4 projected = mirrorProject * vec4(vWorld, 1.0);',
        '    vec2 at = projected.xy / max(0.01, projected.w);',
        '    float border = smoothstep(0.014, 0.111, min(min(at.x, at.y), 1.0 - max(at.x, at.y))) * step(0.02, projected.w);',
        '    vec2 ripple = slope * (0.042 + 0.016 * rain);',
        '    vec3 sampleColor = texture2D(waterMirror, clamp(at + ripple, 0.001, 0.999), 0.85 + 0.95 * rain).rgb;',
        '    col = mix(col, sampleColor * vec3(0.76, 0.90, 0.92), clamp(fresnel * 1.15, 0.12, 0.82) * border * reflection * 0.72);',
        '  }',
        '  // Dual-lobe sun & moon specular glitter',
        '  float rdotSun = max(0.0, dot(reflDir, sun));',
        '  float broadSpec = pow(rdotSun, 26.0) * 0.34;',
        '  float crispSpec = pow(rdotSun, 240.0) * (1.85 + 1.55 * detail) * smoothstep(0.22, 0.78, crest + nB * 0.25);',
        '  float specVis = (0.20 + 0.80 * day) * (1.0 - rain * 0.68);',
        '  col += shine * (broadSpec + crispSpec) * specVis;',
        '  // Organic shoreline surf bands, waterline contact foam & open-sea whitecaps',
        '  float foamNoise = seaFbm(p * 0.42 + vec2(time * 0.18, -time * 0.14));',
        '  float fineFoam = seaNoise(p * 1.65 - vec2(time * 0.35, time * 0.22));',
        '  float contact = (1.0 - smoothstep(0.25, 2.6, foamEdgeDist)) * smoothstep(0.24, 0.72, foamNoise * 0.75 + fineFoam * 0.45);',
        '  float surfWave = sin(shore * 1.12 - time * 1.55 + foamNoise * 3.4);',
        '  float surfBand = pow(1.0 - smoothstep(0.4, 15.5, shore), 1.8) * smoothstep(0.58, 0.94, surfWave) * smoothstep(0.32, 0.76, foamNoise + fineFoam * 0.35);',
        '  float whitecap = smoothstep(0.74, 0.95, crest + (foamNoise - 0.5) * 0.26) * smoothstep(10.0, 42.0, shore) * (0.28 + 0.72 * detail) * 0.36;',
        '  float foamMask = clamp(contact * 0.88 + surfBand * 0.72 + whitecap, 0.0, 1.0);',
        '  vec3 foamTint = mix(vec3(0.42, 0.54, 0.65), mix(vec3(0.94, 0.97, 0.96), sunColor, 0.16), day);',
        '  col = mix(col, foamTint, foamMask * (0.38 + 0.52 * day));',
        '  // Horizon atmospheric haze',
        '  col = mix(col, haze, pow(clamp((dist - 38.0) / 965.0, 0.0, 1.0), 0.83) * 0.91);',
        '  gl_FragColor = vec4(col, 1.0);',
        '  #include <tonemapping_fragment>',
        '  #include <colorspace_fragment>',
        '}',
      ].join('\n'),
    }));
    water.rotation.x = -Math.PI / 2;
    water.position.y = -.47;
    water.renderOrder = 400;
    scene.add(water);

    const fog = new T.Fog('#a49b90', 96, 628);
    scene.fog = fog;
    const hemi = new T.HemisphereLight('#b5c5d8', '#71645a', 1.37);
    const sun = new T.DirectionalLight('#ffcc9a', 2.55);
    sun.shadow.mapSize.set(1536, 1536);
    Object.assign(sun.shadow.camera, { left: -76, right: 76, top: 76, bottom: -76, near: 80, far: 370 });
    sun.shadow.camera.updateProjectionMatrix();
    sun.shadow.normalBias = .065;
    sun.shadow.bias = -.00013;
    sun.shadow.autoUpdate = false;
    const lamps = [new T.PointLight('#fff2ce', 0, 22, 2), new T.PointLight('#b9fffb', 0, 22, 2)];
    const headlights = new T.SpotLight('#ffefcf', 0, 46, Math.PI * .19, .71, 2);
    scene.add(hemi, sun, sun.target, ...lamps, headlights, headlights.target);
    const sampledDirection = new T.Vector3();
    const sampledFocus = new T.Vector3(0, 0, -10000);
    const moon = new T.Vector3(-.28, .39, -.86).normalize();
    const groundAtDay = new T.Color('#948677');
    const groundAtNight = new T.Color('#50515a');
    let lastSunSample = -100;

    function localLighting(center, vehicle, night, practicals, elapsed, sunDirection, options) {
      const dynamic = options?.extraLights !== false;
      // Three.js specializes shaders for the number of visible lights. Keep that number fixed within each profile.
      for (const lamp of lamps) {
        lamp.visible = dynamic;
        lamp.intensity = 0;
      }
      headlights.visible = dynamic;
      headlights.intensity = 0;
      const wasCasting = sun.castShadow;
      const shadowSize = options?.shadowSize ?? (options?.shadows ? 1536 : 0);
      sun.castShadow = Boolean(center && shadowSize);
      if (shadowSize && sun.shadow.mapSize.x !== shadowSize) {
        sun.shadow.map?.dispose();
        sun.shadow.map = null;
        sun.shadow.mapSize.set(shadowSize, shadowSize);
        sun.shadow.needsUpdate = true;
      }
      if (!center) {
        sun.target.position.set(0, 0, 0);
        return;
      }
      const closest = [];
      if (dynamic && practicals > .08) {
        for (const item of fixtures) {
          const span = distance(center, item);
          if (span <= item.range + 7) closest.push({ item, span });
        }
        closest.sort((a, b) => a.span - b.span);
      }
      for (const [index, light] of lamps.entries()) {
        const found = closest[index];
        if (!found) continue;
        const { item, span } = found;
        light.position.set(item.x, item.y, item.z);
        light.color.copy(item.color);
        light.distance = item.range;
        light.intensity = item.intensity * practicals * clamp((item.range + 7 - span) / 7, 0, 1);
      }
      if (vehicle && dynamic) {
        const x = Math.sin(vehicle.yaw);
        const z = Math.cos(vehicle.yaw);
        headlights.position.set(vehicle.x + x * 1.91, .71, vehicle.z + z * 1.91);
        headlights.target.position.set(vehicle.x + x * 16, .04, vehicle.z + z * 16);
        headlights.intensity = 13 + practicals * 155;
      }
      if (!sun.castShadow) return;
      const cx = Math.round(center.x / 21) * 21;
      const cz = Math.round(center.z / 21) * 21;
      const fast = shadowSize >= 1400;
      const refresh = night > .82 ? .46 : fast ? .17 : .32;
      const approach = Math.hypot(sampledFocus.x - center.x, sampledFocus.z - center.z) > (fast ? (vehicle ? 1.65 : .85) : 4.2);
      if (!wasCasting || sun.target.position.x !== cx || sun.target.position.z !== cz ||
          sampledDirection.dot(sunDirection) < .9998 || (approach && elapsed - lastSunSample >= refresh)) {
        sun.target.position.set(cx, 0, cz);
        sampledDirection.copy(sunDirection);
        sampledFocus.set(center.x, 0, center.z);
        lastSunSample = elapsed;
        sun.shadow.needsUpdate = true;
      }
    }
    const colorSets = {
      day: ['#4682b4', '#cfe0dc', '#fff3d6', '#1e5869', '#82b6ba', '#b3c4c4', '#ffe7b3', '#cde0ee', '#ffecd0'],
      dusk: ['#233c63', '#df9374', '#ffc78c', '#1f495e', '#6590a2', '#97989f', '#ffbf7d', '#b0cae4', '#ffc990'],
      night: ['#0c1a32', '#394f69', '#b6c8e0', '#0e2536', '#284d62', '#2c3d4f', '#89ace0', '#a6c0e0', '#bcd0eb'],
    };
    for (const key of Object.keys(colorSets)) colorSets[key] = colorSets[key].map(c => new T.Color(c));
    const hourBlend = [skyUniforms.topColor.value, skyUniforms.lowColor.value, skyUniforms.sunColor.value, seaUniforms.base.value,
      seaUniforms.pale.value, fog.color, seaUniforms.shine.value, hemi.color, sun.color];
    const wetFog = new T.Color('#536777');
    function light(hour, elapsed, camera, moisture = .64, rain = 0, local = null) {
      const evening = hour > 14 ? clamp((hour - 15.4) / 2.75, 0, 1) : clamp((8.3 - hour) / 2.5, 0, 1);
      const night = hour > 14 ? clamp((hour - 18.53) / 1.98, 0, 1) : clamp((6.52 - hour) / 2.05, 0, 1);
      const practicals = Math.min(1, evening * .32 + night * .67 + rain * .19);
      for (let i = 0; i < hourBlend.length; i++) {
        hourBlend[i].copy(colorSets.day[i]).lerp(colorSets.dusk[i], evening).lerp(colorSets.night[i], night);
      }
      fog.color.lerp(wetFog, rain * .38);
      fog.near = streetDistance ? 67 - rain * 23 : 91 - evening * 10 - rain * 34;
      fog.far = streetDistance ? streetDistance * .78 - rain * 43 : 628 - rain * 207;
      wet.value = moisture;
      raining.value = rain;
      weatherTime.value = elapsed;
      seaUniforms.time.value = elapsed;
      seaUniforms.haze.value.copy(fog.color);
      seaUniforms.day.value = 1 - night * .92;
      skyUniforms.daylight.value = (1 - night * .93) * (1 - rain * .54);
      skyUniforms.stars.value = night * (1 - rain * .94);
      skyUniforms.overcast.value = rain;
      skyUniforms.night.value = night;
      skyUniforms.duskMix.value = Math.pow(evening, 1.7) * Math.pow(1 - night, 2.35) * (1 - rain * .94) * .84;
      skyUniforms.sun.value.set(.49, .105 + (1 - evening) * .43, -.83).normalize().lerp(moon, night * night).normalize();
      localLighting(local?.center, local?.vehicle, night, practicals, elapsed, skyUniforms.sun.value, local);
      sun.position.copy(skyUniforms.sun.value).multiplyScalar(220).add(sun.target.position);
      sun.intensity = (2.59 - evening * .14 - night * 2.10) * (1 - rain * .46);
      hemi.intensity = 1.29 - evening * .065 - night * .29 + rain * .14;
      hemi.groundColor.copy(groundAtDay).lerp(groundAtNight, night);
      roadSun.value.copy(skyUniforms.sun.value);
      roadTint.value.copy(sun.color).lerp(wetFog, .75 * night);
      roadSky.value.copy(skyUniforms.topColor.value);
      roadHorizon.value.copy(skyUniforms.lowColor.value);
      sky.position.copy(camera.position);
      lampPool.opacity = practicals * .56;
      reflectedLamp.opacity = practicals * moisture * .62;
      for (const [material, intensity] of nightMaterials) material.emissiveIntensity = .23 + practicals * intensity;
      return night;
    }

    return { collision, blockedAt, clearFraction, vehicleBlocked, surfaceHeight, occluded, footprints, light, sun, roadReflection,
      skyUniforms, shelters, initialTextures: [...Object.values(textures), streetShade], setDetail, updateVisibleStreet };
  }

  window.Tideline = { build, buildSteps, finishBuild, X, Z, BOUNDS, ROAD, JOBS, HUB, DELIVERY, STASH, RACE, TAPES, clamp, distance, angleDiff, rng, nearest, nearestRoad, routeBetween, district };
})();