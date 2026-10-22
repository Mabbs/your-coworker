// Skin list and category mapping mirror the game's SKIN_NAME / CLOTHE_TYPE enums
// (Assembly-CSharp: SKIN_NAME.cs, CLOTHE_TYPE.cs). Selection is single-slot per category,
// matching SpineSkinData.biz() / SpineSkinSetting.bke() which keep one desired id per CLOTHE_TYPE.

export const CATEGORIES = [
  {
    id: 'Hair',
    label: '发型',
    type: 'Hair',
    mode: 'skins',
    hairColors: true,
    skins: [
      ['Hair_ShortHair', '短发'],
      ['Hair_MediumLengthHair', '中长发'],
      ['Hair_TwintailsHair', '双马尾'],
      ['Hair_PigtailsHair', '双辫'],
      ['Hair_BobHair', '波波头'],
      ['Hair_PixieShortHair', '精灵短发'],
      ['Hair_LongStraightHair', '长直发'],
      ['Hair_LongWavyHair', '长卷发'],
      ['Hair_Afro', '爆炸头'],
      ['Hair_SpaceBuns', '太空丸子头'],
      ['Hair_HighBun', '高丸子头'],
      ['Hair_HighSidePonytail', '高侧马尾'],
      ['Hair_FrenchBraid', '法式辫'],
      ['Hair_SingleBraid', '单辫'],
      ['Hair_CrisscrossUpdo', '交叉盘发'],
      ['Hair_LongStraightHair_Headband', '长直发 + 发带'],
      ['Hair_LongStraightHair_BowHeadband', '长直发 + 蝴蝶结'],
      ['Hair_Ivys', 'Ivys'],
      ['Hair_Ivys_2', 'Ivys 2'],
      ['Hair_Manelle', 'Manelle'],
      ['Hair_Manelle_2', 'Manelle 2']
    ]
  },
  {
    id: 'Top',
    label: '上衣',
    type: 'Top',
    mode: 'items',
    skins: [['Top', '上衣']]
  },
  {
    id: 'Bottom',
    label: '下装',
    type: 'Bottom',
    mode: 'items',
    skins: [['Bottom', '下装']]
  },
  {
    id: 'Underwear',
    label: '内衣',
    type: 'Underwear',
    mode: 'items',
    skins: [['Underwear', '内衣']]
  },
  {
    id: 'Socks',
    label: '袜子',
    type: 'Socks',
    mode: 'items',
    skins: [['Socks', '袜子']]
  },
  {
    id: 'Shoes',
    label: '鞋',
    type: 'Shoes',
    mode: 'items',
    skins: [['Shoes', '鞋']]
  },
  {
    id: 'Accessories',
    label: '配饰',
    type: 'Accessories',
    mode: 'skins',
    skins: [['Accessories', '眼镜']]
  },
  {
    id: 'PubicAndGenital',
    label: '私处',
    type: 'PubicAndGenital',
    mode: 'skins',
    skins: [
      ['PubicAndGenital_PubicHair', '耻毛'],
      ['PubicAndGenital_Futa_Small', '扶她 · 小'],
      ['PubicAndGenital_Futa_Small_Ball', '扶她 · 小 + 球'],
      ['PubicAndGenital_Futa_Big', '扶她 · 大'],
      ['PubicAndGenital_Futa_Big_Ball', '扶她 · 大 + 球']
    ]
  }
];

export const ALL_SKINS = new Map();
for (const cat of CATEGORIES) {
  for (const [name, label] of cat.skins) ALL_SKINS.set(name, { label, category: cat.id, type: cat.type });
}

// Display names for the CLOTHE_NAME enum tokens. The raw enum name is kept in
// every tooltip so labels can always be traced back to the serialized data.
const COLOR_LABELS = {
  White: '白', Black: '黑', Red: '红', Blue: '蓝', Pink: '粉', Purple: '紫',
  Yellow: '黄', Green: '绿', Brown: '棕', Golden: '金', Silver: '银', Orange: '橙'
};

const STYLE_LABELS = {
  TShirt: 'T 恤',
  Kimono: '和服',
  PoloShirt: 'Polo 衫',
  CroppedTop: '短款上衣',
  Apron: '围裙',
  BathTowel: '浴巾',
  SleevelessCroppedTop: '无袖短上衣',
  WetTShirt: '湿 T 恤',
  OffShoulderTop: '露肩上衣',
  OffShoulderPuffSleeveCropTop: '露肩泡泡袖短上衣',
  NurseUniformTop: '护士制服上衣',
  AthleticSportsTop: '运动上衣',
  MilitaryStyleUniformTop: '军装上衣',
  FlightAttendantUniformTop: '空乘制服上衣',
  TraditionalCheongsam: '传统旗袍',
  AviatorFlightJacket: '飞行员夹克',
  SeductiveMaidOutfit: '魅惑女仆装',
  AlluringMaidOutfit: '诱人女仆装',
  DrapedLongSkirt: '垂坠长裙',
  LowWaistPleatedSkirt: '低腰百褶裙',
  GatheredSkirt: '抽褶裙',
  TieredSkirt: '层叠裙',
  LeatherMiniSkirt: '皮革迷你裙',
  StraightSkirt: '直筒裙',
  WrapSkirt: '裹身裙',
  PencilSkirt: '铅笔裙',
  FullSkirt: '蓬蓬裙',
  PleatedSkirt: '百褶裙',
  RuffleSkirt: '荷叶边裙',
  TutuSkirt: '芭蕾纱裙',
  RuffleBubbleSkirt: '荷叶泡泡裙',
  SportsBra: '运动内衣',
  SpaghettiStrapBra: '细吊带内衣',
  LaceBra: '蕾丝内衣',
  SexyLingerie: '性感内衣',
  StraplessBra: '无肩带内衣',
  FloralBikini: '碎花比基尼',
  MetalRingBandeauBra: '金属环抹胸',
  BandeauBra: '抹胸',
  HalterNeckBikini: '挂脖比基尼',
  HalterBikini: '挂脖比基尼',
  TriangleBikini: '三角比基尼',
  SexyBikini: '性感比基尼',
  MicroBikini: '微型比基尼',
  BandageBra: '绷带内衣',
  HeartPasties: '心形乳贴',
  StarPasties: '星形乳贴',
  CrossBlackPasties: '十字乳贴',
  ShellPasties: '贝壳乳贴',
  CrystalPasties: '水晶乳贴',
  SlimeBra: '史莱姆内衣',
  MilkSplashBra: '牛奶内衣',
  CrewSocks: '中筒袜',
  CalfSocks: '小腿袜',
  FrillyCrewSocks: '荷叶边中筒袜',
  ScrunchedSocks: '堆堆袜',
  ThighHighSocks: '过膝袜',
  StripedThighHighSocks: '条纹过膝袜',
  FishnetThighHighSocks: '渔网过膝袜',
  BlackStockings: '黑色丝袜',
  LeopardPrintStockings: '豹纹丝袜',
  CowPrintStockings: '奶牛纹丝袜',
  SlimeSocks: '史莱姆袜',
  ThighGraffiti: '大腿纹身袜',
  MilkSplashSocks: '牛奶袜',
  CanvasShoes: '帆布鞋',
  FlipFlops: '人字拖',
  AnkleBoots: '短靴',
  DesignerCanvasShoes: '设计师帆布鞋',
  Slippers: '拖鞋',
  FurBoots: '毛绒靴',
  Sneakers: '运动鞋',
  GladiatorSandals: '角斗士凉鞋',
  PlatformSandals: '厚底凉鞋',
  HighHeels: '高跟鞋',
  CombatBoots: '战斗靴',
  BalletShoes: '芭蕾鞋',
  AnkleShackles: '脚镣',
  ArmoredBoots: '装甲靴',
  NinjaBoots: '忍者靴',
  FuturisticHighHeels: '未来感高跟鞋',
  Geta: '木屐',
  Anklet: '脚链',
  BellAnklet: '铃铛脚链'
};

export function splitClotheName(enumName) {
  const at = enumName.lastIndexOf('_');
  if (at < 0) return { style: enumName, color: null };
  return { style: enumName.slice(0, at), color: enumName.slice(at + 1) };
}

export function clotheStyleLabel(enumName) {
  const { style } = splitClotheName(enumName);
  return STYLE_LABELS[style] || style;
}

export function clotheLabel(enumName) {
  const { color } = splitClotheName(enumName);
  const style = clotheStyleLabel(enumName);
  return color ? `${style} · ${COLOR_LABELS[color] || color}` : style;
}

export function colorLabel(color) {
  return COLOR_LABELS[color] || color;
}

export const TYPE_LABELS = {
  Idle: '待机',
  Idle_H: '互动待机',
  Idle_H_End: '高潮余韵',
  Fuck_Start: '进入',
  Fuck_Loop: '抽插循环',
  Fuck_End: '高潮'
};
