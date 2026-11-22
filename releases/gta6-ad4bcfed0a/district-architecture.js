(() => {
  'use strict';

  const D = window.Tideline;
  const atlases = new WeakMap();
  const floor = .216;
  const cell = 128;
  const atlasSize = 4;
  const turn = Math.PI / 2;
  const axes = [[0, 1], [1, 0], [0, -1], [-1, 0]];
  const skins = {
    lime: { profile: 'stucco', body: '#ccbba0', light: '#e4d8be', dark: '#9f8f72', trim: '#e8d9bd', frame: '#424b47', glass: '#3b5b6b', spacing: [3.56, 3.08] },
    coral: { profile: 'stucco', body: '#c68c7a', light: '#e0a795', dark: '#8f6356', trim: '#e5c4ae', frame: '#55443c', glass: '#425563', spacing: [3.56, 3.08] },
    terracotta: { profile: 'stucco', body: '#b8725b', light: '#d48f77', dark: '#844e3d', trim: '#ebd3b6', frame: '#4c3a33', glass: '#3f5462', spacing: [3.52, 3.06] },
    ochre: { profile: 'stucco', body: '#cca66c', light: '#e3c38a', dark: '#997a49', trim: '#efe1c2', frame: '#4b453a', glass: '#3d5a68', spacing: [3.54, 3.10] },
    jade: { profile: 'tile', body: '#79a296', light: '#9ec0b4', dark: '#51766c', trim: '#c2d5c4', frame: '#324c4a', glass: '#3c5d68', spacing: [3.63, 3.14] },
    mint: { profile: 'tile', body: '#8cb3a4', light: '#b1d0c3', dark: '#618779', trim: '#e2e8d7', frame: '#35504c', glass: '#3f626e', spacing: [3.58, 3.12] },
    indigo: { profile: 'tile', body: '#607e91', light: '#84a0b2', dark: '#415a6c', trim: '#cedad9', frame: '#2d414e', glass: '#3c5c70', spacing: [3.60, 3.16] },
    sand: { profile: 'deco', body: '#c2ac8c', light: '#e0ccab', dark: '#907d63', trim: '#e3d4b2', frame: '#49453e', glass: '#3d586b', spacing: [3.35, 3.47] },
    pearl: { profile: 'deco', body: '#8ea8b0', light: '#b7cbd0', dark: '#617a86', trim: '#c7d5d6', frame: '#3a4f5a', glass: '#3e6274', spacing: [3.35, 3.47] },
    harbor: { profile: 'curtain', body: '#56768a', light: '#81a1b6', dark: '#364f62', trim: '#9fb8be', frame: '#2c4555', glass: '#467088', spacing: [3.17, 3.38] },
    yard: { profile: 'metal', body: '#828d88', light: '#a9afa5', dark: '#5c6b66', trim: '#aeb8ad', frame: '#3a4c4b', glass: '#445e68', spacing: [4.03, 3.18] },
  };
  const boardNames = [
    ['潮汽冰室', 'TIDE CANTEEN', '#30433e', '#f4dbab'],
    ['回声唱片', 'ECHO RECORDS', '#633e36', '#ecd2b3'],
    ['鹭江旅社', 'LUJIANG HOTEL', '#384850', '#eacda3'],
    ['花桥茶寮', 'HUAQIAO TEA', '#385048', '#ecd2a9'],
    ['汐南邮电', 'BAIXI POST', '#475749', '#eddbc0'],
    ['永平码头食堂', 'YONGPING CAFE', '#6b4936', '#f3dabb'],
    ['留声书局', 'THE AUDIO BOOKSHOP', '#55473a', '#f2dcc1'],
    ['风信电器', 'WINSEN ELECTRIC', '#3b4a53', '#dad9c7'],
    ['平码机件', 'PINGMA SUPPLY', '#3d524e', '#e2d2ab'],
  ];

  function rect(ctx, ink, x, y, w, h) {
    ctx.fillStyle = ink;
    ctx.fillRect(x, y, w, h);
  }

  function canvas(sizeX, sizeY) {
    const surface = document.createElement('canvas');
    surface.width = sizeX;
    surface.height = sizeY;
    return surface;
  }

  function texture(T, surface, tiled = false) {
    const map = new T.CanvasTexture(surface);
    map.colorSpace = T.SRGBColorSpace;
    map.anisotropy = 4;
    if (tiled) map.wrapS = map.wrapT = T.RepeatWrapping;
    return map;
  }

  function atlas(T, draw) {
    const size = cell * atlasSize;
    const daylight = canvas(size, size);
    const night = canvas(size, size);
    const day = daylight.getContext('2d');
    const glow = night.getContext('2d');
    rect(glow, '#000000', 0, 0, size, size);
    for (let id = 0; id < atlasSize * atlasSize; id++) {
      for (const ctx of [day, glow]) {
        ctx.save();
        ctx.translate((id % atlasSize) * cell, Math.floor(id / atlasSize) * cell);
        ctx.beginPath();
        ctx.rect(0, 0, cell, cell);
        ctx.clip();
      }
      draw(day, glow, id, D.rng(42461 + id * 7229));
      day.restore();
      glow.restore();
    }
    return { map: texture(T, daylight, true), emissiveMap: texture(T, night, true) };
  }

  function wallTile(ctx, skin, random) {
    const shading = ctx.createLinearGradient(19, 0, 110, 127);
    shading.addColorStop(0, skin.dark);
    shading.addColorStop(.26, skin.body);
    shading.addColorStop(.67, skin.light);
    shading.addColorStop(1, skin.body);
    rect(ctx, shading, 0, 0, cell, cell);
    for (let i = 0; i < 260; i++) {
      const tone = random() < .53 ? '#242c3022' : '#faf2da29';
      rect(ctx, tone, random() * cell, random() * cell, .4 + random() * 2.4, .4 + random() * 1.9);
    }
    if (skin.profile === 'tile') {
      for (let y = 4; y < 128; y += 10) {
        rect(ctx, '#1e36393b', 0, y, 128, 1.1);
        rect(ctx, '#e1e7d833', 0, y + 1, 128, 1);
        for (let x = 0; x < 128; x += 16) rect(ctx, '#25363537', x + y % 4 * 4, y, 1.15, 10);
      }
    } else if (skin.profile === 'curtain' || skin.profile === 'metal') {
      const spacing = skin.profile === 'metal' ? 7 : 32;
      for (let x = 3; x < 128; x += spacing) {
        rect(ctx, '#0b202639', x, 0, 2, 128);
        rect(ctx, '#dae5d72c', x + 2, 0, 1.5, 128);
      }
    } else {
      for (let y = 26; y < 117; y += skin.profile === 'deco' ? 19 : 49) {
        rect(ctx, '#37424326', 0, y, cell, .9);
        rect(ctx, '#e2dbce38', 0, y + 1, cell, .65);
      }
    }
    for (let i = 0; i < 7; i++) {
      const h = 9 + random() * 46;
      const top = random() * 41;
      const trail = ctx.createLinearGradient(0, top, 0, top + h);
      trail.addColorStop(0, '#1f302124');
      trail.addColorStop(1, '#27261d00');
      rect(ctx, trail, random() * cell, top, 2 + random() * 7, h);
    }
    rect(ctx, '#252b3b3b', 0, 0, cell, 3);
    rect(ctx, '#ede1c841', 0, 3, cell, 1.7);
    rect(ctx, '#25313b28', 0, 121, cell, 4);
    rect(ctx, '#e9dfcb45', 0, 125, cell, 3);
  }

  function room(ctx, x, y, w, h, skin, variant, isLit, emissive) {
    const lighting = ctx.createLinearGradient(x, y, x + w * .2, y + h);
    const amber = variant % 5 !== 0;
    const warmTone = variant % 3 === 0 ? '#ffd086' : '#f7ba78';
    const coolTone = variant % 2 === 0 ? '#9be8df' : '#bfe2f2';
    if (isLit && emissive) {
      lighting.addColorStop(0, amber ? warmTone : coolTone);
      lighting.addColorStop(.42, amber ? '#d49054' : '#63a3a0');
      lighting.addColorStop(1, amber ? '#472d21' : '#18323b');
    } else if (emissive) {
      return;
    } else if (isLit) {
      lighting.addColorStop(0, amber ? '#a89271' : '#809fa3');
      lighting.addColorStop(.54, amber ? '#75624a' : '#47686e');
      lighting.addColorStop(1, '#28363e');
    } else {
      lighting.addColorStop(0, '#294861');
      lighting.addColorStop(.40, skin.glass);
      lighting.addColorStop(.50, '#365668');
      lighting.addColorStop(1, '#162c39');
    }
    rect(ctx, lighting, x, y, w, h);
    if (variant % 4 <= 1) {
      const edges = variant % 4 === 0 ? [0, w * .79] : [w * .76];
      for (const side of edges) {
        const width = w * .24;
        const curtain = ctx.createLinearGradient(x + side, 0, x + side + width, 0);
        curtain.addColorStop(0, emissive ? '#75604c' : '#aaa292');
        curtain.addColorStop(.56, emissive ? '#ad7855' : '#878175');
        curtain.addColorStop(1, emissive ? '#38271f' : '#48483f');
        rect(ctx, curtain, x + side, y, width, h);
        for (let fold = 2; fold < width - 1; fold += 4) rect(ctx, '#332d3644', x + side + fold, y, 1, h);
      }
    } else if (variant % 4 === 2) {
      rect(ctx, emissive ? '#9f6f4e63' : '#adb4ae4a', x, y + 3, w, h * .58);
      for (let slat = 6; slat < h * .58; slat += 4) rect(ctx, '#1f2c3852', x, y + slat, w, 1.2);
    }
    if (isLit && variant % 3 === 0) {
      const offset = w * .24;
      rect(ctx, emissive ? '#392b24' : '#352c28', x + offset, y + h * .66, w * .20, h * .34);
      rect(ctx, emissive ? '#edb876' : '#9a805c', x + offset + 2, y + h * .67, w * .17, 1.9);
      rect(ctx, '#3d382d9c', x + w * .63, y + h * .73, w * .27, h * .27);
    }
    if (!emissive && !isLit) {
      ctx.fillStyle = '#d7eef529';
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + w * .17, y);
      ctx.lineTo(x + w * .74, y + h);
      ctx.lineTo(x + w * .54, y + h);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#ffe1ba18';
      ctx.fillRect(x, y, w, h * .24);
    }
  }

  function windowOpening(profile) {
    if (profile === 'deco') return [24, 13, 80, 91];
    if (profile === 'curtain') return [5, 6, 118, 99];
    if (profile === 'metal') return [15, 26, 98, 47];
    return [21, 22, 86, 76];
  }
  function upperTile(day, glow, id, rng, skin) {
    wallTile(day, skin, rng);
    const [x, y, w, h] = windowOpening(skin.profile);
    const active = [1, 3, 6, 9, 11, 14].includes(id) || ((id === 4 || id === 12) && skin.profile === 'curtain');
    if (skin.profile === 'deco') {
      rect(day, '#242e3a49', 8, 0, 7, 128);
      rect(day, '#ffffff42', 8, 0, 2, 128);
      rect(day, '#242e3a43', 114, 0, 7, 128);
      rect(day, '#ffffff3f', 119, 0, 2, 128);
    }
    if (skin.profile !== 'curtain') {
      rect(day, '#20252541', x - 5, y - 4, w + 11, h + 15);
      rect(day, skin.trim, x - 4, y - 3, w + 8, h + 9);
      rect(day, '#30333162', x - 4, y - 3, w + 7, 5);
    }
    rect(day, skin.frame, x, y, w, h + 4);
    room(day, x + 3, y + 4, w - 6, h - 3, skin, id, active, false);
    room(glow, x + 3, y + 4, w - 6, h - 3, skin, id, active, true);
    const uprights = skin.profile === 'curtain' ? [w * .33, w * .66] : [w * .5];
    for (const mid of uprights) {
      rect(day, skin.frame, x + mid - 1, y, 2.8, h);
      rect(day, '#c8d4c74b', x + mid + 1.8, y + 1, .8, h - 1);
      rect(glow, '#000000', x + mid - 1, y, 2.8, h);
    }
    const crossbar = skin.profile === 'curtain' ? y + h * .81 : y + h * .29;
    rect(day, skin.frame, x + 2, crossbar, w - 4, 2.6);
    rect(glow, '#000000', x + 2, crossbar, w - 4, 2.6);
    rect(day, skin.trim, x - 4, y + h + 3, w + 8, 2.3);
    if (id % 5 === 0 && skin.profile === 'stucco') {
      rect(day, '#202c3059', x + w - 23, y + h + 8, 25, 12);
      rect(day, '#7c827a', x + w - 25, y + h + 6, 25, 11);
      for (let row = 9; row <= 15; row += 3) rect(day, '#303b3b9d', x + w - 23, y + h + row, 14, 1);
    }
  }

  function baseTile(day, glow, id, rng, mode) {
    const storefront = mode === 'trade';
    const lobby = mode === 'lobby';
    const service = mode === 'service';
    const skin = storefront ? skins.jade : lobby ? skins.pearl : service ? skins.yard : skins.lime;
    wallTile(day, skin, rng);
    const shadow = day.createLinearGradient(0, 0, 0, 32);
    shadow.addColorStop(0, '#0b141a9c');
    shadow.addColorStop(1, '#151f2400');
    rect(day, shadow, 0, 0, 128, 34);
    rect(day, '#1e2c3181', 0, 105, 128, 23);
    rect(day, '#f6ede544', 0, 105, 128, 1.5);
    const [x, y, w, h] = lobby ? [11, 17, 106, 96] : storefront ? [10, 28, 108, 84] : [19, 27, 90, 83];
    rect(day, '#18272e92', x - 5, y - 4, w + 10, h + 10);
    rect(day, skin.trim, x - 3, y - 3, w + 6, h + 6);
    rect(day, skin.frame, x, y, w, h);
    const shutter = service || (storefront && id % 7 === 2) || (mode === 'entry' && id % 4 !== 3);
    if (shutter) {
      const metal = day.createLinearGradient(x, y, x, y + h);
      metal.addColorStop(0, '#3c4d50');
      metal.addColorStop(.68, service ? '#6d7872' : '#5e706c');
      metal.addColorStop(1, '#3f4b4e');
      rect(day, metal, x + 3, y + 4, w - 6, h - 8);
      for (let line = 5; line < h - 5; line += 4) {
        rect(day, '#17252c81', x + 3, y + line, w - 6, 1.1);
        rect(day, '#d2d6cf45', x + 3, y + line + 1, w - 6, 1);
      }
      rect(day, '#92988a', x + w * .46, y + h - 14, w * .08, 2.4);
      if (id % 3 === 0) {
        rect(day, '#cadac288', x + w * .17, y + h * .24, w * .24, h * .13);
        rect(day, '#303b2d82', x + w * .19, y + h * .276, w * .20, 1.6);
      }
    } else {
      const active = storefront || id % 3 === 1;
      room(day, x + 4, y + 3, w - 8, h - 6, skin, id, active, false);
      room(glow, x + 4, y + 3, w - 8, h - 6, skin, id, active, true);
      for (const ctx of [day, glow]) {
        const ink = ctx === day ? skin.frame : '#000000';
        rect(ctx, ink, x + w * .39, y, 3, h);
        rect(ctx, ink, x + w * .72, y, 3, h);
        rect(ctx, ink, x, y + h * .21, w, 3);
        rect(ctx, ink, x, y + h * .85, w, 4);
      }
      rect(day, '#c1c5ac', x + w * .43, y + h * .63, 2.1, 7.5);
    }
    rect(day, '#1c2a2e', x - 3, y + h + 2, w + 6, 4);
    rect(day, '#cebea18b', x - 4, y + h + 6, w + 8, 2);
  }

  function panelMaterial(T, maps, spacing, nightMaterials, brightness, photo = null) {
    const material = new T.MeshStandardMaterial({ ...maps, emissive: '#ffffff', emissiveIntensity: .22, roughness: .75 });
    const [stepX, stepY] = spacing;
    material.customProgramCacheKey = () => `district-panels-${stepX},${stepY}${photo ? '-windows' : ''}`;
    material.onBeforeCompile = (shader, renderer) => {
      const varied = renderer.capabilities.isWebGL2;
      shader.vertexShader = shader.vertexShader.replace('#include <uv_vertex>', `
        #include <uv_vertex>
        #ifdef USE_INSTANCING
          vec2 panelSize = vec2(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz));
          vec3 panelCenter = (modelMatrix * instanceMatrix[3]).xyz;
          vec2 panelCount = max(vec2(1.), floor(panelSize / vec2(${stepX.toFixed(3)}, ${stepY.toFixed(3)}) + .5));
          vec2 key = vec2(dot(panelCenter, vec3(.312, .317, -.143)), dot(panelCenter, vec3(-.188, .214, .323)));
          ${varied ? 'vMapUv = uv * panelCount + floor(key * 61.0);' : 'vMapUv = (uv * panelCount + floor(fract(key) * 4.0)) * .25;'}
          vEmissiveMapUv = vMapUv;
        #endif
      `);
      if (varied) {
        // Keep the mip footprint continuous while each window picks its own weather, curtains and lighting.
        shader.fragmentShader = `
          vec2 districtTile(vec2 at) {
            vec3 hash = fract(floor(at.xyx) * vec3(.1031,.1030,.0973));
            hash += dot(hash, hash.yzx + 33.33);
            return floor(fract((hash.xx + hash.yz) * hash.zy) * 4.);
          }
          vec4 districtSample(sampler2D atlasImage, vec2 at) {
            vec2 lookup = (districtTile(at) + clamp(fract(at), .01, .99)) * .25;
            return texture2DGradEXT(atlasImage, lookup, dFdx(at) * .25, dFdy(at) * .25);
          }
        ` + shader.fragmentShader.replace('#include <map_fragment>', 'diffuseColor *= districtSample(map, vMapUv);')
          .replace('#include <emissivemap_fragment>', 'totalEmissiveRadiance *= districtSample(emissiveMap, vEmissiveMapUv).rgb;');
        if (photo) {
          Object.assign(shader.uniforms, { districtWindows: { value: photo.image },
            districtWindowReady: photo.ready, districtOpening: { value: photo.opening } });
          shader.fragmentShader = `
            uniform sampler2D districtWindows;
            uniform float districtWindowReady;
            uniform vec4 districtOpening;
          ` + shader.fragmentShader.replace('diffuseColor *= districtSample(map, vMapUv);', `
            vec4 wall = districtSample(map, vMapUv);
            vec2 photoLocal = (fract(vMapUv) - districtOpening.xy) / districtOpening.zw;
            vec2 dx = dFdx(vMapUv);
            vec2 dy = dFdy(vMapUv);
            float footprint = max(length(dx),length(dy));
            float paneEdge = min(min(photoLocal.x,photoLocal.y),1.-max(photoLocal.x,photoLocal.y));
            if (districtWindowReady > .5 && paneEdge > 0. && footprint < .08) {
              vec2 portion = .397 / districtOpening.zw;
              vec2 coordinates = mod(districtTile(vMapUv),2.)*.5 + vec2(.052,.077) + photoLocal*.397;
              vec3 pane = texture2DGradEXT(districtWindows,coordinates,dx*portion,dy*portion).rgb;
              float blend = .79 * smoothstep(.005,.065,paneEdge) * (1.-smoothstep(.026,.08,footprint));
              wall.rgb = mix(wall.rgb,pane*.92+vec3(.007,.009,.012),blend);
            }
            diffuseColor *= wall;
          `);
        }
      }
    };
    nightMaterials.push([material, brightness]);
    return material;
  }

  function boardMaterial(T, [name, latin, background, ink], nightMaterials) {
    const surface = canvas(512, 128);
    const ctx = surface.getContext('2d');
    rect(ctx, '#1b2b2f', 0, 0, 512, 128);
    const bg = ctx.createLinearGradient(0, 5, 0, 123);
    bg.addColorStop(0, background);
    bg.addColorStop(1, '#1a262c');
    rect(ctx, bg, 5, 5, 502, 118);
    rect(ctx, ink + 'aa', 13, 12, 486, 2.2);
    rect(ctx, ink + 'aa', 13, 113, 486, 2.2);
    rect(ctx, ink, 19, 24, 3, 76);
    rect(ctx, ink, 490, 24, 3, 76);
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    ctx.fillStyle = ink;
    ctx.font = '700 47px "Microsoft YaHei", "Noto Sans CJK SC", sans-serif';
    ctx.fillText(name, 256, 51, 411);
    ctx.font = '600 13px Arial, sans-serif';
    ctx.letterSpacing = '2px';
    ctx.fillText(latin, 256, 94, 410);
    const map = texture(T, surface);
    const material = new T.MeshStandardMaterial({ map, emissiveMap: map, emissive: '#ffe9c6', emissiveIntensity: .32, roughness: .62 });
    nightMaterials.push([material, 1.18]);
    return material;
  }

  function makeKit({ T, nightMaterials, windowPhoto, windowPhotoReady }) {
    const plane = new T.PlaneGeometry(1, 1);
    const material = (color, options) => new T.MeshStandardMaterial({ color, roughness: .88, ...options });
    const coat = Object.fromEntries(Object.entries(skins).map(([name, skin]) => {
      const maps = atlas(T, (day, night, tile, rng) => upperTile(day, night, tile, rng, skin));
      let photo = null;
      if (skin.profile !== 'curtain' && skin.profile !== 'metal') {
        const [x, y, w, h] = windowOpening(skin.profile);
        const opening = new T.Vector4((x + 3) / cell, 1 - (y + h) / cell, (w - 6) / cell, (h - 4) / cell);
        photo = { image: windowPhoto(), ready: windowPhotoReady, opening };
      }
      return [name, { ...skin, body: material(skin.body), trim: material(skin.trim),
        facade: panelMaterial(T, maps, skin.spacing, nightMaterials, 1.38, photo) }];
    }));
    const base = Object.fromEntries(['trade', 'lobby', 'service', 'entry'].map(mode => {
      const maps = atlas(T, (day, night, tile, rng) => baseTile(day, night, tile, rng, mode));
      return [mode, panelMaterial(T, maps, [mode === 'lobby' ? 4.8 : 4.45, 16], nightMaterials, mode === 'trade' ? 1.37 : 1.02)];
    }));
    return {
      plane, coat, base,
      signs: boardNames.map(board => boardMaterial(T, board, nightMaterials)),
      plinth: material('#49534f'), iron: material('#384a50', { metalness: .28, roughness: .52 }),
      zinc: material('#748482', { metalness: .43, roughness: .54 }),
      cap: material('#515a58'), gutter: material('#24353b'),
      cloth: ['#8f4b3c', '#577355', '#2f6a72', '#a87143'].map(color => material(color, { roughness: .96 })),
      planter: material('#9c5a44', { roughness: .88 }),
      leaf: material('#4a7b54', { roughness: .92 }),
      blossom: material('#e5866e', { roughness: .88 }),
      roofTile: material('#8e5140', { roughness: .86 }),
      roofSlate: material('#3e525c', { roughness: .82, metalness: .16 }),
      solarGlass: material('#22394a', { roughness: .22, metalness: .42 }),
      laundry: ['#ece7dc', '#7eb2c9', '#df8e78', '#e5c573'].map(color => material(color, { roughness: .95 })),
      warmStrip: (() => { const m = material('#ffe4b2', { emissive: '#ffc575', emissiveIntensity: .38, roughness: .42 }); nightMaterials.push([m, 2.2]); return m; })(),
      cyanNeon: (() => { const m = material('#a8fff0', { emissive: '#4df5d8', emissiveIntensity: .46, roughness: .38 }); nightMaterials.push([m, 2.6]); return m; })(),
      coralNeon: (() => { const m = material('#ffb8a2', { emissive: '#ff6f59', emissiveIntensity: .44, roughness: .38 }); nightMaterials.push([m, 2.5]); return m; })(),
      beaconRed: (() => { const m = material('#ff7868', { emissive: '#ff3c2a', emissiveIntensity: .55, roughness: .35 }); nightMaterials.push([m, 2.8]); return m; })(),
    };
  }

  function skinAt(kit, building, rng) {
    const choice = rng();
    if (building.tower) {
      if (choice < .28) return kit.coat.sand;
      if (choice < .52) return kit.coat.pearl;
      if (choice < .82) return kit.coat.harbor;
      return kit.coat.indigo;
    }
    if (building.z > 153 && building.x < 160 && choice < .52) return kit.coat.yard;
    const pool = building.x > 138
      ? [kit.coat.jade, kit.coat.mint, kit.coat.coral, kit.coat.ochre, kit.coat.lime, kit.coat.sand, kit.coat.terracotta]
      : [kit.coat.lime, kit.coat.coral, kit.coat.terracotta, kit.coat.ochre, kit.coat.jade, kit.coat.mint, kit.coat.indigo, kit.coat.sand];
    return pool[Math.floor(choice * pool.length) % pool.length];
  }

  function elevation(x, z, w, d, index) {
    const [nx, nz] = axes[index];
    const radius = nx ? w / 2 : d / 2;
    return { x: x + nx * radius, z: z + nz * radius, width: nx ? d : w, nx, nz, yaw: index * turn };
  }

  function place(surface, along, out = 0) {
    return [surface.x + surface.nz * along + surface.nx * out,
      surface.z - surface.nx * along + surface.nz * out];
  }

  function face(api, kit, material, surface, y, h) {
    const [x, z] = place(surface, 0, .011);
    api.queue(kit.plane, material, x, y, z, surface.width, h, 1, surface.yaw);
  }

  function alongFace(api, material, surface, along, out, y, w, h, d, pitch = 0) {
    const [x, z] = place(surface, along, out);
    api.box(material, x, y, z, w, h, d, surface.yaw, pitch);
  }

  function groundFloor(api, kit, skin, building, h, rng) {
    const { x, z, w, d, tower, shop } = building;
    const front = (Math.round((building.front || 0) / turn) + 4) % 4;
    api.box(kit.plinth, x, floor + h * .5, z, w, h, d);
    api.box(kit.plinth, x, floor + .12, z, w + .21, .24, d + .21);
    api.box(skin.trim, x, floor + h - .075, z, w + .14, .21, d + .14);
    for (let side = 0; side < 4; side++) {
      const surface = elevation(x, z, w, d, side);
      const retail = !tower && shop && side === front;
      const mode = retail ? 'trade' : tower ? 'lobby' : skin.profile === 'metal' ? 'service' : 'entry';
      face(api, kit, kit.base[mode], surface, floor + h * .5, h);
      const edge = surface.width * .5 - .16;
      for (const pos of [-edge, edge]) alongFace(api, skin.trim, surface, pos, .055, floor + h * .52, .31, h * .91, .24);
      if (retail) {
        const middle = (rng() < .5 ? -1 : 1) * surface.width * .16;
        const wide = Math.min(surface.width * .56, 8.6);
        const bannerHeight = floor + h * .86;
        const sign = kit.signs[Math.floor(rng() * kit.signs.length)];
        const neonPool = [kit.warmStrip, kit.cyanNeon, kit.coralNeon];
        const neon = neonPool[Math.floor(rng() * neonPool.length)];
        alongFace(api, kit.iron, surface, middle, .085, bannerHeight, wide + .16, .72, .25);
        const [sx, sz] = place(surface, middle, .22);
        api.queue(kit.plane, sign, sx, bannerHeight, sz, wide, .62, 1, surface.yaw);
        for (const end of [-1, 1]) alongFace(api, neon, surface, middle + end * (wide * .5 + .06), .20, bannerHeight, .055, .64, .055);
        const awning = kit.cloth[Math.floor(rng() * kit.cloth.length)];
        const at = floor + h * .69;
        alongFace(api, awning, surface, middle, .58, at, wide + .48, .095, 1.26, .18);
        alongFace(api, awning, surface, middle, 1.18, at - .145, wide + .48, .20, .075);
        alongFace(api, skin.trim, surface, middle, 1.22, at - .22, wide + .48, .045, .04);
        for (const end of [-1, 1]) alongFace(api, kit.iron, surface, middle + end * wide * .48, .54, at - .28, .045, .055, 1.02, .24);
        alongFace(api, kit.warmStrip, surface, middle, .36, at - .12, wide * .90, .05, .08);
        // Protruding 3D vertical neon blade sign on one side of the storefront
        if (rng() < .72) {
          const bladeSide = middle >= 0 ? -1 : 1;
          const bx = bladeSide * Math.min(surface.width * .38, wide * .48 + 1.1);
          const by = floor + h + 1.55;
          const bh = 2.35 + rng() * .95;
          alongFace(api, kit.iron, surface, bx, .48, by, .12, bh, .78);
          alongFace(api, neon, surface, bx, .88, by, .08, bh - .16, .08);
          alongFace(api, neon, surface, bx, .50, by, .16, bh - .28, .44);
          for (const dy of [-bh * .36, bh * .36]) alongFace(api, kit.iron, surface, bx, .16, by + dy, .06, .06, .36);
        }
        if (rng() < .68) {
          const [lx, lz] = place(surface, middle, 1.02);
          api.fixture?.(lx, at - .22, lz, '#ffca8c', 30, 15.5);
        }
      } else if (tower && side === front) {
        alongFace(api, kit.iron, surface, 0, .92, floor + h * .76, surface.width * .52, .18, 1.96);
        alongFace(api, skin.trim, surface, 0, 1.88, floor + h * .76, surface.width * .52, .11, .08);
        alongFace(api, kit.warmStrip, surface, 0, 1.66, floor + h * .76 - .10, surface.width * .46, .05, .08);
      }
    }
  }

  function roofHardware(api, kit, skin, x, z, w, d, y, tower, rng) {
    const offsetX = x + w * (rng() - .5) * .38;
    const offsetZ = z + d * (rng() - .5) * .42;
    const hutHeight = tower ? 2.0 : 1.35 + rng() * .45;
    const hutW = w * (.22 + rng() * .11);
    const hutD = d * (.24 + rng() * .10);
    api.box(skin.body, offsetX, y + hutHeight * .5, offsetZ, hutW, hutHeight, hutD);
    api.box(skin.trim, offsetX, y + hutHeight + .09, offsetZ, hutW + .42, .18, hutD + .42);
    api.box(kit.gutter, offsetX, y + hutHeight * .44, offsetZ + hutD * .5 + .01, hutW * .26, hutHeight * .74, .08);
    // Elevated cylindrical water tank on iron legs
    if (rng() < .72) {
      const px = x - w * .26;
      const pz = z + d * .28;
      const standH = .95;
      for (const lx of [-.52, .52]) for (const lz of [-.52, .52]) {
        api.box(kit.iron, px + lx, y + standH * .5, pz + lz, .09, standH, .09);
      }
      api.box(kit.iron, px, y + standH + .06, pz, 1.56, .12, 1.56);
      api.pole(kit.zinc, px, y + standH + .82, pz, 1.34, 1.38);
      api.pole(kit.iron, px, y + standH + .55, pz, 1.38, .06);
      api.pole(kit.iron, px, y + standH + 1.12, pz, 1.38, .06);
      api.pole(kit.cap, px, y + standH + 1.55, pz, 1.40, .16);
    }
    // HVAC boxes or coastal solar water heater
    if (!tower && rng() < .52 && w > 12) {
      const sx = x + w * .24;
      const sz = z - d * .22;
      api.box(kit.iron, sx, y + .28, sz, 1.9, .42, 1.2);
      api.box(kit.solarGlass, sx, y + .62, sz + .15, 2.05, .08, 1.35, 0, .38);
      api.pole(kit.zinc, sx, y + 1.06, sz - .45, .42, 2.0, .42);
    } else {
      for (const k of [-1, 1]) {
        const px = x + k * w * .28;
        const pz = z - d * .24;
        api.box(kit.zinc, px, y + .34, pz, Math.min(2.2, w * .14), .62, Math.min(2.4, d * .22));
        api.box(kit.gutter, px, y + .67, pz, Math.min(1.9, w * .12), .06, Math.min(2.0, d * .17));
      }
    }
    // Roof antenna / mast with crossbars and tower beacon
    if (rng() < (tower ? .88 : .58)) {
      const length = tower ? 2.8 + rng() * 3.8 : 2.1 + rng() * 1.4;
      api.pole(kit.iron, offsetX, y + hutHeight + length * .5, offsetZ, .06, length);
      api.box(kit.iron, offsetX, y + hutHeight + length * .86, offsetZ, tower ? 1.9 : 1.28, .045, .045);
      api.box(kit.iron, offsetX, y + hutHeight + length * .68, offsetZ, .045, .045, tower ? 1.4 : .95);
      if (tower || length > 3.1) api.box(kit.beaconRed, offsetX, y + hutHeight + length + .13, offsetZ, .24, .24, .24);
    }
  }

  function utilityRoof(api, kit, skin, x, z, w, d, y) {
    const pitch = Math.atan(4.2 / w);
    const span = Math.hypot(w * .51, 2.1);
    for (const side of [-1, 1]) {
      api.box(kit.cap, x + side * w * .25, y + 1.05, z, span, .16, d, 0, 0, -side * pitch);
      for (const offset of [-.33, -.16, 0, .16, .33]) {
        api.box(skin.trim, x + side * w * .25, y + 1.153, z + d * offset, span, .06, .046, 0, 0, -side * pitch);
      }
    }
    api.box(kit.iron, x, y + 2.13, z, .22, .14, d + .07);
    for (const side of [-1, 1]) {
      const capZ = z + d * .493 * side;
      api.box(skin.body, x, y + .36, capZ, w * .74, .72, .16);
      api.box(skin.body, x, y + 1.06, capZ, w * .45, .68, .16);
      api.box(skin.body, x, y + 1.66, capZ, w * .23, .51, .16);
    }
  }

  function parapet(api, kit, skin, x, z, w, d, y, h) {
    api.box(kit.cap, x, y + .036, z, w - .08, .13, d - .08);
    api.box(skin.trim, x, y - .04, z, w + .54, .18, d + .54);
    api.box(kit.iron, x, y - .15, z, w + .32, .07, d + .32);
    for (let side = 0; side < 4; side++) {
      const surface = elevation(x, z, w, d, side);
      alongFace(api, skin.body, surface, 0, -.115, y + h * .51, surface.width, h, .24);
      alongFace(api, skin.trim, surface, 0, -.06, y + h + .05, surface.width + .22, .12, .40);
    }
  }

  function pitchedRoof(api, kit, skin, x, z, w, d, y, warm) {
    const ridgeH = Math.min(2.6, Math.min(w, d) * .17);
    const alongZ = d >= w;
    const span = alongZ ? w : d;
    const len = alongZ ? d : w;
    const half = span * .52;
    const slopeLen = Math.hypot(half, ridgeH);
    const angle = Math.atan2(ridgeH, half);
    const tileMat = warm ? kit.roofTile : kit.roofSlate;
    api.box(skin.trim, x, y + .06, z, w + .62, .16, d + .62);
    for (const side of [-1, 1]) {
      if (alongZ) {
        api.box(tileMat, x + side * span * .255, y + ridgeH * .5 + .08, z, slopeLen, .16, len + .56, 0, 0, -side * angle);
        api.box(skin.body, x, y + ridgeH * .34, z + side * (len * .48), span * .72, ridgeH * .64, .22);
      } else {
        api.box(tileMat, x, y + ridgeH * .5 + .08, z + side * span * .255, len + .56, .16, slopeLen, 0, side * angle, 0);
        api.box(skin.body, x + side * (len * .48), y + ridgeH * .34, z, .22, ridgeH * .64, span * .72);
      }
    }
    api.box(skin.trim, x, y + ridgeH + .14, z, alongZ ? .28 : len + .62, .16, alongZ ? len + .62 : .28);
  }

  function balcony(api, kit, skin, surface, x, y, w, rng) {
    alongFace(api, skin.trim, surface, x, .40, y - .04, w + .10, .17, .88);
    alongFace(api, kit.iron, surface, x, .40, y - .14, w, .06, .80);
    alongFace(api, kit.iron, surface, x, .82, y + .66, w + .04, .055, .056);
    alongFace(api, kit.iron, surface, x, .82, y + .22, w + .04, .04, .044);
    for (let rail = -2; rail <= 2; rail++) alongFace(api, kit.iron, surface, x + rail * w * .228, .82, y + .39, .044, .54, .044);
    for (const end of [-1, 1]) {
      alongFace(api, kit.iron, surface, x + end * w * .49, .41, y + .66, .05, .05, .82);
      alongFace(api, kit.iron, surface, x + end * w * .49, .41, y + .22, .04, .04, .82);
    }
    // Terracotta flower box with foliage & subtle blossom
    alongFace(api, kit.planter, surface, x + w * .24, .66, y + .18, w * .34, .22, .24);
    alongFace(api, kit.leaf, surface, x + w * .24, .66, y + .36, w * .36, .20, .26);
    if (rng() < .65) alongFace(api, kit.blossom, surface, x + w * .20, .70, y + .45, .16, .10, .14);
    // Residential drying rack / clothesline with hanging laundry
    if (rng() < .52) {
      const rx = x - w * .18;
      alongFace(api, kit.zinc, surface, rx, .72, y + 1.48, w * .48, .038, .038);
      for (const end of [-1, 1]) alongFace(api, kit.iron, surface, rx + end * w * .22, .38, y + 1.48, .038, .038, .70);
      const count = rng() < .5 ? 2 : 3;
      for (let i = 0; i < count; i++) {
        const lx = rx + (i - (count - 1) * .5) * .36;
        const cloth = kit.laundry[Math.floor(rng() * kit.laundry.length)];
        alongFace(api, cloth, surface, lx, .72, y + 1.18, .25, .52, .055);
      }
    }
  }

  function acUnit(api, kit, surface, x, y) {
    alongFace(api, kit.zinc, surface, x, .24, y, .68, .44, .34);
    alongFace(api, kit.gutter, surface, x - .10, .42, y, .32, .30, .04);
    for (const end of [-1, 1]) alongFace(api, kit.iron, surface, x + end * .24, .19, y - .25, .05, .05, .36);
  }

  function windowHood(api, kit, skin, surface, x, y, w) {
    alongFace(api, skin.trim, surface, x, .20, y + 1.56, w, .12, .42);
    alongFace(api, skin.trim, surface, x, .15, y - .06, w + .08, .11, .30);
    for (const end of [-1, 1]) alongFace(api, skin.trim, surface, x + end * (w * .5 + .03), .10, y + .75, .10, 1.62, .20);
  }

  function cornerBay(api, kit, skin, surface, y, h, slot, width, rng) {
    const [x, z] = place(surface, slot, .22);
    const bay = { ...surface, x, z, width };
    alongFace(api, skin.body, bay, 0, -.12, y, width, h, .245);
    face(api, kit, skin.facade, bay, y, h);
    for (const side of [-1, 1]) {
      alongFace(api, skin.trim, bay, side * width * .50, -.068, y, .11, h + .17, .245);
    }
    alongFace(api, skin.trim, bay, 0, -.06, y - h * .50 + .065, width + .12, .18, .34);
    alongFace(api, skin.trim, bay, 0, -.052, y + h * .50, width + .21, .23, .36);
    if (rng() < .6) {
      const side = Math.sign(slot);
      alongFace(api, kit.iron, bay, side * (width * .52 + .055), -.13, y - 1.10, .059, h + 2, .058);
    }
  }

  function stories(api, kit, skin, x, z, w, d, bottom, h, detail, front, rng) {
    const top = bottom + h;
    api.box(skin.body, x, bottom + h * .5, z, w, h, d);
    const ornamented = detail && skin.profile !== 'deco';
    const cross = front % 2 ? D.nearest(D.Z, z) - z : D.nearest(D.X, x) - x;
    const sideStreet = front % 2 ? (cross > 0 ? 0 : 2) : (cross > 0 ? 1 : 3);
    const baySide = ornamented && rng() < .64 ? sideStreet : -1;
    for (let side = 0; side < 4; side++) {
      const surface = elevation(x, z, w, d, side);
      face(api, kit, skin.facade, surface, bottom + h * .50, h);
      const edge = surface.width * .5 - .20;
      const deco = skin.profile === 'deco';
      for (const pos of [-edge, edge]) {
        alongFace(api, skin.trim, surface, pos, .092, bottom + h * .50, deco ? .37 : .22, h, deco ? .42 : .25);
      }
      if (deco && h > 19) {
        for (const pos of [-surface.width * .265, surface.width * .265]) {
          alongFace(api, skin.trim, surface, pos, .038, bottom + h * .5, .13, h, .118);
        }
      }
      if (detail && (side === front || side === sideStreet)) {
        const levels = Math.max(1, Math.round(h / skin.spacing[1]));
        const bays = Math.max(1, Math.round(surface.width / skin.spacing[0]));
        const width = surface.width / bays;
        const oriel = baySide === side ? (rng() < .5 ? 1 : bays - 2) : -1;
        if (oriel >= 0) {
          const slot = surface.width * ((oriel + .5) / bays - .5);
          cornerBay(api, kit, skin, surface, bottom + h * .5, h - .23, slot, width + .04, rng);
        }
        const maxDetailedLevels = Math.min(levels, 7);
        for (let level = 0; level < maxDetailedLevels; level++) {
          const y = bottom + h * (level + .203) / levels;
          if (level % 2 === 0 || skin.profile === 'deco') {
            alongFace(api, skin.trim, surface, 0, .10, y - .12, surface.width + .14, .14, .28);
          }
          // Pick 1–2 balcony slots per floor on residential/mixed facades
          const balcA = Math.floor(rng() * Math.max(1, bays - 2)) + 1;
          const balcB = bays >= 5 && side === front && rng() < .55 ? (balcA + 2) % bays : -1;
          for (let b = 0; b < bays; b++) {
            if (b === oriel) continue;
            const center = surface.width * ((b + .5) / bays - .5);
            const hasBalcony = (b === balcA || b === balcB) && (side === front || level % 2 === 1) && skin.profile !== 'curtain';
            if (hasBalcony) {
              balcony(api, kit, skin, surface, center, y, width * .80, rng);
            } else if (side === front && (b + level) % 2 === 0 && skin.profile !== 'curtain') {
              windowHood(api, kit, skin, surface, center, y, width * .74);
            }
            if (!hasBalcony && rng() < (side === front ? .28 : .18)) {
              acUnit(api, kit, surface, center + width * .34, y - .26);
            }
          }
        }
      } else if (skin.profile === 'curtain' || skin.profile === 'deco') {
        const bands = Math.min(5, Math.max(1, Math.floor(h / 9)));
        for (let b = 1; b <= bands; b++) {
          alongFace(api, skin.trim, surface, 0, .14, bottom + h * b / (bands + 1), surface.width + .16, .24, .30);
        }
      }
    }
    api.box(skin.trim, x, top - .055, z, w + .27, .19, d + .27);
    return top;
  }

  function addDistrictArchitecture(api, building) {
    let kit = atlases.get(api.scene);
    if (!kit) {
      kit = makeKit(api);
      atlases.set(api.scene, kit);
    }
    const { x, z, w, d, tower, height } = building;
    const seed = Math.imul(Math.round(x * 47) + 10397, 0x4c73c43) ^ Math.imul(Math.round(z * 49) + 23117, 0x1b713c1);
    const rng = D.rng(seed >>> 0);
    const skin = skinAt(kit, building, rng);
    const lobbyHeight = tower ? 5.85 : Math.min(4.31, height * .43);
    groundFloor(api, kit, skin, building, lobbyHeight, rng);
    const front = (Math.round((building.front || 0) / turn) + 4) % 4;
    const setback = tower && height > 39;
    const taper = setback ? .77 + rng() * .11 : 1;
    const baseW = tower && skin.profile === 'curtain' ? w * .94 : w;
    const baseD = tower && skin.profile === 'curtain' ? d * .94 : d;
    const detailed = !tower && skin.profile !== 'metal' && rng() < (building.shop ? .95 : .78);
    let top = stories(api, kit, skin, x, z, baseW, baseD, floor + lobbyHeight, height * taper - lobbyHeight, detailed, front, rng);
    if (setback) {
      api.box(kit.cap, x, top + .04, z, baseW - .10, .13, baseD - .10);
      const narrow = .65 + rng() * .16;
      const upperW = w * narrow;
      const upperD = d * narrow;
      const crown = skin.profile === 'deco' ? 2.4 + rng() * 1.4 : 1.42;
      const shoulder = top + height * (1.18 - taper) - crown;
      top = stories(api, kit, skin, x, z, upperW, upperD, top + .11, shoulder - top, false, front, rng);
      parapet(api, kit, skin, x, z, upperW, upperD, top, .47);
      const crownW = upperW * (skin.profile === 'deco' ? .62 : .76);
      const crownD = upperD * (skin.profile === 'deco' ? .56 : .72);
      api.box(skin.body, x, top + crown * .5, z, crownW, crown, crownD);
      api.box(skin.trim, x, top + crown + .11, z, crownW + .35, .22, crownD + .35);
      if (skin.profile === 'deco') {
        for (let side = 0; side < 4; side++) {
          const surface = elevation(x, z, crownW, crownD, side);
          for (const pos of [-1, 0, 1]) alongFace(api, kit.iron, surface, pos * surface.width * .20, .023, top + crown * .54, .19, crown * .70, .07);
          alongFace(api, kit.warmStrip, surface, 0, .06, top + crown - .08, surface.width * .78, .08, .07);
        }
      } else {
        api.box(kit.warmStrip, x, top + crown + .03, z, crownW + .28, .07, crownD + .28);
      }
      roofHardware(api, kit, skin, x, z, crownW, crownD, top + crown, tower, rng);
    } else {
      if (skin.profile === 'metal' && rng() < .74) {
        utilityRoof(api, kit, skin, x, z, baseW, baseD, top);
      } else if (!tower && height < 15.5 && rng() < .42) {
        pitchedRoof(api, kit, skin, x, z, baseW, baseD, top, skin.profile === 'stucco');
      } else {
        parapet(api, kit, skin, x, z, baseW, baseD, top, tower ? .68 : .52);
        // Stepped rooftop penthouse on ~48% of mid/low-rise buildings for varied roofline silhouettes
        if (!tower && height >= 11 && rng() < .48) {
          const pw = baseW * (.48 + rng() * .18);
          const pd = baseD * (.48 + rng() * .18);
          const ph = 2.8 + rng() * 1.1;
          const px = x + (rng() - .5) * (baseW - pw) * .55;
          const pz = z + (rng() - .5) * (baseD - pd) * .55;
          const pTop = stories(api, kit, skin, px, pz, pw, pd, top + .06, ph, false, front, rng);
          parapet(api, kit, skin, px, pz, pw, pd, pTop, .38);
          roofHardware(api, kit, skin, px, pz, pw, pd, pTop, false, rng);
        } else {
          roofHardware(api, kit, skin, x, z, baseW, baseD, top, tower, rng);
        }
      }
    }
    return true;
  }

  D.addDistrictArchitecture = addDistrictArchitecture;
})();
