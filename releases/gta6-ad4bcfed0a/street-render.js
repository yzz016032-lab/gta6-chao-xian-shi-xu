(() => {
  'use strict';
  const T = window.THREE;
  const D = window.Tideline;

  let harborSky;
  function harborReflectionTexture() {
    if (harborSky) return harborSky;
    const width = 512;
    const height = 256;
    const pixels = new Uint8Array(width * height * 4);
    const random = D.rng(428113);
    const roofs = Array.from({ length: 44 }, () => .011 + random() * .081);
    const roofStyles = roofs.map(() => random());
    const horizon = [.84, .59, .45];
    const blueSky = [.19, .34, .51];
    const waterfront = [.08, .138, .158];
    for (let y = 0; y < height; y++) {
      const latitude = (y + .5) / height - .5;
      const skyFade = D.clamp(latitude * 3.1, 0, 1);
      for (let x = 0; x < width; x++) {
        const longitude = (x + .5) / width;
        const distanceToSun = Math.min(Math.abs(longitude - .69), 1 - Math.abs(longitude - .69));
        const afterglow = Math.exp(-46 * distanceToSun * distanceToSun - 15 * Math.abs(latitude - .068));
        const block = Math.floor(longitude * roofs.length);
        const lot = longitude * roofs.length - block;
        const terrace = .049 * Math.sin(longitude * Math.PI * 6 + 1.2);
        const landward = .5 - .5 * Math.cos((longitude - .5) * Math.PI * 2);
        const roof = (roofs[block] + Math.max(0, terrace)) * (.18 + landward * 1.69);
        const street = latitude > -.065 && latitude < roof && lot > .08 && lot < .95;
        const windows = street && latitude > -.023 && Math.floor((latitude + .023) * 355) % 5 < 2
          && Math.floor(longitude * 532) % 4 < 2 && roofStyles[block] > .49;
        const offset = (y * width + x) * 4;
        for (let channel = 0; channel < 3; channel++) {
          let value = latitude < -.046
            ? waterfront[channel] * (1 + .78 * Math.exp(13 * (latitude + .046)))
            : horizon[channel] + (blueSky[channel] - horizon[channel]) * skyFade;
          if (!street) value += afterglow * (channel === 0 ? .56 : channel === 1 ? .32 : .14);
          else if (windows) value = roofStyles[block] > .70 ? [1.0, .72, .40][channel] : [.42, .82, .88][channel];
          else value = waterfront[channel] * (.93 + roofStyles[block] * .48);
          pixels[offset + channel] = Math.round(D.clamp(value, 0, 1) * 255);
        }
        pixels[offset + 3] = 255;
      }
    }
    const sky = new T.DataTexture(pixels, width, height, T.RGBAFormat, T.UnsignedByteType);
    sky.colorSpace = T.SRGBColorSpace;
    sky.mapping = T.EquirectangularReflectionMapping;
    sky.wrapS = T.RepeatWrapping;
    sky.generateMipmaps = true;
    sky.magFilter = T.LinearFilter;
    sky.minFilter = T.LinearMipmapLinearFilter;
    sky.needsUpdate = true;
    harborSky = sky;
    return sky;
  }
  function harborEnvironment(renderer) {
    if (!renderer.capabilities.isWebGL2 || !renderer.extensions.has('EXT_color_buffer_float')) return null;
    const generator = new T.PMREMGenerator(renderer);
    const lighting = generator.fromEquirectangular(harborReflectionTexture());
    generator.dispose();
    return lighting;
  }

  function makeStreetEffects(renderer, scene, world, mode, compact = false) {
    const resetShadows = () => {
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = T.PCFSoftShadowMap;
      renderer.shadowMap.autoUpdate = false;
    };
    resetShadows();

    const reflection = world.roadReflection;
    const target = new T.WebGLRenderTarget(2, 2, {
      depthBuffer: true,
      stencilBuffer: false,
      minFilter: renderer.capabilities.isWebGL2 ? T.LinearMipmapLinearFilter : T.LinearFilter,
      magFilter: T.LinearFilter,
    });
    target.texture.generateMipmaps = renderer.capabilities.isWebGL2;
    target.texture.name = 'Baixi planar reflection';
    reflection.image.value = target.texture;
    const mirror = new T.PerspectiveCamera();
    const vertical = new T.Vector3(0, 1, 0);
    const surface = new T.Plane(vertical, 0);
    const tilted = new T.Plane();
    const forward = new T.Vector3();
    const reflectedDirection = new T.Vector3();
    const worldUp = new T.Vector3();
    const clip = new T.Vector4();
    const farCorner = new T.Vector4();
    const bias = new T.Matrix4().set(
      .5, 0, 0, .5,
      0, .5, 0, .5,
      0, 0, .5, .5,
      0, 0, 0, 1,
    );
    const lastPosition = new T.Vector3();
    const lastDirection = new T.Vector3();
    let sampledAt = -100;
    let lastMode = '';
    let lastSurface = '';
    let lastAspect = 0;
    let environment;

    function reflect(camera, kind) {
      const floor = kind === 'water' ? -.47 : .020;
      surface.constant = -floor - (kind === 'water' ? .09 : .032);
      mirror.position.copy(camera.position);
      mirror.position.y = 2 * floor - camera.position.y;
      worldUp.set(0, 1, 0).transformDirection(camera.matrixWorld).reflect(vertical);
      mirror.up.copy(worldUp);
      reflectedDirection.copy(forward).reflect(vertical).add(mirror.position);
      mirror.lookAt(reflectedDirection);
      mirror.far = camera.far;
      mirror.updateMatrixWorld();
      mirror.projectionMatrix.copy(camera.projectionMatrix);
      reflection.projection.value.copy(bias).multiply(mirror.projectionMatrix).multiply(mirror.matrixWorldInverse);

      // Clip the mirror at the road plane with an oblique near plane.
      tilted.copy(surface).applyMatrix4(mirror.matrixWorldInverse);
      clip.set(tilted.normal.x, tilted.normal.y, tilted.normal.z, tilted.constant);
      const matrix = mirror.projectionMatrix.elements;
      farCorner.set((Math.sign(clip.x) + matrix[8]) / matrix[0], (Math.sign(clip.y) + matrix[9]) / matrix[5],
        -1, (1 + matrix[10]) / matrix[14]);
      clip.multiplyScalar(2 / clip.dot(farCorner));
      matrix[2] = clip.x;
      matrix[6] = clip.y;
      matrix[10] = clip.z + 1 - .001;
      matrix[14] = clip.w;
      mirror.projectionMatrixInverse.copy(mirror.projectionMatrix).invert();

      const pixelWidth = compact ? 400 : 820;
      const h = Math.min(compact ? 236 : 560, Math.max(100, Math.round(pixelWidth / camera.aspect)));
      const w = Math.max(200, Math.round(h * camera.aspect));
      if (w !== target.width || h !== target.height) target.setSize(w, h);
      const previousTarget = renderer.getRenderTarget();
      const recalculateShadows = renderer.shadowMap.needsUpdate;
      renderer.shadowMap.needsUpdate = false;
      reflection.strength.value = 0;
      reflection.waterStrength.value = 0;
      try {
        renderer.setRenderTarget(target);
        renderer.render(scene, mirror);
      } finally {
        renderer.setRenderTarget(previousTarget);
        renderer.shadowMap.needsUpdate = recalculateShadows;
      }
    }

    function prepare(camera, state, surfaceKind, changingView = false) {
      const display = mode();
      const high = display === 'high';
      if (high && environment === undefined) environment = harborEnvironment(renderer);
      scene.environment = high ? environment?.texture ?? null : null;
      const eligible = high && surfaceKind && !state.sheltered && camera.position.y > .1 &&
        (surfaceKind === 'water' || state.wetness > .17);
      reflection.strength.value = 0;
      reflection.waterStrength.value = 0;
      if (!eligible) {
        lastSurface = '';
        return;
      }
      camera.updateMatrixWorld();
      camera.getWorldDirection(forward);
      const moved = lastPosition.distanceToSquared(camera.position) > .35 || lastDirection.dot(forward) < .9987;
      const age = state.clock - sampledAt;
      const due = age >= (compact ? .56 : .30) || (moved && age >= (compact ? .22 : .11));
      // Keep the previous world-projected image while the lens moves to its new mount.
      if (surfaceKind !== lastSurface || display !== lastMode || lastAspect !== camera.aspect || age < 0 ||
        age >= .90 || (!changingView && due)) {
        reflect(camera, surfaceKind);
        sampledAt = state.clock;
        lastPosition.copy(camera.position);
        lastDirection.copy(forward);
      }
      lastMode = display;
      lastSurface = surfaceKind;
      lastAspect = camera.aspect;
      const strength = surfaceKind === 'water' ? reflection.waterStrength : reflection.strength;
      strength.value = 1;
    }
    prepare.reset = () => {
      environment?.dispose();
      environment = undefined;
      scene.environment = null;
      sampledAt = -100;
      lastSurface = '';
      resetShadows();
    };
    return prepare;
  }

  Object.assign(D, { makeStreetEffects, harborReflectionTexture });
})();
