(() => {
  'use strict';
  const T = window.THREE;
  const D = window.Tideline;

  function rainField(scene, compact, shelters) {
    const streaks = compact ? 470 : 1060;
    const coordinates = new Float32Array(streaks * 6);
    const endpoints = new Float32Array(streaks * 2);
    const rng = D.rng(781159);
    for (let i = 0; i < streaks; i++) {
      const index = i * 6;
      for (let n = 0; n < 3; n++) coordinates[index + n] = coordinates[index + n + 3] = rng();
      endpoints[i * 2 + 1] = 1;
    }
    const geometry = new T.BufferGeometry();
    geometry.setAttribute('position', new T.BufferAttribute(coordinates, 3));
    geometry.setAttribute('tail', new T.BufferAttribute(endpoints, 1));
    const roofs = [{ ...D.WAREHOUSE.bounds, ceiling: 8.2 }, ...shelters];
    const uniforms = {
      clock: { value: 0 }, amount: { value: 0 }, center: { value: new T.Vector3() },
      tint: { value: new T.Color('#d4e4ff') },
      roofBounds: { value: roofs.map(r => new T.Vector4(r.minX, r.maxX, r.minZ, r.maxZ)) },
      roofHeights: { value: roofs.map(r => r.ceiling) },
    };
    const material = new T.ShaderMaterial({
      uniforms, transparent: true, depthWrite: false, blending: T.AdditiveBlending,
      toneMapped: false,
      vertexShader: [
        'attribute float tail;',
        'uniform float clock, amount;',
        'uniform vec3 center;',
        'uniform vec4 roofBounds[' + roofs.length + ']; uniform float roofHeights[' + roofs.length + '];',
        'varying float opacity;',
        'void main(){',
        '  float pace = 13.0 + position.x * 6.0;',
        '  vec3 drop = fract(position + vec3(-clock*.074, -clock*pace/22.0, clock*.032));',
        '  vec3 p = center + vec3((drop.x-.5)*48.,drop.y*22.-2.,(drop.z-.5)*48.);',
        '  float length = mix(.29,.88,position.z);',
        '  p += tail * vec3(.16, length, -.07);',
        '  float distanceToEye = distance(cameraPosition,p);',
        '  opacity = amount * (1.0-tail*.76) * smoothstep(.8,3.6,distanceToEye) * (1.0-smoothstep(8.0,27.0,distanceToEye));',
        '  opacity *= smoothstep(.12,1.3,p.y) * (1.0-smoothstep(16.0,20.0,p.y));',
        '  for (int i=0; i<' + roofs.length + '; i++) {',
        '    vec4 r = roofBounds[i];',
        '    opacity *= 1.0-step(r.x,p.x)*step(p.x,r.y)*step(r.z,p.z)*step(p.z,r.w)*step(p.y,roofHeights[i]);',
        '  }',
        '  gl_Position = projectionMatrix * viewMatrix * vec4(p,1.0);',
        '}',
      ].join('\n'),
      fragmentShader: [
        'uniform vec3 tint; varying float opacity;',
        'void main(){ gl_FragColor = vec4(tint,opacity*.46);',
        ' #include <colorspace_fragment>',
        '}',
      ].join('\n'),
    });
    const lines = new T.LineSegments(geometry, material);
    lines.frustumCulled = false;
    lines.renderOrder = 3;
    scene.add(lines);
    return (camera, time, amount) => {
      lines.visible = amount > .02;
      if (lines.visible) {
        uniforms.clock.value = time;
        uniforms.amount.value = amount;
        uniforms.center.value.set(camera.position.x, 0, camera.position.z);
      }
    };
  }

  function makeLook(renderer, scene, options) {
    const rain = rainField(scene, options.compact, options.shelters ?? []);
    const canBloom = renderer.capabilities.isWebGL2 && renderer.extensions.has('EXT_color_buffer_float');
    if (!canBloom) {
      return (camera, state) => {
        rain(camera, state.clock, state.rain);
        renderer.render(scene, camera);
      };
    }

    const linearTarget = (depth = false) => new T.WebGLRenderTarget(2, 2, {
      type: T.HalfFloatType, minFilter: T.LinearFilter, magFilter: T.LinearFilter,
      depthBuffer: depth, stencilBuffer: false,
    });
    const color = linearTarget(true);
    color.depthTexture = new T.DepthTexture(2, 2, T.UnsignedIntType);
    color.depthTexture.name = 'Baixi scene depth';
    const glow = linearTarget();
    const scratch = linearTarget();
    const aoTarget = () => new T.WebGLRenderTarget(2, 2, { depthBuffer: false, stencilBuffer: false });
    const contact = aoTarget();
    const softContact = aoTarget();
    const size = new T.Vector2();
    const screen = new T.Scene();
    const screenCamera = new T.Camera();
    const quad = new T.Mesh(new T.PlaneGeometry(2, 2));
    quad.frustumCulled = false;
    screen.add(quad);
    const vertexShader = [
      'varying vec2 uvScreen;',
      'void main(){ uvScreen = uv; gl_Position = vec4(position.xy,0.,1.); }',
    ].join('\n');
    const pass = (uniforms, lines, toneMapped = false) => new T.ShaderMaterial({
      vertexShader, fragmentShader: ['varying vec2 uvScreen;', ...lines].join('\n'),
      uniforms, toneMapped, depthTest: false, depthWrite: false,
    });
    const threshold = pass({ image: { value: color.texture } }, [
      'uniform sampler2D image;',
      'void main(){',
      '  vec3 c = texture2D(image,uvScreen).rgb;',
      '  float peak = max(max(c.r,c.g),c.b);',
      '  gl_FragColor = vec4(min(c,vec3(4.2))*smoothstep(.88,2.45,peak),1.0);',
      '}',
    ]);
    const blur = pass({ image: { value: glow.texture }, direction: { value: new T.Vector2() } }, [
      'uniform sampler2D image; uniform vec2 direction;',
      'void main(){',
      '  vec3 c = texture2D(image,uvScreen).rgb*.227027;',
      '  c += (texture2D(image,uvScreen-direction*1.384615).rgb + texture2D(image,uvScreen+direction*1.384615).rgb)*.316216;',
      '  c += (texture2D(image,uvScreen-direction*3.230769).rgb + texture2D(image,uvScreen+direction*3.230769).rgb)*.070270;',
      '  gl_FragColor = vec4(c,1.0);',
      '}',
    ]);
    const depthUniforms = {
      depthMap: { value: color.depthTexture }, depthRange: { value: new T.Vector2() },
      pixelStep: { value: new T.Vector2() },
    };
    const depthCode = [
      'uniform sampler2D depthMap; uniform vec2 depthRange,pixelStep;',
      'float eyeDepth(vec2 at) {',
      '  float d=texture2D(depthMap,at).x;',
      '  return depthRange.x*depthRange.y/(depthRange.y-d*(depthRange.y-depthRange.x));',
      '}',
    ];
    const occlusion = pass({ ...depthUniforms, rayScale: { value: new T.Vector2() } }, [
      ...depthCode,
      'uniform vec2 rayScale;',
      'vec3 pointAt(vec2 at, float depth) { return vec3((2.*at-1.)*rayScale,-1.)*depth; }',
      'float nearby(vec2 at, vec3 point, vec3 normal, float radius) {',
      '  vec3 delta=pointAt(at,eyeDepth(at))-point;',
      '  float distanceToPoint=length(delta);',
      '  float horizon=dot(delta,normal)/max(.0001,distanceToPoint);',
      '  return smoothstep(.08,.48,horizon)*(1.-smoothstep(radius*.16,radius,distanceToPoint));',
      '}',
      'void main(){',
      '  vec2 at=uvScreen;',
      '  float depth=eyeDepth(at);',
      '  if(depth>112.) { gl_FragColor=vec4(1.); return; }',
      '  vec3 point=pointAt(at,depth);',
      '  vec2 sx=vec2(pixelStep.x,0.), sy=vec2(0.,pixelStep.y);',
      '  float left=eyeDepth(at-sx), right=eyeDepth(at+sx), bottom=eyeDepth(at-sy), top=eyeDepth(at+sy);',
      '  vec3 dx=(abs(left-depth)<abs(right-depth)) ? point-pointAt(at-sx,left) : pointAt(at+sx,right)-point;',
      '  vec3 dy=(abs(bottom-depth)<abs(top-depth)) ? point-pointAt(at-sy,bottom) : pointAt(at+sy,top)-point;',
      '  vec3 normal=normalize(cross(dx,dy));',
      '  float radius=.89+smoothstep(5.,35.,depth)*.32;',
      '  vec2 reach=min(vec2(radius)/(depth*rayScale*2.),pixelStep*22.);',
      '  float parity=mod(floor(gl_FragCoord.x)+floor(gl_FragCoord.y),2.0);',
      '  vec2 axis=mix(vec2(1.,0.),vec2(.92388,.38268),parity);',
      '  vec2 ortho=vec2(-axis.y,axis.x);',
      '  vec2 a=axis*reach*mix(.42,.88,parity);',
      '  vec2 b=ortho*reach*mix(.42,.88,parity);',
      '  vec2 c=(axis+ortho)*reach*.7071*mix(.88,.42,parity);',
      '  vec2 d=(axis-ortho)*reach*.7071*mix(.88,.42,parity);',
      '  float line=nearby(at+a,point,normal,radius)+nearby(at-a,point,normal,radius)',
      '           + nearby(at+b,point,normal,radius)+nearby(at-b,point,normal,radius)',
      '           + nearby(at+c,point,normal,radius)+nearby(at-c,point,normal,radius)',
      '           + nearby(at+d,point,normal,radius)+nearby(at-d,point,normal,radius);',
      '  float mask=1.0-line*(.49/8.)*(1.-smoothstep(60.,112.,depth));',
      '  gl_FragColor=vec4(vec3(mask),1.);',
      '}',
    ]);
    const spread = pass({ ...depthUniforms, image: { value: contact.texture } }, [
      ...depthCode,
      'uniform sampler2D image;',
      'vec2 tap(vec2 at,float depth){',
      '  float weight=1.-smoothstep(.03,.14+depth*.017,abs(eyeDepth(at)-depth));',
      '  return vec2(texture2D(image,at).r*weight,weight);',
      '}',
      'void main(){',
      '  float depth=eyeDepth(uvScreen);',
      '  vec2 sx=vec2(pixelStep.x,0.), sy=vec2(0.,pixelStep.y);',
      '  vec2 result=vec2(texture2D(image,uvScreen).r,1.)*2.;',
      '  result+=tap(uvScreen+sx,depth)+tap(uvScreen-sx,depth)+tap(uvScreen+sy,depth)+tap(uvScreen-sy,depth);',
      '  gl_FragColor=vec4(vec3(result.x/result.y),1.);',
      '}',
    ]);
    const final = pass({
      image: { value: color.texture }, lights: { value: glow.texture }, shadows: { value: softContact.texture },
      wet: { value: 0 }, night: { value: 0 }, pixel: { value: new T.Vector2() },
    }, [
      'uniform sampler2D image,lights,shadows;',
      'uniform float wet,night;',
      'uniform vec2 pixel;',
      'float brightness(vec3 shade){ return dot(shade/(1.+shade),vec3(.27,.60,.13)); }',
      'vec3 edgeSample(vec2 at){',
      '  vec3 c=texture2D(image,at).rgb;',
      '  float center=brightness(c);',
      '  float nw=brightness(texture2D(image,at+pixel*vec2(-.86,.86)).rgb);',
      '  float ne=brightness(texture2D(image,at+pixel*vec2(.86,.86)).rgb);',
      '  float sw=brightness(texture2D(image,at+pixel*vec2(-.86,-.86)).rgb);',
      '  float se=brightness(texture2D(image,at+pixel*vec2(.86,-.86)).rgb);',
      '  float low=min(center,min(min(nw,ne),min(sw,se)));',
      '  float high=max(center,max(max(nw,ne),max(sw,se)));',
      '  if(high-low<max(.032,high*.13)) return c;',
      '  vec2 along=vec2(sw+se-nw-ne,nw+sw-ne-se);',
      '  float reduce=max(.012,(nw+ne+sw+se)*.039);',
      '  along=clamp(along/(min(abs(along.x),abs(along.y))+reduce),-6.,6.)*pixel;',
      '  vec3 softened=(texture2D(image,at-along*.23).rgb+texture2D(image,at+along*.23).rgb)*.5;',
      '  return mix(c,softened,.72);',
      '}',
      'void main(){',
      '  vec3 c = edgeSample(uvScreen);',
      '  float exposure = brightness(c);',
      '  float contact=texture2D(shadows,uvScreen).r;',
      '  c *= mix(contact,1.0,.70*smoothstep(.27,.83,exposure));',
      '  c += texture2D(lights,uvScreen).rgb*(.18+.24*night+.068*wet);',
      '  vec3 shadowTint = mix(vec3(.936,.995,1.12),vec3(.885,.992,1.15),night);',
      '  c *= mix(shadowTint,vec3(1.088,1.026,.948),smoothstep(.11,.54,exposure));',
      '  float luminance = dot(c,vec3(.2126,.7152,.0722));',
      '  c = max(vec3(0.),mix(vec3(luminance),c,1.125));',
      '  vec2 edges = (uvScreen-.5)*vec2(1.18,.92);',
      '  c *= 1.0-smoothstep(.24,.78,length(edges))*.085;',
      '  gl_FragColor = vec4(c,1.0);',
      '  #include <tonemapping_fragment>',
      '  #include <colorspace_fragment>',
      '  gl_FragColor.rgb += (fract(52.9829189*fract(dot(gl_FragCoord.xy,vec2(.06711056,.00583715))))-.5)/255.0;',
      '}',
    ], true);

    function draw(material, destination) {
      quad.material = material;
      renderer.setRenderTarget(destination);
      renderer.render(screen, screenCamera);
    }
    return (camera, state) => {
      rain(camera, state.clock, state.rain);
      const mode = options.mode();
      if (mode !== 'high') {
        renderer.render(scene, camera);
        return;
      }
      renderer.getDrawingBufferSize(size);
      if (size.x !== color.width || size.y !== color.height) {
        color.setSize(size.x, size.y);
      }
      renderer.setRenderTarget(color);
      renderer.render(scene, camera);
      const w = Math.max(2, Math.floor(size.x / 4));
      const h = Math.max(2, Math.floor(size.y / 4));
      const contactWidth = Math.max(2, Math.floor(size.x / 2));
      const contactHeight = Math.max(2, Math.floor(size.y / 2));
      if (w !== glow.width || h !== glow.height || contactWidth !== contact.width || contactHeight !== contact.height) {
        glow.setSize(w, h);
        scratch.setSize(w, h);
        contact.setSize(contactWidth, contactHeight);
        softContact.setSize(contact.width, contact.height);
      }
      depthUniforms.depthRange.value.set(camera.near, camera.far);
      depthUniforms.pixelStep.value.set(1 / contact.width, 1 / contact.height);
      occlusion.uniforms.rayScale.value.set(1 / camera.projectionMatrix.elements[0], 1 / camera.projectionMatrix.elements[5]);
      draw(occlusion, contact);
      draw(spread, softContact);
      draw(threshold, glow);
      blur.uniforms.image.value = glow.texture;
      blur.uniforms.direction.value.set(1.68 / glow.width, 0);
      draw(blur, scratch);
      blur.uniforms.image.value = scratch.texture;
      blur.uniforms.direction.value.set(0, 1.68 / glow.height);
      draw(blur, glow);
      final.uniforms.wet.value = state.wetness;
      final.uniforms.night.value = state.night;
      final.uniforms.pixel.value.set(1 / color.width, 1 / color.height);
      draw(final, null);
    };
  }

  function makeRainAudio() {
    let audio, rain, road, rainVolume, roadVolume, gate;
    const Context = window.AudioContext ?? window.webkitAudioContext;
    function start() {
      if (!Context) return;
      if (audio) {
        if (audio.state === 'suspended') audio.resume().catch(() => {});
        return;
      }
      try {
        audio = new Context();
        const count = audio.sampleRate * 3;
        const buffer = audio.createBuffer(1, count, audio.sampleRate);
        const data = buffer.getChannelData(0);
        const rng = D.rng(23811);
        for (let i = 0; i < count; i++) data[i] = rng() * 2 - 1;
        const noise = audio.createBufferSource();
        noise.buffer = buffer;
        noise.loop = true;
        rain = audio.createBiquadFilter();
        rain.type = 'bandpass';
        rain.frequency.value = 1650;
        rain.Q.value = .39;
        road = audio.createBiquadFilter();
        road.type = 'lowpass';
        road.frequency.value = 480;
        rainVolume = audio.createGain();
        roadVolume = audio.createGain();
        gate = audio.createGain();
        rainVolume.gain.value = roadVolume.gain.value = 0;
        noise.connect(rain).connect(rainVolume).connect(gate);
        noise.connect(road).connect(roadVolume).connect(gate);
        gate.connect(audio.destination);
        noise.start();
        if (audio.state === 'suspended') audio.resume().catch(() => {});
      } catch {
        audio = undefined;
      }
    }
    function tick(state, running, enabled, sheltered) {
      if (!gate) return;
      const at = audio.currentTime;
      const speed = (state.boat ?? state.vehicle)?.speed ?? 0;
      const atSea = Boolean(state.boat) || D.marineWalkable(state.player.x, state.player.z);
      gate.gain.setTargetAtTime(running && enabled ? 1 : 0, at, .13);
      rain.frequency.setTargetAtTime(sheltered ? 435 : state.vehicle ? 1070 : 1710, at, .22);
      rainVolume.gain.setTargetAtTime(state.rain * (sheltered ? .083 : .135), at, .27);
      const surf = atSea ? .031 + .007 * Math.sin(state.clock * 1.19) : 0;
      const motion = speed > 2 ? Math.min(.105, speed * (state.boat ? .0042 : .00175)) * (1 + state.wetness * .45) : 0;
      roadVolume.gain.setTargetAtTime(surf + motion, at, .12);
      road.frequency.setTargetAtTime(180 + speed * 22 + (atSea ? 160 : state.vehicle?.brake ? 355 : 0), at, .12);
    }
    return { start, tick };
  }

  Object.assign(D, { makeLook, makeRainAudio });
})();
