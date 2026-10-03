"use strict";

// ================== สถานะเกม ==================
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
let player = null, players = [], map = [], spawners = [];
let enemies = [], particles = [], playerProjectiles = [], enemyProjectiles = [], items = [], mines = [];
let deployables = [];
let arenas = [];
let camera = { x: 0, y: 0 };
let keys = {}, mouseX = 0, mouseY = 0;
let score = 0, currentFloor = 1, kills = 0;   // [3B-2] coins ย้ายเป็น pl.coins รายคน
let pendingLevelUps = 0;                      // [3B-1] level-up ที่รอเปิดการ์ด (อัพเกรดย้ายเข้า pl.levels แล้ว)
let levelPickers = null, levelUpTimer = 0;    // [3B-1] สถานะเลือกการ์ดรายคน + จับเวลา
let shopRandomBought = false, pendingMods = [];   // [3B-3fix] shopBuyCount ย้ายเป็น pl.shopBuys รายคน
let shopCards = [], shopPickers = null;   // [3B-2] การ์ดร้าน + เคอร์เซอร์รายผู้เล่น
let isPaused = false, isShopping = false, isGameOver = false, isWarping = false;
let isPauseMenu = false, isBuildMenu = false;
let warpTimer = 0, warpStars = [], portalItemSpawned = false;
let hudCardRects = [];   // [เฟส 1] พื้นที่ปุ่ม AUTO บนการ์ดผู้เล่น (ตรวจคลิก)
let lobby = null;        // [เฟส 3A] สถานะ lobby (จำนวนผู้เล่น + คลาส)
let uiNav = null;        // [เฟส 3A] นำทางเมนูด้วยปุ่มทิศทาง + ยืนยัน
let domNavElems = [];    // [มินิแพส-nav] ธาตุ DOM ที่กำลังโฟกัส (โหมด DOM ของ uiNav)
let camZoom = 1;         // [เฟส 3A] ซูมกล้อง (ใช้จริงในตอนที่ 2)
let loopRunning = false, lastFrameTime = 0, accumulator = 0;

let hitStopFrames = 0, shakeT = 0, shakeMag = 0;
let dmgNumbersOn = true, dmgNumActive = 0;
let swordVfxOn = true;
let sfxVolIdx = 0;
let killStreak = 0, streakTimer = 0;
let droneOverdrive = 0, floorClean = true;
let toasts = [];
let lastCritSfxFrame = -99;

let cores = 0, metaUnlocks = {}, achievements = {};
let stats = { kills: 0, bosses: 0, runs: 0, bestFloor: 1, bestScore: 0, deals: 0, evolutions: 0, crits: 0 };

function freshMods() {
    return { coinMult: 1, enemySpeedMult: 1, enemySlowPct: 0, bossHpMult: 1, noHearts: false,
             scoreMult: 1, dmgDealtMult: 1, dmgTakenMult: 1, enemyHpMult: 1, spawnCapMult: 1,
             magnetOff: false, bonusDmg: 0, maxHpDown: 0, treasureFloor: false, list: [],
             critUp: 0, critMultDown: 0, enemyCrit: 0 };
}
let runMods = freshMods();
let evolved = { sword: false, gun: false, shotgun: false, laser: false, drone: false };

// [เฟส 2A] ทีมผู้เล่น: player = players[0] เสมอ (alias) — สัญญา co-op ข้อ 5: ศัตรุเล็ง "ผู้เล่นที่มีชีวิตใกล้สุด"
function nearestPlayerTo(x, y) {
    let best = null, bd = Infinity;
    for (let i = 0; i < players.length; i++) {
        let p = players[i];
        if (!p || p.hp <= 0) continue;   // ผี (ตาย) ไม่ถูกเล็ง
        let d = Math.hypot(p.x - x, p.y - y);
        if (d < bd) { bd = d; best = p; }
    }
    return best;
}

