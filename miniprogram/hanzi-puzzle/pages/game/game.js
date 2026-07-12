// pages/game/game.js
const { RADICAL_DB, LEVELS, RADICAL_STYLE, TARGET_CORRECT } = require('../../utils/data');
const { shuffle, diffLabel, buildPool } = require('../../utils/game');
const app = getApp();

Page({
  // ── 状态 ──
  _level: null,       // 当前关卡配置
  _levelIdx: 0,       // 关卡索引
  _grid: [],          // 二维数组 grid[row][col] = { char, isCorrect, key, removed }
  _cols: 6,
  _cellSize: 80,      // rpx，运行时根据屏幕计算
  _foundCount: 0,
  _errorCount: 0,
  _timeLeft: 0,
  _totalTime: 0,
  _timerInterval: null,
  _gameOver: false,
  _correctRoots: [],  // 本关 pool 里实际出现的正确字根
  _hintsLeft: 2,
  _wrongLock: {},     // key => timer，锁定错误格

  data: {
    // 渲染数据
    radical: '',
    radName: '',
    radicalBg: '#3B82F6',
    bgGrad: 'linear-gradient(160deg,#EFF6FF 0%,#DBEAFE 100%)',
    levelId: '',
    diffText: '',
    target: 5,
    foundCount: 0,
    timerPct: 100,
    timerText: '02:00',
    timerColor: '#3B82F6',
    cols: 6,
    cellSize: 80,
    cells: [],         // 扁平化单元格数组，供 wx:for
    resultSlots: [],   // [{ hanzi: '', filled: false }, ...]
    hintsLeft: 2,
    showWin: false,
    showFail: false,
    winStars: '',
    winSub: '',
    failSub: '',
    failAnswers: '',
    hasNext: false,
  },

  // ══════════════════════════════════════════════════════
  // 生命周期
  // ══════════════════════════════════════════════════════
  onLoad(options) {
    const idx = parseInt(options.idx || '0', 10);
    this._levelIdx = idx;
    this._calcCellSize(idx);
  },

  onUnload() {
    this._stopTimer();
  },

  // 根据关卡列数和屏幕宽度计算格子尺寸（rpx）
  _calcCellSize(idx) {
    const lv = LEVELS[idx];
    if (!lv) return;
    // 750rpx 是微信设计基准宽度；留 24rpx 边距两侧
    const availRpx = 750 - 48;
    const cellRpx = Math.floor((availRpx - (lv.cols - 1) * 6) / lv.cols);
    this._cellSize = cellRpx;
    this.startLevel(idx);
  },

  // ══════════════════════════════════════════════════════
  // 关卡初始化
  // ══════════════════════════════════════════════════════
  startLevel(idx) {
    this._stopTimer();
    this._levelIdx = idx;

    const lv = LEVELS[idx];
    if (!lv) return;
    this._level = lv;
    this._cols = lv.cols;

    const target = Math.min(
      lv.targetCount ?? TARGET_CORRECT,
      Object.keys(RADICAL_DB[lv.radical]).length
    );

    this._foundCount = 0;
    this._errorCount = 0;
    this._gameOver = false;
    this._hintsLeft = 2;
    this._wrongLock = {};
    this._timeLeft = lv.time;
    this._totalTime = lv.time;

    const style = RADICAL_STYLE[lv.radical] || { bg: '#3B82F6', accent: '#93C5FD' };

    // 结果槽
    const resultSlots = Array.from({ length: target }, () => ({ hanzi: '', filled: false }));

    this.setData({
      radical: lv.radical,
      radName: lv.radName,
      radicalBg: style.bg,
      bgGrad: `linear-gradient(160deg,${style.bg}CC 0%,${style.bg}66 100%)`,
      levelId: lv.id,
      diffText: diffLabel(lv.cols),
      target,
      foundCount: 0,
      hintsLeft: 2,
      cols: lv.cols,
      cellSize: this._cellSize,
      resultSlots,
      showWin: false,
      showFail: false,
    });

    this._buildBoard(target);
    this._updateTimer();
    this._startTimer();
  },

  // ══════════════════════════════════════════════════════
  // 构建棋盘
  // ══════════════════════════════════════════════════════
  _buildBoard(target) {
    const lv = this._level;
    const pool = buildPool(lv.radical, lv.cols * lv.cols, target);

    this._correctRoots = pool.filter(r => r in RADICAL_DB[lv.radical]);

    // 构建二维 grid（逻辑层）
    this._grid = [];
    for (let r = 0; r < lv.cols; r++) {
      this._grid[r] = [];
      for (let c = 0; c < lv.cols; c++) {
        const char = pool[r * lv.cols + c];
        this._grid[r][c] = {
          char,
          isCorrect: char in RADICAL_DB[lv.radical],
          key: `${r}_${c}`,
          removed: false,
        };
      }
    }

    this._renderCells();
  },

  // 把 grid 二维数组压平为 cells 数组供 wx:for 渲染
  _renderCells() {
    const cells = [];
    const style = RADICAL_STYLE[this._level.radical] || { bg: '#3B82F6', accent: '#93C5FD' };
    for (let r = 0; r < this._cols; r++) {
      for (let c = 0; c < this._cols; c++) {
        const cell = this._grid[r] && this._grid[r][c];
        if (!cell || cell.removed) {
          cells.push({ key: `${r}_${c}`, char: '', cls: 'cell cell-empty', style: `width:${this._cellSize}rpx;height:${this._cellSize}rpx` });
        } else {
          const lock = this._wrongLock[cell.key];
          let cls = 'cell';
          if (lock === 'lock') cls += ' cell-wrong-lock';
          else if (lock === 'flash') cls += ' cell-wrong';
          const fontSize = this._cellSize > 70 ? 32 : this._cellSize > 50 ? 26 : 22;
          cells.push({
            key: cell.key,
            char: cell.char,
            cls,
            style: `width:${this._cellSize}rpx;height:${this._cellSize}rpx;font-size:${fontSize}rpx`,
          });
        }
      }
    }
    this.setData({ cells });
  },

  // ══════════════════════════════════════════════════════
  // 点击处理
  // ══════════════════════════════════════════════════════
  onCellTap(e) {
    if (this._gameOver) return;
    const key = e.currentTarget.dataset.key;
    if (!key) return;
    const [r, c] = key.split('_').map(Number);
    const cell = this._grid[r] && this._grid[r][c];
    if (!cell || cell.removed || this._wrongLock[key] === 'lock') return;

    if (cell.isCorrect) {
      this._doCorrect(r, c);
    } else {
      this._doWrong(r, c);
    }
  },

  _doCorrect(r, c) {
    wx.vibrateShort({ type: 'light' });
    const cell = this._grid[r][c];
    const hanzi = RADICAL_DB[this._level.radical][cell.char];

    // 填入结果槽
    const slots = [...this.data.resultSlots];
    slots[this._foundCount] = { hanzi, filled: true };
    this._foundCount++;

    // 从棋盘移除（标记 removed，位置变空）
    cell.removed = true;
    this._dropColumn(c);
    this._renderCells();

    this.setData({ resultSlots: slots, foundCount: this._foundCount });

    if (this._foundCount >= this.data.target) {
      setTimeout(() => this._triggerWin(), 300);
    }
  },

  _doWrong(r, c) {
    wx.vibrateShort({ type: 'medium' });
    this._errorCount++;
    const cell = this._grid[r][c];
    const key = cell.key;

    this._wrongLock[key] = 'flash';
    this._renderCells();

    setTimeout(() => {
      this._wrongLock[key] = 'lock';
      this._renderCells();
      setTimeout(() => {
        delete this._wrongLock[key];
        this._renderCells();
      }, 1000);
    }, 400);
  },

  // ── 消除后该列上方格子下落 ──
  _dropColumn(col) {
    const cols = this._cols;
    // 收集该列非 removed 的格子（从上到下）
    const surviving = [];
    for (let r = 0; r < cols; r++) {
      if (this._grid[r][col] && !this._grid[r][col].removed) {
        surviving.push(this._grid[r][col]);
      }
    }
    // 重新分配到底部对齐（上面补 null）
    for (let r = 0; r < cols; r++) {
      const offset = cols - surviving.length;
      if (r < offset) {
        this._grid[r][col] = null;
      } else {
        this._grid[r][col] = surviving[r - offset];
        surviving[r - offset].key = `${r}_${col}`;
      }
    }
  },

  // ══════════════════════════════════════════════════════
  // 提示功能
  // ══════════════════════════════════════════════════════
  useHint() {
    if (this._hintsLeft <= 0 || this._gameOver) return;

    // 找所有未消除的正确格子
    const candidates = [];
    for (let r = 0; r < this._cols; r++) {
      for (let c = 0; c < this._cols; c++) {
        const cell = this._grid[r] && this._grid[r][c];
        if (cell && !cell.removed && cell.isCorrect) {
          candidates.push(cell.key);
        }
      }
    }
    if (candidates.length === 0) return;

    const targetKey = candidates[Math.floor(Math.random() * candidates.length)];
    this._wrongLock[targetKey] = 'hint';
    this._renderCells();

    // 覆盖渲染：单独给 hint 格子加样式
    const cells = this.data.cells.map(cell => {
      if (cell.key === targetKey) {
        return { ...cell, cls: cell.cls + ' cell-hint' };
      }
      return cell;
    });
    this.setData({ cells });

    setTimeout(() => {
      delete this._wrongLock[targetKey];
      this._renderCells();
    }, 1500);

    this._hintsLeft--;
    this.setData({ hintsLeft: this._hintsLeft });
  },

  // ══════════════════════════════════════════════════════
  // 计时器
  // ══════════════════════════════════════════════════════
  _startTimer() {
    this._timerInterval = setInterval(() => {
      if (this._gameOver) { this._stopTimer(); return; }
      this._timeLeft--;
      this._updateTimer();
      if (this._timeLeft <= 0) {
        this._stopTimer();
        this._triggerFail();
      }
    }, 1000);
  },

  _stopTimer() {
    if (this._timerInterval) {
      clearInterval(this._timerInterval);
      this._timerInterval = null;
    }
  },

  _updateTimer() {
    const pct = Math.max(0, this._timeLeft / this._totalTime) * 100;
    const m = Math.floor(this._timeLeft / 60);
    const s = this._timeLeft % 60;
    const timerText = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;

    let timerColor = RADICAL_STYLE[this._level?.radical]?.bg || '#3B82F6';
    if (this._timeLeft <= 10) timerColor = '#EF4444';
    else if (this._timeLeft <= this._totalTime * 0.35) timerColor = '#F59E0B';

    this.setData({ timerPct: pct, timerText, timerColor });
  },

  // ══════════════════════════════════════════════════════
  // 通关 / 失败
  // ══════════════════════════════════════════════════════
  _calcStars() {
    if (this._errorCount === 0 && this._timeLeft / this._totalTime > 0.5) return 3;
    if (this._errorCount <= 2 && this._timeLeft > 0) return 2;
    return 1;
  },

  _triggerWin() {
    if (this._gameOver) return;
    this._gameOver = true;
    this._stopTimer();
    wx.vibrateShort({ type: 'heavy' });

    const stars = this._calcStars();
    app.saveStars(this._level.id, stars);

    this.setData({
      hintsLeft: this._hintsLeft,
      showWin: true,
      winStars: '★'.repeat(stars) + '☆'.repeat(3 - stars),
      winSub: `错误 ${this._errorCount} 次，剩余 ${this._timeLeft} 秒`,
      hasNext: this._levelIdx < LEVELS.length - 1,
    });
  },

  _triggerFail() {
    if (this._gameOver) return;
    this._gameOver = true;
    this._stopTimer();

    // 构建答案提示文本
    const foundHanzi = new Set(
      this.data.resultSlots.filter(s => s.filled).map(s => s.hanzi)
    );
    const lines = this._correctRoots.map(root => {
      const hanzi = RADICAL_DB[this._level.radical][root];
      const mark = foundHanzi.has(hanzi) ? '✅' : '❌';
      return `${mark} ${this._level.radical} + ${root} = ${hanzi}`;
    });

    this.setData({
      hintsLeft: this._hintsLeft,
      showFail: true,
      failSub: `已找到 ${this._foundCount} / ${this.data.target} 个`,
      failAnswers: lines.join('\n'),
    });
  },

  // ══════════════════════════════════════════════════════
  // 导航
  // ══════════════════════════════════════════════════════
  goMenu() {
    this._stopTimer();
    wx.navigateBack();
  },

  nextLevel() {
    const next = this._levelIdx + 1;
    if (next < LEVELS.length) {
      this._calcCellSize(next);
    }
  },

  retryLevel() {
    this._calcCellSize(this._levelIdx);
  },
});
