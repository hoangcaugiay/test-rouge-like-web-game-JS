/**
 * ============================================================================
 * SHOPMANAGER.JS - QUẢN LÝ CỬA HÀNG THƯƠNG NHÂN (MUA & BÁN ĐỒ)
 * Tính năng:
 * 1. Mua vật phẩm (Buy Tab): 4 món ngẫu nhiên, độc quyền Shop, kiểm tra vàng.
 * 2. So sánh trang bị 2 cột (Tooltip Comparison):
 *    - Trỏ chuột vào đồ trong Shop -> Hiện 2 cột: Cột trái (Đồ Shop) & Cột phải (Đang mặc).
 * 3. Bán vật phẩm (Sell Tab):
 *    - Hiển thị danh sách đồ trong ba lô (không bao gồm đồ đang mặc trên người).
 *    - Giá bán = 50% giá gốc (Math.floor(price * 0.5)), tối thiểu 1 Vàng.
 *    - Tooltip hiển thị "Giá bán: X Vàng".
 *    - Hộp thoại Xác Nhận Bán trước khi trừ đồ và cộng Vàng.
 *    - Tự động cập nhật số dư, Top HUD và trạng thái nút mua ngay lập tức.
 * ============================================================================
 */

import { getRandomShopItems } from '../data/database.js';
import { Item } from '../models/Item.js';

export class ShopManager {
  /**
   * Mở giao diện Cửa Hàng Thương Nhân (Merchant Shop Modal)
   * @param {Player} player 
   * @param {InventoryManager} inventoryManager 
   * @returns {Promise<void>}
   */
  static openShop(player, inventoryManager) {
    return new Promise((resolve) => {
      const modal = document.getElementById('shop-modal');
      const leaveBtn = document.getElementById('btn-leave-shop');
      const tabBuy = document.getElementById('shop-tab-buy');
      const tabSell = document.getElementById('shop-tab-sell');
      const viewBuy = document.getElementById('shop-view-buy');
      const viewSell = document.getElementById('shop-view-sell');
      const goldDisplay = document.getElementById('shop-current-gold');

      if (!modal || !leaveBtn) {
        resolve();
        return;
      }

      // Hàm cập nhật số vàng đồng bộ trên toàn bộ UI
      const updateGoldUI = () => {
        if (goldDisplay) goldDisplay.textContent = player.gold;
        const hudGold = document.getElementById('hud-player-gold');
        if (hudGold) hudGold.textContent = player.gold;
        const invGold = document.getElementById('inv-player-gold');
        if (invGold) invGold.textContent = player.gold;
      };

      updateGoldUI();

      // Sinh danh sách 4 món đồ bày bán của Shop (Smart Shop: chỉ bán trang bị đúng Class của Player hoặc 'all')
      const playerClassId = player ? (player.classId || 'warrior') : 'warrior';
      const shopItems = getRandomShopItems(4, playerClassId);

      // Render Tab Mua
      ShopManager.renderBuyTab(player, inventoryManager, shopItems, updateGoldUI);

      // Render Tab Bán
      ShopManager.renderSellTab(player, inventoryManager, updateGoldUI);

      // Chuyển Tab (Mặc định mở Tab Mua)
      const switchTab = (tabName) => {
        if (tabName === 'buy') {
          if (tabBuy) tabBuy.classList.add('active');
          if (tabSell) tabSell.classList.remove('active');
          if (viewBuy) viewBuy.style.display = 'flex';
          if (viewSell) viewSell.style.display = 'none';
        } else {
          if (tabSell) tabSell.classList.add('active');
          if (tabBuy) tabBuy.classList.remove('active');
          if (viewSell) viewSell.style.display = 'flex';
          if (viewBuy) viewBuy.style.display = 'none';
          ShopManager.renderSellTab(player, inventoryManager, updateGoldUI);
        }
      };

      if (tabBuy) tabBuy.onclick = () => switchTab('buy');
      if (tabSell) tabSell.onclick = () => switchTab('sell');
      switchTab('buy');

      // Sự kiện Rời Khỏi Cửa Hàng
      const onLeave = () => {
        leaveBtn.removeEventListener('click', onLeave);
        modal.style.display = 'none';

        // Ẩn tooltip nếu đang hiển thị
        const tooltip = document.getElementById('item-tooltip');
        if (tooltip) tooltip.classList.add('hidden');

        resolve();
      };

      leaveBtn.addEventListener('click', onLeave);
      modal.style.display = 'flex';
    });
  }

  /**
   * Kết xuất danh sách vật phẩm bày bán (Tab Mua) và gắn Tooltip so sánh 2 cột
   */
  static renderBuyTab(player, inventoryManager, shopItems, updateGoldUI) {
    const grid = document.getElementById('shop-items-grid');
    if (!grid) return;

    grid.innerHTML = '';

    shopItems.forEach(itemData => {
      const itemInstance = new Item(itemData);
      const card = document.createElement('div');
      card.className = `shop-item-card ${itemData.isShopExclusive ? 'is-exclusive' : ''}`;

      let statText = '';
      let typeBadge = 'Vật phẩm';
      if (itemData.type === 'weapon') {
        statText = `${itemData.damageDice || '1d6'} (+${itemData.attackMod || 0} Atk)`;
        typeBadge = 'Vũ Khí';
      } else if (itemData.type === 'armor') {
        statText = `+${itemData.armorClass || 0} AC`;
        typeBadge = 'Giáp Thân';
      } else if (itemData.type === 'shield') {
        statText = `${itemData.blockDice || '1d6'} dmg (+${itemData.bonusAC || 0} AC)`;
        typeBadge = 'Khiên Đỡ';
      } else {
        statText = 'Hồi Phục Tức Thì';
        typeBadge = 'Dược Phẩm';
      }

      const exclusiveTag = itemData.isShopExclusive
        ? '<div class="shop-exclusive-tag">✨ Độc Quyền Shop</div>'
        : '';

      card.innerHTML = `
        ${exclusiveTag}
        <div class="shop-item-icon">${window.formatItemIconHTML ? window.formatItemIconHTML(itemData.icon) : (itemData.icon || '📦')}</div>
        <div class="shop-item-title">${itemData.name}</div>
        <div class="shop-item-type">${typeBadge}</div>
        <div class="shop-item-desc">${itemData.desc || ''}</div>
        <div class="shop-item-stat">${statText}</div>
        <div class="shop-item-footer">
          <div class="shop-item-price">💰 ${itemData.price} Vàng</div>
          <button class="btn-shop-buy" id="btn-buy-${itemData.id}">
            MUA VẬT PHẨM
          </button>
        </div>
      `;

      // GẮN TOOLTIP SO SÁNH 2 CỘT CHO ĐỒ SHOP
      if (inventoryManager && typeof inventoryManager.attachItemTooltip === 'function') {
        inventoryManager.attachItemTooltip(card, () => itemInstance, 'shop_buy');
      }

      const buyBtn = card.querySelector(`#btn-buy-${itemData.id}`);

      const refreshBuyButton = () => {
        if (!buyBtn.classList.contains('sold-out')) {
          if (player.hasGold(itemData.price)) {
            buyBtn.disabled = false;
            buyBtn.textContent = 'MUA VẬT PHẨM';
          } else {
            buyBtn.disabled = true;
            buyBtn.textContent = 'THIẾU VÀNG';
          }
        }
      };

      refreshBuyButton();

      buyBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (!player.spendGold(itemData.price)) return;

        inventoryManager.addItem(new Item(itemData));
        updateGoldUI();

        buyBtn.disabled = true;
        buyBtn.classList.add('sold-out');
        buyBtn.textContent = '✓ ĐÃ BÁN HẾT';

        // Cập nhật lại số lượng đồ có thể bán trong ba lô
        const countBadge = document.getElementById('shop-sell-backpack-count');
        if (countBadge && inventoryManager.backpack) {
          countBadge.textContent = inventoryManager.backpack.length;
        }

        // Cập nhật lại trạng thái các nút mua khác
        ShopManager.refreshAllBuyButtons(player, grid);
      });

      grid.appendChild(card);
    });
  }

  /**
   * Cập nhật trạng thái cho toàn bộ các nút mua trong Tab Mua
   */
  static refreshAllBuyButtons(player, grid) {
    if (!grid) grid = document.getElementById('shop-items-grid');
    if (!grid) return;

    const allButtons = grid.querySelectorAll('.btn-shop-buy');
    allButtons.forEach(btn => {
      if (!btn.classList.contains('sold-out')) {
        const priceEl = btn.parentElement.querySelector('.shop-item-price');
        if (priceEl) {
          const cost = parseInt(priceEl.textContent.replace(/\D/g, ''), 10) || 0;
          btn.disabled = !player.hasGold(cost);
          btn.textContent = player.hasGold(cost) ? 'MUA VẬT PHẨM' : 'THIẾU VÀNG';
        }
      }
    });
  }

  /**
   * Kết xuất danh sách đồ trong ba lô có thể bán (Tab Bán)
   */
  static renderSellTab(player, inventoryManager, updateGoldUI) {
    const sellGrid = document.getElementById('shop-sell-grid');
    const emptyState = document.getElementById('shop-sell-empty');
    const countBadge = document.getElementById('shop-sell-backpack-count');

    if (!sellGrid || !emptyState) return;

    const backpack = (inventoryManager && inventoryManager.backpack) ? inventoryManager.backpack : [];
    if (countBadge) countBadge.textContent = backpack.length;

    // Kiểm tra túi đồ rỗng
    if (backpack.length === 0) {
      sellGrid.style.display = 'none';
      sellGrid.innerHTML = '';
      emptyState.style.display = 'flex';
      return;
    }

    sellGrid.style.display = 'grid';
    emptyState.style.display = 'none';
    sellGrid.innerHTML = '';

    backpack.forEach((item, index) => {
      if (!item) return;

      // Tính giá bán bằng 50% giá trị gốc, tối thiểu 1 Vàng
      const sellPrice = Math.max(1, Math.floor((item.price || 10) * 0.5));

      const card = document.createElement('div');
      card.className = 'shop-item-card sell-card';

      let typeBadge = 'Vật Phẩm';
      let statText = item.desc || '';
      if (item.type === 'weapon') {
        typeBadge = 'Vũ Khí';
        statText = `${item.damageDice || '1d4'} (+${item.attackMod || 0} Atk)`;
      } else if (item.type === 'armor') {
        typeBadge = 'Giáp Thân';
        statText = `+${item.armorClass || 0} AC`;
      } else if (item.type === 'shield') {
        typeBadge = 'Khiên Đỡ';
        statText = `${item.blockDice || '1d6'} dmg (+${item.bonusAC || 0} AC)`;
      } else if (item.type === 'consumable') {
        typeBadge = 'Dược Phẩm';
      } else if (item.type === 'relic') {
        typeBadge = 'Cổ Vật';
      }

      card.innerHTML = `
        <div class="shop-item-icon">${window.formatItemIconHTML ? window.formatItemIconHTML(item.icon) : (item.icon || '🎒')}</div>
        <div class="shop-item-title">${item.name}</div>
        <div class="shop-item-type">${typeBadge}</div>
        <div class="shop-item-desc">${item.desc || ''}</div>
        <div class="shop-item-stat">${statText}</div>
        <div class="shop-item-footer">
          <div class="shop-item-sell-price">💰 Giá bán: ${sellPrice} Vàng</div>
          <button class="btn-shop-sell" data-index="${index}">
            💸 BÁN LẤY ${sellPrice} VÀNG
          </button>
        </div>
      `;

      // GẮN TOOLTIP BÁN ĐỒ (Hiển thị giá bán)
      if (inventoryManager && typeof inventoryManager.attachItemTooltip === 'function') {
        inventoryManager.attachItemTooltip(card, () => item, 'shop_sell');
      }

      // Xử lý sự kiện click mở xác nhận bán
      const triggerSell = (e) => {
        e.stopPropagation();
        ShopManager.promptSellItem(player, inventoryManager, item, index, sellPrice, updateGoldUI);
      };

      const btnSell = card.querySelector('.btn-shop-sell');
      if (btnSell) btnSell.onclick = triggerSell;
      card.onclick = triggerSell;

      sellGrid.appendChild(card);
    });
  }

  /**
   * Hiển thị bảng xác nhận bán vật phẩm
   */
  static promptSellItem(player, inventoryManager, item, index, sellPrice, updateGoldUI) {
    const confirmModal = document.getElementById('shop-sell-confirm-modal');
    if (!confirmModal) {
      // Dự phòng nếu không có modal DOM: dùng confirm chuẩn
      const ok = confirm(`Bạn có chắc chắn muốn bán [${item.name}] với giá ${sellPrice} Vàng?`);
      if (ok) {
        ShopManager.executeSellItem(player, inventoryManager, index, sellPrice, updateGoldUI);
      }
      return;
    }

    const nameEl = document.getElementById('sell-item-name');
    const priceEl = document.getElementById('sell-item-price');
    const btnConfirm = document.getElementById('btn-confirm-sell');
    const btnCancel = document.getElementById('btn-cancel-sell');

    if (nameEl) nameEl.textContent = `[${item.name}]`;
    if (priceEl) priceEl.textContent = `${sellPrice} Vàng`;

    confirmModal.style.display = 'flex';

    const cleanup = () => {
      confirmModal.style.display = 'none';
      if (btnConfirm) btnConfirm.onclick = null;
      if (btnCancel) btnCancel.onclick = null;
    };

    if (btnCancel) {
      btnCancel.onclick = () => cleanup();
    }

    if (btnConfirm) {
      btnConfirm.onclick = () => {
        cleanup();
        ShopManager.executeSellItem(player, inventoryManager, index, sellPrice, updateGoldUI);
      };
    }
  }

  /**
   * Thực hiện giao dịch bán đồ: Trừ vật phẩm khỏi ba lô, cộng Vàng và làm mới UI
   */
  static executeSellItem(player, inventoryManager, index, sellPrice, updateGoldUI) {
    if (!inventoryManager || !inventoryManager.backpack) return;
    if (index < 0 || index >= inventoryManager.backpack.length) return;

    // Trừ vật phẩm khỏi ba lô
    const soldItem = inventoryManager.backpack.splice(index, 1)[0];
    if (!soldItem) return;

    // Cộng Vàng cho người chơi
    player.addGold(sellPrice);

    // Cập nhật số dư vàng trên toàn bộ game
    if (typeof updateGoldUI === 'function') updateGoldUI();

    // Làm mới danh sách đồ bán
    ShopManager.renderSellTab(player, inventoryManager, updateGoldUI);

    // Làm mới trạng thái nút mua ở Tab Mua (nếu đủ tiền mua thêm đồ mới)
    ShopManager.refreshAllBuyButtons(player);
  }
}
