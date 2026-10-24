/*!
 * Your Coworker · 网站看板娘（独立组件包）
 * 由 Mabbs/your-coworker（Spine Studio）改造而来的可嵌入网页组件：
 *   - 角色悬浮在页面任意位置，可随意拖动（仅命中角色不透明像素时才接管事件，不遮挡页面）
 *   - 完整换装系统（游戏 ItemTable：头饰 / 面饰 / 套装 / 上衣 / 下装 / 腿部 / 尾巴 / 道具）
 *   - 待机呼吸、随机小动作、点击互动、气泡对话、视线跟随、键鼠联动
 *   - 位置 / 大小 / 穿搭自动保存在 localStorage
 *
 * 本目录是自包含包：vendor / costume.js / models / data 全部在包内，
 * 可整体拷贝到任意静态目录或 CDN 使用。
 *
 * 用法（需通过 HTTP 服务访问，file:// 下 fetch 会失败）：
 *   <script src="/path/to/waifu-widget/waifu-widget.js" defer></script>
 *   <script> window.addEventListener('DOMContentLoaded', function () { WaifuWidget.mount(); }); </script>
 *
 * 或一行自动挂载：
 *   <script src="/path/to/waifu-widget/waifu-widget.js" data-ycw-auto defer></script>
 *
 * WaifuWidget.mount(options) 可选项：
 *   base    资源根目录（默认：组件脚本所在目录，即本包根目录）
 *   width   角色显示宽度 px，默认 300
 *   x, y    初始位置（默认左下角）
 */
(() => {
  'use strict';

  const POSE_ID = 'PoseA';
  const DESK_ID = 'DefaultDesk';
  // 办公桌场景基底皮肤：椅子 / 桌体 / 电脑 + 游戏默认桌面摆件（果汁 / 台灯 / 盆栽）
  const DESK_BASE = ['default', 'Base_Chair', 'Base_Desk', 'Computer', 'Desktop/Juice', 'DesktopB/DeskLamp', 'UnderDesk/Potted plants'];
  const STORE_KEY = 'ycw:state:v1';

  // 与预览器一致的组合基底皮肤（app.js CHAR_BASE）
  const CHAR_BASE = [
    'default', 'Base',
    'HeadTop/Default_HeadTop',
    'Leg/Default_Leg',
    'Suit/UpperBody/Default_UpperBody',
    'Suit/LowerBody/Default_LowerBody',
    'Tail/Default_Tail'
  ];

  const LINES = {
    greet: ['嗨～我是你的网页看板娘！', '今天也要一起加油哦！', '拖我去你想去的角落吧～'],
    drag: ['呀！要带我去哪？', '抓稳啦～', '起飞咯！', '放轻点嘛～'],
    drop: ['就待在这里吧～', '新位置不错！', '呼…安全着陆'],
    click: ['嘿嘿，好痒～', '别戳啦～', '摸头杀？', '呜哇！', '再摸要生气了哦～', '工作的时候不要摸鱼摸我！'],
    deviceKey: ['敲得真快！', '在写什么呢？', '加油打字～', '噼里啪啦～'],
    deviceClick: ['点点点～', '看到你在点鼠标～', '又点什么好玩的了？'],
    idle: ['键盘敲得咔哒响…', '点点鼠标…', '尾巴摇摇～', '有点无聊呢…', '在忙什么呀？', '记得多喝水哦～'],
    costume: ['换好衣服啦！', '这套怎么样？', '转个圈给你看～'],
    random: ['今日份随机穿搭！', '闭上眼睛……叮！'],
    reset: ['恢复出厂穿搭～'],
    hidden: ['我先躲起来，想我了就点右下角～']
  };

  // 互动动画池（加载后按模型实际拥有的动画过滤）
  const ACTION_POOLS = {
    idle: ['Click_Mouse', 'Click_Keyboard_TwoHand', 'Tail_Loop', 'Mood/Talking', 'Mood/Bored', 'Mood/Happy'],
    click: ['Touch_Chest', 'Touch_Chest', 'Touch_Chest', 'Face_Work', 'Mood/Shy', 'Mood/Happy']
  };

  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const pick = (list) => list[Math.floor(Math.random() * list.length)];

  // 情绪专属装饰（脸红 / 泪痕）由情绪动画驱动显隐，setup 落地会粘住。
  // 注意：Slash 槽位是睁眼 / 闭眼的上眼皮线，由眨眼层（Mood/Default）管理，不能在这里清除。
  const DECOR_ATTACHMENT = /FaceRed|Tear|Blush/i;

  // 视线跟随：头部最大偏转角与瞳孔驱动幅度（经 EyeBall-to-EyeR2/EyeL2 约束 50% 混合后，
  // 瞳孔实际位移约为命令值的一半；此幅度保证瞳孔始终留在眼白内）。
  // EyeBall 本地轴相对世界旋转约 90°：本地 X → 世界垂直，本地 Y → 世界水平。
  const LOOK_HEAD_MAX = 11;
  const LOOK_EYE_H = 26;
  const LOOK_EYE_V = 16;

  /* ---------- 工具 ---------- */

  function resolveBase(explicit) {
    if (explicit) return explicit.endsWith('/') ? explicit : explicit + '/';
    const el = document.currentScript;
    if (el && el.src) return new URL('.', el.src).href;
    const tags = document.querySelectorAll('script[src*="waifu-widget"]');
    if (tags.length) return new URL('.', tags[tags.length - 1].src).href;
    return location.href;
  }

  function loadScript(url) {
    return new Promise((resolve, reject) => {
      const tag = document.createElement('script');
      tag.src = url;
      tag.onload = resolve;
      tag.onerror = () => reject(new Error('脚本加载失败：' + url));
      document.head.appendChild(tag);
    });
  }

  function storeRead() {
    try { return JSON.parse(localStorage.getItem(STORE_KEY) || '{}') || {}; } catch (_) { return {}; }
  }
  function storeWrite(patch) {
    try {
      const data = storeRead();
      Object.assign(data, patch);
      localStorage.setItem(STORE_KEY, JSON.stringify(data));
    } catch (_) { /* 隐私模式下静默失败 */ }
  }

  function esc(value) {
    return String(value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  /* ---------- 组件 ---------- */

  class WaifuWidgetInstance {
    constructor(options) {
      const saved = storeRead();
      this.opts = options || {};
      this.base = resolveBase(this.opts.base);
      this.scale = clamp(saved.scale || 1, 0.55, 1.8);
      this.savedOutfit = saved.outfit || null;
      this.deskOn = saved.deskOn === true;
      this.deskSkeleton = null;
      this.x = null;
      this.y = null;
      if (Number.isFinite(this.opts.x) && Number.isFinite(this.opts.y)) {
        this.x = this.opts.x; this.y = this.opts.y;
      } else if (Number.isFinite(saved.x) && Number.isFinite(saved.y)) {
        this.x = saved.x; this.y = saved.y;
      }
      this.ready = false;
      this.hidden = false;
      this.drag = null;
      // 拖拽惯性：速度驱动骨架小幅位移，让头发 / 尾巴的物理骨骼跟随飘动
      this.motion = { vx: 0, vy: 0, swayX: 0, swayY: 0 };
      this.cameraBase = { x: 0, y: 0 };
      // 视线跟随：指针位置 → 头部偏转 + 瞳孔位移（平滑趋近）
      this.pointer = null;
      this.look = { x: 0, y: 0, tx: 0, ty: 0 };
      this.headBone = null;
      this.eyeBallBone = null;
      this.suppressClickUntil = 0;
      this.actionToken = 0;
      this.nextAct = 0;
      this.raf = 0;
      this.lastTime = 0;
      this.tipTimer = 0;
      this.groups = [];
      this.outfit = {};
      this.locked = new Set();
      this.appliedSlots = new Set();
      this.pools = { idle: [], click: [] };
      this.hitPixel = new Uint8Array(4);
      this.buildDom();
    }

    /* ---------- DOM ---------- */

    buildDom() {
      const root = document.createElement('div');
      root.className = 'ycw-root';
      root.innerHTML =
        '<div class="ycw-stage">' +
          '<canvas class="ycw-canvas"></canvas>' +
          '<div class="ycw-loading"><i></i><span>看板娘赶来中…</span></div>' +
          '<div class="ycw-bubble"></div>' +
        '</div>' +
        '<div class="ycw-dock">' +
          '<button data-act="wardrobe" title="换装">👕</button>' +
          '<button data-act="random" title="随机穿搭">🎲</button>' +
          '<button data-act="desk" title="办公桌">🖥️</button>' +
          '<div class="ycw-sep"></div>' +
          '<button data-act="zoom-in" title="放大">＋</button>' +
          '<button data-act="zoom-out" title="缩小">－</button>' +
          '<div class="ycw-sep"></div>' +
          '<button data-act="hide" title="收起">✕</button>' +
        '</div>' +
        '<div class="ycw-panel">' +
          '<div class="ycw-panel-head">' +
            '<div><b>换装间</b><small>衣柜数据来自游戏 ItemTable</small></div>' +
            '<button class="ycw-panel-close" data-act="close-panel" title="收起面板">✕</button>' +
          '</div>' +
          '<div class="ycw-panel-body"></div>' +
          '<div class="ycw-panel-foot">' +
            '<button data-act="random">🎲 随机搭配</button>' +
            '<button data-act="reset-outfit">↺ 初始穿搭</button>' +
          '</div>' +
        '</div>';

      const restore = document.createElement('button');
      restore.type = 'button';
      restore.className = 'ycw-restore';
      restore.innerHTML = '<span>👧</span> 召回看板娘';

      document.body.appendChild(root);
      document.body.appendChild(restore);

      this.root = root;
      this.restoreBtn = restore;
      this.stage = root.querySelector('.ycw-stage');
      this.canvas = root.querySelector('.ycw-canvas');
      this.loadingEl = root.querySelector('.ycw-loading');
      this.bubble = root.querySelector('.ycw-bubble');
      this.dock = root.querySelector('.ycw-dock');
      this.panel = root.querySelector('.ycw-panel');
      this.panelBody = root.querySelector('.ycw-panel-body');

      this.dock.addEventListener('click', (e) => this.onDockClick(e));
      this.panel.addEventListener('click', (e) => this.onDockClick(e));
      this.restoreBtn.addEventListener('click', () => this.show());
    }

    injectCss() {
      if (document.querySelector('link[data-ycw-css]')) return;
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = this.base + 'waifu-widget.css';
      link.dataset.ycwCss = '';
      document.head.appendChild(link);
    }

    /* ---------- 启动 ---------- */

    async boot() {
      this.injectCss();
      this.setLoading('正在加载 Spine 运行时…');
      if (!window.spine) await loadScript(this.base + 'vendor/spine-webgl.min.js');
      if (!window.spine) throw new Error('Spine 运行时不可用');
      this.setLoading('正在加载换装数据…');
      if (!window.CostumeService) {
        try { await loadScript(this.base + 'costume.js'); } catch (_) { /* 退化为皮肤扫描模式 */ }
      }

      this.initRenderer();
      await this.loadModelOrRetry();

      this.ready = true;
      this.loadingEl.style.display = 'none';
      this.bindPageEvents();
      if (this.deskOn && this.deskSkeleton) {
        this.dock.querySelector('[data-act="desk"]').classList.add('ycw-on');
      }
      this.applyPose();
      this.scheduleAction(1.6);
      this.lastTime = performance.now();
      this.raf = requestAnimationFrame(this.loop);
      this.say(pick(LINES.greet), 3400);
      return this;
    }

    setLoading(text) {
      const span = this.loadingEl.querySelector('span');
      if (span) span.textContent = text;
    }

    initRenderer() {
      const SPINE = window.spine;
      if (this.resizeObserver) this.resizeObserver.disconnect();
      const attrs = { alpha: true, antialias: true, premultipliedAlpha: true, preserveDrawingBuffer: true };
      this.context = new SPINE.ManagedWebGLRenderingContext(this.canvas, attrs);
      this.gl = this.context.gl;
      this.renderer = new SPINE.SceneRenderer(this.canvas, this.context, false);
      this.camera = this.renderer.camera;
      this.resizeObserver = new ResizeObserver(() => this.resizeCanvas());
      this.resizeObserver.observe(this.stage);
    }

    // 加载超时（典型原因：WebGL 上下文丢失）时，换一块全新画布重建上下文再试一次
    async loadModelOrRetry() {
      try {
        await this.loadModel();
      } catch (error) {
        if (!this.loadTimedOut || this.retried) throw error;
        this.retried = true;
        this.loadTimedOut = false;
        this.setLoading('画布上下文异常，正在重建重试…');
        const fresh = this.canvas.cloneNode(false);
        this.canvas.replaceWith(fresh);
        this.canvas = fresh;
        this.initRenderer();
        await this.loadModel();
      }
    }

    async loadModel() {
      const SPINE = window.spine;
      this.setLoading('正在加载角色模型…');
      const manager = new SPINE.AssetManager(this.context, this.base + 'models/');
      manager.loadTextureAtlas(POSE_ID + '/' + POSE_ID + '.atlas');
      manager.loadBinary(POSE_ID + '/' + POSE_ID + '.skel');
      manager.loadTextureAtlas(DESK_ID + '/' + DESK_ID + '.atlas');
      manager.loadBinary(DESK_ID + '/' + DESK_ID + '.skel');
      // 极端情况下（如 WebGL 上下文丢失）loadAll 的回调永远不会完成；
      // 用超时看门狗兜底，由 boot 重建画布后自动重试
      const watchdog = new Promise((_, reject) => {
        this.loadTimer = setTimeout(() => {
          this.loadTimedOut = true;
          reject(new Error('模型加载超时'));
        }, 30000);
      });
      await Promise.race([manager.loadAll(), watchdog]);
      clearTimeout(this.loadTimer);
      if (manager.hasErrors()) {
        throw new Error(Object.values(manager.getErrors()).map((e) => e.message || String(e)).join('；'));
      }
      const atlas = manager.require(POSE_ID + '/' + POSE_ID + '.atlas');
      const binary = manager.require(POSE_ID + '/' + POSE_ID + '.skel');
      this.manager = manager;

      const data = new SPINE.SkeletonBinary(new SPINE.AtlasAttachmentLoader(atlas, true)).readSkeletonData(binary);
      const skeleton = new SPINE.Skeleton(data);
      skeleton.setupPose();
      skeleton.updateWorldTransform(SPINE.Physics.reset);

      const stateData = new SPINE.AnimationStateData(data);
      stateData.defaultMix = 0.25;
      const animState = new SPINE.AnimationState(stateData);
      animState.addListener({
        // 轨道 2 的一次性动作播完后淡出回落，底下的待机 / 眨眼 / 尾巴持续播放。
        // 必须忽略空动画自身的 complete，否则 setEmptyAnimation 会自我循环，
        // 并把后续新动作在播出的瞬间就清掉。
        complete: (entry) => {
          if (entry.trackIndex !== 2) return;
          const name = entry.animation && entry.animation.name;
          if (!name || /empty/i.test(name)) return;
          this.animState.setEmptyAnimation(2, 0.25);
          this.scheduleDecorClear();
        }
      });

      this.data = data;
      this.skeleton = skeleton;
      this.animState = animState;

      // 待机动画与互动池
      const has = (name) => !!data.findAnimation(name);
      this.idleName = has('Motion_Idle') ? 'Motion_Idle' : (data.animations[0] && data.animations[0].name);
      this.pools.idle = ACTION_POOLS.idle.filter(has);
      this.pools.click = ACTION_POOLS.click.filter(has);
      if (!this.pools.click.length) {
        this.pools.click = data.animations
          .map((a) => a.name)
          .filter((n) => /^Touch/i.test(n) && !/Sex|Chest(Size)?Reset/i.test(n))
          .slice(0, 5);
      }
      // 轨道布局（高轨道覆盖低轨道）：
      //   0 待机呼吸 · 1 眨眼/表情（Mood/Default，纯面部层循环）
      //   2 一次性互动动作 · 3 尾巴循环
      this.animState.setAnimation(0, this.idleName, true);
      if (has('Mood/Default')) this.animState.setAnimation(1, 'Mood/Default', true);
      if (has('Tail_Loop')) this.animState.setAnimation(3, 'Tail_Loop', true);

      // 视线跟随的目标骨骼（PoseA 命名；其他模型缺失时自动关闭该功能）。
      // 瞳孔驱动点：EyeBall 骨骼经 EyeBall-to-EyeR2/EyeL2 约束带动双侧瞳孔。
      this.headBone = skeleton.findBone('NeckAndHead') || null;
      this.eyeBallBone = skeleton.findBone('EyeBall') || null;

      // HeadAngle→EyeR/EyeL 两条变换约束（mix≈0.4）会在头部转动时把眼眶 / 睫毛
      // 额外平移，视线跟随时睫毛滑动很显眼；这里清零其平移混合，
      // 睫毛只随头部整体旋转（与面部其余部分一致），不再额外滑动。
      for (const constraint of skeleton.constraints || []) {
        const sourceName = constraint.source && constraint.source.data ? constraint.source.data.name : null;
        if (sourceName !== 'HeadAngle' || !constraint.bones) continue;
        const hitsEye = constraint.bones.some((item) => {
          const bone = item && item.bone ? item.bone : item;
          const name = bone && bone.data ? bone.data.name : null;
          return name === 'EyeR' || name === 'EyeL';
        });
        if (!hitsEye || !constraint.pose) continue;
        constraint.pose.mixX = 0;
        constraint.pose.mixY = 0;
        if (constraint.appliedPose) {
          constraint.appliedPose.mixX = 0;
          constraint.appliedPose.mixY = 0;
        }
      }

      // 办公桌场景骨架（椅子 + 桌体 + 电脑）。
      // DefaultDesk 与 PoseA 在游戏里挂在同一父节点下，骨架坐标空间一致，零偏移叠加即可。
      try {
        const deskAtlas = manager.require(DESK_ID + '/' + DESK_ID + '.atlas');
        const deskBinary = manager.require(DESK_ID + '/' + DESK_ID + '.skel');
        const deskData = new SPINE.SkeletonBinary(new SPINE.AtlasAttachmentLoader(deskAtlas, true)).readSkeletonData(deskBinary);
        const desk = new SPINE.Skeleton(deskData);
        const deskSkin = new SPINE.Skin('desk');
        for (const name of DESK_BASE) {
          const skin = deskData.findSkin(name);
          if (skin) deskSkin.addSkin(skin);
        }
        desk.setSkin(deskSkin);
        desk.setupPose();
        desk.updateWorldTransform(SPINE.Physics.pose);
        this.deskSkeleton = desk;
      } catch (_) {
        this.deskSkeleton = null; // 桌子资源缺失时仅隐藏办公桌按钮场景
      }

      // 换装分组：优先 ItemTable，失败则按皮肤名扫描
      if (window.CostumeService) {
        this.costume = new window.CostumeService(this.base);
        await this.costume.load().catch(() => null);
      }
      this.groups = (this.costume && this.costume.ready())
        ? (this.costume.buildGroups(POSE_ID, data) || [])
        : this.scanGroups();
      this.outfit = {};
      for (const group of this.groups) {
        this.outfit[group.id] = group.defaultValue !== undefined ? group.defaultValue : '';
      }
      if (this.costume && this.costume.ready()) {
        const initial = this.costume.initialOutfit(POSE_ID, this.groups);
        Object.assign(this.outfit, initial);
      }
      // 恢复上次穿搭（逐项校验）
      if (this.savedOutfit) {
        for (const group of this.groups) {
          const value = this.savedOutfit[group.id];
          if (value !== undefined && group.options.some((o) => o.value === value)) {
            this.outfit[group.id] = value;
          }
        }
      }
      this.applyAppearance();
      this.alignDeskToChair();
      this.renderPanel();
      this.computeContentBounds();
      this.setStageSize();
      this.placeInitial();
    }

    // 办公桌对齐：角色骨架自带 Chair_01/02/03 椅子槽位（一直渲染在她身后），
    // 以桌子的 Chair 槽位包围盒中心对准她椅子的包围盒中心，
    // 然后隐藏桌子侧椅子（保留角色自带的），桌子其余部件画在角色前面。
    alignDeskToChair() {
      const SPINE = window.spine;
      const desk = this.deskSkeleton;
      if (!desk) return;
      const keepBounds = (skeleton, keep) => {
        const hidden = [];
        for (const slot of skeleton.slots) {
          const att = slot.pose.getAttachment();
          if (att && !keep(slot)) { hidden.push([slot, att]); slot.pose.setAttachment(null); }
        }
        skeleton.updateWorldTransform(SPINE.Physics.pose);
        const b = skeleton.getBoundsRect();
        for (const [slot, att] of hidden) slot.pose.setAttachment(att);
        skeleton.updateWorldTransform(SPINE.Physics.pose);
        return b && isFinite(b.width) && b.width > 0 ? b : null;
      };
      const girlChair = keepBounds(this.skeleton, (s) => /Chair/i.test(s.data.name));
      const deskChair = keepBounds(desk, (s) => s.data.name === 'Chair');
      if (girlChair && deskChair) {
        desk.x = (girlChair.x + girlChair.width / 2) - (deskChair.x + deskChair.width / 2);
        desk.y = (girlChair.y + girlChair.height / 2) - (deskChair.y + deskChair.height / 2);
      }
      // 垂直精调：以「键盘贴合桌面」为准（角色键盘在 臉部配件/key 槽位），
      // 桌面上表面顶边对齐键盘底边，消除浮空感
      const keyboard = keepBounds(this.skeleton, (s) => s.data.name === '臉部配件/key');
      const surface = keepBounds(desk, (s) => s.data.name === 'desk');
      if (keyboard && surface) {
        desk.y += keyboard.y - (surface.y + surface.height);
      }
      const chairSlot = desk.slots.find((s) => s.data.name === 'Chair');
      if (chairSlot) chairSlot.pose.setAttachment(null);
      desk.updateWorldTransform(SPINE.Physics.pose);
    }

    // 无 ItemTable 时的兜底：按皮肤名前缀扫描分组（与预览器 buildCharGroups 同规则）
    scanGroups() {
      const defs = [
        { id: 'face', label: '面饰', hint: 'FACE', prefix: 'Face/', priority: 6 },
        { id: 'head', label: '头饰', hint: 'HEAD TOP', prefix: 'HeadTop/', priority: 7 },
        { id: 'suit', label: '套装', hint: 'COSTUME', prefix: 'Suit/Costume_', priority: 3 },
        { id: 'top', label: '上衣', hint: 'UPPER BODY', prefix: 'Suit/UpperBody/', priority: 1 },
        { id: 'bottom', label: '下装', hint: 'LOWER BODY', prefix: 'Suit/LowerBody/', priority: 2 },
        { id: 'leg', label: '腿部', hint: 'LEG & SHOES', prefix: 'Leg/', priority: 4 },
        { id: 'tail', label: '尾巴', hint: 'TAIL', prefix: 'Tail/', priority: 5 },
        { id: 'toy', label: '道具', hint: 'ACCESSORY', prefix: 'SexToy/', priority: 8 }
      ];
      const names = this.data.skins.map((s) => s.name);
      const groups = [];
      for (const def of defs) {
        const options = [{ value: '', label: '默认', item: null }]
          .concat(names
            .filter((n) => n.startsWith(def.prefix) && !/\/Default_[A-Za-z]+$/.test(n))
            .sort()
            .map((n) => ({ value: n, label: n.split('/').pop().replace(/_/g, ' '), item: null })));
        if (options.length > 1) {
          groups.push({ id: def.id, label: def.label, hint: def.hint, priority: def.priority, defaultValue: '', options });
        }
      }
      return groups;
    }

    /* ---------- 皮肤组合（移植自预览器 app.js） ---------- */

    getSkinSequence() {
      const names = CHAR_BASE.slice();
      const ordered = this.groups.slice().sort((a, b) => (a.priority || 0) - (b.priority || 0));
      for (const group of ordered) {
        const selected = this.outfit[group.id] !== undefined ? this.outfit[group.id] : group.defaultValue;
        if (selected) names.push(selected);
      }
      const skins = [];
      const seen = new Set();
      for (const name of names) {
        if (!name || seen.has(name)) continue;
        const skin = this.data.skins.find((s) => s.name === name);
        if (skin) { skins.push(skin); seen.add(name); }
      }
      return skins;
    }

    applyAppearance() {
      if (!this.skeleton || !this.data) return;
      const SPINE = window.spine;
      const sequence = this.getSkinSequence();
      const composite = new SPINE.Skin('waifu-' + POSE_ID);
      for (const skin of sequence) composite.addSkin(skin);
      this.skeleton.setSkin(composite);

      // 同一槽位被多个皮肤写入时挑选最合适的附件（预览器 pickAttachment 逻辑）
      const chosen = new Map();
      for (const skin of sequence) {
        const bySlot = new Map();
        for (const entry of skin.getAttachments()) {
          let list = bySlot.get(entry.slotIndex);
          if (!list) { list = []; bySlot.set(entry.slotIndex, list); }
          list.push(entry.attachment);
        }
        for (const [slotIndex, attachments] of bySlot) {
          chosen.set(slotIndex, this.pickAttachment(slotIndex, attachments));
        }
      }
      for (const slotIndex of this.appliedSlots) {
        if (!chosen.has(slotIndex)) this.skeleton.slots[slotIndex].pose.setAttachment(null);
      }
      this.appliedSlots = new Set(chosen.keys());
      for (const [slotIndex, attachment] of chosen) {
        if (DECOR_ATTACHMENT.test(this.data.slots[slotIndex].name) || DECOR_ATTACHMENT.test(attachment.name)) {
          this.skeleton.slots[slotIndex].pose.setAttachment(null);
          this.appliedSlots.delete(slotIndex);
          continue;
        }
        this.skeleton.slots[slotIndex].pose.setAttachment(attachment);
      }
      this.addLookupAliases(composite, chosen);
      this.skeleton.updateWorldTransform(SPINE.Physics.update);
    }

    pickAttachment(slotIndex, attachments) {
      if (!attachments.length) return null;
      if (attachments.length === 1) return attachments[0];
      const setupName = this.data.slots[slotIndex].attachmentName;
      if (setupName) {
        const exact = attachments.find((a) => a.name === setupName);
        if (exact) return exact;
      }
      const filtered = attachments.filter((a) => !/(?:^|[\/_\s])(Mouse|Keying)(?:[0-9]|$)/i.test(a.name));
      const pool = filtered.length ? filtered : attachments;
      if (pool.length === 1) return pool[0];
      const slotTail = this.data.slots[slotIndex].name.split('/').pop();
      const tailMatch = pool.find((a) => a.name.split('/').pop() === slotTail);
      if (tailMatch) return tailMatch;
      const zeroMatch = pool.find((a) => /(?:^|[^0-9])0{1,2}(?:$|[^0-9])/.test(a.name.split('/').pop()));
      if (zeroMatch) return zeroMatch;
      const normalMatch = pool.find((a) => /normal|default/i.test(a.name));
      if (normalMatch) return normalMatch;
      return pool[0];
    }

    // 让动画里的附件关键帧（Touch_1 之类）能找到当前皮肤里的对应附件
    addLookupAliases(skin, chosen) {
      const SPINE = window.spine;
      const seen = new Set();
      for (const animation of this.data.animations) {
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
        const setupName = this.data.slots[slotIndex].attachmentName;
        if (setupName && !skin.getAttachment(slotIndex, setupName)) {
          skin.setAttachment(slotIndex, setupName, attachment);
        }
      }
    }

    /* ---------- 换装面板 ---------- */

    renderPanel() {
      this.locked = (this.costume && this.costume.ready())
        ? this.costume.lockedGroups(this.groups, this.outfit)
        : new Set();
      const body = this.panelBody;
      body.innerHTML = '';
      if (!this.groups.length) {
        body.innerHTML = '<p style="margin:4px 0;color:#9298a8;font-size:12px;">该模型没有可切换的皮肤。</p>';
        return;
      }
      for (const group of this.groups) {
        const locked = this.locked.has(group.id);
        const row = document.createElement('div');
        row.className = 'ycw-outfit-row' + (locked ? ' ycw-locked' : '');
        const label = document.createElement('div');
        label.className = 'ycw-outfit-label';
        label.innerHTML = `<b>${esc(group.label)}</b><small>${esc(group.hint)} · ${group.options.length} 件</small>`;
        const select = document.createElement('select');
        select.className = 'ycw-outfit-select';
        select.setAttribute('aria-label', group.label);
        select.disabled = locked;
        select.innerHTML = group.options.map((o) => {
          const tag = o.item && o.item.RarityEnum && o.item.RarityEnum !== 'N' ? o.item.RarityEnum + ' · ' : '';
          return `<option value="${esc(o.value)}">${esc(tag + o.label)}</option>`;
        }).join('');
        const current = this.outfit[group.id] !== undefined ? this.outfit[group.id] : group.defaultValue;
        select.value = current;
        if (select.value !== String(current)) select.value = group.defaultValue || '';
        select.addEventListener('change', () => this.changeOutfit(group.id, select.value));
        row.appendChild(label);
        row.appendChild(select);
        const option = group.options.find((o) => o.value === select.value);
        if (option && option.item && this.costume && this.costume.ready()) {
          const desc = this.costume.descriptionOf(option.item);
          if (desc) {
            const hint = document.createElement('p');
            hint.className = 'ycw-outfit-desc';
            hint.textContent = desc;
            row.appendChild(hint);
          }
        }
        body.appendChild(row);
      }
    }

    changeOutfit(groupId, value) {
      this.outfit[groupId] = value;
      let notes = [];
      if (this.costume && this.costume.ready()) {
        notes = this.costume.resolveConflicts(this.groups, this.outfit, groupId);
      }
      this.applyAppearance();
      this.renderPanel();
      this.computeContentBounds();
      this.setStageSize();
      this.persist();
      const group = this.groups.find((g) => g.id === groupId);
      const option = group && group.options.find((o) => o.value === value);
      const name = option ? option.label : (value || '默认');
      this.say(notes.length ? `${group.label}：${name}（${notes.join('；')}）` : `${group.label}：${name}`, 2600);
      this.playAction(pick(['Mood/Happy', 'Tail_Loop', 'Face_Work']));
    }

    randomizeOutfit(silent) {
      if (!this.groups.length) return;
      if (this.costume && this.costume.ready()) {
        this.costume.randomize(this.groups, this.outfit);
      } else {
        for (const group of this.groups) {
          const options = group.options;
          if (options.length < 2) continue;
          this.outfit[group.id] = options[Math.floor(Math.random() * options.length)].value;
        }
      }
      this.applyAppearance();
      this.renderPanel();
      this.computeContentBounds();
      this.setStageSize();
      this.persist();
      if (!silent) {
        this.say(pick(LINES.random), 2400);
        this.playAction(pick(['Mood/Happy', 'Tail_Loop']));
      }
    }

    resetOutfit(silent) {
      for (const group of this.groups) {
        this.outfit[group.id] = group.initialValue !== undefined ? group.initialValue : group.defaultValue;
      }
      if (this.costume && this.costume.ready()) {
        Object.assign(this.outfit, this.costume.initialOutfit(POSE_ID, this.groups));
      }
      this.applyAppearance();
      this.renderPanel();
      this.computeContentBounds();
      this.setStageSize();
      this.persist();
      if (!silent) {
        this.say(pick(LINES.reset), 2400);
        this.playAction('Mood/Shy');
      }
    }

    /* ---------- 舞台尺寸 / 相机 ---------- */

    setStageSize() {
      if (!this.skeleton) return;
      const bounds = this.contentBounds || this.liveBounds();
      if (!bounds || !isFinite(bounds.width) || bounds.width <= 0) return;
      const aspect = clamp(bounds.height / bounds.width, 0.72, 1.65);
      this.width = Math.round(clamp((this.opts.width || 300) * this.scale, 180, 560));
      this.height = Math.round(this.width * aspect);
      this.stage.style.width = this.width + 'px';
      this.stage.style.height = this.height + 'px';
      this.resizeCanvas();
    }

    resizeCanvas() {
      if (!this.camera) return;
      const width = Math.max(1, this.stage.clientWidth);
      const height = Math.max(1, this.stage.clientHeight);
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const pw = Math.max(1, Math.round(width * dpr));
      const ph = Math.max(1, Math.round(height * dpr));
      if (this.canvas.width !== pw || this.canvas.height !== ph) {
        this.canvas.width = pw;
        this.canvas.height = ph;
      }
      this.gl.viewport(0, 0, pw, ph);
      this.camera.setViewport(pw, ph);
      this.fitView();
      this.clampIntoView();
      this.applyTransform();
    }

    liveBounds() {
      if (!this.skeleton) return null;
      this.skeleton.updateWorldTransform(window.spine.Physics.pose);
      const bounds = this.skeleton.getBoundsRect();
      return bounds && isFinite(bounds.width) && bounds.width > 0 ? bounds : null;
    }

    // 摇尾巴与拖拽物理会把尾巴甩出待机姿势的包围盒、被相机边缘裁掉；
    // 对尾巴动画整圈采样取包围盒并集，再留出物理摇摆余量，作为取景范围
    computeContentBounds() {
      if (!this.skeleton || !this.animState) return;
      const SPINE = window.spine;
      const tail = this.data.findAnimation('Tail_Loop');
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      const sample = () => {
        const b = this.liveBounds();
        if (b) {
          minX = Math.min(minX, b.x);
          minY = Math.min(minY, b.y);
          maxX = Math.max(maxX, b.x + b.width);
          maxY = Math.max(maxY, b.y + b.height);
        }
      };
      if (tail && tail.duration > 0) {
        this.animState.clearTracks();
        this.animState.setAnimation(0, 'Tail_Loop', true);
        const step = tail.duration / 10;
        for (let i = 0; i <= 10; i++) {
          this.animState.update(i === 0 ? 0 : step);
          this.animState.apply(this.skeleton);
          this.skeleton.update(step);
          sample();
        }
        this.restoreTracks();
      }
      this.applyPose();
      sample();
      // 办公桌开启时并入桌子包围盒（桌子静止，取当前姿势即可）
      if (this.deskOn) {
        const db = this.deskBounds();
        if (db) {
          minX = Math.min(minX, db.x);
          minY = Math.min(minY, db.y);
          maxX = Math.max(maxX, db.x + db.width);
          maxY = Math.max(maxY, db.y + db.height);
        }
      }
      if (!isFinite(minX)) return;
      // 余量换算：先用采样结果估计 zoom（世界单位/画布像素），再折算屏幕像素
      const vw = Math.max(1, this.canvas.width);
      const vh = Math.max(1, this.canvas.height);
      const zoom0 = Math.max((maxX - minX) / (vw * 0.94), (maxY - minY) / (vh * 0.94));
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const margin = 28 * dpr * zoom0;
      this.contentBounds = {
        x: minX - margin,
        y: minY - margin,
        width: maxX - minX + margin * 2,
        height: maxY - minY + margin * 2
      };
    }

    restoreTracks() {
      const has = (name) => !!this.data.findAnimation(name);
      this.animState.clearTracks();
      this.animState.setAnimation(0, this.idleName, true);
      if (has('Mood/Default')) this.animState.setAnimation(1, 'Mood/Default', true);
      if (has('Tail_Loop')) this.animState.setAnimation(3, 'Tail_Loop', true);
    }

    fitView() {
      if (!this.skeleton) return;
      const bounds = this.contentBounds || this.liveBounds();
      if (!bounds || !isFinite(bounds.width) || bounds.width <= 0 || bounds.height <= 0) return;
      const vw = this.canvas.width;
      const vh = this.canvas.height;
      this.camera.zoom = clamp(Math.max(bounds.width / (vw * 0.94), bounds.height / (vh * 0.94)), 0.0002, 50);
      this.camera.position.set(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2, 0);
      this.camera.update();
      // applySway 以此为基准做相机偏移，避免逐帧累加
      this.cameraBase.x = this.camera.position.x;
      this.cameraBase.y = this.camera.position.y;
    }

    /* ---------- 定位 / 拖拽 ---------- */

    placeInitial() {
      const rect = this.stage.getBoundingClientRect();
      if (this.x === null || this.y === null) {
        this.x = 18;
        this.y = Math.max(12, window.innerHeight - rect.height - 18);
      }
      this.clampIntoView();
      this.applyTransform();
    }

    applyTransform() {
      if (this.x === null || this.y === null) return;
      this.root.style.transform = `translate3d(${Math.round(this.x)}px, ${Math.round(this.y)}px, 0)`;
    }

    clampIntoView() {
      if (this.x === null || this.y === null) return;
      const w = this.width || 300;
      const h = this.height || 380;
      this.x = clamp(this.x, 4 - w * 0.25, Math.max(4, window.innerWidth - w * 0.75));
      this.y = clamp(this.y, 4, Math.max(4, window.innerHeight - h * 0.6));
    }

    // 透明像素级命中：只有点到角色身上才接管，页面其余交互不受影响
    hitCharacter(clientX, clientY) {
      if (!this.gl) return false;
      const rect = this.canvas.getBoundingClientRect();
      const x = clientX - rect.left;
      const y = clientY - rect.top;
      if (x < 0 || y < 0 || x >= rect.width || y >= rect.height) return false;
      const dpr = this.canvas.width / Math.max(1, rect.width);
      const px = clamp(Math.floor(x * dpr), 0, this.canvas.width - 1);
      const py = clamp(Math.floor(this.canvas.height - y * dpr - 1), 0, this.canvas.height - 1);
      this.gl.readPixels(px, py, 1, 1, this.gl.RGBA, this.gl.UNSIGNED_BYTE, this.hitPixel);
      return this.hitPixel[3] > 14;
    }

    onPagePointerDown = (event) => {
      if (!this.ready || this.hidden) return;
      const target = event.target instanceof Node ? event.target : null;
      if (target && (this.root.contains(target) || this.restoreBtn.contains(target))) return;
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      if (!this.hitCharacter(event.clientX, event.clientY)) return;

      event.preventDefault();
      event.stopImmediatePropagation();
      this.suppressClickUntil = performance.now() + 400;

      this.drag = {
        id: event.pointerId,
        sx: event.clientX,
        sy: event.clientY,
        ox: this.x,
        oy: this.y,
        moved: false
      };
      this.motion.vx = 0;
      this.motion.vy = 0;
      this.root.classList.add('ycw-dragging');
      if (Math.random() < 0.35) this.say(pick(LINES.drag), 1800);
      window.addEventListener('pointermove', this.onPagePointerMove);
      window.addEventListener('pointerup', this.onPagePointerUp);
      window.addEventListener('pointercancel', this.onPagePointerUp);
    };

    onPagePointerMove = (event) => {
      if (!this.drag || event.pointerId !== this.drag.id) return;
      const dx = event.clientX - this.drag.sx;
      const dy = event.clientY - this.drag.sy;
      if (!this.drag.moved && Math.hypot(dx, dy) > 5) this.drag.moved = true;
      if (!this.drag.moved) return;
      const stepX = this.x - (this.drag.ox + dx);
      const stepY = (this.drag.oy + dy) - this.y;
      // 平滑瞬时速度（约每帧像素），供物理飘动使用
      this.motion.vx = this.motion.vx * 0.55 + (-stepX) * 0.45;
      this.motion.vy = this.motion.vy * 0.55 + stepY * 0.45;
      this.x = this.drag.ox + dx;
      this.y = this.drag.oy + dy;
      this.clampIntoView();
      this.applyTransform();
    };

    onPagePointerUp = (event) => {
      if (!this.drag || event.pointerId !== this.drag.id) return;
      const wasClick = !this.drag.moved;
      this.drag = null;
      this.root.classList.remove('ycw-dragging');
      window.removeEventListener('pointermove', this.onPagePointerMove);
      window.removeEventListener('pointerup', this.onPagePointerUp);
      window.removeEventListener('pointercancel', this.onPagePointerUp);
      this.persist();
      if (wasClick) {
        this.interact();
      } else if (Math.random() < 0.5) {
        this.say(pick(LINES.drop), 2000);
      }
    };

    // 吞掉「点到角色」时浏览器补发的 click，避免误触页面链接
    onPageClickCapture = (event) => {
      if (performance.now() < this.suppressClickUntil) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    };

    bindPageEvents() {
      window.addEventListener('pointerdown', this.onPagePointerDown, true);
      window.addEventListener('click', this.onPageClickCapture, true);
      window.addEventListener('pointermove', this.onPointerTrack, { passive: true });
      document.addEventListener('mouseleave', this.onDocMouseLeave);
      window.addEventListener('click', this.onClickDevice);
      window.addEventListener('keydown', this.onKeyDevice);
      window.addEventListener('resize', this.onWinResize);
    }

    /* ---------- 键鼠联动与指针跟踪（具名处理器，便于 unmount 移除） ---------- */

    onPointerTrack = (event) => {
      this.pointer = { x: event.clientX, y: event.clientY };
    };

    onDocMouseLeave = () => {
      this.pointer = null;
    };

    onWinResize = () => {
      this.clampIntoView();
      this.applyTransform();
    };

    // 键鼠联动（原游戏 listenInputDevice 行为）：
    // 宿主页面上敲键盘 / 点鼠标，看板娘播放对应的打字 / 点鼠标动作
    onClickDevice = (event) => {
      if (!this.ready || this.hidden) return;
      const target = event.target instanceof Node ? event.target : null;
      if (target && (this.root.contains(target) || this.restoreBtn.contains(target))) return;
      this.playDeviceAction('Click_Mouse', LINES.deviceClick);
    };

    onKeyDevice = (event) => {
      if (!this.ready || this.hidden) return;
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (/^(Shift|Control|Alt|Meta|CapsLock|Escape|Tab|NumLock)$/.test(event.key) || /^F\d+$/.test(event.key)) return;
      this.playDeviceAction('Click_Keyboard_TwoHand', LINES.deviceKey);
    };

    // 键鼠联动动作：同一动作播放中不重启（连续打字时动作自然衔接循环），
    // 顺带小概率冒一句气泡
    playDeviceAction(name, lines) {
      if (!this.animState || !this.data || !this.data.findAnimation(name)) return;
      const entry = this.animState.getTrack(2);
      if (entry && entry.animation && entry.animation.name === name) return;
      this.playAction(name);
      if (lines && lines.length && Math.random() < 0.22) this.say(pick(lines), 2200);
    }

    /* ---------- 互动 ---------- */

    interact() {
      this.say(pick(LINES.click), 2200);
      const pool = this.pools.click.length ? this.pools.click : [this.idleName];
      this.playAction(pick(pool));
    }

    // 一次性动作走轨道 2，叠加在待机（0）/ 眨眼（1）/ 尾巴（3）之上
    playAction(name) {
      if (!this.animState || !name) return;
      const anim = this.data.findAnimation(name);
      if (!anim || anim.name === this.idleName) return;
      const token = ++this.actionToken;
      this.animState.setAnimation(2, name, false);
      if (anim.duration === 0) {
        // 定格动作：停留片刻后淡出回落
        setTimeout(() => {
          if (token !== this.actionToken) return;
          this.animState.setEmptyAnimation(2, 0.25);
          this.scheduleDecorClear();
        }, 2400);
      }
    }

    // 情绪动画的附件时间轴会把斜线 / 脸红重新挂上，轨道清空后附件会粘住；
    // 等淡出结束（0.25s）后统一摘除
    scheduleDecorClear() {
      const token = this.actionToken;
      setTimeout(() => {
        if (token !== this.actionToken || !this.skeleton) return;
        for (const slot of this.skeleton.slots) {
          const att = slot.pose.getAttachment();
          if (att && (DECOR_ATTACHMENT.test(slot.data.name) || DECOR_ATTACHMENT.test(att.name))) {
            slot.pose.setAttachment(null);
          }
        }
      }, 320);
    }

    scheduleAction(delaySeconds) {
      this.nextAct = performance.now() / 1000 + (delaySeconds !== undefined ? delaySeconds : 9 + Math.random() * 14);
    }

    applyPose() {
      this.animState.update(0);
      this.animState.apply(this.skeleton);
      this.skeleton.updateWorldTransform(window.spine.Physics.update);
    }

    /* ---------- 拖拽物理 ---------- */

    // 速度 → 骨架小幅位移的目标值；松手后速度衰减，位移弹性回落
    updateSway() {
      const m = this.motion;
      if (!this.drag) {
        m.vx *= 0.86;
        m.vy *= 0.86;
      }
      const targetX = clamp(-m.vx * 0.22, -16, 16);
      const targetY = clamp(m.vy * 0.16, -12, 12);
      m.swayX += (targetX - m.swayX) * 0.18;
      m.swayY += (targetY - m.swayY) * 0.18;
      if (Math.abs(m.swayX) < 0.02) m.swayX = 0;
      if (Math.abs(m.swayY) < 0.02) m.swayY = 0;
    }

    // 角色视觉位置随摇摆偏移，同时反向补偿相机保持画面稳定：
    // 根骨骼的世界位移会驱动头发 / 尾巴的物理约束，产生随行的飘动
    applySway() {
      const m = this.motion;
      const dpr = this.canvas.width / Math.max(1, this.canvas.clientWidth);
      const wx = m.swayX * dpr * this.camera.zoom;
      const wy = m.swayY * dpr * this.camera.zoom;
      this.skeleton.x = wx;
      this.skeleton.y = -wy;
      this.camera.position.x = this.cameraBase.x - wx;
      this.camera.position.y = this.cameraBase.y + wy;
      this.camera.update();
    }

    /* ---------- 视线跟随 ---------- */

    // 头骨世界坐标 → 屏幕坐标，求指针方向并归一化为目标视线（-1..1）
    computeLookTarget() {
      if (!this.pointer || !this.headBone) {
        this.look.tx = 0;
        this.look.ty = 0;
        return;
      }
      const pose = this.headBone.pose;
      const rect = this.canvas.getBoundingClientRect();
      const dpr = this.canvas.width / Math.max(1, this.canvas.clientWidth);
      const sx = (pose.worldX - this.camera.position.x) / this.camera.zoom + this.canvas.width / 2;
      const sy = -(pose.worldY - this.camera.position.y) / this.camera.zoom + this.canvas.height / 2;
      const anchorX = rect.left + sx / dpr;
      const anchorY = rect.top + sy / dpr;
      this.look.tx = clamp((this.pointer.x - anchorX) / 340, -1, 1);
      this.look.ty = clamp((this.pointer.y - anchorY) / 340, -1, 1);
    }

    updateLook(dt) {
      const k = 1 - Math.exp(-dt * 7);
      this.look.x += (this.look.tx - this.look.x) * k;
      this.look.y += (this.look.ty - this.look.y) * k;
    }

    // 在 appliedPose 上叠加视线偏移再执行世界变换，随后还原（动画每帧重写姿态，天然无漂移）。
    // 瞳孔走 EyeBall：本地 X → 世界垂直，本地 Y → 世界水平（轴向经实测标定）
    updateWorldTransformWithLook() {
      const SPINE = window.spine;
      const head = this.headBone && this.headBone.appliedPose;
      const ball = this.eyeBallBone && this.eyeBallBone.appliedPose;
      const active = !!(head || ball) && (Math.abs(this.look.x) > 0.003 || Math.abs(this.look.y) > 0.003);
      let save = null;
      if (active) {
        save = {};
        if (head) {
          save.hr = head.rotation;
          head.rotation += this.look.x * LOOK_HEAD_MAX;
        }
        if (ball) {
          save.bx = ball.x; save.by = ball.y;
          ball.x += -this.look.y * LOOK_EYE_V;
          ball.y += -this.look.x * LOOK_EYE_H;
        }
      }
      this.skeleton.updateWorldTransform(SPINE.Physics.update);
      if (save) {
        if (head) head.rotation = save.hr;
        if (ball) { ball.x = save.bx; ball.y = save.by; }
      }
    }

    loop = (now) => {
      this.raf = requestAnimationFrame(this.loop);
      if (!this.skeleton || this.hidden || document.hidden) { this.lastTime = now; return; }
      const dt = Math.min(0.05, Math.max(0, (now - this.lastTime) / 1000));
      this.lastTime = now;

      if (now / 1000 > this.nextAct && !this.drag) {
        this.scheduleAction();
        if (this.pools.idle.length && Math.random() < 0.8) {
          this.playAction(pick(this.pools.idle));
          if (Math.random() < 0.55) this.say(pick(LINES.idle), 2400);
        }
      }

      this.updateSway();
      this.updateLook(dt);
      this.animState.update(dt);
      this.animState.apply(this.skeleton);
      this.skeleton.update(dt);
      this.applySway();
      this.updateWorldTransformWithLook();
      this.computeLookTarget();
      this.drawScene();
    };

    drawScene() {
      const gl = this.gl;
      gl.viewport(0, 0, this.canvas.width, this.canvas.height);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      this.renderer.begin();
      // 角色先画（她自带的椅子在其骨架内部、位于身体后侧），
      // 办公桌后画：桌面 / 电脑 / 摆件在她前面，形成"坐在桌后"的构图
      this.renderer.drawSkeleton(this.skeleton);
      if (this.deskOn && this.deskSkeleton) this.renderer.drawSkeleton(this.deskSkeleton);
      this.renderer.end();
    }

    /* ---------- 气泡 ---------- */

    say(text, ms = 2400) {
      this.bubble.textContent = text;
      this.bubble.classList.add('ycw-show');
      clearTimeout(this.tipTimer);
      this.tipTimer = setTimeout(() => this.bubble.classList.remove('ycw-show'), ms);
    }

    /* ---------- 工具坞 ---------- */

    onDockClick(event) {
      const button = event.target.closest('button[data-act]');
      if (!button) return;
      const act = button.dataset.act;
      if (act === 'wardrobe') this.togglePanel();
      else if (act === 'random') this.randomizeOutfit();
      else if (act === 'desk') this.toggleDesk();
      else if (act === 'zoom-in') this.setScale(this.scale * 1.15);
      else if (act === 'zoom-out') this.setScale(this.scale / 1.15);
      else if (act === 'hide') this.hide();
      else if (act === 'close-panel') this.togglePanel(false);
      else if (act === 'reset-outfit') this.resetOutfit();
    }

    // 办公桌开关：桌子部件画在角色前面，取景范围并入桌子包围盒
    toggleDesk(force) {
      if (!this.deskSkeleton) {
        this.say('办公桌资源不可用', 2200);
        return;
      }
      this.deskOn = force !== undefined ? force : !this.deskOn;
      this.dock.querySelector('[data-act="desk"]').classList.toggle('ycw-on', this.deskOn);
      this.computeContentBounds();
      this.setStageSize();
      this.persist();
      this.say(this.deskOn ? '搬来办公桌，一起上班～' : '桌子搬走啦～', 2200);
    }

    deskBounds() {
      if (!this.deskSkeleton) return null;
      this.deskSkeleton.updateWorldTransform(window.spine.Physics.pose);
      const b = this.deskSkeleton.getBoundsRect();
      return b && isFinite(b.width) && b.width > 0 ? b : null;
    }

    setScale(scale) {
      this.scale = clamp(scale, 0.55, 1.8);
      storeWrite({ scale: this.scale });
      this.setStageSize();
      this.clampIntoView();
      this.applyTransform();
    }

    togglePanel(force) {
      const open = force !== undefined ? force : !this.panel.classList.contains('ycw-open');
      this.panel.classList.toggle('ycw-open', open);
      this.dock.querySelector('[data-act="wardrobe"]').classList.toggle('ycw-on', open);
      if (open) {
        // 靠右放不下时翻到左侧
        const stageRect = this.stage.getBoundingClientRect();
        const roomRight = window.innerWidth - stageRect.right;
        this.panel.classList.toggle('ycw-flip', roomRight < 290);
        // 角色贴近视口顶部时收窄面板，避免头部被裁掉
        this.panel.style.maxHeight = Math.max(240, stageRect.bottom - 14) + 'px';
        if (Math.random() < 0.4) this.say(pick(LINES.costume), 2000);
      }
    }

    hide() {
      this.hidden = true;
      this.root.classList.add('ycw-hidden');
      this.say(pick(LINES.hidden), 2400);
    }

    show() {
      this.hidden = false;
      this.root.classList.remove('ycw-hidden');
      this.say('我回来啦～', 2200);
    }

    /* ---------- 持久化 ---------- */

    persist() {
      storeWrite({ x: this.x, y: this.y, scale: this.scale, outfit: this.outfit, deskOn: this.deskOn });
    }

    /* ---------- 卸载 ---------- */

    unmount() {
      cancelAnimationFrame(this.raf);
      clearTimeout(this.loadTimer);
      clearTimeout(this.tipTimer);
      window.removeEventListener('pointerdown', this.onPagePointerDown, true);
      window.removeEventListener('click', this.onPageClickCapture, true);
      window.removeEventListener('pointermove', this.onPointerTrack, { passive: true });
      document.removeEventListener('mouseleave', this.onDocMouseLeave);
      window.removeEventListener('click', this.onClickDevice);
      window.removeEventListener('keydown', this.onKeyDevice);
      window.removeEventListener('resize', this.onWinResize);
      window.removeEventListener('pointermove', this.onPagePointerMove);
      window.removeEventListener('pointerup', this.onPagePointerUp);
      window.removeEventListener('pointercancel', this.onPagePointerUp);
      if (this.resizeObserver) this.resizeObserver.disconnect();
      if (this.manager) { try { this.manager.dispose(); } catch (_) { /* ignore */ } }
      this.root.remove();
      this.restoreBtn.remove();
    }
  }

  /* ---------- 对外接口 ---------- */

  const WaifuWidget = {
    instance: null,
    mount(options) {
      if (this.instance) return this.instance;
      const widget = new WaifuWidgetInstance(options);
      this.instance = widget;
      widget.boot().catch((error) => {
        console.error('[WaifuWidget]', error);
        widget.say('加载失败：' + (error.message || error), 6000);
        widget.setLoading('加载失败：' + (error.message || error));
      });
      return widget;
    },
    unmount() {
      if (!this.instance) return;
      this.instance.unmount();
      this.instance = null;
    }
  };

  window.WaifuWidget = WaifuWidget;

  // data-ycw-auto：一行式自动挂载
  const autoTag = document.currentScript && document.currentScript.hasAttribute('data-ycw-auto');
  if (autoTag) {
    const ready = () => { if (document.body) WaifuWidget.mount(); };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ready);
    else ready();
  }
})();
