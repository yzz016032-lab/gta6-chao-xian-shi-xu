(() => {
  'use strict';
  const D = window.Tideline;
  const T = window.THREE;
  let geometryPromise;
  const colorLUT = Uint8Array.from({ length: 256 }, (_, n) =>
    Math.round(T.ColorManagement.toWorkingColorSpace(new T.Color().setRGB(n / 255, 0, 0), T.SRGBColorSpace).r * 255));

  function readGeometry(buffer) {
    const bytes = new DataView(buffer);
    if (bytes.getUint32(0) !== 0x42584331) throw Error('Car model header');
    const headerLength = bytes.getUint32(4, true);
    let offset = 8 + headerLength;
    const parts = Object.create(null);
    const groups = JSON.parse(new TextDecoder().decode(new Uint8Array(buffer, 8, headerLength)));
    for (const [name, count, indexCount] of groups) {
      if (count > 65535 || offset + count * 12 + indexCount * 2 > bytes.byteLength) throw Error('Car model size');
      const pos = new Float32Array(count * 3);
      const normal = new Int8Array(count * 3);
      const color = new Uint8Array(count * 3);
      for (let i = 0; i < count; i++, offset += 12) for (let a = 0; a < 3; a++) {
        pos[i * 3 + a] = bytes.getInt16(offset + 2 * a, true) * .0001;
        normal[i * 3 + a] = bytes.getInt8(offset + 6 + a);
        color[i * 3 + a] = colorLUT[bytes.getUint8(offset + 9 + a)];
      }
      const indices = new Uint16Array(indexCount);
      for (let i = 0; i < indexCount; i++, offset += 2) indices[i] = bytes.getUint16(offset, true);
      const g = new T.BufferGeometry();
      g.setAttribute('position', new T.BufferAttribute(pos, 3));
      g.setAttribute('normal', new T.BufferAttribute(normal, 3, true));
      g.setAttribute('color', new T.BufferAttribute(color, 3, true));
      g.setIndex(new T.BufferAttribute(indices, 1));
      g.computeBoundingSphere();
      parts[name] = g;
    }
    const required = ['paint','trim','steering','glass','head','rear','left','right','leftCaliper','rightCaliper','far',
      'cruisePaint','cruiseTrim','cruiseGlass','cruiseLeft','cruiseRight'];
    if (offset !== buffer.byteLength || !required.every(key => parts[key])) {
      throw Error('Incomplete car model');
    }
    return parts;
  }
  function requestModel() {
    if (!geometryPromise) geometryPromise = fetch('assets/baixi-rs.bin').then(response => {
      if (!response.ok) throw Error('Car model download');
      return response.arrayBuffer();
    }).then(readGeometry).catch(() => null);
    return geometryPromise;
  }
  const mechanical = new T.MeshStandardMaterial({ vertexColors:true, roughness:.34, metalness:.52, envMapIntensity:1.05 });
  const rubberAndAlloy = new T.MeshStandardMaterial({ vertexColors:true, roughness:.28, metalness:.58, envMapIntensity:1.15 });
  const carbonAero = new T.MeshPhysicalMaterial({ color:'#1a2229', roughness:.26, metalness:.45, clearcoat:.85, clearcoatRoughness:.14, envMapIntensity:1.15 });
  const cyberCyan = new T.MeshStandardMaterial({ color:'#b8ffff', emissive:'#3df2ff', emissiveIntensity:1.85, roughness:.2, metalness:.1 });
  const cyberTail = new T.MeshStandardMaterial({ color:'#ff6b7a', emissive:'#ff1e42', emissiveIntensity:1.65, roughness:.2, metalness:.1 });
  const glass = new T.MeshPhysicalMaterial({
    color:'#8ec6d8', roughness:.07, metalness:.20, clearcoat:1.0, clearcoatRoughness:.04,
    transparent:true, opacity:.46, depthWrite:false, envMapIntensity:1.48, side:T.DoubleSide,
  });
  glass.forceSinglePass = true;
  const tintedGlass = new T.MeshPhysicalMaterial({ color:'#3a5464', roughness:.12, metalness:.38, clearcoat:.85, clearcoatRoughness:.08, envMapIntensity:1.25 });
  function underglowTexture() {
    const c = document.createElement('canvas');
    c.width = c.height = 96;
    const g = c.getContext('2d');
    const r = g.createRadialGradient(48, 48, 8, 48, 48, 48);
    r.addColorStop(0, '#58f4ff99');
    r.addColorStop(.52, '#2bc8e844');
    r.addColorStop(1, '#2bc8e800');
    g.fillStyle = r;
    g.fillRect(0, 0, 96, 96);
    return new T.CanvasTexture(c);
  }
  const underglowGeo = new T.PlaneGeometry(2.58, 4.75).rotateX(-Math.PI / 2);
  const underglowMat = new T.MeshBasicMaterial({ map: underglowTexture(), transparent:true, depthWrite:false, opacity:.34, blending:T.AdditiveBlending });
  const aeroBox = new T.BoxGeometry(1, 1, 1);
  const plateGeometry = new T.PlaneGeometry(.365, .109);
  const plateCanvas = document.createElement('canvas');
  plateCanvas.width = 256; plateCanvas.height = 76;
  const ink = plateCanvas.getContext('2d');
  ink.fillStyle = '#39474b'; ink.fillRect(0, 0, 256, 76);
  ink.fillStyle = '#d6cfb7'; ink.fillRect(3, 3, 250, 70);
  ink.fillStyle = '#35484a'; ink.fillRect(8, 7, 240, 14);
  ink.font = '600 11px sans-serif'; ink.textAlign = 'center'; ink.fillStyle = '#ede6cf';
  ink.fillText('BAIXI  ·  白汐港', 128, 18);
  ink.fillStyle = '#27373b'; ink.font = 'bold 44px monospace'; ink.fillText('RS  2608', 128, 62);
  for (const x of [14,242]) { ink.beginPath(); ink.arc(x, 39, 3, 0, 2*Math.PI); ink.fill(); }
  const plateTexture = new T.CanvasTexture(plateCanvas);
  plateTexture.colorSpace = T.SRGBColorSpace;
  const plateMaterial = new T.MeshStandardMaterial({map:plateTexture, roughness:.52, metalness:.12});
  D.fitConceptCar = function (car, paint, headlight, runningLight, brakeLight) {
    return requestModel().then(parts => {
      if (!parts || car.concept) return;
      const finish = paint.clone();
      finish.vertexColors = false;
      finish.roughness = .15;
      finish.metalness = .58;
      finish.clearcoat = 1.0;
      finish.clearcoatRoughness = .05;
      finish.envMapIntensity = 1.48;
      const baseCompile = paint.onBeforeCompile;
      finish.customProgramCacheKey = () => (paint.customProgramCacheKey?.() || 'hero') + '-concept-irid';
      finish.onBeforeCompile = shader => {
        if (baseCompile) baseCompile(shader);
        shader.fragmentShader = shader.fragmentShader.replace('#include <emissivemap_fragment>', [
          '#include <emissivemap_fragment>',
          'float cyberFresnel = pow(1.0 - clamp(dot(normalize(vViewPosition), normal), 0., 1.), 3.4);',
          'totalEmissiveRadiance += vec3(.07, .17, .24) * cyberFresnel * .62;',
        ].join('\n'));
      };
      const shell = new T.Mesh(parts.paint, finish);
      const trim = new T.Mesh(parts.trim, mechanical);
      const windows = new T.Mesh(parts.glass, glass);
      const heads = new T.Mesh(parts.head, headlight);
      const rear = new T.Mesh(parts.rear, runningLight);
      const plate = new T.Mesh(plateGeometry, plateMaterial);
      plate.position.set(0,.298,-2.09);
      plate.rotation.set(-.22,Math.PI,0,'YXZ');
      const steering = new T.Group();
      steering.position.set(0, .621, .885);
      const rim = new T.Mesh(parts.steering, mechanical);
      rim.position.copy(steering.position).multiplyScalar(-1);
      steering.add(rim);
      // Futuristic concept aero & neon plasma signature kit
      const cyberKit = new T.Group();
      const addAero = (mat, x, y, z, w, h, d, rx = 0, ry = 0, rz = 0) => {
        const m = new T.Mesh(aeroBox, mat);
        m.position.set(x, y, z);
        m.scale.set(w, h, d);
        m.rotation.set(rx, ry, rz, 'YXZ');
        cyberKit.add(m);
        return m;
      };
      // Floating split active rear wing + twin angled pylons + carbon endplates
      addAero(carbonAero, 0, 1.03, -2.01, 1.88, .032, .22, -.11);
      addAero(carbonAero, -.44, .91, -1.97, .036, .20, .14, .18);
      addAero(carbonAero, .44, .91, -1.97, .036, .20, .14, .18);
      addAero(carbonAero, -.94, 1.01, -2.01, .026, .145, .26, -.08);
      addAero(carbonAero, .94, 1.01, -2.01, .026, .145, .26, -.08);
      // Glowing cyan wingtip micro-blades & side-skirt plasma strips
      addAero(cyberCyan, -.955, 1.03, -2.01, .012, .026, .22, -.08);
      addAero(cyberCyan, .955, 1.03, -2.01, .012, .026, .22, -.08);
      addAero(cyberCyan, -.98, .255, .04, .016, .018, 1.66);
      addAero(cyberCyan, .98, .255, .04, .016, .018, 1.66);
      // Front cyber DRL laser bar & holographic cockpit HUD strip
      addAero(cyberCyan, 0, .59, 2.18, 1.24, .018, .022);
      addAero(cyberCyan, 0, .745, 1.06, .42, .014, .018, -.25);
      // Full-width rear crimson laser bar
      const rearBlade = addAero(cyberTail, 0, .77, -2.14, 1.56, .024, .026);
      const underglow = new T.Mesh(underglowGeo, underglowMat);
      underglow.position.set(0, .038, .04);
      shell.castShadow = true;
      shell.receiveShadow = trim.receiveShadow = windows.receiveShadow = true;
      car.sprungBody.clear();
      car.sprungBody.add(shell, trim, steering, heads, rear, plate, cyberKit, windows);
      if (car.beam?.parent) car.beam.parent.add(underglow);
      const wheelMeshes = [];
      for (const wheel of car.wheels) {
        const side = wheel.hub.position.x < 0 ? 'left' : 'right';
        const tire = new T.Mesh(parts[side], rubberAndAlloy);
        const caliper = new T.Mesh(parts[side + 'Caliper'], mechanical);
        tire.rotation.x = wheel.tire.rotation.x;
        tire.receiveShadow = caliper.receiveShadow = true;
        wheel.hub.clear();
        wheel.hub.add(tire, caliper);
        wheel.tire = tire;
        wheelMeshes.push({ side, tire, caliper });
      }
      car.distant.geometry = parts.far;
      car.distant.material = mechanical;
      const lod = car.distant.parent;
      const farLevel = lod.levels.find(level => level.object === car.distant);
      farLevel.distance = matchMedia('(pointer:coarse)').matches ? 21 : 30;
      function useDetail(full) {
        shell.geometry = full ? parts.paint : parts.cruisePaint;
        trim.geometry = full ? parts.trim : parts.cruiseTrim;
        windows.geometry = full ? parts.glass : parts.cruiseGlass;
        windows.material = full ? glass : tintedGlass;
        shell.castShadow = full;
        steering.visible = plate.visible = cyberKit.visible = full;
        for (const {side, tire, caliper} of wheelMeshes) {
          tire.geometry = full ? parts[side] : side === 'left' ? parts.cruiseLeft : parts.cruiseRight;
          caliper.visible = full;
        }
        car.concept.full = full;
      }
      const original = parts.far.getAttribute('color');
      const pigment = [188,57,44].map(value => colorLUT[value]);
      function repaint(color) {
        finish.color.set(color);
        car.color = color;
        if (car.distant.geometry === parts.far) {
          if (color.toLowerCase() === '#bc392c') return true;
          const g = new T.BufferGeometry();
          g.setIndex(parts.far.index);
          g.setAttribute('position', parts.far.getAttribute('position'));
          g.setAttribute('normal', parts.far.getAttribute('normal'));
          g.setAttribute('color', original.clone());
          g.boundingSphere = parts.far.boundingSphere;
          car.distant.geometry = g;
        }
        const colors = car.distant.geometry.getAttribute('color');
        for (let i = 0; i < original.count; i++) {
          if (original.array[3*i] !== pigment[0] || original.array[3*i+1] !== pigment[1] || original.array[3*i+2] !== pigment[2]) continue;
          colors.setXYZ(i, finish.color.r, finish.color.g, finish.color.b);
        }
        colors.needsUpdate = true;
        return true;
      }
      function updateNight(night, braking, active) {
        const glowOn = active && night > .18;
        underglow.visible = glowOn;
        underglowMat.opacity = .10 + night * .34;
        cyberCyan.emissiveIntensity = 1.05 + night * 2.15;
        cyberTail.emissiveIntensity = braking ? 4.4 : 1.15 + night * 1.9;
        rearBlade.scale.y = braking ? .034 : .024;
      }
      Object.assign(car, { shell, trim, windows, tail:[], bodyBounds:{ offset:.16, halfLength:2.28, halfWidth:1.125, height:1.10 },
        concept:{ rear, runningLight, brakeLight, steering, repaint, useDetail, updateNight } });
      useDetail(car.type !== 'traffic');
      repaint(car.color);
    });
  };
  const wheelAxis = new T.Vector3(0, -.42, .91).normalize();
  const down = new T.Vector3(0, -1, 0);
  const target = new T.Vector3(), direction = new T.Vector3(), bend = new T.Vector3(), joint = new T.Vector3();
  const toChest = new T.Matrix4(), inverseArm = new T.Quaternion();
  function gripWheel(limb, steering) {
    const {arm, elbow, side} = limb;
    target.set(side * .126, .056, .026).applyQuaternion(steering.quaternion).add(steering.position).applyMatrix4(toChest);
    direction.subVectors(target, arm.position);
    const reach = Math.min(.568, Math.max(.08, direction.length()));
    direction.normalize();
    const upper = -elbow.position.y, lower = .295;
    const along = (upper*upper - lower*lower + reach*reach) / (2*reach);
    bend.set(side * .62, -.90, -.18);
    bend.addScaledVector(direction, -bend.dot(direction)).normalize();
    joint.copy(arm.position).addScaledVector(direction, along).addScaledVector(bend, Math.sqrt(Math.max(0, upper*upper - along*along)));
    arm.quaternion.setFromUnitVectors(down, bend.subVectors(joint, arm.position).normalize());
    inverseArm.copy(arm.quaternion).invert();
    elbow.quaternion.setFromUnitVectors(down, bend.subVectors(target, joint).normalize().applyQuaternion(inverseArm));
  }
  D.poseConceptDriver = function (person, car) {
    if (!car.concept.full) car.concept.useDetail(true);
    const root = person.root;
    if (root.parent !== car.sprungBody) car.sprungBody.add(root);
    root.visible = true;
    person.shadow.visible = false;
    root.position.set(0, .030, .67);
    root.rotation.set(0, 0, 0);
    root.scale.setScalar(.92);
    person.upper.position.set(0, .185, 0);
    person.chest.rotation.set(-.50, 0, 0);
    person.head.rotation.set(.37, car.steer * .18, 0);
    const turn = car.steer * .80;
    car.concept.steering.quaternion.setFromAxisAngle(wheelAxis, turn);
    root.updateMatrix(); person.upper.updateMatrix(); person.chest.updateMatrix();
    toChest.copy(root.matrix).multiply(person.upper.matrix).multiply(person.chest.matrix).invert();
    for (const limb of person.limbs) {
      const { hip, knee, boot } = limb;
      hip.position.y = .185;
      hip.position.z = 0;
      hip.rotation.x = -2.00;
      knee.rotation.x = .71;
      boot.rotation.x = 1.02;
      gripWheel(limb, car.concept.steering);
    }
  };
  D.leaveConceptSeat = function (person, scene) {
    scene.add(person.root);
    person.root.visible = false;
    person.root.scale.setScalar(1);
    person.shadow.visible = true;
    for (const {arm, elbow} of person.limbs) { arm.rotation.set(0,0,0); elbow.rotation.set(0,0,0); }
  };
})();
