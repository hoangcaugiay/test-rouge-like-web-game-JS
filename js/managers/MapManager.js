/**
 * ============================================================================
 * MAPMANAGER.JS - QUẢN LÝ BẢN ĐỒ PHÂN NHÁNH 3 ĐƯỜNG CÓ DÂY NỐI (SLAY THE SPIRE)
 * Tính năng:
 * 1. Bản đồ 3 hàng ngang (Row 1, 2, 3) với 8 đến 12 giai đoạn (cột).
 * 2. Cột 1: Duy nhất 1 node [Kho Báu Khởi Đầu] (starter_reward) ở giữa (Row 2).
 * 3. Các cột giữa: 2 đến 3 node/cột, tỉ lệ cân bằng (25% combat, 25% event, 15% elite, 15% rest, 10% shop, 10% treasure).
 * 4. Cột sát cuối: Duy nhất 1 node [Cửa Hàng] (shop) ở giữa (Row 2). Tất cả đường đi hội tụ về đây.
 * 5. Cột cuối cùng: Duy nhất 1 node [Trùm Cuối] (boss) ở giữa (Row 2).
 * 6. Quy tắc nối dây: Chỉ nối tới hàng lân cận |u.row - v.row| <= 1. Không có ngõ cụt.
 * 7. Vẽ dây nối SVG trực quan (Dây chưa đi mờ, dây hợp lệ sáng nhấp nháy, dây đã đi đổi màu).
 * 8. Giới hạn di chuyển: Chỉ được đi tới các Node có trong connectedNodes của Node vừa qua.
 * ============================================================================
 */

import { MapNode } from '../models/MapNode.js';
import { 
  ITEMS_DATABASE, 
  ENEMIES_DATABASE,
  NORMAL_DROP_TABLE,
  ELITE_DROP_TABLE,
  BOSS_DROP_TABLE,
  rollEnemyLoot, 
  rollEnemyGold, 
  getRandomShopItems, 
  rollRandomEquipment,
  RANDOM_EVENTS,
  CURSES_DATABASE 
} from '../data/database.js';
import { Item } from '../models/Item.js';
import { ShopManager } from './ShopManager.js';

export class MapManager {
  /**
   * @param {Function} onSelectNode Callback khi người chơi click vào 1 Node khả dụng
   * @param {Function} onTriggerCombat Callback khi sự kiện kích hoạt trận đánh
   */
  constructor(onSelectNode, onTriggerCombat = null) {
    this.onSelectNode = onSelectNode;
    this.onTriggerCombat = onTriggerCombat;
    this.columns = [];
    this.currentNode = null;
    this.totalStages = 10;
    this.pinnedNodeIds = []; // Danh sách các Node đang được người chơi Ghim (Route Planning)

    // Lắng nghe sự kiện co giãn màn hình để tự động vẽ lại dây nối SVG
    if (typeof window !== 'undefined') {
      window.addEventListener('resize', () => {
        this.drawMapLines();
      });
    }

    this.initMap();
  }

  /**
   * Khởi tạo bản đồ ngẫu nhiên mới
   */
  initMap() {
    this.generateRandomMap();
  }

  /**
   * Sinh cấu trúc bản đồ phân nhánh 3 hàng ngang hoàn toàn ngẫu nhiên
   */
  generateRandomMap() {
    this.columns = [];
    this.currentNode = null;

    // Chiều dài bản đồ cố định chính xác 10 cột (Stages) cho mỗi lần chơi
    const totalCols = 10;
    this.totalStages = totalCols;

    // =======================================================================
    // 1. CỘT 1 (START): DUY NHẤT 1 NODE STARTER_REWARD Ở GIỮA
    // =======================================================================
    const colStarter = [
      new MapNode({
        id: 'col-0-node-0',
        column: 0,
        row: 1, // Vị trí tâm giữa
        type: 'starter_reward',
        name: 'Kho Báu Khởi Đầu',
        icon: '🎁',
        desc: 'Chọn 1 trong 5 bảo vật làm hành trang tân thủ',
        enemyId: null,
        isAvailable: true // Mở sẵn cho người chơi kích hoạt
      })
    ];
    this.columns.push(colStarter);

    // =======================================================================
    // 2. CÁC CỘT Ở GIỮA (TỪ CỘT 1 ĐẾN totalCols - 3)
    // Sinh ngẫu nhiên từ 3 đến 5 Node mỗi cột để tạo nhiều nhánh rẽ phong phú
    // Tỉ lệ roll: 25% combat, 25% event, 15% elite, 15% rest, 10% shop, 10% treasure
    // =======================================================================
    const combatNames = ['Hẻm Núi Rêu Xanh', 'Động Đá Tăm Tối', 'Lối Mòn Đổ Nát', 'Hang Sói Hoang', 'Hầm Ngục Đầy Xương'];
    const eliteNames = ['Thánh Đường Bóng Đêm', 'Pháo Đài Đao Phủ', 'Huyết Ngục Tinh Anh', 'Bí Điện Thích Khách'];
    const eventNames = ['Bức Tượng Quỷ Dị', 'Suối Nguồn Cổ', 'Kẻ Khả Nghi', 'Khe Nứt Ma Thuật'];
    const restNames = ['Lửa Trại Cổ Xưa', 'Tàn Tích Bình Yên', 'Gốc Cổ Thụ Thần', 'Đài Tế Bình Lặng'];
    const shopNames = ['Xe Hàng Du Mục', 'Tiệm Rèn Bí Mật', 'Lều Thương Nhân', 'Chợ Đen Hầm Ngục'];
    const treasureNames = ['Rương Báu Lãng Quên', 'Mật Thất Hoàng Kim', 'Kho Báu Hiệp Sĩ Cổ'];

    for (let c = 1; c < totalCols - 2; c++) {
      const colNodes = [];
      // Sinh ngẫu nhiên từ 3 đến 5 Node cho mỗi chặng ở giữa
      const numNodes = Math.floor(Math.random() * 3) + 3; // 3, 4 hoặc 5

      let hasFightOrEvent = false;

      for (let r = 0; r < numNodes; r++) {
        const nodeId = `col-${c}-node-${r}`;
        const nodeType = this.rollNodeType(!hasFightOrEvent && r === numNodes - 1);

        if (nodeType === 'combat' || nodeType === 'elite' || nodeType === 'event') {
          hasFightOrEvent = true;
        }

        let nodeObj;
        if (nodeType === 'combat') {
          nodeObj = new MapNode({
            id: nodeId,
            column: c,
            row: r + 1,
            type: 'combat',
            name: combatNames[Math.floor(Math.random() * combatNames.length)],
            icon: '⚔️',
            desc: 'Goblin Tiên Phong rình rập',
            enemyId: 'goblin',
            isAvailable: false
          });
        } else if (nodeType === 'event') {
          nodeObj = new MapNode({
            id: nodeId,
            column: c,
            row: r + 1,
            type: 'event',
            name: eventNames[Math.floor(Math.random() * eventNames.length)],
            icon: '❓',
            desc: 'Sự kiện kỳ bí chưa rõ lành dữ',
            isAvailable: false
          });
        } else if (nodeType === 'elite') {
          const isOrc = Math.random() > 0.5;
          nodeObj = new MapNode({
            id: nodeId,
            column: c,
            row: r + 1,
            type: 'elite',
            name: eliteNames[Math.floor(Math.random() * eliteNames.length)],
            icon: '💀',
            desc: isOrc ? 'Đao Phủ Hắc Ám hung tợn' : 'Thích Khách Bóng Đêm ẩn hiện',
            enemyId: isOrc ? 'orc_warrior' : 'shadow_stalker',
            isAvailable: false
          });
        } else if (nodeType === 'rest') {
          nodeObj = new MapNode({
            id: nodeId,
            column: c,
            row: r + 1,
            type: 'rest',
            name: restNames[Math.floor(Math.random() * restNames.length)],
            icon: '🔥',
            desc: 'Hồi 50% HP/MP, 100% SP',
            isAvailable: false
          });
        } else if (nodeType === 'shop') {
          nodeObj = new MapNode({
            id: nodeId,
            column: c,
            row: r + 1,
            type: 'shop',
            name: shopNames[Math.floor(Math.random() * shopNames.length)],
            icon: '💰',
            desc: 'Mua sắm vũ khí & thần dược',
            isAvailable: false
          });
        } else {
          // treasure
          nodeObj = new MapNode({
            id: nodeId,
            column: c,
            row: r + 1,
            type: 'treasure',
            name: treasureNames[Math.floor(Math.random() * treasureNames.length)],
            icon: '💎',
            desc: 'Rương báu nhặt đồ miễn phí',
            isAvailable: false
          });
        }

        colNodes.push(nodeObj);
      }

      this.columns.push(colNodes);
    }

    // =======================================================================
    // 3. CỘT SÁT CUỐI (totalCols - 2): DUY NHẤT 1 NODE SHOP Ở TÂM GIỮA
    // Mọi đường đi từ Cột 8 đều hội tụ về trạm cửa hàng này
    // =======================================================================
    const colShop = [
      new MapNode({
        id: `col-${totalCols - 2}-node-0`,
        column: totalCols - 2,
        row: 1,
        type: 'shop',
        name: 'Trạm Tiếp Tế Cửa Hang',
        icon: '💰',
        desc: 'Cửa Hàng Thương Nhân: Mua sắm trước khi vào Sào Huyệt Boss',
        isAvailable: false
      })
    ];
    this.columns.push(colShop);

    // =======================================================================
    // 4. CỘT CUỐI CÙNG (totalCols - 1): DUY NHẤT 1 NODE BOSS Ở TÂM GIỮA
    // Cửa hàng kết nối thẳng tới Sào Huyệt Ma Vương
    // =======================================================================
    const colBoss = [
      new MapNode({
        id: `col-${totalCols - 1}-node-0`,
        column: totalCols - 1,
        row: 1,
        type: 'boss',
        name: 'Sào Huyệt Ma Vương',
        icon: '👿',
        desc: 'Trùm Cuối Demon Lord cổ đại',
        enemyId: 'demon_lord',
        isAvailable: false
      })
    ];
    this.columns.push(colBoss);

    // =======================================================================
    // 5. THIẾT LẬP DÂY NỐI (GRAPH CONNECTION) CHO 3 - 5 NODES/CỘT
    // =======================================================================
    this.buildGraphConnections();
  }

  /**
   * Xây dựng liên kết đường đi thưa thớt & ngẫu nhiên (Sparse Graph) cho 3 - 5 Nodes/cột
   * Tuân thủ quy tắc scale index an toàn:
   * 1. Xếp các Node trong cột theo thứ tự từ trên xuống dưới (Index từ 0 đến N-1).
   * 2. Quy tắc nối: Một Node ở vị trí uIdx của Cột C ánh xạ sang Cột C+1 tại vị trí mid = round(pos * (M-1)),
   *    và kết nối ngẫu nhiên tới {mid - 1, mid, mid + 1} (nếu có).
   * 3. Ngăn chặn giao cắt chữ X (No Cross-over): (u1 - u2) * (v1 - v2) >= 0.
   * 4. Vòng lặp 1: Đảm bảo mọi Node ở Cột C đều phóng ra ít nhất 1 đường tới Cột C+1.
   * 5. Vòng lặp 2: Quét toàn bộ Node ở Cột C+1, nếu có Node mồ côi (chưa có đường vào),
   *    tìm Node gần nhất ở Cột C (dựa theo index) và ép nó nối thêm 1 đường vào.
   */
  buildGraphConnections() {
    // Helper tính danh sách index ứng viên ở Cột C+1 cho node ở index uIdx của Cột C
    const getTargetCandidates = (uIdx, N, M) => {
      if (N === 1) return Array.from({ length: M }, (_, idx) => idx);
      if (M === 1) return [0];
      const pos = uIdx / (N - 1);
      const mid = Math.round(pos * (M - 1));
      const candidates = [];
      for (let d = -1; d <= 1; d++) {
        const target = mid + d;
        if (target >= 0 && target < M) {
          candidates.push(target);
        }
      }
      return candidates.length > 0 ? candidates : [mid];
    };

    for (let c = 0; c < this.columns.length - 1; c++) {
      const currentCol = [...this.columns[c]].sort((a, b) => a.row - b.row);
      const nextCol = [...this.columns[c + 1]].sort((a, b) => a.row - b.row);
      const N = currentCol.length;
      const M = nextCol.length;

      // Lưu trữ các cạnh { uIdx, vIdx } đã nối giữa 2 cột để kiểm tra giao cắt
      const edges = [];

      // Kiểm tra xem cạnh (uIdx -> vIdx) có gây chéo chữ X với các cạnh đã có không
      const causesCrossOver = (uIdx, vIdx) => {
        return edges.some(e => (uIdx - e.uIdx) * (vIdx - e.vIdx) < 0);
      };

      // VÒNG LẶP 1: Đảm bảo mọi Node ở Cột C đều phóng ra ít nhất 1 đường tới Cột C+1
      currentCol.forEach((uNode, uIdx) => {
        const candidateIndices = getTargetCandidates(uIdx, N, M);
        const cleanIndices = candidateIndices.filter(vIdx => !causesCrossOver(uIdx, vIdx));
        const pool = cleanIndices.length > 0 ? cleanIndices : candidateIndices;

        // Ưu tiên đi thẳng / hướng tâm tương ứng
        const idealMid = Math.round((uIdx / Math.max(1, N - 1)) * (M - 1));
        let chosenVIdx;
        if (pool.includes(idealMid) && Math.random() < 0.6) {
          chosenVIdx = idealMid;
        } else {
          chosenVIdx = pool[Math.floor(Math.random() * pool.length)];
        }

        const chosenTargetNode = nextCol[chosenVIdx];
        if (chosenTargetNode) {
          uNode.connectTo(chosenTargetNode);
          edges.push({ uIdx, vIdx: chosenVIdx });
        }
      });

      // VÒNG LẶP 2: Quét toàn bộ Node ở Cột C+1, nếu có Node mồ côi (chưa có ai nối tới),
      // tìm Node gần nhất ở Cột C (dựa theo index) và ép nối thêm 1 đường vào
      nextCol.forEach((vNode, vIdx) => {
        const hasIncoming = currentCol.some(u => u.connectedNodes.includes(vNode.id));
        if (!hasIncoming) {
          const idealUIdx = N === 1 ? 0 : Math.round((vIdx / (M - 1)) * (N - 1));
          // Sắp xếp các node Cột C theo khoảng cách index tới idealUIdx
          const sortedColA = currentCol.map((node, idx) => ({ node, idx }))
            .sort((a, b) => Math.abs(a.idx - idealUIdx) - Math.abs(b.idx - idealUIdx));

          const cleanCandidates = sortedColA.filter(item => !causesCrossOver(item.idx, vIdx));
          const bestCandidate = cleanCandidates.length > 0 ? cleanCandidates[0] : sortedColA[0];

          if (bestCandidate && bestCandidate.node) {
            bestCandidate.node.connectTo(vNode);
            edges.push({ uIdx: bestCandidate.idx, vIdx });
          }
        }
      });
    }

    console.log(`[MapManager] Sinh bản đồ 10 cột (${this.columns.map(c => c.length).join('-')} nodes) hoàn tất: zero ngõ cụt, rẽ nhánh & hội tụ mượt mà.`);
  }

  /**
   * Roll ngẫu nhiên loại Node theo trọng số mới (Tổng 100%):
   * 25% combat, 25% event, 15% elite, 15% rest, 10% shop, 10% treasure
   * @param {boolean} forceFight
   */
  rollNodeType(forceFight = false) {
    if (forceFight) {
      return Math.random() < 0.65 ? 'combat' : 'elite';
    }

    const rand = Math.random() * 100;
    if (rand < 25) return 'combat';    // 25% Quái thường
    if (rand < 50) return 'event';     // 25% Sự kiện ngẫu nhiên
    if (rand < 65) return 'elite';     // 15% Quái Tinh Anh
    if (rand < 80) return 'rest';      // 15% Lửa trại
    if (rand < 90) return 'shop';      // 10% Cửa hàng
    return 'treasure';                 // 10% Rương bí ẩn
  }

  /**
   * Tìm Node theo ID trong toàn bộ bản đồ
   * @param {string} id
   * @returns {MapNode|null}
   */
  getNodeById(id) {
    for (const col of this.columns) {
      const match = col.find(n => n.id === id);
      if (match) return match;
    }
    return null;
  }

  /**
   * Khôi phục cấu trúc bản đồ linh hoạt từ dữ liệu SaveManager
   * @param {{ columns: MapNode[][], currentNode: MapNode }} mapData 
   */
  restoreFromData(mapData) {
    if (!mapData || !mapData.columns || !Array.isArray(mapData.columns)) return;
    this.columns = mapData.columns;
    this.totalStages = this.columns.length;
    this.currentNode = mapData.currentNode || null;

    // Tái kết nối các tham chiếu nextNodes từ connectedNodes ID
    this.columns.forEach(col => {
      col.forEach(node => {
        node.nextNodes = [];
        (node.connectedNodes || []).forEach(targetId => {
          const targetObj = this.getNodeById(targetId);
          if (targetObj && !node.nextNodes.includes(targetObj)) {
            node.nextNodes.push(targetObj);
          }
        });
      });
    });

    this.renderMap();
  }

  /**
   * Đánh dấu hoàn thành Node hiện tại và CHỈ MỞ KHÓA các Node có trong connectedNodes
   * @param {MapNode} node Node vừa qua
   */
  completeNode(node) {
    node.complete();
    this.currentNode = node;

    // Nếu người chơi đã bước tới một Node trong danh sách Ghim, tự động gỡ bỏ node đó
    if (this.pinnedNodeIds && this.pinnedNodeIds.includes(node.id)) {
      this.pinnedNodeIds = this.pinnedNodeIds.filter(id => id !== node.id);
    }

    // Khóa tất cả các node cùng cột (không thể đi đường song song)
    const currentColumnNodes = this.columns[node.column];
    if (currentColumnNodes) {
      currentColumnNodes.forEach(n => {
        n.isAvailable = false;
      });
    }

    // CHỈ mở khóa các node có tên trong mảng connectedNodes của node hiện tại
    if (node.connectedNodes && node.connectedNodes.length > 0) {
      node.connectedNodes.forEach(targetId => {
        const targetNode = this.getNodeById(targetId);
        if (targetNode) {
          targetNode.isAvailable = true;
        }
      });
    }

    this.renderMap();
  }

  /**
   * Vẽ toàn bộ giao diện bản đồ 3 đường đi và gọi vẽ dây nối SVG
   */
  renderMap() {
    const mapGrid = document.getElementById('map-grid');
    const stageIndicator = document.getElementById('map-stage-indicator');
    const columnsWrapper = document.getElementById('map-columns-wrapper');
    const viewport = document.getElementById('map-viewport') || document.querySelector('.map-viewport-scrollable');
    const savedScrollLeft = viewport ? viewport.scrollLeft : 0;
    if (!mapGrid || !columnsWrapper) return;

    columnsWrapper.innerHTML = '';

    // Cập nhật huy hiệu tiến trình
    const currentStageNum = this.currentNode ? this.currentNode.column + 1 : 1;
    if (stageIndicator) {
      stageIndicator.textContent = `Giai đoạn: ${currentStageNum} / ${this.columns.length}`;
    }

    this.columns.forEach((column, colIdx) => {
      const colDiv = document.createElement('div');
      colDiv.className = 'map-column';

      // Tiêu đề cột
      const colTitle = document.createElement('div');
      colTitle.className = 'map-column-title';

      if (colIdx === 0) {
        colTitle.textContent = 'KHỞI HÀNH (CỘT 1)';
      } else if (colIdx === this.columns.length - 2) {
        colTitle.textContent = 'TRẠM CỬA HÀNG';
      } else if (colIdx === this.columns.length - 1) {
        colTitle.textContent = 'TRÙM CUỐI (BOSS)';
      } else {
        colTitle.textContent = `CHẶNG ${colIdx + 1}`;
      }
      colDiv.appendChild(colTitle);

      // Container chứa 3 Hàng (Rows/Lanes 1, 2, 3)
      const lanesContainer = document.createElement('div');
      lanesContainer.className = 'map-lanes-container';

      column.forEach(node => {
        const card = document.createElement('div');
        card.id = node.id;
        card.className = `map-node-card lane-row-${node.row} type-${node.type}`;

        if (node.isCompleted) {
          card.classList.add('completed');
        } else if (node.isAvailable) {
          card.classList.add('available');
        }

        if (node.isSpawnAnimation) {
          card.classList.add('secret-node-spawn');
          node.isSpawnAnimation = false;
        }

        card.innerHTML = `
          <span class="node-icon">${node.icon}</span>
          <div class="node-name">${node.name}</div>
          <div class="node-desc">${node.desc}</div>
        `;

        // Gắn sự kiện Hover Tooltip hiển thị tỷ lệ rớt đồ & vàng + Highlight nhánh đi
        this.attachNodeTooltipEvents(card, node);

        // Chuột phải (contextmenu): Ghim / Hủy ghim tuyến đường đi qua node này
        card.addEventListener('contextmenu', (e) => {
          e.preventDefault();
          this.togglePinNode(node);
        });

        // Chuột trái:
        // - Nếu là node khả dụng chưa qua: Đi vào node đó
        // - Nếu là node tương lai chưa mở khóa hoặc đã qua: Ghim / Hủy ghim tuyến đường
        card.addEventListener('click', () => {
          if (node.isAvailable && !node.isCompleted) {
            if (typeof this.onSelectNode === 'function') {
              this.onSelectNode(node);
            }
          } else {
            this.togglePinNode(node);
          }
        });

        lanesContainer.appendChild(card);
      });

      colDiv.appendChild(lanesContainer);
      columnsWrapper.appendChild(colDiv);
    });

    // Khôi phục ngay vị trí cuộn
    if (viewport && savedScrollLeft > 0) {
      viewport.scrollLeft = savedScrollLeft;
    }

    // Vẽ lại toàn bộ dây nối SVG sau khi DOM đã render
    setTimeout(() => {
      this.drawMapLines();
      if (viewport && savedScrollLeft > 0) {
        viewport.scrollLeft = savedScrollLeft;
      }
    }, 50);
  }

  /**
   * Vẽ các đường nối (SVG Lines) liên kết giữa các Node
   */
  drawMapLines() {
    const svg = document.getElementById('map-lines');
    const mapGrid = document.getElementById('map-grid');
    if (!svg || !mapGrid) return;

    // Cập nhật kích thước SVG phủ kín toàn bộ vùng cuộn ngang
    const totalWidth = mapGrid.scrollWidth;
    const totalHeight = mapGrid.scrollHeight;
    svg.setAttribute('width', totalWidth);
    svg.setAttribute('height', totalHeight);
    svg.setAttribute('viewBox', `0 0 ${totalWidth} ${totalHeight}`);
    svg.innerHTML = '';

    const gridRect = mapGrid.getBoundingClientRect();

    // Hàm lấy tâm tọa độ (x, y) của 1 Node tương ứng trong SVG
    const getNodeCenter = (nodeId) => {
      const el = document.getElementById(nodeId);
      if (!el) return null;
      const rect = el.getBoundingClientRect();
      return {
        x: (rect.left + rect.width / 2) - gridRect.left,
        y: (rect.top + rect.height / 2) - gridRect.top
      };
    };

    // Duyệt qua tất cả các Node và vẽ các đường nối tới connectedNodes
    this.columns.forEach(column => {
      column.forEach(node => {
        const fromPt = getNodeCenter(node.id);
        if (!fromPt) return;

        (node.connectedNodes || []).forEach(targetId => {
          const toPt = getNodeCenter(targetId);
          if (!toPt) return;

          const targetNode = this.getNodeById(targetId);

          // Xác định trạng thái của đường dây
          let lineClass = 'map-path-line';
          if (targetNode && (targetNode.type === 'secret' || node.type === 'secret')) {
            lineClass += ' line-secret'; // Dây nối bí mật màu tím phát quang
          } else if (node.isCompleted && targetNode && targetNode.isCompleted) {
            lineClass += ' line-traversed'; // Dây đã đi qua
          } else if (node.isCompleted && targetNode && targetNode.isAvailable) {
            lineClass += ' line-active';    // Dây hợp lệ có thể đi (sáng rực nhấp nháy)
          } else if (node.column === 0 && node.isAvailable && targetNode) {
            lineClass += ' line-unvisited';
          } else {
            lineClass += ' line-unvisited'; // Dây chưa tới
          }

          const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
          const lineId = `line-${node.id}-${targetId}`;
          line.id = lineId;
          line.setAttribute('id', lineId);
          line.setAttribute('x1', fromPt.x);
          line.setAttribute('y1', fromPt.y);
          line.setAttribute('x2', toPt.x);
          line.setAttribute('y2', toPt.y);
          line.setAttribute('class', lineClass);

          svg.appendChild(line);
        });
      });
    });

    // Nếu đang có các tuyến đường được Ghim, kích hoạt lại highlight sau khi render lại SVG
    if (this.pinnedNodeIds && this.pinnedNodeIds.length > 0) {
      this.applyPlannedHighlight();
    }
  }

  /**
   * Gắn sự kiện Hover hiển thị Tooltip thông tin Tỷ lệ Rớt đồ & Vàng + Highlight nhánh đi
   * Xử lý tối ưu với mousemove và giới hạn mép màn hình
   * @param {HTMLElement} card DOM Element của Node
   * @param {MapNode} node Dữ liệu Node
   */
  attachNodeTooltipEvents(card, node) {
    const tooltip = document.getElementById('node-tooltip');
    if (!tooltip) return;

    card.addEventListener('mouseenter', () => {
      // 1. Tooltip logic
      const html = this.getNodeTooltipHTML(node);
      if (html) {
        tooltip.innerHTML = html;
        tooltip.classList.remove('hidden');
      }

      // 2. Highlight xem trước nhánh đi tới tận Boss
      this.highlightHoverPath(node);
    });

    card.addEventListener('mousemove', (e) => {
      if (tooltip.classList.contains('hidden')) return;

      const offsetX = 16;
      const offsetY = 16;
      let left = e.pageX + offsetX;
      let top = e.pageY + offsetY;

      const tooltipWidth = tooltip.offsetWidth || 280;
      const tooltipHeight = tooltip.offsetHeight || 190;
      const windowWidth = window.innerWidth;
      const windowHeight = window.innerHeight;

      // Xử lý tràn mép ngang màn hình
      if (e.clientX + offsetX + tooltipWidth > windowWidth) {
        left = e.pageX - tooltipWidth - 10;
      }
      // Xử lý tràn mép dưới màn hình
      if (e.clientY + offsetY + tooltipHeight > windowHeight) {
        top = e.pageY - tooltipHeight - 10;
      }

      tooltip.style.left = `${left}px`;
      tooltip.style.top = `${top}px`;
    });

    card.addEventListener('mouseleave', () => {
      // 1. Ẩn Tooltip
      tooltip.classList.add('hidden');

      // 2. Xóa highlight hover
      this.clearHoverHighlight();
    });
  }

  /**
   * Thu thập tất cả Node và Line thuộc các nhánh đi về phía trước từ startNode tới cuối bản đồ (Boss)
   * Sử dụng BFS có Set chống lặp tuyệt đối, chạy < 0.05ms
   * @param {MapNode} startNode
   * @returns {{ nodeIds: Set<string>, lineIds: Set<string> }}
   */
  getForwardReachableElements(startNode) {
    const nodeIds = new Set();
    const lineIds = new Set();
    if (!startNode) return { nodeIds, lineIds };

    const queue = [startNode];
    nodeIds.add(startNode.id);

    while (queue.length > 0) {
      const curr = queue.shift();
      (curr.connectedNodes || []).forEach(targetId => {
        lineIds.add(`line-${curr.id}-${targetId}`);
        if (!nodeIds.has(targetId)) {
          nodeIds.add(targetId);
          const targetNode = this.getNodeById(targetId);
          if (targetNode) {
            queue.push(targetNode);
          }
        }
      });
    }

    return { nodeIds, lineIds };
  }

  /**
   * Làm sáng các đường đi từ Node đang hover tới tận Boss
   * @param {MapNode} node
   */
  highlightHoverPath(node) {
    this.clearHoverHighlight();
    const { nodeIds, lineIds } = this.getForwardReachableElements(node);

    nodeIds.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.classList.add('highlight-hover');
    });

    lineIds.forEach(id => {
      const line = document.getElementById(id);
      if (line) line.classList.add('highlight-hover');
    });
  }

  /**
   * Gỡ bỏ toàn bộ highlight hover trên màn hình
   */
  clearHoverHighlight() {
    document.querySelectorAll('.highlight-hover').forEach(el => {
      el.classList.remove('highlight-hover');
    });
  }

  /**
   * Ghim hoặc Hủy ghim một Node trên bản đồ (Route Planning)
   * Hỗ trợ ghim đa điểm (Waypoint Pinning): người chơi có thể click ghim thêm các node
   * trên các chặng khác nhau để nắn đường đi hội tụ thành một con đường độc đạo duy nhất.
   * @param {MapNode} node
   */
  togglePinNode(node) {
    if (!node) return;

    if (!Array.isArray(this.pinnedNodeIds)) {
      this.pinnedNodeIds = [];
    }

    if (this.pinnedNodeIds.includes(node.id)) {
      // Hủy ghim nếu click lại vào chính node đó
      this.pinnedNodeIds = this.pinnedNodeIds.filter(id => id !== node.id);
    } else {
      // Nếu đã có node được ghim ở cùng cột đó, thay thế node cũ bằng node mới
      const existingSameCol = this.pinnedNodeIds.find(id => {
        const n = this.getNodeById(id);
        return n && n.column === node.column;
      });

      if (existingSameCol) {
        this.pinnedNodeIds = this.pinnedNodeIds.filter(id => id !== existingSameCol);
      }

      // Thêm node mới vào danh sách
      this.pinnedNodeIds.push(node.id);

      // Sắp xếp các node đã ghim theo thứ tự cột từ trái sang phải
      this.pinnedNodeIds.sort((a, b) => {
        const na = this.getNodeById(a);
        const nb = this.getNodeById(b);
        return (na ? na.column : 0) - (nb ? nb.column : 0);
      });

      // Kiểm tra tính liên thông: nếu node mới không thể kết nối tới chuỗi ghim hiện tại,
      // tự động chuyển sang ghim độc lập node mới này
      const playerNode = this.currentNode || (this.columns[0] ? this.columns[0][0] : null);
      let isValidChain = true;
      let prev = playerNode;

      for (const pinId of this.pinnedNodeIds) {
        const pinNode = this.getNodeById(pinId);
        if (!pinNode) continue;
        if (prev && prev.column <= pinNode.column) {
          const paths = this.getPathsBetween(prev, pinNode);
          if (paths.nodeIds.size === 0) {
            isValidChain = false;
            break;
          }
        }
        prev = pinNode;
      }

      if (!isValidChain) {
        this.pinnedNodeIds = [node.id];
      }
    }

    this.applyPlannedHighlight();
  }

  /**
   * Tìm tất cả Node và Line nằm trên các con đường hợp lệ nối từ fromNode tới toNode
   * @param {MapNode} fromNode
   * @param {MapNode} toNode
   * @returns {{ nodeIds: Set<string>, lineIds: Set<string> }}
   */
  getPathsBetween(fromNode, toNode) {
    const nodeIds = new Set();
    const lineIds = new Set();
    if (!fromNode || !toNode) return { nodeIds, lineIds };
    if (fromNode.id === toNode.id) {
      nodeIds.add(fromNode.id);
      return { nodeIds, lineIds };
    }

    // Memoized DFS kiểm tra node nào có thể dẫn tới toNode
    const canReach = new Map();
    const checkReach = (currId) => {
      if (currId === toNode.id) return true;
      if (canReach.has(currId)) return canReach.get(currId);

      const curr = this.getNodeById(currId);
      if (!curr || !curr.connectedNodes || curr.connectedNodes.length === 0) {
        canReach.set(currId, false);
        return false;
      }

      let reach = false;
      for (const nextId of curr.connectedNodes) {
        if (checkReach(nextId)) reach = true;
      }
      canReach.set(currId, reach);
      return reach;
    };

    if (!checkReach(fromNode.id)) {
      return { nodeIds, lineIds };
    }

    // BFS thu thập tất cả các node và line hợp lệ
    const queue = [fromNode.id];
    const visited = new Set([fromNode.id]);
    nodeIds.add(fromNode.id);

    while (queue.length > 0) {
      const currId = queue.shift();
      if (currId === toNode.id) continue;
      const curr = this.getNodeById(currId);
      if (!curr) continue;

      (curr.connectedNodes || []).forEach(nextId => {
        if (canReach.get(nextId) || nextId === toNode.id) {
          lineIds.add(`line-${curr.id}-${nextId}`);
          nodeIds.add(nextId);
          if (!visited.has(nextId)) {
            visited.add(nextId);
            queue.push(nextId);
          }
        }
      });
    }

    return { nodeIds, lineIds };
  }

  /**
   * Highlight toàn bộ tuyến đường xuyên qua các Node được Ghim:
   * Từ vị trí Player -> qua từng Pinned Node -> tới tận Boss cuối
   * Nếu người chơi ghim nhiều Node, đường highlight sẽ hội tụ chính xác qua tất cả các điểm đó!
   */
  applyPlannedHighlight() {
    this.clearPlannedHighlight();
    if (!this.pinnedNodeIds || this.pinnedNodeIds.length === 0) return;

    // Gắn thẻ DOM <div class="pinned-badge">ĐÃ GHIM</div> và class is-pinned cho từng node được ghim
    this.pinnedNodeIds.forEach(pinId => {
      const pinNode = this.getNodeById(pinId);
      if (!pinNode) return;
      const el = document.getElementById(pinNode.id);
      if (el) {
        el.classList.add('is-pinned');
        const badge = document.createElement('div');
        badge.className = 'pinned-badge';
        badge.textContent = 'ĐÃ GHIM';
        el.appendChild(badge);
      }
    });

    // Lấy vị trí Player hiện tại và Boss cuối
    const playerNode = this.currentNode || (this.columns[0] ? this.columns[0][0] : null);
    const bossCol = this.columns[this.columns.length - 1];
    const bossNode = bossCol ? bossCol[0] : null;

    // Lọc danh sách pinned nodes hợp lệ (ở sau hoặc cùng cột với player)
    const validPinnedNodes = this.pinnedNodeIds
      .map(id => this.getNodeById(id))
      .filter(n => n && (!playerNode || n.column >= playerNode.column))
      .sort((a, b) => a.column - b.column);

    // Chuỗi Waypoints: [playerNode, ...validPinnedNodes, bossNode]
    const waypoints = [];
    if (playerNode) waypoints.push(playerNode);
    validPinnedNodes.forEach(n => {
      if (!waypoints.some(w => w.id === n.id)) {
        waypoints.push(n);
      }
    });
    if (bossNode && !waypoints.some(w => w.id === bossNode.id)) {
      waypoints.push(bossNode);
    }

    const plannedNodeIds = new Set();
    const plannedLineIds = new Set();

    // Duyệt qua từng đoạn giữa 2 Waypoints liên tiếp (W_i -> W_{i+1})
    for (let i = 0; i < waypoints.length - 1; i++) {
      const fromW = waypoints[i];
      const toW = waypoints[i + 1];

      const segment = this.getPathsBetween(fromW, toW);
      segment.nodeIds.forEach(id => plannedNodeIds.add(id));
      segment.lineIds.forEach(id => plannedLineIds.add(id));
    }

    // Áp dụng class highlight-planned cho toàn bộ các phần tử thuộc tuyến
    plannedNodeIds.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.classList.add('highlight-planned');
    });

    plannedLineIds.forEach(id => {
      const line = document.getElementById(id);
      if (line) line.classList.add('highlight-planned');
    });
  }

  /**
   * Xóa toàn bộ highlight của tuyến đường được ghim và gỡ các thẻ .pinned-badge khỏi DOM
   */
  clearPlannedHighlight() {
    document.querySelectorAll('.pinned-badge').forEach(b => b.remove());
    document.querySelectorAll('.highlight-planned').forEach(el => {
      el.classList.remove('highlight-planned');
    });
    document.querySelectorAll('.is-pinned').forEach(el => {
      el.classList.remove('is-pinned');
    });
  }

  /**
   * Tạo mã HTML chi tiết cho Tooltip theo loại Node (Combat, Elite, Boss, Shop, Rest...)
   * @param {MapNode} node
   * @returns {string|null}
   */
  getNodeTooltipHTML(node) {
    if (node.type === 'combat') {
      const enemy = ENEMIES_DATABASE[node.enemyId || 'goblin'] || ENEMIES_DATABASE.goblin;
      const minG = enemy.goldDrop ? enemy.goldDrop[0] : 10;
      const maxG = enemy.goldDrop ? enemy.goldDrop[1] : 20;
      return `
        <div class="tooltip-header combat">⚔️ ${node.name} (Quái Thường)</div>
        <div class="tooltip-gold">💰 Vàng có thể nhận: <b>${minG} - ${maxG} Vàng</b></div>
        <div class="tooltip-drop-title">🎁 Tỷ lệ rớt đồ: <b>80%</b> (20% Không rớt)</div>
        <div class="tooltip-pool-list">
          <div class="tooltip-pool-item rarity-common">
            <span class="pool-name">🧪 Dược Phẩm (Máu / Mana / SP)</span>
            <span class="pool-rate">~50%</span>
          </div>
          <div class="tooltip-pool-item rarity-common">
            <span class="pool-name">⚔️ Trang Bị Cấp Thường (Common)</span>
            <span class="pool-rate">~25%</span>
          </div>
          <div class="tooltip-pool-item rarity-rare">
            <span class="pool-name">🔷 Trang Bị Cấp Hiếm (Rare)</span>
            <span class="pool-rate">~21%</span>
          </div>
          <div class="tooltip-pool-item rarity-rare">
            <span class="pool-name">✨ Tiên Dược Cổ Đại (Elixir)</span>
            <span class="pool-rate">~4%</span>
          </div>
        </div>
      `;
    }

    if (node.type === 'elite') {
      const enemy = ENEMIES_DATABASE[node.enemyId || 'shadow_stalker'] || ENEMIES_DATABASE.shadow_stalker;
      const minG = enemy.goldDrop ? enemy.goldDrop[0] : 50;
      const maxG = enemy.goldDrop ? enemy.goldDrop[1] : 80;
      return `
        <div class="tooltip-header elite">💀 ${node.name} (Tinh Anh)</div>
        <div class="tooltip-gold">💰 Vàng có thể nhận: <b>${minG} - ${maxG} Vàng</b></div>
        <div class="tooltip-drop-title">🎁 Tỷ lệ rớt đồ: <b style="color: #22c55e;">100% Chắc Chắn</b></div>
        <div class="tooltip-pool-list">
          <div class="tooltip-pool-item rarity-epic">
            <span class="pool-name">🥊 Cổ Vật Sử Thi (Găng Tay / Huyết Nhẫn)</span>
            <span class="pool-rate">50%</span>
          </div>
          <div class="tooltip-pool-item rarity-epic">
            <span class="pool-name">🗡️ Trang Bị Sử Thi (Đoản Đao / Giáp Titan)</span>
            <span class="pool-rate">50%</span>
          </div>
        </div>
        <div class="tooltip-desc" style="color: #c084fc; font-weight: 600;">⭐ Chắc chắn nhận 1 Bảo Vật Sử Thi Độc Quyền!</div>
      `;
    }

    if (node.type === 'boss') {
      const enemy = ENEMIES_DATABASE.demon_lord;
      const minG = enemy.goldDrop ? enemy.goldDrop[0] : 150;
      const maxG = enemy.goldDrop ? enemy.goldDrop[1] : 200;
      return `
        <div class="tooltip-header boss">👿 ${node.name} (Trùm Cuối)</div>
        <div class="tooltip-gold">💰 Vàng cực khủng: <b>${minG} - ${maxG} Vàng</b></div>
        <div class="tooltip-drop-title">🔥 Tỷ lệ rớt đồ: <b style="color: #ff3366;">100% Huyền Thoại</b></div>
        <div class="tooltip-pool-list">
          <div class="tooltip-pool-item rarity-legendary">
            <span class="pool-name">👑 Cổ Vật Vua Điên / Trái Tim Pha Lê</span>
            <span class="pool-rate">60%</span>
          </div>
          <div class="tooltip-pool-item rarity-legendary">
            <span class="pool-name">🔮 Hạt Nhân Hư Không (+4 Atk, +3 AC)</span>
            <span class="pool-rate">20%</span>
          </div>
          <div class="tooltip-pool-item rarity-legendary">
            <span class="pool-name">⚔️ Thần Kiếm Trảm Ma (3d8 Dmg)</span>
            <span class="pool-rate">20%</span>
          </div>
        </div>
        <div class="tooltip-desc" style="color: #ff3366; font-weight: 700;">💥 Sức mạnh thay đổi hoàn toàn cục diện!</div>
      `;
    }

    if (node.type === 'shop') {
      return `
        <div class="tooltip-header" style="color: #facc15;">💰 ${node.name} (Cửa Hàng)</div>
        <div class="tooltip-desc">Tiệm buôn du mục hầm ngục. Bán các vũ khí cao cấp, khiên thần và thần dược hồi sinh.</div>
      `;
    }

    if (node.type === 'rest') {
      return `
        <div class="tooltip-header" style="color: #f97316;">🔥 ${node.name} (Lửa Trại)</div>
        <div class="tooltip-desc">Nơi nghỉ ngơi an toàn. Hồi phục <b>50% HP</b>, <b>50% MP</b> và <b>100% SP</b> (Thể Lực).</div>
      `;
    }

    if (node.type === 'event') {
      return `
        <div class="tooltip-header" style="color: #38bdf8;">❓ ${node.name} (Sự Kiện Kỳ Bí)</div>
        <div class="tooltip-desc">Gặp gỡ những thực thể cổ xưa, đài tế máu hoặc thương nhân mờ ám. Lành ít dữ nhiều!</div>
      `;
    }

    if (node.type === 'treasure') {
      return `
        <div class="tooltip-header" style="color: #60a5fa;">💎 ${node.name} (Rương Báu)</div>
        <div class="tooltip-desc">Mở rương báu cổ đại. Nhận ngay 1 Trang Bị chiến đấu ngẫu nhiên hoàn toàn miễn phí.</div>
      `;
    }

    if (node.type === 'starter_reward') {
      return `
        <div class="tooltip-header" style="color: #34d399;">🎁 ${node.name}</div>
        <div class="tooltip-desc">Điểm khởi hành. Chọn 1 trong 5 trang bị / bình dược phẩm làm hành trang tân thủ.</div>
      `;
    }

    if (node.type === 'secret') {
      return `
        <div class="tooltip-header secret">🌀 ${node.name} (Mật Đạo Cổ)</div>
        <div class="tooltip-gold">💰 Vàng thưởng: <b>+200 Vàng Khổng Lồ</b></div>
        <div class="tooltip-drop-title">👑 Phần thưởng độc quyền: <b style="color: #ffd166;">1 Cổ Vật Huyền Thoại (Legendary Relic)</b></div>
        <div class="tooltip-pool-list">
          <div class="tooltip-pool-item rarity-legendary">
            <span class="pool-name">👑 Cổ Vật Huyền Thoại Ngẫu Nhiên</span>
            <span class="pool-rate" style="color: #00ff88; font-weight: bold;">100% CHẮC CHẮN</span>
          </div>
        </div>
        <div class="tooltip-desc" style="color: #c084fc; font-weight: 600;">✨ Khám phá kho tàng bí mật không cần giao tranh!</div>
      `;
    }

    return null;
  }

  /**
   * Mở Modal Chọn 1 trong 5 Vật Phẩm Khởi Đầu (Starter Reward)
   * @param {InventoryManager} inventoryManager 
   * @returns {Promise<Item>}
   */
  openStarterRewardModal(inventoryManager) {
    return new Promise((resolve) => {
      const modal = document.getElementById('starter-reward-modal');
      const grid = document.getElementById('starter-cards-grid');
      if (!modal || !grid) return;

      grid.innerHTML = '';

      // Lấy 5 item ngẫu nhiên (chỉ lấy đồ thông thường, không lấy đồ độc quyền Shop/Elite/Boss)
      const allItemKeys = Object.keys(ITEMS_DATABASE).filter(
        k => !ITEMS_DATABASE[k].isShopExclusive && !ITEMS_DATABASE[k].isEliteExclusive && !ITEMS_DATABASE[k].isBossExclusive
      );
      const shuffled = [...allItemKeys].sort(() => 0.5 - Math.random());
      const selectedKeys = shuffled.slice(0, 5);

      selectedKeys.forEach(key => {
        const itemData = ITEMS_DATABASE[key];
        const cardEl = document.createElement('div');
        cardEl.className = 'starter-card';

        let statText = '';
        let badgeText = 'Trang bị';

        if (itemData.type === 'weapon') {
          statText = `Sát thương: ${itemData.damageDice} (+${itemData.attackMod} Atk)`;
          badgeText = 'Vũ khí';
        } else if (itemData.type === 'armor') {
          statText = `Giáp: ${itemData.armorClass} AC`;
          badgeText = 'Giáp thân';
        } else if (itemData.type === 'shield') {
          statText = `Đỡ: ${itemData.blockDice} dmg (+${itemData.bonusAC} AC)`;
          badgeText = 'Khiên';
        } else {
          statText = `Hiệu ứng: ${itemData.desc}`;
          badgeText = 'Bình thuốc';
        }

        cardEl.innerHTML = `
          <div class="starter-card-icon">${itemData.icon}</div>
          <div class="starter-card-title">${itemData.name}</div>
          <div class="starter-card-badge">${badgeText}</div>
          <div class="starter-card-desc">${itemData.desc}</div>
          <div class="starter-card-stat">${statText}</div>
          <button class="btn-select-starter">CHỌN VẬT PHẨM</button>
        `;

        cardEl.addEventListener('click', () => {
          modal.style.display = 'none';
          const item = new Item(itemData);
          inventoryManager.addItem(item);
          resolve(item);
        });

        grid.appendChild(cardEl);
      });

      modal.style.display = 'flex';
    });
  }

  /**
   * Mở Rương Báu Bí Ẩn (Treasure Chest Node)
   * @param {InventoryManager} inventoryManager 
   * @returns {Promise<Item>}
   */
  openTreasureChestModal(inventoryManager) {
    return new Promise((resolve) => {
      const modal = document.getElementById('treasure-modal');
      const display = document.getElementById('treasure-item-display');
      const claimBtn = document.getElementById('btn-treasure-claim');
      if (!modal || !display || !claimBtn) return;

      const droppedData = rollEnemyLoot(false) || ITEMS_DATABASE.health_potion;
      const item = new Item(droppedData);

      display.innerHTML = `
        <span class="treasure-item-icon">${item.icon}</span>
        <div>
          <div class="treasure-item-name">${item.name}</div>
          <div class="treasure-item-desc">${item.desc}</div>
        </div>
      `;

      const onClaim = () => {
        claimBtn.removeEventListener('click', onClaim);
        modal.style.display = 'none';
        inventoryManager.addItem(item);
        resolve(item);
      };

      claimBtn.addEventListener('click', onClaim);
      modal.style.display = 'flex';
    });
  }

  /**
   * Mở Modal Mật Đạo Cổ (Secret Node Reward)
   * Nhận ngay 1 Cổ Vật Huyền Thoại (Legendary Relic) và 200 Vàng mà không cần giao tranh
   * @param {Player} player 
   * @param {InventoryManager} inventoryManager 
   * @returns {Promise<{ item: Item, gold: number }>}
   */
  openSecretNodeModal(player, inventoryManager) {
    return new Promise((resolve) => {
      const modal = document.getElementById('secret-modal');
      const display = document.getElementById('secret-item-display');
      const claimBtn = document.getElementById('btn-secret-claim');
      if (!modal || !display || !claimBtn) return;

      // Chọn ngẫu nhiên 1 trong các Cổ vật huyền thoại độc quyền
      const legendaryPool = [
        ITEMS_DATABASE.mad_king_crown,
        ITEMS_DATABASE.crystal_heart,
        ITEMS_DATABASE.void_annihilator
      ];
      const relicData = legendaryPool[Math.floor(Math.random() * legendaryPool.length)];
      const relicItem = new Item(relicData);

      display.innerHTML = `
        <span class="treasure-item-icon">${relicItem.icon}</span>
        <div>
          <div class="treasure-item-name" style="color: #ffd166; font-weight: 800;">👑 ${relicItem.name} [HUYỀN THOẠI]</div>
          <div class="treasure-item-desc">${relicItem.desc}</div>
        </div>
      `;

      const onClaim = () => {
        claimBtn.removeEventListener('click', onClaim);
        modal.style.display = 'none';

        // Trao phần thưởng cực khủng: 200 vàng + 1 Legendary Relic
        player.addGold(200);
        inventoryManager.addItem(relicItem);

        resolve({ item: relicItem, gold: 200 });
      };

      claimBtn.addEventListener('click', onClaim);
      modal.style.display = 'flex';
    });
  }

  /**
   * Mở Cửa Hàng Thương Nhân (Merchant Shop Modal)
   * @param {Player} player 
   * @param {InventoryManager} inventoryManager 
   * @returns {Promise<void>}
   */
  openShopModal(player, inventoryManager) {
    return ShopManager.openShop(player, inventoryManager);
  }

  /**
   * Mở Modal Sự Kiện Ngẫu Nhiên (Random Event Modal)
   * @param {Player} player 
   * @param {InventoryManager} inventoryManager 
   * @param {Function} onFight Callback khi lựa chọn kích hoạt trận chiến
   * @param {MapNode} eventNode Đối tượng Node Event hiện tại
   * @returns {Promise<void>}
   */
  openEventModal(player, inventoryManager, onFight = null, eventNode = null) {
    return new Promise((resolve) => {
      const modal = document.getElementById('event-modal');
      const iconEl = document.getElementById('event-icon');
      const titleEl = document.getElementById('event-title');
      const descEl = document.getElementById('event-desc');
      const outcomeBox = document.getElementById('event-outcome-box');
      const choicesContainer = document.getElementById('event-choices-container');

      if (!modal || !choicesContainer) return;

      // Chọn ngẫu nhiên 1 sự kiện từ RANDOM_EVENTS
      const eventData = RANDOM_EVENTS[Math.floor(Math.random() * RANDOM_EVENTS.length)];

      if (iconEl) iconEl.textContent = eventData.icon;
      if (titleEl) titleEl.textContent = eventData.title;
      if (descEl) descEl.textContent = eventData.desc;

      if (outcomeBox) {
        outcomeBox.style.display = 'none';
        outcomeBox.className = 'event-outcome-box';
      }

      choicesContainer.innerHTML = '';

      eventData.choices.forEach(choice => {
        const btn = document.createElement('button');
        btn.className = 'event-choice-btn';

        // Kiểm tra điều kiện (ví dụ: vàng)
        if (choice.goldCost && player.gold < choice.goldCost) {
          btn.disabled = true;
        }

        btn.innerHTML = `
          <div class="event-choice-texts">
            <span class="event-choice-title">${choice.title}</span>
            <span class="event-choice-sub">${choice.subtitle}</span>
          </div>
          <span class="event-choice-badge ${choice.badgeType || 'neutral'}">${choice.badge}</span>
        `;

        btn.addEventListener('click', () => {
          let outcomeText = '';
          let isDanger = false;

          // Xử lý hiệu ứng lựa chọn
          if (choice.actionType === 'sacrifice_blood') {
            const dmg = Math.max(1, Math.round(player.maxHp * 0.3));
            player.takeDamage(dmg);
            const equip = rollRandomEquipment();
            inventoryManager.addItem(new Item(equip));
            outcomeText = `🩸 Bạn rạch tay hiến máu, mất ${dmg} HP! Bức tượng rung chuyển nhả ra [${equip.name}] vào túi bạn!`;
            isDanger = true;
          } else if (choice.actionType === 'drink_spring') {
            player.restoreMp(player.maxMp);
            player.restoreSp(player.maxSp);
            player.takeDamage(10);
            outcomeText = `💧 Nước suối thánh hồi 100% Mana & Thể Lực! Tuy nhiên độc tố dưới đáy làm bạn mất 10 HP.`;
            isDanger = true;
          } else if (choice.actionType === 'wash_wounds') {
            const healed = player.healHp(Math.round(player.maxHp * 0.3));
            const mpCost = Math.round(player.maxMp * 0.2);
            player.mp = Math.max(0, player.mp - mpCost);
            outcomeText = `✨ Nước suối gột sạch vết thương (+${healed} HP) với cái giá tiêu hao ${mpCost} MP để thanh tẩy.`;
          } else if (choice.actionType === 'buy_smuggler') {
            player.spendGold(50);
            const equip = rollRandomEquipment();
            inventoryManager.addItem(new Item(equip));
            outcomeText = `💰 Bạn trả 50 Vàng. Kẻ buôn lậu mỉm cười trao cho bạn món cổ vật [${equip.name}]!`;
          } else if (choice.actionType === 'fight_smuggler') {
            modal.style.display = 'none';
            if (typeof onFight === 'function') {
              onFight('shadow_stalker');
            }
            resolve();
            return;
          } else if (choice.actionType === 'open_cursed_coffer') {
            const goldAwarded = 100;
            player.addGold(goldAwarded);
            const rewardEquip = rollRandomEquipment();
            inventoryManager.addItem(new Item(rewardEquip));

            // Chọn ngẫu nhiên 1 lời nguyền từ CURSES_DATABASE
            const curseKeys = Object.keys(CURSES_DATABASE);
            const rolledCurseKey = curseKeys[Math.floor(Math.random() * curseKeys.length)];
            player.addCurse(rolledCurseKey);
            const curseData = CURSES_DATABASE[rolledCurseKey];

            outcomeText = `⚡ Nắp hòm bật mở! Bạn nhận được [${rewardEquip.name}] và +${goldAwarded} Vàng! Nhưng làn khói đen u ám ùa ra phong ấn linh hồn: DÍNH [${curseData.name}] (${curseData.desc})!`;
            isDanger = true;
          } else if (choice.actionType === 'reveal_secret_path') {
            const dmg = Math.max(1, Math.round(player.hp * 0.2)); // Mất 20% HP hiện tại
            player.takeDamage(dmg);
            isDanger = true;

            const colIdx = eventNode ? eventNode.column : (this.currentNode ? this.currentNode.column : 1);
            const nId = eventNode ? eventNode.id : (this.currentNode ? this.currentNode.id : null);
            const secretNode = this.revealSecretPath(colIdx, nId);

            outcomeText = `📜 Bạn rạch da nhỏ máu lên tấm bản đồ cổ (-${dmg} HP)! Những cổ tự tím bùng cháy, giải mã thành công [${secretNode ? secretNode.name : 'Mật Đạo Cổ'}] ở chặng tiếp theo!`;
          } else {
            // leave
            outcomeText = `🚶 Bạn cẩn trọng rời đi mà không gặp phải bất kỳ tai ương nào.`;
          }

          // Hiển thị kết quả và thay thế nút lựa chọn bằng nút [TIẾP TỤC]
          if (outcomeBox) {
            outcomeBox.textContent = outcomeText;
            outcomeBox.className = `event-outcome-box ${isDanger ? 'danger' : ''}`;
            outcomeBox.style.display = 'block';
          }

          choicesContainer.innerHTML = '';
          const continueBtn = document.createElement('button');
          continueBtn.className = 'btn-primary-large';
          continueBtn.style.marginTop = '12px';
          continueBtn.textContent = 'TIẾP TỤC HÀNH TRÌNH';
          continueBtn.addEventListener('click', () => {
            modal.style.display = 'none';
            resolve();
          });
          choicesContainer.appendChild(continueBtn);
        });

        choicesContainer.appendChild(btn);
      });

      modal.style.display = 'flex';
    });
  }

  /**
   * Khai mở Mật Đạo Bí Mật (Secret Path & Secret Node)
   * Inject 1 Node loại 'secret' vào cột tiếp theo (currentColIndex + 1),
   * nối dây từ node hiện tại tới node secret, và từ node secret tới cột tiếp theo.
   * Giữ nguyên vị trí thanh cuộn ngang (scrollLeft) và trạng thái Ghim đường (Route Planning).
   * @param {number} currentColIndex Vị trí cột của Node Event hiện tại
   * @param {string} currentNodeId ID của Node Event hiện tại
   * @returns {MapNode} Node Bí mật vừa tạo
   */
  revealSecretPath(currentColIndex, currentNodeId) {
    let targetCol = currentColIndex + 1;
    // Đảm bảo không vượt quá cột trước Boss
    if (targetCol >= this.columns.length - 1) {
      targetCol = this.columns.length - 2;
    }

    const colNodes = this.columns[targetCol];
    if (!colNodes) return null;

    // Tìm hàng còn trống trong số [1, 2, 3] (ưu tiên hàng 3, 1, 2)
    const usedRows = colNodes.map(n => n.row);
    const freeRows = [3, 1, 2].filter(r => !usedRows.includes(r));

    let secretNode;
    if (colNodes.length < 5) {
      const selectedRow = colNodes.length + 1;
      const secretNodeId = `col-${targetCol}-node-secret-${Date.now()}`;
      secretNode = new MapNode({
        id: secretNodeId,
        column: targetCol,
        row: selectedRow,
        type: 'secret',
        name: 'Mật Đạo Cổ Xưa',
        icon: '🌀',
        desc: 'Mật đạo ẩn giấu cất giữ Cổ Vật Huyền Thoại & 200 Vàng!',
        isAvailable: false
      });
      secretNode.isSpawnAnimation = true;
      colNodes.push(secretNode);
    } else {
      // Nếu cột đã đủ 5 node, biến đổi 1 node bình thường (không phải shop/boss)
      const targetNode = colNodes.find(n => n.type !== 'shop' && n.type !== 'boss') || colNodes[0];
      targetNode.type = 'secret';
      targetNode.name = 'Mật Đạo Cổ Xưa';
      targetNode.icon = '🌀';
      targetNode.desc = 'Mật đạo ẩn giấu cất giữ Cổ Vật Huyền Thoại & 200 Vàng!';
      targetNode.isSpawnAnimation = true;
      secretNode = targetNode;
    }

    // 1. Nối dây từ Node hiện tại tới Node Bí Mật
    const currentNode = this.getNodeById(currentNodeId) || this.currentNode;
    if (currentNode) {
      if (!currentNode.connectedNodes.includes(secretNode.id)) {
        currentNode.connectedNodes.push(secretNode.id);
      }
      if (!currentNode.nextNodes.includes(secretNode)) {
        currentNode.nextNodes.push(secretNode);
      }
      // Nếu Node hiện tại đã hoàn thành (người chơi đang đứng ở đây), mở khóa node bí mật luôn
      if (currentNode.isCompleted) {
        secretNode.isAvailable = true;
      }
    }

    // 2. Nối dây từ Node Bí Mật tới Cột tiếp theo (targetCol + 1) để không bị ngõ cụt
    const forwardColIdx = targetCol + 1;
    if (forwardColIdx < this.columns.length) {
      const forwardColNodes = this.columns[forwardColIdx];
      if (forwardColNodes && forwardColNodes.length > 0) {
        const secIdx = colNodes.indexOf(secretNode);
        const N = colNodes.length;
        const M = forwardColNodes.length;
        const pos = N > 1 ? (secIdx >= 0 ? secIdx : 0) / (N - 1) : 0.5;
        const mid = Math.round(pos * (M - 1));
        const validIndices = [mid - 1, mid, mid + 1].filter(i => i >= 0 && i < M);
        const chosenIdx = validIndices[Math.floor(Math.random() * validIndices.length)] ?? mid;
        const nextTarget = forwardColNodes[chosenIdx] || forwardColNodes[0];
        secretNode.connectTo(nextTarget);
      }
    }

    // 3. Render lại bản đồ và giữ nguyên vị trí scroll ngang (scrollLeft)
    const viewport = document.getElementById('map-viewport') || document.querySelector('.map-viewport-scrollable');
    const savedScrollLeft = viewport ? viewport.scrollLeft : 0;

    this.renderMap();

    if (viewport) {
      viewport.scrollLeft = savedScrollLeft;
      setTimeout(() => {
        viewport.scrollLeft = savedScrollLeft;
      }, 60);
    }

    return secretNode;
  }
}
