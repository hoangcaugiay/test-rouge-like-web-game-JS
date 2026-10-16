/**
 * ============================================================================
 * WARRIOR.JS - DỮ LIỆU CLASS CHIẾN BINH (WARRIOR / KNIGHT)
 * Lối chơi: Bậc thầy cận chiến, Đỡ đòn & Phản công đòn đánh thường (Counter)
 * ============================================================================
 */

export const warriorClass = {
  id: 'warrior',
  name: 'Chiến Binh',
  avatar: '🛡️',
  trait: 'Bậc thầy cận chiến: Đỡ đòn (Block) & Phản công đòn đánh thường (Counter)',
  hp: 35,
  maxHp: 35,
  mp: 10,
  maxMp: 10,
  sp: 14,
  maxSp: 14,
  ac: 14,
  attackMod: 3,
  damageDice: '1d8',
  canBlock: true,
  canCounter: true,
  skills: ['heavy_strike']
};

export const warriorSkills = {
  // === SKILL KHỞI ĐẦU MẶC ĐỊNH ===
  heavy_strike: {
    id: 'heavy_strike',
    name: 'Trảm Kích Dũng Mãnh',
    icon: '💥⚔️',
    desc: 'Dồn toàn lực tung nhát chém sấm sét, gây 2d8 + AtkMod sát thương vật lý và tăng 15 Nộ Khí.',
    classReq: 'warrior',
    mpCost: 4,
    spCost: 2,
    type: 'damage',
    damageDice: '2d8',
    bonusAtk: 2
  },

  // === COMBO 1: CHẢY MÁU & HÚT MÁU (REND + BLOODTHIRST) ===
  rend: {
    id: 'rend',
    name: 'Chém Rách',
    icon: '🩸🗡️',
    desc: 'Lưỡi kiếm bổ xé toạc da thịt, gây 1d8 + 3 sát thương vật lý và áp dụng Chảy Máu (Bleed 3 hiệp, -6 HP/hiệp). Tiền đề cho Khát Máu!',
    classReq: 'warrior',
    mpCost: 3,
    spCost: 2,
    type: 'damage',
    damageDice: '1d8',
    bonusAtk: 2,
    applyEffect: { id: 'bleed', duration: 3, value: 6, target: 'enemy' }
  },
  bloodthirst: {
    id: 'bloodthirst',
    name: 'Khát Máu',
    icon: '🩸👄',
    desc: 'Đòn cắn xé dã man gây 2d6 + 2 sát thương vật lý. COMBO: Nếu mục tiêu đang bị Chảy Máu (Bleed), hồi phục HP bằng 50% sát thương gây ra!',
    classReq: 'warrior',
    mpCost: 4,
    spCost: 3,
    type: 'damage',
    damageDice: '2d6',
    bonusAtk: 2
  },

  // === COMBO 2: PHÁ GIÁP & KẾT LIỄU (SUNDER + EXECUTE) ===
  sunder: {
    id: 'sunder',
    name: 'Đập Vỡ',
    icon: '🛡️⚡',
    desc: 'Đòn bổ sấm sét đập nát phòng ngự đối phương, gây 1d10 + 2 sát thương và áp dụng Phá Giáp (Vulnerable 2 hiệp, nhận thêm +50% dmg). Tiền đề cho Trảm Quyết!',
    classReq: 'warrior',
    mpCost: 4,
    spCost: 3,
    type: 'damage',
    damageDice: '1d10',
    bonusAtk: 2,
    applyEffect: { id: 'vulnerable', duration: 2, value: 50, target: 'enemy' }
  },
  execute: {
    id: 'execute',
    name: 'Trảm Quyết',
    icon: '🪓⚡',
    desc: 'Trảm đòn chí tử quét sạch tàn dư, gây 2d10 + 4 sát thương vật lý cực nặng. COMBO: Nếu mục tiêu đang bị Phá Giáp (Vulnerable), sát thương nhân x1.5!',
    classReq: 'warrior',
    mpCost: 6,
    spCost: 4,
    type: 'damage',
    damageDice: '2d10',
    bonusAtk: 3
  },

  // === COMBO 3: TÍCH GIÁP & PHÁ KÍCH (BULWARK + SHIELD BASH) ===
  bulwark: {
    id: 'bulwark',
    name: 'Thành Lũy',
    icon: '🏰🛡️',
    desc: 'Thiết lập trận thế phòng ngự bất khả xâm phạm: Nhận ngay +25 Giáp Ảo (Block) và buff Gai Góc (Thorns 8 phản sát thương trong 3 hiệp). Tiền đề hoàn hảo cho Khiên Phá Kích!',
    classReq: 'warrior',
    mpCost: 4,
    spCost: 3,
    type: 'buff',
    blockBonus: 25,
    applyEffect: { id: 'thorns', duration: 3, value: 8, target: 'self' }
  },
  shield_bash: {
    id: 'shield_bash',
    name: 'Khiên Phá Kích',
    icon: '🛡️💥',
    desc: 'Lấy thủ làm công! Tung cú đập khiên long trời lở đất, chuyển hóa 100% lượng Giáp Ảo (Block) hiện tại thành sát thương vật lý lên mục tiêu (Không tiêu hao Giáp Ảo).',
    classReq: 'warrior',
    mpCost: 0,
    spCost: 2,
    type: 'block_scaling',
    scaleWithBlock: true,
    bonusAtk: 2
  },

  // === KỸ NĂNG CƯỜNG HÓA & ĐA DỤNG ===
  warcry: {
    id: 'warcry',
    name: 'Hét Xung Trận',
    icon: '📢',
    desc: 'Tiếng gầm uy dũng chấn hưng sĩ khí. Tự buff Cường Hóa (+5 sát thương mọi đòn đánh trong 3 hiệp).',
    classReq: 'warrior',
    mpCost: 3,
    spCost: 2,
    type: 'buff',
    applyEffect: { id: 'strength', duration: 3, value: 5, target: 'self' }
  },
  whirlwind: {
    id: 'whirlwind',
    name: 'Cơn Lốc Kiếm',
    icon: '🌪️⚔️',
    desc: 'Vung vũ khí xoay vòng như cơn lốc sắt thép, gây 3d6 + 3 sát thương chuẩn phá vỡ phòng ngự của kẻ địch.',
    classReq: 'warrior',
    mpCost: 5,
    spCost: 3,
    type: 'pierce',
    damageDice: '3d6',
    flatDamage: 3
  },
  berserk: {
    id: 'berserk',
    name: 'Máu Điên',
    icon: '🩸🔥',
    desc: 'Kích hoạt cơn cuồng nộ: Tự hiến tế 10% HP hiện tại để nhận ngay 40 Nộ Khí và kích hoạt Tráng Kiện cực mạnh (Hồi 10 HP/hiệp trong 4 hiệp).',
    classReq: 'warrior',
    mpCost: 5,
    spCost: 0,
    type: 'buff',
    selfDamagePercent: 10,
    applyEffect: { id: 'regen', duration: 4, value: 10, target: 'self' }
  },

  // === CHAIN COMBO / AUTO-CAST: TRẢM ĐÔI & CHÉM BỒI ===
  double_cleave: {
    id: 'double_cleave',
    name: 'Trảm Đôi',
    icon: '⚔️💥',
    desc: 'Chém 1 nhát sấm sét gây 1d8 + 4 sát thương vật lý, và tự động bồi thêm 1 nhát [Chém Bồi] liên kích không tốn SP.',
    classReq: 'warrior',
    mpCost: 0,
    spCost: 3,
    cooldown: 2,
    type: 'damage',
    damageDice: '1d8',
    bonusAtk: 2,
    flatDamage: 4,
    autoCastSkill: 'follow_up_slash'
  },
  follow_up_slash: {
    id: 'follow_up_slash',
    name: 'Chém Bồi',
    icon: '🗡️⚡',
    desc: 'Đòn chém liên kích tự động bồi thêm không tiêu hao tài nguyên (5 sát thương chuẩn).',
    classReq: 'warrior',
    mpCost: 0,
    spCost: 0,
    type: 'pierce',
    damageDice: '1d6',
    flatDamage: 2,
    isHidden: true
  },

  // === NỘI TẠI ĐỘC QUYỀN ===
  passive_counter: {
    id: 'passive_counter',
    name: 'Bậc Thầy Cận Chiến',
    icon: '⚔️🛡️',
    desc: 'Nội tại Chiến Binh: Khi bị tấn công bởi đòn đánh thường, tự động gạt đòn chặn sát thương và lập tức phản công chớp nhoáng gây sát thương vật lý.',
    classReq: 'warrior',
    type: 'passive',
    isPassive: true,
    mpCost: 0,
    spCost: 0
  }
};
