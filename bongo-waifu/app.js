import {
  CATEGORIES,
  ALL_SKINS,
  clotheLabel,
  clotheStyleLabel,
  colorLabel,
  splitClotheName
} from './wardrobe.js';
import { GirlGame } from './game.js';

const SPINE = window.spine;

const STATE_COLORS = {
  Idle: '#6fd6b0',
  Idle_H: '#7fd4ff',
  Idle_H_End: '#b58cff',
  Fuck_Start: '#efb06f',
  Fuck_Loop: '#ef6f95',
  Fuck_End: '#ff5f7e'
};

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

const els = {
  stage: document.getElementById('stage'),
  cats: document.getElementById('cats'),
  items: document.getElementById('items'),
  wardrobeCount: document.getElementById('wardrobeCount'),
  skinList: document.getElementById('skinList'),
  clearWardrobe: document.getElementById('clearWardrobe'),
  stateDot: document.getElementById('stateDot'),
  stateLabel: document.getElementById('stateLabel'),
  stateRaw: document.getElementById('stateRaw'),
  fit: document.getElementById('fit'),
  zoomIn: document.getElementById('zoomIn'),
  zoomOut: document.getElementById('zoomOut'),
  loading: document.getElementById('loading'),
  loadText: document.getElementById('loadText'),
  error: document.getElementById('error'),
  loveVal: document.getElementById('loveVal'),
  loveFill: document.getElementById('loveFill'),
  lustVal: document.getElementById('lustVal'),
  lustSegs: [...document.getElementById('lustSegs').children],
  orgasmVal: document.getElementById('orgasmVal'),
  phaseVal: document.getElementById('phaseVal'),
  trackVal: document.getElementById('trackVal'),
  touch: document.getElementById('touch'),
  auto: document.getElementById('auto'),
  dirty: document.getElementById('dirty'),
  dirtyVal: document.getElementById('dirtyVal'),
  dirtyTag: document.getElementById('dirtyTag'),
  reset: document.getElementById('reset'),
  log: document.getElementById('log')
};

const state = {
  context: null,
  gl: null,
  renderer: null,
  camera: null,
  skeleton: null,
  skeletonData: null,
  animState: null,
  game: null,
  atlas: null,
  manifest: null,
  itemsByCat: {},
  selection: new Map(),
  variantSelection: new Map(),
  hairColor: null,
  skinPages: {},
  pageByName: {},
  pageBackups: new Map(),
  pageTextures: new Map(),
  textureGeneration: 0,
  activeCat: CATEGORIES[0].id,
  auto: false,
  autoAcc: 0,
  autoFit: true,
  fitPending: true,
  dragging: false,
  dragMoved: false,
  lastPointer: null,
  lastHud: {},
  ready: false
};

const hooks = {
  onState(next, label) {
    els.stateLabel.textContent = label || next;
    els.stateRaw.textContent = next;
    els.phaseVal.textContent = next;
    els.stateDot.style.background = STATE_COLORS[next] || '#6fd6b0';
    els.stateDot.style.boxShadow = `0 0 10px ${STATE_COLORS[next] || '#6fd6b0'}`;
  },
  onLog(message) {
    pushLog(message);
  },
  onOrgasm(count) {
    els.orgasmVal.textContent = String(count);
  },
  onDirty(level) {
    els.dirty.value = String(level);
    els.dirtyVal.textContent = String(level);
    els.dirtyTag.textContent = `dirty ${level}`;
  }
};

boot();

async function boot() {
  try {
    state.context = new SPINE.ManagedWebGLRenderingContext(els.stage, {
      alpha: true,
      antialias: true,
      premultipliedAlpha: true,
      preserveDrawingBuffer: true
    });
    state.gl = state.context.gl;
    state.renderer = new SPINE.SceneRenderer(els.stage, state.context, false);
    state.camera = state.renderer.camera;
    resizeCanvas();

    els.loadText.textContent = '正在加载 BaseBody 骨架与 15 张图集…';
    // spine-webgl's Multiply/Screen blend modes assume premultiplied alpha during blending,
    // and its GLTexture upload follows this pixel-store flag. The atlas PNGs are straight
    // alpha, so premultiply them on upload and draw with the PMA path.
    state.gl.pixelStorei(state.gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    const manager = new SPINE.AssetManager(state.context, 'assets/');
    manager.loadTextureAtlas('BaseBody/BaseBody.atlas');
    manager.loadBinary('BaseBody/BaseBody.skel');
    await manager.loadAll();
    if (manager.hasErrors()) {
      throw new Error(Object.values(manager.getErrors()).join('\n'));
    }

    const atlas = manager.require('BaseBody/BaseBody.atlas');
    const binary = manager.require('BaseBody/BaseBody.skel');
    const skeletonData = new SPINE.SkeletonBinary(new SPINE.AtlasAttachmentLoader(atlas)).readSkeletonData(binary);
    const skeleton = new SPINE.Skeleton(skeletonData);
    skeleton.setToSetupPose();
    // Seed every physics constraint's rest anchor before the first simulated frame.
    skeleton.updateWorldTransform(SPINE.Physics.reset);

    const animationData = new SPINE.AnimationStateData(skeletonData);
    animationData.defaultMix = 0.2;
    const animState = new SPINE.AnimationState(animationData);

    els.loadText.textContent = '正在加载 245 件服装贴图清单…';
    const manifest = await loadManifest();

    state.skeletonData = skeletonData;
    state.skeleton = skeleton;
    state.animState = animState;
    state.atlas = atlas;
    state.manifest = manifest;
    state.itemsByCat = groupManifestItems(manifest.items);
    initPageTextures(atlas);
    state.skinPages = buildSkinPageMap(skeletonData);
    state.game = new GirlGame({ animState, skeleton, spine: SPINE, hooks });

    state.game.start();
    buildWardrobe();
    applySkin();
    state.ready = true;

    pushLog(`BaseBody 已加载 · ${skeletonData.bones.length} 骨骼 · ${skeletonData.slots.length} 槽位 · ${skeletonData.animations.length} 动画`);
    pushLog(`服装贴图 · ${manifest.garmentCount} 件 / 5 类 · 发色 ${manifest.hairColorCount} 种 · 来自 sharedassets0`);
    if (!state.selection.size) pushLog('初始装扮：仅基础皮肤（未选择发型 / 衣物）');

    els.loading.classList.add('hidden');
    requestAnimationFrame(frame);
  } catch (error) {
    console.error(error);
    els.loading.classList.add('hidden');
    els.error.hidden = false;
    els.error.textContent = `加载失败：${error.message}`;
    pushLog(`加载失败：${error.message}`);
  }
}

/* ---------- clothing textures ---------- */

async function loadManifest() {
  const response = await fetch('assets/clothing/manifest.json', { cache: 'no-store' });
  if (!response.ok) throw new Error(`服装清单加载失败 HTTP ${response.status}`);
  return response.json();
}

function groupManifestItems(items) {
  const grouped = {};
  for (const item of items) {
    (grouped[item.category] ||= []).push(item);
  }
  return grouped;
}

function initPageTextures(atlas) {
  for (const page of atlas.pages) {
    state.pageByName[page.name] = page;
    state.pageBackups.set(page.name, page.texture);
  }
}

// Each garment skin is attached to exactly one atlas page (Shoes and Shoes_Mask
// both use page 12). Derive the mapping from the skin attachments instead of
// hardcoding page numbers, so promo skins cannot silently use the wrong page.
function buildSkinPageMap(skeletonData) {
  const pages = {};
  for (const skin of skeletonData.skins) {
    const counts = new Map();
    for (const { attachment } of skin.getAttachments()) {
      const name = attachment?.region?.page?.name;
      if (name) counts.set(name, (counts.get(name) || 0) + 1);
    }
    let best = null;
    let bestCount = 0;
    for (const [name, count] of counts) {
      if (count > bestCount) {
        best = name;
        bestCount = count;
      }
    }
    pages[skin.name] = best;
  }
  return pages;
}

function findItem(catId, itemId) {
  if (itemId == null) return null;
  return (state.itemsByCat[catId] || []).find((item) => item.id === itemId) ?? null;
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(src));
    image.src = src;
  });
}

// The game swaps the material's _ChangeTex per selected item. Every item texture
// is authored in the same normalized page UV space as its mask page, so replacing
// the page texture reproduces the _MainTex -> _ChangeTex lerp without a custom shader.
async function updatePageTextures() {
  const generation = ++state.textureGeneration;
  const desired = new Map();

  for (const [catId, itemId] of state.variantSelection) {
    const item = findItem(catId, itemId);
    if (!item) continue;
    const pageName = state.skinPages[item.skinEnum];
    if (!pageName) {
      pushLog(`贴图跳过多余的皮肤页 · ${item.enumName}`);
      continue;
    }
    desired.set(pageName, { source: item.texture, label: clotheLabel(item.enumName) });
  }

  const hairSkin = state.selection.get('Hair') ?? null;
  if (hairSkin && state.hairColor) {
    const pageName = state.skinPages[hairSkin];
    if (pageName === 'BaseBody_9.png') {
      desired.set(pageName, { source: state.hairColor.texture, label: `${colorLabel(state.hairColor.color)}发` });
    }
  }

  for (const [pageName, backup] of state.pageBackups) {
    if (desired.has(pageName)) continue;
    const applied = state.pageTextures.get(pageName);
    if (!applied) continue;
    if (state.pageByName[pageName].texture === applied.texture) {
      state.pageByName[pageName].setTexture(backup);
    }
    applied.texture.dispose();
    state.pageTextures.delete(pageName);
  }

  for (const [pageName, want] of desired) {
    const current = state.pageTextures.get(pageName);
    if (current?.source === want.source) continue;

    let image;
    try {
      image = await loadImage(want.source);
    } catch (error) {
      pushLog(`贴图加载失败 · ${want.source}`);
      continue;
    }
    if (generation !== state.textureGeneration) return;

    const texture = new SPINE.GLTexture(state.context, image);
    const page = state.pageByName[pageName];
    page.setTexture(texture);
    if (current) current.texture.dispose();
    state.pageTextures.set(pageName, { source: want.source, texture });
  }
}



/* ---------- renderer ---------- */

function resizeCanvas() {
  if (!state.camera) return;
  const width = Math.max(1, els.stage.clientWidth);
  const height = Math.max(1, els.stage.clientHeight);
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const pw = Math.max(1, Math.round(width * dpr));
  const ph = Math.max(1, Math.round(height * dpr));
  if (els.stage.width !== pw || els.stage.height !== ph) {
    els.stage.width = pw;
    els.stage.height = ph;
  }
  state.gl.viewport(0, 0, pw, ph);
  state.camera.setViewport(pw, ph);
  if (state.ready && state.autoFit) fitView();
}

function frame(now) {
  requestAnimationFrame(frame);
  if (!state.game) return;

  const dt = Math.min(0.05, Math.max(0, (now - (state.lastTime ?? now)) / 1000));
  state.lastTime = now;

  if (state.auto) {
    state.autoAcc += dt;
    while (state.autoAcc >= 0.13) {
      state.autoAcc -= 0.13;
      state.game.touch({ restartLoop: false });
    }
  }

  state.game.update(dt);
  state.skeleton.update(dt);
  state.animState.update(dt);
  state.animState.apply(state.skeleton);
  state.skeleton.updateWorldTransform(SPINE.Physics.update);

  if (state.fitPending) {
    state.fitPending = false;
    fitView();
  }

  drawScene();
  updateHud();
}

function drawScene() {
  const gl = state.gl;
  const canvas = els.stage;
  gl.viewport(0, 0, canvas.width, canvas.height);
  gl.clearColor(0, 0, 0, 0);
  gl.clear(gl.COLOR_BUFFER_BIT);
  state.renderer.begin();
  // Textures are uploaded premultiplied (see UNPACK_PREMULTIPLY_ALPHA_WEBGL above), so use
  // the PMA blend path; straight-alpha blending would break Multiply/Screen slots.
  state.renderer.drawSkeleton(state.skeleton, true);
  state.renderer.end();
}

// getBoundsRect counts zero-alpha helper slots and effect meshes with runaway vertices
// (dick mesh, floor liquid, status icons), so frame only the character itself.
function frameHelper(name) {
  return /^(semen|Status_|Floor_liquid)/.test(name)
    || name === 'Dick' || name === 'DickMesh' || name === 'B_Center' || name === 'B_Center2';
}

function visibleBounds() {
  const skeleton = state.skeleton;
  const hidden = [];
  skeleton.updateWorldTransform(SPINE.Physics.pose);
  for (const slot of skeleton.slots) {
    const attachment = slot.getAttachment();
    if (attachment && (slot.color.a === 0 || frameHelper(slot.data.name))) {
      hidden.push([slot, attachment]);
      slot.setAttachment(null);
    }
  }
  skeleton.updateWorldTransform(SPINE.Physics.pose);
  const bounds = skeleton.getBoundsRect();
  for (const [slot, attachment] of hidden) slot.setAttachment(attachment);
  skeleton.updateWorldTransform(SPINE.Physics.pose);
  return bounds;
}

function fitView() {
  if (!state.skeleton) return;
  const bounds = visibleBounds();
  if (!bounds || !isFinite(bounds.width) || !isFinite(bounds.height) || bounds.width <= 0 || bounds.height <= 0) return;
  const vw = els.stage.width;
  const vh = els.stage.height;
  state.camera.zoom = clamp(Math.max(bounds.width / (vw * 0.82), bounds.height / (vh * 0.74)), 0.0002, 50);
  state.camera.position.set(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2, 0);
  state.camera.update();
  state.autoFit = true;
}

function zoomBy(factor) {
  if (!state.camera) return;
  state.camera.zoom = clamp(state.camera.zoom * factor, 0.0002, 50);
  state.camera.update();
  state.autoFit = false;
}

/* ---------- hud ---------- */

function updateHud() {
  const game = state.game;
  const love = clamp(game.love, 0, 100);
  const lust = clamp(game.lust, 0, 100);
  const track = game.trackSummary();
  const dirty = game.stain;

  if (state.lastHud.love !== love) {
    state.lastHud.love = love;
    els.loveVal.textContent = love.toFixed(1);
    els.loveFill.style.width = `${love}%`;
  }
  if (state.lastHud.lust !== lust) {
    state.lastHud.lust = lust;
    els.lustVal.textContent = lust.toFixed(1);
    els.lustSegs.forEach((seg, index) => seg.classList.toggle('on', index <= game.level));
  }
  if (state.lastHud.orgasm !== game.orgasmCount) {
    state.lastHud.orgasm = game.orgasmCount;
    els.orgasmVal.textContent = String(game.orgasmCount);
  }
  if (state.lastHud.phase !== game.state) {
    state.lastHud.phase = game.state;
    els.phaseVal.textContent = game.state;
  }
  if (state.lastHud.track !== track) {
    state.lastHud.track = track;
    els.trackVal.textContent = track;
    els.trackVal.title = track;
  }
  if (state.lastHud.dirty !== dirty) {
    state.lastHud.dirty = dirty;
    els.dirtyTag.textContent = `dirty ${dirty}`;
  }
}

function pushLog(message) {
  const line = document.createElement('p');
  const time = document.createElement('b');
  time.textContent = `${new Date().toLocaleTimeString('zh-CN', { hour12: false })} `;
  line.append(time, document.createTextNode(message));
  els.log.prepend(line);
  while (els.log.childElementCount > 60) els.log.lastElementChild.remove();
}

/* ---------- wardrobe ---------- */

function buildWardrobe() {
  for (const cat of CATEGORIES) {
    const tab = document.createElement('button');
    tab.className = 'cat';
    tab.dataset.id = cat.id;
    tab.textContent = cat.label;
    tab.addEventListener('click', () => {
      state.activeCat = cat.id;
      renderCats();
      renderItems();
    });
    els.cats.appendChild(tab);
  }
  renderCats();
  renderItems();
  updateWardrobeFoot();
}

function renderCats() {
  for (const tab of els.cats.children) {
    tab.classList.toggle('active', tab.dataset.id === state.activeCat);
  }
}

function renderItems() {
  const cat = CATEGORIES.find((item) => item.id === state.activeCat);
  if (!cat) return;
  els.items.replaceChildren();
  if (cat.mode === 'items') renderItemCategory(cat);
  else renderSkinCategory(cat);
}

function appendGroup(titleText, buildChips) {
  const group = document.createElement('div');
  group.className = 'group';

  const title = document.createElement('div');
  title.className = 'group-title';
  title.textContent = titleText;

  const chips = document.createElement('div');
  chips.className = 'chips';
  buildChips(chips);

  group.append(title, chips);
  els.items.appendChild(group);
  return group;
}

function makeChip(label, { active = false, title = '', none = false, onClick = null } = {}) {
  const button = document.createElement('button');
  button.className = `chip${none ? ' none' : ''}${active ? ' active' : ''}`;
  button.textContent = label;
  if (title) button.title = title;
  if (onClick) button.addEventListener('click', onClick);
  return button;
}

function renderSkinCategory(cat) {
  const selected = state.selection.get(cat.id) ?? null;
  appendGroup(`${cat.label} · ${cat.skins.length + 1} 项`, (chips) => {
    chips.appendChild(makeChip('无', {
      none: true,
      active: selected === null,
      onClick: () => selectSkin(cat.id, null)
    }));
    for (const [name, label] of cat.skins) {
      chips.appendChild(makeChip(label, {
        active: selected === name,
        title: name,
        onClick: () => selectSkin(cat.id, name)
      }));
    }
  });
  if (cat.hairColors) renderHairColors(selected);
}

function renderHairColors(hairSkin) {
  if (!hairSkin) {
    const hint = document.createElement('p');
    hint.className = 'hint';
    hint.textContent = '选择发型后可替换发色：7 张整页贴图，对应 CLOTHE_NAME 1000–1006。';
    els.items.appendChild(hint);
    return;
  }
  if (state.skinPages[hairSkin] !== 'BaseBody_9.png') {
    const hint = document.createElement('p');
    hint.className = 'hint';
    hint.textContent = '联名发型使用自带配色页，本次未接入其贴图。';
    els.items.appendChild(hint);
    return;
  }
  const colors = state.manifest?.hairColors ?? [];
  appendGroup(`发色 · ${colors.length} 色 · sharedassets0`, (chips) => {
    for (const item of colors) {
      chips.appendChild(makeChip(colorLabel(item.color), {
        active: state.hairColor?.id === item.id,
        title: `${item.enumName} · #${item.id}`,
        onClick: () => selectHairColor(item)
      }));
    }
  });
}

function renderItemCategory(cat) {
  const items = state.itemsByCat[cat.id] || [];
  const selectedId = state.variantSelection.get(cat.id) ?? null;

  appendGroup(`${cat.label} · ${items.length} 件 · sharedassets0`, (chips) => {
    chips.appendChild(makeChip('无', {
      none: true,
      active: selectedId === null,
      onClick: () => selectItem(cat.id, null)
    }));
  });

  const styles = new Map();
  for (const item of items) {
    const { style } = splitClotheName(item.enumName);
    if (!styles.has(style)) styles.set(style, []);
    styles.get(style).push(item);
  }

  for (const list of styles.values()) {
    appendGroup(`${clotheStyleLabel(list[0].enumName)} · ${list.length} 色`, (chips) => {
      for (const item of list) {
        const { color } = splitClotheName(item.enumName);
        chips.appendChild(makeChip(color ? colorLabel(color) : '单色', {
          active: selectedId === item.id,
          title: `${item.enumName} · #${item.id}${item.dlcType ? ' · DLC' : ''}`,
          onClick: () => selectItem(cat.id, item.id)
        }));
      }
    });
  }
}

function selectSkin(catId, name) {
  if (!state.ready) return;

  const cat = CATEGORIES.find((item) => item.id === catId);
  if (cat?.mode === 'items') {
    const items = state.itemsByCat[catId] || [];
    const item = name ? (items.find((row) => row.skinEnum === name) ?? items[0]) : null;
    selectItem(catId, item ? item.id : null);
    return;
  }

  const previous = state.selection.get(catId) ?? null;
  if (name === null) state.selection.delete(catId);
  else if (previous === name) state.selection.delete(catId);
  else state.selection.set(catId, name);
  const next = state.selection.get(catId) ?? null;
  if (next === previous) return;

  applySkin();
  void updatePageTextures();
  state.game.changeClothe();
  renderItems();
  updateWardrobeFoot();
  pushLog(next ? `换装 · ${catId} → ${next}` : `换装 · 卸下 ${catId}`);
}

function selectItem(catId, itemId) {
  if (!state.ready) return;
  const item = findItem(catId, itemId);
  const previous = state.variantSelection.get(catId) ?? null;
  const nextId = item && item.id !== previous ? item.id : null;

  if (nextId === null) {
    state.variantSelection.delete(catId);
    state.selection.delete(catId);
  } else {
    state.variantSelection.set(catId, nextId);
    state.selection.set(catId, item.skinEnum);
  }

  applySkin();
  void updatePageTextures();
  state.game.changeClothe();
  renderItems();
  updateWardrobeFoot();
  pushLog(nextId === null
    ? `换装 · 卸下 ${catId}`
    : `换装 · ${catId} → ${clotheLabel(item.enumName)} (#${item.id})`);
}

function selectHairColor(item) {
  if (!state.ready) return;
  const previous = state.hairColor?.id ?? null;
  state.hairColor = previous === item.id ? null : item;
  void updatePageTextures();
  state.game.changeClothe();
  renderItems();
  updateWardrobeFoot();
  pushLog(state.hairColor
    ? `换装 · 发色 → ${colorLabel(item.color)} (#${item.id})`
    : '换装 · 发色恢复默认');
}

function applySkin() {
  const skeleton = state.skeleton;
  if (!skeleton) return;
  const composite = new SPINE.Skin('new');
  for (const name of state.selection.values()) {
    const skin = skeleton.data.findSkin(name);
    if (skin) composite.addSkin(skin);
  }
  skeleton.setSkin(composite);
  skeleton.setSlotsToSetupPose();
  skeleton.updateWorldTransform(SPINE.Physics.pose);
}

function updateWardrobeFoot() {
  const labels = [];
  const lines = [];
  for (const [catId, skin] of state.selection) {
    const item = findItem(catId, state.variantSelection.get(catId));
    if (item) {
      labels.push(clotheLabel(item.enumName));
      lines.push(`${catId}: ${item.enumName} (#${item.id}) · ${item.texture}`);
    } else {
      labels.push(skin);
      lines.push(`${catId}: ${skin}`);
    }
  }
  if (state.hairColor && state.selection.has('Hair')) {
    labels.push(`${colorLabel(state.hairColor.color)}发`);
    lines.push(`Hair color: ${state.hairColor.enumName} (#${state.hairColor.id}) · ${state.hairColor.texture}`);
  }

  els.wardrobeCount.textContent = `${state.selection.size} 件`;
  els.skinList.textContent = labels.length ? labels.join(' · ') : 'new · 基础皮肤';
  els.skinList.title = lines.length ? lines.join('\n') : 'new skin（default 作为回退）';
}

function clearWardrobe() {
  if (!state.ready || (state.selection.size === 0 && state.variantSelection.size === 0 && !state.hairColor)) return;
  state.selection.clear();
  state.variantSelection.clear();
  state.hairColor = null;
  applySkin();
  void updatePageTextures();
  state.game.changeClothe();
  renderItems();
  updateWardrobeFoot();
  pushLog('换装 · 全部卸下');
}

/* ---------- interaction ---------- */

function manualTouch(options) {
  if (!state.ready) return;
  state.game.touch(options);
}

function toggleAuto() {
  if (!state.ready) return;
  state.auto = !state.auto;
  state.autoAcc = 0;
  els.auto.classList.toggle('active', state.auto);
  els.auto.setAttribute('aria-pressed', String(state.auto));
  els.auto.textContent = state.auto ? '停止自动' : '自动互动';
  pushLog(state.auto ? '自动互动开启' : '自动互动关闭');
}

function resetGame() {
  if (!state.ready) return;
  state.auto = false;
  state.autoAcc = 0;
  els.auto.classList.remove('active');
  els.auto.setAttribute('aria-pressed', 'false');
  els.auto.textContent = '自动互动';
  state.game.reset();
  state.lastHud = {};
}

/* ---------- input ---------- */

let touchRepeat = null;
function stopTouchRepeat() {
  clearInterval(touchRepeat);
  touchRepeat = null;
}

els.touch.addEventListener('pointerdown', (event) => {
  event.preventDefault();
  manualTouch();
  stopTouchRepeat();
  touchRepeat = setInterval(() => manualTouch({ restartLoop: false }), 140);
});
for (const type of ['pointerup', 'pointercancel', 'pointerleave']) {
  els.touch.addEventListener(type, stopTouchRepeat);
}

els.auto.addEventListener('click', toggleAuto);
els.reset.addEventListener('click', resetGame);
els.clearWardrobe.addEventListener('click', clearWardrobe);
els.fit.addEventListener('click', fitView);
els.zoomIn.addEventListener('click', () => zoomBy(0.85));
els.zoomOut.addEventListener('click', () => zoomBy(1.15));

els.dirty.addEventListener('input', () => {
  if (!state.ready) return;
  state.game.setStain(Number(els.dirty.value));
});

els.stage.addEventListener('pointerdown', (event) => {
  if (!state.ready) return;
  state.dragging = true;
  state.dragMoved = false;
  state.lastPointer = { x: event.clientX, y: event.clientY };
  els.stage.setPointerCapture(event.pointerId);
  els.stage.style.cursor = 'grabbing';
});

els.stage.addEventListener('pointermove', (event) => {
  if (!state.dragging || !state.lastPointer) return;
  const dx = event.clientX - state.lastPointer.x;
  const dy = event.clientY - state.lastPointer.y;
  if (!state.dragMoved && Math.hypot(dx, dy) < 4) return;
  state.dragMoved = true;
  const dpr = els.stage.width / Math.max(1, els.stage.clientWidth);
  state.camera.position.x -= dx * dpr * state.camera.zoom;
  state.camera.position.y += dy * dpr * state.camera.zoom;
  state.camera.update();
  state.autoFit = false;
  state.lastPointer = { x: event.clientX, y: event.clientY };
});

els.stage.addEventListener('pointerup', () => {
  const wasClick = state.dragging && !state.dragMoved;
  state.dragging = false;
  state.lastPointer = null;
  els.stage.style.cursor = 'crosshair';
  if (wasClick) manualTouch();
});

els.stage.addEventListener('pointercancel', () => {
  state.dragging = false;
  state.lastPointer = null;
  els.stage.style.cursor = 'crosshair';
});

els.stage.addEventListener('wheel', (event) => {
  event.preventDefault();
  zoomBy(event.deltaY < 0 ? 0.9 : 1.1);
}, { passive: false });

new ResizeObserver(() => resizeCanvas()).observe(els.stage);

/* ---------- debug surface ---------- */

window.__bongo = {
  state,
  get game() { return state.game; },
  snapshot() {
    const game = state.game;
    if (!game) return { ready: false };
    return {
      ready: true,
      state: game.state,
      love: game.love,
      lust: game.lust,
      level: game.level,
      stain: game.stain,
      orgasmCount: game.orgasmCount,
      orgasmLock: game.orgasmLock,
      cooldown: { elapsed: game.hnm, threshold: game.hnn },
      tracks: game.trackSummary(),
      selection: Object.fromEntries(state.selection),
      variants: Object.fromEntries(state.variantSelection),
      hairColor: state.hairColor ? { id: state.hairColor.id, color: state.hairColor.color } : null,
      pageTextures: Object.fromEntries([...state.pageTextures].map(([page, entry]) => [page, entry.source])),
      skin: state.skeleton?.skin?.name ?? null,
      canvas: [els.stage.width, els.stage.height],
      camera: state.camera
        ? { x: state.camera.position.x, y: state.camera.position.y, zoom: state.camera.zoom }
        : null
    };
  },
  touch() { manualTouch(); },
  auto(value = true) {
    if (value !== state.auto) toggleAuto();
  },
  select(catId, skinName) { selectSkin(catId, skinName); },
  selectItem(catId, itemId) { selectItem(catId, itemId); },
  selectHairColor(itemId) {
    const item = state.manifest?.hairColors.find((row) => row.id === itemId);
    if (item) selectHairColor(item);
  },
  clearWardrobe,
  setStain(level) { state.game?.setStain(level); },
  fitView,
  allSkins: [...ALL_SKINS.keys()],
  get items() { return state.itemsByCat; },
  manifest: () => state.manifest
};
