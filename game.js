/* global spine */
// Replays the game's own interaction layer: AnimatorController graphs + InteractionMeter + touch zones.
(() => {
  'use strict';

  // Unity RectTransform units map 1:1 onto Spine pixels for these prefabs. Each pose's hot-zone parent sits at a
  // different offset from its skeleton origin, so the pairs below were fitted by anchoring the head zone onto the
  // Head bone of the same pose (PoseA has one body zone, anchored onto its chest bone).
  const ZONE_OFFSET = {
    PoseA: [-229, 919],
    PoseB: [-233, 1062],
    PoseC: [-182, 1311],
    PoseD: [-340, 755]
  };

  const MOOD_LABELS = ['默认', '无聊', '开心', '害羞'];
  const INFERRED = '推断';

  class GameMode {
    constructor(hooks) {
      this.hooks = hooks;
      this.config = null;
      this.graph = null;
      this.animator = null;
      this.active = false;
      this.poseId = null;
      this.log = [];
      this.meter = { points: 0, lastAdd: 0, nextDecay: 0, decayed: false };
      this.inPhase = false;
      this.lastInput = 0;
      this.auto = { on: false, next: 0, step: '未开始', index: 0, mood: 0, round: 0, beat: 0.4 };
      this.zoneEls = [];
      this.timers = { meter: 0, layers: 0 };
      this.dom = {};
    }

    /* ---------- data ---------- */

    async loadConfig() {
      if (this.config) return this.config;
      const response = await fetch('data/game-config.json');
      if (!response.ok) throw new Error('读取游戏配置失败');
      this.config = await response.json();
      return this.config;
    }

    async onModelLoaded(poseId) {
      this.destroyAnimator();
      this.poseId = poseId;
      await this.loadConfig();
      const pose = this.config.poses[poseId];
      if (!pose) {
        this.note(`办公桌场景没有互动状态机，仅可浏览动画。`);
        this.renderShell();
        return;
      }
      const response = await fetch(`data/animator/${poseId}.json`);
      if (!response.ok) { this.note('状态机数据缺失'); return; }
      this.graph = await response.json();
      this.pose = pose;
      this.meter = { points: 0, lastAdd: 0, nextDecay: 0, decayed: false };
      this.inPhase = false;
      this.auto.index = 0;
      this.auto.round = 0;
      this.auto.next = performance.now() / 1000 + 0.6;
      this.buildAnimator();
      this.renderShell();
      this.renderParams();
      this.renderZones();
    }

    buildAnimator() {
      const ctx = this.hooks.getContext();
      if (!ctx) return;
      this.animator = new window.SpineAnimator(this.graph, {
        animState: ctx.animState,
        skeleton: ctx.skeleton,
        onEvent: (type, detail) => this.onAnimatorEvent(type, detail)
      });
      this.animator.speed = this.hooks.getSpeed();
      if (this.active) this.hooks.setDriven(true);
      this.logEvent('info', `载入 ${this.graph.controller}：${this.graph.layers.length} 层 / ${this.graph.stateCount} 状态`);
    }

    canDrive() { return !!this.animator; }

    destroyAnimator() {
      this.animator = null;
      this.graph = null;
      this.pose = null;
      this.zoneEls = [];
    }

    onAnimatorEvent(type, detail) {
      if (type === 'transition') {
        this.logEvent('state', `${detail.layer}：${detail.from || '入口'} → ${detail.to}${detail.animation ? ` · ${detail.animation}` : ''}`);
        if (detail.layer === this.graph.layers[0].name && detail.to === 'Default_Idle') this.inPhase = false;
      } else if (type === 'unavailable' && detail.animation) {
        this.logEvent('warn', `${detail.animation} 属于独立特效骨骼，此模型无该动作`);
      } else if (type === 'missingParam') {
        this.logEvent('warn', `参数 ${detail.parameter} 不在该状态机中`);
      } else if (type === 'missingAnimation') {
        this.logEvent('warn', `动作缺失：${detail.animation}`);
      }
    }

    /* ---------- activation ---------- */

    setActive(active) {
      if (active && !this.animator) return;
      this.active = active;
      if (active && this.animator) {
        this.hooks.setDriven(true);
        this.lastInput = performance.now() / 1000;
        this.meter.lastAdd = this.lastInput;
        this.meter.nextDecay = this.lastInput + (this.pose.interaction.decayCooldown || 0);
        this.logEvent('info', '游戏模式：交互输入已接管');
      } else if (this.animator) {
        this.hooks.setDriven(false);
        this.auto.on = false;
        this.auto.round = 0;
        this.inPhase = false;
        this.meter = { points: 0, lastAdd: 0, nextDecay: 0, decayed: false };
        this.logEvent('info', '已切回浏览模式');
      }
      this.renderZones();
      this.renderShell();
    }

    /* ---------- per-frame ---------- */

    update(dt, nowSeconds) {
      if (!this.active || !this.animator) return;
      this.animator.update(dt);
      if (this.auto.on) this.tickAuto(nowSeconds);
      this.tickMeter(nowSeconds);
      this.tickIdle(nowSeconds);
      this.renderHotspots();
      this.timers.layers += dt;
      if (this.timers.layers > 0.2) { this.timers.layers = 0; this.renderLayers(); this.renderMeter(); }
    }

    tickMeter(now) {
      const config = this.pose.interaction;
      if (!this.pose.enableMeter || !config || !config.maxPoints) return;
      const decayAmount = config.decayAmount || 0;
      const interval = config.decayInterval || 1;
      if (this.meter.points <= 0) return;
      if (now < this.meter.nextDecay) return;
      const steps = Math.floor((now - this.meter.nextDecay) / interval) + 1;
      this.meter.points = Math.max(0, this.meter.points - steps * decayAmount);
      this.meter.nextDecay = now + interval;
      this.meter.decayed = true;
      if (this.meter.points <= 0) this.fireReset('互动值归零');
    }

    tickIdle(now) {
      const timeout = this.config.interactionRunner.idleResetTimeout || 60;
      if (this.meter.points > 0 || this.inPhase) {
        if (now - this.lastInput > timeout) this.fireReset(`闲置 ${timeout}s 自动重置`);
      }
    }

    addPoints(amount, source) {
      const config = this.pose.interaction;
      if (!this.pose.enableMeter || !config || !config.maxPoints) return;
      const now = performance.now() / 1000;
      this.meter.points = Math.min(config.maxPoints, this.meter.points + amount);
      this.meter.lastAdd = now;
      this.meter.nextDecay = now + (config.decayCooldown || 0);
      this.meter.decayed = false;
      if (this.meter.points >= config.maxPoints) {
        if (this.pose.binding.listenMeterFilled) {
          this.animator.setTrigger(this.pose.binding.filledAnimation);
          this.logEvent('meter', `${source}：互动值满 → 触发 ${this.pose.binding.filledAnimation}`);
        }
        this.meter.points = 0;
        // No Reset here: the graph only leaves the phase through the Reset transition, so the controller
        // stays on Sex_Idle_Orgasm (m_LoopTime=1) and the meter can fill again for the next round.
      }
    }

    fireReset(reason) {
      if (this.pose.binding.listenMeterReset) this.animator.setTrigger(this.pose.binding.resetAnimation);
      // Unity keeps an unconsumed trigger alive, so a stale Start would immediately re-enter the phase.
      for (const name of [this.pose.binding.startAnimation, ...this.pose.binding.inputTriggers]) {
        this.animator.resetTrigger(name);
      }
      this.inPhase = false;
      this.meter.points = 0;
      this.auto.round = 0;
      this.logEvent('meter', `${reason} → 触发 ${this.pose.binding.resetAnimation}`);
    }

    /* ---------- inputs ---------- */

    onKeyboard() {
      if (!this.active || !this.animator) return false;
      const binding = this.pose.binding;
      this.lastInput = performance.now() / 1000;
      if (!binding.listenInputDevice) { this.logEvent('input', '该姿势未监听键盘输入'); return true; }
      this.animator.setTrigger(binding.keyboardAnimation);
      this.addPoints(this.pose.interaction.keyPressPoints || 0, '键盘');
      this.logEvent('input', `键盘 → ${binding.keyboardAnimation}`);
      return true;
    }

    onMouseClick() {
      if (!this.active || !this.animator) return false;
      const binding = this.pose.binding;
      this.lastInput = performance.now() / 1000;
      if (!binding.listenInputDevice) { this.logEvent('input', '该姿势未监听鼠标输入'); return true; }
      this.animator.setTrigger(binding.mouseAnimation);
      this.addPoints(this.pose.interaction.keyPressPoints || 0, '鼠标');
      this.logEvent('input', `鼠标 → ${binding.mouseAnimation}`);
      return true;
    }

    onZone(zone, reason) {
      if (!this.active || !this.animator) return;
      this.lastInput = performance.now() / 1000;
      this.animator.setTrigger(zone.touchAnimation);
      this.logEvent('touch', `${reason ? reason + ' · ' : ''}${zone.name} → ${zone.touchAnimation}`);
      this.addPoints(this.pose.interaction.touchPoints || 0, `触摸 ${zone.zoneKey}`);
      if (this.pose.binding.enablePhaseSystem && !this.inPhase) this.startPhase();
    }

    // The phase gate is reconstructed from the controller graph: Default_Idle only leaves via Start.
    startPhase() {
      const binding = this.pose.binding;
      if (!binding.enablePhaseSystem) return;
      this.animator.setTrigger(binding.startAnimation);
      this.inPhase = true;
      this.logEvent('phase', `进入互动阶段 → ${binding.startAnimation}`);
    }

    onCanvasClick() {
      if (!this.active || !this.animator) return;
      this.lastInput = performance.now() / 1000;
      if (this.pose.binding.listenInputDevice) this.onMouseClick();
      else this.logEvent('input', '该姿势不监听鼠标点击，仅响应触摸热区');
    }

    // In game mode any plain keypress feeds the pose's keyboard listener, like the desktop pet reacts to typing.
    onKeyDownEvent(key) {
      if (!this.active || !this.animator) return false;
      if (key.length !== 1 || key === ' ') return false;
      if (key >= '1' && key <= '5') return false;
      this.onKeyboard();
      return true;
    }

    fireLevelTrigger() {
      const binding = this.pose.binding;
      const max = (this.pose.interaction.maxPoints || 100);
      const level = this.meter.points / max;
      const half = binding.halfThreshold === undefined ? 0.5 : binding.halfThreshold;
      const index = level >= 0.9 ? 2 : level >= half ? 1 : 0;
      const name = binding.inputTriggers[index];
      this.animator.setTrigger(name);
      this.logEvent('input', `互动值 ${(level * 100).toFixed(0)}% → ${name}（分级映射${INFERRED}）`);
    }

    setMood(value) {
      this.animator.setFloat('Mood', value);
      this.logEvent('mood', `Mood = ${value}（${MOOD_LABELS[Math.round(value)] || value}）`);
      this.renderParams();
    }

    setParameter(name, value) {
      if (!this.animator) return;
      this.animator.setBool(name, value);
      this.renderParams();
    }

    /* ---------- auto show ---------- */

    // Feeds the same signals the game's InteractionRunner would and lets the controller decide the
    // transitions, so the resulting chain is the game's own order rather than a hand-cut timeline.
    toggleAuto() {
      if (!this.active || !this.animator) { this.note('请先切换到游戏模式'); return; }
      this.auto.on = !this.auto.on;
      if (this.auto.on) {
        this.auto.next = performance.now() / 1000 + 0.4;
        this.auto.round = 0;
        this.logEvent('auto', '自动演出开始：由状态机决定动作顺序');
      } else {
        this.auto.step = '已暂停';
        this.logEvent('auto', '自动演出已停止');
      }
      this.renderAuto();
    }

    skipAuto() {
      if (!this.auto.on) { this.note('自动演出未开启'); return; }
      const max = this.pose.interaction.maxPoints || 100;
      if (this.pose.binding.enablePhaseSystem && this.inPhase) {
        this.meter.points = Math.max(this.meter.points, Math.round(max * 0.85));
        this.logEvent('auto', '跳过：互动值直接拉到 85%');
      }
      this.auto.next = 0;
      this.tickAuto(performance.now() / 1000);
    }

    tickAuto(now) {
      if (now < this.auto.next) return;
      if (this.pose.binding.enablePhaseSystem) this.autoPhase();
      else this.autoKeyMouse();
    }

    autoPhase() {
      const max = this.pose.interaction.maxPoints || 100;
      if (!this.inPhase) {
        this.autoTouch('自动演出 · 起势');
        this.setStep('轻触 → 进入互动阶段', this.gameSeconds(1.2));
        return;
      }
      const level = this.meter.points / max;
      if (level >= 0.85) {
        this.addPoints(max, '自动演出');
        this.auto.round += 1;
        this.setStep(`互动值拉满 → 第 ${this.auto.round} 次高潮`, this.gameSeconds(5.4));
        return;
      }
      // One beat = one touch: the game's per-touch handler both feeds the meter (+2) and fires the
      // level-mapped Click_N. The slider defaults to one full flare cycle — Sex_Motion1_1 is a 0.4s clip
      // held for exitTime 0.66 (0.265s) plus a 0.135s blend out, so the blend lands on the clip's last
      // frame. Shorter cuts every flare before it finishes; longer shows a beat of plain Sex_Idle.
      this.autoTouch('自动演出');
      this.fireLevelTrigger();
      const pct = Math.round((this.meter.points / max) * 100);
      this.setStep(this.auto.round ? `高潮循环 · 连点中 → ${pct}%` : `连点中 → 互动值 ${pct}%`, this.beatLength());
    }

    // Wall-clock beat length from the slider, scaled by the viewer's playback speed so a 2x preview keeps
    // the same chaining instead of leaving gaps. 0.40s equals one full flare cycle.
    beatLength() { return this.gameSeconds(this.auto.beat); }

    gameSeconds(seconds) { return seconds / (this.hooks.getSpeed() || 1); }

    autoKeyMouse() {
      const steps = this.autoSteps();
      if (!steps.length) { this.setStep('该姿势没有可自动化的输入', 4); return; }
      const step = steps[this.auto.index % steps.length];
      this.auto.index += 1;
      step.run();
      this.setStep(step.label, step.wait);
    }

    autoSteps() {
      const binding = this.pose.binding;
      const has = (name) => this.graph.params.some((p) => p.name === name);
      const steps = [];
      if (binding.listenInputDevice && has('Keyboard')) steps.push({ label: '键盘打字', wait: 2.6, run: () => this.onKeyboard() });
      if (binding.listenInputDevice && has('click')) steps.push({ label: '鼠标点击', wait: 3, run: () => this.onMouseClick() });
      if (binding.listenTouch && this.pose.touchZones.length) steps.push({ label: '触碰胸口', wait: 2.8, run: () => this.autoTouch('自动演出 · 触碰') });
      if (has('Mood')) steps.push({ label: '切换情绪', wait: 4.2, run: () => { this.auto.mood = (this.auto.mood + 1) % 4; this.setMood(this.auto.mood); } });
      if (has('Talking')) steps.push({ label: '说话开关', wait: 3.4, run: () => this.setParameter('Talking', !this.animator.getParameter('Talking')) });
      return steps;
    }

    autoTouch(reason) {
      const zones = this.pose.touchZones;
      if (!zones.length) return;
      const zone = zones[Math.floor(Math.random() * zones.length)];
      this.onZone(zone, reason);
    }

    setStep(label, holdSeconds) {
      this.auto.step = label;
      this.auto.next = performance.now() / 1000 + holdSeconds;
      this.renderAuto();
    }

    renderBeat() {
      if (this.dom.beat) this.dom.beat.value = String(this.auto.beat);
      if (this.dom.beatVal) this.dom.beatVal.textContent = `${this.auto.beat.toFixed(2)}s`;
    }

    renderAuto() {
      if (!this.dom.auto) return;
      this.dom.auto.textContent = this.auto.on ? `▶ ${this.auto.step}` : '⏸ 未开始';
      this.dom.auto.classList.toggle('on', this.auto.on);
      if (this.dom.autoBtn) this.dom.autoBtn.classList.toggle('active', this.auto.on);
    }

    /* ---------- DOM ---------- */

    mount(panel) {
      this.panel = panel;
      panel.innerHTML = '<div class="gm-empty">正在读取游戏配置…</div>';
    }

    renderShell() {
      if (!this.panel) return;
      if (!this.pose) {
        this.panel.innerHTML = `<div class="gm-note">${esc(this.hooks.getNote() || '当前模型无对应状态机。')}</div>`;
        return;
      }
      this.panel.innerHTML = `
        <div class="gm-head">
          <div><b>${esc(this.poseId)}</b><small>${esc(this.graph.controller)} · ${this.graph.layers.length} 层 ${this.graph.stateCount} 状态</small></div>
          <span class="gm-tag">${this.pose.binding.enablePhaseSystem ? '阶段系统' : '键鼠系统'}</span>
        </div>
        <div class="gm-block gm-actions">
          <button type="button" class="btn tiny" id="gmAutoBtn">▶ 自动演出</button>
          <button type="button" class="btn tiny" id="gmSkipBtn">跳过</button>
          <label class="gm-beat" title="一次触摸的间隔。0.40s 正好是一个动作的完整周期（0.265s 停留 + 0.135s 淡出）">节拍<input type="range" id="gmBeat" min="0.15" max="1.5" step="0.05" value="0.4"><b id="gmBeatVal">0.40s</b></label>
          <span class="gm-step" id="gmStep"></span>
        </div>
        <div class="gm-block" id="gmLayers"></div>
        <div class="gm-block" id="gmMeter"></div>
        <div class="gm-block" id="gmParams"></div>
        <div class="gm-block">
          <div class="gm-title">手动触发<em title="直接对状态机发送参数，用于验证任意一条转移">点按即 SetTrigger</em></div>
          <div class="chips" id="gmTriggers"></div>
        </div>
        <div class="gm-block">
          <div class="gm-title">事件日志</div>
          <div class="gm-log" id="gmLog"></div>
        </div>`;
      this.dom.layers = this.panel.querySelector('#gmLayers');
      this.dom.meter = this.panel.querySelector('#gmMeter');
      this.dom.params = this.panel.querySelector('#gmParams');
      this.dom.triggers = this.panel.querySelector('#gmTriggers');
      this.dom.log = this.panel.querySelector('#gmLog');
      this.dom.auto = this.panel.querySelector('#gmStep');
      this.dom.autoBtn = this.panel.querySelector('#gmAutoBtn');
      this.dom.autoBtn.addEventListener('click', () => this.toggleAuto());
      this.panel.querySelector('#gmSkipBtn').addEventListener('click', () => this.skipAuto());
      const beat = this.panel.querySelector('#gmBeat');
      this.dom.beat = beat;
      this.dom.beatVal = this.panel.querySelector('#gmBeatVal');
      beat.value = String(this.auto.beat);
      beat.addEventListener('input', () => {
        this.auto.beat = Number(beat.value);
        this.renderBeat();
      });
      this.renderBeat();
      this.renderTriggers();
      this.renderLayers();
      this.renderMeter();
      this.renderParams();
      this.renderLog();
      this.renderAuto();
    }

    renderTriggers() {
      if (!this.dom.triggers) return;
      const triggers = this.graph.params.filter((p) => p.type === 'trigger');
      this.dom.triggers.innerHTML = '';
      for (const param of triggers) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'chip';
        btn.textContent = param.name;
        btn.addEventListener('click', () => { this.animator.setTrigger(param.name); this.logEvent('input', `手动 → ${param.name}`); });
        this.dom.triggers.appendChild(btn);
      }
    }

    renderParams() {
      if (!this.dom.params || !this.pose) return;
      const mood = this.graph.params.find((p) => p.name === 'Mood');
      const bools = this.graph.params.filter((p) => p.type === 'bool');
      if (!mood && !bools.length) { this.dom.params.innerHTML = ''; return; }
      let html = '';
      if (mood) {
        const value = Number(this.animator.getParameter('Mood') || 0);
        html += `<div class="gm-title">情绪 Mood<em>混合树 0–3${INFERRED ? '' : ''}</em></div><div class="segmented">`;
        for (let i = 0; i < MOOD_LABELS.length; i++) {
          html += `<button type="button" class="seg${Math.round(value) === i ? ' on' : ''}" data-mood="${i}">${MOOD_LABELS[i]}</button>`;
        }
        html += '</div>';
      }
      if (bools.length) {
        html += '<div class="gm-title">布尔参数</div><div class="gm-bools">';
        for (const param of bools) {
          const on = !!this.animator.getParameter(param.name);
          html += `<label class="switch"><input type="checkbox" data-bool="${esc(param.name)}"${on ? ' checked' : ''}><span>${esc(param.name)}</span></label>`;
        }
        html += '</div>';
      }
      this.dom.params.innerHTML = `<div class="gm-title-row">状态参数<em>ListenMood=${this.pose.binding.listenMood ? '开' : '关'}</em></div>${html}`;
      this.dom.params.querySelectorAll('[data-mood]').forEach((btn) => {
        btn.addEventListener('click', () => this.setMood(Number(btn.dataset.mood)));
      });
      this.dom.params.querySelectorAll('[data-bool]').forEach((input) => {
        input.addEventListener('change', () => this.setParameter(input.dataset.bool, input.checked));
      });
    }

    renderMeter() {
      if (!this.dom.meter) return;
      const config = this.pose.interaction;
      if (!this.pose.enableMeter) {
        this.dom.meter.innerHTML = `<div class="gm-title">互动值<em>EnableMeter=0</em></div><div class="gm-note">该姿势不启用互动值累积，仅播放键鼠/触碰反应。</div>`;
        return;
      }
      const max = config.maxPoints || 100;
      const pct = Math.round((this.meter.points / max) * 100);
      this.dom.meter.innerHTML = `
        <div class="gm-title">互动值<em>按键+${config.keyPressPoints} · 触摸+${config.touchPoints} · 每${config.decayInterval}s 衰减${config.decayAmount}（${config.decayCooldown}s 后）</em></div>
        <div class="meter"><span class="meter-fill" style="width:${pct}%"></span><b>${this.meter.points}/${max}</b></div>
        <div class="gm-meter-row">
          <button type="button" class="btn tiny" data-add="1">+1</button>
          <button type="button" class="btn tiny" data-add="2">+2</button>
          <button type="button" class="btn tiny" data-add="${Math.max(1, Math.round(max / 4))}">+25%</button>
          <button type="button" class="btn tiny" data-phase="1">按当前阶段触发</button>
        </div>`;
      this.dom.meter.querySelectorAll('[data-add]').forEach((btn) => {
        btn.addEventListener('click', () => { this.addPoints(Number(btn.dataset.add), '手动'); this.renderMeter(); });
      });
      const phaseBtn = this.dom.meter.querySelector('[data-phase]');
      if (phaseBtn) phaseBtn.addEventListener('click', () => { this.fireLevelTrigger(); this.renderLayers(); });
    }

    renderLayers() {
      if (!this.dom.layers) return;
      const rows = this.animator.getLayerStates().map((layer, index) => {
        const def = this.graph.layers[index];
        const weight = `<input type="range" class="layer-weight" min="0" max="100" value="${Math.round(layer.weight * 100)}" data-layer="${esc(layer.layer)}"${index === 0 ? ' disabled' : ''}>`;
        return `<div class="layer-row${layer.state ? ' live' : ''}">
          <span class="layer-name">${esc(layer.layer)}<em>${layer.mode === 'additive' ? '叠加' : '覆盖'}</em></span>
          <span class="layer-state">${esc(layer.state || '—')}${layer.animation ? `<i>${esc(layer.animation)}</i>` : ''}</span>
          ${weight}
        </div>`;
      });
      this.dom.layers.innerHTML = `<div class="gm-title">图层状态<em>权重可手动调整</em></div>${rows.join('')}`;
      this.dom.layers.querySelectorAll('.layer-weight').forEach((input) => {
        input.addEventListener('input', () => {
          this.animator.setLayerWeight(input.dataset.layer, Number(input.value) / 100);
        });
      });
    }

    renderLog() {
      if (!this.dom.log) return;
      this.dom.log.innerHTML = this.log.slice(-40).map((entry) =>
        `<div class="log-line log-${entry.kind}"><i>${entry.time}</i><span>${esc(entry.text)}</span></div>`
      ).join('');
      this.dom.log.scrollTop = this.dom.log.scrollHeight;
    }

    logEvent(kind, text) {
      const now = new Date();
      this.log.push({ kind, text, time: `${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}` });
      if (this.log.length > 200) this.log.splice(0, this.log.length - 200);
      if (this.dom.log) this.renderLog();
    }

    note(text) { this.logEvent('info', text); }

    /* ---------- touch zones ---------- */

    renderZones() {
      const overlay = this.hooks.getOverlay();
      if (!overlay) return;
      overlay.innerHTML = '';
      this.zoneEls = [];
      if (!this.active || !this.pose) return;
      const offset = ZONE_OFFSET[this.poseId] || [0, 0];
      for (const zone of this.pose.touchZones) {
        const el = document.createElement('button');
        el.type = 'button';
        el.className = 'hotspot';
        el.dataset.zone = zone.zoneKey;
        el.title = `${zone.name} → ${zone.touchAnimation}`;
        el.innerHTML = `<span>${esc(zone.zoneKey)}</span>`;
        el.addEventListener('pointerdown', (event) => {
          event.stopPropagation();
          el.classList.add('hit');
          this.onZone(zone);
        });
        el.addEventListener('pointerup', () => el.classList.remove('hit'));
        overlay.appendChild(el);
        this.zoneEls.push({ el, zone, offset });
      }
      this.renderHotspots();
    }

    renderHotspots() {
      if (!this.zoneEls.length) return;
      const project = this.hooks.project;
      for (const item of this.zoneEls) {
        const [ox, oy] = item.offset;
        const cx = item.zone.anchoredPosition.x + ox;
        const cy = item.zone.anchoredPosition.y + oy;
        const center = project(cx, cy);
        const corner = project(cx + item.zone.sizeDelta.x / 2, cy + item.zone.sizeDelta.y / 2);
        const width = Math.abs(corner.x - center.x) * 2;
        const height = Math.abs(corner.y - center.y) * 2;
        if (!isFinite(width) || width < 2 || height < 2) { item.el.style.display = 'none'; continue; }
        item.el.style.display = '';
        item.el.style.width = `${width}px`;
        item.el.style.height = `${height}px`;
        item.el.style.transform = `translate(${center.x - width / 2}px, ${center.y - height / 2}px)`;
      }
    }
  }

  function esc(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  window.GameMode = GameMode;
})();
