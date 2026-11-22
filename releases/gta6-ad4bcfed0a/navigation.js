(() => {
  'use strict';
  const T = window.THREE;
  const D = window.Tideline;
  const { angleDiff, distance, routeBetween } = D;
  const direction = (from, to) => Math.atan2(to.x - from.x, to.z - from.z);
  const turn = delta => delta > 0 ? 'left' : 'right';
  const guideColor = '#a4efd0';

  function roadGuide(car, destination) {
    const gap = distance(car, destination);
    const route = routeBetween(car, destination);
    if (route.at(-1) === destination) route.pop();
    const road = route.filter((point, i, points) => !i || distance(point, points[i - 1]) > .1);
    const legs = road.slice(1).map((point, i) => ({
      from: road[i], to: point, length: distance(road[i], point), heading: direction(road[i], point),
    }));
    const first = legs[0];
    const guidance = (maneuver, meters) => ({ maneuver, meters: Math.round(meters), legs, color: guideColor });
    if (gap <= 13) return guidance('arrival', gap);
    const roadEnd = road.at(-1);
    if (!destination.gate && roadEnd && distance(roadEnd, destination) > 16 && distance(car, roadEnd) < 11)
      return guidance('walk', gap);
    if (!first || (legs.length === 1 && first.length < 5)) return guidance('arrival', gap);
    const offset = angleDiff(first.heading, car.yaw);
    if (Math.abs(offset) > 2.32) return guidance('back', 0);
    if (Math.abs(offset) > .90 && first.length > 5) return guidance(turn(offset), 0);

    let meters = 0;
    for (const [i, leg] of legs.entries()) {
      meters += leg.length;
      const next = legs[i + 1];
      if (next) {
        const change = angleDiff(next.heading, leg.heading);
        if (Math.abs(change) > .54) return guidance(turn(change), meters);
      }
    }
    return guidance('straight', meters);
  }

  // Follow the same right-hand lanes as traffic and round the inside of each junction.
  function laneCenterline(legs) {
    if (!legs.length) return [];
    const lane = 4.15;
    const normals = legs.map(({from, to, length}) => ({ x: (from.z - to.z) / length, z: (to.x - from.x) / length }));
    const offset = (p, n) => ({ x: p.x + lane * n.x, z: p.z + lane * n.z });
    const corners = [offset(legs[0].from, normals[0])];
    for (let i = 1; i < legs.length; i++) {
      const a = normals[i - 1], b = normals[i];
      const dot = a.x * b.x + a.z * b.z;
      if (dot > .99) continue;
      const divisor = Math.max(.5, 1 + dot);
      corners.push(offset(legs[i].from, { x:(a.x + b.x) / divisor, z:(a.z + b.z) / divisor }));
    }
    corners.push(offset(legs.at(-1).to, normals.at(-1)));
    const line = [corners[0]];
    for (let i = 1; i < corners.length - 1; i++) {
      const prev = corners[i - 1], at = corners[i], next = corners[i + 1];
      const before = distance(prev, at), after = distance(at, next);
      const bend = Math.min(6, before * .36, after * .36);
      if (bend < .3) { line.push(at); continue; }
      const start = { x:at.x + (prev.x - at.x) * bend / before, z:at.z + (prev.z - at.z) * bend / before };
      const end = { x:at.x + (next.x - at.x) * bend / after, z:at.z + (next.z - at.z) * bend / after };
      line.push(start);
      for (const t of [.25, .5, .75, 1]) {
        const s = 1 - t;
        line.push({ x:s*s*start.x + 2*s*t*at.x + t*t*end.x, z:s*s*start.z + 2*s*t*at.z + t*t*end.z });
      }
    }
    line.push(corners.at(-1));
    return line;
  }

  function makeRoadNavigation(scene, world) {
    const geometry = new T.BufferGeometry();
    geometry.setAttribute('position', new T.Float32BufferAttribute([
      -.76, 0, -.49, -.76, 0, -.13, 0, 0, .78,
      .76, 0, -.13, .76, 0, -.49, 0, 0, .31,
    ], 3));
    geometry.setIndex([0, 1, 2, 0, 2, 5, 5, 2, 3, 5, 3, 4]);
    const material = new T.MeshBasicMaterial({ color: guideColor, transparent: true, opacity: .77, depthWrite: false, toneMapped: false });
    const arrows = new T.InstancedMesh(geometry, material, 16);
    arrows.name = 'Road guidance';
    arrows.count = 0;
    arrows.frustumCulled = false;
    arrows.layers.set(1);
    arrows.instanceMatrix.setUsage(T.DynamicDrawUsage);
    scene.add(arrows);
    const arrow = new T.Object3D();
    let guidance = null, previousCar = null, oldX, oldZ, refreshAt = -Infinity;
    let lastCarX, lastCarZ, lastYaw, lastKind;

    function update(car, destination, now) {
      if (!car || !destination || destination.indoor || destination.water) {
        guidance = previousCar = null;
        arrows.count = 0;
        return;
      }
      const kind = destination.courier ? 'courier' : destination.marine ? 'marine'
        : destination.stealth ? 'stealth' : destination.race ? 'race' : 'story';
      if (car === previousCar && destination.x === oldX && destination.z === oldZ && lastKind === kind && now >= refreshAt - .181) {
        if (now < refreshAt || ((car.x - lastCarX) ** 2 + (car.z - lastCarZ) ** 2 < .04 &&
            Math.abs(angleDiff(car.yaw, lastYaw)) < .02)) return;
      }
      previousCar = car;
      lastCarX = car.x;
      lastCarZ = car.z;
      lastYaw = car.yaw;
      lastKind = kind;
      oldX = destination.x;
      oldZ = destination.z;
      refreshAt = now + .18;
      guidance = roadGuide(car, destination);
      material.color.set(guidance.color);
      let count = 0, traversed = 0;
      const spacing = 7.5;
      const line = laneCenterline(guidance.legs);
      let nextArrow = 0;
      for (let i = 1; i < line.length && traversed < 86; i++) {
        const from = line[i - 1], to = line[i], length = distance(from, to);
        if (length < .01) continue;
        const dx = (to.x - from.x) / length, dz = (to.z - from.z) / length;
        if (i === 1) {
          const start = Math.abs(dx) > Math.abs(dz) ? from.x * Math.sign(dx) : from.z * Math.sign(dz);
          nextArrow = ((-start % spacing) + spacing) % spacing;
        }
        for (; nextArrow < traversed + length && nextArrow < 86 && count < 16; nextArrow += spacing) {
          if (nextArrow < 6) continue;
          const step = nextArrow - traversed;
          const x = from.x + dx * step, z = from.z + dz * step;
          if (world.collision(x, z, .45)) continue;
          arrow.position.set(x, world.surfaceHeight(x, z) + .05, z);
          arrow.rotation.y = Math.atan2(dx, dz);
          arrow.scale.set(1.38, 1, 1.8);
          arrow.updateMatrix();
          arrows.setMatrixAt(count++, arrow.matrix);
        }
        traversed += length;
      }
      arrows.count = count;
      if (count) arrows.instanceMatrix.needsUpdate = true;
    }
    return { update, current: () => guidance };
  }

  D.makeRoadNavigation = makeRoadNavigation;
})();
