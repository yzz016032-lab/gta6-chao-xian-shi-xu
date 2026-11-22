(() => {
  'use strict';
  const T = window.THREE;
  const D = window.Tideline;
  const { X, Z, JOBS, HUB, DELIVERY, STASH, RACE, TAPES, CARS, PATROL, WAREHOUSE, MARINE, clamp, distance, angleDiff } = D;
  const HARBOR_JOB = 4;
  const WAREHOUSE_DROP = { x: 191, z: 103, place: '潮汛转运点' };
  const WORKSHOP = { x: 276.1, z: 138.0 };
  const NIGHT_MARKET = { x: 323.4, z: 114.4, label: '白汐夜市', courier: true };
  const NIGHT_ORDERS = [
    { x: 279.5, z: 141.2, label: '潮汛修车铺', name: '修车铺的晚饭', cargo: '热饭盒', reward: 145, courier: true },
    { x: 319.7, z: -81.3, label: '海湾渡口', name: '渡口的换班包', cargo: '换班包', reward: 215, courier: true },
    { x: -104.5, z: 193.8, label: '南埠货场入口', name: '货场的备件', cargo: '备件箱', reward: 320, courier: true },
  ];
  const PAINTS = [
    { name: '海雾蓝', color: '#2c6972', price: 0 }, { name: '赤铜红', color: '#af4540', price: 120 },
    { name: '午夜紫', color: '#625576', price: 120 }, { name: '浅滩银', color: '#b8c8be', price: 120 },
    { name: '黑曜石', color: '#222933', price: 120 },
  ];
  const TUNE_PRICES = [320, 600, 950];
  const WEATHER = [
    { name: '晴朗', rain: 0, wetness: .05 }, { name: '雨后', rain: 0, wetness: .78 }, { name: '阵雨', rain: 1, wetness: 1 },
  ];
  const CAMPAIGN = [
    { summary: '把一只听见异常回波的信号盒送往南埠。',
      onAir: '南埠那头在等你。到了给我个信号。',
      briefing: '今晚的潮汛预报播了两遍，第二遍没有台呼。把这只信号盒送到货场，赶在换岗前。',
      handoff: '信号盒认出了货柜里的回波。去找挂着黄牌的回声货柜，里面有原始记录。' },
    { summary: '从回声货柜取回记录，送到北桥信号站。',
      onAir: '收到。出了货场再联络，北桥见。',
      briefing: '记录就在货柜里。箱门一动，外围的巡逻车就会来。甩开它们，再去北桥。',
      handoff: '北桥读出了三组脉冲，单靠一个基站找不准源头。沿计时门把同一条路跑完，我来比对信号。' },
    { summary: '借计时路线比对脉冲，找出干扰源。',
      onAir: '计时门亮了。我在台里听着。',
      briefing: '那九道青色计时门也是接收点。沿顺序跑完，别漏掉转弯后的那一道。',
      handoff: '九个点都收到了。最后一段干扰出自七码仓，东门还开着。去找发射前留下的录音。' },
    { summary: '切换七码仓的电路，取走发射前的录音。',
      onAir: '我守着这条频率。东门那条路交给你。',
      briefing: '从东门进，先切换控制台，再到中继柜取录音。贴着货架走，别让守卫看到。',
      handoff: '录音里是假的靠泊指令。岬灯岛的航标已经熄了，渡船在湾外等。去灯塔湾码头找接驳艇。' },
    { summary: '捞回备用电源，让岬灯岛重新给渡船引航。',
      onAir: '接驳艇在右边泊位。海上见。',
      briefing: '备用电源绑在橙色浮标下。驶近时减速，捞到以后从岛码头南侧靠泊。',
      handoff: '渡船看见灯了。把今晚的记录带回修车铺，我们当面交班。' },
  ];
  const closingPoint = { ...WORKSHOP, label: '潮汛修车铺' };
  const relayVoice = '林鹭 · 白汐电台';
  const PI = Math.PI;
  const mix = (a, b, t) => a + (b - a) * t;
  const smooth = (a, b, rate, dt) => mix(a, b, 1 - Math.exp(-rate * dt));
  const heading = (a, b) => Math.atan2(b.x - a.x, b.z - a.z);
  const offset = (p, angle, n) => ({ x: p.x + Math.sin(angle) * n, z: p.z + Math.cos(angle) * n });

  async function buildInFrames(steps, nextFrame, onStage) {
    let sliceStart = performance.now();
    let step = steps.next();
    while (!step.done) {
      if (step.value) onStage?.(step.value);
      if (step.value || performance.now() - sliceStart >= 5) {
        await nextFrame();
        sliceStart = performance.now();
      }
      step = steps.next();
    }
    return step.value;
  }
  function createSimulation(canvas, progress, onSave, nextFrame, onStage) {
    const steps = simulationSteps(canvas, progress, onSave);
    return nextFrame ? buildInFrames(steps, nextFrame, onStage) : D.finishBuild(steps);
  }
  function* simulationSteps(canvas, progress, onSave) {
    const compact = matchMedia('(pointer: coarse)').matches;
    const renderer = new T.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
    renderer.outputColorSpace = T.SRGBColorSpace;
    renderer.toneMapping = T.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.11;
    const gl = renderer.getContext();
    const gpuInfo = gl.getExtension('WEBGL_debug_renderer_info');
    const gpu = gpuInfo ? gl.getParameter(gpuInfo.UNMASKED_RENDERER_WEBGL) : '';
    const software = /swiftshader|llvmpipe|microsoft basic|software adapter/i.test(gpu);
    const initialMode = software || !gpuInfo ? 'performance' : 'balanced';
    let safetyMode = null;
    const displayMode = () => safetyMode ?? (progress.graphics === 'auto' ? initialMode : progress.graphics);
    const frameTarget = compact ? 32 : 42;
    const profiles = {
      high: { pixels: compact ? 690000 : 1700000, ratio: software ? .82 : compact ? 1.15 : 1.45, shadows: compact ? 1024 : 1536, street: 0, cars: 242, people: 174 },
      balanced: { pixels: compact ? 365000 : 970000, ratio: compact ? 1 : 1.18, shadows: 0, street: 270, cars: 186, people: 134 },
      performance: { pixels: compact ? 230000 : 530000, ratio: software || !gpuInfo ? .58 : .84, shadows: 0, street: 225, cars: 154, people: 113 },
    };
    let resolution = 1;
    let appliedMode = '';
    let appliedSetting = progress.graphics;
    let width = 0, height = 0, bufferWidth = 0, bufferHeight = 0, bufferRatio = 0;
    let frameTime = 0, sampleFrames = 0, slowWindows = 0, clearWindows = 0, worstGap = 0, hitchDebt = 0;
    let frameWarmup = .42;
    const scene = new T.Scene();
    // The scene origin is fixed. Let moving actors update their own branches.
    scene.matrixAutoUpdate = false;
    const camera = new T.PerspectiveCamera(66, 1, .17, 1500);
    yield '正在布置白汐港街区…';
    const world = yield* D.buildSteps(scene, renderer.capabilities.maxAttributes >= 10);
    yield '正在装配车辆与船艇…';
    const factory = D.makeFactory(scene, world.surfaceHeight, world.skyUniforms);
    const marine = D.makeMarine(scene, world);
    const prepareReflections = D.makeStreetEffects(renderer, scene, world, displayMode, compact);
    const renderScene = D.makeLook(renderer, scene, { compact, mode: displayMode, shelters: world.shelters });
    camera.layers.enable(1);
    const carList = [];
    const pedestrians = [];
    const audio = D.createAudio();
    const rainSound = D.makeRainAudio();
    const random = D.rng(87153);
    const player = factory.person('#387a80', '#303a46', '#c48b6b', true);
    const watch = D.createWarehouseWatch(scene, world, factory, WAREHOUSE);
    const targetVector = new T.Vector3();
    const focus = new T.Vector3();
    const desired = new T.Vector3();
    const cameraPivot = new T.Vector3();
    const state = {
      player, vehicle: null, boat: null, mode: 'story', selected: 0, attempt: null, clock: 0,
      order: null, marketGuide: false,
      hour: 18.06, heat: 0, unseen: 0, seen: false, contain: 0, policeDistance: Infinity,
      lastHeat: -100, lastSpawn: -100, lastContact: null, notification: null, transmission: null, target: null,
      active: false, throttle: false, station: '', cameraMode: 0, viewYaw: HUB.angle,
      freeYaw: 0, viewPitch: 0, lookHeld: false, lastLook: -10, shake: 0, night: 0, drift: 0, driftLast: -100, retry: null,
      weather: 1, rain: 0, wetness: .78, suspicion: 0, sheltered: false,
      cameraBump: 0, findFirstCar: false,
    };
    audio.setEnabled(progress.sound);
    function say(who, line, duration = 6.8) {
      state.transmission = { who, line, until: state.clock + duration };
    }
    function announce(kind, title, body, duration = 3.6) {
      state.notification = { kind, title, body, until: state.clock + duration };
    }

    function spawnCar(model, x, z, yaw, kind, color) {
      const car = factory.car(model, x, z, yaw, kind, color);
      carList.push(car);
      return car;
    }
    const parkedPlaces = [
      [0, HUB.x, HUB.z, HUB.angle], [1, 295.6, -111, PI], [2, 296, 45, PI],
      [3, -103.6, 242, PI], [0, -119, 61, 0], [1, 95.9, -128, PI],
      [2, -199, -238, PI], [3, 179.7, 256, 0], [1, -67, 8.1, PI / 2],
      [3, 262, 301.4, PI / 2], [0, -278, -105, -PI / 2], [2, -20.9, 71, 0],
      [1, 279.5, 146.8, PI * .46],
    ];
    yield;
    const garages = [];
    for (const [id, x, z, yaw] of parkedPlaces) {
      garages.push(spawnCar(CARS[id], x, z, yaw, 'parked'));
      yield;
    }
    if (progress.paint) factory.paint?.(garages[0], PAINTS[progress.paint].color);
    const palette = ['#93a398', '#ac615d', '#567c8b', '#d2af83', '#456476', '#434c69', '#c4b49b', '#76927c'];
    function laneLoop(a, b, c, d, reverse) {
      const nodes = [{ x: a, z: c }, { x: b, z: c }, { x: b, z: d }, { x: a, z: d }];
      if (reverse) nodes.reverse();
      return nodes.map((point, i) => {
        const before = nodes[(i + 3) % 4];
        const after = nodes[(i + 1) % 4];
        return {
          x: point.x - (Math.sign(point.z - before.z) + Math.sign(after.z - point.z)) * 4.15,
          z: point.z + (Math.sign(point.x - before.x) + Math.sign(after.x - point.x)) * 4.15,
        };
      });
    }
    const loops = [[4, 6, 1, 5], [5, 6, 0, 4], [3, 6, 2, 6], [0, 3, 1, 3], [1, 4, 0, 4], [0, 4, 4, 6],
      [0, 2, 0, 6], [3, 5, 0, 3], [2, 5, 3, 6], [2, 6, 2, 4], [0, 3, 3, 5]];
    yield '正在安排街头车流与行人…';
    for (const [index, [a, b, c, d]] of loops.entries()) {
      for (let lane = 0; lane < 2; lane++) {
        const points = laneLoop(X[a], X[b], Z[c], Z[d], lane === 1);
        const i = (index + lane * 3) % points.length;
        const j = (i + 1) % points.length;
        const along = .17 + random() * .42;
        const car = spawnCar(CARS[(index + lane) % 4], mix(points[i].x, points[j].x, along), mix(points[i].z, points[j].z, along),
          heading(points[i], points[j]), 'traffic', palette[(index + lane * 2) % palette.length]);
        car.route = points;
        car.next = j;
        car.cruise = 8.1 + random() * 4;
        car.pace = car.cruise * .8;
      }
      yield;
    }
    function* seedPedestrians() {
      const blocks = compact ? [[5, 1], [5, 3], [5, 4], [3, 3], [2, 2], [1, 4], [5, 5]]
        : [[5, 0], [5, 1], [5, 2], [5, 3], [5, 4], [5, 5], [3, 0], [4, 2], [3, 3], [2, 2], [0, 3], [1, 4], [2, 5], [3, 4]];
      const tops = [
        '#c9684f', '#e0a96d', '#3e6e7a', '#7c9a82', '#6f4e68', '#d4c3a1',
        '#3a5273', '#d98a72', '#4c7365', '#b84b44', '#8e7fa3', '#c8a855',
        '#4b5c66', '#e6dfd0', '#5a8a8e', '#a86b4c',
      ];
      const bottoms = ['#2c3d4d', '#494e5e', '#6e6250', '#394a42', '#262d36', '#5c4b42', '#3b4e63', '#8c8473'];
      const skin = ['#cf9f7c', '#e4ba92', '#8a6052', '#be7d58', '#d6a982', '#a87255'];
      function stylePedestrian(ped, seedIdx) {
        const heightScale = .94 + ((seedIdx * 37) % 14) * .0095;
        const buildScale = .95 + ((seedIdx * 53) % 11) * .0095;
        ped.root.scale.set(buildScale, heightScale, buildScale);
        ped.lookBias = ((seedIdx * 29) % 11 - 5) * .032;
        ped.lookRate = .55 + ((seedIdx * 17) % 7) * .11;
      }
      for (let i = 0; i < blocks.length; i++) {
        const [a, b] = blocks[i];
        const x0 = X[a] + 10.1;
        const x1 = X[a + 1] - 10.1;
        const z0 = Z[b] + 10.1;
        const z1 = Z[b + 1] - 10.1;
        const ped = factory.person(tops[i % tops.length], bottoms[(i * 3) % bottoms.length], skin[i % skin.length]);
        stylePedestrian(ped, i + 1);
        ped.loop = [{ x: x0, z: z0 }, { x: x1, z: z0 }, { x: x1, z: z1 }, { x: x0, z: z1 }];
        if (i % 2) ped.loop.reverse();
        const from = ped.loop[i % 4];
        ped.index = (i + 1) % 4;
        const to = ped.loop[ped.index];
        const p = .27 + random() * .54;
        ped.x = mix(from.x, to.x, p);
        ped.z = mix(from.z, to.z, p);
        ped.yaw = heading(from, to);
        ped.walk = 1.25 + random() * .59;
        pedestrians.push(ped);
        yield;
      }
      for (const [idx, z] of [63, 140, 183, 225, -38].entries()) {
        const ped = factory.person(
          tops[(blocks.length + idx * 3) % tops.length],
          bottoms[(idx * 5 + 2) % bottoms.length],
          skin[(idx * 2 + 1) % skin.length],
        );
        stylePedestrian(ped, blocks.length + idx + 7);
        const lane = z > -110 && z < 193;
        ped.x = (lane ? 303.0 : 321.1) + random() * (lane ? 2.4 : 4);
        ped.z = z;
        ped.loop = [{ x: ped.x, z: lane ? -106 : -261 }, { x: ped.x + (lane ? .45 : 2.1), z: lane ? 187 : 263 }];
        ped.index = z % 2 ? 0 : 1;
        ped.yaw = ped.index ? 0 : PI;
        ped.walk = 1.37 + random() * .32;
        pedestrians.push(ped);
      }
    }
    yield* seedPedestrians();

    const gold = new T.Color('#ffe4a0');
    const roadNavigation = D.makeRoadNavigation(scene, world);
    const coral = new T.Color('#ffad92');
    const cyan = new T.Color('#8cfbe3');
    const seaBlue = new T.Color('#8edfff');
    const pink = new T.Color('#ff91c9');
    function luminous(color) {
      return new T.MeshBasicMaterial({ color, toneMapped: false, depthWrite: false });
    }
    const markerCore = luminous(gold);
    const markerHaze = new T.MeshBasicMaterial({ color: gold, toneMapped: false, transparent: true, opacity: .13,
      depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide });
    const markerRing = new T.Mesh(new T.RingGeometry(2.1, 2.27, 48).rotateX(-PI / 2), markerCore);
    const markerDisk = new T.Mesh(new T.CircleGeometry(2.1, 48).rotateX(-PI / 2), markerHaze);
    const diamond = new T.Mesh(new T.RingGeometry(.33, .46, 4), markerCore);
    const marker = new T.Group();
    marker.add(markerRing, markerDisk, diamond);
    marker.traverse(object => object.layers.set(1));
    scene.add(marker);
    const gate = new T.Group();
    const gateBar = new T.BoxGeometry(1, 1, 1);
    const gateCore = luminous(cyan);
    const gateGhost = markerHaze.clone();
    gateGhost.color.copy(cyan);
    gateGhost.opacity = .10;
    for (const side of [-1, 1]) {
      const pylon = new T.Mesh(gateBar, gateCore);
      pylon.position.set(side * 5.5, 2.78, 0);
      pylon.scale.set(.14, 5.55, .22);
      gate.add(pylon);
    }
    const crown = new T.Mesh(gateBar, gateCore);
    crown.scale.set(11.1, .14, .24);
    crown.position.y = 5.55;
    const curtain = new T.Mesh(new T.PlaneGeometry(11, 5.5), gateGhost);
    curtain.position.y = 2.75;
    gate.add(crown, curtain);
    scene.add(gate);
    const tapeCore = luminous(pink);
    const tapeDark = new T.MeshStandardMaterial({ color: '#30405c', roughness: .85 });
    const tapeSize = new T.BoxGeometry(1.02, .62, .22);
    const tapeRing = new T.RingGeometry(.77, .83, 24).rotateX(-PI / 2);
    const tapeModels = TAPES.map((tape, i) => {
      const group = new T.Group();
      group.position.set(tape.x, .21, tape.z);
      const body = new T.Group();
      const caseMesh = new T.Mesh(tapeSize, tapeDark);
      body.add(caseMesh);
      for (const side of [-1, 1]) {
        const label = new T.Mesh(gateBar, tapeCore);
        label.position.set(0, .07, .112 * side);
        label.scale.set(.80, .15, .017);
        body.add(label);
      }
      const ring = new T.Mesh(tapeRing, tapeCore);
      group.add(body, ring);
      group.visible = !progress.tapes.includes(i);
      scene.add(group);
      return { group, body };
    });

    function protagonist() {
      return state.boat ?? state.vehicle ?? player;
    }
    function closestJob() {
      const p = protagonist();
      const id = state.selected;
      if (state.attempt || state.order || state.marketGuide || state.boat || (state.vehicle && state.vehicle.speed > 10)) return null;
      if (id != null && distance(p, JOBS[id]) < (id === HARBOR_JOB ? 5.8 : 12.5)) return id;
      if (state.mode === 'roam') {
        const near = JOBS.findIndex((job, index) => distance(p, job) < (index === HARBOR_JOB ? 5.8 : 11.25));
        if (near >= 0) return near;
      }
      return null;
    }
    function context() {
      const phase = state.attempt?.phase;
      if (state.boat) {
        const boat = state.boat;
        if (phase === 'marineBuoy') {
          const gap = distance(boat, MARINE.buoy);
          if (gap < 9.1 && boat.speed <= marine.stopSpeed) return { label: '打捞备用电源', kind: 'recoverBuoy' };
          if (gap < 17 && boat.speed > marine.stopSpeed) return { label: '在浮标旁减速', kind: 'brakeBoat', key: 'SPACE' };
        }
        const deck = marine.landing(boat);
        if (!deck) {
          const berth = phase === 'marineIsland' ? MARINE.islandBerth : phase === 'marineReturn' ? MARINE.launch : null;
          return berth && boat.speed > marine.stopSpeed && distance(boat, berth) < 18
            ? { label: '减速靠泊', kind: 'brakeBoat', key: 'SPACE' } : null;
        }
        return boat.speed <= marine.stopSpeed
          ? { label: '下船 · ' + deck.name, kind: 'leaveBoat', deck }
          : { label: '减速靠泊', kind: 'brakeBoat', key: 'SPACE' };
      }
      const nearJob = closestJob();
      if (nearJob != null && (nearJob !== 2 || state.vehicle)) {
        return { label: '开始「' + JOBS[nearJob].name + '」', kind: 'job', id: nearJob };
      }
      if (!state.vehicle && phase === 'marineRepair' && distance(player, MARINE.panel) < 3.0) {
        return { label: '接上备用电源', kind: 'restoreBeacon' };
      }
      if (!state.vehicle && phase === 'marineHandover' && distance(player, MARINE.job) < 5.8) {
        return { label: '回报航标状态', kind: 'marineHandover' };
      }
      if (!state.vehicle && phase === 'warehouseTerminal' && distance(player, WAREHOUSE.terminal) < 2.7) {
        return { label: '切换仓内线路', kind: 'terminal' };
      }
      if (!state.vehicle && phase === 'warehouseCache' && distance(player, WAREHOUSE.cache) < 2.9) {
        return { label: '取走录音带', kind: 'cache' };
      }
      if (!state.attempt && (!state.vehicle || state.vehicle.speed < 2.5)) {
        const p = protagonist();
        if (state.order && distance(p, state.order) < 6.2) return { label: '交付' + state.order.cargo, kind: 'courierDrop' };
        if (!state.order && distance(p, NIGHT_MARKET) < 5.6) return { label: '领取夜市订单', kind: 'courierPickup' };
      }
      if (hasClosingHandover() && !state.order && !state.marketGuide && distance(protagonist(), closingPoint) < 7.2 && (!state.vehicle || state.vehicle.speed < 2.5)) {
        return { label: '交回夜班记录', kind: 'campaignEnd' };
      }
      if (!state.attempt && distance(protagonist(), WORKSHOP) < 7.2 && (!state.vehicle || state.vehicle.speed < 2.5)) {
        return { label: '修车铺 · 涂装与调校', kind: 'workshop' };
      }
      if (state.vehicle) {
        return state.vehicle.speed < 7 ? { label: '下车', kind: 'exit' } : null;
      }
      const boat = marine.boardable(player);
      if (boat) return { label: '上船 · ' + boat.name, kind: 'boardBoat', boat };
      let candidate = null;
      let gap = 5.15;
      for (const car of carList) {
        if (car.type === 'police' || (car.type === 'traffic' && car.speed > 3.75)) continue;
        const d = distance(car, player);
        if (d < gap && world.clearFraction(player.x, .85, player.z, car.x, .85, car.z, .20) === 1) {
          gap = d;
          candidate = car;
        }
      }
      const tape = TAPES.findIndex((position, index) => !progress.tapes.includes(index) && distance(position, player) < 3.1);
      if (tape >= 0 && (!candidate || distance(TAPES[tape], player) < gap)) return { label: '拾取磁带', kind: 'tape', id: tape };
      if (!candidate) return nearJob === 2 ? { label: '驾驶车辆进入起跑线', kind: 'needVehicle' } : null;
      return { label: (candidate.type === 'traffic' ? '接管 ' : '上车 · ') + candidate.model.name, kind: 'enter', car: candidate };
    }
    function tryExit(car) {
      for (const yaw of [car.yaw + PI / 2, car.yaw - PI / 2, car.yaw + PI, car.yaw]) {
        const step = offset(car, yaw, (yaw === car.yaw || yaw === car.yaw + PI) ? 3.05 : 2.07);
        if (!clearForPerson(step.x, step.z, car) ||
            world.clearFraction(car.x, .68, car.z, step.x, .68, step.z, .39) < 1) continue;
        player.x = step.x;
        player.z = step.z;
        player.yaw = car.yaw;
        player.crouching = false;
        player.root.visible = true;
        state.vehicle = null;
        state.viewYaw = car.yaw;
        state.freeYaw = state.viewPitch = 0;
        car.type = 'parked';
        car.vx = car.vz = car.speed = car.pace = car.brake = car.reverseWait = 0;
        state.throttle = false;
        return;
      }
      announce('车辆', '车门被挡住', '挪动车辆后可下车。', 2.1);
    }
    function handleInteraction(action = context(), briefed = false) {
      if (!action) return;
      switch (action.kind) {
        case 'job':
          beginJob(action.id, briefed);
          break;
        case 'courierPickup':
          state.order = nextOrder();
          state.marketGuide = false;
          state.target = target();
          announce('夜市订单', state.order.name, '送往' + state.order.label + ' · ' + cashText(state.order.reward), 4.1);
          audio.note();
          break;
        case 'courierDrop': {
          const order = state.order;
          state.order = null;
          progress.deliveries = Math.min(Number.MAX_SAFE_INTEGER, (progress.deliveries ?? 0) + 1);
          progress.cash += order.reward;
          state.target = target();
          announce('送达', order.name, cashText(order.reward) + ' · 已送达 ' + progress.deliveries + ' 单', 4.6);
          audio.complete();
          onSave();
          break;
        }
        case 'boardBoat':
          state.boat = action.boat;
          state.freeYaw = state.viewPitch = 0;
          player.crouching = false;
          player.root.visible = false;
          audio.start();
          rainSound.start();
          audio.note();
          break;
        case 'leaveBoat': {
          const { boat } = state;
          const yaw = heading(boat, action.deck);
          player.x = action.deck.x;
          player.z = action.deck.z;
          player.yaw = state.viewYaw = yaw;
          player.walking = 0;
          player.root.visible = true;
          boat.speed = boat.vx = boat.vz = 0;
          boat.throttle = boat.brake = false;
          state.boat = null;
          state.freeYaw = state.viewPitch = 0;
          state.throttle = false;
          audio.note();
          break;
        }
        case 'recoverBuoy':
          state.attempt.phase = 'marineIsland';
          announce('孤灯返航', '备用电源已打捞', '驶向岬灯岛，在码头南侧靠泊', 3.2);
          say('林鹭 · 白汐电台', '电源收到了。去岬灯岛，码头的南侧可以靠泊。上岛后沿栈道走。');
          audio.note();
          break;
        case 'restoreBeacon':
          state.attempt.phase = 'marineReturn';
          announce('孤灯返航', '航标恢复', '返回灯塔湾码头', 4.4);
          say('林鹭 · 白汐电台', '灯转起来了，海湾里都能看见。上船返航，到灯塔湾码头告诉我结果。');
          audio.complete();
          break;
        case 'marineHandover':
          finishJob();
          break;
        case 'campaignEnd':
          progress.ending = true;
          state.target = null;
          announce('主线完成', '潮线恢复', '岬灯岛重新亮灯，白汐港交班了。', 6.4);
          say(relayVoice, '第一班渡船到岸了。我会留一份记录在台里。剩下的路，你自己挑。', 8.6);
          audio.complete();
          onSave();
          break;
        case 'terminal':
          state.attempt.phase = 'warehouseCache';
          audio.note();
          say('林鹭 · 白汐电台', '线路切过去了。录音带在仓库里面的中继柜，沿货架外侧过去。');
          break;
        case 'cache':
          state.attempt.phase = 'warehouseExit';
          audio.complete();
          say('林鹭 · 白汐电台', state.attempt.alarmed ? '已经有人呼叫巡逻车。走北侧门，回到车上再说。'
            : '录音到手。北侧门通外场，走出去，沿仓库北墙绕回车上。');
          break;
        case 'workshop':
          return 'workshop';
        case 'needVehicle':
          say('林鹭 · 白汐电台', '先找辆车。计时门认车，不认鞋。', 3.5);
          break;
        case 'exit':
          tryExit(state.vehicle);
          break;
        case 'tape':
          progress.tapes.push(action.id);
          progress.cash += 45;
          tapeModels[action.id].group.visible = false;
          onSave();
          audio.note();
          announce('收集磁带', TAPES[action.id].name, '¥45  ·  已收集 ' + progress.tapes.length + ' / ' + TAPES.length);
          break;
        case 'enter': {
          const car = action.car;
          state.findFirstCar = false;
          if (car.type === 'traffic') raiseHeat(1);
          state.vehicle = car;
          car.type = 'player';
          player.crouching = false;
          player.root.visible = false;
          state.freeYaw = state.viewPitch = 0;
          audio.start();
          rainSound.start();
          break;
        }
      }
    }
    function refinish(index) {
      if (!PAINTS[index] || progress.paint === index || progress.cash < PAINTS[index].price) return false;
      progress.cash -= PAINTS[index].price;
      progress.paint = index;
      factory.paint?.(garages[0], PAINTS[index].color);
      onSave();
      audio.note();
      return true;
    }
    function tuneEngine() {
      const price = TUNE_PRICES[progress.tune];
      if (price == null || progress.cash < price) return false;
      progress.cash -= price;
      progress.tune++;
      onSave();
      audio.note();
      return true;
    }
    function nextStoryJob() {
      const id = JOBS.findIndex((_, i) => !progress.completed.includes(i));
      return id < 0 ? null : id;
    }
    function hasClosingHandover() {
      return state.mode === 'story' && state.selected == null && !state.attempt && !progress.ending && nextStoryJob() == null;
    }
    const nextOrder = () => NIGHT_ORDERS[(progress.deliveries ?? 0) % NIGHT_ORDERS.length];
    function navigateMarket() {
      if (state.attempt || state.boat) return false;
      if (!state.order) state.marketGuide = !state.marketGuide;
      state.target = target();
      return true;
    }
    function cancelOrder() {
      if (!state.order) return false;
      state.order = null;
      state.target = target();
      announce('夜市订单', '已退单', '可以回夜市重新取件。', 3.0);
      return true;
    }
    function selectJob(index) {
      const next = nextStoryJob();
      if (!JOBS[index] || state.attempt || state.order || hasClosingHandover() || (state.mode === 'story' && next != null && index > next)) return false;
      state.selected = index;
      state.marketGuide = false;
      state.target = target();
      return true;
    }
    function beginJob(id, briefed) {
      state.selected = id;
      state.retry = null;
      state.attempt = { id, phase: 'delivery', left: 70, elapsed: 0, gate: 0, previous: { x: JOBS[id].x, z: JOBS[id].z } };
      audio.note();
      if (id === 0) {
        if (!state.vehicle) state.attempt.phase = 'deliveryBoarding';
        announce('差事开始', JOBS[id].name, state.vehicle ? '把信号盒送到南埠货场' : '上车后开始计时');
      } else if (id === 1) {
        state.attempt.phase = state.vehicle ? 'escape' : 'escapeBoarding';
        if (state.vehicle) raiseHeat(2);
        announce('差事开始', JOBS[id].name, state.vehicle ? '甩开接近的巡逻车' : '回到车上，准备带走记录');
      } else if (id === 2) {
        state.attempt.phase = 'race';
        state.attempt.left = 110;
        announce('计时赛', JOBS[id].name, '穿过前方的青色计时门');
      } else if (id === 3) {
        state.attempt.phase = 'warehouseTerminal';
        state.attempt.alarmed = false;
        state.suspicion = 0;
        watch.reset();
        announce('行动开始', JOBS[id].name, '进入七码仓，找到控制台');
      } else {
        state.attempt.phase = 'marineBuoy';
        announce('海上差事', JOBS[id].name, '登艇寻找湾内的备用电源');
      }
      say(relayVoice, briefed ? CAMPAIGN[id].onAir : CAMPAIGN[id].briefing, briefed ? 5.8 : 8.4);
    }
    const cashText = value => '¥' + value.toLocaleString('zh-CN');
    function timeText(seconds) {
      const cents = Math.round(seconds * 100);
      return Math.floor(cents / 6000) + ':' + ((cents % 6000) / 100).toFixed(2).padStart(5, '0');
    }
    function finishJob() {
      const attempt = state.attempt;
      const id = attempt.id;
      if (!progress.completed.includes(id)) progress.completed.push(id);
      const nightBonus = id === 3 && !attempt.alarmed ? 320 : 0;
      const reward = JOBS[id].reward + nightBonus;
      progress.cash += reward;
      let result = cashText(reward) + (nightBonus ? ' · 含潜入奖金 ¥320' : '');
      if (id === 2) {
        const best = progress.best == null || attempt.elapsed < progress.best;
        if (best) progress.best = attempt.elapsed;
        result += ' · ' + timeText(attempt.elapsed) + (best ? ' · 刷新纪录' : '');
      }
      state.attempt = null;
      state.retry = null;
      state.selected = state.mode === 'story' ? nextStoryJob() : null;
      announce(state.mode === 'story' ? '章节完成' : '差事完成', JOBS[id].name, result, 5);
      const follow = hasClosingHandover() ? CAMPAIGN[HARBOR_JOB].handoff
        : state.mode === 'story' && state.selected != null && state.selected !== id + 1
          ? '我还有一份记录没收到。下一站在' + JOBS[state.selected].place + '，路已经标好了。'
          : id === HARBOR_JOB ? '渡船看见灯了。往后夜里过湾，灯塔会替你照着那条航道。' : CAMPAIGN[id].handoff;
      say(relayVoice, follow, 8);
      audio.complete();
      onSave();
    }
    function failJob(body) {
      const id = state.attempt?.id;
      if (id == null) return;
      state.attempt = null;
      state.retry = id;
      state.selected = id;
      announce('差事中断', JOBS[id].name, body, 4.6);
    }
    function marineTarget(phase) {
      const onBoard = state.boat;
      const boarding = () => {
        const boat = marine.suggestedBoat(player) ?? MARINE.launch;
        return { x: boat.x, z: boat.z, label: '上船', water: true, boarding: true };
      };
      if (phase === 'marineBuoy') return onBoard ? { ...MARINE.buoy, label: '备用电源', water: true } : boarding();
      if (phase === 'marineIsland') return onBoard ? { ...MARINE.islandBerth, label: '岬灯岛码头南侧', water: true } : boarding();
      if (phase === 'marineRepair') return onBoard
        ? { ...MARINE.islandBerth, label: '岬灯岛码头南侧', water: true }
        : { ...MARINE.panel, label: '航标供电台' };
      if (phase === 'marineReturn') return onBoard ? { ...MARINE.launch, label: '灯塔湾码头南侧', water: true } : boarding();
      return { ...MARINE.job, label: '灯塔湾码头' };
    }
    function target() {
      const attempt = state.attempt;
      if (!attempt) {
        if (state.order || state.marketGuide) return state.order ?? NIGHT_MARKET;
        if (hasClosingHandover()) return closingPoint;
        const job = JOBS[state.selected];
        if (state.findFirstCar && job === JOBS[0] && !state.vehicle && distance(player, garages[0]) < 13 &&
            distance(player, job) > 13) return { x: garages[0].x, z: garages[0].z, label: '海风 GT', vehiclePickup: true };
        if (state.selected === HARBOR_JOB && state.boat) return { ...MARINE.launch, label: '灯塔湾码头南侧', marine: true, water: true };
        return job ? { ...job, label: job.place, race: state.selected === 2, stealth: state.selected === 3, marine: state.selected === HARBOR_JOB } : null;
      }
      if (attempt.id === HARBOR_JOB) return { ...marineTarget(attempt.phase), marine: true };
      if (attempt.phase === 'deliveryBoarding' || attempt.phase === 'escapeBoarding') {
        return { x: garages[0].x, z: garages[0].z, label: '上车' };
      }
      if (attempt.phase === 'delivery') return { ...DELIVERY, label: DELIVERY.place };
      if (attempt.phase === 'stash') return { ...STASH, label: STASH.place };
      if (attempt.phase === 'warehouseTerminal') return { ...WAREHOUSE.terminal, label: '仓库控制台', indoor: true, stealth: true };
      if (attempt.phase === 'warehouseCache') return { ...WAREHOUSE.cache, label: '中继柜', indoor: true, stealth: true };
      if (attempt.phase === 'warehouseExit') return watch.indoors(player)
        ? { ...WAREHOUSE.sideExit, label: '北侧门', indoor: true, stealth: true }
        : { ...WAREHOUSE.escapeCar, label: '撤离车辆', stealth: true };
      if (attempt.phase === 'warehouseDrop') return { ...WAREHOUSE_DROP, label: WAREHOUSE_DROP.place, stealth: true };
      if (attempt.phase === 'race') {
        return { ...RACE[attempt.gate], race: true, gate: true, angle: heading(attempt.previous, RACE[attempt.gate]),
          label: '计时门 ' + (attempt.gate + 1) + ' / ' + RACE.length };
      }
      return null;
    }
    const underWatch = phase => phase === 'warehouseTerminal' || phase === 'warehouseCache' || phase === 'warehouseExit';
    function mission(dt, awareness) {
      const attempt = state.attempt;
      if (!attempt) return;
      const p = protagonist();
      const phase = attempt.phase;
      if (phase === 'deliveryBoarding' && state.vehicle) {
        attempt.phase = 'delivery';
        audio.note();
      } else if (phase === 'escapeBoarding' && state.vehicle) {
        attempt.phase = 'escape';
        raiseHeat(2);
      }
      if (underWatch(phase) && !attempt.alarmed) {
        state.suspicion = clamp(state.suspicion + dt * (awareness || -.42), 0, 1);
        if (state.suspicion >= 1) {
          attempt.alarmed = true;
          announce('行踪暴露', '守卫发出警报', '继续行动 · 撤离时巡逻车会增援');
          say('林鹭 · 白汐电台', '他们看到你了。别停，拿到录音再撤。');
          audio.note();
        }
      }
      if (phase === 'race' || phase === 'delivery') {
        attempt.left -= dt;
        attempt.elapsed += dt;
        if (attempt.left <= 0) {
          failJob('时间到。可在暂停菜单从本章起点重试。');
          return;
        }
      }
      if (phase === 'delivery' && distance(p, DELIVERY) < 10.9) {
        finishJob();
      } else if (phase === 'escape' && !state.heat) {
        attempt.phase = 'stash';
        say('林鹭 · 白汐电台', '他们跟丢了。去北桥信号站，我让交货的人出来了。');
      } else if (phase === 'stash' && distance(p, STASH) < 11) {
        finishJob();
      } else if (phase === 'race' && state.vehicle && distance(p, RACE[attempt.gate]) < 13) {
        attempt.previous = RACE[attempt.gate++];
        if (attempt.gate === RACE.length) finishJob();
        else audio.note();
      } else if (phase === 'warehouseExit' && state.vehicle && !watch.indoors(p)) {
        attempt.phase = 'warehouseEscape';
        raiseHeat(attempt.alarmed ? 3 : 1);
        say('林鹭 · 白汐电台', attempt.alarmed ? '有三组巡逻车在外场，先甩开他们。' : '一组巡逻车在外围。等它跟丢再来交货。');
      } else if (phase === 'warehouseEscape' && !state.heat) {
        attempt.phase = 'warehouseDrop';
        say('林鹭 · 白汐电台', '视线清了，去潮汛转运点。交给穿黄色外套的人。');
      } else if (phase === 'warehouseDrop' && distance(p, WAREHOUSE_DROP) < 11) {
        finishJob();
      } else if (phase === 'marineIsland' && !state.boat && D.islandAccess(player.x, player.z)) {
        attempt.phase = 'marineRepair';
        say('林鹭 · 白汐电台', '沿着木栈道走到供电台。备用电源接上，灯塔就能恢复。');
      } else if (phase === 'marineReturn' && !state.boat && p.x < 430) {
        attempt.phase = 'marineHandover';
      }
    }

    function clearHeat() {
      state.heat = state.unseen = state.contain = 0;
      state.seen = false;
      state.policeDistance = Infinity;
      state.lastContact = null;
      for (let i = carList.length - 1; i >= 0; i--) {
        if (carList[i].type !== 'police') continue;
        scene.remove(carList[i].root);
        carList.splice(i, 1);
      }
    }
    function raiseHeat(level) {
      if (level <= state.heat) return;
      state.heat = clamp(level, 1, 4);
      state.unseen = 0;
      state.lastHeat = state.clock;
      state.lastSpawn = state.clock - 3;
      state.seen = true;
      const here = protagonist();
      state.lastContact = { x: here.x, z: here.z, yaw: here.yaw };
      if (level === 1) announce('通缉', '巡逻车已出动', '拉开距离并让巡逻车丢掉视线。');
    }
    function positionAtGarage() {
      const original = garages[0];
      if (state.vehicle) tryExit(state.vehicle);
      if (state.vehicle) state.vehicle.type = 'parked';
      state.vehicle = null;
      state.boat = null;
      marine.reset();
      state.viewYaw = HUB.angle + .22;
      state.freeYaw = state.viewPitch = 0;
      state.lookHeld = false;
      state.lastLook = -10;
      state.cameraMode = 0;
      state.shake = state.throttle = state.drift = state.suspicion = state.cameraBump = 0;
      player.x = HUB.x + 4.13;
      player.z = HUB.z + 2.2;
      player.yaw = HUB.angle + .38;
      player.walking = 0;
      player.crouching = false;
      state.sheltered = false;
      player.root.visible = true;
      Object.assign(original, { x: HUB.x, z: HUB.z, yaw: HUB.angle, speed: 0, vx: 0, vz: 0, type: 'parked', brake: false, nitro: 1 });
      for (const car of carList) {
        if (car === original || car.type !== 'parked' || distance(car, original) > 5.2) continue;
        const side = D.nearestRoad(car.x, car.z).x < car.x ? 1 : -1;
        const next = { x: car.x + side * 3.7, z: car.z + 5.2 };
        if (!world.collision(next.x, next.z, 2.2)) Object.assign(car, next);
      }
      clearHeat();
      updateCamera(0, true);
    }
    function placeAtWarehouse() {
      const car = garages[0];
      Object.assign(car, { x: WAREHOUSE.escapeCar.x, z: WAREHOUSE.escapeCar.z, yaw: WAREHOUSE.escapeCar.yaw });
      player.x = WAREHOUSE.job.x + 1.8;
      player.z = WAREHOUSE.job.z + .8;
      state.viewYaw = -PI / 2 - .015;
      player.yaw = state.viewYaw;
      updateCamera(0, true);
    }
    function placeAtHarbor() {
      player.x = MARINE.job.x - .65;
      player.z = MARINE.job.z + 1.3;
      player.yaw = state.viewYaw = PI / 2 + .29;
      updateCamera(0, true);
    }
    const chapterStarts = {
      1: { carX: -107.2, z: 229, personX: -103.55, yaw: 0 },
      2: { carX: 291.6, z: -87, personX: 295.15, yaw: Math.PI },
    };
    function placeAtChapter(id) {
      if (id === 3) return placeAtWarehouse();
      if (id === HARBOR_JOB) return placeAtHarbor();
      const start = chapterStarts[id];
      if (!start) return;
      const { carX, z, personX, yaw } = start;
      const car = garages[0];
      if (world.collision(personX, z, .45) || collisionAt(car, carX, z, yaw)) return;
      Object.assign(car, { x: carX, z, yaw });
      for (const other of carList) {
        if (other === car || other.type !== 'parked' || distance(other, car) >= 5.15) continue;
        if (!world.collision(other.x, other.z + 6.2, 2.2)) other.z += 6.2;
      }
      Object.assign(player, { x: personX, z, yaw });
      state.viewYaw = yaw;
      updateCamera(0, true);
    }
    function setChapterWeather(id) {
      state.hour = id === 3 ? 21.5 : id === HARBOR_JOB ? 17.61 : 18.91;
      state.weather = id === 3 ? 2 : id === HARBOR_JOB ? 0 : 1;
      state.wetness = WEATHER[state.weather].wetness;
      state.rain = WEATHER[state.weather].rain;
    }
    function retryJob() {
      const id = state.attempt?.id ?? state.retry;
      if (id == null || state.order) return false;
      state.selected = id;
      state.marketGuide = false;
      state.attempt = state.retry = null;
      positionAtGarage();
      placeAtChapter(id);
      setChapterWeather(id);
      watch.reset();
      state.target = target();
      announce('已返回起点', JOBS[id].name, '靠近标记后重新接单。', 3.2);
      say(relayVoice, CAMPAIGN[id].summary, 5.3);
      return true;
    }
    function resetPosition() {
      failJob('已回到车库。可从任务起点重接。');
      positionAtGarage();
    }
    function busted() {
      const job = state.attempt?.id;
      const fine = Math.min(progress.cash, 100);
      progress.cash -= fine;
      onSave();
      failJob('你被拦下了。回到标记即可再试。');
      positionAtGarage();
      if (job === 3) placeAtWarehouse();
      if (job === HARBOR_JOB) placeAtHarbor();
      const returnPoint = job === 3 ? '七码仓外' : job === HARBOR_JOB ? '灯塔湾码头' : '车库';
      announce('通缉结束', '被巡逻车截停', '已返回' + returnPoint + (fine ? ' · 罚款 ' + cashText(fine) : ''), 4.8);
    }
    function start(mode, nextFrame) {
      const rainJob = mode === 'rain';
      const harborJob = mode === 'harbor';
      state.mode = rainJob || harborJob ? 'roam' : mode;
      state.selected = rainJob ? 3 : harborJob ? HARBOR_JOB : mode === 'story' ? nextStoryJob() : null;
      state.findFirstCar = mode === 'story' && state.selected === 0;
      state.attempt = state.retry = state.notification = state.transmission = null;
      state.order = null;
      state.marketGuide = false;
      setChapterWeather(state.selected);
      state.active = true;
      audio.start();
      rainSound.start();
      positionAtGarage();
      watch.reset();
      for (const ped of pedestrians) {
        ped.streetReaction = ped.contactVehicle = null;
        ped.escapeUntil = 0;
      }
      placeAtChapter(state.selected);
      if (rainJob) {
        say('林鹭 · 白汐电台', '前面就是七码仓。准备好就接单，车留在外面等你。', 7.4);
      } else if (harborJob) {
        say('林鹭 · 白汐电台', '欢迎来灯塔湾码头。右边泊位有接驳艇，准备好就接下这单。', 6.9);
      } else if (mode === 'story') {
        say(relayVoice, state.selected === 0 ? '你身边那辆海风是我的。开到前面修车铺，我在路边等你。'
          : state.selected != null ? CAMPAIGN[state.selected].summary
            : hasClosingHandover() ? '记录齐了。来修车铺找我，交完班就能休息。' : '今晚的交班结束了。要接活就打开地图，剩下的路由你安排。', 8.5);
      } else {
        say(relayVoice, '沿岸往北就是白汐夜市。可以先送一单熟悉街道。', 5.6);
      }
      state.target = target();
      if (nextFrame && !renderer.info.programs.length) return firstDraw(nextFrame);
      render(0);
    }

    const usualBounds = { offset:0, halfLength:2.31, halfWidth:1.015, height:1.65 };
    const vanBounds = { offset:0, halfLength:2.31, halfWidth:1.055, height:2.12 };
    function bodyBounds(car) { return car.bodyBounds || (car.model.kind === 'van' ? vanBounds : usualBounds); }
    function collisionAt(car, x, z, yaw) {
      const b = bodyBounds(car);
      return world.vehicleBlocked(x + Math.sin(yaw)*b.offset, z + Math.cos(yaw)*b.offset, yaw, b.halfWidth, b.halfLength, b.height);
    }
    function touchesPerson(car, x, z, radius) {
      const dx = x - car.x, dz = z - car.z;
      if (dx * dx + dz * dz > 10) return false;
      const fx = Math.sin(car.yaw), fz = Math.cos(car.yaw);
      const b = bodyBounds(car);
      const across = Math.max(0, Math.abs(dx * fz - dz * fx) - b.halfWidth);
      const along = Math.max(0, Math.abs(dx * fx + dz * fz - b.offset) - b.halfLength);
      return across * across + along * along < radius * radius;
    }
    function carAtPerson(x, z, excluded) {
      for (const car of carList) {
        if (car !== excluded && touchesPerson(car, x, z, .41)) return car;
      }
      return null;
    }
    function clearForPerson(x, z, excluded) {
      return !world.collision(x, z, .44) && !carAtPerson(x, z, excluded);
    }
    function walkDisplacement(dx, dz) {
      const x = player.x, z = player.z;
      const nx = x + dx, nz = z + dz;
      const car = carAtPerson(nx, nz);
      if (!car && !world.collision(nx, nz, .44)) {
        player.x = nx;
        player.z = nz;
        return;
      }
      if (car) {
        const fx = Math.sin(car.yaw), fz = Math.cos(car.yaw), b = bodyBounds(car);
        const side = (x - car.x) * fz - (z - car.z) * fx;
        const fore = (x - car.x) * fx + (z - car.z) * fz - b.offset;
        const sideGap = Math.abs(side) - b.halfWidth, endGap = Math.abs(fore) - b.halfLength;
        let normalSide = Math.sign(side || 1), normalFore = Math.sign(fore || 1);
        let gap = Math.max(sideGap, endGap);
        if (sideGap > 0 && endGap > 0) {
          gap = Math.hypot(sideGap, endGap);
          normalSide *= sideGap / gap;
          normalFore *= endGap / gap;
        } else if (sideGap >= endGap) normalFore = 0;
        else normalSide = 0;
        const ax = normalSide * fz + normalFore * fx, az = -normalSide * fx + normalFore * fz;
        // Keep the motion along the panel. If traffic already overlapped the
        // player, recover toward the nearest face by at most one walking step.
        const outward = Math.min(Math.hypot(dx, dz), .411 - gap);
        const correction = Math.max(0, outward - dx * ax - dz * az);
        const tx = nx + ax * correction, tz = nz + az * correction;
        if (clearForPerson(tx, tz, car)) {
          player.x = tx;
          player.z = tz;
          return;
        }
      }
      if (dx && clearForPerson(nx, z)) player.x = nx;
      if (dz && clearForPerson(player.x, nz)) player.z = nz;
    }
    function carContact(a, b, x, z) {
      const ax = Math.sin(a.yaw), az = Math.cos(a.yaw), bx = Math.sin(b.yaw), bz = Math.cos(b.yaw);
      const aa = bodyBounds(a), bb = bodyBounds(b);
      const dx = x + ax * aa.offset - b.x - bx * bb.offset, dz = z + az * aa.offset - b.z - bz * bb.offset;
      if (dx * dx + dz * dz > 30) return false;
      const parallel = Math.abs(ax * bx + az * bz), cross = Math.abs(ax * bz - az * bx);
      return Math.abs(dx * ax + dz * az) < aa.halfLength + bb.halfLength * parallel + bb.halfWidth * cross &&
        Math.abs(dx * az - dz * ax) < aa.halfWidth + bb.halfWidth * parallel + bb.halfLength * cross &&
        Math.abs(dx * bx + dz * bz) < bb.halfLength + aa.halfLength * parallel + aa.halfWidth * cross &&
        Math.abs(dx * bz - dz * bx) < bb.halfWidth + aa.halfWidth * parallel + aa.halfLength * cross;
    }
    function impact(car, other = null) {
      const relative = Math.hypot(car.vx - (other?.vx ?? 0), car.vz - (other?.vz ?? 0));
      if (relative < 2.2 || car.cooldown > 0) return;
      car.cooldown = .46;
      car.impact = Math.min(1.55, relative * .06);
      state.shake = Math.min(.95, relative * .044);
      const contact = offset(car, car.yaw, 1.99);
      factory.particlesAt(contact.x, .57, contact.z, 'spark', Math.min(14, Math.floor(relative * .6)));
      audio.nudge();
      const fixedHeat = state.attempt?.phase === 'escape' || state.attempt?.phase === 'warehouseEscape';
      if (other?.type === 'police' && relative > 14 && state.clock - state.lastHeat > 4.5 && !fixedHeat) {
        raiseHeat(state.heat + 1);
      } else if (other?.type === 'traffic' && relative > 16.5 && state.clock - state.lastHeat > 6.5 && !fixedHeat) {
        raiseHeat(state.heat + 1);
      }
    }
    function moveDriven(car, dt) {
      const nextX = car.x + car.vx * dt;
      const nextZ = car.z + car.vz * dt;
      const blocked = collisionAt(car, nextX, nextZ, car.yaw);
      if (blocked) {
        impact(car);
        const allowedX = !collisionAt(car, nextX, car.z, car.yaw);
        if (allowedX) car.x = nextX;
        const allowedZ = !collisionAt(car, car.x, nextZ, car.yaw);
        if (allowedZ) car.z = nextZ;
        car.vx *= allowedX ? .68 : -.14;
        car.vz *= allowedZ ? .68 : -.14;
        return;
      }
      const other = carList.find(c => c !== car && carContact(car, c, nextX, nextZ));
      if (!other) {
        car.x = nextX;
        car.z = nextZ;
        return;
      }
      if (distance(car, other) + .008 < Math.hypot(nextX - other.x, nextZ - other.z)) {
        car.x = nextX;
        car.z = nextZ;
        return;
      }
      impact(car, other);
      const away = heading(car, other);
      const shove = offset(other, away, Math.min(.36, car.speed * dt * .55));
      if (!collisionAt(other, shove.x, shove.z, other.yaw)) {
        other.x = shove.x;
        other.z = shove.z;
      }
      car.vx = (car.vx + other.vx * .65) * -.19;
      car.vz = (car.vz + other.vz * .65) * -.19;
    }
    const pressed = (keys, code, alternate) => keys.has(code) || (alternate && keys.has(alternate));
    function drive(dt, keys) {
      const car = state.vehicle;
      const tuned = car === garages[0] ? progress.tune : 0;
      const throttle = Boolean(pressed(keys, 'KeyW', 'ArrowUp'));
      const pedal = Boolean(pressed(keys, 'KeyS', 'ArrowDown'));
      const bothPedals = throttle && pedal;
      const move = Number(throttle) - Number(pedal);
      const steer = clamp(Number(Boolean(pressed(keys, 'KeyA', 'ArrowLeft'))) - Number(Boolean(pressed(keys, 'KeyD', 'ArrowRight'))) - (keys.axisX ?? 0), -1, 1);
      const slide = keys.has('Space');
      const boost = Boolean(pressed(keys, 'ShiftLeft', 'ShiftRight')) && move > 0 && !slide && car.nitro > .018;
      state.throttle = move > 0;
      car.cooldown = Math.max(0, car.cooldown - dt);
      car.impact = smooth(car.impact, 0, 9.3, dt);
      car.nitro = clamp(car.nitro + dt * (boost ? -.42 : .115 + tuned * .014), 0, 1);
      let fx = Math.sin(car.yaw);
      let fz = Math.cos(car.yaw);
      const forward = car.vx * fx + car.vz * fz;
      const speedFraction = clamp(Math.abs(forward) / 40, 0, 1);
      const steerResponse = !steer || car.steer * steer < 0 ? 22 : 17 - 6 * speedFraction;
      car.steer = smooth(car.steer, steer, steerResponse, dt);
      const rate = 1.92 - .72 * speedFraction;
      const turn = car.steer * Math.sign(forward) * rate * clamp(Math.abs(forward) / 3.9, 0, 1) * (slide ? 1.28 : 1) * dt;
      if (turn && !collisionAt(car, car.x, car.z, car.yaw + turn)) car.yaw += turn;
      fx = Math.sin(car.yaw);
      fz = Math.cos(car.yaw);
      let long = car.vx * fx + car.vz * fz;
      let lateral = car.vx * fz - car.vz * fx;
      if (!pedal) car.reverseWait = 0;
      const activeBrake = bothPedals || (move && move * long < -.06);
      if (activeBrake) {
        if (pedal && long > .06) car.reverseWait = .24;
        long = Math.sign(long) * Math.max(0, Math.abs(long) - 29 * dt);
      } else if (move < 0 && car.reverseWait > 0) {
        car.reverseWait = Math.max(0, car.reverseWait - dt);
      } else if (move) {
        const power = move < 0 ? 8.5 : car.model.power + tuned * .9 + (boost ? 14.5 : 0);
        long += move * power * dt;
      }
      if (slide) long = Math.sign(long) * Math.max(0, Math.abs(long) - (move ? 12 : 19) * dt);
      long *= Math.exp(-dt * (slide ? .78 : move ? .18 : .70));
      if (Math.abs(long) < .12 && !move) long = 0;
      const cap = car.model.top + tuned * 1.83 + (boost ? 10 : 0);
      long = long > cap ? smooth(long, cap, 3.5, dt) : Math.max(-10.9, long);
      lateral *= Math.exp(-dt * (slide ? 1.43 : car.model.grip * (1 - state.rain * .15)));
      car.vx = fx * long + fz * lateral;
      car.vz = fz * long - fx * lateral;
      car.speed = Math.hypot(car.vx, car.vz);
      car.brake = slide || activeBrake || move < 0;
      car.lean = smooth(car.lean, -car.steer * clamp(car.speed / 35, 0, 1) * .085, 9, dt);
      car.bodyPitch = smooth(car.bodyPitch ?? 0, clamp((forward - long) / Math.max(.001, dt) * .0048, -.105, .13), 8.6, dt);
      car.bodyRoll = smooth(car.bodyRoll ?? 0, clamp(lateral * .006, -.087, .087), 8.6, dt);
      moveDriven(car, dt);
      const driftStrength = Math.abs(lateral);
      if (slide && car.speed > 8 && driftStrength > 3.6 && !car.cooldown) {
        state.drift += (driftStrength * 7.2 + car.speed) * dt;
        car.fxTime = (car.fxTime ?? 0) - dt;
        if (car.fxTime <= 0) {
          car.fxTime = .058;
          const tail = offset(car, car.yaw, -1.45);
          factory.skid(car, -1, car.speed * .074);
          factory.skid(car, 1, car.speed * .074);
          factory.particlesAt(tail.x, .29, tail.z, 'smoke', 4);
        }
      } else if (state.drift > 0) {
        if (state.drift >= 49 && state.clock - state.driftLast > 5.7 && !state.attempt) {
          const bonus = clamp(Math.round(state.drift / 8), 12, 65);
          progress.cash += bonus;
          onSave();
          announce('驾驶奖励', '甩尾完成', Math.round(state.drift) + ' 分 · ' + cashText(bonus), 2.2);
          state.driftLast = state.clock;
        }
        state.drift = 0;
      }
      if (boost && car.speed > 10 && random() < .24) {
        const tail = offset(car, car.yaw, -2.16);
        factory.particlesAt(tail.x, .35, tail.z, 'boost', 3);
      }
      if (state.rain > .26 && car.speed > 15 && Math.random() < .14) {
        const spray = offset(car, car.yaw, -1.53);
        factory.particlesAt(spray.x, .15, spray.z, 'smoke', 1);
      }
      const jolt = progress.reduceMotion ? 0 : car.impact * .16 + (boost ? .20 : 0);
      state.cameraBump = smooth(state.cameraBump, jolt, 5.25, dt);
    }
    function walk(dt, keys) {
      const startX = player.x, startZ = player.z;
      state.viewYaw += dt * 1.85 * (Number(keys.has('ArrowLeft')) - Number(keys.has('ArrowRight')));
      const forward = clamp(Number(Boolean(pressed(keys, 'KeyW', 'ArrowUp'))) - Number(Boolean(pressed(keys, 'KeyS', 'ArrowDown'))) + (keys.axisY ?? 0), -1, 1);
      const strafe = clamp(Number(keys.has('KeyD')) - Number(keys.has('KeyA')) + (keys.axisX ?? 0), -1, 1);
      const inputStrength = Math.hypot(forward, strafe);
      const running = Boolean(pressed(keys, 'ShiftLeft', 'ShiftRight')) && !player.crouching;
      const speed = (running ? 7.55 : player.crouching ? 2.16 : 4.05) * Math.min(1, inputStrength);
      if (speed) {
        const dx = (Math.sin(state.viewYaw) * forward - Math.cos(state.viewYaw) * strafe) / inputStrength;
        const dz = (Math.cos(state.viewYaw) * forward + Math.sin(state.viewYaw) * strafe) / inputStrength;
        const yaw = Math.atan2(dx, dz);
        player.yaw += angleDiff(yaw, player.yaw) * (1 - Math.exp(-15 * dt));
        walkDisplacement(dx * speed * dt, dz * speed * dt);
      }
      player.walking = dt > 0 ? Math.hypot(player.x - startX, player.z - startZ) / dt : 0;
      state.throttle = false;
      state.cameraBump = smooth(state.cameraBump, 0, 6, dt);
    }

    function stepTraffic(car, dt) {
      const routeTarget = car.route[car.next];
      const gap = distance(car, routeTarget);
      const turn = angleDiff(heading(car, routeTarget), car.yaw);
      if (gap < 5.25 || (gap < 8.5 && Math.abs(turn) > 1.2)) car.next = (car.next + 1) % car.route.length;
      const nextYaw = car.yaw + clamp(turn, -dt * 2.55, dt * 2.55);
      if (Math.abs(turn) > .001 && !collisionAt(car, car.x, car.z, nextYaw)) car.yaw = nextYaw;
      const dx = Math.sin(car.yaw);
      const dz = Math.cos(car.yaw);
      const p = protagonist();
      const ahead = (p.x - car.x) * dx + (p.z - car.z) * dz;
      const across = Math.abs((p.x - car.x) * dz - (p.z - car.z) * dx);
      const blockPlayer = ahead > -.65 && ahead < (state.vehicle ? 10 : 7) && across < (state.vehicle ? 2.75 : 1.5);
      const blockCar = carList.some(other => {
        if (other === car || other === state.vehicle || Math.abs(other.x - car.x) > 9 || Math.abs(other.z - car.z) > 9) return false;
        const ahead = (other.x - car.x) * dx + (other.z - car.z) * dz;
        const across = Math.abs((other.x - car.x) * dz - (other.z - car.z) * dx);
        return ahead > .15 && ahead < 7.6 && across < 2.0;
      });
      const cruise = blockPlayer || blockCar ? 0 : Math.abs(turn) > .34 ? car.cruise * .58 : car.cruise;
      car.brake = car.pace > cruise + .6;
      car.pace = smooth(car.pace, cruise, cruise ? 1.65 : 5.6, dt);
      const nx = car.x + dx * car.pace * dt;
      const nz = car.z + dz * car.pace * dt;
      if (!collisionAt(car, nx, nz, car.yaw)) {
        car.x = nx;
        car.z = nz;
      } else {
        car.pace = smooth(car.pace, 0, 7, dt);
      }
      car.speed = car.pace;
      car.vx = dx * car.pace;
      car.vz = dz * car.pace;
      car.steer = clamp(turn, -.7, .7);
      car.lean = -car.steer * .05;
    }
    // Choose a short landing corridor that also fits the length of a prone character.
    const landingAngles = [0, .63, -.63, 1.26, -1.26, 1.88, -1.88, PI];
    function streetLanding(ped, car, direction, wanted, reach) {
      const y = world.surfaceHeight(ped.x, ped.z) + .35;
      let best = null;
      for (const turn of landingAngles) {
        const angle = direction + turn;
        const dx = Math.sin(angle), dz = Math.cos(angle), length = wanted + reach;
        const clearance = world.clearFraction(ped.x, y, ped.z, ped.x + dx * length, y, ped.z + dz * length, .42);
        const travel = Math.min(wanted, clearance * length - reach - (clearance < 1 ? .035 : 0));
        if (travel < 0 || (best && travel <= best.travel + .02)) continue;
        const endX = ped.x + dx * travel, endZ = ped.z + dz * travel;
        if (world.collision(endX + dx * reach, endZ + dz * reach, .42) ||
            world.collision(endX - dx * reach, endZ - dz * reach, .42) ||
            world.clearFraction(endX, y, endZ, endX - dx * reach, y, endZ - dz * reach, .42) < 1) continue;
        if (carList.some(other => other !== car && (touchesPerson(other, endX, endZ, .42) ||
            touchesPerson(other, endX + dx * reach, endZ + dz * reach, .42) ||
            touchesPerson(other, endX - dx * reach, endZ - dz * reach, .42)))) continue;
        best = { dx, dz, travel, angle };
        if (travel >= wanted - .02) break;
      }
      return best;
    }
    function startStreetContact(ped, car, speed, bite, across, side, rightX, rightZ, moveX, moveZ) {
      const strength = speed * bite;
      const kind = strength >= 15.5 ? 'fatal' : strength >= 4.5 ? 'fall' : 'stagger';
      const down = kind !== 'stagger';
      const away = Math.atan2(rightX * side + moveX * .47, rightZ * side + moveZ * .47);
      const stepAside = Math.max(.46, (bodyBounds(car).halfWidth + .57 - Math.abs(across)) * 1.16);
      const landing = streetLanding(ped, car, away, down ? 1.72 + Math.min(.55, strength * .017) : stepAside, down ? .99 : .23);
      if (!landing) return;
      ped.contactVehicle = car;
      ped.streetReaction = { kind, age: 0, flat: 0, brace: 0, rise: 0, hold: 0,
        x: ped.x, z: ped.z, fromYaw: ped.yaw, direction: landing.angle, side,
        dx: landing.dx * landing.travel, dz: landing.dz * landing.travel };
      ped.stride = ped.visiblePace = 0;
      ped.fleeing = false;
      if (car !== state.vehicle) return;
      if (speed > 1.4) {
        const drag = down ? .92 : .985;
        car.vx *= drag; car.vz *= drag;
        car.speed *= drag;
        state.shake = Math.max(state.shake, down ? .24 : .075);
        audio.nudge();
      }
      const fixedHeat = state.attempt?.phase === 'escape' || state.attempt?.phase === 'warehouseEscape';
      if (down && !fixedHeat) {
        const previous = state.heat;
        raiseHeat(kind === 'fatal' ? 2 : 1);
        if (kind === 'fatal' && state.heat > previous && !state.attempt)
          announce('街区警情', '行人身亡', '巡逻车正在赶来。', 3.1);
      }
    }
    function sweepStreetVehicle(car, dt, view) {
      if (car.streetX == null || !(dt > 0)) return;
      const dx = car.x - car.streetX, dz = car.z - car.streetZ;
      const lengthSq = dx * dx + dz * dz;
      if (lengthSq < .0144 * dt * dt) return;
      const minX = Math.min(car.x, car.streetX) - 3.3, maxX = Math.max(car.x, car.streetX) + 3.3;
      const minZ = Math.min(car.z, car.streetZ) - 3.3, maxZ = Math.max(car.z, car.streetZ) + 3.3;
      if (view.x < minX - 175 || view.x > maxX + 175 || view.z < minZ - 175 || view.z > maxZ + 175) return;
      const turn = angleDiff(car.yaw, car.streetYaw);
      const yaw = car.streetYaw + turn * .5, fx = Math.sin(yaw), fz = Math.cos(yaw);
      const b = bodyBounds(car), length = Math.sqrt(lengthSq);
      const lateral = dx * fz - dz * fx, forward = dx * fx + dz * fz;
      // In the midpoint car frame the upright capsule traces a segment against the padded footprint.
      const pad = .30 + Math.abs(turn) * Math.max(b.halfWidth, b.halfLength) * .5;
      const width = b.halfWidth + pad, nose = b.halfLength + pad;
      for (const ped of pedestrians) {
        if (ped.streetReaction || ped.contactVehicle === car ||
            ped.x < minX || ped.x > maxX || ped.z < minZ || ped.z > maxZ) continue;
        const px = ped.x - car.streetX, pz = ped.z - car.streetZ;
        const x = px * fz - pz * fx, z = px * fx + pz * fz - b.offset;
        if ((Math.abs(lateral) < 1e-7 && Math.abs(x) > width) ||
            (Math.abs(forward) < 1e-7 && Math.abs(z) > nose)) continue;
        const x1 = lateral ? (x - width) / lateral : -Infinity, x2 = lateral ? (x + width) / lateral : Infinity;
        const z1 = forward ? (z - nose) / forward : -Infinity, z2 = forward ? (z + nose) / forward : Infinity;
        const enter = Math.max(0, Math.min(x1, x2), Math.min(z1, z2));
        if (enter > Math.min(1, Math.max(x1, x2), Math.max(z1, z2))) continue;
        const across = x - lateral * enter, along = z - forward * enter;
        const bite = Math.max(Math.abs(forward) / length * clamp((width - Math.abs(across)) / .62, .08, 1),
          Math.abs(lateral) / length * clamp((nose - Math.abs(along)) / .62, .08, 1));
        const side = Math.abs(across) > .1 ? Math.sign(across) : (Math.sin(ped.yaw - yaw) < 0 ? -1 : 1);
        startStreetContact(ped, car, length / dt, bite, across, side, fz, -fx, dx / length, dz / length);
      }
    }
    const easeStreet = t => t * t * (3 - 2 * t);
    function stepStreetReaction(ped, dt) {
      const r = ped.streetReaction;
      if (r.kind === 'fatal' && r.flat === 1) return;
      r.age += dt;
      const down = r.kind !== 'stagger';
      const travel = clamp(r.age / (down ? .48 : .39), 0, 1);
      const along = 1 - (1 - travel) ** 2;
      ped.x = r.x + r.dx * along;
      ped.z = r.z + r.dz * along;
      const facing = r.direction + (down ? PI : 0);
      ped.yaw = r.fromYaw + angleDiff(facing, r.fromYaw) * easeStreet(clamp(r.age / (down ? .25 : .49), 0, 1));
      if (down) {
        const drop = clamp(r.age / .55, 0, 1);
        r.flat = easeStreet(drop);
        r.brace = Math.sin(drop * PI);
        if (drop < 1 || r.kind === 'fatal' || r.age < 2.5) return;
        if (r.hold === 0) {
          const headX = Math.sin(r.direction) * .77, headZ = Math.cos(r.direction) * .77;
          if (carList.some(car => touchesPerson(car, ped.x, ped.z, .63) ||
              touchesPerson(car, ped.x + headX, ped.z + headZ, .38) ||
              touchesPerson(car, ped.x - headX, ped.z - headZ, .38))) return;
        }
        r.hold = Math.min(1, r.hold + dt / 1.04);
        r.flat = 1 - easeStreet(r.hold);
        r.rise = Math.sin(r.hold * PI);
        if (r.hold < 1) return;
      } else {
        r.brace = Math.sin(PI * clamp(r.age / .58, 0, 1));
        if (r.age < .58) return;
      }
      ped.escapeYaw = r.direction;
      ped.escapeUntil = state.clock + 2.1;
      ped.streetReaction = null;
    }
    function stepPerson(ped, dt) {
      if (ped.streetReaction) { stepStreetReaction(ped, dt); return; }
      if (ped.contactVehicle && !touchesPerson(ped.contactVehicle, ped.x, ped.z, .64)) ped.contactVehicle = null;
      const target = ped.loop[ped.index];
      const threat = state.vehicle && state.vehicle.speed > 5 && distance(state.vehicle, ped) < 6.7;
      const escaping = state.clock < (ped.escapeUntil ?? 0);
      if (distance(ped, target) < 1.9) ped.index = (ped.index + 1) % ped.loop.length;
      const angle = threat ? heading(state.vehicle, ped) : escaping ? ped.escapeYaw : heading(ped, target);
      ped.yaw += angleDiff(angle, ped.yaw) * (1 - Math.exp(-9 * dt));
      const pace = threat || escaping ? 4.9 : ped.walk;
      const next = offset(ped, ped.yaw, pace * dt);
      if (clearForPerson(next.x, next.z)) {
        ped.x = next.x;
        ped.z = next.z;
        ped.blockedFor = 0;
        ped.visiblePace = pace;
      } else {
        ped.visiblePace = 0;
        ped.blockedFor = (ped.blockedFor ?? 0) + dt;
        if (ped.blockedFor > .65) {
          ped.index = (ped.index + 1) % ped.loop.length;
          ped.blockedFor = ped.escapeUntil = 0;
        }
      }
      ped.fleeing = Boolean(threat || escaping);
    }
    function spawnPolice() {
      const p = state.lastContact;
      const first = !carList.some(car => car.type === 'police');
      const forwardX = Math.sin(p.yaw);
      const forwardZ = Math.cos(p.yaw);
      let best = null;
      let score = Infinity;
      for (const x of X) {
        for (const z of Z) {
          const d = Math.hypot(p.x - x, p.z - z);
          if (d < 46 || d > 143) continue;
          if (carList.some(c => distance(c, { x, z }) < (c.type === 'police' ? 49 : 8))) continue;
          const route = D.routeBetween({ x, z }, p);
          const angle = heading({ x, z }, route.find(q => Math.hypot(q.x - x, q.z - z) > 5) ?? p);
          const ahead = (x - p.x) * forwardX + (z - p.z) * forwardZ;
          const useful = Math.abs(d - 78) + Math.max(0, ahead) * (first ? .68 : .30) + random() * 18;
          if (useful < score) {
            score = useful;
            best = { x, z, angle };
          }
        }
      }
      if (!best) return;
      const patrol = spawnCar(PATROL, best.x, best.z, best.angle, 'police');
      patrol.flash = Math.floor(random() * 4);
      patrol.pace = 8.5;
      patrol.unstuck = 0;
    }
    function searchIntersection(car, contact) {
      const branches = [];
      for (const x of X) {
        for (const z of Z) {
          const point = { x, z };
          const gap = distance(point, contact);
          if (gap > 33 && gap < 144 && distance(car, point) > 27) branches.push(point);
        }
      }
      return branches[Math.floor(random() * branches.length)] ?? contact;
    }
    function stepPolice(car, dt, contact, seen) {
      if (seen) car.search = null;
      else if ((car.search && distance(car, car.search) < 9) || (!car.search && distance(car, contact) < 13)) {
        car.search = searchIntersection(car, contact);
      }
      const objective = car.search ?? contact;
      const gap = distance(car, objective);
      const direct = gap < 49 && !world.occluded(car, objective);
      const road = D.nearestRoad(car.x, car.z);
      const trail = direct ? [objective] : D.routeBetween(car, objective);
      let waypoint = trail.find(point => distance(car, point) > 7.3) ?? objective;
      if (car.unstuck > 0 || (distance(road, car) > 12 && !direct)) waypoint = road;
      const reverse = car.unstuck > .55;
      const goal = heading(car, waypoint) + (reverse ? PI : 0);
      const err = angleDiff(goal, car.yaw);
      const nextYaw = car.yaw + clamp(err, -dt * 2.52, dt * 2.52);
      if (!collisionAt(car, car.x, car.z, nextYaw)) car.yaw = nextYaw;
      const straightPace = state.vehicle ? 19.4 + state.heat * 1.3 : 14.2 + state.heat * 1.65;
      const cruise = clamp(straightPace - Math.abs(err) * 21.2, 4.1, straightPace) * (gap < 9 ? .40 : 1);
      const speed = smooth(car.pace, reverse ? -5.8 : cruise, 4, dt);
      const dx = Math.sin(car.yaw);
      const dz = Math.cos(car.yaw);
      const nx = car.x + dx * speed * dt;
      const nz = car.z + dz * speed * dt;
      const hitPlayer = state.vehicle && carContact(car, state.vehicle, nx, nz);
      const blocked = collisionAt(car, nx, nz, car.yaw);
      car.brake = blocked || hitPlayer || speed < car.pace - .65;
      if (blocked || hitPlayer) {
        car.stationary += dt;
        if (car.stationary > .85 && !car.unstuck) {
          car.unstuck = 1.6;
          car.stationary = 0;
        }
        if (hitPlayer && state.vehicle.speed > 6) impact(state.vehicle, car);
        car.pace *= .82;
      } else {
        car.x = nx;
        car.z = nz;
        car.pace = speed;
        car.stationary = Math.max(0, car.stationary - dt);
      }
      car.speed = Math.abs(car.pace);
      car.vx = dx * car.pace;
      car.vz = dz * car.pace;
      car.unstuck = Math.max(0, car.unstuck - dt);
      car.steer = clamp(err, -.9, .9);
      car.lean = -car.steer * .06;
    }
    function pursuit(dt) {
      if (!state.heat) return;
      let units = carList.filter(car => car.type === 'police');
      const targetCount = state.heat === 1 ? 1 : state.heat;
      if (units.length < targetCount && state.clock - state.lastSpawn > 2.3) {
        spawnPolice();
        units = carList.filter(car => car.type === 'police');
        state.lastSpawn = state.clock;
      }
      const p = protagonist();
      const radius = (49 + state.heat * 4) * (1 - state.rain * .21);
      const canSee = unit => {
        const gap = distance(unit, p);
        return gap < radius && (gap < 15 || Math.abs(angleDiff(heading(unit, p), unit.yaw)) < 1.32) && !world.occluded(unit, p);
      };
      const seenBeforeMove = units.some(canSee);
      if (seenBeforeMove) state.lastContact = { x: p.x, z: p.z, yaw: p.yaw };
      let closest = Infinity;
      let seen = false;
      let boxed = false;
      for (const unit of units) {
        stepPolice(unit, dt, state.lastContact, seenBeforeMove);
        const gap = distance(unit, p);
        closest = Math.min(closest, gap);
        if (canSee(unit)) {
          seen = true;
          if (gap < 8.15) boxed = true;
        }
      }
      state.policeDistance = closest;
      if (seen) state.lastContact = { x: p.x, z: p.z, yaw: p.yaw };
      state.seen = seen || !units.length || state.clock - state.lastHeat < 3.6;
      state.unseen = state.seen ? 0 : state.unseen + dt;
      const stopped = state.vehicle ? state.vehicle.speed < 3.5 : player.walking < 2;
      state.contain = boxed && stopped && state.clock - state.lastHeat > 7 ? state.contain + dt : Math.max(0, state.contain - dt * 1.4);
      if (state.contain > 5.5) {
        busted();
      } else if (state.unseen >= escapeDuration()) {
        clearHeat();
        announce('通缉解除', '成功摆脱追车', '巡逻车已丢失你的行踪。', 3.5);
        audio.note();
      }
    }
    const escapeDuration = () => 8.8 + (state.heat - 1) * 1.25;
    function step(dt, keys) {
      state.clock += dt;
      state.hour = (state.hour + dt * .021) % 24;
      const conditions = WEATHER[state.weather];
      state.rain = smooth(state.rain, conditions.rain, .77, dt);
      state.wetness = smooth(state.wetness, conditions.wetness, .24, dt);
      const p = protagonist();
      for (const car of carList) {
        car.streetX = car.x; car.streetZ = car.z; car.streetYaw = car.yaw;
        if (car.type === 'traffic') stepTraffic(car, dt);
      }
      if (state.vehicle) drive(dt, keys);
      else if (state.boat) {
        if (marine.pilot(state.boat, dt, keys)) {
          state.shake = .43;
          audio.nudge();
        }
        state.throttle = state.boat.throttle;
      }
      else walk(dt, keys);
      pursuit(dt);
      for (const car of carList) sweepStreetVehicle(car, dt, p);
      for (const ped of pedestrians) {
        if (distance(p, ped) < 175) stepPerson(ped, dt);
      }
      const awareness = watch.tick(dt, player, state.vehicle ?? state.boat, underWatch(state.attempt?.phase));
      mission(dt, awareness);
      const actor = protagonist();
      state.sheltered = watch.indoors(actor) || world.shelters.some(area => actor.x >= area.minX && actor.x <= area.maxX &&
        actor.z >= area.minZ && actor.z <= area.maxZ);
      state.shake = Math.max(0, state.shake - dt * 1.94);
      state.target = target();
    }

    let alternateView = 0, hoodView = 0;
    let fromAlternate = 0, fromHood = 0;
    let previousCameraMode = -1, blendTime = 1, blendDuration = .32;
    let cameraReach = 1, cameraGround = 0, orbitSubject = null;
    const mountEye = new T.Vector3(), mountAim = new T.Vector3(), mountOffset = new T.Vector3();
    const mountUp = new T.Vector3(0, 1, 0);
    let cameraSubject = null, mountPhase = 1, mountYaw = 0, mountPitch = 0, mountFov = 0;
    function updateCamera(dt, snap = false) {
      const car = state.vehicle;
      const boat = state.boat;
      const driving = car ?? boat;
      if (orbitSubject !== driving) orbitSubject = null;
      const p = protagonist();
      if (!car && state.cameraMode === 2) state.cameraMode = 0;
      const mode = state.cameraMode;
      if (mode !== previousCameraMode) {
        previousCameraMode = mode;
        fromAlternate = alternateView;
        fromHood = hoodView;
        blendDuration = car ? .36 : boat ? .32 : .26;
        blendTime = 0;
      }
      blendTime = snap || progress.reduceMotion ? 1 : Math.min(1, blendTime + dt / blendDuration);
      const blend = blendTime * blendTime * (3 - 2 * blendTime);
      alternateView = mix(fromAlternate, Number(mode === 1), blend);
      hoodView = mix(fromHood, Number(mode === 2), blend);
      const ground = boat ? 0 : world.surfaceHeight(p.x, p.z) - .023;
      cameraGround = snap ? ground : smooth(cameraGround, ground, 15, dt);
      if (driving) {
        const moving = Math.abs(driving.speed) > 1.35;
        const looking = state.lookHeld || (orbitSubject === driving && (!moving || state.clock - state.lastLook < 1.1));
        if (snap) state.viewYaw = driving.yaw;
        else if (looking && mode !== 2) {
          const worldYaw = state.viewYaw + state.freeYaw;
          state.viewYaw = driving.yaw;
          state.freeYaw = angleDiff(worldYaw, driving.yaw);
        } else {
          const follow = 1 - Math.exp(-(mode === 2 ? 17 : boat ? 4.35 : 6.1) * dt);
          state.viewYaw += angleDiff(driving.yaw, state.viewYaw) * follow;
        }
        if (!looking && moving) {
          state.freeYaw = smooth(state.freeYaw, 0, 2.0, dt);
          state.viewPitch = smooth(state.viewPitch, 0, 1.75, dt);
        } else if (mode === 2) {
          state.freeYaw = smooth(state.freeYaw, clamp(state.freeYaw, -1.52, 1.52), 9, dt);
        }
      }
      const yaw = state.viewYaw + (driving ? state.freeYaw : 0);
      const fx = Math.sin(yaw), fz = Math.cos(yaw);
      const speed = clamp(Math.abs(driving?.speed ?? 0) / (boat ? 23 : 40), 0, 1);
      let back, height, side = 0, lead, aimHeight, fov;
      let nose = 0, pitchArm = 1;
      if (car) {
        const bump = progress.reduceMotion ? 0 : state.cameraBump;
        const hoodHeight = car.concept ? 1.16 : car.model.kind === 'van' ? 2.16 : 1.58;
        back = mix(6.42 + speed * 2.58, 10.2 + speed * 1.8, alternateView) * (1 - hoodView);
        height = mix(2.66 + speed * 1.27, 5.05 + speed * 1.22, alternateView) + bump;
        // Lift the lens over the roof as it travels forward to the windshield.
        height = mix(height, hoodHeight + bump * .085, hoodView) + 3.4 * hoodView * (1 - hoodView);
        lead = mix(mix(6.22, 8.3, alternateView), 28, hoodView);
        aimHeight = mix(1.68, hoodHeight - .20, hoodView);
        nose = .57 * hoodView;
        pitchArm = 1 - hoodView;
        fov = mix(mix(57, 61, alternateView), 64, hoodView);
      } else if (boat) {
        back = mix(10.12 + speed * 2.4, 14 + speed * 2.0, alternateView);
        height = mix(3.92 + speed * 1.28, 6.36 + speed * 1.35, alternateView);
        lead = mix(6.6, 9, alternateView);
        aimHeight = 1.48;
        fov = mix(57, 61, alternateView);
      } else {
        back = mix(state.sheltered ? 4.3 : 4.9, state.sheltered ? 2.5 : 2.85, alternateView);
        height = mix(player.crouching ? 2.6 : 3.14, player.crouching ? 1.64 : 2.14, alternateView);
        side = mix(1.04, .69, alternateView);
        lead = mix(4.1, 4.7, alternateView);
        aimHeight = player.crouching ? 1.28 : 1.74;
        fov = mix(state.sheltered ? 65 : 57, state.sheltered ? 59 : 55, alternateView);
      }
      const pivotHeight = boat ? 1.46 : !car && player.crouching ? 1.02 : 1.25;
      cameraPivot.set(p.x, ground + pivotHeight, p.z);
      if (snap || progress.reduceMotion) mountPhase = 1;
      else if (cameraSubject && cameraSubject !== p) {
        mountEye.copy(camera.position).sub(cameraPivot);
        mountAim.copy(focus).sub(cameraPivot);
        mountYaw = yaw;
        mountPitch = state.viewPitch;
        mountFov = camera.fov;
        mountPhase = 0;
        cameraReach = 1;
      }
      cameraSubject = p;
      mountPhase = Math.min(1, mountPhase + dt / .28);
      const mountMix = mountPhase * mountPhase * (3 - 2 * mountPhase);
      const armPitch = state.viewPitch * pitchArm;
      const armCos = Math.cos(armPitch), armSin = Math.sin(armPitch);
      const armBack = back * armCos + (height - pivotHeight) * armSin;
      desired.set(p.x - fx * armBack - fz * side, cameraGround + pivotHeight + (height - pivotHeight) * armCos - back * armSin,
        p.z - fz * armBack + fx * side);
      if (nose) {
        desired.x += Math.sin(car.yaw) * nose;
        desired.z += Math.cos(car.yaw) * nose;
      }
      if (mountPhase < 1) {
        mountOffset.copy(mountEye).applyAxisAngle(mountUp, yaw - mountYaw).add(cameraPivot);
        desired.lerp(mountOffset, 1 - mountMix);
        desired.y += 2.8 * mountMix * (1 - mountMix);
      }
      desired.y = Math.max(desired.y, (boat ? 0 : world.surfaceHeight(desired.x, desired.z)) + .38);
      // Blend the boom in subject space. An orbit responds on the next frame, and
      // one swept segment protects the complete rendered boom at every angle.
      const padding = clamp(.12 + camera.near * Math.hypot(1, camera.aspect) * Math.tan(camera.fov * Math.PI / 360), .27, .40);
      const hit = world.clearFraction(p.x, cameraPivot.y, p.z, desired.x, desired.y, desired.z, padding);
      const reach = hit < 1 ? Math.max(0, hit - .006) : 1;
      cameraReach = snap || reach <= cameraReach ? reach : smooth(cameraReach, reach, 12, dt);
      camera.position.copy(cameraPivot).lerp(desired, cameraReach);
      focus.set(p.x + fx * lead, cameraGround + aimHeight + Math.tan(state.viewPitch) * lead, p.z + fz * lead);
      if (mountPhase < 1) {
        mountOffset.copy(mountAim).applyAxisAngle(mountUp, yaw - mountYaw);
        mountOffset.y += Math.tan(state.viewPitch - mountPitch) * Math.hypot(mountOffset.x, mountOffset.z);
        focus.lerp(mountOffset.add(cameraPivot), 1 - mountMix);
      }
      if (!progress.reduceMotion && state.shake) {
        focus.x += Math.sin(state.clock * 85) * state.shake * .49;
        focus.y += Math.cos(state.clock * 62) * state.shake * .44;
      }
      camera.lookAt(focus);
      if (camera.aspect < .85) fov += 13 - 2 * hoodView;
      if (!progress.reduceMotion) fov += speed * (9 - 3 * hoodView);
      if (mountPhase < 1) fov = mix(mountFov, fov, mountMix);
      if (Math.abs(fov - camera.fov) > .035) {
        camera.fov = fov;
        camera.updateProjectionMatrix();
      }
    }
    function cycleCamera() {
      if (!state.vehicle && state.cameraMode === 2) state.cameraMode = 0;
      state.cameraMode = (state.cameraMode + 1) % (state.vehicle ? 3 : 2);
    }
    function drawMarkers() {
      const p = protagonist();
      const aim = state.target;
      roadNavigation.update(state.vehicle, aim, state.clock);
      const gap = aim ? distance(p, aim) : Infinity;
      const show = gap < (aim?.marine ? 235 : 173);
      marker.visible = Boolean(show && !aim.gate && (!aim.vehiclePickup || gap > 5.2));
      gate.visible = Boolean(show && aim.gate);
      if (marker.visible) {
        marker.position.set(aim.x, aim.water ? -.34 : world.surfaceHeight(aim.x, aim.z) + .028, aim.z);
        marker.scale.setScalar(aim.indoor ? .33 : gap < 8 ? .63 : 1);
        markerDisk.visible = gap < 55 && !aim.vehiclePickup;
        diamond.visible = gap > (aim.indoor ? 3 : 7);
        markerCore.color.copy(aim.courier ? coral : aim.marine ? seaBlue : aim.stealth ? pink : aim.race ? cyan : gold);
        markerHaze.color.copy(markerCore.color);
        diamond.position.y = (aim.indoor ? 2.25 : 2.8) + (progress.reduceMotion ? 0 : .07 * Math.sin(state.clock * 2));
        diamond.scale.setScalar(clamp(gap * .035, .88, 2.5));
        diamond.quaternion.copy(camera.quaternion);
      }
      if (gate.visible) {
        gate.position.set(aim.x, .1, aim.z);
        gate.rotation.y = aim.angle;
        gateGhost.opacity = .08 + .029 * Math.cos(state.clock * 5);
      }
      for (let i = 0; i < tapeModels.length; i++) {
        const tape = tapeModels[i];
        tape.group.visible = !progress.tapes.includes(i) && distance(p, TAPES[i]) < 56;
        if (!tape.group.visible) continue;
        tape.body.position.y = .91 + .29 * Math.sin(state.clock * 2.7 + i);
        tape.body.rotation.y = state.clock * 1.45 + i;
      }
    }
    let cameraInsideActor = false;
    function prepareScene(dt) {
      const view = protagonist();
      if (appliedSetting !== progress.graphics) {
        appliedSetting = progress.graphics;
        safetyMode = null;
        resolution = 1;
        resetFrameSamples();
      }
      const mode = displayMode();
      const profile = profiles[mode];
      if (mode !== appliedMode) {
        appliedMode = mode;
        applyResolution();
        world.setDetail(mode !== 'performance', profile.street);
      }
      world.updateVisibleStreet(camera);
      state.night = world.light(state.hour, state.clock, camera, state.wetness, state.rain,
        { center: view, vehicle: state.vehicle, shadowSize: profile.shadows, extraLights: mode === 'high' });
      factory.lighting(state.night);
      const eye = camera.position;
      const clearance = cameraInsideActor ? .92 : .68;
      const ground = state.boat ? 0 : world.surfaceHeight(view.x, view.z);
      cameraInsideActor = !state.boat && (state.vehicle
        ? !(hoodView > .001 && cameraReach > .995) && eye.y - ground < (state.vehicle.model.kind === 'van' ? 2.23 : 1.83) &&
          touchesPerson(state.vehicle, eye.x, eye.z, cameraInsideActor ? .32 : .16)
        : eye.y - ground < (player.crouching ? 1.54 : 2.10) && (eye.x - view.x) ** 2 + (eye.z - view.z) ** 2 < clearance * clearance);
      for (const car of carList) {
        car.root.visible = distance(car, view) < profile.cars && !(state.vehicle === car && cameraInsideActor);
        car.root.matrixWorldAutoUpdate = car.root.visible;
        if (car.root.visible) factory.poseCar(car, dt, state.night, state.clock);
      }
      for (const ped of pedestrians) {
        ped.root.visible = distance(ped, view) < profile.people;
        ped.root.matrixWorldAutoUpdate = ped.root.visible;
        if (ped.root.visible) {
          factory.posePerson(ped, dt, ped.visiblePace ?? ped.walk, ped.fleeing, false, mode === 'high' ? null : eye);
          if (!ped.streetReaction && !ped.fleeing && ped.lookRate) {
            ped.head.rotation.y += Math.sin(state.clock * ped.lookRate + ped.gait * 6.28) * .16 + (ped.lookBias ?? 0);
          }
        }
      }
      if (state.vehicle?.concept) D.poseConceptDriver(player, state.vehicle);
      else if (player.root.parent !== scene) D.leaveConceptSeat(player, scene);
      if (!state.vehicle && !state.boat) {
        player.root.visible = !cameraInsideActor;
        factory.posePerson(player, dt, player.walking ?? 0, false, player.crouching);
      }
      const phase = state.attempt?.phase;
      marine.render(dt, state, phase === 'marineBuoy', progress.completed.includes(HARBOR_JOB) || phase === 'marineReturn' || phase === 'marineHandover');
      watch.render(dt, view, player.crouching, underWatch(state.attempt?.phase), state.suspicion);
      drawMarkers();
      factory.updateParticles(dt);
      renderer.shadowMap.needsUpdate = world.sun.castShadow && world.sun.shadow.needsUpdate;
      return state.boat || view.x > 331 || view.z > 319 ? 'water' : 'road';
    }
    function render(dt) {
      const surface = prepareScene(dt);
      prepareReflections(camera, state, surface, blendTime < 1 || mountPhase < 1);
      renderScene(camera, state);
    }
    async function uploadVisibleTextures(nextFrame) {
      const textures = new Set(world.initialTextures);
      textures.add(D.harborReflectionTexture());
      const materials = new Set();
      scene.traverseVisible(object => {
        const material = object.material;
        if (Array.isArray(material)) material.forEach(part => materials.add(part));
        else if (material) materials.add(material);
      });
      for (const material of materials) {
        for (const property of ['map', 'alphaMap', 'normalMap', 'roughnessMap', 'emissiveMap', 'bumpMap']) {
          if (material[property]) textures.add(material[property]);
        }
        for (const uniform of Object.values(material.uniforms ?? {})) {
          if (uniform.value?.isTexture && !uniform.value.isRenderTargetTexture) textures.add(uniform.value);
        }
      }
      let sliceStart = performance.now();
      for (const texture of textures) {
        const source = texture.image;
        if (!source?.width || !source.height || source.complete === false) continue;
        renderer.initTexture(texture);
        if (performance.now() - sliceStart >= 5) {
          await nextFrame();
          sliceStart = performance.now();
        }
      }
    }
    async function drawOpeningMaterials(nextFrame) {
      const samples = new T.Group();
      samples.position.y = -3000;
      const materials = new Set();
      function include(mesh) {
        if (!mesh.isMesh || materials.has(mesh.material)) return;
        const sample = mesh.clone(false);
        if (sample.isSkinnedMesh) sample.bindMode = 'detached';
        sample.frustumCulled = false;
        sample.castShadow = false;
        samples.add(sample);
        materials.add(mesh.material);
      }
      // Use the real render targets and lights. The fabric on passers-by can
      // otherwise link on the first frame a pedestrian comes around a corner.
      const passerby = pedestrians[0]?.root.getObjectByProperty('isSkinnedMesh', true);
      if (passerby) include(passerby);
      const courier = player.root.getObjectByProperty('isSkinnedMesh', true);
      if (courier) include(courier);
      const coupe = carList.find(car => car.concept?.full);
      coupe?.sprungBody.traverse(include);
      coupe?.wheels[0].hub.traverse(include);
      scene.add(samples);
      try { render(0); } finally { scene.remove(samples); }
      // A submitted first frame can still leave the GPU uploading the visible
      // models. Keep painting the loading screen while that frame completes.
      if (!gl.fenceSync) return;
      const fence = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      if (!fence) return;
      try {
        gl.flush();
        const until = performance.now() + 1200;
        while (performance.now() < until && gl.clientWaitSync(fence, 0, 0) === gl.TIMEOUT_EXPIRED) await nextFrame();
      } finally { gl.deleteSync(fence); }
    }
    async function firstDraw(nextFrame) {
      prepareScene(0);
      if (displayMode() === 'high') {
        await uploadVisibleTextures(nextFrame);
        await nextFrame();
        await drawOpeningMaterials(nextFrame);
        return;
      }
      renderer.compile(scene, camera);
      const programs = renderer.info.programs.slice();
      const parallel = gl.getExtension('KHR_parallel_shader_compile');
      await nextFrame();
      await uploadVisibleTextures(nextFrame);
      if (parallel) {
        // Let the driver link in the background while the loading screen paints.
        const until = performance.now() + 4000;
        while (performance.now() < until &&
            programs.some(shader => !gl.getProgramParameter(shader.program, parallel.COMPLETION_STATUS_KHR))) {
          await nextFrame();
        }
      } else {
        // Drivers with synchronous linking can release the main thread between programs.
        let batchStart = performance.now();
        for (const shader of programs) {
          gl.getProgramParameter(shader.program, gl.LINK_STATUS);
          if (performance.now() - batchStart < 8) continue;
          await nextFrame();
          batchStart = performance.now();
        }
      }
      resize();
      await drawOpeningMaterials(nextFrame);
    }
    function applyResolution() {
      const profile = profiles[displayMode()];
      const pixelBudget = Math.sqrt(profile.pixels / Math.max(1, width * height));
      const ratio = Math.min(devicePixelRatio || 1, profile.ratio * resolution, pixelBudget * Math.min(1, resolution));
      if (bufferWidth === width && bufferHeight === height && Math.abs(bufferRatio - ratio) < .015) return;
      renderer.setDrawingBufferSize(width, height, ratio);
      bufferWidth = width;
      bufferHeight = height;
      bufferRatio = ratio;
    }
    function resetFrameSamples() {
      frameTime = sampleFrames = slowWindows = clearWindows = worstGap = hitchDebt = 0;
      frameWarmup = .42;
    }
    function lowerQuality() {
      const mode = displayMode();
      if (mode === 'performance') return false;
      safetyMode = mode === 'high' && initialMode !== 'performance' ? 'balanced' : 'performance';
      resolution = Math.min(.94, resolution);
      resetFrameSamples();
      return true;
    }
    function sampleFrame(gap) {
      if (!(gap > 0)) return;
      if (frameWarmup > 0) {
        frameWarmup -= Math.min(.14, gap);
        return;
      }
      hitchDebt = Math.max(0, hitchDebt - gap * .8) + Number(gap >= .22);
      if ((gap >= .65 || hitchDebt >= 1.65) && lowerQuality()) return;
      frameTime += Math.min(gap, .65);
      worstGap = Math.max(worstGap, gap);
      sampleFrames++;
      if (frameTime < 1.5) return;
      const fps = sampleFrames / frameTime;
      const steady = fps >= frameTarget * 1.18 && worstGap < .052;
      frameTime = sampleFrames = worstGap = 0;
      if (fps >= frameTarget * .82) {
        slowWindows = 0;
        clearWindows = steady ? clearWindows + 1 : 0;
        if (clearWindows >= 4) {
          clearWindows = 0;
          const cap = displayMode() === 'performance' ? Math.min(1.5, .98 / profiles.performance.ratio) : 1;
          if (resolution < cap - .01) {
            resolution = Math.min(cap, resolution + .09);
            applyResolution();
          }
        }
        return;
      }
      clearWindows = 0;
      if (++slowWindows >= 2 && lowerQuality()) return;
      const floor = displayMode() === 'performance' ? .78 : .72;
      if (resolution > floor + .015) {
        resolution = Math.max(floor, resolution - .11);
        applyResolution();
      }
    }
    function resize() {
      const w = Math.max(2, canvas.clientWidth);
      const h = Math.max(2, canvas.clientHeight);
      if (w !== width || h !== height) {
        width = w;
        height = h;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        resetFrameSamples();
      }
      applyResolution();
    }
    function recoverGraphics() {
      renderer.setRenderTarget(null);
      prepareReflections.reset();
      appliedSetting = progress.graphics;
      safetyMode = 'performance';
      appliedMode = '';
      bufferRatio = 0;
      resolution = .94;
      resetFrameSamples();
      resize();
    }
    function repaint() {
      if (state.active) render(0);
    }
    let wasRunning = false;
    function update(dt, keys, running, frameGap = dt) {
      if (running && !wasRunning) resetFrameSamples();
      wasRunning = running;
      if (running) {
        sampleFrame(frameGap);
        // Preserve walking speed through ordinary slow frames. The finite
        // budget still bounds catch-up work after a suspended browser tab.
        const span = Math.min(dt, 8 * .017);
        const chunks = Math.max(1, Math.ceil(span / .017));
        for (let i = 0; i < chunks; i++) step(span / chunks, keys);
        updateCamera(span);
        render(span);
      }
      audio.tick({ paused: !running, car: state.vehicle ?? state.boat, throttle: state.throttle, heat: state.heat,
        policeDistance: state.policeDistance, clock: state.clock });
      rainSound.tick(state, running, progress.sound, state.sheltered);
    }
    function projectTarget() {
      const aim = state.target;
      if (!aim) return null;
      const d = distance(aim, protagonist());
      if (d <= (aim.indoor ? 2 : 6) || d > (aim.marine ? 235 : 173) || (aim.indoor && d > 34)) return null;
      targetVector.set(aim.x, aim.indoor ? 1.95 : aim.water ? 3.5 : aim.gate ? 6.5 : 3.7, aim.z).project(camera);
      if (targetVector.z < 0 || targetVector.z > 1 || Math.abs(targetVector.x) > .91 || Math.abs(targetVector.y) > .78) return null;
      return { x: (targetVector.x + 1) / 2, y: (1 - targetVector.y) / 2, d, label: aim.label, race: aim.race, stealth: aim.stealth, marine: aim.marine, courier: aim.courier };
    }
    function turnCamera(delta, pitch = 0, orbit = false) {
      if (state.vehicle || state.boat) {
        if (delta || pitch) orbitSubject = state.vehicle ?? state.boat;
        const yaw = state.freeYaw + delta;
        if (orbit && state.cameraMode !== 2) state.freeYaw = angleDiff(yaw, 0);
        else {
          const limit = state.cameraMode === 2 ? 1.52 : 1.6;
          // A drag immediately after entering the hood view can start beyond its limit.
          state.freeYaw = clamp(yaw, Math.min(-limit, state.freeYaw), Math.max(limit, state.freeYaw));
        }
      } else state.viewYaw = angleDiff(state.viewYaw + delta, 0);
      state.viewPitch = clamp(state.viewPitch + pitch, -.66, .54);
      state.lastLook = state.clock;
    }
    function holdCamera(active) {
      state.lookHeld = active;
      state.lastLook = state.clock;
    }
    function toggleStation() {
      audio.start();
      state.station = audio.toggleStation();
    }
    function switchTime() {
      state.hour = state.hour < 19.3 && state.hour >= 7 ? 22.1 : 17.55;
    }
    function switchWeather() {
      state.weather = (state.weather + 1) % WEATHER.length;
    }
    function toggleCrouch() {
      if (!state.vehicle && !state.boat) player.crouching = !player.crouching;
    }
    resize();
    return { state, world, cars: carList, boats: marine.fleet, guards: watch.guards, resize, repaint, recoverGraphics, update, start, context, handleInteraction, resetPosition,
      protagonist, escapeDuration, projectTarget, selectJob, turnCamera, holdCamera, switchTime, toggleStation,
      roadGuide: roadNavigation.current,
      switchWeather, toggleCrouch, refinish, tuneEngine, underWatch,
      setSound: audio.setEnabled, cycleCamera,
      nextStoryJob, hasClosingHandover, retryJob, nextOrder, navigateMarket, cancelOrder, cashText, timeText };
  }

  Object.assign(D, { createSimulation, PAINTS, TUNE_PRICES, WEATHER, WORKSHOP, NIGHT_MARKET, CAMPAIGN });
})();
