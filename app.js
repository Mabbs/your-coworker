/* global spine */
(() => {
  'use strict';

  const SPINE = window.spine;

  const MODELS = [
    {
      id: 'DefaultDesk', kind: 'desk', name: '办公桌场景', glyph: '▦', hue: 170,
      sub: '桌面 A / B · 摆件与氛围',
      defaultAnim: 'DesktopA/Juice_Motion', version: '4.3.11',
      bones: 6, slots: 15, skins: 43, anims: 2
    },
    {
      id: 'PoseA', kind: 'char', name: 'Pose A', glyph: 'A', hue: 24,
      sub: '坐姿 · 键鼠互动与情绪',
      defaultAnim: 'Motion_Idle', version: '4.3.68-beta',
      bones: 267, slots: 264, skins: 241, anims: 13
    },
    {
      id: 'PoseB', kind: 'char', name: 'Pose B', glyph: 'B', hue: 282,
      sub: '双人互动 · 14 组动作',
      defaultAnim: 'Default_Idle', version: '4.3.68-beta',
      bones: 213, slots: 155, skins: 159, anims: 14
    },
    {
      id: 'PoseC', kind: 'char', name: 'Pose C', glyph: 'C', hue: 198,
      sub: '液体特效 · 28 组动作',
      defaultAnim: 'Default_Idle', version: '4.3.68-beta',
      bones: 229, slots: 233, skins: 176, anims: 28
    },
    {
      id: 'PoseD', kind: 'char', name: 'Pose D', glyph: 'D', hue: 328,
      sub: '触控反应 · 25 组动作',
      defaultAnim: 'Default_Idle', version: '4.3.68-beta',
      bones: 202, slots: 199, skins: 161, anims: 25
    }
  ];

  const CHAR_BASE = [
    'default', 'Base',
    'HeadTop/Default_HeadTop',
    'Leg/Default_Leg',
    'Suit/UpperBody/Default_UpperBody',
    'Suit/LowerBody/Default_LowerBody',
    'Tail/Default_Tail'
  ];
  const DESK_BASE = ['default', 'Base_Chair', 'Base_Desk', 'Computer'];

  const ANIM_GROUP_ORDER = ['Default', 'Motion', 'Click', 'Face', 'Mood', 'Touch', 'Tail', 'Sex', 'Effect', 'Liquid', 'FaceRed', 'DesktopA', 'NoUse'];
  const ANIM_GROUP_LABELS = {
    Default: '基础动作', Motion: '基础动作', Click: '键鼠互动', Face: '表情', Mood: '情绪',
    Touch: '触碰', Tail: '尾巴', Sex: '亲密互动', Effect: '特效', Liquid: '液体特效',
    FaceRed: '脸红状态', DesktopA: '桌面道具', NoUse: '其他'
  };

  const ANIM_LABELS = {
    'Motion_Idle': '待机呼吸',
    'Click_Keyboard_TwoHand': '双手打字',
    'Click_Mouse': '点击鼠标',
    'Face_Work': '工作表情',
    'Tail_Loop': '尾巴循环',
    'Touch_Chest': '触碰胸口',
    'Mood/Default': '默认情绪',
    'Mood/Bored': '无聊',
    'Mood/Happy': '开心',
    'Mood/Shy': '害羞',
    'Mood/Talking': '说话',
    'Default_Idle': '默认待机',
    'Default_IdleToSex': '姿态过渡',
    'Sex_Idle': '互动待机',
    'Sex_Idle_Orgasm': '互动待机 · 高潮',
    'Sex_Motion1': '动作 1',
    'Sex_Motion2': '动作 2',
    'Sex_Motion_Orgasm': '动作 · 高潮',
    'Sex_Orgasm': '高潮',
    'Effect_Touch_WhipL': '特效 · 左鞭',
    'Effect_Touch_WhipR': '特效 · 右鞭',
    'Touch_1': '轻触 1',
    'Touch_2': '轻触 2',
    'Touch_3L': '轻触 · 左',
    'Touch_3R': '轻触 · 右',
    'TouchBase': '触摸基础',
    'TouchBase_Stay': '触摸定格',
    'Touch_2_ChestL': '胸口触碰 · 左',
    'Touch_2_ChestR': '胸口触碰 · 右',
    'Touch_Head': '头部触碰',
    'Touch_Head+Base': '头部触碰 + 基础',
    'ChestSizeReset': '胸部形态重置',
    'DesktopA/Juice': '桌面果汁 · 定格',
    'DesktopA/Juice_Motion': '桌面果汁 · 倒出',
    'FaceRed/0': '脸红 0',
    'FaceRed/1': '脸红 1',
    'FaceRed/2': '脸红 2',
    'FaceRed/3': '脸红 3',
    'Liquid/0': '液体 0',
    'Liquid/1': '液体 1',
    'Liquid/2': '液体 2',
    'Liquid/Liquid_Orgasm': '液体 · 高潮',
    'Liquid/Liquid_Orgasm1': '液体 · 高潮 1',
    'Liquid/Liquid_Orgasm2': '液体 · 高潮 2',
    'Liquid/Liquid_Orgasm3': '液体 · 高潮 3',
    'Liquid/Liquid_Stay1': '液体 · 停留 1',
    'Liquid/Liquid_Stay2': '液体 · 停留 2',
    'Liquid/Liquid_Stay3': '液体 · 停留 3',
    'Liquid/VFX_WaterLoop1': '水特效循环 1',
    'Liquid/VFX_WaterLoop2': '水特效循环 2',
    'NoUse/Test123': '测试动作',
    'Touch/TouchBase': '触摸基础',
    'Touch/TouchBase_Stay': '触摸定格',
    'Touch/Touch_2_ChestL': '胸口触碰 · 左',
    'Touch/Touch_2_ChestR': '胸口触碰 · 右',
    'Touch/Touch_Head': '头部触碰',
    'Touch/Touch_Head+Base': '头部触碰 + 基础',
    'Touch/Touch_1-1': '触碰序列 1-1',
    'Touch/Touch_1-2': '触碰序列 1-2',
    'Touch/Touch_1-3': '触碰序列 1-3',
    'Touch/Touch_2-1': '触碰序列 2-1',
    'Touch/Touch_2-2': '触碰序列 2-2',
    'Touch/Touch_3-1': '触碰序列 3-1',
    'Touch/Touch_3-2': '触碰序列 3-2',
    'Touch/Touch_3-3': '触碰序列 3-3'
  };

  const DESK_SKIN_LABELS = {
    Juice: '果汁', Cat_Black: '黑猫摆件', Cat_Brown: '棕猫摆件', Cat_Orange: '橘猫摆件', Cat_White: '白猫摆件',
    Cat_Statue_Angle: '天使猫雕像', Cat_Statue_Demon: '恶魔猫雕像', ComicH: '同人本', LuckyCat: '招财猫',
    PenHolder: '笔筒', Trophy_Gold: '金奖杯', Trophy_Silver: '银奖杯', Trophy_Bronze: '铜奖杯', Trophy_Diamond: '钻石奖杯',
    Dildo1_Blue: '桌面道具 1 · 蓝', Dildo1_Purple: '桌面道具 1 · 紫',
    Dildo2_Brown: '桌面道具 2 · 棕', Dildo2_Pink: '桌面道具 2 · 粉',
    Dildo3_Blue: '桌面道具 3 · 蓝', Dildo3_Purple: '桌面道具 3 · 紫',
    Dildo4_Blue: '桌面道具 4 · 蓝', Dildo4_Purple: '桌面道具 4 · 紫',
    DeskLamp: '台灯', DeskLamp_Cat: '猫咪台灯',
    DeskLamp_Pantsul_Black_Pearl: '黑珍珠内裤', DeskLamp_Pantsu_Black: '黑色内裤',
    DeskLamp_Pantsu_Lace_White: '白色蕾丝内裤', DeskLamp_Pantsu_Pink_Pearl: '粉珍珠内裤',
    DeskLamp_Pantsu_white: '白色内裤', DeskLamp_Pantsu_White_Pearl: '白珍珠内裤',
    Underwear_Black: '黑色内衣', Wardrobe: '衣柜',
    CatTrophy_Bronze: '猫咪奖杯 · 铜', CatTrophy_Diamond: '猫咪奖杯 · 钻',
    CatTrophy_Gold: '猫咪奖杯 · 金', CatTrophy_Silver: '猫咪奖杯 · 银',
    Otaku_A: '宅物 A', Otaku_B: '宅物 B', 'Potted plants': '盆栽'
  };

  const THEME_LABELS = {
    'Default Face': '默认', 'Default HeadTop': '默认', 'Default Leg': '默认',
    'Default UpperBody': '默认', 'Default LowerBody': '默认', 'Default Tail': '默认',
    Angel: '天使', Devil: '恶魔', Cow: '奶牛', URCow: 'UR 奶牛', Ghost: '幽灵', Zombie: '僵尸',
    BlueNurseA: '蓝护士 A', BlueNurseB: '蓝护士 B', NurseA: '护士 A', NurseB: '护士 B',
    BlueMaid: '蓝女仆', MaidA: '女仆 A', MaidB: '女仆 B', PinkMaid: '粉女仆',
    BlackRabbit: '黑兔', PinkRabbit: '粉兔', RedRabbit: '红兔', RaceRabbit: '赛车兔',
    BikiniBlack: '比基尼 · 黑', BikiniPink: '比基尼 · 粉', BikiniPinkBlue: '比基尼 · 粉蓝',
    BikiniPureWhite: '比基尼 · 白', BikiniWhite: '比基尼 · 白',
    Alice: '爱丽丝', AliceBrown: '爱丽丝 · 棕', BlackSuit: '黑西装', FlowerFairy: '花仙子',
    SummerClover: '夏日四叶草', Tightsuit: '紧身衣', OL: 'OL 职场', GlassBlack: '黑框眼镜',
    HanStyleRed: '汉服 · 红', HanStyleBlue: '汉服 · 蓝', HanStyleCyan: '汉服 · 青', HanStyleYellow: '汉服 · 黄',
    PastiesBlack: '乳贴 · 黑', PastiesBlue: '乳贴 · 蓝', PastiesPurple: '乳贴 · 紫', PastiesRed: '乳贴 · 红',
    StrawHat: '草帽', RedHat: '红帽', RedHatPurple: '红帽 · 紫',
    Kaiju1: '怪兽 1', Kaiju2: '怪兽 2', Kaiju3: '怪兽 3'
  };

  const els = {
    modelList: document.getElementById('modelList'),
    modelCount: document.getElementById('modelCount'),
    modelTitle: document.getElementById('modelTitle'),
    modelSub: document.getElementById('modelSub'),
    stage: document.getElementById('stage'),
    canvas: document.getElementById('canvas'),
    loading: document.getElementById('loading'),
    loadingText: document.getElementById('loadingText'),
    errorBox: document.getElementById('errorBox'),
    errorText: document.getElementById('errorText'),
    retryBtn: document.getElementById('retryBtn'),
    gridBtn: document.getElementById('gridBtn'),
    bonesBtn: document.getElementById('bonesBtn'),
    fitBtn: document.getElementById('fitBtn'),
    shotBtn: document.getElementById('shotBtn'),
    zoomIn: document.getElementById('zoomIn'),
    zoomOut: document.getElementById('zoomOut'),
    playBtn: document.getElementById('playBtn'),
    playUse: document.querySelector('#playBtn use'),
    restartBtn: document.getElementById('restartBtn'),
    loopBtn: document.getElementById('loopBtn'),
    animName: document.getElementById('animName'),
    timeLabel: document.getElementById('timeLabel'),
    track: document.getElementById('track'),
    trackFill: document.getElementById('trackFill'),
    speedSel: document.getElementById('speedSel'),
    animList: document.getElementById('animList'),
    animCount: document.getElementById('animCount'),
    playAllBtn: document.getElementById('playAllBtn'),
    outfitList: document.getElementById('outfitList'),
    randomBtn: document.getElementById('randomBtn'),
    resetBtn: document.getElementById('resetBtn'),
    infoGrid: document.getElementById('infoGrid'),
    toast: document.getElementById('toast'),
    hotspots: document.getElementById('hotspots'),
    gamePanel: document.getElementById('gamePanel'),
    browseModeBtn: document.getElementById('browseModeBtn'),
    gameModeBtn: document.getElementById('gameModeBtn'),
    gameResetBtn: document.getElementById('gameResetBtn')
  };

  const state = {
    renderer: null,
    camera: null,
    gl: null,
    manager: null,
    atlas: null,
    data: null,
    skeleton: null,
    animState: null,
    currentId: null,
    currentMeta: null,
    currentAnim: null,
    groups: [],
    outfit: {},
    locked: new Set(),
    animEls: new Map(),
    animOrder: [],
    appliedSlots: new Set(),
    playing: false,
    loop: true,
    speed: 1,
    playAll: false,
    playAllLast: null,
    loadToken: 0,
    fps: 0,
    fpsFrames: 0,
    fpsMark: 0,
    lastTime: performance.now(),
    autoFit: true,
    dragging: false,
    dragStart: null,
    clickStart: null,
    dpr: 1,
    toastTimer: 0,
    driven: false
  };

  const game = new window.GameMode({
    getContext: () => (state.skeleton && state.animState ? { animState: state.animState, skeleton: state.skeleton } : null),
    getSpeed: () => state.speed,
    getOverlay: () => els.hotspots,
    getNote: () => (state.currentMeta ? state.currentMeta.sub : ''),
    project: projectToStage,
    setDriven: (on) => {
      state.driven = on;
      els.hotspots.classList.toggle('on', on);
      els.browseModeBtn.classList.toggle('on', !on);
      els.gameModeBtn.classList.toggle('on', on);
      els.gameModeBtn.disabled = !game.canDrive();
      setPlaybackEnabled(!on);
    }
  });

  const costume = new window.CostumeService();

  boot();

  async function boot() {
    if (!SPINE) {
      showFatal('Spine 运行时加载失败');
      return;
    }
    buildModelList();
    bindUI();
    game.mount(els.gamePanel);
    try {
      initRenderer();
    } catch (err) {
      showFatal(err.message || String(err));
      return;
    }
    requestAnimationFrame(frame);
    await costume.load().catch(() => null);
    const hashId = location.hash.replace(/^#/, '');
    const initial = MODELS.some((m) => m.id === hashId) ? hashId : MODELS[0].id;
    loadModel(initial);
    window.addEventListener('hashchange', () => {
      const id = location.hash.replace(/^#/, '');
      if (id && id !== state.currentId && MODELS.some((m) => m.id === id)) loadModel(id);
    });
    new ResizeObserver(onResize).observe(els.stage);
  }

  /* ---------- model list ---------- */

  function buildModelList() {
    els.modelCount.textContent = String(MODELS.length);
    MODELS.forEach((meta, i) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'model-card';
      btn.dataset.id = meta.id;
      btn.style.setProperty('--hue', meta.hue);
      btn.title = `${meta.name} · ${meta.sub}（快捷键 ${i + 1}）`;
      btn.innerHTML =
        `<span class="mc-thumb"><span class="mc-glyph">${esc(meta.glyph)}</span></span>` +
        `<span class="mc-body">` +
          `<span class="mc-name">${esc(meta.name)}</span>` +
          `<span class="mc-sub">${esc(meta.sub)}</span>` +
          `<span class="mc-meta">${meta.anims} 动作 · ${meta.slots} 槽位</span>` +
        `</span>`;
      btn.addEventListener('click', () => switchModel(meta.id));
      els.modelList.appendChild(btn);
    });
  }

  function switchModel(id) {
    if (id === state.currentId) return;
    loadModel(id);
  }

  function markActiveCard(id) {
    for (const card of els.modelList.querySelectorAll('.model-card')) {
      card.classList.toggle('active', card.dataset.id === id);
    }
  }

  /* ---------- renderer / camera ---------- */

  function initRenderer() {
    const attrs = { alpha: true, antialias: true, premultipliedAlpha: true, preserveDrawingBuffer: true };
    const gl = els.canvas.getContext('webgl2', attrs) || els.canvas.getContext('webgl', attrs);
    if (!gl) throw new Error('当前浏览器不支持 WebGL');
    state.gl = gl;
    state.renderer = new SPINE.SceneRenderer(els.canvas, gl, false);
    state.camera = state.renderer.camera;
    onResize();
  }

  function onResize() {
    if (!state.renderer) return;
    const width = Math.max(1, els.stage.clientWidth);
    const height = Math.max(1, els.stage.clientHeight);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const pw = Math.max(1, Math.round(width * dpr));
    const ph = Math.max(1, Math.round(height * dpr));
    state.dpr = dpr;
    if (els.canvas.width !== pw || els.canvas.height !== ph) {
      els.canvas.width = pw;
      els.canvas.height = ph;
    }
    state.gl.viewport(0, 0, pw, ph);
    state.camera.setViewport(pw, ph);
    if (state.skeleton && state.autoFit) fitView();
  }

  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, Math.max(0, (now - state.lastTime) / 1000));
    state.lastTime = now;

    if (state.skeleton && state.animState) {
      if (game.active) game.update(dt, now / 1000);
      if (state.playing || game.active) state.animState.update(dt);
      state.animState.apply(state.skeleton);
      state.skeleton.update(dt);
      state.skeleton.updateWorldTransform(SPINE.Physics.update);
      drawScene();
      updateTimeUI();
      updateFps(now);
    }
  }

  // Skeleton world coordinates (Spine pixels, y up) -> CSS pixels relative to the stage, used by the hotspot overlay.
  function projectToStage(x, y) {
    const camera = state.camera;
    if (!camera) return { x: 0, y: 0 };
    const sx = (x - camera.position.x) / camera.zoom + els.canvas.width / 2;
    const sy = -(y - camera.position.y) / camera.zoom + els.canvas.height / 2;
    return { x: sx / state.dpr, y: sy / state.dpr };
  }

  function setPlaybackEnabled(enabled) {
    for (const el of [els.playBtn, els.restartBtn, els.loopBtn, els.track, els.playAllBtn]) {
      if (el) el.disabled = !enabled;
    }
  }

  function drawScene() {
    if (!state.renderer || !state.skeleton) return;
    const gl = state.gl;
    gl.viewport(0, 0, els.canvas.width, els.canvas.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    state.renderer.begin();
    state.renderer.drawSkeleton(state.skeleton);
    if (els.bonesBtn.classList.contains('active')) {
      state.renderer.drawSkeletonDebug(state.skeleton);
    }
    state.renderer.end();
  }

  function fitView() {
    if (!state.skeleton) return;
    state.skeleton.updateWorldTransform(SPINE.Physics.update);
    const bounds = state.skeleton.getBoundsRect();
    if (!bounds || !isFinite(bounds.width) || !isFinite(bounds.height) || bounds.width <= 0 || bounds.height <= 0) return;
    const vw = els.canvas.width;
    const vh = els.canvas.height;
    const zoom = Math.max(bounds.width / (vw * 0.82), bounds.height / (vh * 0.72));
    state.camera.zoom = clamp(zoom, 0.0002, 50);
    state.camera.position.set(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2, 0);
    state.camera.update();
    state.autoFit = false;
  }

  function zoomAt(factor) {
    const vw = els.canvas.width;
    const vh = els.canvas.height;
    state.camera.zoom = clamp(state.camera.zoom * factor, 0.0002, 50);
    state.camera.update();
    state.autoFit = false;
  }

  /* ---------- loading ---------- */

  async function loadModel(id) {
    const meta = MODELS.find((m) => m.id === id);
    if (!meta) return;
    const token = ++state.loadToken;
    state.currentId = id;
    state.currentMeta = meta;
    markActiveCard(id);
    els.modelTitle.textContent = meta.name;
    els.modelSub.textContent = `${meta.sub} · ${meta.bones} 骨骼 · ${meta.anims} 段动画`;
    history.replaceState(null, '', '#' + id);
    showLoading(true, `正在加载 ${meta.name}…`);
    hideError();

    try {
      const manager = new SPINE.AssetManager(state.gl, `models/${meta.id}/`);
      manager.loadTextureAtlas(`${meta.id}.atlas`);
      manager.loadBinary(`${meta.id}.skel`);
      await manager.loadAll();
      if (token !== state.loadToken) { manager.dispose(); return; }
      if (manager.hasErrors()) {
        const firstError = manager.getErrors()[0];
        throw new Error(firstError ? (firstError.message || firstError.error?.message || String(firstError)) : '资源加载失败');
      }

      const atlas = manager.require(`${meta.id}.atlas`);
      const binary = manager.require(`${meta.id}.skel`);
      if (!atlas || !binary) throw new Error('缺少 .atlas 或 .skel 文件');

      const data = new SPINE.SkeletonBinary(new SPINE.AtlasAttachmentLoader(atlas, true)).readSkeletonData(binary);
      const skeleton = new SPINE.Skeleton(data);
      const animState = new SPINE.AnimationState(new SPINE.AnimationStateData(data));
      animState.timeScale = state.speed;
      animState.addListener({
        start: onTrackStart,
        complete: onTrackComplete
      });

      const oldManager = state.manager;
      state.manager = manager;
      state.atlas = atlas;
      state.data = data;
      state.skeleton = skeleton;
      state.animState = animState;
      state.appliedSlots = new Set();
      state.groups = buildGroups(meta, data);
      state.outfit = {};
      for (const group of state.groups) state.outfit[group.id] = group.initialValue !== undefined ? group.initialValue : group.defaultValue;
      state.locked = costume.lockedGroups(state.groups, state.outfit);
      state.currentAnim = null;
      state.playAll = false;
      state.playAllLast = null;
      state.playing = false;

      renderAnimList();
      renderOutfit();
      renderInfo(meta);
      applyAppearance(true);

      const startAnim = data.findAnimation(meta.defaultAnim)
        ? meta.defaultAnim
        : (data.animations[0] && data.animations[0].name);
      if (startAnim) playAnimation(startAnim, { silent: true });

      state.animState.update(0);
      state.animState.apply(skeleton);
      skeleton.updateWorldTransform(SPINE.Physics.update);
      state.autoFit = true;
      fitView();
      drawScene();
      showLoading(false);
      await game.onModelLoaded(meta.id);
      if (token !== state.loadToken) return;
      if (oldManager) {
        try { oldManager.dispose(); } catch (_) { /* ignore */ }
      }
      state.lastTime = performance.now();
    } catch (err) {
      if (token !== state.loadToken) return;
      console.error(err);
      showLoading(false);
      showError(err);
    }
  }

  function showLoading(show, text) {
    els.loading.classList.toggle('hidden', !show);
    if (text) els.loadingText.textContent = text;
  }

  function showError(err) {
    els.errorText.textContent = err && err.message ? err.message : String(err);
    els.errorBox.classList.remove('hidden');
  }

  function hideError() {
    els.errorBox.classList.add('hidden');
  }

  function showFatal(message) {
    els.loading.classList.add('hidden');
    els.errorText.textContent = message;
    els.errorBox.classList.remove('hidden');
  }

  /* ---------- outfit / skin composition ---------- */

  function buildGroups(meta, data) {
    const fromItems = costume.ready() ? costume.buildGroups(meta.id, data) : null;
    if (fromItems && fromItems.length) {
      const outfit = costume.initialOutfit(meta.id, fromItems);
      for (const group of fromItems) group.initialValue = outfit[group.id];
      return fromItems;
    }
    return meta.kind === 'desk' ? buildDeskGroups() : buildCharGroups();
  }

  function buildCharGroups() {
    const defs = [
      { id: 'face', label: '面容', hint: 'FACE', pick: (n) => n.startsWith('Face/') && n !== 'Face/Default_Face' },
      { id: 'head', label: '头饰', hint: 'HEAD TOP', pick: (n) => n.startsWith('HeadTop/') && n !== 'HeadTop/Default_HeadTop' },
      { id: 'top', label: '上衣', hint: 'UPPER BODY', pick: (n) => n.startsWith('Suit/UpperBody/') && n !== 'Suit/UpperBody/Default_UpperBody' },
      { id: 'bottom', label: '下装', hint: 'LOWER BODY', pick: (n) => n.startsWith('Suit/LowerBody/') && n !== 'Suit/LowerBody/Default_LowerBody' },
      { id: 'suit', label: '套装', hint: 'COSTUME', pick: (n) => n.startsWith('Suit/Costume_') },
      { id: 'leg', label: '腿部', hint: 'LEGS', pick: (n) => n.startsWith('Leg/') && n !== 'Leg/Default_Leg' },
      { id: 'tail', label: '尾巴', hint: 'TAIL', pick: (n) => n.startsWith('Tail/') && n !== 'Tail/Default_Tail' },
      { id: 'toy', label: '道具', hint: 'PROPS', pick: (n) => n.startsWith('SexToy/') && n !== 'SexToy/Default_PinkDildo' }
    ];
    const groups = [];
    for (const def of defs) {
      const names = state.data.skins.map((s) => s.name).filter(def.pick).sort((a, b) => a.localeCompare(b));
      if (!names.length) continue;
      groups.push({
        id: def.id,
        label: def.label,
        hint: def.hint,
        defaultValue: '',
        options: [{ value: '', label: '默认' }].concat(names.map((n) => ({ value: n, label: prettifySkin(n) })))
      });
    }
    return groups;
  }

  function buildDeskGroups() {
    const defs = [
      { id: 'desktop', label: '桌面摆件', hint: 'DESKTOP', defaultSkin: 'Desktop/Juice', pick: (n) => n.startsWith('Desktop/') },
      { id: 'side', label: '桌边摆件', hint: 'DESK SIDE', defaultSkin: 'DesktopB/DeskLamp', pick: (n) => n.startsWith('DesktopB/') },
      { id: 'under', label: '桌下摆件', hint: 'UNDER DESK', defaultSkin: 'UnderDesk/Potted plants', pick: (n) => n.startsWith('UnderDesk/') }
    ];
    const groups = [];
    for (const def of defs) {
      const names = state.data.skins.map((s) => s.name).filter(def.pick);
      if (!names.length) continue;
      const options = names.map((n) => ({
        value: n,
        label: prettifyDeskSkin(n) + (n === def.defaultSkin ? '（默认）' : '')
      }));
      options.sort((a, b) => {
        if (a.value === def.defaultSkin) return -1;
        if (b.value === def.defaultSkin) return 1;
        return a.label.localeCompare(b.label, 'zh');
      });
      groups.push({ id: def.id, label: def.label, hint: def.hint, defaultValue: def.defaultSkin, options });
    }
    return groups;
  }

  function prettifySkin(name) {
    let s = name;
    if (s.startsWith('Suit/Costume_')) s = s.slice('Suit/Costume_'.length);
    else if (s.includes('/')) s = s.slice(s.lastIndexOf('/') + 1);
    s = s.replace(/^(Face|HeadTop|Stocking|UpperBody|LowerBody|Costume|Tail|Item)_/, '');
    const suffix = [];
    if (s.endsWith('_Shoes')) { suffix.push('鞋'); s = s.slice(0, -6); }
    if (s.endsWith('_HighHeel')) { suffix.push('高跟'); s = s.slice(0, -9); }
    const plain = s.replace(/_/g, ' ');
    const label = THEME_LABELS[plain.replace(/\s+/g, '')] || THEME_LABELS[plain] || plain;
    return suffix.length ? `${label} · ${suffix.join(' ')}` : label;
  }

  function prettifyDeskSkin(name) {
    const tail = name.split('/').pop();
    return DESK_SKIN_LABELS[tail] || tail.replace(/_/g, ' ');
  }

  function getSkinSequence() {
    const names = (state.currentMeta.kind === 'desk' ? DESK_BASE.slice() : CHAR_BASE.slice());
    const ordered = state.groups.slice().sort((a, b) => (a.priority || 0) - (b.priority || 0));
    for (const group of ordered) {
      const selected = state.outfit[group.id] !== undefined ? state.outfit[group.id] : group.defaultValue;
      if (selected) names.push(selected);
    }
    const skins = [];
    const seen = new Set();
    for (const name of names) {
      if (!name || seen.has(name)) continue;
      const skin = state.data.skins.find((s) => s.name === name);
      if (skin) {
        skins.push(skin);
        seen.add(name);
      }
    }
    return skins;
  }

  function applyAppearance(resetPose) {
    if (!state.skeleton || !state.data) return;
    const sequence = getSkinSequence();
    const composite = new SPINE.Skin('preview-' + state.currentMeta.id);
    for (const skin of sequence) composite.addSkin(skin);
    state.skeleton.setSkin(composite);

    if (resetPose) state.skeleton.setupPose();

    const chosen = new Map();
    for (const skin of sequence) {
      const bySlot = new Map();
      for (const entry of skin.getAttachments()) {
        let list = bySlot.get(entry.slotIndex);
        if (!list) { list = []; bySlot.set(entry.slotIndex, list); }
        list.push(entry.attachment);
      }
      for (const [slotIndex, attachments] of bySlot) {
        chosen.set(slotIndex, pickAttachment(slotIndex, attachments));
      }
    }

    for (const slotIndex of state.appliedSlots) {
      if (!chosen.has(slotIndex)) state.skeleton.slots[slotIndex].pose.setAttachment(null);
    }
    state.appliedSlots = new Set(chosen.keys());
    for (const [slotIndex, attachment] of chosen) {
      state.skeleton.slots[slotIndex].pose.setAttachment(attachment);
    }

    addLookupAliases(composite, chosen);
    state.skeleton.updateWorldTransform(SPINE.Physics.update);
  }

  function pickAttachment(slotIndex, attachments) {
    if (!attachments.length) return null;
    if (attachments.length === 1) return attachments[0];
    const setupName = state.data.slots[slotIndex].attachmentName;
    if (setupName) {
      const exact = attachments.find((a) => a.name === setupName);
      if (exact) return exact;
    }
    const filtered = attachments.filter((a) => !/(?:^|[\/_\s])(Mouse|Keying)(?:[0-9]|$)/i.test(a.name));
    const pool = filtered.length ? filtered : attachments;
    if (pool.length === 1) return pool[0];
    const slotTail = state.data.slots[slotIndex].name.split('/').pop();
    const tailMatch = pool.find((a) => a.name.split('/').pop() === slotTail);
    if (tailMatch) return tailMatch;
    const zeroMatch = pool.find((a) => /(?:^|[^0-9])0{1,2}(?:$|[^0-9])/.test(a.name.split('/').pop()));
    if (zeroMatch) return zeroMatch;
    const normalMatch = pool.find((a) => /normal|default/i.test(a.name));
    if (normalMatch) return normalMatch;
    return pool[0];
  }

  function addLookupAliases(skin, chosen) {
    const data = state.data;
    const seen = new Set();
    for (const animation of data.animations) {
      for (const timeline of animation.timelines) {
        if (!(timeline instanceof SPINE.AttachmentTimeline)) continue;
        for (const name of timeline.attachmentNames) {
          if (!name) continue;
          const key = timeline.slotIndex + '\u0000' + name;
          if (seen.has(key)) continue;
          seen.add(key);
          if (skin.getAttachment(timeline.slotIndex, name)) continue;
          const entries = [];
          skin.getAttachmentsForSlot(timeline.slotIndex, entries);
          if (!entries.length) continue;
          const wanted = name.split('/').pop();
          let match = entries.find((e) => e.attachment.name.split('/').pop() === wanted);
          if (!match) {
            match = entries.find((e) => {
              const tail = e.attachment.name.split('/').pop();
              return tail.startsWith(wanted) || wanted.startsWith(tail);
            });
          }
          if (match) skin.setAttachment(timeline.slotIndex, name, match.attachment);
        }
      }
    }
    for (const [slotIndex, attachment] of chosen) {
      const setupName = data.slots[slotIndex].attachmentName;
      if (setupName && !skin.getAttachment(slotIndex, setupName)) {
        skin.setAttachment(slotIndex, setupName, attachment);
      }
    }
  }

  /* ---------- side panels ---------- */

  function renderAnimList() {
    els.animList.innerHTML = '';
    els.animCount.textContent = String(state.data.animations.length);
    state.animEls.clear();
    state.animOrder = [];
    const grouped = groupAnimations(state.data.animations);
    for (const group of grouped) {
      const wrap = document.createElement('div');
      wrap.className = 'anim-group';
      const head = document.createElement('div');
      head.className = 'anim-group-head';
      head.innerHTML = `<span>${esc(group.label)}</span><em>${group.items.length}</em>`;
      wrap.appendChild(head);
      for (const anim of group.items) {
        const item = document.createElement('button');
        item.type = 'button';
        item.className = 'anim-item';
        item.dataset.name = anim.name;
        const duration = anim.duration > 0 ? anim.duration.toFixed(2) + 's' : '定格';
        item.innerHTML =
          `<span class="ai-icon"><svg class="ico"><use href="#i-play"/></svg></span>` +
          `<span class="ai-body"><span class="ai-name">${esc(animLabel(anim.name))}</span><span class="ai-label">${esc(anim.name)}</span></span>` +
          `<span class="ai-dur">${duration}</span>` +
          `<span class="eq"><i></i><i></i><i></i></span>`;
        item.title = `${anim.name} · ${duration}`;
        item.addEventListener('click', () => playAnimation(anim.name));
        wrap.appendChild(item);
        state.animEls.set(anim.name, item);
        state.animOrder.push(anim.name);
      }
      els.animList.appendChild(wrap);
    }
  }

  function groupAnimations(animations) {
    const map = new Map();
    for (const anim of animations) {
      const slash = anim.name.indexOf('/');
      let key;
      if (slash >= 0) key = anim.name.slice(0, slash);
      else key = anim.name.split('_')[0];
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(anim);
    }
    const keys = [...map.keys()].sort((a, b) => {
      const ia = ANIM_GROUP_ORDER.indexOf(a);
      const ib = ANIM_GROUP_ORDER.indexOf(b);
      if (ia < 0 && ib < 0) return a.localeCompare(b);
      if (ia < 0) return 1;
      if (ib < 0) return -1;
      return ia - ib;
    });
    return keys.map((key) => ({ key, label: ANIM_GROUP_LABELS[key] || key, items: map.get(key) }));
  }

  function animLabel(name) {
    return ANIM_LABELS[name] || name.split('/').pop().replace(/_/g, ' ');
  }

  function renderOutfit() {
    els.outfitList.innerHTML = '';
    if (!state.groups.length) {
      els.outfitList.innerHTML = '<p class="note">该模型没有可切换的皮肤。</p>';
      return;
    }
    state.locked = costume.ready() ? costume.lockedGroups(state.groups, state.outfit) : new Set();
    for (const group of state.groups) {
      const locked = state.locked.has(group.id);
      const row = document.createElement('div');
      row.className = `outfit-row${locked ? ' locked' : ''}`;
      const label = document.createElement('div');
      label.className = 'outfit-label';
      label.innerHTML = `<b>${esc(group.label)}</b><small>${esc(group.hint)} · ${group.options.length} 件${locked ? ' · 被套装覆盖' : ''}</small>`;
      const select = document.createElement('select');
      select.className = 'outfit-select';
      select.setAttribute('aria-label', group.label);
      select.disabled = locked;
      select.innerHTML = group.options.map((o) =>
        `<option value="${esc(o.value)}">${esc(o.item ? rarityTag(o.item.RarityEnum) + o.label : o.label)}</option>`
      ).join('');
      select.value = state.outfit[group.id] !== undefined ? state.outfit[group.id] : group.defaultValue;
      select.addEventListener('change', () => {
        state.outfit[group.id] = select.value;
        const notes = costume.ready() ? costume.resolveConflicts(state.groups, state.outfit, group.id) : [];
        applyAppearance(false);
        renderOutfit();
        const chosen = group.options.find((o) => o.value === select.value);
        const name = chosen ? chosen.label : select.options[select.selectedIndex].textContent;
        toast(notes.length ? `${group.label}：${name}（${notes.join('；')}）` : `${group.label}：${name}`);
      });
      row.appendChild(label);
      row.appendChild(select);
      const current = group.options.find((o) => o.value === state.outfit[group.id]);
      if (current && current.item) {
        const desc = costume.descriptionOf(current.item);
        if (desc) {
          const hint = document.createElement('p');
          hint.className = 'outfit-desc';
          hint.textContent = desc;
          row.appendChild(hint);
        }
      }
      els.outfitList.appendChild(row);
    }
  }

  function rarityTag(rarity) {
    return rarity && rarity !== 'N' ? `${rarity} · ` : '';
  }

  function renderInfo(meta) {
    const pages = state.atlas && state.atlas.pages
      ? state.atlas.pages.map((p) => `${p.width}×${p.height}`).join(' · ')
      : '—';
    const cells = [
      ['模型', meta.name],
      ['Spine 版本', state.data.version],
      ['骨骼', state.data.bones.length],
      ['槽位', state.data.slots.length],
      ['皮肤', state.data.skins.length],
      ['动画', state.data.animations.length],
      ['实时 FPS', '—', 'infoFps'],
      ['画布', `${els.canvas.width}×${els.canvas.height}`, 'infoRes'],
      ['图集页面', pages, 'infoPages'],
      ['渲染器', 'spine-webgl 4.3.13', 'infoRenderer']
    ];
    els.infoGrid.innerHTML = cells.map(([label, value, id]) =>
      `<div class="info-cell${label === '图集页面' ? ' wide' : ''}"><span>${esc(label)}</span><b${id ? ` id="${id}"` : ''}>${esc(String(value))}</b></div>`
    ).join('');
  }

  /* ---------- animation control ---------- */

  function playAnimation(name, options) {
    if (!state.data || !state.animState) return;
    const animation = state.data.findAnimation(name);
    if (!animation) return;
    const opts = options || {};

    if (!opts.keepPlayAll) {
      state.playAll = false;
      state.playAllLast = null;
      updatePlayAllBtn();
    }

    state.animState.clearTracks();
    const entry = state.animState.setAnimation(0, animation, state.loop && animation.duration > 0);
    if (animation.duration === 0) entry.loop = false;
    state.currentAnim = animation.name;
    state.playing = true;
    state.animState.timeScale = state.speed;
    highlightAnim(animation.name);
    updateNowPlaying(animation.name);
    updatePlayButton();
    if (animation.duration === 0) {
      state.animState.update(0);
      state.animState.apply(state.skeleton);
      state.skeleton.updateWorldTransform(SPINE.Physics.update);
    }
  }

  function togglePlay() {
    if (!state.skeleton) return;
    if (!state.currentAnim) {
      const meta = state.currentMeta;
      playAnimation(meta.defaultAnim || meta.firstAnim);
      return;
    }
    const entry = state.animState.getTrack(0);
    if (state.playing) {
      state.playing = false;
    } else {
      state.playing = true;
      if (entry && entry.animation.duration > 0 && entry.trackTime >= entry.animation.duration - 0.0001) {
        entry.trackTime = 0;
        entry.animationLast = -0.0001;
      }
    }
    updatePlayButton();
  }

  function restartAnimation() {
    if (!state.currentAnim) {
      playAnimation(state.currentMeta.defaultAnim);
      return;
    }
    playAnimation(state.currentAnim, { silent: true });
    state.playing = true;
    updatePlayButton();
  }

  function toggleLoop() {
    state.loop = !state.loop;
    els.loopBtn.classList.toggle('active', state.loop);
    els.loopBtn.setAttribute('aria-pressed', String(state.loop));
    const entry = state.animState && state.animState.getTrack(0);
    if (entry && !state.playAll) entry.loop = state.loop && entry.animation.duration > 0;
    toast(state.loop ? '已开启循环播放' : '已关闭循环播放');
  }

  function playAll() {
    if (!state.data || !state.animOrder.length) return;
    if (state.playAll) {
      state.playAll = false;
      state.playAllLast = null;
      updatePlayAllBtn();
      return;
    }
    state.playAll = true;
    state.playAllLast = state.animOrder[state.animOrder.length - 1];
    state.animState.clearTracks();
    const first = state.data.findAnimation(state.animOrder[0]);
    if (!first) return;
    state.animState.setAnimation(0, first, false);
    for (let i = 1; i < state.animOrder.length; i++) {
      const anim = state.data.findAnimation(state.animOrder[i]);
      if (anim) state.animState.addAnimation(0, anim, false, 0);
    }
    state.playing = true;
    state.currentAnim = first.name;
    highlightAnim(first.name);
    updateNowPlaying(first.name);
    updatePlayButton();
    updatePlayAllBtn();
    toast(`连续播放 ${state.animOrder.length} 段动画`);
  }

  function updatePlayAllBtn() {
    els.playAllBtn.textContent = state.playAll ? '停止轮播' : '播放全部';
    els.playAllBtn.classList.toggle('active', state.playAll);
  }

  function onTrackStart(entry) {
    if (!state.animState || entry.trackIndex !== 0) return;
    state.currentAnim = entry.animation.name;
    state.playing = true;
    highlightAnim(entry.animation.name);
    updateNowPlaying(entry.animation.name);
    updatePlayButton();
  }

  function onTrackComplete(entry) {
    if (entry.trackIndex !== 0) return;
    if (state.playAll && entry.animation.name === state.playAllLast) {
      state.playAll = false;
      state.playAllLast = null;
      state.playing = false;
      updatePlayAllBtn();
      updatePlayButton();
      return;
    }
    if (!state.playAll && !entry.loop) {
      state.playing = false;
      updatePlayButton();
    }
  }

  function highlightAnim(name) {
    for (const [animName, el] of state.animEls) {
      el.classList.toggle('active', animName === name);
    }
  }

  function updateNowPlaying(name) {
    els.animName.textContent = animLabel(name);
    els.animName.title = name;
  }

  function updatePlayButton() {
    if (els.playUse) els.playUse.setAttribute('href', state.playing ? '#i-pause' : '#i-play');
    els.playBtn.setAttribute('aria-label', state.playing ? '暂停' : '播放');
  }

  function updateTimeUI() {
    const entry = state.animState && state.animState.getTrack(0);
    const duration = entry && entry.animation ? entry.animation.duration : 0;
    let time = 0;
    if (entry) {
      time = entry.getAnimationTime();
      if (!entry.loop && entry.trackTime >= duration) time = duration;
    }
    if (duration > 0) time = Math.min(time, duration);
    const pct = duration > 0 ? clamp(time / duration, 0, 1) : 0;
    els.trackFill.style.width = `${pct * 100}%`;
    if (document.activeElement !== els.track) els.track.value = String(pct);
    els.timeLabel.textContent = duration > 0 ? `${time.toFixed(2)} / ${duration.toFixed(2)}s` : '定格';
  }

  function seekFraction(fraction) {
    const entry = state.animState && state.animState.getTrack(0);
    if (!entry) return;
    const duration = entry.animation.duration;
    if (!(duration > 0)) return;
    entry.trackTime = clamp(fraction, 0, 1) * duration;
    entry.animationLast = -0.0001;
    entry.trackLast = entry.trackTime;
    state.animState.apply(state.skeleton);
    state.skeleton.updateWorldTransform(SPINE.Physics.update);
    updateTimeUI();
  }

  function nudge(amount) {
    const entry = state.animState && state.animState.getTrack(0);
    if (!entry || !(entry.animation.duration > 0)) return;
    seekFraction((entry.trackTime / entry.animation.duration) + amount);
  }

  /* ---------- UI events ---------- */

  function bindUI() {
    els.playBtn.addEventListener('click', togglePlay);
    els.restartBtn.addEventListener('click', restartAnimation);
    els.loopBtn.addEventListener('click', toggleLoop);
    els.playAllBtn.addEventListener('click', playAll);
    els.speedSel.addEventListener('change', () => {
      state.speed = parseFloat(els.speedSel.value) || 1;
      if (state.animState) state.animState.timeScale = state.speed;
      toast(`播放速度 ${state.speed}×`);
    });
    els.track.addEventListener('input', () => seekFraction(parseFloat(els.track.value)));

    els.fitBtn.addEventListener('click', () => { fitView(); toast('已适应窗口'); });
    els.gridBtn.addEventListener('click', () => {
      const active = els.gridBtn.classList.toggle('active');
      els.stage.classList.toggle('no-grid', !active);
    });
    els.bonesBtn.addEventListener('click', () => {
      els.bonesBtn.classList.toggle('active');
    });
    els.shotBtn.addEventListener('click', exportPng);
    els.zoomIn.addEventListener('click', () => zoomAt(0.82));
    els.zoomOut.addEventListener('click', () => zoomAt(1.22));

    els.randomBtn.addEventListener('click', randomizeOutfit);
    els.resetBtn.addEventListener('click', resetOutfit);
    els.retryBtn.addEventListener('click', () => loadModel(state.currentId || MODELS[0].id));

    els.browseModeBtn.addEventListener('click', () => setGameMode(false));
    els.gameModeBtn.addEventListener('click', () => setGameMode(true));
    els.gameResetBtn.addEventListener('click', () => {
      if (!game.animator) return;
      game.animator.reset();
      game.logEvent('info', '状态机已重置到入口');
    });

    for (const tab of document.querySelectorAll('.tab')) {
      tab.addEventListener('click', () => activateTab(tab.dataset.tab));
    }

    els.canvas.addEventListener('pointerdown', onPointerDown);
    els.canvas.addEventListener('pointermove', onPointerMove);
    els.canvas.addEventListener('pointerup', onPointerUp);
    els.canvas.addEventListener('pointercancel', onPointerUp);
    els.canvas.addEventListener('wheel', onWheel, { passive: false });
    els.canvas.addEventListener('dblclick', () => fitView());

    window.addEventListener('keydown', onKeyDown);
  }

  function activateTab(name) {
    for (const tab of document.querySelectorAll('.tab')) {
      tab.classList.toggle('active', tab.dataset.tab === name);
      tab.setAttribute('aria-selected', String(tab.dataset.tab === name));
    }
    for (const panel of document.querySelectorAll('.tab-panel')) {
      panel.classList.toggle('active', panel.id === 'tab-' + name);
    }
  }

  function setGameMode(on) {
    if (on && !game.animator) {
      toast('该模型没有对应的互动状态机');
      return;
    }
    game.setActive(on);
    if (on) {
      activateTab('game');
      toast('游戏模式：状态机与交互已接管播放');
    } else {
      playAnimation(state.currentAnim || state.currentMeta.defaultAnim, { silent: true });
      toast('已恢复浏览模式');
    }
  }

  function randomizeOutfit() {
    if (!state.groups.length) return;
    let notes = [];
    if (costume.ready()) notes = costume.randomize(state.groups, state.outfit);
    else {
      for (const group of state.groups) {
        const options = group.options;
        if (options.length < 2) continue;
        const pick = options[Math.floor(Math.random() * options.length)];
        state.outfit[group.id] = pick.value;
      }
    }
    renderOutfit();
    applyAppearance(false);
    toast(notes.length ? `随机换装（${notes.join('；')}）` : '已随机组合造型');
  }

  function resetOutfit() {
    for (const group of state.groups) {
      state.outfit[group.id] = group.initialValue !== undefined ? group.initialValue : group.defaultValue;
    }
    renderOutfit();
    applyAppearance(false);
    toast(costume.ready() && costume.poseRow(state.currentId) ? '已恢复游戏初始穿搭' : '造型已重置');
  }

  function exportPng() {
    if (!state.skeleton) return;
    drawScene();
    const name = `${state.currentId}-${(state.currentAnim || 'pose').replace(/[\\/:*?"<>|]/g, '_')}.png`;
    const link = document.createElement('a');
    link.download = name;
    link.href = els.canvas.toDataURL('image/png');
    link.click();
    toast('当前帧已导出');
  }

  /* ---------- camera input ---------- */

  function onPointerDown(event) {
    if (event.button !== 0) return;
    state.dragging = true;
    state.clickStart = { x: event.clientX, y: event.clientY };
    state.dragStart = {
      x: event.clientX,
      y: event.clientY,
      cx: state.camera.position.x,
      cy: state.camera.position.y
    };
    els.canvas.setPointerCapture(event.pointerId);
    els.canvas.classList.add('dragging');
  }

  function onPointerMove(event) {
    if (!state.dragging || !state.dragStart) return;
    const dx = event.clientX - state.dragStart.x;
    const dy = event.clientY - state.dragStart.y;
    state.camera.position.x = state.dragStart.cx - dx * state.dpr * state.camera.zoom;
    state.camera.position.y = state.dragStart.cy + dy * state.dpr * state.camera.zoom;
    state.camera.update();
    state.autoFit = false;
  }

  function onPointerUp(event) {
    if (!state.dragging) return;
    state.dragging = false;
    state.dragStart = null;
    els.canvas.classList.remove('dragging');
    if (state.clickStart) {
      const moved = Math.abs(event.clientX - state.clickStart.x) + Math.abs(event.clientY - state.clickStart.y);
      if (moved < 4) game.onCanvasClick();
      state.clickStart = null;
    }
    try { els.canvas.releasePointerCapture(event.pointerId); } catch (_) { /* ignore */ }
  }

  function onWheel(event) {
    if (!state.camera) return;
    event.preventDefault();
    const rect = els.canvas.getBoundingClientRect();
    const sx = (event.clientX - rect.left) * state.dpr;
    const sy = (event.clientY - rect.top) * state.dpr;
    const zoom = state.camera.zoom;
    const wx = state.camera.position.x + (sx - els.canvas.width / 2) * zoom;
    const wy = state.camera.position.y - (sy - els.canvas.height / 2) * zoom;
    const next = clamp(zoom * Math.exp(event.deltaY * 0.0014), 0.0002, 50);
    state.camera.zoom = next;
    state.camera.position.x = wx - (sx - els.canvas.width / 2) * next;
    state.camera.position.y = wy + (sy - els.canvas.height / 2) * next;
    state.camera.update();
    state.autoFit = false;
  }

  function onKeyDown(event) {
    const target = event.target;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'SELECT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    const key = event.key;
    if (game.active && game.onKeyDownEvent(key)) {
      if (key !== ' ' && key !== 'Enter') event.preventDefault();
    }
    if (key === ' ') {
      event.preventDefault();
      if (game.active) game.fireLevelTrigger();
      else togglePlay();
    } else if (key === 'ArrowLeft') {
      event.preventDefault();
      nudge(-0.05);
    } else if (key === 'ArrowRight') {
      event.preventDefault();
      nudge(0.05);
    } else if (key === 'f' || key === 'F') {
      fitView();
    } else if (key === 'b' || key === 'B') {
      els.bonesBtn.click();
    } else if (key === 'g' || key === 'G') {
      els.gridBtn.click();
    } else if (key >= '1' && key <= String(MODELS.length)) {
      const meta = MODELS[Number(key) - 1];
      if (meta) switchModel(meta.id);
    }
  }

  /* ---------- misc ---------- */

  function updateFps(now) {
    state.fpsFrames++;
    if (!state.fpsMark) state.fpsMark = now;
    if (now - state.fpsMark >= 600) {
      state.fps = Math.round((state.fpsFrames * 1000) / (now - state.fpsMark));
      state.fpsFrames = 0;
      state.fpsMark = now;
      const cell = document.getElementById('infoFps');
      if (cell) cell.textContent = String(state.fps);
      const res = document.getElementById('infoRes');
      if (res) res.textContent = `${els.canvas.width}×${els.canvas.height}`;
    }
  }

  function toast(message) {
    clearTimeout(state.toastTimer);
    els.toast.textContent = message;
    els.toast.classList.add('show');
    state.toastTimer = setTimeout(() => els.toast.classList.remove('show'), 1900);
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function esc(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

})();
