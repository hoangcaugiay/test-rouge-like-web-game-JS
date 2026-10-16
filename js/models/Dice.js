/**
 * ============================================================================
 * DICE.JS - TIỆN ÍCH ĐỔ XÚC XẮC D&D VÀ HIỆU ỨNG 3D ASYNC/AWAIT
 * ============================================================================
 */

export class Dice {
  /**
   * Đổ xúc xắc N mặt ngẫu nhiên (1 -> sides)
   * @param {number} sides Số mặt của xúc xắc (VD: 20 cho d20, 6 cho d6)
   * @returns {number}
   */
  static roll(sides = 20) {
    return Math.floor(Math.random() * sides) + 1;
  }

  /**
   * Phân tích và đổ xúc xắc từ chuỗi công thức dạng "1d8", "2d6", "1d10"
   * @param {string} diceNotation Chuỗi công thức xúc xắc
   * @returns {{ total: number, rolls: number[], notation: string }}
   */
  static rollNotation(diceNotation = '1d6') {
    const parts = diceNotation.toLowerCase().split('d');
    const count = parseInt(parts[0], 10) || 1;
    const sides = parseInt(parts[1], 10) || 6;

    const rolls = [];
    let total = 0;

    for (let i = 0; i < count; i++) {
      const val = this.roll(sides);
      rolls.push(val);
      total += val;
    }

    return { total, rolls, notation: diceNotation };
  }
}

/**
 * Controller quản lý hiển thị và chuyển động xúc xắc 3D trên màn hình
 */
export class DiceRoller {
  /**
   * Hiển thị overlay 3D dice, xoay ngẫu nhiên và trả về kết quả d20
   * @param {string} title Tên hành động hiển thị (VD: "ĐỔ TẤN CÔNG")
   * @param {string} desc Mô tả hành động
   * @param {number} duration Thời gian xoay (ms, mặc định 900ms)
   * @returns {Promise<number>}
   */
  static async rollWith3DAnimation(title = 'ĐỔ XÚC XẮC D20', desc = 'Đang đổ...', duration = 900) {
    const overlay = document.getElementById('dice-overlay');
    const cube = document.getElementById('dice-cube');
    const titleEl = document.getElementById('dice-action-title');
    const descEl = document.getElementById('dice-action-desc');
    const valEl = document.getElementById('dice-final-val');

    // Roll trước kết quả ngầm
    const finalResult = Dice.roll(20);

    if (!overlay || !cube) {
      return finalResult;
    }

    // Hiển thị Overlay
    if (titleEl) titleEl.textContent = title;
    if (descEl) descEl.textContent = desc;
    if (valEl) valEl.textContent = '...';

    overlay.style.display = 'flex';
    cube.classList.add('rolling');

    // Chờ thời gian xoay
    await new Promise(resolve => setTimeout(resolve, duration));

    // Dừng xoay và gán kết quả lên mặt trước
    cube.classList.remove('rolling');
    const frontFace = cube.querySelector('.face-front');
    if (frontFace) frontFace.textContent = finalResult;

    // Đưa góc nhìn về mặt trước
    cube.style.transform = 'rotateX(0deg) rotateY(0deg) rotateZ(0deg)';

    if (valEl) valEl.textContent = finalResult;

    // Giữ kết quả hiển thị thêm 450ms cho người chơi nhìn rõ
    await new Promise(resolve => setTimeout(resolve, 450));

    // Ẩn overlay
    overlay.style.display = 'none';

    return finalResult;
  }
}
