/**
 * ============================================================================
 * CLASSES / INDEX.JS - TRUNG TÂM XUẤT DỮ LIỆU CÁC LỚP NHÂN VẬT
 * ============================================================================
 */

import { warriorClass, warriorSkills } from './warrior.js';
import { mageClass, mageSkills } from './mage.js';
import { thiefClass, rogueClass, thiefSkills, rogueSkills } from './thief.js';

export {
  warriorClass,
  warriorSkills,
  mageClass,
  mageSkills,
  thiefClass,
  rogueClass,
  thiefSkills,
  rogueSkills
};

export const CLASSES_DATABASE = {
  warrior: warriorClass,
  mage: mageClass,
  thief: thiefClass
};

// Bí danh (Alias) rogue để tương thích ngược với code cũ, nhưng không tạo thêm thẻ trùng lặp khi Object.values()
Object.defineProperty(CLASSES_DATABASE, 'rogue', {
  value: thiefClass,
  enumerable: false,
  writable: true,
  configurable: true
});

export const ALL_CLASS_SKILLS = {
  ...warriorSkills,
  ...mageSkills,
  ...thiefSkills
};
