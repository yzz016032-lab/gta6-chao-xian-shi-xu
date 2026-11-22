(() => {
  'use strict';
  const T = window.THREE;
  const D = window.Tideline;
  const { clamp, distance, angleDiff } = D;

  function createWarehouseWatch(scene, world, factory, layout) {
    const rays = 13;
    const halfAngle = .69;
    const height = .264;
    const uniformColor = { value: new T.Color('#ffcd79') };
    const sectorMaterial = new T.ShaderMaterial({
      transparent: true, depthWrite: false, side: T.DoubleSide, toneMapped: false,
      uniforms: { lightColor: uniformColor },
      vertexShader: [
        'attribute float opacity; varying float amount;',
        'void main(){ amount = opacity; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      ].join('\n'),
      fragmentShader: [
        'uniform vec3 lightColor; varying float amount;',
        'void main(){gl_FragColor=vec4(lightColor,amount);',
        ' #include <colorspace_fragment>',
        '}',
      ].join('\n'),
    });
    const patrols = layout.guardRoutes.map((points, slot) => {
      const guard = factory.person(slot % 2 ? '#4c5661' : '#536455', '#293744', slot % 2 ? '#b48b73' : '#8d6654');
      const positions = new Float32Array((rays + 1) * 3);
      const shape = new T.BufferGeometry();
      const indices = [];
      for (let i = 1; i < rays; i++) indices.push(0, i, i + 1);
      shape.setAttribute('position', new T.BufferAttribute(positions, 3).setUsage(T.DynamicDrawUsage));
      shape.setAttribute('opacity', new T.BufferAttribute(new Float32Array([.36, ...Array(rays).fill(.042)]), 1));
      shape.setIndex(indices);
      const sector = new T.Mesh(shape, sectorMaterial);
      sector.frustumCulled = false;
      sector.renderOrder = 1;
      sector.visible = false;
      scene.add(sector);
      return { guard, points, sector, turns: 0, next: slot % points.length, pace: 0 };
    });
    let coneClock = 0;
    const coneTint = new T.Color('#ff715f');
    const calmTint = new T.Color('#ffe2a2');

    function reset() {
      for (const [slot, unit] of patrols.entries()) {
        const { points, guard } = unit;
        // Start each sweep at a different wall so the first route remains readable.
        const initial = points[(slot * 2 + 1) % points.length];
        unit.next = (slot * 2 + 2) % points.length;
        guard.x = initial.x;
        guard.z = initial.z;
        guard.yaw = Math.atan2(points[unit.next].x - initial.x, points[unit.next].z - initial.z);
        unit.pace = 0;
        unit.turns = .75 + slot * .5;
        unit.sector.visible = false;
        factory.posePerson(guard, 0, 0);
      }
    }
    function indoors(point) {
      const bound = layout.bounds;
      return point.x > bound.minX && point.x < bound.maxX && point.z > bound.minZ && point.z < bound.maxZ;
    }
    function tick(dt, player, vehicle, searching) {
      if (distance(vehicle ?? player, layout.entry) > 135) return 0;
      let awareness = 0;
      for (const unit of patrols) {
        const { guard, points } = unit;
        const nextPoint = points[unit.next];
        const targetYaw = Math.atan2(nextPoint.x - guard.x, nextPoint.z - guard.z);
        const gap = distance(guard, nextPoint);
        const yaw = angleDiff(targetYaw, guard.yaw);
        guard.yaw += clamp(yaw, -dt * 2.9, dt * 2.9);
        if (gap < .14) {
          unit.next = (unit.next + 1) % points.length;
          unit.turns = .61;
        }
        unit.turns = Math.max(0, unit.turns - dt);
        unit.pace = unit.turns || Math.abs(yaw) > .42 ? 0 : 1.16;
        // The route points are centred in unobstructed warehouse aisles.
        if (unit.pace) {
          const advance = Math.min(unit.pace * dt, gap);
          guard.x += Math.sin(guard.yaw) * advance;
          guard.z += Math.cos(guard.yaw) * advance;
        }
        if (!searching || vehicle) continue;
        const range = distance(guard, player);
        const target = Math.atan2(player.x - guard.x, player.z - guard.z);
        const angle = Math.abs(angleDiff(target, guard.yaw));
        const low = player.crouching;
        const running = player.walking > 5.2;
        if (range < (low ? 7.35 : 12.6) && (range < 1.8 || angle < halfAngle)
          && !world.occluded(guard, player, .36, low ? .98 : 1.46)) {
          const gain = low ? .39 : .74;
          awareness = Math.max(awareness, gain * (1.18 - range / 25) + (running ? .34 : 0));
        } else if (running && range < 6.0 && !world.occluded(guard, player, .48, .55)) {
          awareness = Math.max(awareness, .52 * (1.3 - range / 8));
        }
      }
      return awareness;
    }
    function aimSector(unit, crouched) {
      const { guard, sector } = unit;
      const positions = sector.geometry.attributes.position;
      positions.setXYZ(0, guard.x, height, guard.z);
      const range = crouched ? 7.35 : 12.6;
      for (let i = 0; i < rays; i++) {
        const theta = guard.yaw + (i / (rays - 1) * 2 - 1) * halfAngle;
        const dx = Math.sin(theta);
        const dz = Math.cos(theta);
        let length = .30;
        // The floor marker follows the same sight blockers as the patrol logic.
        for (; length < range; length += .46) {
          if (world.collision(guard.x + dx * length, guard.z + dz * length, .13, crouched ? .98 : 1.46)) break;
        }
        length = Math.min(range, length);
        positions.setXYZ(i + 1, guard.x + dx * length, height, guard.z + dz * length);
      }
      positions.needsUpdate = true;
    }
    function render(dt, p, crouched, showCones, suspicion) {
      coneClock -= dt;
      if (coneClock <= 0) uniformColor.value.copy(calmTint).lerp(coneTint, suspicion);
      for (const unit of patrols) {
        const visible = distance(p, unit.guard) < 94;
        unit.guard.root.visible = visible;
        unit.sector.visible = visible && showCones;
        if (visible) factory.posePerson(unit.guard, dt, unit.pace);
        if (unit.sector.visible && coneClock <= 0) aimSector(unit, crouched);
      }
      if (coneClock <= 0) coneClock = .058;
    }
    reset();
    return { reset, indoors, tick, render, guards: patrols.map(unit => unit.guard) };
  }

  D.createWarehouseWatch = createWarehouseWatch;
})();
