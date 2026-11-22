(() => {
  'use strict';
  const D = window.Tideline;
  const $ = id => document.getElementById(id);
  const SAVE_KEY = 'tideline-dispatch/baixi/v1';
  const GRAPHICS = ['auto', 'high', 'performance'];
  const TOUCH_SETTINGS = ['auto', 'on', 'off'];
  const LOOK_GAINS = { low: 72, normal: 100, high: 132 };
  const { JOBS, CAMPAIGN, X, Z, TAPES, BOUNDS, ROAD, WAREHOUSE, MARINE, WORKSHOP, NIGHT_MARKET, PAINTS, TUNE_PRICES, WEATHER, clamp, distance } = D;

  function readProgress() {
    const defaults = { cash: 120, completed: [], ending: false, tapes: [], best: null, deliveries: 0, paint: 0, tune: 0, graphics: 'auto', touch: 'auto',
      lookGain: 'normal', mouseSensitivity: 100, touchSensitivity: 100, sound: true, reduceMotion: matchMedia('(prefers-reduced-motion: reduce)').matches };
    try {
      const raw = JSON.parse(localStorage.getItem(SAVE_KEY));
      if (!raw || typeof raw !== 'object') return defaults;
      const ids = (data, limit) => Array.isArray(data) ? [...new Set(data.filter(i => Number.isInteger(i) && i >= 0 && i < limit))] : [];
      const best = Number.isFinite(raw.best) && raw.best > 0 && raw.best <= 110.1 ? raw.best : null;
      const completed = ids(raw.completed, JOBS.length);
      const legacyGain = Object.hasOwn(LOOK_GAINS, raw.lookGain) ? raw.lookGain : 'normal';
      const percent = value => Number.isFinite(value) ? clamp(Math.round(value), 30, 180) : LOOK_GAINS[legacyGain];
      return {
        cash: Number.isSafeInteger(raw.cash) ? clamp(raw.cash, 0, 999999999) : defaults.cash,
        completed, ending: raw.ending === true && completed.length === JOBS.length, tapes: ids(raw.tapes, TAPES.length), best,
        deliveries: Number.isSafeInteger(raw.deliveries) && raw.deliveries >= 0 ? raw.deliveries : defaults.deliveries,
        paint: Number.isInteger(raw.paint) && PAINTS[raw.paint] ? raw.paint : 0,
        tune: Number.isInteger(raw.tune) ? clamp(raw.tune, 0, TUNE_PRICES.length) : 0,
        graphics: GRAPHICS.includes(raw.graphics) ? raw.graphics : defaults.graphics,
        touch: TOUCH_SETTINGS.includes(raw.touch) ? raw.touch : defaults.touch,
        lookGain: legacyGain, mouseSensitivity: percent(raw.mouseSensitivity), touchSensitivity: percent(raw.touchSensitivity),
        sound: raw.sound !== false, reduceMotion: typeof raw.reduceMotion === 'boolean' ? raw.reduceMotion : defaults.reduceMotion,
      };
    } catch {
      return defaults;
    }
  }

  const progress = readProgress();
  const shells = { help: $('help-panel'), map: $('map-panel'), pause: $('pause-panel'), workshop: $('workshop-panel'), dispatch: $('dispatch-panel') };
  const game = $('game');
  const language = D.language;
  language.init(game);
  const languageScreen = $('language-screen');
  const languageSetting = $('language-setting');
  let languageChosen = false;
  const scene = $('scene');
  const title = $('title-screen');
  const hud = $('hud');
  const startButton = $('start');
  const startLabel = $('start-label');
  const roamButton = $('roam');
  const rainButton = $('rain-job');
  const harborButton = $('harbor-job');
  const launchButtons = [startButton, roamButton, rainButton, harborButton];
  const status = $('boot-status');
  const graphicsRecovery = $('graphics-recovery');
  const graphicsMessage = $('graphics-message');
  const graphicsRetry = $('graphics-retry');
  const fullscreenButton = $('fullscreen-button');
  const appDisplay = matchMedia('(display-mode: fullscreen), (display-mode: standalone)');
  const mobilePointer = matchMedia('(pointer: coarse)');
  const mousePointer = matchMedia('(hover: hover) and (pointer: fine)');
  const portraitViewport = matchMedia('(orientation: portrait)');
  // Keep the game inside the fullscreen element so the viewport can rotate independently.
  const fullscreenRoot = document.documentElement;
  const fullscreen = fullscreenRoot.requestFullscreen && document.fullscreenEnabled !== false
    ? { enter: () => fullscreenRoot.requestFullscreen({ navigationUI: 'hide' }), exit: () => document.exitFullscreen() }
    : fullscreenRoot.webkitRequestFullscreen && document.webkitFullscreenEnabled !== false
      ? { enter: () => fullscreenRoot.webkitRequestFullscreen(), exit: () => document.webkitExitFullscreen() }
      : null;
  const radar = $('radar');
  const map = $('big-map');
  const keyboard = new Set();
  const holdCodes = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight', 'ShiftLeft', 'ShiftRight', 'Space']);
  let sim, panel = null, helpFrom = null, restoreFocus = null, view = 'title', booting = false, last = 0, hudRefresh = 0, radarRefresh = 0;
  let pendingDispatch = null;
  let graphicsState = 'ok', graphicsRetried = false, resizePending = false;
  let landscapeRequested = false, orientationAttempted = false;
  let mouseLook = false, mousePosition = null;
  let pointer = null;
  let lookYaw = 0, lookPitch = 0;
  let activeLookDevice = mobilePointer.matches ? 'touch' : 'mouse';
  let settingsDevice = activeLookDevice, hintUntil = 0;
  const shownLookHints = new Set();
  const lookFields = { mouse: 'mouseSensitivity', touch: 'touchSensitivity' };
  const canControl = () => view === 'game' && !panel && graphicsState === 'ok' && !document.hidden;
  const touch = D.makeTouchControls(game, $('touch'), progress.touch, canControl, action);
  const keys = {
    has: code => keyboard.has(code) || touch.has(code),
    get axisX() { return touch.x; },
    get axisY() { return touch.y; },
  };

  function updateCampaignTitle() {
    titleFor(startLabel, progress.completed.length ? '继续游戏' : '开始游戏');
    const resume = $('campaign-resume');
    show(resume, progress.completed.length);
    if (resume.hidden) return;
    const next = JOBS.findIndex((_, id) => !progress.completed.includes(id));
    titleFor($('campaign-resume-label'), next >= 0 ? '第 ' + (next + 1) + ' 章' : '主线');
    titleFor($('campaign-resume-name'), next >= 0 ? JOBS[next].name : progress.ending ? '已完成' : '待交班');
  }
  function persist() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(progress));
    } catch {
      // The session remains playable when storage is disabled.
    }
    updateCampaignTitle();
  }
  function showSound() {
    for (const id of ['title-audio', 'pause-audio']) {
      const button = $(id);
      button.setAttribute('aria-pressed', progress.sound);
      titleFor(button, progress.sound ? '声音开启' : '声音关闭');
    }
    titleFor($('motion-button'), progress.reduceMotion ? '镜头震动关闭' : '镜头震动开启');
    $('motion-button').setAttribute('aria-pressed', !progress.reduceMotion);
  }
  function restoreControls() {
    keyboard.clear();
    touch.reset();
    cameraDrag.reset();
    mousePosition = null;
    lookYaw = lookPitch = 0;
  }
  function queueResize() {
    resizePending = true;
  }
  function requestMouseLook() {
    if (!mouseLook || touch.activatingByTouch || !scene.requestPointerLock || document.pointerLockElement) return;
    try { scene.requestPointerLock()?.catch(() => {}); } catch {}
  }
  function releaseMouseLook() {
    mousePosition = null;
    if (document.pointerLockElement === scene) document.exitPointerLock();
  }
  let cursorHidden = false;
  function syncCursor() {
    const hide = canControl();
    if (hide === cursorHidden) return;
    cursorHidden = hide;
    scene.style.cursor = hide ? 'none' : '';
  }
  function flushLook() {
    if (!lookYaw && !lookPitch) return;
    sim.turnCamera(lookYaw, lookPitch, true);
    lookYaw = lookPitch = 0;
  }
  function queueMouseLook(dx, dy) {
    activeLookDevice = 'mouse';
    const gain = progress.mouseSensitivity / 100;
    lookYaw += dx * .0036 * gain;
    lookPitch += dy * .0028 * gain;
  }
  function lookWithMouse(event) {
    if (event.pointerType !== 'mouse' || event.sourceCapabilities?.firesTouchEvents || pointer || !canControl() || document.pointerLockElement === scene) return;
    if (event.target !== scene) {
      mousePosition = null;
      return;
    }
    mouseLook = true;
    const previous = mousePosition;
    mousePosition = { x: event.clientX, y: event.clientY };
    if (!previous) return;
    queueMouseLook(previous.x - mousePosition.x, previous.y - mousePosition.y);
  }
  function fullscreenActive() {
    return Boolean(document.fullscreenElement || document.webkitFullscreenElement);
  }
  function inWebApp() {
    return navigator.standalone === true || (!fullscreenActive() && appDisplay.matches);
  }
  function showFullscreenControl() {
    fullscreenButton.hidden = !fullscreen || inWebApp();
    titleFor(fullscreenButton, fullscreenActive() ? '退出全屏' : '全屏');
  }
  function updateLandscapeLayout() {
    const rotated = landscapeRequested && portraitViewport.matches;
    if (game.classList.contains('rotate-landscape') === rotated) return;
    restoreControls();
    game.classList.toggle('rotate-landscape', rotated);
    queueResize();
  }
  function updateOrientationLock() {
    const orientation = screen.orientation;
    const canLock = landscapeRequested && (fullscreenActive() || inWebApp());
    if (!canLock) {
      if (!orientationAttempted) return;
      orientationAttempted = false;
      try { orientation?.unlock?.(); } catch {}
      return;
    }
    if (orientationAttempted || !orientation?.lock) return;
    orientationAttempted = true;
    try {
      orientation.lock('landscape').catch(() => {});
    } catch {
      // The portrait viewport rotates the game if the native lock is unavailable.
    }
  }
  function setLandscape(requested) {
    landscapeRequested = requested;
    updateLandscapeLayout();
    updateOrientationLock();
  }
  function toggleFullscreen() {
    if (!fullscreen || inWebApp()) return;
    try {
      const result = fullscreenActive() ? fullscreen.exit() : fullscreen.enter();
      result?.catch(showFullscreenControl);
    } catch {
      showFullscreenControl();
    }
  }
  function fullscreenChanged() {
    showFullscreenControl();
    updateOrientationLock();
    queueResize();
  }
  function openPanel(kind) {
    if (!shells[kind] || (view !== 'game' && kind !== 'help')) return;
    if (panel == null) restoreFocus = document.activeElement;
    if (kind === 'help') helpFrom = panel;
    panel = kind;
    releaseMouseLook();
    restoreControls();
    title.inert = hud.inert = true;
    for (const [name, node] of Object.entries(shells)) node.hidden = name !== panel;
    if (kind === 'map') renderMapPanel();
    if (kind === 'pause') {
      settingsDevice = activeLookDevice;
      showLookDetails(false);
      show($('retry-job'), !sim.state.order && (sim.state.attempt || sim.state.retry != null));
      show($('cancel-order'), sim.state.order);
    }
    if (kind === 'workshop') renderWorkshop();
    const firstAction = kind === 'dispatch' ? $('dispatch-accept') : shells[panel].querySelector('[data-close]');
    firstAction?.focus({ preventScroll: true });
  }
  function closePanel() {
    if (!panel) return;
    if (panel === 'dispatch') pendingDispatch = null;
    if (panel === 'pause' && !$('look-controls').hidden) showLookDetails(false);
    shells[panel].hidden = true;
    if (panel === 'help' && helpFrom) {
      const back = helpFrom;
      helpFrom = null;
      openPanel(back);
      return;
    }
    panel = helpFrom = null;
    title.inert = hud.inert = false;
    restoreControls();
    if (restoreFocus instanceof HTMLElement && restoreFocus !== document.body) restoreFocus.focus({ preventScroll: true });
    restoreFocus = null;
  }

  const districtPins = [
    ['北桥商务区', 19, -243], ['旧城', -164, -47], ['潮汛里', 230, 55],
    ['南埠货场', -49, 261], ['灯塔湾', 325, -42], ['白汐湾', 499, 29],
    ['岬灯岛', MARINE.island.x + 8, MARINE.island.z - 19],
  ];
  let mapBase = null;
  const mapFrame = { left: -366, top: -361, width: 1180, height: 805 };
  const chartWater = '#163638';
  const routeInk = '#a4efd0';
  const chartIntervals = [10, 25, 50, 100, 200, 500];
  const radarRuler = $('radar-scale'), atlasRuler = $('atlas-scale');
  function roundedRect(ctx, x, y, width, height, radius) {
    if (ctx.roundRect) ctx.roundRect(x, y, width, height, radius);
    else ctx.rect(x, y, width, height);
  }
  function mapSurface() {
    if (mapBase) return mapBase;
    const image = document.createElement('canvas');
    image.width = mapFrame.width * 2;
    image.height = mapFrame.height * 2;
    const ctx = image.getContext('2d');
    if (!ctx) return null;
    mapBase = image;
    ctx.scale(2, 2);
    ctx.translate(-mapFrame.left, -mapFrame.top);
    const depth = ctx.createLinearGradient(-250, 50, 810, 245);
    depth.addColorStop(0, '#345449');
    depth.addColorStop(.63, '#214543');
    depth.addColorStop(1, chartWater);
    ctx.fillStyle = depth;
    ctx.fillRect(mapFrame.left, mapFrame.top, mapFrame.width, mapFrame.height);
    ctx.fillStyle = '#b4bf9c49';
    for (let x = -360; x < 817; x += 20) {
      for (let z = -360; z < 447; z += 20) ctx.fillRect(x, z, 1.15, 1.15);
    }
    const island = MARINE.island;
    ctx.lineWidth = 1.3;
    for (const [radius, shade] of [[18, '#abc2a563'], [35, '#aac1a14e'], [57, '#8cae9b45'], [83, '#8cae9b31'], [118, '#8cae9b24']]) {
      ctx.strokeStyle = shade;
      ctx.beginPath();
      roundedRect(ctx, BOUNDS.minX - radius, BOUNDS.minZ - radius,
        BOUNDS.maxX - BOUNDS.minX + radius * 2, BOUNDS.maxZ - BOUNDS.minZ + radius * 2, radius * .93);
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(island.x, island.z, island.rx + radius, island.rz + radius * .78, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.fillStyle = '#475a4c';
    ctx.fillRect(BOUNDS.minX, BOUNDS.minZ, BOUNDS.maxX - BOUNDS.minX, BOUNDS.maxZ - BOUNDS.minZ);
    ctx.fillStyle = '#555c4d';
    ctx.fillRect(BOUNDS.minX, 171, 583, 157);
    ctx.fillStyle = '#536456';
    ctx.fillRect(-170, BOUNDS.minZ, 366, 229);
    // Each printed parcel follows the same road pair and curb setback as the world.
    ctx.lineWidth = .8;
    for (let ix = 0; ix < X.length - 1; ix++) {
      for (let iz = 0; iz < Z.length - 1; iz++) {
        const left = X[ix] + 11.35, top = Z[iz] + 11.35;
        const w = X[ix + 1] - X[ix] - 22.7, d = Z[iz + 1] - Z[iz] - 22.7;
        ctx.fillStyle = iz >= 5 ? '#68705c' : '#627460';
        ctx.fillRect(left, top, w, d);
        ctx.strokeStyle = '#a8ad8b9e';
        ctx.strokeRect(left, top, w, d);
      }
    }
    const parkX = (X[3] + X[4]) / 2, parkZ = (Z[3] + Z[4]) / 2;
    const lawnW = X[4] - X[3] - 31.7, lawnD = Z[4] - Z[3] - 31.7;
    ctx.fillStyle = '#435e48';
    ctx.fillRect(parkX - lawnW / 2, parkZ - lawnD / 2, lawnW, lawnD);
    ctx.fillStyle = '#a5a387';
    ctx.fillRect(parkX - lawnW / 2, parkZ - 2.5, lawnW, 5);
    ctx.fillRect(parkX - 2.5, parkZ - lawnD / 2, 5, lawnD);
    ctx.fillStyle = '#879984';
    ctx.beginPath();
    ctx.arc(parkX, parkZ, 7.6, 0, Math.PI * 2);
    ctx.fill();
    for (const dx of [-1, 1]) for (const dz of [-1, 1]) {
      for (const offset of [16, 25]) {
        ctx.fillStyle = '#30493b';
        ctx.strokeStyle = '#79916f';
        ctx.beginPath();
        ctx.arc(parkX + dx * offset, parkZ + dz * offset, 3.3, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
    }
    ctx.fillStyle = '#858674';
    ctx.fillRect(298, -324, 41, 652);
    ctx.fillRect(-326, 304, 665, 24);
    for (const [x, z, w, d] of [[336, -257, 80, 15], [336, -165, 44, 15], [336, 33, 31, 15], [-247, 327, 25, 32], [-157, 327, 26, 40], [-69, 327, 28, 40], [34, 327, 25, 40]]) {
      ctx.fillRect(x, z, w, d);
    }
    for (const rect of [MARINE.mainDock, MARINE.islandDock]) {
      ctx.fillRect(rect.minX, rect.minZ, rect.maxX - rect.minX, rect.maxZ - rect.minZ);
    }
    // Group the waterfront board seams so the boardwalk reads at either scale.
    ctx.strokeStyle = '#465d4d8c';
    ctx.lineWidth = .8;
    ctx.beginPath();
    for (let z = -318; z < 324; z += 6.3) {
      ctx.moveTo(306.3, z);
      ctx.lineTo(333.7, z);
    }
    for (let x = -316; x < 328; x += 6.3) {
      ctx.moveTo(x, 305);
      ctx.lineTo(x, 325);
    }
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(island.x, island.z, island.rx + 2.6, island.rz + 2.6, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#9a9b7f';
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(island.x, island.z, island.rx - 4, island.rz - 4, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#4e6452';
    ctx.fill();
    ctx.strokeStyle = '#c0bfa073';
    for (const inset of [10, 17, 24]) {
      ctx.beginPath();
      ctx.ellipse(island.x + inset * .27, island.z - inset * .14, island.rx - inset, island.rz - inset * .65, -.16, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.fillStyle = '#a6a48a';
    ctx.fillRect(MARINE.islandDock.maxX - 7, MARINE.panel.z - 1.7, MARINE.panel.x - MARINE.islandDock.maxX + 7, 3.4);
    // Print the actual building footprints and step the roof tone by elevation.
    ctx.lineWidth = .85;
    for (const { left, top, w, d, height } of sim.world.footprints) {
      const relief = Math.min(3.7, height * .08);
      ctx.fillStyle = '#304438a6';
      ctx.fillRect(left + relief, top + relief, w, d);
      ctx.fillStyle = height > 30 ? '#aca98c' : height > 13 ? '#909a81' : '#7c8d76';
      ctx.fillRect(left, top, w, d);
      ctx.strokeStyle = '#324a3e';
      ctx.strokeRect(left, top, w, d);
      if (w > 9 && d > 9) {
        ctx.strokeStyle = '#c8c3a288';
        ctx.strokeRect(left + 1.65, top + 1.65, w - 3.3, d - 3.3);
        if (height > 18) {
          ctx.fillStyle = '#5c725d';
          ctx.fillRect(left + w * .18, top + d * .58, w * .26, d * .22);
        }
      }
    }
    ctx.fillStyle = '#77826c';
    for (const x of X) ctx.fillRect(x - ROAD / 2, -322, ROAD, 648);
    for (const z of Z) ctx.fillRect(-326, z - ROAD / 2, 650, ROAD);
    // A thin casing keeps intersections readable without changing their geometry.
    for (const [fraction, ink] of [[.57, '#485b4c'], [.46, '#b5b298']]) {
      const ribbon = ROAD * fraction;
      ctx.fillStyle = ink;
      for (const x of X) ctx.fillRect(x - ribbon / 2, -322, ribbon, 648);
      for (const z of Z) ctx.fillRect(-326, z - ribbon / 2, 650, ribbon);
    }
    ctx.strokeStyle = '#e0d8b9a0';
    ctx.lineWidth = .7;
    ctx.setLineDash([4, 6]);
    ctx.beginPath();
    for (const x of X) {
      ctx.moveTo(x, -321);
      ctx.lineTo(x, 326);
    }
    for (const z of Z) {
      ctx.moveTo(-324, z);
      ctx.lineTo(320, z);
    }
    ctx.stroke();
    return mapBase;
  }
  function path(ctx, route, toScreen, width, color, dash = []) {
    if (!route.length) return;
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.setLineDash(dash);
    ctx.beginPath();
    route.forEach((point, i) => {
      const coords = toScreen(point);
      if (i) ctx.lineTo(...coords);
      else ctx.moveTo(...coords);
    });
    ctx.stroke();
    ctx.setLineDash([]);
  }
  function diamond(ctx, x, y, radius, color, outline = '#263b30') {
    ctx.fillStyle = color;
    ctx.strokeStyle = outline;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(x, y - radius);
    ctx.lineTo(x + radius, y);
    ctx.lineTo(x, y + radius);
    ctx.lineTo(x - radius, y);
    ctx.closePath();
    ctx.stroke();
    ctx.fill();
  }
  function destinationRing(ctx, x, y, radius) {
    const pulse = (performance.now() * .00135) % 1;
    const waveR = radius * (1.0 + pulse * 1.45);
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, waveR, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(164, 239, 208, ' + ((1 - pulse) * .68).toFixed(3) + ')';
    ctx.lineWidth = Math.max(1.2, radius * .20 * (1 - pulse * .5));
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x, y, radius * 1.25, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(164, 239, 208, .18)';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = '#132d28';
    ctx.fill();
    ctx.strokeStyle = routeInk;
    ctx.lineWidth = radius * .28;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x, y, radius * .36, 0, Math.PI * 2);
    ctx.fillStyle = '#e7fff5';
    ctx.fill();
    ctx.restore();
  }
  function navigation(from, aim) {
    if (aim.vehiclePickup) return [aim];
    const phase = sim.state.attempt?.phase;
    const atMainDock = D.marineWalkable(from.x, from.z) && from.x < 420;
    if (sim.state.boat) {
      if (!aim.marine || distance(aim, MARINE.launch) < 1) {
        const entrance = [];
        if (from.z < MARINE.mainDock.maxZ + 1.5 && from.x < 385) entrance.push({ x: 389, z: from.z });
        if (from.x > 392 || from.z < 219.3) entrance.push({ x: 394, z: 230 });
        return [...entrance, MARINE.launch, ...(aim.marine ? [] : [MARINE.mainLanding, ...D.routeBetween(MARINE.job, aim)])];
      }
      return [aim];
    }
    if (aim.marine) {
      if (D.islandAccess(from.x, from.z)) {
        const pier = { x: (MARINE.islandDock.maxX + MARINE.islandDock.minX) / 2, z: MARINE.panel.z - 2 };
        if (aim.boarding && from.x > pier.x + 5) return [pier, aim];
        return [aim];
      }
      if (atMainDock) return [aim];
      if (aim.boarding) return [...D.routeBetween(from, MARINE.job), aim];
    }
    if ((!aim.indoor && phase !== 'warehouseExit') || distance(from, WAREHOUSE.entry) > 86) return D.routeBetween(from, aim);
    const direct = (a, b) => !sim.world.occluded(a, b, .58, .6);
    if (direct(from, aim)) return [aim];
    const path = WAREHOUSE.route;
    const end = path.reduce((slot, p, i) => distance(p, aim) < distance(path[slot], aim) ? i : slot, 0);
    let start = 0;
    let shortest = Infinity;
    for (let i = 0; i <= end; i++) {
      if (!direct(from, path[i])) continue;
      let length = distance(from, path[i]);
      for (let j = i; j < end; j++) length += distance(path[j], path[j + 1]);
      if (length < shortest) {
        start = i;
        shortest = length;
      }
    }
    return [...path.slice(start, end + 1), aim];
  }
  function drawMap(canvas, isLarge) {
    if (!sim) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let width = canvas.width;
    let height = canvas.height;
    const pr = isLarge ? Math.min(2, devicePixelRatio || 1) : 1;
    if (isLarge && canvas.clientWidth && canvas.clientHeight) {
      width = Math.round(canvas.clientWidth * pr);
      height = Math.round(canvas.clientHeight * pr);
      if (width !== canvas.width || height !== canvas.height) {
        canvas.width = width;
        canvas.height = height;
      }
    }
    const p = sim.protagonist();
    const center = isLarge ? { x: mapFrame.left + mapFrame.width / 2, z: mapFrame.top + mapFrame.height / 2 } : p;
    const radarZoom = sim.state.boat ? .65 : sim.state.vehicle ? 1.08 - clamp(sim.state.vehicle.speed / 45, 0, 1) * .34 : 1.48;
    const scale = isLarge ? Math.min((width - 26 * pr) / mapFrame.width, (height - 18 * pr) / mapFrame.height) :
      radarZoom * height / 256;
    const ruler = isLarge ? atlasRuler : radarRuler;
    if (ruler) {
      let metres = chartIntervals[0];
      const available = width * (isLarge ? .17 : .24);
      for (const interval of chartIntervals) if (interval * scale <= available) metres = interval;
      const physical = metres * scale;
      const size = isLarge ? (physical / pr).toFixed(1) + 'px' : (physical * 100 / width).toFixed(1) + '%';
      if (ruler.style.width !== size) ruler.style.width = size;
      if (ruler.textContent !== metres + ' m') ruler.textContent = metres + ' m';
    }
    const view = point => [width / 2 + (point.x - center.x) * scale, height / 2 + (point.z - center.z) * scale];
    const origin = view({ x: mapFrame.left, z: mapFrame.top });
    ctx.fillStyle = chartWater;
    ctx.fillRect(0, 0, width, height);
    const base = mapSurface();
    if (base) ctx.drawImage(base, ...origin, mapFrame.width * scale, mapFrame.height * scale);
    const aim = sim.state.target;
    const route = aim ? [p, ...navigation(p, aim)] : [];
    if (isLarge) {
      const compact = height / pr < 175;
      const fontSize = (compact ? 11 : 12) * pr;
      ctx.save();
      ctx.font = '700 ' + fontSize + 'px ' + (getComputedStyle(canvas).getPropertyValue('--chart-serifs').trim() || 'Georgia, "Songti SC", SimSun, serif');
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineJoin = 'round';
      const occupied = [{ x: 15 * pr, y: 18 * pr, rx: 15 * pr, ry: 18 * pr }];
      function reserve(point, radius) {
        const [x, y] = view(point);
        occupied.push({ x, y, rx: radius * pr, ry: radius * pr });
      }
      reserve(p, 13);
      if (aim) reserve(aim, 10);
      for (const job of JOBS) reserve(job, 10);
      for (const tape of progress.tapes) reserve(TAPES[tape], 5.5);
      reserve(WORKSHOP, 5);
      if (!sim.state.marketGuide) reserve(NIGHT_MARKET, 6.5);
      for (const boat of sim.boats) if (boat !== sim.state.boat) reserve(boat, 5.5);
      if (sim.underWatch(sim.state.attempt?.phase)) for (const guard of sim.guards) reserve(guard, 4.5);
      for (const car of sim.cars) if (car.type === 'police') reserve(car, 5);
      // Keep the colored line readable between its markers, including diagonal crossings at sea.
      const track = route.map(view);
      for (let i = 1; i < track.length; i++) {
        const [ax, ay] = track[i - 1], [bx, by] = track[i];
        const steps = Math.ceil(Math.hypot(bx - ax, by - ay) / (8 * pr));
        for (let step = 1; step <= steps; step++) {
          const fraction = step / steps;
          occupied.push({ x: ax + (bx - ax) * fraction, y: ay + (by - ay) * fraction, rx: 3.2 * pr, ry: 3.2 * pr });
        }
      }
      const focus = new Set([D.district(p)]);
      if (aim) focus.add(aim.marine && aim.x > MARINE.mainDock.maxX && !D.islandAccess(aim.x, aim.z) ? '白汐湾' : D.district(aim));
      if (JOBS[sim.state.selected]) focus.add(D.district(JOBS[sim.state.selected]));
      const order = new Set([...focus, ...(compact ? ['岬灯岛', '北桥商务区', '南埠货场'] : []), ...districtPins.map(pin => pin[0])]);
      const offsets = [[0, 0], [0, -1], [0, 1], [-1, 0], [1, 0], [-.78, -1], [.78, -1], [-.78, 1], [.78, 1], [0, -2], [0, 2], [-1, -2], [1, 2]];
      let count = 0;
      for (const label of order) {
        if (compact && count >= 4) break;
        const pin = districtPins.find(([name]) => name === label);
        if (!pin) continue;
        const [anchorX, anchorY] = view({ x: pin[1], z: pin[2] });
        const displayLabel = language.t(label);
        const metrics = ctx.measureText(displayLabel);
        const rx = metrics.width / 2 + 2.5 * pr;
        const glyphHeight = metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent || fontSize;
        const ry = Math.max(fontSize, glyphHeight) / 2 + 2 * pr;
        function fits(x, y) {
          return x - rx >= pr && y - ry >= pr && x + rx <= width - pr && y + ry <= height - pr &&
            !occupied.some(b => Math.abs(x - b.x) < rx + b.rx && Math.abs(y - b.y) < ry + b.ry);
        }
        let position = null;
        for (const [dx, dy] of offsets) {
          const x = anchorX + dx * (rx + 6 * pr), y = anchorY + dy * (ry + 7 * pr);
          if (fits(x, y)) {
            position = [x, y];
            break;
          }
        }
        if (!position && (focus.has(label) || !compact)) {
          // Dense collections of map pins can leave a district's nearest clear label in the margin.
          let nearest = Infinity;
          for (let y = ry + 2 * pr; y < height - ry; y += 6 * pr) {
            for (let x = rx + 2 * pr; x < width - rx; x += 6 * pr) {
              const score = (x - anchorX) ** 2 + (y - anchorY) ** 2;
              if (score < nearest && fits(x, y)) {
                nearest = score;
                position = [x, y];
              }
            }
          }
        }
        if (!position) continue;
        const [x, y] = position;
        const edgeX = clamp(anchorX, x - rx, x + rx), edgeY = clamp(anchorY, y - ry, y + ry);
        if (Math.hypot(edgeX - anchorX, edgeY - anchorY) > 4 * pr) {
          ctx.beginPath();
          ctx.moveTo(anchorX, anchorY);
          ctx.lineTo(edgeX, edgeY);
          ctx.strokeStyle = '#c0c8a8ad';
          ctx.lineWidth = pr;
          ctx.stroke();
        }
        ctx.lineWidth = 3 * pr;
        ctx.strokeStyle = '#22372d';
        ctx.strokeText(displayLabel, x, y);
        ctx.fillStyle = focus.has(label) ? '#fff2d1' : '#f2ead1';
        ctx.fillText(displayLabel, x, y);
        occupied.push({ x, y, rx, ry });
        count++;
      }
      ctx.restore();
      for (const index of progress.tapes) diamond(ctx, ...view(TAPES[index]), 4.3 * pr, '#efc782');
      const [wx, wz] = view(WORKSHOP);
      ctx.fillStyle = '#c2dcc6';
      ctx.fillRect(wx - 4 * pr, wz - 4 * pr, 8 * pr, 8 * pr);
      if (!sim.state.marketGuide) diamond(ctx, ...view(NIGHT_MARKET), 5.4 * pr, '#ffad92');
    }
    if (aim) {
      path(ctx, route, view, isLarge ? 9.5 * pr : 13, 'rgba(116, 234, 194, .20)');
      path(ctx, route, view, isLarge ? 6.0 * pr : 8.5, '#123029ec');
      path(ctx, route, view, isLarge ? 3.2 * pr : 4.8, routeInk, aim.marine ? [5 * pr, 4 * pr] : []);
      const [x, y] = view(aim);
      if (isLarge) destinationRing(ctx, x, y, 10 * pr);
      else {
        const dx = x - width / 2;
        const dy = y - height / 2;
        const pull = Math.min(1, (width / 2 - 15) / Math.max(.1, Math.abs(dx)),
          (height / 2 - 15) / Math.max(.1, Math.abs(dy)));
        destinationRing(ctx, width / 2 + dx * pull, height / 2 + dy * pull, 10.5);
      }
    }
    if (isLarge) {
      const radius = (height / pr < 175 ? 6.7 : 8.3) * pr;
      ctx.save();
      ctx.font = 'bold ' + (radius * 1.6) + 'px Georgia, serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      for (const [index, job] of JOBS.entries()) {
        const [x, y] = view(job);
        const done = progress.completed.includes(index);
        const chosen = sim.state.selected === index && !sim.state.marketGuide && !sim.state.order;
        if (chosen) {
          ctx.beginPath();
          ctx.arc(x, y, radius * 1.48, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(244, 123, 82, .26)';
          ctx.fill();
        }
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fillStyle = chosen ? '#f47b52' : done ? '#1d3732' : '#142322';
        ctx.fill();
        ctx.strokeStyle = chosen ? '#fff1d4' : done ? '#8ed9be' : '#fa8c5d';
        ctx.lineWidth = (chosen ? 2.2 : 1.7) * pr;
        ctx.stroke();
        ctx.fillStyle = chosen ? '#101b1c' : done ? '#b8f2dc' : '#ffd0a8';
        ctx.fillText(String(index + 1), x, y + .45 * pr);
      }
      ctx.restore();
    }
    for (const boat of sim.boats) {
      if (boat === sim.state.boat) continue;
      const [x, y] = view(boat);
      ctx.lineWidth = 1.35 * pr;
      ctx.strokeStyle = '#bddecd';
      ctx.fillStyle = '#31504a';
      ctx.beginPath();
      roundedRect(ctx, x - 4 * pr, y - 2.2 * pr, 8 * pr, 4.4 * pr, 1.4 * pr);
      ctx.fill();
      ctx.stroke();
    }
    if (sim.underWatch(sim.state.attempt?.phase)) {
      for (const guard of sim.guards) {
        const [x, z] = view(guard);
        ctx.fillStyle = '#ffab73';
        ctx.beginPath();
        ctx.arc(x, z, isLarge ? 3.5 * pr : 5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    for (const car of sim.cars) {
      if (car.type !== 'police') continue;
      const [x, y] = view(car);
      ctx.fillStyle = '#ff855f';
      ctx.strokeStyle = '#4c3226';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(x, y, isLarge ? 3.8 * pr : 6.9, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fill();
    }
    const [px, py] = view(p);
    const arrow = isLarge ? 8 * pr : 14;
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(Math.PI - p.yaw);
    // Subtle forward heading cone for crisp spatial orientation
    const cone = ctx.createRadialGradient(0, 0, arrow * .4, 0, 0, arrow * 3.1);
    cone.addColorStop(0, 'rgba(255, 238, 198, .28)');
    cone.addColorStop(1, 'rgba(255, 238, 198, 0)');
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, arrow * 3.1, -Math.PI * .72, -Math.PI * .28);
    ctx.closePath();
    ctx.fillStyle = cone;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(0, 0, arrow * 1.42, 0, Math.PI * 2);
    ctx.fillStyle = '#10211d8c';
    ctx.fill();
    ctx.strokeStyle = '#f4e8caaa';
    ctx.lineWidth = isLarge ? .9 * pr : 1.6;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, -arrow);
    ctx.lineTo(arrow * .54, arrow * .65);
    ctx.lineTo(0, arrow * .36);
    ctx.lineTo(-arrow * .54, arrow * .65);
    ctx.closePath();
    ctx.fillStyle = '#fff1d0';
    ctx.strokeStyle = '#1b2b22';
    ctx.lineWidth = isLarge ? 2 * pr : 3;
    ctx.stroke();
    ctx.fill();
    ctx.restore();
  }

  function renderMapPanel() {
    const wrapper = $('map-jobs');
    wrapper.replaceChildren();
    const storyNext = sim.nextStoryJob();
    const story = sim.state.mode === 'story';
    const ending = sim.hasClosingHandover();
    const selected = sim.state.selected;
    titleFor($('map-heading'), story ? '主线任务' : '差事');
    show($('map-progress'), story);
    if (story) titleFor($('map-progress'), progress.completed.length + ' / ' + JOBS.length);
    JOBS.forEach((job, index) => {
      const button = document.createElement('button');
      button.className = 'map-job';
      button.dataset.job = index;
      button.setAttribute('aria-pressed', selected === index && !sim.state.marketGuide && !sim.state.order);
      const glyph = document.createElement('i');
      glyph.textContent = String(index + 1);
      const text = document.createElement('div');
      const name = document.createElement('strong');
      const detail = document.createElement('small');
      const extra = index === 2 && progress.best ? ' · 纪录 ' + sim.timeText(progress.best) : '';
      const locked = story && storyNext != null && index > storyNext;
      const active = sim.state.attempt?.id === index;
      titleFor(name, job.name + (active ? ' · 进行中' : progress.completed.includes(index) ? ' · 已完成' : ''));
      titleFor(detail, locked ? '完成前一单后解锁' : job.type + ' · ' + job.place + extra);
      language.attr(detail, 'title', job.detail);
      button.disabled = Boolean(locked || sim.state.attempt || sim.state.order || ending);
      button.addEventListener('click', () => {
        if (sim.selectJob(index)) closePanel();
      });
      text.append(name, detail);
      button.append(glyph, text);
      wrapper.append(button);
    });
    const brief = $('map-brief');
    const mission = CAMPAIGN[selected];
    show(brief, story && (mission || ending));
    if (!brief.hidden) {
      titleFor(brief.firstElementChild, ending ? '黎明交班' : JOBS[selected].name);
      titleFor(brief.lastElementChild, ending ? '回到潮汛修车铺，把一夜的信号记录交给林鹭。' : mission.summary);
    }
    const market = $('map-market');
    const order = sim.state.order;
    market.disabled = Boolean(sim.state.attempt || sim.state.boat);
    market.setAttribute('aria-pressed', String(Boolean(sim.state.marketGuide || order)));
    titleFor(market.lastElementChild, order ? '配送中 · ' + order.label
      : sim.state.marketGuide ? '已导航 · 点击取消' : market.disabled ? '空闲时可领取订单'
        : '导航取件 · 已送达 ' + progress.deliveries + ' 单');
    drawMap(map, true);
  }

  function renderWorkshop() {
    shells.workshop.dataset.paint = progress.paint;
    titleFor($('workshop-cash'), sim.cashText(progress.cash));
    const gallery = $('paint-choices');
    gallery.replaceChildren();
    for (const [index, paint] of PAINTS.entries()) {
      const button = document.createElement('button');
      button.className = 'paint-choice';
      button.setAttribute('aria-pressed', index === progress.paint);
      button.disabled = index === progress.paint || progress.cash < paint.price;
      const sample = document.createElement('i');
      sample.style.backgroundColor = paint.color;
      const name = document.createElement('strong');
      titleFor(name, paint.name);
      const price = document.createElement('small');
      titleFor(price, index === progress.paint ? '使用中' : paint.price ? sim.cashText(paint.price) : '免费');
      button.append(sample, name, price);
      button.addEventListener('click', () => {
        if (sim.refinish(index)) renderWorkshop();
      });
      gallery.append(button);
    }
    const price = TUNE_PRICES[progress.tune];
    const buy = $('tune-buy');
    buy.disabled = price == null || price > progress.cash;
    titleFor(buy, price == null ? '已满级' : '升级 · ' + sim.cashText(price));
    titleFor($('tune-level'), '等级 ' + progress.tune + ' / ' + TUNE_PRICES.length + ' · 提高加速、极速和氮气恢复');
  }

  const titleFor = language.text;
  const show = (node, on) => { if (node.hidden === Boolean(on)) node.hidden = !on; };
  let lastJobSig = '', lastToastSig = '', lastRadioSig = '';
  function pulseClass(node, cls) {
    node.classList.remove(cls);
    void node.offsetWidth;
    node.classList.add(cls);
  }
  function toastTone(note) {
    const text = (note.kind || '') + ' ' + (note.title || '') + ' ' + (note.body || '');
    if (/完成|送达|交班|纪录|解锁|收尾|酬劳|到手|升级|涂装|complete|deliver|record|unlock|reward/i.test(text)) return 'complete';
    if (/通缉|警报|拦截|暴露|发现|失败|超时|围堵|alert|wanted|fail|busted/i.test(text)) return 'alert';
    if (/第\s*\d+\s*章|主线|行动|接单|chapter|mission|start/i.test(text)) return 'chapter';
    return 'info';
  }
  const role = {
    district: $('district-name'), time: $('city-time'), weather: $('city-weather'), cash: $('cash'), card: $('job-card'), cardKind: $('job-kind'), cardTitle: $('job-title'),
    cardTask: $('job-task'), cardMeta: $('job-meta'), heatCard: $('heat-card'), stars: $('heat-stars'), heatStatus: $('heat-status'), heatFill: $('heat-fill'),
    roadGuide: $('road-guide'), roadMark: $('road-guide-mark'), roadAction: $('road-guide-action'), roadDistance: $('road-guide-distance'),
    prompt: $('interaction'), label: $('world-label'), toast: $('toast'), toastKind: $('toast-kind'), toastTitle: $('toast-title'),
    toastBody: $('toast-body'), radio: $('radio-message'), radioPerson: $('radio-person'), radioLine: $('radio-line'), driving: $('driving'),
    speed: $('speed'), speedFill: $('speed-fill'), unit: $('speed-unit'), gear: $('gear'), model: $('car-model'), nitro: $('nitro-fill'), nitroMeter: $('nitro-meter'),
    station: $('station'), vehicleHelp: $('vehicle-help'),
    concealment: $('stealth-status'), stance: $('stance'), suspicion: $('suspicion-label'), suspicionMeter: $('suspicion-meter'),
    suspicionFill: $('suspicion-fill'),
  };
  const stars = Array.from({ length: 4 }, () => {
    const star = document.createElement('span');
    star.textContent = '★';
    return star;
  });
  role.stars.replaceChildren(...stars);
  const roadActions = {
    left: ['↰', '左转'], right: ['↱', '右转'], back: ['↶', '调头'], straight: ['↑', '直行'], arrival: ['◆', '即将到达'],
    walk: ['P', '停车后步行'],
  };
  function clockText(hour) {
    const h = Math.floor(hour);
    const m = Math.floor((hour - h) * 60);
    return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
  }
  function jobDetails(s, p, action) {
    const current = JOBS[s.selected];
    const attempt = s.attempt;
    const target = s.target;
    const distanceText = target ? Math.round(distance(p, target)) + ' 米' : '';
    if (s.order) return ['夜市配送', s.order.name, '把' + s.order.cargo + '送到' + s.order.label + '。', distanceText, false];
    if (s.marketGuide) return ['夜市配送', '白汐夜市', '沿海走到夜市柜台取件。', distanceText, false];
    if (!current && !attempt) {
      if (sim.hasClosingHandover()) return ['主线收尾', '黎明交班', '回潮汛修车铺交回夜班记录。', distanceText, false];
      return ['', '自由漫游', '打开地图选择差事。', '磁带 ' + progress.tapes.length + ' / ' + TAPES.length, false];
    }
    const kind = s.mode === 'story' ? '第 ' + (s.selected + 1) + ' 章 · ' + current.type : current.type;
    const objective = (line, meta = distanceText, urgent = false) => [kind, current.name, line, meta, urgent];
    if (!attempt) {
      if (target?.vehiclePickup) return objective('上车，驾驶身边的海风 GT。', '');
      if (action?.kind === 'job') return objective('在' + current.place + '接单。', '');
      if (s.selected === 0 && s.vehicle) return objective(distance(p, current) < 25 ? '在修车铺前减速接单。' : '沿海滨大道开到修车铺。');
      return objective('前往' + current.place + '接单。');
    }
    if (attempt.phase === 'deliveryBoarding') return objective('上车后开始计时。');
    if (attempt.phase === 'escapeBoarding') return objective('回到车上，准备带走记录。');
    if (attempt.phase === 'delivery') return objective('把信号盒送到南埠货场入口。', Math.ceil(attempt.left) + ' 秒  ·  ' + distanceText, attempt.left < 13);
    if (attempt.phase === 'escape' || attempt.phase === 'warehouseEscape') {
      const line = attempt.phase === 'escape' ? '甩开巡逻车，保持脱离视线。' : '带着录音甩开巡逻车。';
      const meta = s.seen ? '追踪中' : '脱离视线 ' + Math.max(0, Math.ceil(sim.escapeDuration() - s.unseen)) + ' 秒';
      return objective(line, meta, s.seen);
    }
    if (attempt.phase === 'stash') return objective('到北桥信号站交货。');
    if (attempt.phase === 'warehouseTerminal') return objective('从东门进入七码仓，在控制台切换线路。');
    if (attempt.phase === 'warehouseCache') return objective('绕过货架，到中继柜取回录音带。');
    if (attempt.phase === 'warehouseExit') return objective(target?.indoor ? '走北侧门离开仓库。' : '上车，准备撤离。');
    if (attempt.phase === 'warehouseDrop') return objective('把录音带送到潮汛转运点。');
    if (attempt.phase === 'marineBuoy') return objective(s.boat ? '驶近橙色浮标，减速打捞备用电源。' : '从灯塔湾码头登艇。');
    if (attempt.phase === 'marineIsland') return objective(s.boat ? '驶到岬灯岛码头南侧，减速靠泊。' : '上船驶向岬灯岛。');
    if (attempt.phase === 'marineRepair') return objective(s.boat ? '靠泊登岛，前往航标供电台。' : '沿木栈道步行，把备用电源接上供电台。');
    if (attempt.phase === 'marineReturn') return objective(s.boat ? '返航，在灯塔湾码头减速靠泊。' : '返回岛上码头，登艇返航。');
    if (attempt.phase === 'marineHandover') return objective('回到码头的接单处，回报航标状态。');
    return objective('驶过前方的青色计时门。', (attempt.gate + 1) + ' / ' + D.RACE.length + '  ·  ' + Math.ceil(attempt.left) + ' 秒', attempt.left < 19);
  }
  function drawHud() {
    const s = sim.state;
    const p = sim.protagonist();
    if (!$('look-hint').hidden && s.clock >= hintUntil && !$('look-hint').contains(document.activeElement)) $('look-hint').hidden = true;
    titleFor(role.district, D.district(p));
    titleFor(role.time, clockText(s.hour));
    titleFor(role.weather, WEATHER[s.weather].name);
    titleFor(role.cash, sim.cashText(progress.cash));
    const guide = sim.roadGuide();
    show(role.roadGuide, guide);
    if (guide) {
      const [mark, label] = roadActions[guide.maneuver];
      titleFor(role.roadMark, mark);
      titleFor(role.roadAction, label);
      titleFor(role.roadDistance, guide.meters > 0 ? guide.meters + ' 米' : '');
      if (role.roadGuide.dataset.color !== guide.color) {
        role.roadGuide.style.setProperty('--route-color', guide.color);
        role.roadGuide.dataset.color = guide.color;
      }
    }
    const action = sim.context();
    const [kind, name, task, meta, urgent] = jobDetails(s, p, action);
    role.card.classList.toggle('is-roaming', !kind);
    role.card.classList.toggle('courier', Boolean(s.order || s.marketGuide));
    const cardTone = (s.order || s.marketGuide) ? 'courier'
      : sim.underWatch(s.attempt?.phase) ? 'stealth'
      : (s.boat || s.attempt?.phase?.startsWith('marine')) ? 'marine'
      : (s.attempt && s.attempt.gate != null) ? 'race'
      : kind ? 'story' : 'roam';
    if (role.card.dataset.tone !== cardTone) role.card.dataset.tone = cardTone;
    const jobSig = name + '|' + task;
    if (jobSig !== lastJobSig) {
      if (lastJobSig && kind) pulseClass(role.card, 'is-updated');
      lastJobSig = jobSig;
    }
    titleFor(role.cardKind, kind);
    show(role.cardKind, kind);
    titleFor(role.cardTitle, name);
    titleFor(role.cardTask, task);
    const detail = guide ? meta.replace(/(?:\s*·\s*)?\d+\s*米$/, '').trim() : meta;
    titleFor(role.cardMeta, detail);
    role.cardMeta.classList.toggle('urgent', urgent);
    const watching = sim.underWatch(s.attempt?.phase);
    show(role.concealment, watching);
    if (watching) {
      const score = Math.round(s.suspicion * 100);
      role.concealment.classList.toggle('alerted', s.attempt.alarmed);
      titleFor(role.stance, s.vehicle ? '先下车' : s.player.crouching ? '低姿移动' : 'Q 蹲行');
      titleFor(role.suspicion, s.attempt.alarmed ? '已发现' : '守卫警戒');
      role.suspicionFill.style.width = score + '%';
      role.suspicionMeter.setAttribute('aria-valuenow', score);
    }
    show(role.heatCard, s.heat);
    if (s.heat) {
      stars.forEach((star, index) => star.classList.toggle('lit', index < s.heat));
      language.attr(role.stars, 'aria-label', s.heat + ' 星通缉');
      const fraction = s.contain ? s.contain / 5.5 : s.unseen / sim.escapeDuration();
      titleFor(role.heatStatus, s.contain > .14 ? '正在被围堵' : s.seen ? '巡逻车正在追踪' : '脱离视线 ' + Math.ceil(sim.escapeDuration() - s.unseen) + ' 秒');
      role.heatFill.style.width = clamp(fraction, 0, 1) * 100 + '%';
    }
    show(role.prompt, action);
    if (action) {
      titleFor(role.prompt.firstElementChild, action.key ?? 'E');
      titleFor(role.prompt.lastElementChild, action.label);
    }
    const label = guide ? null : sim.projectTarget();
    show(role.label, label);
    if (label) {
      titleFor(role.label.lastElementChild, label.label + ' · ' + Math.round(label.d) + ' 米');
      role.label.style.setProperty('--marker-x', label.x * 100 + '%');
      role.label.style.setProperty('--marker-y', label.y * 100 + '%');
      role.label.dataset.close = label.d < 42 ? 'true' : 'false';
      role.label.classList.toggle('race', Boolean(label.race));
      role.label.classList.toggle('stealth', Boolean(label.stealth));
      role.label.classList.toggle('marine', Boolean(label.marine));
      role.label.classList.toggle('courier', Boolean(label.courier));
    }
    const note = s.notification;
    const showToast = Boolean(note && s.clock < note.until);
    show(role.toast, showToast);
    if (note) {
      const tone = toastTone(note);
      if (role.toast.dataset.tone !== tone) role.toast.dataset.tone = tone;
      const sig = note.until + '|' + note.title;
      if (showToast && sig !== lastToastSig) {
        lastToastSig = sig;
        pulseClass(role.toast, 'is-entering');
      }
      titleFor(role.toastKind, note.kind);
      titleFor(role.toastTitle, note.title);
      titleFor(role.toastBody, note.body);
    }
    const message = s.transmission;
    const showRadio = Boolean(message && s.clock < message.until);
    show(role.radio, showRadio);
    if (message) {
      const rSig = message.until + '|' + message.line;
      if (showRadio && rSig !== lastRadioSig) {
        lastRadioSig = rSig;
        pulseClass(role.radio, 'is-entering');
      }
      titleFor(role.radioPerson, message.who);
      titleFor(role.radioLine, message.line);
    }
    const boat = s.boat;
    const vehicle = boat ?? s.vehicle;
    show(role.driving, vehicle);
    role.prompt.classList.toggle('is-touch-duplicate', touch.update(s, action));
    if (vehicle) {
      titleFor(role.speed, Math.round(vehicle.speed * (boat ? 1.94384 : 3.6)).toString().padStart(boat ? 2 : 3, '0'));
      const topSpeed = boat ? boat.top : vehicle.model.top;
      role.speedFill.style.transform = 'scaleX(' + clamp(vehicle.speed / topSpeed, 0, 1).toFixed(3) + ')';
      titleFor(role.unit, boat ? '节' : 'KM/H');
      const reversing = vehicle.vx * Math.sin(vehicle.yaw) + vehicle.vz * Math.cos(vehicle.yaw) < -.5;
      titleFor(role.gear, boat ? (reversing ? '倒船' : '前进') : (reversing ? 'R' : 'D'));
      titleFor(role.model, boat ? boat.name : vehicle.model.name);
      titleFor(role.vehicleHelp, boat ? 'SPACE 减速' : 'SHIFT 氮气');
      show(role.nitroMeter, !boat);
      if (!boat) {
        role.nitro.style.transform = 'scaleX(' + vehicle.nitro + ')';
        role.nitroMeter.setAttribute('aria-valuenow', Math.round(vehicle.nitro * 100));
      }
      titleFor(role.station, s.station ? 'R ' + s.station : 'R 电台关闭');
    }
  }
  function showGraphicsRecovery(message, canRetry = false) {
    if (view !== 'game') return;
    titleFor(graphicsMessage, message);
    graphicsRetry.hidden = !canRetry;
    graphicsRecovery.hidden = false;
  }
  function queueGraphicsRecovery() {
    graphicsState = 'retry';
    last = 0;
    showGraphicsRecovery('正在以性能画质恢复画面…');
  }
  scene.addEventListener('webglcontextlost', event => {
    event.preventDefault();
    graphicsState = 'lost';
    last = 0;
    restoreControls();
    sim?.update(0, keys, false, 0);
    showGraphicsRecovery('画面已暂停，正在等待浏览器恢复图形连接…');
  });
  scene.addEventListener('webglcontextrestored', queueGraphicsRecovery);
  graphicsRetry.addEventListener('click', queueGraphicsRecovery);
  $('graphics-title').addEventListener('click', backToTitle);

  function loop(now) {
    requestAnimationFrame(loop);
    syncCursor();
    const elapsed = last ? Math.max(0, (now - last) / 1000) : 0;
    last = now;
    if (!sim || document.hidden || view !== 'game' || graphicsState === 'lost' || graphicsState === 'failed') return;
    try {
      if (graphicsState === 'retry') {
        sim.recoverGraphics();
        sim.repaint();
        graphicsState = 'ok';
        graphicsRecovery.hidden = true;
        resizePending = false;
        last = hudRefresh = radarRefresh = 0;
        return;
      }
      if (resizePending) {
        resizePending = false;
        touch.relayout();
        sim.resize();
        if (panel) sim.repaint();
        if (panel === 'map') drawMap(map, true);
      }
      const running = canControl();
      if (running) flushLook();
      sim.update(elapsed, keys, running);
      if (running && now >= hudRefresh) {
        hudRefresh = now + 65;
        drawHud();
      }
      if (running && now >= radarRefresh) {
        radarRefresh = now + 112;
        drawMap(radar, false);
      }
    } catch (error) {
      console.error(error);
      restoreControls();
      if (graphicsState === 'retry' || graphicsRetried) {
        graphicsState = 'failed';
        showGraphicsRecovery('画面已暂停。点击重试继续当前进度。', true);
      } else {
        graphicsRetried = true;
        queueGraphicsRecovery();
      }
    }
  }
  function nextFrame() {
    return new Promise(resolve => requestAnimationFrame(resolve));
  }
  async function start(mode, event) {
    if (booting || !languageScreen.hidden) return;
    const input = event?.pointerType;
    const onTouchScreen = input === 'touch' || touch.activatingByTouch || (input !== 'mouse' && mobilePointer.matches);
    mouseLook = !onTouchScreen && (input === 'mouse' || mousePointer.matches);
    activeLookDevice = onTouchScreen ? 'touch' : 'mouse';
    if (onTouchScreen) {
      setLandscape(true);
      if (!fullscreenActive()) toggleFullscreen();
    }
    if (panel) closePanel();
    booting = true;
    if (shownLookHints.has(activeLookDevice)) requestMouseLook();
    for (const button of launchButtons) button.disabled = true;
    status.hidden = false;
    titleFor(status, '正在加载白汐港…');
    try {
      await nextFrame();
      await nextFrame();
      if (graphicsState !== 'lost' && !sim) sim = await D.createSimulation(scene, progress, persist, nextFrame,
        stage => titleFor(status, stage));
      if (graphicsState === 'lost') {
        titleFor(status, '正在等待浏览器恢复图形连接，恢复后可重新进入。');
        return;
      }
      if (graphicsState !== 'ok') {
        sim.recoverGraphics();
        graphicsState = 'ok';
      }
      titleFor(status, '正在准备画面…');
      const graphicsFrame = async () => {
        await nextFrame();
        if (graphicsState !== 'ok') throw new Error('Graphics connection changed during loading.');
      };
      await graphicsFrame();
      sim.resize();
      await sim.start(mode, graphicsFrame);
      if (graphicsState !== 'ok') throw new Error('Graphics connection changed during loading.');
      if (panel) closePanel();
      enter();
    } catch (error) {
      if (graphicsState === 'lost' || graphicsState === 'retry') {
        titleFor(status, '图形连接已中断，恢复后可重新进入。');
      } else {
        console.error(error);
        if (sim) graphicsState = 'failed';
        titleFor(status, '画面启动中断。再次点击开始可重试。');
      }
    } finally {
      if (view === 'title') {
        releaseMouseLook();
        setLandscape(false);
      }
      for (const button of launchButtons) button.disabled = false;
      booting = false;
    }
  }
  function enter() {
    drawHud();
    drawMap(radar, false);
    graphicsState = 'ok';
    graphicsRetried = false;
    graphicsRecovery.hidden = true;
    resizePending = false;
    last = hudRefresh = radarRefresh = 0;
    view = 'game';
    title.hidden = true;
    hud.hidden = false;
    restoreControls();
    scene.focus({ preventScroll: true });
    status.hidden = true;
    const hint = $('look-hint');
    hint.hidden = shownLookHints.has(activeLookDevice);
    if (!hint.hidden) {
      shownLookHints.add(activeLookDevice);
      hintUntil = sim.state.clock + 13;
      titleFor($('look-hint-method'), activeLookDevice === 'touch' ? '滑动右屏环视' : '移动鼠标环视');
      $('look-hint-value').textContent = progress[lookFields[activeLookDevice]] + '%';
      hint.classList.toggle('for-touch', activeLookDevice === 'touch');
    }
  }
  function backToTitle() {
    closePanel();
    restoreControls();
    sim?.update(0, keys, false, 0);
    graphicsRecovery.hidden = true;
    view = 'title';
    releaseMouseLook();
    setLandscape(false);
    hud.hidden = true;
    title.hidden = false;
    persist();
    startButton.focus({ preventScroll: true });
  }
  const chapterNames = ['第一章', '第二章', '第三章', '第四章', '第五章'];
  function readDispatch(interaction) {
    const ending = interaction.kind === 'campaignEnd';
    const id = interaction.id;
    pendingDispatch = { kind: interaction.kind, id };
    shells.dispatch.classList.toggle('at-workshop', ending || id === 0);
    titleFor($('dispatch-chapter'), ending ? '主线收尾' : chapterNames[id]);
    titleFor($('dispatch-title'), ending ? '黎明交班' : JOBS[id].name);
    titleFor($('dispatch-copy'), ending ? '记录给我吧。第一班渡船靠岸了，今晚的班到这儿了。' : CAMPAIGN[id].briefing);
    titleFor($('dispatch-accept'), ending ? '交回记录' : '接受任务');
    $('dispatch-copy').scrollTop = 0;
    shells.dispatch.dataset.chapter = ending ? 'ending' : String(id + 1);
    const folio = shells.dispatch.querySelector('.dispatch-folio');
    if (folio) pulseClass(folio, 'is-entering');
    openPanel('dispatch');
  }
  $('dispatch-accept').addEventListener('click', () => {
    if (panel !== 'dispatch' || !pendingDispatch || graphicsState !== 'ok') return;
    const nearby = sim.context();
    const confirmed = nearby && nearby.kind === pendingDispatch.kind && nearby.id === pendingDispatch.id;
    closePanel();
    if (confirmed) sim.handleInteraction(nearby, true);
    drawHud();
    drawMap(radar, false);
    requestMouseLook();
  });
  function action(code) {
    if (!sim || !canControl()) return;
    switch (code) {
      case 'KeyE': {
        const nearby = sim.context();
        if (nearby?.kind === 'job' || nearby?.kind === 'campaignEnd') {
          readDispatch(nearby);
          return;
        }
        if (nearby && sim.handleInteraction(nearby) === 'workshop') {
          openPanel('workshop');
          return;
        }
        break;
      }
      case 'KeyM': openPanel('map'); return;
      case 'KeyC': flushLook(); sim.cycleCamera(); return;
      case 'KeyN': sim.switchTime(); break;
      case 'KeyR': sim.toggleStation(); break;
      case 'KeyQ': sim.toggleCrouch(); break;
      case 'KeyX': sim.switchWeather(); break;
    }
    drawHud();
  }
  addEventListener('keydown', event => {
    if (event.altKey || event.metaKey || event.ctrlKey) return;
    const code = event.code;
    if (!languageScreen.hidden) {
      if (code === 'Escape' && languageChosen) closeLanguagePicker();
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(code)) {
        event.preventDefault();
        const buttons = languageScreen.querySelectorAll('[data-language]');
        (document.activeElement === buttons[0] ? buttons[1] : buttons[0]).focus({ preventScroll: true });
      }
      return;
    }
    if (code === 'Escape') {
      if (event.repeat) return;
      if (panel === 'pause' && !$('look-controls').hidden) { showLookDetails(false); $('look-open').focus(); }
      else if (panel) closePanel();
      else if (view === 'game') openPanel('pause');
      else if (!booting) openLanguagePicker();
      return;
    }
    if (code === 'F2' && (canControl() || panel === 'pause')) {
      event.preventDefault();
      if (!event.repeat) openLookSettings();
      return;
    }
    if (panel) {
      if (code === 'Tab') {
        const items = [...shells[panel].querySelectorAll('button:enabled, select:enabled, input:enabled, summary, a[href], [tabindex="0"]')].filter(el => el.getClientRects().length);
        const index = items.indexOf(document.activeElement);
        if (items.length && (event.shiftKey ? index <= 0 : index === items.length - 1)) {
          event.preventDefault();
          items[event.shiftKey ? items.length - 1 : 0].focus();
        }
      }
      if (panel === 'map' && code === 'KeyM' && !event.repeat) closePanel();
      return;
    }
    if (view === 'title' && !booting && (code === 'ArrowDown' || code === 'ArrowUp') && launchButtons.includes(document.activeElement)) {
      event.preventDefault();
      const index = launchButtons.indexOf(document.activeElement);
      launchButtons[(index + (code === 'ArrowDown' ? 1 : -1) + launchButtons.length) % launchButtons.length].focus({ preventScroll: true });
      return;
    }
    if (!canControl()) return;
    if (holdCodes.has(code)) {
      event.preventDefault();
      keyboard.add(code);
    } else if (!event.repeat && ['KeyE', 'KeyM', 'KeyC', 'KeyR', 'KeyN', 'KeyQ', 'KeyX'].includes(code)) {
      event.preventDefault();
      action(code);
    }
  });
  addEventListener('keyup', event => keyboard.delete(event.code));
  addEventListener('blur', restoreControls);
  function resetVisibilityClock() {
    last = 0;
    resizePending = true;
    restoreControls();
    if (document.hidden) releaseMouseLook();
    sim?.update(0, keys, false, 0);
  }
  document.addEventListener('visibilitychange', resetVisibilityClock);
  addEventListener('pagehide', resetVisibilityClock);
  addEventListener('pageshow', resetVisibilityClock);
  addEventListener('resize', queueResize);
  screen.orientation?.addEventListener?.('change', queueResize);
  window.visualViewport?.addEventListener('resize', queueResize);
  if (window.ResizeObserver) new ResizeObserver(queueResize).observe(game);
  document.addEventListener('fullscreenchange', fullscreenChanged);
  document.addEventListener('webkitfullscreenchange', fullscreenChanged);
  appDisplay.addEventListener('change', fullscreenChanged);
  portraitViewport.addEventListener('change', updateLandscapeLayout);
  fullscreenButton.addEventListener('click', toggleFullscreen);
  document.addEventListener('pointermove', lookWithMouse);
  scene.addEventListener('pointerleave', () => { mousePosition = null; });
  document.addEventListener('mousemove', event => {
    if (document.pointerLockElement !== scene || !canControl() || pointer || event.sourceCapabilities?.firesTouchEvents) return;
    queueMouseLook(-event.movementX, -event.movementY);
  });
  document.addEventListener('pointerlockchange', () => {
    mousePosition = null;
    const locked = document.pointerLockElement === scene;
    if (locked && ((!booting && view === 'title') || panel)) releaseMouseLook();
  });
  scene.tabIndex = -1;
  scene.addEventListener('pointerdown', event => {
    if (event.pointerType !== 'mouse' || event.button !== 0 || pointer || !canControl()) return;
    mouseLook = true;
    $('look-hint').hidden = true;
    requestMouseLook();
  });
  const cameraDrag = D.trackDrag(game, scene, type => type !== 'mouse' && canControl(), point => {
    mousePosition = null;
    activeLookDevice = 'touch';
    const gain = progress.touchSensitivity / 100;
    pointer = { ...point,
      yawScale: 4.45 * gain / Math.max(1, game.clientWidth),
      pitchScale: 1.48 * gain / Math.max(1, game.clientHeight) };
    sim.holdCamera(true);
  }, ({ x, y }) => {
    lookYaw += (pointer.x - x) * pointer.yawScale;
    lookPitch += (pointer.y - y) * pointer.pitchScale;
    pointer.x = x;
    pointer.y = y;
  }, () => {
    pointer = null;
    sim.holdCamera(false);
  });
  for (const button of document.querySelectorAll('[data-open]')) button.addEventListener('click', () => openPanel(button.dataset.open));
  for (const button of document.querySelectorAll('[data-close]')) button.addEventListener('click', () => {
    closePanel();
    if (canControl()) requestMouseLook();
  });
  for (const button of document.querySelectorAll('[data-action]')) {
    button.addEventListener('click', () => {
      closePanel();
      action(button.dataset.action);
    });
  }
  startButton.addEventListener('click', event => start('story', event));
  roamButton.addEventListener('click', event => start('roam', event));
  rainButton.addEventListener('click', event => start('rain', event));
  harborButton.addEventListener('click', event => start('harbor', event));
  $('tune-buy').addEventListener('click', () => { if (sim.tuneEngine()) renderWorkshop(); });
  $('map-button').addEventListener('click', () => openPanel('map'));
  $('map-market').addEventListener('click', () => {
    if (!sim.navigateMarket()) return;
    closePanel();
    drawHud();
    drawMap(radar, false);
  });
  $('back-to-title').addEventListener('click', backToTitle);
  $('reset-position').addEventListener('click', () => {
    sim.resetPosition();
    closePanel();
  });
  $('retry-job').addEventListener('click', () => {
    if (!sim.retryJob()) return;
    closePanel();
    drawHud();
    drawMap(radar, false);
  });
  $('cancel-order').addEventListener('click', () => {
    if (!sim.cancelOrder()) return;
    closePanel();
    drawHud();
    drawMap(radar, false);
  });
  for (const id of ['title-audio', 'pause-audio']) {
    $(id).addEventListener('click', () => {
      progress.sound = !progress.sound;
      sim?.setSound(progress.sound);
      persist();
      showSound();
    });
  }
  $('motion-button').addEventListener('click', () => {
    progress.reduceMotion = !progress.reduceMotion;
    persist();
    showSound();
  });
  const graphicsSetting = $('graphics-setting');
  graphicsSetting.value = progress.graphics;
  graphicsSetting.addEventListener('change', () => {
    if (!GRAPHICS.includes(graphicsSetting.value)) return;
    progress.graphics = graphicsSetting.value;
    persist();
  });
  const touchSetting = $('touch-setting');
  touchSetting.value = progress.touch;
  touchSetting.addEventListener('change', () => {
    if (!TOUCH_SETTINGS.includes(touchSetting.value)) return;
    progress.touch = touchSetting.value;
    touch.setSetting(progress.touch);
    persist();
  });
  const lookSetting = $('look-setting');
  const lookGainSlider = $('look-gain');
  function renderLookSettings() {
    const value = progress[lookFields[settingsDevice]];
    lookSetting.value = Object.keys(LOOK_GAINS).find(key => LOOK_GAINS[key] === value) || 'custom';
    $('look-input-device').value = settingsDevice;
    lookGainSlider.value = String(value);
    lookGainSlider.setAttribute('aria-valuetext', value + '%');
    lookGainSlider.style.setProperty('--gain-fill', ((value - 30) / 150 * 100) + '%');
    $('look-gain-value').textContent = value + '%';
  }
  function showLookDetails(open) {
    shells.pause.classList.toggle('tuning', open);
    $('look-controls').hidden = !open;
    shells.pause.querySelector('.pause-body').hidden = open;
    titleFor($('pause-title'), open ? '视角灵敏度' : '已暂停');
    renderLookSettings();
    if (open) lookGainSlider.focus({ preventScroll: true });
  }
  function openLookSettings() {
    if (!sim || view !== 'game') return;
    $('look-hint').hidden = true;
    if (panel !== 'pause') openPanel('pause');
    showLookDetails(true);
  }
  function setLookPercent(value) {
    if (!Number.isFinite(value)) return;
    progress[lookFields[settingsDevice]] = clamp(Math.round(value), 30, 180);
    renderLookSettings();
    if (lookSetting.value !== 'custom') progress.lookGain = lookSetting.value;
  }
  lookSetting.addEventListener('change', () => {
    if (!Object.hasOwn(LOOK_GAINS, lookSetting.value)) return;
    setLookPercent(LOOK_GAINS[lookSetting.value]);
    persist();
  });
  $('look-input-device').addEventListener('change', event => {
    if (Object.hasOwn(lookFields,event.target.value)) settingsDevice = event.target.value;
    renderLookSettings();
  });
  lookGainSlider.addEventListener('input', () => setLookPercent(lookGainSlider.valueAsNumber));
  lookGainSlider.addEventListener('change', persist);
  $('look-hint-adjust').addEventListener('click', openLookSettings);
  $('look-hint-dismiss').addEventListener('click', () => { $('look-hint').hidden = true; scene.focus({ preventScroll: true }); });
  $('look-open').addEventListener('click', openLookSettings);
  $('look-settings-back').addEventListener('click', () => { showLookDetails(false); $('look-open').focus(); });
  $('look-test-resume').addEventListener('click', () => { closePanel(); scene.focus({ preventScroll: true }); requestMouseLook(); });
  $('look-reset').addEventListener('click', () => { setLookPercent(100); persist(); });
  renderLookSettings();
  function applyLanguage(code) {
    language.select(code);
    languageSetting.value = language.current;
    updateCampaignTitle();
    showSound();
    showFullscreenControl();
    if (sim && view === 'game') {
      drawHud();
      drawMap(radar, false);
    }
  }
  function openLanguagePicker() {
    if (booting) return;
    title.hidden = true;
    languageScreen.hidden = false;
    const preferred = language.preferred();
    for (const choice of languageScreen.querySelectorAll('[data-language]')) {
      const selected = choice.dataset.language === preferred;
      choice.setAttribute('aria-current', selected ? 'true' : 'false');
      if (selected) choice.focus({ preventScroll: true });
    }
  }
  function closeLanguagePicker() {
    languageScreen.hidden = true;
    title.hidden = false;
    startButton.focus({ preventScroll: true });
  }
  function confirmLanguage(code) {
    applyLanguage(code);
    languageChosen = true;
    languageScreen.removeAttribute('aria-busy');
    delete languageScreen.dataset.pendingLanguage;
    closeLanguagePicker();
  }
  for (const choice of languageScreen.querySelectorAll('[data-language]')) {
    choice.addEventListener('click', () => confirmLanguage(choice.dataset.language));
  }
  $('title-language').addEventListener('click', openLanguagePicker);
  languageSetting.addEventListener('change', () => applyLanguage(languageSetting.value));
  updateCampaignTitle();
  showSound();
  showFullscreenControl();
  const earlyChoice = languageScreen.dataset.pendingLanguage;
  if (earlyChoice === 'zh-CN' || earlyChoice === 'en') confirmLanguage(earlyChoice);
  else openLanguagePicker();
  requestAnimationFrame(loop);
})();
