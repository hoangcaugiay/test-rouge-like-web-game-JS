/**
 * ============================================================================
 * MAGE.JS - DỮ LIỆU CLASS PHÁP SƯ (MAGE)
 * Lối chơi: Quản lý Mana, Khiên Năng Lượng (Mana Shield) & Quá Tải Ma Thuật (Arcane Overcharge)
 * ============================================================================
 */

export const mageClass = {
  id: 'mage',
  name: 'Pháp Sư',
  avatar: '🧙',
  trait: 'Khiên Năng Lượng (30% sát thương vào MP) & Quá Tải Ma Thuật (x2 Sát thương + 0 MP)',
  hp: 22,
  maxHp: 22,
  mp: 30,
  maxMp: 30,
  sp: 8,
  maxSp: 8,
  ac: 10,
  attackMod: 1,
  damageDice: '1d6',
  canBlock: false,
  canCounter: false,
  maxArcaneCharges: 3,
  manaShieldRatio: 0.30,
  skills: ['fireball']
};

export const mageSkills = {
  fireball: {
    id: 'fireball',
    name: 'Cầu Lửa',
    icon: '🔥',
    desc: 'Phóng khối cầu lửa ma thuật dữ dội, gây 3d6 sát thương phép cao và Thiêu Đốt mục tiêu (Burn 3 hiệp).',
    classReq: 'mage',
    mpCost: 8,
    spCost: 0,
    type: 'damage',
    damageDice: '3d6',
    bonusAtk: 1,
    applyEffect: { id: 'burn', duration: 3, value: 6, target: 'enemy' }
  },
  lightning_strike: {
    id: 'lightning_strike',
    name: 'Sét Giật',
    icon: '⚡',
    desc: 'Triệu hồi tia sét giáng xuống từ trời cao, gây 2d8 + 2 sát thương xuyên giáp và làm Choáng đối thủ (Stun 1 hiệp).',
    classReq: 'mage',
    mpCost: 7,
    spCost: 0,
    type: 'pierce',
    damageDice: '2d8',
    flatDamage: 2,
    applyEffect: { id: 'stun', duration: 1, value: 0, target: 'enemy' }
  },
  frost_armor: {
    id: 'frost_armor',
    name: 'Khiên Băng',
    icon: '❄️🛡️',
    desc: 'Ngưng kết hàn băng hộ thể: Tự tạo 15 Giáp Ảo (Block) và buff Gai Góc phản lại 7 sát thương (Thorns 2 hiệp).',
    classReq: 'mage',
    mpCost: 6,
    spCost: 0,
    type: 'buff',
    blockBonus: 15,
    applyEffect: { id: 'thorns', duration: 2, value: 7, target: 'self' }
  },
  divine_heal: {
    id: 'divine_heal',
    name: 'Ánh Sáng Thánh Linh',
    icon: '✨',
    desc: 'Cầu nguyện hồi phục 1d10 + 6 HP và nhận Tráng Kiện hồi máu theo hiệp (Regen 3 hiệp).',
    classReq: 'mage',
    mpCost: 6,
    spCost: 0,
    type: 'heal',
    healDice: '1d10',
    healBonus: 6,
    applyEffect: { id: 'regen', duration: 3, value: 6, target: 'self' }
  },
  // === CHAIN COMBO / MIỄN PHÍ: TẬP TRUNG NIỆM CHÚ ===
  focus_cast: {
    id: 'focus_cast',
    name: 'Tập Trung Niệm Chú',
    icon: '🧘‍♂️🔮',
    desc: 'Vận chuyển ma lực tuần hoàn. Kỹ năng tiếp theo bạn sử dụng sẽ hoàn toàn MIỄN PHÍ (0 MP & 0 SP)!',
    classReq: 'mage',
    mpCost: 2,
    spCost: 0,
    cooldown: 3,
    type: 'buff',
    applyEffect: { id: 'free_cast', duration: 1, value: 0, target: 'self' }
  },
  // === KỸ NĂNG DOT SỐC ĐIỆN: LƯỚI ĐIỆN (CHAIN LIGHTNING) ===
  chain_lightning: {
    id: 'chain_lightning',
    name: 'Lưới Điện',
    icon: '⚡🕸️',
    desc: 'Phóng mạng lưới sấm sét chằng chịt, gây 2d6 + 2 sát thương phép và áp dụng Giật Điện (Shock 3 hiệp, -5 HP và đốt 1 SP/MP mỗi hiệp).',
    classReq: 'mage',
    mpCost: 6,
    spCost: 0,
    type: 'damage',
    damageDice: '2d6',
    bonusAtk: 2,
    applyEffect: { id: 'shock', duration: 3, value: 5, target: 'enemy' }
  },
  // === CHIÊU CUỐI / VÙNG MÔI TRƯỜNG (FIELD DOMAIN): ĐẦM LẦY HỖN MANG ===
  chaos_swamp: {
    id: 'chaos_swamp',
    name: 'Đầm Lầy Hỗn Mang',
    icon: '☣️🌫️',
    desc: 'Biến chiến trường thành đầm lầy độc hại trong 3 hiệp. Đầu mỗi hiệp, kẻ địch tự động nhiễm Độc (Poison), Thiêu Đốt (Burn) và Ăn Mòn (Acid).',
    classReq: 'mage',
    mpCost: 4,
    spCost: 0,
    cooldown: 5,
    baseDamage: 0,
    type: 'field',
    setField: 'chaos_swamp',
    fieldDuration: 3
  }
};
