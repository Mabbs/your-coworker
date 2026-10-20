/* global spine */
// Unity Animator emulator: executes the parsed .controller graphs on top of a Spine AnimationState.
(() => {
  'use strict';

  class SpineAnimator {
    /**
     * @param {object} graph  controller graph from data/animator/*.json
     * @param {{animState: object, skeleton: object, onEvent?: Function}} ctx
     */
    constructor(graph, ctx) {
      this.graph = graph;
      this.animState = ctx.animState;
      this.skeleton = ctx.skeleton;
      this.onEvent = ctx.onEvent || (() => {});
      this.speed = 1;
      this.params = new Map();
      for (const param of graph.params) {
        this.params.set(param.name, { type: param.type, value: param.default, queued: false });
      }
      // Each layer owns a base track plus a spare track used by 1D blend trees.
      this.layers = graph.layers.map((def, index) => ({
        def,
        index,
        baseTrack: index * 2,
        blendTrack: index * 2 + 1,
        weight: index === 0 ? 1 : def.defaultWeight,
        current: null
      }));
      this.stateIndex = new Map();
      for (const layer of this.layers) {
        for (const state of layer.def.states) this.stateIndex.set(state.id, { layer, state });
      }
      this.reset();
    }

    /* ---------- parameters ---------- */

    setFloat(name, value) { this._setNumeric(name, 'float', value); }
    setInteger(name, value) { this._setNumeric(name, 'int', Math.trunc(value)); }

    setBool(name, value) {
      const param = this.params.get(name);
      if (!param) { this.onEvent('missingParam', { parameter: name }); return; }
      if (param.type === 'trigger') { if (value) this.setTrigger(name); return; }
      param.value = !!value;
    }

    setTrigger(name) {
      const param = this.params.get(name);
      if (!param) { this.onEvent('missingParam', { parameter: name }); return; }
      if (param.type === 'trigger') param.queued = true;
      else param.value = true;
      this.onEvent('param', { parameter: name, value: true, type: param.type });
    }

    resetTrigger(name) {
      const param = this.params.get(name);
      if (param) { param.queued = false; param.value = param.type === 'trigger' ? false : param.value; }
    }

    getParameter(name) {
      const param = this.params.get(name);
      if (!param) return undefined;
      return param.type === 'trigger' ? param.queued : param.value;
    }

    _setNumeric(name, type, value) {
      const param = this.params.get(name);
      if (!param) { this.onEvent('missingParam', { parameter: name }); return; }
      param.value = type === 'int' ? Math.trunc(value) : Number(value);
      this.onEvent('param', { parameter: name, value: param.value, type: param.type });
    }

    /* ---------- layers ---------- */

    setLayerWeight(name, weight) {
      const layer = this.layers.find((l) => l.def.name === name);
      if (!layer || layer.index === 0) return;
      layer.weight = clamp(weight, 0, 1);
    }

    getLayerStates() {
      return this.layers.map((layer) => ({
        layer: layer.def.name,
        mode: layer.def.mode,
        weight: layer.weight,
        state: layer.current ? layer.current.state.name : null,
        animation: layer.current ? layer.current.animationLabel : null,
        progress: layer.current && layer.current.duration > 0
          ? clamp(layer.current.time / layer.current.duration, 0, 1)
          : 0
      }));
    }

    reset() {
      for (const layer of this.layers) {
        layer.current = null;
        this.animState.setEmptyAnimation(layer.baseTrack, 0);
        this.animState.setEmptyAnimation(layer.blendTrack, 0);
      }
      for (const param of this.params.values()) { param.queued = false; }
      for (const layer of this.layers) {
        const def = layer.def;
        const entry = resolveEntryTransition(def);
        if (entry) {
          const target = this._findStateByName(layer, entry.destination);
          if (target) { this._enter(layer, target, durationOf(entry)); continue; }
        }
        const fallback = def.defaultState ? this._findStateByName(layer, def.defaultState) : def.states[0];
        if (fallback) this._enter(layer, fallback, 0);
      }
    }

    /* ---------- update ---------- */

    update(dt) {
      const step = dt * this.speed;
      for (const layer of this.layers) {
        if (!layer.current) continue;
        layer.current.time += step;
        const transition = this._pickTransition(layer);
        if (transition) {
          this._fire(layer, transition);
          continue;
        }
        this._syncBlend(layer);
      }
    }

    _pickTransition(layer) {
      const current = layer.current;
      const progress = current.duration > 0 ? current.time / current.duration : 1;
      for (const transition of current.state.transitions) {
        if (this._canFire(layer, transition, progress)) return { transition, fromAnyState: false };
      }
      for (const transition of layer.def.anyStateTransitions) {
        if (this._canFire(layer, transition, progress)) return { transition, fromAnyState: true };
      }
      return null;
    }

    _canFire(layer, transition, progress) {
      if (transition.mute) return false;
      const destination = transition.destination;
      if (destination && this._findStateByName(layer, destination) === current(layer)) return false;
      if (transition.hasExitTime && progress < transition.exitTime) return false;
      if (transition.conditions.length && !transition.conditions.every((c) => this._test(c))) return false;
      // Without conditions Unity still requires the exit point, handled above; a bare condition-less
      // transition with no exit time would fire forever, so it only applies through exit time.
      if (!transition.hasExitTime && !transition.conditions.length) return false;
      return true;
    }

    _test(condition) {
      const param = this.params.get(condition.parameter);
      if (!param) return false;
      const value = param.type === 'trigger' ? param.queued : param.value;
      switch (condition.mode) {
        case 'if': return !!value;
        case 'ifNot': return !value;
        case 'equals': return Number(value) === condition.threshold;
        case 'notEqual': return Number(value) !== condition.threshold;
        case 'less': return Number(value) < condition.threshold;
        case 'greaterOrEqual': return Number(value) >= condition.threshold;
        default: return false;
      }
    }

    _fire(layer, picked) {
      const { transition, fromAnyState } = picked;
      for (const condition of transition.conditions) {
        const param = this.params.get(condition.parameter);
        if (param && param.type === 'trigger' && condition.mode === 'if') param.queued = false;
      }
      const from = layer.current;
      if (transition.destination === 'EXIT' || !transition.destination) {
        this._exitBehaviours(layer, from);
        layer.current = null;
        this.animState.setEmptyAnimation(layer.baseTrack, transition.duration);
        this.animState.setEmptyAnimation(layer.blendTrack, transition.duration);
        this.onEvent('exit', { layer: layer.def.name, from: from.state.name });
        return;
      }
      const target = fromAnyState
        ? this._findStateByName(layer, transition.destination)
        : this.stateIndex.get(transition.destinationId)?.state
          || this._findStateByName(layer, transition.destination);
      if (!target) { this.onEvent('missingState', { layer: layer.def.name, state: transition.destination }); return; }
      this._enter(layer, target, transition.duration, from);
    }

    _enter(layer, state, mixDuration, from) {
      if (from) this._exitBehaviours(layer, from);
      layer.current = { state, time: 0, duration: motionDuration(state.motion), animationLabel: null };
      for (const behaviour of state.behaviours) {
        if (behaviour.parameterName) this.setBool(behaviour.parameterName, behaviour.valueOnEnter);
      }
      this.onEvent('transition', {
        layer: layer.def.name,
        from: from ? from.state.name : null,
        to: state.name,
        animation: primaryAnimation(state.motion),
        mix: mixDuration
      });
      this._startMotion(layer, mixDuration);
    }

    _exitBehaviours(layer, current) {
      if (!current) return;
      for (const behaviour of current.state.behaviours) {
        if (behaviour.parameterName) this.setBool(behaviour.parameterName, behaviour.valueOnExit);
      }
    }

    /* ---------- apply to Spine ---------- */

    /** Starts the state's motion on its layer tracks. Called once per state change. */
    _startMotion(layer, mixDuration) {
      const current = layer.current;
      if (!current) return;
      const mix = Math.max(0, mixDuration);
      const motion = current.state.motion;
      if (motion.kind === 'clip') {
        current.animationLabel = motion.name;
        this._play(layer, layer.baseTrack, motion, current.state.speed, layer.weight, motion.available !== false, mix);
        this.animState.setEmptyAnimation(layer.blendTrack, mix);
        return;
      }
      if (motion.kind === 'blendTree') {
        current.blend = motion;
        this._syncBlend(layer, mix);
        return;
      }
      current.animationLabel = null;
      current.blend = null;
      this.animState.setEmptyAnimation(layer.baseTrack, mix);
      this.animState.setEmptyAnimation(layer.blendTrack, mix);
    }

    /** Refreshes track alphas without restarting entries, so 1D blend trees follow their parameter. */
    _syncBlend(layer, mixDuration) {
      const current = layer.current;
      if (!current || !current.blend) return;
      const motion = current.blend;
      const mix = mixDuration === undefined ? 0.12 : mixDuration;
      const value = Number(this.getParameter(motion.parameter) || 0);
      const { lower, upper, weight } = blendSelect(motion.children, value);
      current.animationLabel = upper ? `${motion.parameter}=${formatNumber(value)}` : (lower && lower.clip ? lower.clip.name : null);
      if (!lower) {
        this.animState.setEmptyAnimation(layer.baseTrack, mix);
        this.animState.setEmptyAnimation(layer.blendTrack, mix);
        return;
      }
      const lowerChanged = current.lowerName !== (lower.clip ? lower.clip.name : null);
      const upperName = upper && weight > 0 && upper.clip ? upper.clip.name : null;
      const upperChanged = current.upperName !== upperName;
      if (lowerChanged) {
        this._play(layer, layer.baseTrack, childMotion(lower), current.state.speed, layer.weight, !!lower.clip && lower.clip.available !== false, mix);
      } else {
        const entry = this.animState.getTrack(layer.baseTrack);
        if (entry) entry.alpha = clamp(layer.weight, 0, 1);
      }
      if (upperChanged) {
        if (upperName) this._play(layer, layer.blendTrack, childMotion(upper), current.state.speed, weight, true, mix);
        else this.animState.setEmptyAnimation(layer.blendTrack, mix);
      } else if (upperName) {
        const entry = this.animState.getTrack(layer.blendTrack);
        if (entry) entry.alpha = clamp(weight, 0, 1);
      }
      current.lowerName = lower.clip ? lower.clip.name : null;
      current.upperName = upperName;
    }

    _play(layer, track, motion, stateSpeed, weight, available, mixDuration) {
      if (!available || !motion.name) {
        this.onEvent('unavailable', { animation: motion.name || null });
        this.animState.setEmptyAnimation(track, mixDuration);
        return;
      }
      const animation = this.skeleton.data.findAnimation(motion.name);
      if (!animation) {
        this.onEvent('missingAnimation', { animation: motion.name });
        this.animState.setEmptyAnimation(track, mixDuration);
        return;
      }
      const loop = motion.loop === undefined ? animation.duration > 0 : motion.loop;
      const entry = this.animState.setAnimation(track, animation, loop && animation.duration > 0);
      entry.setMixDuration(Math.max(0, mixDuration), 0);
      entry.alpha = clamp(weight, 0, 1);
      entry.additive = layer.def.mode === 'additive';
      entry.timeScale = stateSpeed || 1;
    }

    _findStateByName(layer, name) {
      return layer.def.states.find((s) => s.name === name) || null;
    }
  }

  function current(layer) {
    return layer.current ? layer.current.state : null;
  }

  function resolveEntryTransition(def) {
    return def.entryTransitions.length ? def.entryTransitions[0] : null;
  }

  function durationOf(transition) {
    return transition.duration || 0;
  }

  function motionDuration(motion) {
    if (motion.kind === 'clip') return Math.max(0, motion.duration || 0);
    if (motion.kind === 'blendTree') {
      return Math.max(0, ...motion.children.map((c) => (c.clip ? c.clip.duration : 0)));
    }
    return 0;
  }

  function primaryAnimation(motion) {
    if (!motion) return null;
    if (motion.kind === 'clip') return motion.name;
    if (motion.kind === 'blendTree') return `${motion.parameter} blend`;
    return null;
  }

  function blendSelect(children, value) {
    const sorted = children.slice().sort((a, b) => a.threshold - b.threshold);
    if (!sorted.length) return { lower: null, upper: null, weight: 0 };
    if (value <= sorted[0].threshold) return { lower: sorted[0], upper: null, weight: 0 };
    const last = sorted[sorted.length - 1];
    if (value >= last.threshold) return { lower: last, upper: null, weight: 0 };
    for (let i = 0; i < sorted.length - 1; i++) {
      const a = sorted[i];
      const b = sorted[i + 1];
      if (value >= a.threshold && value < b.threshold) {
        const span = b.threshold - a.threshold;
        return { lower: a, upper: b, weight: span > 0 ? (value - a.threshold) / span : 0 };
      }
    }
    return { lower: last, upper: null, weight: 0 };
  }

  function childMotion(child) {
    const clip = child.clip;
    return {
      kind: 'clip',
      name: clip ? clip.name : null,
      loop: clip ? clip.loop : false,
      duration: clip ? clip.duration : 0,
      available: clip ? clip.available !== false : false
    };
  }

  function formatNumber(value) {
    return Number.isInteger(value) ? String(value) : value.toFixed(2);
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  window.SpineAnimator = SpineAnimator;
})();
