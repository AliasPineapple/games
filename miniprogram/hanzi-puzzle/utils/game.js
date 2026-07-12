// utils/game.js — 纯逻辑：buildPool、shuffle、diffLabel

const { RADICAL_DB, CHAR_DB, TARGET_CORRECT } = require('./data');

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function diffLabel(cols) {
  if (cols <= 5)  return `入门 ${cols}×${cols}`;
  if (cols <= 6)  return `初级 ${cols}×${cols}`;
  if (cols <= 8)  return `中级 ${cols}×${cols}`;
  if (cols <= 10) return `高级 ${cols}×${cols}`;
  return `挑战 ${cols}×${cols}`;
}

/**
 * 生成本关棋盘 pool（已洗牌的字根数组，长度 = totalCells）
 * @param {string} radical  本关偏旁
 * @param {number} totalCells  网格总格数 = COLS * ROWS
 * @param {number} targetCount  需要找到的正确字根数
 * @returns {string[]} 字根数组（含正确 + 干扰）
 */
function buildPool(radical, totalCells, targetCount) {
  const allCorrect = Object.keys(RADICAL_DB[radical]);

  // 随机抽取 targetCount 个正确字根
  const pickCount = Math.min(targetCount, allCorrect.length, totalCells - 1);
  const correct = shuffle([...allCorrect]).slice(0, pickCount);

  // 全局字根候选池（排除本关偏旁）
  const allRoots = new Set();
  for (const [rad, entries] of Object.entries(RADICAL_DB)) {
    if (rad === radical) continue;
    for (const root of Object.keys(entries)) allRoots.add(root);
  }

  // 过滤掉与本关偏旁能组字的字根，只留"安全干扰项"
  const safeWrong = [...allRoots].filter(root => {
    const mapping = CHAR_DB[root];
    return !mapping || !(radical in mapping);
  });

  // 补满格子
  const needed = totalCells - correct.length;
  const wrongs = shuffle(safeWrong).slice(0, needed);

  return shuffle([...correct, ...wrongs]);
}

module.exports = { shuffle, diffLabel, buildPool };
