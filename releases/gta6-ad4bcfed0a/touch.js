(() => {
  'use strict';
  const D = window.Tideline;
  const lang = D.language;
  const releaseEvents = ['pointerup', 'pointercancel', 'lostpointercapture'];
  const prompts = {
    job: '接单', enter: '上车', exit: '下车', boardBoat: '上船', leaveBoat: '下船', workshop: '修车铺',
    tape: '拾取', terminal: '切换线路', cache: '取录音带', recoverBuoy: '打捞', restoreBeacon: '接电源', marineHandover: '回报',
    campaignEnd: '交班', courierPickup: '取件', courierDrop: '交付',
  };

  function inputPoint(root, event) {
    return root.classList.contains('rotate-landscape')
      ? { x: event.clientY, y: -event.clientX }
      : { x: event.clientX, y: event.clientY };
  }
  function inputBounds(root, element) {
    const rect = element.getBoundingClientRect();
    if (!root.classList.contains('rotate-landscape')) return rect;
    return { left: rect.top, right: rect.bottom, top: -rect.right, bottom: -rect.left, width: rect.height, height: rect.width };
  }

  // Each surface owns one finger until that exact contact ends. Some WebViews
  // deliver only Touch Events, others only Pointer Events, and some deliver both.
  function trackDrag(root, surface, accepts, begin, move, end) {
    let held = null;
    const native = { capture: true, passive: true };
    function claim(source, id, type, event) {
      if (!accepts(type)) return false;
      const point = inputPoint(root, event);
      if (!held) {
        if (begin(point) === false) return false;
        held = { type, origin: point, point, stamp: -Infinity, fromPointer: false, pointerId: null, touchId: null };
      } else if (held.type !== type || held[source] != null ||
          Math.hypot(point.x - held.origin.x, point.y - held.origin.y) > 8) return false;
      held[source] = id;
      return true;
    }
    function reset() {
      if (!held) return;
      const { pointerId, type } = held;
      held = null;
      end?.();
      if (type !== 'touch' && pointerId != null && surface.hasPointerCapture?.(pointerId)) surface.releasePointerCapture(pointerId);
    }
    // Browsers can dispatch both streams for one finger, or defer touchmove
    // until it has crossed a gesture threshold. Use the first fresh position.
    function advance(event, stamp, fromPointer) {
      if (stamp < held.stamp || (stamp === held.stamp && held.fromPointer && !fromPointer)) return;
      const point = inputPoint(root, event);
      held.stamp = stamp;
      held.fromPointer = fromPointer;
      if (held.point.x === point.x && held.point.y === point.y) return;
      held.point = point;
      move(point);
    }
    surface.addEventListener('pointerdown', e => {
      if (e.button !== 0 || !claim('pointerId', e.pointerId, e.pointerType, e)) return;
      e.preventDefault();
      if (e.pointerType !== 'touch') {
        try { surface.setPointerCapture?.(e.pointerId); } catch {}
      }
    });
    if (move) document.addEventListener('pointermove', e => {
      if (held?.pointerId === e.pointerId) advance(e, e.timeStamp, true);
    }, true);
    function endPointer(e) {
      if (held?.pointerId !== e.pointerId) return;
      if (held.touchId == null) reset();
      else held.pointerId = null;
    }
    for (const type of ['pointerup', 'pointercancel']) document.addEventListener(type, endPointer, true);
    surface.addEventListener('lostpointercapture', e => {
      if (held?.type !== 'touch' && e.target === surface) endPointer(e);
    });
    root.addEventListener('touchstart', e => {
      if (held?.touchId != null || !accepts('touch')) return;
      for (let i = 0; i < e.changedTouches.length; i++) {
        const finger = e.changedTouches[i];
        if (surface.contains(finger.target || e.target) && claim('touchId', finger.identifier, 'touch', finger)) break;
      }
    }, native);
    function changedFinger(e) {
      if (held?.touchId == null) return null;
      for (let i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === held.touchId) return e.changedTouches[i];
      }
      return null;
    }
    if (move) document.addEventListener('touchmove', e => {
      const finger = changedFinger(e);
      if (finger) advance(finger, e.timeStamp, false);
    }, native);
    for (const type of ['touchend', 'touchcancel']) document.addEventListener(type, e => {
      if (changedFinger(e) || (type === 'touchcancel' && held?.type === 'touch' && !e.changedTouches.length && !e.touches.length)) reset();
    }, native);
    return { reset };
  }

  // Cancel the start of a native gesture on controls before the browser
  // interprets a held icon or its caption as selectable text.
  function protectGameTouches(root) {
    const taps = new Map();
    const editable = 'input, textarea, select, option, [contenteditable]:not([contenteditable="false"])';
    let forwarding = false, lastTap = null;
    const elementFor = node => node?.nodeType === 1 ? node : node?.parentElement;
    function protectedElement(node) {
      const el = elementFor(node);
      return el && root.contains(el) && !el.closest(editable) && !el.closest('label')?.control;
    }
    function scrollParent(el) {
      for (let p = el.parentElement; p && p !== root; p = p.parentElement) {
        if (p.scrollHeight > p.clientHeight + 1 && /auto|scroll/.test(getComputedStyle(p).overflowY)) return p;
      }
      return null;
    }
    const nativeTouch = { capture: true, passive: false };
    function blockControlGesture(event) {
      const target = elementFor(event.target);
      if (!protectedElement(target) || !target.closest('#scene, #hud, button, a[href], summary')) return null;
      if (event.cancelable) event.preventDefault();
      return target;
    }
    root.addEventListener('touchstart', event => {
      blockControlGesture(event);
      for (let i = 0; i < event.changedTouches.length; i++) {
        const finger = event.changedTouches[i];
        const button = elementFor(finger.target || event.target)?.closest('button, a[href], summary');
        if (!button || !protectedElement(button) || button.closest('#touch') || button.matches(':disabled')) continue;
        const point = inputPoint(root, finger), scroll = scrollParent(button);
        taps.set(finger.identifier, { button, point, time: performance.now(), scroll, top: scroll?.scrollTop, dragged: false });
      }
    }, nativeTouch);
    root.addEventListener('touchmove', event => {
      if (!taps.size) return;
      for (let i = 0; i < event.changedTouches.length; i++) {
        const finger = event.changedTouches[i];
        const tap = taps.get(finger.identifier);
        if (!tap) continue;
        const point = inputPoint(root, finger);
        const dx = point.x - tap.point.x, dy = point.y - tap.point.y;
        if (Math.hypot(dx, dy) > 10) tap.dragged = true;
        if (tap.dragged && tap.scroll) tap.scroll.scrollTop = tap.top - dy;
      }
    }, { capture: true, passive: true });
    root.addEventListener('touchend', event => {
      blockControlGesture(event);
      for (let i = 0; i < event.changedTouches.length; i++) {
        const finger = event.changedTouches[i];
        const tap = taps.get(finger.identifier);
        if (!tap) continue;
        taps.delete(finger.identifier);
        if (event.cancelable) event.preventDefault();
        lastTap = { button: tap.button, time: performance.now() };
        const hit = document.elementFromPoint(finger.clientX, finger.clientY);
        if (tap.dragged || performance.now() - tap.time > 560 || !tap.button.contains(hit)) continue;
        forwarding = true;
        try { tap.button.click(); } finally { forwarding = false; }
      }
    }, nativeTouch);
    root.addEventListener('touchcancel', event => {
      for (let i = 0; i < event.changedTouches.length; i++) taps.delete(event.changedTouches[i].identifier);
    }, { capture: true, passive: true });
    root.addEventListener('click', event => {
      if (!event.isTrusted || !event.detail || !lastTap || performance.now() - lastTap.time > 700) return;
      if (event.pointerType === 'mouse' && !event.sourceCapabilities?.firesTouchEvents) return;
      if (lastTap.button.contains(elementFor(event.target))) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    }, true);
    for (const type of ['contextmenu', 'selectstart', 'dragstart', 'copy']) {
      document.addEventListener(type, event => {
        if (protectedElement(event.target)) event.preventDefault();
      }, true);
    }
    document.addEventListener('selectionchange', () => {
      const selection = document.getSelection();
      if (selection && !selection.isCollapsed && protectedElement(selection.anchorNode) && protectedElement(selection.focusNode)) selection.removeAllRanges();
    });
    return { get forwarding() { return forwarding; }, reset() { taps.clear(); } };
  }

  function makeTouchControls(root, deck, initialSetting, canControl, action) {
    const gestures = protectGameTouches(root);
    const find = id => deck.querySelector('#touch-' + id);
    const zone = find('move');
    const stick = find('stick');
    const knob = stick.querySelector('.touch-stick-knob');
    const stickLabel = find('stick-label');
    const steering = find('steering');
    const pedals = find('pedals');
    const boost = find('boost');
    const brake = find('brake');
    const crouch = find('crouch');
    const gas = find('gas');
    const reverse = find('reverse');
    const reverseLabel = find('reverse-label');
    const reverseHint = find('reverse-hint');
    const interact = find('enter');
    const labelFor = button => button.querySelector('[data-touch-label]') || button;
    const brakeLabel = labelFor(brake), gasLabel = labelFor(gas);
    const crouchLabel = labelFor(crouch), interactLabel = labelFor(interact);
    const coarse = matchMedia('(pointer: coarse)');
    const compact = matchMedia('(max-width: 1100px)');
    const pointers = new Map();
    const counts = new Map();
    let setting = initialSetting;
    let active = false;
    let touched = false;
    let mode = 'walk';
    let bowing = false;
    let thumb = null;
    let x = 0, y = 0;

    function updateRun() {
      const running = Boolean(thumb?.run && !bowing);
      stick.classList.toggle('is-running', running);
      const label = running ? '奔跑' : '移动';
      lang.text(stickLabel, label);
    }
    function stopStick() {
      thumb = null;
      x = y = 0;
      stick.style.removeProperty('--stick-left');
      stick.style.removeProperty('--stick-bottom');
      knob.style.removeProperty('transform');
      stick.classList.remove('is-active');
      updateRun();
    }

    function assignButton(pointer, next) {
      const previous = pointer.button;
      if (previous === next) return;
      if (previous) {
        const code = previous.dataset.touchHold;
        const left = counts.get(code) - 1;
        if (left) counts.set(code, left);
        else {
          counts.delete(code);
          previous.classList.remove('is-down');
        }
      }
      if (next) {
        const code = next.dataset.touchHold;
        counts.set(code, (counts.get(code) ?? 0) + 1);
        next.classList.add('is-down');
      }
      pointer.button = next;
    }
    function releaseButton(id) {
      const pointer = pointers.get(id);
      if (!pointer) return;
      pointers.delete(id);
      assignButton(pointer, null);
      if (typeof id === 'number' && pointer.group.hasPointerCapture?.(id)) pointer.group.releasePointerCapture(id);
    }
    function reset() {
      stickDrag.reset();
      for (const id of pointers.keys()) releaseButton(id);
      gestures.reset();
    }

    function updateEnabled() {
      const enabled = setting === 'on' || (setting === 'auto' && (touched || coarse.matches || (navigator.maxTouchPoints > 0 && compact.matches)));
      if (!enabled && active) reset();
      active = enabled;
      root.classList.toggle('touch-enabled', enabled);
      deck.hidden = !enabled;
    }
    coarse.addEventListener('change', updateEnabled);
    compact.addEventListener('change', updateEnabled);
    function noticeTouch() {
      if (!touched) { touched = true; updateEnabled(); }
    }
    root.addEventListener('pointerdown', event => {
      if (event.pointerType === 'touch') noticeTouch();
    }, true);
    root.addEventListener('touchstart', noticeTouch, { capture: true, passive: true, once: true });

    function moveStick(point) {
      if (point.x === thumb.lastX && point.y === thumb.lastY) return;
      thumb.lastX = point.x;
      thumb.lastY = point.y;
      const horizontal = (point.x - thumb.cx) / thumb.reach;
      const vertical = (thumb.cy - point.y) / thumb.reach;
      const length = Math.hypot(horizontal, vertical);
      if (length > .08) {
        const response = Math.min(1, (length - .08) / .81) / length;
        x = horizontal * response;
        y = vertical * response;
      } else {
        x = y = 0;
      }
      const run = length >= (thumb.run ? .99 : 1.23);
      if (run !== thumb.run) {
        thumb.run = run;
        updateRun();
      }
      const knobScale = thumb.travel / Math.max(1, length);
      knob.style.transform = 'translate3d(' + (horizontal * knobScale).toFixed(1) + 'px,' + (-vertical * knobScale).toFixed(1) + 'px,0)';
    }
    function beginStick(point) {
      const disc = inputBounds(root, stick);
      const radius = Math.min(disc.width, disc.height) / 2;
      if (!(radius > 0)) return false;
      let cx = disc.left + disc.width / 2, cy = disc.top + disc.height / 2;
      // The printed pad has a fixed center. A separate touch on empty ground
      // can spawn a floating pad, constrained to the left-hand control area.
      if (Math.hypot(point.x - cx, point.y - cy) > radius + 7) {
        const area = inputBounds(root, zone);
        const visualX = D.clamp(point.x, area.left + radius, area.right - radius);
        const visualY = D.clamp(point.y, area.top + radius, area.bottom - radius);
        stick.style.setProperty('--stick-left', (visualX - area.left - radius).toFixed(2) + 'px');
        stick.style.setProperty('--stick-bottom', (area.bottom - visualY - radius).toFixed(2) + 'px');
        cx = point.x;
        cy = point.y;
      }
      thumb = { cx, cy, reach: radius * .82, travel: radius * .59, run: false };
      stick.classList.add('is-active');
      moveStick(point);
    }
    const stickDrag = trackDrag(root, zone, () => active && mode === 'walk' && !zone.hidden && canControl(),
      beginStick, moveStick, stopStick);

    function measureGroup(pointer) {
      pointer.bounds = inputBounds(root, pointer.group);
      pointer.choices = [...pointer.group.querySelectorAll('[data-touch-hold]')].map(button => ({ button, rect: inputBounds(root, button) }));
    }
    function slideChoice(pointer, event) {
      if (!pointer.bounds) measureGroup(pointer);
      const { bounds, choices } = pointer;
      const { x, y } = inputPoint(root, event);
      if (x < bounds.left - 14 || x > bounds.right + 14 || y < bounds.top - 11 || y > bounds.bottom + 11) return null;
      let best = null, distance = Infinity;
      for (const { button, rect } of choices) {
        const dx = Math.max(0, rect.left - x, x - rect.right), dy = Math.max(0, rect.top - y, y - rect.bottom);
        const d = dx * dx + dy * dy;
        if (d < distance || (d === distance && button === pointer.button)) { distance = d; best = button; }
      }
      return best;
    }
    function pressGroup(group, target, event, id, type) {
      const slide = group.hasAttribute('data-touch-slide');
      const from = target.closest('[data-touch-hold]');
      if ((!from && !slide) || pointers.has(id)) return false;
      const pointer = { group, button: null, type, startX: event.clientX, startY: event.clientY };
      if (slide) measureGroup(pointer);
      pointers.set(id, pointer);
      assignButton(pointer, from ?? slideChoice(pointer, event));
      return true;
    }
    function matchingPress(group, type, event) {
      for (const [id, press] of pointers) {
        if (press.group === group && press.type === type &&
            Math.hypot(event.clientX - press.startX, event.clientY - press.startY) <= 5) return id;
      }
      return null;
    }
    for (const group of deck.querySelectorAll('[data-touch-group]')) {
      const slide = group.hasAttribute('data-touch-slide');
      group.addEventListener('pointerdown', event => {
        if (!active || !canControl() || event.button !== 0) return;
        if (event.pointerType === 'touch' && matchingPress(group, 'native', event) != null) return;
        if (!pressGroup(group, event.target, event, event.pointerId, event.pointerType)) return;
        event.preventDefault();
        try { group.setPointerCapture?.(event.pointerId); } catch {}
      });
      if (slide) group.addEventListener('pointermove', event => {
        const pointer = pointers.get(event.pointerId);
        if (pointer?.group === group) assignButton(pointer, slideChoice(pointer, event));
      });
      for (const type of releaseEvents) group.addEventListener(type, event => {
        if (pointers.get(event.pointerId)?.group === group && (type !== 'lostpointercapture' || event.target === group)) releaseButton(event.pointerId);
      });
    }
    const nativeHold = { capture: true, passive: true };
    deck.addEventListener('touchstart', event => {
      if (!active || !canControl()) return;
      for (let i = 0; i < event.changedTouches.length; i++) {
        const finger = event.changedTouches[i];
        const target = finger.target || event.target, group = target.closest('[data-touch-group]');
        if (!group) continue;
        const pointerId = matchingPress(group, 'touch', finger);
        // Once the native stream arrives it owns sliding and release for this finger.
        if (pointerId != null) releaseButton(pointerId);
        pressGroup(group, target, finger, String(finger.identifier), 'native');
      }
    }, nativeHold);
    document.addEventListener('touchmove', event => {
      for (let i = 0; i < event.changedTouches.length; i++) {
        const finger = event.changedTouches[i];
        const press = pointers.get(String(finger.identifier));
        if (press?.group.hasAttribute('data-touch-slide')) assignButton(press, slideChoice(press, finger));
      }
    }, nativeHold);
    for (const type of ['touchend', 'touchcancel']) document.addEventListener(type, event => {
      for (let i = 0; i < event.changedTouches.length; i++) releaseButton(String(event.changedTouches[i].identifier));
      if (type === 'touchcancel' && !event.changedTouches.length && !event.touches.length) {
        for (const [id, press] of pointers) if (press.type === 'native') releaseButton(id);
      }
    }, nativeHold);

    for (const button of deck.querySelectorAll('[data-touch-action]')) {
      let lastTouch = -Infinity;
      function activate() {
        if (active && canControl() && !button.hidden) action(button.dataset.touchAction);
      }
      trackDrag(root, button, type => type !== 'mouse' && active && canControl() && !button.hidden, () => {
        lastTouch = performance.now();
        activate();
      });
      button.addEventListener('click', event => {
        if (event.detail > 0 && performance.now() - lastTouch < 800) return;
        activate();
      });
    }
    function update(state, context) {
      const next = state.boat ? 'boat' : state.vehicle ? 'car' : 'walk';
      if (next !== mode) {
        reset();
        mode = next;
        deck.dataset.mode = mode;
        deck.parentElement.dataset.touchMode = mode;
        const walking = mode === 'walk';
        const sailing = mode === 'boat';
        zone.hidden = !walking;
        steering.hidden = pedals.hidden = walking;
        boost.hidden = mode !== 'car';
        crouch.hidden = !walking;
        brake.hidden = walking;
        const brakeName = sailing ? '制动' : '手刹';
        lang.text(brakeLabel, brakeName);
        lang.attr(brake, 'aria-label', brakeName);
        lang.text(reverseLabel, sailing ? '倒船' : '刹车');
        reverseHint.hidden = sailing;
        lang.attr(reverse, 'aria-label', sailing ? '倒船' : '刹车或倒车');
        const gasName = sailing ? '推进' : '油门';
        lang.text(gasLabel, gasName);
        lang.attr(gas, 'aria-label', gasName);
      }
      if (bowing !== state.player.crouching) {
        bowing = state.player.crouching;
        const name = bowing ? '起身' : '蹲行';
        lang.text(crouchLabel, name);
        lang.attr(crouch, 'aria-label', name);
        crouch.setAttribute('aria-pressed', String(bowing));
        updateRun();
      }
      const short = context && prompts[context.kind];
      interact.hidden = !short;
      if (short) {
        lang.text(interactLabel, short);
        lang.attr(interact, 'aria-label', context.label);
      }
      brake.classList.toggle('is-prompted', context?.kind === 'brakeBoat');
      return Boolean(short);
    }
    updateEnabled();
    return {
      get x() { return mode === 'walk' ? x : Number(counts.has('right')) - Number(counts.has('left')); },
      get y() { return y; },
      has(code) {
        if (code === 'ShiftLeft' && mode === 'walk') return Boolean(thumb?.run && !bowing);
        if (code === 'KeyW' && mode !== 'walk') {
          return counts.has('KeyW') || counts.has('ShiftLeft');
        }
        return counts.has(code);
      },
      reset, update,
      get activatingByTouch() { return gestures.forwarding; },
      relayout() { for (const pointer of pointers.values()) pointer.bounds = null; },
      setSetting(value) { setting = value; updateEnabled(); },
    };
  }

  Object.assign(D, { makeTouchControls, inputPoint, trackDrag });
})();
