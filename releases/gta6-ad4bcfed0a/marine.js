(() => {
  'use strict';
  const D = window.Tideline;
  const M = D.MARINE;
  const { clamp, distance } = D;
  const seaLimits = { minX: 339.5, maxX: 785, minZ: -315, maxZ: 411 };
  const piers = [
    M.mainDock, M.islandDock,
    { minX: 336, maxX: 416, minZ: -257.4, maxZ: -242.6 },
    { minX: 336, maxX: 380, minZ: -165.4, maxZ: -150.6 },
    { minX: 336, maxX: 367, minZ: 32.6, maxZ: 47.4 },
  ];
  const mooredShips = [
    { minX: 380.3, maxX: 389.7, minZ: 20.2, maxZ: 47.2 },
    { minX: 405.3, maxX: 414.7, minZ: -184.8, maxZ: -157.8 },
  ];
  const berths = [
    { name: '灯塔湾码头', deck: M.mainDock },
    { name: '岬灯岛码头', deck: M.islandDock },
  ];
  const vessels = [
    { home: M.launch, kind: 'utility', name: '岬湾接驳艇', top: 19.5, power: 6.8, turn: 1.52 },
    { home: { x: 382.3, z: 205.1, yaw: 0 }, kind: 'sport', name: '飞潮快艇', top: 26.3, power: 9.0, turn: 1.63 },
  ];

  function inRect(x, z, rect, margin = 0) {
    return x >= rect.minX + margin && x <= rect.maxX - margin && z >= rect.minZ + margin && z <= rect.maxZ - margin;
  }
  function onIsland(x, z, margin = 0) {
    const island = M.island;
    return ((x - island.x) / (island.rx - margin)) ** 2 + ((z - island.z) / (island.rz - margin)) ** 2 <= 1;
  }
  function islandAccess(x, z) {
    return inRect(x, z, M.islandDock) || onIsland(x, z);
  }
  function marineWalkable(x, z, margin = 0) {
    return inRect(x, z, M.mainDock, margin) || inRect(x, z, M.islandDock, margin) || onIsland(x, z, margin);
  }
  function touches(x, z, rect, radius) {
    const dx = x - clamp(x, rect.minX, rect.maxX);
    const dz = z - clamp(z, rect.minZ, rect.maxZ);
    return dx * dx + dz * dz < radius * radius;
  }
  function waterBlocked(x, z, radius) {
    if (!inRect(x, z, seaLimits, radius) || onIsland(x, z, -radius - 1.3)) return true;
    return piers.some(rect => touches(x, z, rect, radius)) || mooredShips.some(rect => touches(x, z, rect, radius));
  }

  const actionHeld = (keys, first, alternate) => keys.has(first) || keys.has(alternate);
  const ease = (value, aim, rate, dt) => aim + (value - aim) * Math.exp(-rate * dt);
  const BEAM = 1.21;
  const HULL = 2.57;
  const STOP_SPEED = 2.65;

  function makeMarine(scene, world) {
    const art = D.makeBoatArt(scene);
    const buoy = art.makeBuoy(M.buoy);
    const beacon = D.makeIslandLight(scene);
    const fleet = vessels.map(spec => Object.assign(art.create(spec.kind), spec, { type: 'boat' }));

    function reset() {
      for (const boat of fleet) Object.assign(boat, boat.home, { speed: 0, vx: 0, vz: 0, steer: 0, trim: 0, throttle: false, hit: 0, brake: false });
      art.resetWake();
    }
    function landing(boat) {
      for (const { name, deck } of berths) {
        const x = clamp(boat.x, deck.minX + .8, deck.maxX - .8);
        const z = clamp(boat.z, deck.minZ + .8, deck.maxZ - .8);
        if (Math.hypot(x - boat.x, z - boat.z) > 6.15) continue;
        for (const offset of [0, -1.3, 1.3, -2.6, 2.6]) {
          const match = { x: clamp(x + offset, deck.minX + .7, deck.maxX - .7), z, name };
          if (distance(match, boat) < 6.45 && !world.collision(match.x, match.z, .46)) return match;
        }
      }
      return null;
    }
    function boardable(player) {
      if (!marineWalkable(player.x, player.z)) return null;
      return fleet.reduce((best, boat) => distance(player, boat) < (best ? distance(player, best) : 6.45) ? boat : best, null);
    }
    function suggestedBoat(player) {
      return fleet.filter(boat => landing(boat)).reduce((best, boat) => !best || distance(player, boat) < distance(player, best) ? boat : best, null);
    }
    function blocked(boat, x, z, yaw) {
      const dx = Math.sin(yaw);
      const dz = Math.cos(yaw);
      for (const sample of [-HULL, 0, HULL]) {
        const bx = x + dx * sample;
        const bz = z + dz * sample;
        if (waterBlocked(bx, bz, BEAM)) return true;
        for (const other of fleet) {
          if (other === boat || Math.hypot(x - other.x, z - other.z) > 8) continue;
          const ox = Math.sin(other.yaw);
          const oz = Math.cos(other.yaw);
          for (const step of [-HULL, 0, HULL]) {
            if (Math.hypot(bx - other.x - ox * step, bz - other.z - oz * step) < 2.3) return true;
          }
        }
      }
      return false;
    }
    function pilot(boat, dt, keys) {
      const input = Number(actionHeld(keys, 'KeyW', 'ArrowUp')) - Number(actionHeld(keys, 'KeyS', 'ArrowDown'));
      const helm = clamp(Number(actionHeld(keys, 'KeyA', 'ArrowLeft')) - Number(actionHeld(keys, 'KeyD', 'ArrowRight')) - (keys.axisX ?? 0), -1, 1);
      const brake = keys.has('Space');
      let forwardX = Math.sin(boat.yaw);
      let forwardZ = Math.cos(boat.yaw);
      const leading = boat.vx * forwardX + boat.vz * forwardZ;
      if (helm) {
        const hold = (leading < -.25 ? -1 : 1) * (brake ? .56 : .87);
        const steerSpeed = boat.turn * (1 - .30 * clamp(Math.abs(leading) / boat.top, 0, 1));
        const yaw = boat.yaw + helm * hold * steerSpeed * dt;
        if (!blocked(boat, boat.x, boat.z, yaw)) boat.yaw = yaw;
      }
      forwardX = Math.sin(boat.yaw);
      forwardZ = Math.cos(boat.yaw);
      let longitudinal = boat.vx * forwardX + boat.vz * forwardZ;
      let lateral = boat.vx * forwardZ - boat.vz * forwardX;
      const reversing = input * longitudinal < -.35;
      const force = brake ? 0 : input * (reversing ? 13.5 : input > 0 ? boat.power : 3.3);
      longitudinal = clamp((longitudinal + force * dt) * Math.exp(-dt * (brake ? 3.65 : input ? .27 : .64)), -5.8, boat.top);
      if (Math.abs(longitudinal) < .045 && (!input || brake)) longitudinal = 0;
      lateral *= Math.exp(-dt * (brake ? 4.3 : 2.75));
      boat.vx = forwardX * longitudinal + forwardZ * lateral;
      boat.vz = forwardZ * longitudinal - forwardX * lateral;
      const nx = boat.x + boat.vx * dt;
      const nz = boat.z + boat.vz * dt;
      let hit = false;
      if (blocked(boat, nx, nz, boat.yaw)) {
        hit = true;
        const clearX = !blocked(boat, nx, boat.z, boat.yaw);
        if (clearX) boat.x = nx;
        const clearZ = !blocked(boat, boat.x, nz, boat.yaw);
        if (clearZ) boat.z = nz;
        boat.vx *= clearX ? .64 : -.13;
        boat.vz *= clearZ ? .64 : -.13;
      } else {
        boat.x = nx;
        boat.z = nz;
      }
      boat.steer = ease(boat.steer, helm, 7, dt);
      boat.trim = ease(boat.trim, clamp((longitudinal - leading) * .15, -.12, .08), 6, dt);
      boat.speed = Math.hypot(boat.vx, boat.vz);
      boat.brake = brake;
      boat.throttle = !brake && input > 0;
      const impact = hit && boat.hit <= 0 && Math.abs(leading) > 3.7;
      boat.hit = impact ? .5 : Math.max(0, boat.hit - dt);
      return impact;
    }
    function render(dt, state, showBuoy, beaconOn) {
      for (const boat of fleet) art.pose(boat, dt, state.clock, state.night, boat === state.boat);
      buoy(showBuoy, state.clock);
      beacon(beaconOn, state.clock, state.night);
    }
    reset();
    return { fleet, reset, pilot, landing, boardable, suggestedBoat, render, stopSpeed: STOP_SPEED };
  }

  Object.assign(D, { marineWalkable, islandAccess, makeMarine });
})();