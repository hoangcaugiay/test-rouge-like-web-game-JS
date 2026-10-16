/**
 * ============================================================================
 * DATABASE.JS - DỮ LIỆU TRÒ CHƠI ROGUELITE RPG
 * Bao gồm: Kỹ năng, Trang bị & Vật phẩm, Quái vật, Bảng rớt đồ,
 * Danh sách Sự kiện Ngẫu nhiên (Random Events) & Hàng hóa Cửa Hàng (Shop)
 * ============================================================================
 */

// ===========================================================================
// CLASSES DATABASE - DỮ LIỆU CÁC LỚP NHÂN VẬT ĐƯỢC TÁCH RA TỪNG FILE RIÊNG
// (Warrior: ./classes/warrior.js | Mage: ./classes/mage.js | Thief: ./classes/thief.js)
// ===========================================================================
import {
  warriorClass,
  warriorSkills,
  mageClass,
  mageSkills,
  thiefClass,
  rogueClass,
  thiefSkills,
  rogueSkills,
  CLASSES_DATABASE,
  ALL_CLASS_SKILLS
} from './classes/index.js';

export {
  warriorClass,
  warriorSkills,
  mageClass,
  mageSkills,
  thiefClass,
  rogueClass,
  thiefSkills,
  rogueSkills,
  CLASSES_DATABASE
};

export const STATUS_EFFECTS = {
  // === DEBUFFS (HIỆU ỨNG BẤT LỢI) ===
  burn: {
    id: 'burn',
    name: 'Thiêu Đốt',
    icon: '🔥',
    type: 'debuff',
    color: '#f97316',
    desc: 'Bị ngọn lửa thiêu rụi, nhận sát thương trực tiếp xuyên giáp vào đầu mỗi hiệp.'
  },
  poison: {
    id: 'poison',
    name: 'Trúng Độc',
    icon: '🧪',
    type: 'debuff',
    color: '#10b981',
    desc: 'Độc tố ăn mòn sinh lực, sát thương tăng tiến mạnh dần theo thời gian vào đầu mỗi hiệp.'
  },
  vulnerable: {
    id: 'vulnerable',
    name: 'Phá Giáp',
    icon: '🛡️⬇️',
    type: 'debuff',
    color: '#ef4444',
    desc: 'Giáp bị vỡ vụn, nhận thêm +50% sát thương từ mọi đòn tấn công.'
  },
  weak: {
    id: 'weak',
    name: 'Suy Nhược',
    icon: '⚔️⬇️',
    type: 'debuff',
    color: '#a855f7',
    desc: 'Cơ thể kiệt quệ, sát thương gây ra bị giảm 25%.'
  },
  stun: {
    id: 'stun',
    name: 'Choáng Váng',
    icon: '💫',
    type: 'debuff',
    color: '#eab308',
    desc: 'Bị choáng bất tỉnh, mất hoàn toàn lượt hành động kế tiếp.'
  },
  oil: {
    id: 'oil',
    name: 'Dính Dầu',
    icon: '🛢️',
    type: 'debuff',
    color: '#78716c',
    desc: 'Bị phủ dầu trơn bóng, không gây sát thương nhưng là tiền đề kích nổ bùng cháy khi gặp Lửa.'
  },
  chill: {
    id: 'chill',
    name: 'Lạnh Buốt',
    icon: '❄️',
    type: 'debuff',
    color: '#38bdf8',
    desc: 'Khí băng thấu xương, giảm 10% sát thương gây ra và là tiền đề vỡ vụn x3 sát thương.'
  },
  bleed: {
    id: 'bleed',
    name: 'Chảy Máu',
    icon: '🩸',
    type: 'debuff',
    color: '#dc2626',
    desc: 'Vết thương sâu rách toác, mất X% Máu tối đa (Max HP) mỗi hiệp (Tối đa 25 sát thương lên Boss).'
  },
  mark: {
    id: 'mark',
    name: 'Ám Sát',
    icon: '🎯',
    type: 'debuff',
    color: '#c084fc',
    desc: 'Dấu ấn tử thần của Đạo Tặc, mục tiêu nhận thêm +30% sát thương chí mạng.'
  },
  shock: {
    id: 'shock',
    name: 'Giật Điện',
    icon: '⚡',
    type: 'debuff',
    color: '#facc15',
    desc: 'Bị điện giật. Gây sát thương nhẹ và thiêu đốt 1 SP hoặc 1 MP vào đầu mỗi hiệp.'
  },
  acid: {
    id: 'acid',
    name: 'Ăn Mòn',
    icon: '🧪💧',
    type: 'debuff',
    color: '#84cc16',
    desc: 'Axit ăn mòn trang bị. Trừ thẳng điểm Giáp Ảo (Block) mỗi hiệp. Nếu hết Block, trừ vào HP.'
  },
  doom: {
    id: 'doom',
    name: 'Bản Án Tử',
    icon: '💀⏳',
    type: 'debuff',
    color: '#9333ea',
    desc: 'Ám khí đếm ngược. Không gây sát thương mỗi hiệp, nhưng khi hiệp cuối kết thúc sẽ phát nổ gây 50 sát thương chuẩn khổng lồ.'
  },
  suffocate: {
    id: 'suffocate',
    name: 'Ngạt Thở',
    icon: '💨🫁',
    type: 'debuff',
    color: '#64748b',
    desc: 'Mất dưỡng khí. Gây sát thương bằng 5% Máu tối đa (Max HP) của mục tiêu mỗi hiệp (Tối đa 30 sát thương).'
  },

  // === BUFFS (HIỆU ỨNG CÓ LỢI) ===
  regen: {
    id: 'regen',
    name: 'Tráng Kiện',
    icon: '💖',
    type: 'buff',
    color: '#22c55e',
    desc: 'Khí huyết cuộn trào, tự động hồi phục lượng lớn sinh lực vào đầu mỗi hiệp.'
  },
  strength: {
    id: 'strength',
    name: 'Cường Hóa',
    icon: '⚔️⬆️',
    type: 'buff',
    color: '#f59e0b',
    desc: 'Sức mạnh dâng trào, gia tăng trực tiếp sát thương cho mọi đòn đánh.'
  },
  thorns: {
    id: 'thorns',
    name: 'Gai Góc',
    icon: '🌵',
    type: 'buff',
    color: '#84cc16',
    desc: 'Lớp giáp gai nhọn phản lại sát thương trực tiếp khi bị tấn công.'
  },
  dodge: {
    id: 'dodge',
    name: 'Né Tránh',
    icon: '💨',
    type: 'buff',
    color: '#a78bfa',
    desc: 'Thân pháp xuất quỷ nhập thần: Né tránh hoàn toàn 100% đòn tấn công tiếp theo.'
  },
  free_cast: {
    id: 'free_cast',
    name: 'Niệm Miễn Phí',
    icon: '🧘‍♂️✨',
    type: 'buff',
    color: '#38bdf8',
    desc: 'Tập trung niệm chú: Kỹ năng tiếp theo sử dụng hoàn toàn MIỄN PHÍ (0 MP & 0 SP).'
  }
};

// ===========================================================================
// BATTLEFIELD FIELDS DATABASE - CÁC LOẠI ĐỊA HÌNH / VÙNG MÔI TRƯỜNG (DOMAIN)
// ===========================================================================
export const BATTLEFIELD_FIELDS = {
  chaos_swamp: {
    id: 'chaos_swamp',
    name: 'Đầm Lầy Hỗn Mang',
    icon: '☣️🌫️',
    color: '#10b981',
    description: 'Biến chiến trường thành đầm lầy độc hại. Đầu mỗi hiệp, kẻ địch tự động nhiễm Độc (Poison), Thiêu Đốt (Burn) và Ăn Mòn (Acid).'
  },
  electric_net: {
    id: 'electric_net',
    name: 'Lưới Điện Cao Thế',
    icon: '⚡🕸️',
    color: '#38bdf8',
    description: 'Phủ kín chiến trường bằng lưới điện. Đầu mỗi hiệp giật điện gây sát thương và thiêu đốt năng lượng.'
  }
};

// ===========================================================================
// SKILLS DATABASE - TẬP HỢP TẤT CẢ KỸ NĂNG TỪ CÁC MODULE CLASS RIÊNG
// (WarriorSkills + MageSkills + ThiefSkills)
// ===========================================================================
export const SKILLS_DATABASE = {
  ...ALL_CLASS_SKILLS
};

export const ITEMS_DATABASE = {
  // === VŨ KHÍ CƠ BẢN & TIÊU CHUẨN ===
  iron_sword: {
    id: 'iron_sword',
    name: 'Kiếm Sắt Thường',
    type: 'weapon',
    icon: '⚔️',
    desc: 'Thanh kiếm tiêu chuẩn của tân binh.',
    classReq: 'warrior',
    attackMod: 2,
    damageDice: '1d8',
    canCounter: true,
    price: 25,
    isShopExclusive: false
  },
  steel_greatsword: {
    id: 'steel_greatsword',
    name: 'Đại Kiếm Thép Rèn',
    type: 'weapon',
    icon: '🗡️',
    desc: 'Vũ khí hạng nặng chém nát giáp sắt (+4 Atk, 2d6 Dmg).',
    classReq: 'warrior',
    attackMod: 4,
    damageDice: '2d6',
    canCounter: true,
    price: 55,
    isShopExclusive: false
  },
  rogue_dagger: {
    id: 'rogue_dagger',
    name: 'Dao Găm Sát Thủ',
    type: 'weapon',
    icon: '🗡️',
    desc: 'Vũ khí cực kỳ nhanh nhẹn, dễ phản công (+3 Atk, 1d6 Dmg).',
    classReq: 'rogue',
    attackMod: 3,
    damageDice: '1d6',
    canCounter: true,
    price: 40,
    isShopExclusive: false
  },
  apprentice_staff: {
    id: 'apprentice_staff',
    name: 'Gậy Phép Tập Sự',
    type: 'weapon',
    icon: '🔮',
    desc: 'Gậy gỗ khắc chữ phù phép gia tăng ma lực (+1 Atk, 1d6 Dmg).',
    classReq: 'mage',
    attackMod: 1,
    damageDice: '1d6',
    canCounter: false,
    price: 25,
    isShopExclusive: false
  },

  // === VŨ KHÍ ĐỘC QUYỀN SHOP (SHOP EXCLUSIVE) ===
  excalibur: {
    id: 'excalibur',
    name: 'Thánh Kiếm Ánh Sáng',
    type: 'weapon',
    icon: '✨',
    desc: 'Thánh kiếm hoàng gia tỏa ánh hào quang rực rỡ (+5 Atk, 2d8 Dmg, Counter).',
    classReq: 'warrior',
    attackMod: 5,
    damageDice: '2d8',
    canCounter: true,
    price: 85,
    isShopExclusive: true
  },
  demon_reaper: {
    id: 'demon_reaper',
    name: 'Lưỡi Hái Ma Quỷ',
    type: 'weapon',
    icon: '🩸',
    desc: 'Cổ khí hắc ám khát máu xé toạc linh hồn đối thủ (+6 Atk, 3d6 Dmg).',
    classReq: 'all',
    attackMod: 6,
    damageDice: '3d6',
    canCounter: true,
    price: 110,
    isShopExclusive: true
  },

  // ===========================================================================
  // VŨ KHÍ & TRANG BỊ CHUYÊN BIỆT THEO BUILD (CLASS BUILDS)
  // ===========================================================================

  // --- WARRIOR BUILDS ---
  // Build 1: Berserker / Sát Thương Vật Lý Thuần
  bloodstone_axe: {
    id: 'bloodstone_axe',
    name: 'Rìu Huyết Thạch',
    type: 'weapon',
    rarity: 'epic',
    icon: '🪓🩸',
    desc: 'Rèn từ huyết thạch khát máu. Sát thương cơ bản cực khủng (2d10 + 5) và bạo kích dễ dàng (Chí Mạng ở 19-20).',
    classReq: 'warrior',
    attackMod: 5,
    damageDice: '2d10',
    critThreshold: 19,
    canCounter: false,
    price: 115,
    isShopExclusive: false
  },
  // Build 2: Phản Đòn & Gai Góc (Counter / Thorns)
  guardian_spear: {
    id: 'guardian_spear',
    name: 'Giáo Vệ Binh',
    type: 'weapon',
    rarity: 'rare',
    icon: '🔱',
    desc: 'Trường thương của cấm vệ quân. Cho phép Phản Đòn và tăng thêm +50% sát thương khi thực hiện phản đòn (Counter).',
    classReq: 'warrior',
    attackMod: 3,
    damageDice: '1d10',
    canCounter: true,
    counterDamageBonus: 0.5,
    price: 70,
    isShopExclusive: false
  },
  spiked_mace: {
    id: 'spiked_mace',
    name: 'Chùy Gai Giao Thức',
    type: 'weapon',
    rarity: 'rare',
    icon: '🔨',
    desc: 'Chùy sắt bọc gai nhọn đập nát giáp trụ. Đánh trúng 100% áp dụng Phá Giáp 1 hiệp (+3 Atk, 1d10 Dmg).',
    classReq: 'warrior',
    attackMod: 3,
    damageDice: '1d10',
    canCounter: true,
    price: 60,
    isShopExclusive: false,
    onHitEffect: { id: 'vulnerable', duration: 1, value: 50, chance: 1.0 }
  },
  magma_hammer: {
    id: 'magma_hammer',
    name: 'Búa Dung Nham',
    type: 'weapon',
    rarity: 'epic',
    icon: '🔨🔥',
    desc: 'Rèn từ nham thạch sâu dưới lòng đất. Đòn đánh có 50% tỉ lệ Thiêu Đốt mục tiêu (+5 Atk, 2d8 Dmg).',
    classReq: 'warrior',
    attackMod: 5,
    damageDice: '2d8',
    canCounter: false,
    price: 95,
    isShopExclusive: true,
    onHitEffect: { id: 'burn', duration: 3, value: 6, chance: 0.5 }
  },

  // --- MAGE BUILDS ---
  // Build 1: Thiêu Đốt (Burn DoT)
  fire_god_staff: {
    id: 'fire_god_staff',
    name: 'Gậy Hỏa Thần',
    type: 'weapon',
    rarity: 'epic',
    icon: '🔥',
    desc: 'Quyền trượng của Hỏa Thần. Mọi đòn đánh thường có 70% tỉ lệ áp dụng Thiêu Đốt (Burn 1 hiệp, 8 dmg).',
    classReq: 'mage',
    attackMod: 4,
    damageDice: '2d6',
    canCounter: false,
    price: 90,
    isShopExclusive: false,
    onHitEffect: { id: 'burn', duration: 1, value: 8, chance: 0.7 }
  },
  // Build 2: Kiểm Soát & Sinh Tồn (Control / Sustain)
  frost_staff: {
    id: 'frost_staff',
    name: 'Trượng Băng Giá',
    type: 'weapon',
    rarity: 'rare',
    icon: '❄️',
    desc: 'Thấm nhuần hàn băng lạnh thấu xương. Đánh trúng 100% áp dụng Suy Nhược (Weak 1 hiệp, giảm 25% sát thương địch).',
    classReq: 'mage',
    attackMod: 3,
    damageDice: '1d8',
    canCounter: false,
    price: 65,
    isShopExclusive: false,
    onHitEffect: { id: 'weak', duration: 1, value: 25, chance: 1.0 }
  },
  void_orb: {
    id: 'void_orb',
    name: 'Quả Cầu Hư Không',
    type: 'weapon',
    rarity: 'legendary',
    icon: '🔮',
    desc: 'Bảo vật ma pháp vô tận. Mỗi khi đánh trúng kẻ địch, tự động hút linh lực hồi phục +2 Mana (MP).',
    classReq: 'mage',
    attackMod: 5,
    damageDice: '2d8',
    canCounter: false,
    onHitRestoreMp: 2,
    price: 280,
    isShopExclusive: true
  },
  crystalline_wand: {
    id: 'crystalline_wand',
    name: 'Đũa Phép Kết Tinh',
    type: 'weapon',
    rarity: 'epic',
    icon: '💎',
    desc: 'Đũa phép ngưng tụ hàn băng ma thuật. Đòn đánh có 50% tỉ lệ áp dụng Suy Nhược 2 hiệp (+4 Atk, 2d6 Dmg).',
    classReq: 'mage',
    attackMod: 4,
    damageDice: '2d6',
    canCounter: false,
    price: 85,
    isShopExclusive: true,
    onHitEffect: { id: 'weak', duration: 2, value: 25, chance: 0.5 }
  },

  // --- ROGUE BUILDS ---
  // Build 1: Độc Tố (Poison DoT)
  twin_spider_blades: {
    id: 'twin_spider_blades',
    name: 'Song Đao Răng Nhện',
    type: 'weapon',
    rarity: 'epic',
    icon: '⚔️🧪',
    desc: 'Cặp đoản đao tẩm độc nhện chúa. Đánh trúng 100% áp dụng Trúng Độc (Poison 2 hiệp, 6 dmg khởi đầu).',
    classReq: 'rogue',
    attackMod: 4,
    damageDice: '2d6',
    canCounter: true,
    price: 95,
    isShopExclusive: false,
    onHitEffect: { id: 'poison', duration: 2, value: 6, chance: 1.0 }
  },
  emerald_dagger: {
    id: 'emerald_dagger',
    name: 'Lưỡi Dao Lục Bảo',
    type: 'weapon',
    rarity: 'rare',
    icon: '🗡️💚',
    desc: 'Lưỡi dao ngọc bích hòa hợp độc khí. Gây thêm +20% sát thương nếu mục tiêu đang bị dính trạng thái Trúng Độc (Poison).',
    classReq: 'rogue',
    attackMod: 3,
    damageDice: '1d8',
    canCounter: true,
    bonusDmgVsPoison: 0.2,
    price: 65,
    isShopExclusive: false
  },
  spider_fang_dagger: {
    id: 'spider_fang_dagger',
    name: 'Dao Găm Răng Nhện',
    type: 'weapon',
    rarity: 'rare',
    icon: '🗡️🧪',
    desc: 'Chế tác từ răng nanh kịch độc của Nhện Chúa. Đánh trúng 100% áp dụng Trúng Độc kéo dài (+3 Atk, 1d6 Dmg).',
    classReq: 'rogue',
    attackMod: 3,
    damageDice: '1d6',
    canCounter: true,
    price: 65,
    isShopExclusive: false,
    onHitEffect: { id: 'poison', duration: 3, value: 4, chance: 1.0 }
  },
  // Build 2: Né Tránh & Bạo Kích (Dodge / Crit)
  trickster_shadow_blade: {
    id: 'trickster_shadow_blade',
    name: 'Bóng Tối Trí Trá',
    type: 'weapon',
    rarity: 'legendary',
    icon: '🗡️💨',
    desc: 'Vũ khí ám sát tối thượng. Tỷ lệ Chí Mạng cực cao (Chí Mạng ở 17-20). Mỗi khi đánh Chí Mạng tự nhận buff Né Tránh (Dodge 1 lần).',
    classReq: 'rogue',
    attackMod: 6,
    damageDice: '2d8',
    critThreshold: 17,
    onCritGainDodge: true,
    canCounter: true,
    price: 310,
    isShopExclusive: true
  },
  // Build 3: Chảy Máu & Hút Huyết (Bleed / Hemomancer)
  exile_bloodletter: {
    id: 'exile_bloodletter',
    name: 'Huyết Đao Kẻ Lưu Đày',
    type: 'weapon',
    rarity: 'legendary',
    icon: '🗡️🩸',
    desc: 'Bảo đao huyền thoại thấm đẫm huyết khí của những kẻ bị đày ải. Hồi phục HP bằng 50% lượng sát thương Chảy Máu (Bleed) kẻ địch phải gánh chịu.',
    classReq: 'thief',
    dropSource: 'boss_only',
    attackMod: 7,
    damageDice: '2d8',
    canCounter: true,
    passiveEffects: { lifestealOnBleed: true },
    lifestealOnBleed: true,
    price: 320,
    isShopExclusive: false
  },

  // === GIÁP THÂN ===
  mage_robe: {
    id: 'mage_robe',
    name: 'Áo Choàng Pháp Sư',
    type: 'armor',
    icon: '🧥',
    desc: 'Áo choàng sợi tơ phù phép hỗ trợ điều hòa luồng ma pháp (AC: 10).',
    classReq: 'mage',
    armorClass: 10,
    price: 20,
    isShopExclusive: false
  },
  leather_armor: {
    id: 'leather_armor',
    name: 'Giáp Da Mềm',
    type: 'armor',
    icon: '🥋',
    desc: 'Bộ giáp cơ bản giúp di chuyển linh hoạt (AC: 12).',
    classReq: 'rogue',
    armorClass: 12,
    price: 20,
    isShopExclusive: false
  },
  chainmail: {
    id: 'chainmail',
    name: 'Giáp Xích Binh Sĩ',
    type: 'armor',
    icon: '🛡️',
    desc: 'Giáp kết từ các mắt xích thép chắc chắn (AC: 14).',
    classReq: 'warrior',
    armorClass: 14,
    price: 45,
    isShopExclusive: false
  },
  plate_armor: {
    id: 'plate_armor',
    name: 'Thiết Giáp Hiệp Sĩ',
    type: 'armor',
    icon: '🛡️',
    desc: 'Bộ giáp hộ thân huyền thoại chống đỡ mọi mũi tên (AC: 16).',
    classReq: 'warrior',
    armorClass: 16,
    price: 75,
    isShopExclusive: false
  },

  // === GIÁP ĐỘC QUYỀN SHOP ===
  dragon_scale_armor: {
    id: 'dragon_scale_armor',
    name: 'Giáp Vảy Rồng Cổ Đại',
    type: 'armor',
    icon: '🐉',
    desc: 'Luyện từ lớp vảy kim cang của Hắc Long, bất hoại kiên cố (AC: 18).',
    classReq: 'all',
    armorClass: 18,
    price: 100,
    isShopExclusive: true
  },

  // === KHIÊN ĐỠ ĐÒN ===
  wood_shield: {
    id: 'wood_shield',
    name: 'Khiên Gỗ Nhỏ',
    type: 'shield',
    icon: '🔰',
    desc: 'Cho phép giơ khiên Đỡ Đòn khi bị đánh trúng. Giảm 1d6 sát thương (+1 AC).',
    classReq: 'warrior',
    bonusAC: 1,
    blockDice: '1d6',
    price: 15,
    isShopExclusive: false
  },
  steel_shield: {
    id: 'steel_shield',
    name: 'Khiên Tháp Thép',
    type: 'shield',
    icon: '🛡️',
    desc: 'Khiên tháp kiên cố. Đỡ đòn giảm 1d8 sát thương (+2 AC).',
    classReq: 'warrior',
    bonusAC: 2,
    blockDice: '1d8',
    price: 40,
    isShopExclusive: false
  },
  fortress_spiked_shield: {
    id: 'fortress_spiked_shield',
    name: 'Khiên Gai Pháo Đài',
    type: 'shield',
    rarity: 'legendary',
    icon: '🛡️🌵',
    desc: 'Đại khiên bọc kín chông gai phòng thủ. Vào đầu mỗi trận chiến, tự động nhận 2 tầng hiệu ứng Gai Góc (Thorns 3 hiệp).',
    classReq: 'warrior',
    bonusAC: 3,
    blockDice: '1d10',
    combatStartEffect: { id: 'thorns', duration: 3, value: 5 },
    price: 260,
    isShopExclusive: true
  },

  // === KHIÊN ĐỘC QUYỀN SHOP ===
  aegis_shield: {
    id: 'aegis_shield',
    name: 'Khiên Thần Aegis',
    type: 'shield',
    icon: '🌟',
    desc: 'Khiên thánh hộ mệnh. Đỡ đòn chặn đứng 1d10 sát thương (+3 AC).',
    classReq: 'warrior',
    bonusAC: 3,
    blockDice: '1d10',
    price: 80,
    isShopExclusive: true
  },

  // === VẬT PHẨM HỒI PHỤC (CONSUMABLES) ===
  health_potion: {
    id: 'health_potion',
    name: 'Bình Máu Đỏ',
    type: 'consumable',
    icon: '🧪',
    desc: 'Hồi phục ngay lập tức 15 Máu (HP).',
    effectType: 'heal_hp',
    value: 15,
    price: 18,
    isShopExclusive: false
  },
  mana_potion: {
    id: 'mana_potion',
    name: 'Bình Mana Xanh',
    type: 'consumable',
    icon: '💧',
    desc: 'Hồi phục ngay lập tức 10 Mana (MP).',
    effectType: 'heal_mp',
    value: 10,
    price: 18,
    isShopExclusive: false
  },
  stamina_potion: {
    id: 'stamina_potion',
    name: 'Bình Thể Lực Vàng',
    type: 'consumable',
    icon: '⚡',
    desc: 'Hồi phục ngay lập tức 6 Thể Lực (SP).',
    effectType: 'heal_sp',
    value: 6,
    price: 15,
    isShopExclusive: false
  },
  elixir: {
    id: 'elixir',
    name: 'Tiên Dược Hồi Sinh',
    type: 'consumable',
    icon: '✨',
    desc: 'Thần dược cổ đại. Hồi trọn vẹn 25 HP, 15 MP và 10 SP.',
    effectType: 'heal_all',
    hpValue: 25,
    mpValue: 15,
    spValue: 10,
    price: 55,
    isShopExclusive: false
  },

  // === DƯỢC PHẨM ĐỘC QUYỀN SHOP ===
  phoenix_feather: {
    id: 'phoenix_feather',
    name: 'Lông Phượng Hoàng',
    type: 'consumable',
    rarity: 'epic',
    icon: '🕊️',
    desc: 'Báu vật hồi sinh thần thánh từ tàn tro Phượng Hoàng. Hồi phục trọn vẹn 40 HP, 20 MP và 15 SP!',
    effectType: 'heal_all',
    hpValue: 40,
    mpValue: 20,
    spValue: 15,
    price: 70,
    isShopExclusive: true
  },

  // === VẬT PHẨM BUFF & BÌNH NÉM TÁC ĐỘNG TRẠNG THÁI (POTIONS & THROWABLES) ===
  strength_potion: {
    id: 'strength_potion',
    name: 'Lọ Thuốc Sức Mạnh',
    type: 'consumable',
    rarity: 'rare',
    icon: '🧪💥',
    desc: 'Dược dịch cường hóa cơ bắp. Uống vào nhận Cường Hóa (+5 sát thương mọi đòn đánh trong 3 hiệp).',
    price: 30,
    isShopExclusive: false,
    applyEffect: { id: 'strength', duration: 3, value: 5, target: 'self' }
  },
  regen_potion: {
    id: 'regen_potion',
    name: 'Lọ Thuốc Tráng Kiện',
    type: 'consumable',
    rarity: 'rare',
    icon: '🧪💖',
    desc: 'Chiết xuất từ hoa hồi sinh thảo. Uống vào nhận Tráng Kiện (Hồi 8 HP/hiệp trong 5 hiệp).',
    price: 35,
    isShopExclusive: false,
    applyEffect: { id: 'regen', duration: 5, value: 8, target: 'self' }
  },
  poison_flask: {
    id: 'poison_flask',
    name: 'Bình Bom Độc',
    type: 'consumable',
    rarity: 'rare',
    icon: '💣🧪',
    desc: 'Bình ném chứa độc dịch cô đặc. Ném vào kẻ địch gây Trúng Độc kéo dài (Poison 4 hiệp).',
    price: 40,
    isShopExclusive: false,
    applyEffect: { id: 'poison', duration: 4, value: 5, target: 'enemy' }
  },
  liquid_fire: {
    id: 'liquid_fire',
    name: 'Bình Lửa Lỏng',
    type: 'consumable',
    rarity: 'rare',
    icon: '🍶🔥',
    desc: 'Bình ném chứa dầu hỏa địa ngục. Ném vào kẻ địch gây Thiêu Đốt cực mạnh (Burn 3 hiệp, 10 sát thương/hiệp).',
    price: 45,
    isShopExclusive: false,
    applyEffect: { id: 'burn', duration: 3, value: 10, target: 'enemy' }
  },
  acid_flask: {
    id: 'acid_flask',
    name: 'Bình Axit Ăn Mòn',
    type: 'consumable',
    rarity: 'rare',
    icon: '🧪💧',
    desc: 'Bình ném chứa axit đậm đặc. Ném vào kẻ địch gây hiệu ứng Ăn Mòn (Acid 4 hiệp, bào mòn 8 Giáp Ảo hoặc máu mỗi hiệp). Phá giáp cực mạnh!',
    price: 45,
    isShopExclusive: false,
    applyEffect: { id: 'acid', duration: 4, value: 8, target: 'enemy' }
  },

  // ===========================================================================
  // CỔ VẬT & TRANG BỊ SỬ THI ĐỘC QUYỀN ELITE (ELITE EXCLUSIVE - EPIC)
  // Chỉ rớt từ quái Tinh Anh (Elite), quái thường không bao giờ có!
  // ===========================================================================
  butchers_gauntlets: {
    id: 'butchers_gauntlets',
    name: 'Găng Tay Đồ Tể',
    type: 'relic',
    rarity: 'epic',
    icon: '🥊',
    desc: 'Cổ vật vấy máu của đồ tể cuồng nộ. Đòn đánh thường và kỹ năng gây thêm +4 Sát Thương chuẩn!',
    price: 130,
    isEliteExclusive: true,
    passive: {
      type: 'bonus_dmg',
      value: 4,
      label: '+4 Sát thương chuẩn mỗi đòn'
    }
  },
  vampiric_blood_ring: {
    id: 'vampiric_blood_ring',
    name: 'Huyết Nhẫn Hấp Huyết',
    type: 'relic',
    rarity: 'epic',
    icon: '💍',
    desc: 'Chiếc nhẫn tà thuật đính huyết ngọc. Tự động hồi phục 3 HP mỗi khi đánh trúng kẻ địch!',
    price: 140,
    isEliteExclusive: true,
    passive: {
      type: 'lifesteal',
      value: 3,
      label: 'Hồi 3 HP mỗi đòn trúng'
    }
  },
  shadow_assassin_blade: {
    id: 'shadow_assassin_blade',
    name: 'Đoản Đao Vô Ảnh',
    type: 'weapon',
    rarity: 'epic',
    icon: '🗡️',
    desc: 'Bảo kiếm ám sát rèn từ quặng bóng tối (+5 Atk, 2d8 Dmg, Phản đòn khi né).',
    classReq: 'rogue',
    attackMod: 5,
    damageDice: '2d8',
    canCounter: true,
    price: 135,
    isEliteExclusive: true
  },
  titan_plate_armor: {
    id: 'titan_plate_armor',
    name: 'Chiến Giáp Hộ Mệnh Titan',
    type: 'armor',
    rarity: 'epic',
    icon: '🛡️',
    desc: 'Giáp tấm cổ xưa luyện bằng kim loại của người khổng lồ Titan (AC: 17).',
    classReq: 'warrior',
    armorClass: 17,
    price: 145,
    isEliteExclusive: true
  },
  obsidian_tower_shield: {
    id: 'obsidian_tower_shield',
    name: 'Đại Khiên Hắc Diện Thạch',
    type: 'shield',
    rarity: 'epic',
    icon: '🛡️',
    desc: 'Khiên tháp đúc từ đá núi lửa nguyên khối. Đỡ đòn cản phá 1d12 sát thương (+4 AC).',
    classReq: 'warrior',
    bonusAC: 4,
    blockDice: '1d12',
    price: 130,
    isEliteExclusive: true
  },

  // ===========================================================================
  // CỔ VẬT HUYỀN THOẠI ĐỘC QUYỀN BOSS (BOSS EXCLUSIVE - LEGENDARY)
  // Chỉ rớt từ Trùm Cuối (Boss), mang sức mạnh xoay chuyển cục diện!
  // ===========================================================================
  mad_king_crown: {
    id: 'mad_king_crown',
    name: 'Vương Miện Vua Điên',
    type: 'relic',
    rarity: 'legendary',
    icon: '👑',
    desc: 'Cổ vật hoàng gia bị nguyền rủa. Đòn đánh Chí Mạng (Critical) gây x3 Sát Thương thay vì x2!',
    price: 320,
    isBossExclusive: true,
    passive: {
      type: 'super_crit',
      multiplier: 3,
      label: 'Chí mạng gây x3 Sát thương'
    }
  },
  crystal_heart: {
    id: 'crystal_heart',
    name: 'Trái Tim Pha Lê',
    type: 'relic',
    rarity: 'legendary',
    icon: '💎',
    desc: 'Trái tim ma tinh linh thiêng còn đập. Tự động hồi phục 10 HP mỗi đầu hiệp đấu!',
    price: 350,
    isBossExclusive: true,
    passive: {
      type: 'turn_heal',
      value: 10,
      label: 'Hồi 10 HP mỗi đầu hiệp'
    }
  },
  void_annihilator: {
    id: 'void_annihilator',
    name: 'Hạt Nhân Hư Không',
    type: 'relic',
    rarity: 'legendary',
    icon: '🔮',
    desc: 'Lõi ma thuật đen nuốt chửng không gian. Gia tăng vĩnh viễn +4 Tấn Công và +3 Giáp AC!',
    price: 330,
    isBossExclusive: true,
    passive: {
      type: 'stat_boost',
      bonusAtk: 4,
      bonusAC: 3,
      label: '+4 Tấn Công & +3 Giáp AC'
    }
  },
  demon_slayer_blade: {
    id: 'demon_slayer_blade',
    name: 'Thần Kiếm Trảm Ma',
    type: 'weapon',
    rarity: 'legendary',
    icon: '⚔️',
    desc: 'Thanh đại kiếm phong ấn quỷ vương nghìn năm (+7 Atk, 3d8 Dmg, Phản kích tàn khốc).',
    classReq: 'all',
    attackMod: 7,
    damageDice: '3d8',
    canCounter: true,
    price: 360,
    isBossExclusive: true
  },
  passive_counter: {
    id: 'passive_counter',
    name: 'Huy Hiệu Bậc Thầy Cận Chiến',
    type: 'relic',
    rarity: 'epic',
    icon: '⚔️🛡️',
    desc: 'Cổ vật dành riêng cho Kỵ Sĩ / Chiến Binh. Tự động gạt đòn chặn sát thương và phản công chớp nhoáng khi quái tấn công bằng đòn đánh thường.',
    classReq: 'warrior',
    price: 150,
    isShopExclusive: false,
    passive: {
      type: 'counter',
      label: 'Tự động gạt đòn và phản công đòn đánh thường'
    }
  }
};

/**
 * DANH SÁCH QUÁI VẬT VÀ TỶ LỆ RỚT VÀNG (GOLD DROP)
 * Thuộc tính: type: 'normal' | 'elite' | 'boss'
 * - Quái thường: Máu 18, Dmg 1d6+2 (TB: 5.5), Vàng 10-20
 * - Quái Elite: Máu gấp 1.8 - 2.2 lần (32-40), Dmg gấp 1.7 - 2 lần (TB: 9.5-12), Vàng 50-80
 * - Boss: Máu gấp 3.6 lần (65), Dmg gấp 3.2 lần (TB: 17.5), Vàng 150-200
 */
export const ENEMIES_DATABASE = {
  goblin: {
    id: 'goblin',
    name: 'Goblin Tiên Phong',
    avatar: '👹',
    type: 'normal',
    hp: 18,
    maxHp: 18,
    ac: 11,
    attackMod: 2,
    damageDice: '1d6',
    canBlock: false,
    canCounter: false,
    skills: ['poison_dart'],
    goldDrop: [10, 20]
  },
  shadow_stalker: {
    id: 'shadow_stalker',
    name: 'Thích Khách Bóng Đêm',
    avatar: '🏹',
    type: 'elite',
    hp: 32,
    maxHp: 32,
    ac: 13,
    attackMod: 4,
    damageDice: '1d10',
    canBlock: false,
    canCounter: false,
    skills: ['shadow_step', 'poison_dart'],
    goldDrop: [50, 80]
  },
  orc_warrior: {
    id: 'orc_warrior',
    name: 'Đao Phủ Hắc Ám',
    avatar: '👺',
    type: 'elite',
    hp: 40,
    maxHp: 40,
    ac: 14,
    attackMod: 5,
    damageDice: '2d6',
    canBlock: false,
    canCounter: false,
    skills: ['sunder', 'heavy_strike'],
    goldDrop: [50, 80]
  },
  demon_lord: {
    id: 'demon_lord',
    name: 'Ma Vương Hầm Ngục',
    avatar: '👿',
    type: 'boss',
    hp: 65,
    maxHp: 65,
    ac: 15,
    attackMod: 7,
    damageDice: '3d6',
    canBlock: false,
    canCounter: false,
    skills: ['fireball', 'lightning_strike'],
    goldDrop: [150, 200]
  }
};

/**
 * ============================================================================
 * 1. BẢNG RỚT ĐỒ QUÁI THƯỜNG (NORMAL DROP TABLE)
 * - Tỷ lệ rớt đồ: ~80% (20% không rớt đồ - None)
 * - Rớt Vàng ít: 10 - 20
 * - Vật phẩm: Bình máu, bình mana, thể lực, đồ Common / Rare
 * ============================================================================
 */
export const NORMAL_DROP_TABLE = [
  // Consumables (~40%)
  { itemId: 'health_potion', weight: 14 },
  { itemId: 'mana_potion', weight: 12 },
  { itemId: 'stamina_potion', weight: 12 },
  { itemId: 'strength_potion', weight: 6 },
  { itemId: 'regen_potion', weight: 6 },
  { itemId: 'poison_flask', weight: 5 },
  { itemId: 'liquid_fire', weight: 5 },

  // Weapons theo Class (~25%)
  // Warrior
  { itemId: 'iron_sword', weight: 6 },
  { itemId: 'spiked_mace', weight: 5 },
  { itemId: 'guardian_spear', weight: 5 },
  // Rogue
  { itemId: 'rogue_dagger', weight: 6 },
  { itemId: 'spider_fang_dagger', weight: 5 },
  { itemId: 'emerald_dagger', weight: 5 },
  // Mage
  { itemId: 'apprentice_staff', weight: 6 },
  { itemId: 'frost_staff', weight: 5 },

  // Armors (~15%)
  { itemId: 'mage_robe', weight: 6 },
  { itemId: 'leather_armor', weight: 6 },
  { itemId: 'chainmail', weight: 6 },

  // Shields (~10%)
  { itemId: 'wood_shield', weight: 6 },
  { itemId: 'steel_shield', weight: 4 },

  // Elixir (~4%)
  { itemId: 'elixir', weight: 4 }
];

/**
 * ============================================================================
 * 2. BẢNG RỚT ĐỒ QUÁI TINH ANH (ELITE DROP TABLE - HIGH RISK, HIGH REWARD)
 * - Tỷ lệ rớt đồ: 100% (Chắc chắn rớt đồ xịn!)
 * - Rớt Vàng nhiều: 50 - 80
 * - Chắc chắn rớt 1 Cổ vật Sử thi HOẶC 1 Trang bị Sử thi độc quyền Elite
 * ============================================================================
 */
export const ELITE_DROP_TABLE = [
  // Cổ vật Sử thi độc quyền Elite (Relics - 35%)
  { itemId: 'butchers_gauntlets', weight: 20 },
  { itemId: 'vampiric_blood_ring', weight: 20 },

  // Trang bị Sử thi theo Class (Weapons / Armors / Shields - 65%)
  // Warrior
  { itemId: 'bloodstone_axe', weight: 15 },
  { itemId: 'magma_hammer', weight: 15 },
  { itemId: 'titan_plate_armor', weight: 12 },
  { itemId: 'obsidian_tower_shield', weight: 12 },
  // Mage
  { itemId: 'fire_god_staff', weight: 15 },
  { itemId: 'crystalline_wand', weight: 15 },
  // Rogue
  { itemId: 'twin_spider_blades', weight: 15 },
  { itemId: 'shadow_assassin_blade', weight: 15 }
];

/**
 * ============================================================================
 * 3. BẢNG RỚT ĐỒ TRÙM CUỐI (BOSS DROP TABLE - LEGENDARY REWARD)
 * - Tỷ lệ rớt đồ: 100%
 * - Rớt Vàng cực khủng: 150 - 200
 * - Chắc chắn rớt 1 Cổ vật Huyền thoại mang sức mạnh thay đổi toàn bộ cục diện
 * ============================================================================
 */
export const BOSS_DROP_TABLE = [
  // Cổ vật Huyền thoại độc quyền Boss (Relics - 50%)
  { itemId: 'mad_king_crown', weight: 25 },
  { itemId: 'crystal_heart', weight: 25 },
  { itemId: 'void_annihilator', weight: 20 },

  // Trang bị Huyền thoại độc quyền Boss theo Class (50%)
  { itemId: 'demon_slayer_blade', weight: 15 }, // Dùng chung (all)
  { itemId: 'fortress_spiked_shield', weight: 15 }, // Warrior
  { itemId: 'void_orb', weight: 15 }, // Mage
  { itemId: 'trickster_shadow_blade', weight: 15 }, // Rogue
  { itemId: 'exile_bloodletter', weight: 15 } // Thief / Bleed build
];

// Giữ lại alias để tương thích ngược cho các hệ thống cũ và module khác
export const LOOT_TABLE = NORMAL_DROP_TABLE;
export const normalDropTable = NORMAL_DROP_TABLE;
export const eliteDropTable = ELITE_DROP_TABLE;
export const bossDropTable = BOSS_DROP_TABLE;

/**
 * Helper kiểm tra tính tương thích giữa classReq của trang bị và Class người chơi
 * Hỗ trợ 'knight' và 'warrior' tương thích lẫn nhau
 * @param {string|null} classReq 
 * @param {string|null} playerClassId 
 * @returns {boolean}
 */
export function isClassCompatible(classReq, playerClassId) {
  if (!classReq || classReq === 'all') return true;
  if (!playerClassId) return true;
  if (classReq === playerClassId) return true;
  if ((classReq === 'knight' || classReq === 'warrior') && (playerClassId === 'knight' || playerClassId === 'warrior')) {
    return true;
  }
  if ((classReq === 'rogue' || classReq === 'thief') && (playerClassId === 'rogue' || playerClassId === 'thief')) {
    return true;
  }
  return false;
}

/**
 * Hàm roll chiến lợi phẩm thông minh theo cấp bậc kẻ thù & Class người chơi (Smart Drop)
 * Chỉ rớt trang bị phù hợp với Class hiện tại của Player hoặc đồ dùng chung (all)
 * @param {string} enemyType 'normal' | 'elite' | 'boss'
 * @param {string|null} playerClassId 'warrior' | 'mage' | 'rogue' | 'knight'
 * @returns {{ item: Object|null, gold: number, enemyType: string }}
 */
export function rollLootByEnemyType(enemyType = 'normal', playerClassId = null) {
  let item = null;
  let gold = 0;

  // Kiểm tra tính tương thích Class
  const isClassMatch = (it) => {
    if (!it) return false;
    if (!playerClassId) return true;
    if (!['weapon', 'armor', 'shield'].includes(it.type)) return true;
    return isClassCompatible(it.classReq, playerClassId);
  };

  // Roll item trong bảng có áp dụng bộ lọc Smart Drop
  const getSmartDropItem = (table) => {
    // Lọc trước các món đồ trong bảng phù hợp với Class của Player
    const validEntries = table.filter(entry => {
      const it = ITEMS_DATABASE[entry.itemId];
      return it && isClassMatch(it);
    });

    const targetPool = validEntries.length > 0 ? validEntries : table;
    const totalWeight = targetPool.reduce((sum, e) => sum + e.weight, 0);
    let rand = Math.random() * totalWeight;
    for (const entry of targetPool) {
      if (rand < entry.weight) {
        return { ...ITEMS_DATABASE[entry.itemId] };
      }
      rand -= entry.weight;
    }
    return { ...ITEMS_DATABASE[targetPool[0].itemId] };
  };

  if (enemyType === 'boss') {
    // 1. BOSS: 150 - 200 Vàng, 100% rớt Legendary Relic / Vũ khí Boss đúng Class
    gold = Math.floor(Math.random() * (200 - 150 + 1)) + 150;
    item = getSmartDropItem(BOSS_DROP_TABLE);
  } else if (enemyType === 'elite') {
    // 2. ELITE: 50 - 80 Vàng, 100% rớt Epic Relic / Trang bị Elite đúng Class
    gold = Math.floor(Math.random() * (80 - 50 + 1)) + 50;
    item = getSmartDropItem(ELITE_DROP_TABLE);
  } else {
    // 3. NORMAL: 10 - 20 Vàng, 20% tỉ lệ không rớt đồ (None), 80% rớt đồ thường đúng Class
    gold = Math.floor(Math.random() * (20 - 10 + 1)) + 10;
    const dropChance = 0.80; // 80% rớt đồ, 20% None
    if (Math.random() <= dropChance) {
      item = getSmartDropItem(NORMAL_DROP_TABLE);
    }
  }

  return { item, gold, enemyType };
}

/**
 * Hàm roll ngẫu nhiên vật phẩm rớt sau trận đấu (Tương thích ngược)
 * @param {boolean|string} isBossOrType
 * @param {string|null} playerClassId
 * @returns {Object|null}
 */
export function rollEnemyLoot(isBossOrType = false, playerClassId = null) {
  let type = 'normal';
  if (typeof isBossOrType === 'string') {
    type = isBossOrType;
  } else if (isBossOrType === true) {
    type = 'boss';
  }
  const result = rollLootByEnemyType(type, playerClassId);
  return result.item;
}

/**
 * Hàm roll lượng vàng rớt từ quái vật
 * @param {string} enemyId
 * @returns {number}
 */
export function rollEnemyGold(enemyId = 'goblin') {
  const enemy = ENEMIES_DATABASE[enemyId] || ENEMIES_DATABASE.goblin;
  const [min, max] = enemy.goldDrop || [10, 20];
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Hàm lấy ngẫu nhiên 3 đến 4 mặt hàng cho Cửa Hàng (Smart Shop Logic)
 * KHÔNG BAO GIỜ bày bán trang bị của Class khác. Chỉ bán trang bị của đúng Class Player hoặc dùng chung (all).
 * Thuốc (Consumables) và Cổ vật (Relics) luôn được bán tự do.
 * @param {number} count Số lượng mặt hàng cần bày bán (3 - 4 món)
 * @param {string|null} playerClassId Class hiện tại của người chơi
 * @returns {Array<Object>}
 */
export function getRandomShopItems(count = 4, playerClassId = null) {
  const allItems = Object.values(ITEMS_DATABASE);

  // Bộ lọc Smart Shop: Chỉ lấy trang bị đúng Class hoặc 'all'
  const isShopEligible = (it) => {
    if (!it) return false;
    const isEquipment = ['weapon', 'armor', 'shield'].includes(it.type);
    if (!isEquipment) return true; // Consumables & Relics dùng chung cho mọi Class
    return isClassCompatible(it.classReq, playerClassId);
  };

  const eligibleItems = allItems.filter(isShopEligible);
  const exclusiveItems = eligibleItems.filter(i => i.isShopExclusive);
  const regularItems = eligibleItems.filter(i => !i.isShopExclusive && !i.isEliteExclusive && !i.isBossExclusive);

  const selected = [];

  // Luôn lấy ít nhất 1-2 món Shop Exclusive hợp lệ
  const shuffledExclusive = [...exclusiveItems].sort(() => 0.5 - Math.random());
  const exclusivePickCount = Math.min(2, shuffledExclusive.length);
  for (let i = 0; i < exclusivePickCount; i++) {
    selected.push({ ...shuffledExclusive[i] });
  }

  // Lấy các món thông thường hợp lệ để đủ số lượng
  const shuffledRegular = [...regularItems].sort(() => 0.5 - Math.random());
  for (const item of shuffledRegular) {
    if (selected.length >= count) break;
    if (!selected.some(s => s.id === item.id)) {
      selected.push({ ...item });
    }
  }

  // Fallback an toàn nếu chưa đủ số lượng: bổ sung các bình thuốc tiêu hao
  if (selected.length < count) {
    const consumables = allItems.filter(i => i.type === 'consumable');
    for (const c of consumables) {
      if (selected.length >= count) break;
      if (!selected.some(s => s.id === c.id)) {
        selected.push({ ...c });
      }
    }
  }

  return selected;
}

/**
 * Hàm lấy ngẫu nhiên 1 trang bị chiến đấu (Weapon, Armor, Shield)
 * Dùng cho các sự kiện tặng trang bị
 */
export function rollRandomEquipment() {
  const equipList = Object.values(ITEMS_DATABASE).filter(
    i => (i.type === 'weapon' || i.type === 'armor' || i.type === 'shield') && !i.isShopExclusive && !i.isEliteExclusive && !i.isBossExclusive
  );
  const randomIndex = Math.floor(Math.random() * equipList.length);
  return { ...equipList[randomIndex] };
}

/**
 * ============================================================================
 * DANH SÁCH SỰ KIỆN NGẪU NHIÊN (RANDOM EVENTS)
 * Mỗi sự kiện bao gồm: Tiêu đề, Mô tả cốt truyện và các Lựa chọn (Choices)
 * ============================================================================
 */
export const RANDOM_EVENTS = [
  {
    id: 'blood_statue',
    title: 'Bức Tượng Huyết Quỷ',
    icon: '🗿',
    desc: 'Trong căn phòng đá ẩm ướt, bạn bắt gặp một bức tượng quỷ dị tạc hình ác ma giang cánh. Đôi mắt đỏ ngầu của nó như đang theo dõi từng hơi thở của bạn. Dưới chân đài tế khắc dòng huyết tự cổ: "Hiến tế dòng máu tươi trẻ, nhận lấy món vũ khí của các dũng sĩ tử trận."',
    choices: [
      {
        id: 'sacrifice',
        title: 'Cắt tay hiến tế máu',
        subtitle: 'Mất 30% Máu Tối Đa (MaxHP), nhận 1 Trang Bị ngẫu nhiên',
        badge: 'Hiến Máu',
        badgeType: 'danger',
        actionType: 'sacrifice_blood'
      },
      {
        id: 'leave',
        title: 'Bỏ đi trong yên lặng',
        subtitle: 'Rút lui an toàn, không nhận bất kỳ hậu quả nào',
        badge: 'An Toàn',
        badgeType: 'neutral',
        actionType: 'leave'
      }
    ]
  },
  {
    id: 'mystic_spring',
    title: 'Suối Nguồn Kỳ Lạ',
    icon: '⛲',
    desc: 'Một mạch nước ngầm phát ra ánh sáng huỳnh quang xanh lục mát lạnh kỳ ảo. Mùi khoáng chất và ma lực tinh khiết tràn ngập không khí, xua tan mùi ẩm mốc hầm ngục. Tuy nhiên, dưới đáy nước lấp lánh thứ gai độc kỳ lạ có thể gây tổn thương da thịt.',
    choices: [
      {
        id: 'drink',
        title: 'Uống nước suối sâu',
        subtitle: 'Hồi phục 100% Mana & Thể Lực (MP & SP), nhưng mất 10 HP do độc tố',
        badge: 'Ma Thuật',
        badgeType: 'warning',
        actionType: 'drink_spring'
      },
      {
        id: 'wash',
        title: 'Rửa vết thương ngoài da',
        subtitle: 'Hồi phục 30% MaxHP, tiêu tốn 20% MP để vận khí thanh tẩy',
        badge: 'Trị Liệu',
        badgeType: 'success',
        actionType: 'wash_wounds'
      },
      {
        id: 'leave',
        title: 'Bỏ qua dòng suối',
        subtitle: 'Tiếp tục hành trình mà không mạo hiểm',
        badge: 'Bỏ Qua',
        badgeType: 'neutral',
        actionType: 'leave'
      }
    ]
  },
  {
    id: 'smuggler',
    title: 'Kẻ Buôn Lậu Hầm Ngục',
    icon: '🦹',
    desc: 'Một kẻ trùm áo choàng rách rưới thình lình hiện ra từ khe nứt vách đá. Chiếc ba lô da của hắn chứa đầy bảo vật phát quang lấp lánh. Hắn nhe răng cười nham hiểm: "Ngươi muốn sở hữu cổ vật của ta với giá hời 50 Vàng, hay có ý định dại dột nào khác?"',
    choices: [
      {
        id: 'buy',
        title: 'Trả 50 Vàng mua bảo vật',
        subtitle: 'Tốn 50 Vàng, nhận ngay 1 Trang Bị / Cổ Vật ngẫu nhiên',
        badge: 'Tốn 50 Vàng',
        badgeType: 'gold',
        goldCost: 50,
        actionType: 'buy_smuggler'
      },
      {
        id: 'rob',
        title: 'Cướp lấy hàng hóa!',
        subtitle: 'Chạm trán Quái Tinh Anh bảo kê của kẻ buôn lậu',
        badge: 'Chiến Đấu',
        badgeType: 'danger',
        actionType: 'fight_smuggler'
      },
      {
        id: 'leave',
        title: 'Lắc đầu từ chối',
        subtitle: 'Tránh xa kẻ mờ ám và tiếp tục tiến bước',
        badge: 'Rời Đi',
        badgeType: 'neutral',
        actionType: 'leave'
      }
    ]
  },
  {
    id: 'cursed_coffer',
    title: 'Hòm Báu Bị Nguyền Rủa',
    icon: '⚰️',
    desc: 'Chiếc rương sắt bọc xương đen phong ấn bằng tà thuật cổ xưa. Một luồng tử khí tím đậm bốc lên nồng nặc. Giọng thì thầm quỷ dị vang vọng: "Kẻ mở hòm sẽ đón nhận kho báu khổng lồ của các vương triều sụp đổ... nhưng linh hồn phải gánh chịu Lời Nguyền Đen vĩnh hằng!"',
    choices: [
      {
        id: 'open_cursed',
        title: 'Mở hòm nhận Kho Báu (Chấp nhận Lời Nguyền)',
        subtitle: 'Nhận 1 Cổ Vật / Trang Bị Cực Xịn + 100 Vàng, nhưng DÍNH 1 LỜI NGUYỀN NGẪU NHIÊN!',
        badge: 'Lời Nguyền',
        badgeType: 'danger',
        actionType: 'open_cursed_coffer'
      },
      {
        id: 'leave',
        title: 'Không đụng vào hòm quỷ',
        subtitle: 'Bảo toàn sinh mạng và tâm trí thanh tịnh',
        badge: 'An Toàn',
        badgeType: 'neutral',
        actionType: 'leave'
      }
    ]
  },
  {
    id: 'ancient_skin_map',
    title: 'Tấm Bản Đồ Da Người Cổ',
    icon: '📜',
    desc: 'Trong hốc tường đá ẩm ướt, bạn tìm thấy một tấm bản đồ cổ khâu bằng da người với những đường mực ma thuật tím ngắt phát quang. Các cổ tự ma thuật dường như ẩn giấu một Mật Đạo Huyền Bí chưa từng được ghi nhận trong hầm ngục...',
    choices: [
      {
        id: 'read_map',
        title: 'Đọc nó và giải mã mật đạo',
        subtitle: 'Mất 20% HP hiện tại, lập tức khai mở Mật Đạo Bí Mật ở chặng phía trước!',
        badge: 'Khai Mở Mật Đạo',
        badgeType: 'warning',
        actionType: 'reveal_secret_path'
      },
      {
        id: 'burn_map',
        title: 'Đốt nó đi',
        subtitle: 'Mảnh da tà ác có thể chứa nguyền rủa, tốt nhất không nên dính vào',
        badge: 'Đốt Đi',
        badgeType: 'neutral',
        actionType: 'leave'
      }
    ]
  }
];

// ===========================================================================
// HỆ THỐNG LỜI NGUYỀN (CURSES DATABASE) - CỔ VẬT ĐEN TAI ƯƠNG
// ===========================================================================
export const CURSES_DATABASE = {
  blindness: {
    id: 'blindness',
    name: 'Lời Nguyền Mù Lòa',
    icon: '👁️‍🗨️',
    color: '#9333ea',
    desc: 'Tầm nhìn bị bao phủ bởi làn sương đen ma quái. Giảm tỷ lệ đánh trúng (-3 điểm Attack Roll).',
    effectType: 'accuracy_penalty',
    value: 3
  },
  fragile: {
    id: 'fragile',
    name: 'Lời Nguyền Mỏng Manh',
    icon: '💔',
    color: '#dc2626',
    desc: 'Xương thịt trở nên giòn vụn trước ma thuật tà ác. Nhận thêm 20% sát thương từ mọi nguồn.',
    effectType: 'damage_taken_increase',
    multiplier: 1.2
  },
  greed_curse: {
    id: 'greed_curse',
    name: 'Lời Nguyền Tham Lam',
    icon: '💸',
    color: '#d97706',
    desc: 'Ánh vàng ma quỷ che mờ tâm trí. Mọi món hàng trong Cửa Hàng đắt hơn 50%!',
    effectType: 'shop_price_increase',
    multiplier: 1.5
  },
  decaying_blood: {
    id: 'decaying_blood',
    name: 'Lời Nguyền Huyết Cạn',
    icon: '🩸',
    color: '#b91c1c',
    desc: 'Mạch máu liên tục rỉ độc tố hầm ngục. Bắt đầu mỗi trận chiến với 10% HP hiện tại bị hao tổn.',
    effectType: 'combat_start_damage',
    percent: 0.1
  }
};

// ===========================================================================
// ĐỘT BIẾN KẺ ĐỊCH (ENEMY AFFIXES / MODIFIERS) CHO QUÁI TINH ANH (ELITE)
// ===========================================================================
export const ENEMY_MODIFIERS = {
  vampiric: {
    id: 'vampiric',
    name: 'Hút Máu',
    icon: '🧛',
    color: '#ef4444',
    badge: 'HÚT MÁU',
    desc: 'Hồi phục lượng Máu bằng 30% sát thương thực tế gây ra cho người chơi.'
  },
  spiky: {
    id: 'spiky',
    name: 'Gai Góc',
    icon: '🌵',
    color: '#f97316',
    badge: 'GAI GÓC',
    desc: 'Phản lại 2 sát thương chuẩn mỗi khi người chơi tấn công trúng đích.'
  },
  frenzied: {
    id: 'frenzied',
    name: 'Cuồng Nộ',
    icon: '🔥',
    color: '#e11d48',
    badge: 'CUỒNG NỘ',
    desc: 'Khi lượng Máu tụt xuống dưới 50%, sát thương mọi đòn đánh tăng x1.5!'
  },
  fortified: {
    id: 'fortified',
    name: 'Bọc Thép',
    icon: '🛡️',
    color: '#0284c7',
    badge: 'BỌC THÉP',
    desc: 'Lớp giáp gai ma thuật gia tăng vĩnh viễn +3 Giáp AC.'
  }
};
