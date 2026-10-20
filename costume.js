/* Equipment / wardrobe rules rebuilt from the game's ItemTable.
   The table itself carries no conflict column, so the two rules below come from how the rows are used:
   - Hidden=1 rows are exactly the per-slot presets referenced by each pose row's DefaultItem, so the shop
     catalog is Hidden=0 and every slot always holds one item (preset or catalog).
   - A pose's InitialEquip is [Suit, Leg] while DefaultItem still lists the nude UpperBody/LowerBody presets,
     and the Suit skins write to the same body slots (PoseA: 27 shared with UpperBody, 6 with LowerBody),
     so a suit replaces both body garments — the game's SuitCoveredParts behaviour. */
(() => {
  'use strict';

  const SLOT_DEFS = [
    { kind: 'HeadTop', id: 'head', label: '头饰', hint: 'HEAD TOP' },
    { kind: 'Face', id: 'face', label: '面饰', hint: 'FACE' },
    { kind: 'Suit', id: 'suit', label: '套装', hint: 'COSTUME', covers: ['top', 'bottom'] },
    { kind: 'UpperBody', id: 'top', label: '上衣', hint: 'UPPER BODY', coveredBy: 'suit' },
    { kind: 'LowerBody', id: 'bottom', label: '下装', hint: 'LOWER BODY', coveredBy: 'suit' },
    { kind: 'Leg', id: 'leg', label: '腿部', hint: 'LEG & SHOES' },
    { kind: 'Tail', id: 'tail', label: '尾巴', hint: 'TAIL' },
    { kind: 'Accessary', id: 'toy', label: '道具', hint: 'ACCESSORY' }
  ];
  const DESK_DEFS = [
    { kind: 'Desktop', id: 'desktop', label: '桌面摆件', hint: 'DESKTOP' },
    { kind: 'DesktopB', id: 'side', label: '桌边摆件', hint: 'DESK SIDE' },
    { kind: 'UnderDesk', id: 'under', label: '桌下摆件', hint: 'UNDER DESK' }
  ];
  // Composite order: later skins win the slots they share with an earlier one.
  const PRIORITY = { top: 1, bottom: 2, suit: 3, leg: 4, tail: 5, face: 6, head: 7, toy: 8 };
  const POSE_ROW = { PoseA: 101, PoseB: 102, PoseC: 103, PoseD: 104 };
  const RARITY_LABEL = { N: '普通', R: '稀有', SR: '史诗', SSR: '传说', UR: '极致' };

  class CostumeService {
    constructor(fetchBase) {
      this.base = fetchBase || '';
      this.rows = null;
      this.text = null;
      this.byId = new Map();
    }

    async load() {
      if (this.rows) return this;
      const [items, text] = await Promise.all([
        fetch(`${this.base}data/items.json`).then((r) => (r.ok ? r.json() : Promise.reject(new Error('items.json')))),
        fetch(`${this.base}data/item-text.json`).then((r) => (r.ok ? r.json() : {}))
      ]);
      this.rows = items;
      this.text = text || {};
      this.byId = new Map(items.map((row) => [row.ItemId, row]));
      return this;
    }

    ready() {
      return !!this.rows;
    }

    poseRow(poseId) {
      const id = POSE_ROW[poseId];
      return id ? this.byId.get(id) : null;
    }

    /* ---------- group building ---------- */

    buildGroups(poseId, skeletonData) {
      if (!this.rows) return null;
      const has = new Set(skeletonData.skins.map((s) => s.name));
      if (POSE_ROW[poseId]) return this._charGroups(poseId, this.poseRow(poseId), has);
      if (poseId === 'DefaultDesk') return this._deskGroups(has);
      return null;
    }

    _charGroups(poseId, row, has) {
      const presets = new Map((row.DefaultItem || []).map((id) => {
        const item = this.byId.get(id);
        return item && item.ItemKinds ? [item.ItemKinds, item] : null;
      }).filter(Boolean));
      const groups = [];
      for (const def of SLOT_DEFS) {
        const catalog = this.rows.filter((r) => r.OwnedPose === poseId && r.ItemKinds === def.kind && !r.Hidden && has.has(r.SkinKey));
        const preset = presets.get(def.kind);
        const presetOk = !!(preset && has.has(preset.SkinKey));
        if (!catalog.length && !presetOk && def.kind !== 'Suit') continue;
        const options = [];
        if (def.kind === 'Suit') {
          options.push({ value: '', label: '不穿套装', item: null });
        } else if (preset && has.has(preset.SkinKey)) {
          options.push({ value: preset.SkinKey, label: this.nameOf(preset) || '预设', item: preset, preset: true });
        } else {
          options.push({ value: '', label: '默认', item: null });
        }
        for (const item of this._sorted(catalog)) {
          options.push({ value: item.SkinKey, label: this.nameOf(item), item });
        }
        groups.push({
          id: def.id,
          label: def.label,
          hint: def.hint,
          covers: def.covers || null,
          coveredBy: def.coveredBy || null,
          priority: PRIORITY[def.id] || 0,
          defaultValue: options[0].value,
          options
        });
      }
      return groups;
    }

    _deskGroups(has) {
      const row = this.byId.get(POSE_ROW.PoseA);
      const presets = new Map((row ? row.DefaultItem : []).map((id) => {
        const item = this.byId.get(id);
        return item && item.ItemKinds ? [item.ItemKinds, item] : null;
      }).filter(Boolean));
      const groups = [];
      for (const def of DESK_DEFS) {
        const catalog = this._sorted(this.rows.filter((r) => r.ItemKinds === def.kind && !r.Hidden && has.has(r.SkinKey)));
        if (!catalog.length) continue;
        const preset = presets.get(def.kind);
        const options = [];
        if (preset && has.has(preset.SkinKey)) options.push({ value: preset.SkinKey, label: this.nameOf(preset), item: preset, preset: true });
        for (const item of catalog) options.push({ value: item.SkinKey, label: this.nameOf(item), item });
        groups.push({
          id: def.id,
          label: def.label,
          hint: def.hint,
          priority: 0,
          defaultValue: options[0].value,
          options
        });
      }
      return groups;
    }

    _sorted(list) {
      const rank = { N: 0, R: 1, SR: 2, SSR: 3, UR: 4 };
      return list.slice().sort((a, b) => {
        const byRarity = (rank[a.RarityEnum] || 0) - (rank[b.RarityEnum] || 0);
        if (byRarity) return byRarity;
        return String(a.ItemId).localeCompare(String(b.ItemId));
      });
    }

    /* ---------- equip state ---------- */

    initialOutfit(poseId, groups) {
      const outfit = {};
      for (const group of groups) outfit[group.id] = group.defaultValue;
      const row = this.poseRow(poseId);
      if (!row) return outfit;
      for (const id of row.InitialEquip || []) {
        const item = this.byId.get(id);
        if (!item) continue;
        const group = groups.find((g) => g.options.some((o) => o.item && o.item.ItemId === item.ItemId));
        if (group) outfit[group.id] = item.SkinKey;
      }
      return outfit;
    }

    // Returns the slots that the current choice locks, so the UI can grey them out like the game does.
    lockedGroups(groups, outfit) {
      const locked = new Set();
      for (const group of groups) {
        if (!group.covers) continue;
        if (!outfit[group.id]) continue;
        for (const id of group.covers) locked.add(id);
      }
      return locked;
    }

    // Called after every user change; rewrites the outfit the way CostumeService would and reports what moved.
    resolveConflicts(groups, outfit, changedId) {
      const notes = [];
      for (const group of groups) {
        if (!group.covers) continue;
        if (!outfit[group.id]) continue;
        for (const covered of groups.filter((g) => g.coveredBy === group.id)) {
          if (outfit[covered.id] !== covered.defaultValue) {
            outfit[covered.id] = covered.defaultValue;
            if (changedId !== covered.id) notes.push(`${covered.label}被套装覆盖，已恢复预设`);
          }
        }
      }
      return notes;
    }

    randomize(groups, outfit) {
      for (const group of groups) {
        if (this.lockedGroups(groups, outfit).has(group.id)) continue;
        const pickable = group.options.filter((o) => o.item);
        if (pickable.length < 2) continue;
        outfit[group.id] = Math.random() < 0.75
          ? pickable[Math.floor(Math.random() * pickable.length)].value
          : group.defaultValue;
      }
      return this.resolveConflicts(groups, outfit, null);
    }

    /* ---------- presentation helpers ---------- */

    nameOf(item) {
      const entry = this.text[String(item.ItemId)];
      const raw = (entry && entry.name) || fallbackName(item.SkinKey);
      return raw.replace(/^姿[势勢][A-D]_/, '');
    }

    descriptionOf(item) {
      const entry = this.text[String(item.ItemId)];
      return entry && entry.desc ? entry.desc : '';
    }

    rarityOf(item) {
      return item.RarityEnum && RARITY_LABEL[item.RarityEnum] ? `${item.RarityEnum} · ${RARITY_LABEL[item.RarityEnum]}` : '';
    }

    // Item ids are 1 P 1 0 S VV: slot digit 1 HeadTop, 2 Face, 3 Suit, 4 UpperBody, 5 LowerBody, 6 Leg, 7 Tail, 8 Accessary.
    itemsForPose(poseId) {
      return this.rows.filter((r) => r.OwnedPose === poseId && !r.Hidden);
    }

    optionLabel(groups, value) {
      for (const group of groups) {
        const option = group.options.find((o) => o.value === value);
        if (option) return `${group.label}：${option.label}`;
      }
      return null;
    }
  }

  function fallbackName(skinKey) {
    if (!skinKey) return '默认';
    return skinKey.split('/').pop().replace(/_/g, ' ');
  }

  window.CostumeService = CostumeService;
})();
