/**
 * ============================================================================
 * THIEF.JS - DỮ LIỆU CLASS ĐẠO TẶC / SÁT THỦ (THIEF / ROGUE)
 * Lối chơi: Điểm Liên Kích (Combo Points), Kỹ năng Móc Túi (Pickpocket), Né Tránh & Kết Liễu
 * ============================================================================
 */

export const thiefClass = {
  id: 'thief',
  name: 'Đạo Tặc / Sát Thủ',
  avatar: '🗡️',
  trait: 'Liên Kích (Combo Points), Móc Túi (Pickpocket) & Phản đòn khi né tránh',
  hp: 26,
  maxHp: 26,
  mp: 15,
  maxMp: 15,
  sp: 12,
  maxSp: 12,
  ac: 12,
  attackMod: 4,
  damageDice: '1d6',
  canBlock: false,
  canCounter: true,
  maxComboPoints: 5,
  skills: ['piercing_strike']
};

export const rogueClass = {
  ...thiefClass,
  id: 'rogue'
};

export const thiefSkills = {
  poison_dart: {
    id: 'poison_dart',
    name: 'Phi Tiêu Tẩm Độc',
    icon: '🎯🧪',
    desc: 'Bắn phi tiêu tẩm kịch độc ăn mòn, gây 1d6 + 2 sát thương xuyên giáp và Trúng Độc kéo dài (Poison 4 hiệp).',
    classReq: 'rogue',
    mpCost: 4,
    spCost: 2,
    type: 'pierce',
    damageDice: '1d6',
    flatDamage: 2,
    applyEffect: { id: 'poison', duration: 4, value: 4, target: 'enemy' }
  },
  hamstring: {
    id: 'hamstring',
    name: 'Cắt Gân',
    icon: '🗡️🩸',
    desc: 'Đường kiếm lẹ làng cắt đứt gân lực, gây 2d6 sát thương vật lý và làm đối thủ Suy Nhược (Weak -25% sát thương 2 hiệp).',
    classReq: 'rogue',
    mpCost: 5,
    spCost: 3,
    type: 'damage',
    damageDice: '2d6',
    bonusAtk: 2,
    applyEffect: { id: 'weak', duration: 2, value: 25, target: 'enemy' }
  },
  smoke_bomb: {
    id: 'smoke_bomb',
    name: 'Bom Khói',
    icon: '💨',
    desc: 'Ném bom khói hòa mình vào hư vô. Tự buff Né Tránh (Dodge né hoàn toàn 100% đòn tấn công tiếp theo).',
    classReq: 'rogue',
    mpCost: 5,
    spCost: 2,
    type: 'buff',
    applyEffect: { id: 'dodge', duration: 1, value: 0, target: 'self' }
  },
  eviscerate: {
    id: 'eviscerate',
    name: 'Cắt Cổ (Eviscerate)',
    icon: '🗡️🩸',
    desc: 'Kỹ năng kết liễu tối thượng: Tiêu hao toàn bộ Điểm Liên Kích (Combo Points). Gây 1d8 sát thương cơ bản và nhân bội số theo số Combo Points tiêu hao (Tối đa x5 sát thương)!',
    classReq: 'rogue',
    mpCost: 4,
    spCost: 3,
    type: 'finisher',
    costType: 'combo',
    requiresCombo: true,
    damageDice: '1d8',
    bonusAtk: 2
  },
  pickpocket: {
    id: 'pickpocket',
    name: 'Móc Túi (Pickpocket)',
    icon: '🧤💰',
    desc: 'Động tác chớp nhoáng thó đồ trong túi đối phương: Không gây sát thương. Trộm 10-25 Vàng từ kẻ địch (hoặc 20% trộm được 1 Bình Máu). Mỗi quái vật chỉ trộm được 1 lần!',
    classReq: 'rogue',
    mpCost: 3,
    spCost: 2,
    type: 'utility',
    isPickpocket: true
  },
  piercing_strike: {
    id: 'piercing_strike',
    name: 'Đâm Xuyên Giáp',
    icon: '🗡️',
    desc: 'Đòn đâm chính xác vào yếu huyệt, gây 1d10 + 3 sát thương chuẩn.',
    classReq: 'rogue',  
    mpCost: 5,
    spCost: 3,
    type: 'pierce',
    damageDice: '1d10',
    flatDamage: 3
  },
  shadow_step: {
    id: 'shadow_step',
    name: 'Bước Bóng Tối',
    icon: '🌑',
    desc: 'Hòa mình vào bóng tối, hồi phục 1d8 + 2 HP và làm Suy Nhược đòn đánh địch (Weak 2 hiệp).',
    classReq: 'rogue',
    mpCost: 4,
    spCost: 0,
    type: 'heal',
    healDice: '1d8',
    healBonus: 2,
    applyEffect: { id: 'weak', duration: 2, value: 25, target: 'enemy' }
  },
  // === CHAIN COMBO / THÊM LƯỢT: BƯỚC CHÂN GIÓ ===
  wind_step: {
    id: 'wind_step',
    name: 'Bước Chân Gió',
    icon: '💨👣',
    desc: 'Tăng tốc độ tối đa vượt qua giới hạn thân pháp. Ngay lập tức nhận thêm 1 Lượt hành động miễn phí!',
    classReq: 'thief',
    mpCost: 0,
    spCost: 3,
    cooldown: 4,
    type: 'buff',
    grantExtraTurn: true
  },
  // === KỸ NĂNG DOT PHÁN QUYẾT: ẤN TỬ THẦN (DOOM MARK) ===
  doom_mark: {
    id: 'doom_mark',
    name: 'Ấn Tử Thần',
    icon: '💀⏳',
    desc: 'Khắc dấu bản án tử thần lên linh hồn mục tiêu: Đếm ngược trong 3 hiệp, khi thời gian kết thúc sẽ phát nổ gây 50 sát thương chuẩn!',
    classReq: 'thief',
    mpCost: 5,
    spCost: 3,
    type: 'buff',
    applyEffect: { id: 'doom', duration: 3, value: 50, target: 'enemy' }
  },
  // === CHIÊU CUỐI / VÙNG MÔI TRƯỜNG (FIELD DOMAIN): ĐẦM LẦY HỖN MANG ===
  chaos_swamp: {
    id: 'chaos_swamp',
    name: 'Đầm Lầy Hỗn Mang',
    icon: '☣️🌫️',
    desc: 'Biến chiến trường thành đầm lầy độc hại trong 3 hiệp. Đầu mỗi hiệp, kẻ địch tự động nhiễm Độc (Poison), Thiêu Đốt (Burn) và Ăn Mòn (Acid).',
    classReq: 'thief',
    mpCost: 4,
    spCost: 0,
    cooldown: 5,
    baseDamage: 0,
    type: 'field',
    setField: 'chaos_swamp',
    fieldDuration: 3
  },
  // === LỐI CHƠI CHUYÊN CHẢY MÁU (BLEED / HEMOMANCER BUILD) ===
  // Skill 1: Cắt Mạch Máu (Artery Sever) - Tiền đề
  artery_sever: {
    id: 'artery_sever',
    name: 'Cắt Mạch Máu',
    icon: '🗡️🩸',
    desc: 'Chém nhanh vào điểm yếu hiểm hóc: Gây sát thương nhẹ, áp dụng Chảy Máu (Bleed 3 hiệp, rút 3% Max HP/hiệp) và tích lũy +1 Điểm Liên Kích (Combo Point).',
    classReq: 'thief',
    mpCost: 0,
    spCost: 1,
    baseDamage: 5,
    type: 'damage',
    damageDice: '1d6',
    generatesCombo: 1,
    applyEffect: { id: 'bleed', duration: 3, value: 3, target: 'enemy' }
  },
  // Skill 2: Xé Rách Vết Thương (Tear Open) - Khuếch đại
  tear_open: {
    id: 'tear_open',
    name: 'Xé Rách Vết Thương',
    icon: '🩸✂️',
    desc: 'Tấn công tàn khốc vào vết rách cũ: Gây 8 sát thương. Nếu mục tiêu ĐANG BỊ Chảy Máu (Bleed), kéo dài thêm 2 hiệp và tăng thêm +2% Max HP sát thương mỗi hiệp!',
    classReq: 'thief',
    mpCost: 0,
    spCost: 2,
    cooldown: 2,
    baseDamage: 8,
    type: 'damage',
    damageDice: '1d8',
    bonusAtk: 1
  },
  // Skill 3: Bức Tử (Rupture / Exsanguinate) - Kích nổ (Finisher)
  rupture: {
    id: 'rupture',
    name: 'Bức Tử',
    icon: '🩸💥',
    desc: 'Chiêu kết liễu tối thượng: Tiêu hao toàn bộ Điểm Liên Kích để nhân sát thương cơ bản (10 Dmg x Combo). ĐẶC BIỆT: Kích nổ toàn bộ lượng sát thương Chảy Máu (% Max HP) còn lại thành sát thương tức thì và xóa bỏ vết thương!',
    classReq: 'thief',
    mpCost: 0,
    spCost: 0,
    costType: 'combo',
    requiresCombo: true,
    baseDamage: 10,
    type: 'finisher'
  }
};

export const rogueSkills = thiefSkills;

// Alias tương thích ngược nếu còn lưu ID cũ, không tạo trùng lặp trong Object.values()
Object.defineProperty(thiefSkills, 'thief_finisher', {
  value: thiefSkills.eviscerate,
  enumerable: false,
  writable: true,
  configurable: true
});

Object.defineProperty(thiefSkills, 'thief_pickpocket', {
  value: thiefSkills.pickpocket,
  enumerable: false,
  writable: true,
  configurable: true
});
