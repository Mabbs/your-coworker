import { TYPE_LABELS } from './wardrobe.js';

const LOOP_NAMES = ['Fuck_Loop_00', 'Fuck_Loop_01', 'Fuck_Loop_02', 'Fuck_Loop_03'];

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const lerp = (a, b, t) => a + (b - a) * t;

// Mirrors Assembly-CSharp GirlController (decompiled). Method names below point at the original
// obfuscated handlers so the numbers can be checked against the game assembly.
export class GirlGame {
  constructor({ animState, skeleton, spine, hooks }) {
    this.animState = animState;
    this.skeleton = skeleton;
    this.spine = spine;
    this.hooks = hooks;

    this.state = 'Idle';
    this.love = 0;
    this.lust = 0;
    this.orgasmCount = 0;
    this.orgasmLock = false;
    this.loveDecayDuration = 60;

    this.hnm = 0;
    this.hnn = 0.15;
    this.hno = 0;
    this.level = -1;
    this.stain = 0;

    this.animState.addListener({
      complete: (entry) => this.onComplete(entry)
    });
  }

  start() {
    this.animState.setAnimation(0, 'Idle', true);
    this.hooks.onState?.('Idle', TYPE_LABELS.Idle);
    this.setLevel(0);
    this.setStain(0, true);
    this.log('状态机启动 · Idle / Level_0 / body_stain_00');
  }

  // GIRL_STATE: Idle / Idle_H / Idle_H_End / Fuck_Start / Fuck_Loop / Fuck_End
  setState(next) {
    if (this.state === next) return;
    this.state = next;
    this.hooks.onState?.(next, TYPE_LABELS[next] || next);
  }

  // bfh(0, name, loop) with the d=true "same animation" guard.
  playBase(name, loop = true, mixDuration = -1) {
    const current = this.animState.getCurrent(0);
    if (current && current.animation.name === name) return current;
    const entry = this.animState.setAnimation(0, name, loop);
    if (mixDuration >= 0) entry.mixDuration = mixDuration;
    return entry;
  }

  // bev(): whether the optional NoDick variant exists. bq.hke defaults to false in the game,
  // so Idle / Idle_H_End are the normal picks.
  hasAnimation(name) {
    return this.skeleton.data.findAnimation(name) != null;
  }

  // ben(): called on every touch. Adds love/lust unconditionally, but only advances the state
  // when the per-state cooldown elapsed. restartLoop is a viewer-only flag for auto/hold input:
  // those repeat every 130-140 ms and would otherwise reset the 0.5 s one-shot before it moves.
  touch({ restartLoop = true } = {}) {
    if (this.orgasmLock) return false;
    this.love += 0.75;
    this.lust = clamp(this.lust + 0.2, 0, 100);

    if (this.hnm < this.hnn) return false;
    this.hnm = 0;
    this.hno = 0;

    switch (this.state) {
      case 'Idle':
      case 'Idle_H_End':
        this.startFuck();
        this.hnn = 0.5;
        return true;
      case 'Idle_H':
        this.playRandomLoop();
        this.hnn = 0.05;
        return true;
      case 'Fuck_Loop':
        if (!restartLoop && this.loopActive()) return false;
        this.playRandomLoop();
        this.hnn = 0.05;
        return true;
      default:
        return false;
    }
  }

  // bey(): Fuck_Start, then Idle_H on complete.
  startFuck() {
    this.setState('Fuck_Start');
    this.lust = clamp(this.lust, 0, 100);
    this.playBase('Fuck_Start', false);
    this.log('Fuck_Start（1.00s）');
  }

  // ber(): random one-shot loop on track 1 over the Idle_H bed on track 0.
  playRandomLoop() {
    this.setState('Fuck_Loop');
    const name = LOOP_NAMES[Math.floor(Math.random() * LOOP_NAMES.length)];
    const entry = this.animState.setAnimation(1, name, false);
    // spine-webgl exports the enum with lowercase members (setup/first/replace/add);
    // MixBlend.First is undefined and makes the runtime skip the track's timelines.
    entry.mixBlend = this.spine.MixBlend.first;
    this.animState.addEmptyAnimation(1, 0.3, 0);
    this.log(`${name} · track 1`);
  }

  // Track 1 still shows the clip, or its 0.3 s empty fade, until trackTime reaches 0.5 s.
  loopActive() {
    let entry = this.animState.getCurrent(1);
    while (entry) {
      if (LOOP_NAMES.includes(entry.animation?.name)) return true;
      entry = entry.mixingFrom;
    }
    return false;
  }

  // bet()
  enterIdleH() {
    this.setState('Idle_H');
    this.playBase('Idle_H', true);
    this.log('Idle_H 循环（2.00s）');
  }

  // bez(): Fuck_End, then Idle_H_End on complete. Orgasm adds +5 lust.
  endFuck() {
    if (this.state === 'Fuck_End') return;
    this.lust = clamp(this.lust + 5, 0, 100);
    this.setState('Fuck_End');
    this.playBase('Fuck_End', false);
    this.log('Fuck_End（4.67s）· 高潮结束');
  }

  // beu() / bew(): with the game's default hke=false this simply loops Idle_H_End.
  enterIdleHEnd() {
    this.setState('Idle_H_End');
    this.playBase('Idle_H_End', true);
    this.log('Idle_H_End 余韵');
  }

  // bes()
  enterIdle() {
    if (this.state === 'Idle') return;
    this.setState('Idle');
    this.playBase('Idle', true);
    this.log('回到 Idle');
  }

  // beo(): per-frame end/decay checks.
  checkEndState(dt) {
    if (this.orgasmLock) {
      if (this.state !== 'Fuck_End' && this.state !== 'Idle_H_End') this.endFuck();
      return;
    }
    if (this.love <= 0) this.enterIdle();
    if (this.state === 'Idle_H' || this.state === 'Idle_H_End') {
      this.hno += dt;
      if (this.hno > 20) {
        this.enterIdle();
        this.hno = 0;
      }
    }
  }

  // bep() / bfa(): lust thresholds drive Level_0..3 on track 5.
  updateLevel() {
    const level = this.lust > 75 ? 3 : this.lust > 50 ? 2 : this.lust > 25 ? 1 : 0;
    if (level !== this.level) this.setLevel(level);
  }

  // bfa() -> bfh(5, ...): clearing and immediately replacing leaves the empty entry unapplied,
  // so SetAnimation replaces it without a mix — the same hard cut as the game.
  setLevel(level) {
    this.level = level;
    const name = `Level_${level}`;
    if (!this.hasAnimation(name)) return;
    this.animState.clearTrack(5);
    this.animState.setEmptyAnimation(5, 0);
    this.animState.setAnimation(5, name, true);
  }

  // bfb(): body_stain_00..10 on track 6.
  setStain(level, immediate = false) {
    this.stain = clamp(Math.round(level), 0, 10);
    const name = `body_stain_${String(this.stain).padStart(2, '0')}`;
    if (!this.hasAnimation(name)) return;
    const entry = this.animState.setAnimation(6, name, true);
    entry.mixDuration = immediate ? 0 : 1;
    this.hooks.onDirty?.(this.stain);
  }

  // ChangeClothe(): the game also taps track 2 with the same clip before track 1;
  // the clip only translates four IK bones, so track 1 alone is visually identical.
  changeClothe() {
    if (!this.hasAnimation('ChangeClothe')) return;
    const entry = this.animState.setAnimation(1, 'ChangeClothe', false);
    entry.mixBlend = this.spine.MixBlend.first;
    this.animState.addEmptyAnimation(1, 0.3, 0);
  }

  onComplete(entry) {
    if (entry.trackIndex !== 0) return;
    const name = entry.animation.name;
    if (name === 'Fuck_Start' && this.state === 'Fuck_Start') this.enterIdleH();
    else if (name === 'Fuck_End' && this.state === 'Fuck_End') this.enterIdleHEnd();
  }

  update(dt) {
    this.hnm += dt;
    this.lust = clamp(this.lust - (dt * 5) / 9, 0, 100);

    if (!this.orgasmLock) {
      const rate = lerp(0.916, 2.747, this.love / 100) * (60 / this.loveDecayDuration);
      this.love -= dt * rate;
    } else {
      this.love -= dt * 15;
      if (this.love < 10) this.orgasmLock = false;
    }

    if (this.love < 0) {
      this.love = 0;
    } else if (this.love > 100) {
      this.love = 100;
      this.orgasmCount += 1;
      this.orgasmLock = true;
      this.log(`爱意拉满 → 第 ${this.orgasmCount} 次高潮`);
      this.hooks.onOrgasm?.(this.orgasmCount);
    }

    this.checkEndState(dt);
    this.updateLevel();
  }

  reset() {
    this.animState.clearTracks();
    this.state = 'Idle';
    this.love = 0;
    this.lust = 0;
    this.orgasmCount = 0;
    this.orgasmLock = false;
    this.hnm = 0;
    this.hnn = 0.15;
    this.hno = 0;
    this.level = -1;
    this.stain = 0;
    this.playBase('Idle', true);
    this.setLevel(0);
    this.setStain(0, true);
    this.hooks.onState?.('Idle', '待机');
    this.log('已重置');
  }

  trackSummary() {
    return this.animState.tracks
      .slice(0, 7)
      .map((track, i) => (track && track.animation ? `${i}:${track.animation.name}` : null))
      .filter(Boolean)
      .join(' · ') || '—';
  }

  log(message) {
    this.hooks.onLog?.(message);
  }
}
