"use strict";
/* =====================================================================
   CYBER SURVIVOR — ULTRA EDITION v6 (GRAND BALANCE PATCH)
   [รวมทุกการตกลง 4 รอบ]
   รอบ 1 — ดูดเลือด/ความอยู่รอด (แนว C):
     - Cooldown ขั้นต่ำ 2 -> 5 เฟรม (เพดาน 12 โจมตี/วิ)
     - VAMPIRE CHIP: ดูดต่อ "การโจมตี" (0.5/1/1.5/2 ต่อเลเวล) คลาสระยะไกลครึ่งเดียว
       + แคปการฟื้นฟูรวมทุกแหล่ง 5% MaxHP/วิ (รวมดูดเลือดติดตัวดาบ)
     - STAND ดาเมจ 10/20/30% | hurtTimer 45 -> 30 เฟรม
     - หัวใจ scale 20+2/ชั้น | ร้าน x1.45 -> x1.38 | ดีลปีศาจจับคู่ tier
   รอบ 2 — สเกลดาเมจ/HP:
     - DAMAGE BOOST: +2 และ +2%/เลเวล | PLATED ARMOR: +20 และ +2/ชั้น
     - ดาเมจศัตรู x(1+0.12/ชั้น)
   รอบ 3 — ปลายเกม:
     - HP บอส: 1.32^min(ชั้น-1,12) x 1.15^(เกินชั้น 13) — ต้นเกมเหมือนเดิม
     - เพดานดาเมจศัตรู x3.5 | บอสใหญ่เข้าเฟส 2 ดรอป 💗 ฟื้น 30% MaxHP
     - Telegraph เฟส 2: 30 -> 40 เฟรม | DEVIL CORE มีเฟส 2 ด้วย
   รอบ 4 — ระบบกำแพง (ฝั่งศัตรูแก้เอง):
     - ดาบ/คลื่น/STAND ยังทะลุกำแพงทำดาเมจได้เหมือนเดิม
     - บอสชาร์จ "WALL BREAKER": ระเบิดกำแพงเป็นทางเดินหน้า + หินแตกตาย (ยกเว้นขอบแผนที่)
     - มอนถูกกั้น (ไม่มี LoS ถึงผู้เล่น) 5 วิ = แฮ็กวาร์ปเข้าใกล้ผู้เล่น 200-280px
       (CD 10 วิ/ตัว — กันแคมป์กำแพงแบบถาวร)
   แพตช์คริ: แดช = คริการันตีเฉพาะ "การโจมตีครั้งถัดไป" ครั้งเดียว (ผูกกับกระสุน/การฟัน
   แล้วเคลียร์ทันที — แก้อาการคริติดค้างทั้งหน้าต่าง 1 วิ)
   ===================================================================== */

// ================== ค่าคงที่หลัก ==================
// [v31] มุมมองยืดตามจอจริง — resizeGame() (15-render) ปรับตอน runtime:
//   จอกว้าง ≥ 16:9 → สูง 720 คง กว้างยืดฟรีตามจอ (จอ 16:9 เหมือนเดิมเป๊ะ)
//   จอแคบ < 16:9  → กว้างขั้นต่ำ VIEW_MIN_W (พอดีระยะยิงอัตโนมัติ+เผื่อขอบ) สูงยาวตามสัดส่วน แต่ไม่เกิน VIEW_MAX_H
let VIEW_WIDTH = 1280, VIEW_HEIGHT = 720;
const VIEW_MIN_W = 1000;   // AUTO_AIM_RANGE 390×2 + เผื่อขอบ ~220
const VIEW_MAX_H = 1100;   // cap มุมมองแนวตั้ง — "ระยะยิง + อีกนิดหน่อย"
const TILE_SIZE = 40, MAP_COLS = 50, MAP_ROWS = 40;
const WARP_DURATION = 110;
const AUTO_AIM_RANGE = 390;

const FIXED_DT = 1 / 60;
const DT = FIXED_DT;
let gameTime = 0, frameCount = 0;

const CLASS_ICONS = { SWORD: "🧔", GUN: "👮", SHOTGUN: "💂", LASER: "👽", DRONE: "🤖" };
const PC_COLORS = ["#00ffcc", "#ff923d", "#3dff8c", "#ff7bd9"];   // [เฟส 3A] สีประจำ P1-P4

const WEAPONS = {
    SWORD:   { name: "MANTIS BLADES", dmg: 8, delay: 50, bSize: 90, bSpd: 0,  maxHp: 140, speed: 1.3, desc: "ใบมีดประชิด + คลื่นสโลว์ | ดูดเลือด 1 HP ทุกการฟันที่โดน (คริ = 2) | ฟัน/คลื่นทะลุกำแพงได้", kbForce: 6,   kbDuration: 5 },
    GUN:     { name: "SMART RIFLE",   dmg: 3, delay: 20, bSize: 5,  bSpd: 11, maxHp: 90,  speed: 2.0, desc: "ไรเฟิลระยะไกล + มิสไซล์ติดตาม | คริ = กระสุนติดไฟทันที", kbForce: 1.5, kbDuration: 5 },
    SHOTGUN: { name: "SHOTGUN",       dmg: 3, delay: 70, bSize: 4,  bSpd: 8,  maxHp: 110, speed: 1.0, desc: "ลูกซองพายุระยะใกล้ + โยนไมน์หาศัตรู | คริ = เม็ดทะลุไปโดนตัวถัดไป", kbForce: 8,   kbDuration: 12 },
    LASER:   { name: "PHOTON LANCE",  dmg: 2, delay: 34, bSize: 6,  bSpd: 14, maxHp: 100, speed: 1.6, desc: "ลำแสงทะลุศัตรูหลายตัว (ปลดล็อกด้วย CORE 5)", kbForce: 1, kbDuration: 4 },
    DRONE:   { name: "DRONE OPS",     dmg: 2, delay: 16, bSize: 4,  bSpd: 10, maxHp: 100, speed: 1.8, desc: "ปืนพกควบคู่ฝูงโดรนยิงศัตรูให้คุณ (ปลดล็อกด้วย CORE 5)", kbForce: 1, kbDuration: 4 }
};

const CLASS_SKILLS = {
    SWORD:   { name: "VORTEX",    cd: 15, desc: "พายุดาบรอบตัว ดาเมจ 3 เท่า + กระเด็น (คริได้)" },
    GUN:     { name: "BARRAGE",   cd: 18, desc: "ระดมมิสไซล์ติดตาม 6 ลูก" },
    SHOTGUN: { name: "EMP",       cd: 20, desc: "สตันศัตรูรอบจอ 2 วิ (บอสไม่ติด)" },
    LASER:   { name: "NOVA",      cd: 15, desc: "ยิงลำแสงทะลุ 10 ทิศพร้อมกัน" },
    DRONE:   { name: "OVERDRIVE", cd: 20, desc: "โดรนโจมตีเร็ว 4 เท่า นาน 5 วิ" }
};

const ENEMY_TYPES = {
    BLOCK_OBSTACLE: { size: 40, hp: 40, speed: 0, icon: "🗿", isRanged: false, score: 0, damage: 0, kbResistance: 1.0 },
    NORMAL:  { size: 35, hp: 10, speed: 1.2, icon: "🦓", isRanged: false, score: 1, damage: 10, kbResistance: 0.0 },
    RANGED:  { size: 30, hp: 8, speed: 1, icon: "🐛", isRanged: true, shootCooldown: 200, bulletColor: "#ff00ff", score: 2, damage: 8, bulletDamage: 8, kbResistance: 0.1, burnResistance: 0.5 },
    SPEEDY:  { size: 25, hp: 5, speed: 2, icon: "🐝", isRanged: false, score: 2, damage: 2, kbResistance: -0.2, slowResistance: 0.3 },
    TANK:    { size: 50, hp: 20, speed: 1, icon: "🐌", isRanged: false, score: 3, damage: 15, kbResistance: 0.7, stunResistance: 0.7, burnResistance: 0.3 },
    HEALER:  { size: 24, hp: 12, speed: 1.1, icon: "🧪", isRanged: false, score: 3, damage: 6, kbResistance: 0.2 },
    SPLITTER:{ size: 40, hp: 16, speed: 1.0, icon: "🦠", isRanged: false, score: 3, damage: 10, kbResistance: 0.3 },
    SPLITTER_SMALL: { size: 25, hp: 6, speed: 1.45, icon: "🦠", isRanged: false, score: 1, damage: 5, kbResistance: 0.0 },
    SHIELDER:{ size: 30, hp: 14, speed: 0.9, icon: "🧿", isRanged: false, score: 3, damage: 8, kbResistance: 0.4 },
    MAGE:    { size: 32, hp: 14, speed: 0.9, icon: "🧙", isRanged: true, shootCooldown: 120, score: 4, damage: 6, bulletDamage: 10, kbResistance: 0.3, slowResistance: 0.4, burnResistance: 0.5 },   // [v17] CYBER ORACLE — เวท 3 ธาตุตามระยะ
    BOSS_MELEE: { size: 70, hp: 40, speed: 1.5, icon: "🐉", isBoss: true, score: 10, damage: 35, kbResistance: 1, slowResistance: 0.5 },
    BOSS_CYBERMAGE: { size: 46, hp: 20, speed: 1.2, icon: "🧙", isBoss: true, isRanged: true, shootCooldown: 100, bulletColor: "#00ffff", score: 15, damage: 20, bulletDamage: 25, kbResistance: 0.9, slowResistance: 0.5 },
    BOSS_OVERLORD: { size: 60, hp: 90, speed: 1.05, icon: "👾", isBoss: true, score: 50, damage: 40, bulletDamage: 14, kbResistance: 1, slowResistance: 0.5 },
    BOSS_DEVILCORE: { size: 90, hp: 110, speed: 1.3, icon: "👹", isBoss: true, score: 80, damage: 30, bulletDamage: 16, kbResistance: 1, slowResistance: 0.5 }
};
const BOSS_NAMES = { BOSS_MELEE: "CYBER DRAGON", BOSS_CYBERMAGE: "CYBERMAGE", BOSS_OVERLORD: "☠ OVERLORD ☠", BOSS_DEVILCORE: "☠ DEVIL CORE — YOUR MIRROR ☠" };

const BOSS_SHIELD_LINEAR = 8;

// [v33] ธีมทั้งหมดตามลำดับ — ลำดับนี้จับคู่กับ BAL.FLOOR.THEME_FLOORS ทีละตัว (ฟิลด์ min เลิกใช้ — เก็บไว้อ้างอิง)
const FLOOR_THEMES = [
    { bg: "#05060a", wallA: "#171a28", wallB: "#272a3d", grid: "rgba(39,42,61,0.22)",  name: "CYBER", accent: "#00ffcc" },
    { bg: "#0a0507", wallA: "#28141a", wallB: "#4d1f2b", grid: "rgba(77,31,43,0.25)",  name: "BLOOD", accent: "#ff5577" },
    { bg: "#07050d", wallA: "#1c1430", wallB: "#3a2a5c", grid: "rgba(58,42,92,0.25)",  name: "VENOM", accent: "#7df9ff" },
    { bg: "#0b0906", wallA: "#2b2415", wallB: "#57472a", grid: "rgba(87,71,42,0.25)",  name: "GOLD", accent: "#ffd700" }
];
// [v33] ธีมตาม BAL.FLOOR.THEME_FLOORS — คู่ "ชั้น ↔ ธีม" ตามลำดับอาร์เรย์ / เกินสุดท้าย = วนรอบใหม่ (THEME_LOOP)
function getTheme() {
    let fl = BAL.FLOOR.THEME_FLOORS;
    if (!fl || !fl.length) return FLOOR_THEMES[0];
    let f = currentFloor;
    if (BAL.FLOOR.THEME_LOOP) {
        let first = fl[0], span = fl[fl.length - 1] - first;   // ช่วง 1 รอบเต็ม เช่น [1..40] = 39
        if (span > 0 && f > fl[fl.length - 1]) f = first + ((f - first - 1) % span) + 1;   // 41→2? ไม่ — 41→2 เทียบตาราง: คืนค่าในช่วง [first, สุดท้าย]
    }
    let idx = 0;
    for (let i = 0; i < fl.length; i++) if (f >= fl[i]) idx = i;
    return FLOOR_THEMES[Math.min(idx, FLOOR_THEMES.length - 1)];
}

function eliteChance() {   // [แพตช์บาลานซ์] ถี่ขึ้นตามชั้น: 12% ต้นเกม → 25% ชั้น 30+
    return Math.min(0.25, 0.12 + 0.0045 * Math.max(0, currentFloor - 10));
}
const ELITE_AFFIXES = [
    { id: "ARMORED",   th: "หุ้มเกราะ",  color: "#9bb0c9", hpMult: 1.6 },
    { id: "SWIFT",     th: "รวดเร็ว",    color: "#3dff8c", spdMult: 1.4 },
    { id: "VOLATILE",  th: "ระเบิดตาย",  color: "#ff923d", explode: true },
    { id: "GILDED",    th: "ทอง",        color: "#ffd700", gold: 3 },
    { id: "COMMANDER", th: "ผู้บัญชา",   color: "#ff5577", aura: true }
];

const GENERAL_UPGRADES = [
    { id: "DMG", name: "💥 พลังโจมตี", desc: "พลังโจมตี +5 ต่อเลเวล (ไม่จำกัด)", maxLevel: Infinity },
    { id: "FIRERATE", name: "⚡ ความเร็วโจมตี", desc: "ความเร็วโจมตี +8% และลด CD สกิล 5% ต่อเลเวล (สูงสุด 8)", maxLevel: 8 },
    { id: "SPEED", name: "วิ่งไว", desc: "ความเร็ว +25% และลด CD แดช 10% ต่อเลเวล (สูงสุด 5)", maxLevel: 5 },
    { id: "MAX_HP", name: "เพิ่มเลือด", desc: "HP +20 และ +2 ต่อชั้น + regen 1% ทุก 10 วิ (ไม่จำกัด)", maxLevel: Infinity },
    { id: "CRIT", name: "🎯 คริติคอล", desc: "โอกาสคริ +5% และดาเมจคริ +0.25× ต่อเลเวล (เริ่ม 5% / สูงสุด 7)", maxLevel: 7 },
    { id: "VAMPIRE", name: "🩸 ดูดเลือด", desc: "ดูดเลือด 0.5-2 HP ต่อการโจมตี (ระยะไกลครึ่งเดียว) แคป 5%/วิ (สูงสุด 4)", maxLevel: 4 }
];

const CLASS_UPGRADES = {
    SWORD:   { id: "SPEC_SWORD", name: "⚔️ SWORD ARC LEVEL", desc: "คลื่นดาบกว้างขึ้น + สโลว์ + แช่แข็ง + ระเบิดความเย็น (เต็ม 3 = ZERO BLADE) — ปลดล็อก ATTACK STAND ตามเลเวล", maxLevel: 3 },
    GUN:     { id: "SPEC_GUN", name: "🚀 MISSILE SYSTEM", desc: "ทุก 6 นัด ยิงมิสไซล์ติดตาม ดาเมจ 1.5 เท่า (เต็ม 3 = OMEGA RIFLE) — ปลดล็อก INCENDIARY+TURRET ตามเลเวล", maxLevel: 3 },
            SHOTGUN: { id: "SPEC_SHOTGUN", name: "💥 MINE DROP", desc: "ทุก 5 นัด โยนไมน์หาศัตรู | cap ไมน์ 3/6/9 ตามเลเวล (เต็ม 3 + STUN เต็ม = THUNDER MAW) — ปลดล็อก STUN+SHARD ตามเลเวล", maxLevel: 3 },
    LASER:   { id: "CHARGED_LANCE", name: "🔌 CHARGED LANCE", desc: "ทุก 5 นัด ยิงลำแสงมหาศาล ดาเมจ 2/2.5/3 เท่า ตามเลเวล (อัพครบ = SINGULARITY LANCE) — ปลดล็อก FOCUS LENS + INCENDIARY ตามเลเวล", maxLevel: 3 },
        DRONE:   { id: "SWARM", name: "🛸 SWARM PROTOCOL", desc: "เพิ่มโดรน 1 ลำต่อเลเวล (เต็ม 3 + TITAN = HIVE MIND) — ปลดล็อก TITAN ตามเลเวล", maxLevel: 3 },
};

const EXTRA_CLASS_UPGRADES = {
    SWORD: [
        { id: "ATTACK_STAND", name: "👁️ ATTACK STAND", desc: "🔒 ต้องมี SWORD ARC ≥ เลเวลเดียวกัน — ร่างเงาลอยตามผู้เล่น โจมตีเหมือนผู้เล่นทุกอย่าง พลัง 10/20/30% ออร่าสโลว์ ถาวร", maxLevel: 3 }
    ],
    GUN: [
        { id: "INCENDIARY", name: "🔥 INCENDIARY ROUNDS", desc: "🔒 ต้องมี MISSILE SYSTEM ≥ เลเวลเดียวกัน — กระสุนติดไฟ ดาเมจต่อเนื่อง 25-50%/วินาที (บอสต้านครึ่ง / คริ = DoT ×1.5)", maxLevel: 3 },
        { id: "GUN_TURRET", name: "🗼 GUN TURRET", desc: "🔒 ต้องมี MISSILE SYSTEM ≥ เลเวลเดียวกัน — ป้อมปืนรอบตัว เลเวลละ 1 อัน ดาเมจ 20% อยู่ 30 วิ CD 5 วิ", maxLevel: 3 },
        { id: "RICOCHET", name: "🎱 RICOCHET", desc: "🔒 ต้องมี MISSILE SYSTEM ≥ เลเวลเดียวกัน — กระสุนชิ่งกำแพง 1/2/3 ครั้ง แล้วบินต่อ (GUN/DRONE/TURRET)", maxLevel: 3 }
    ],
    SHOTGUN: [
        { id: "STUN_SHELLS", name: "⚡ STUN SHELLS", desc: "🔒 ต้องมี MINE DROP ≥ เลเวลเดียวกัน — โดน 5/4/3 เม็ดพร้อมกัน = สตัน (CD 3 วิ บอสไม่ติด)", maxLevel: 3 },
        { id: "SHARD_MINE", name: "❄️ SHARD MINE", desc: "🔒 ต้องมี MINE DROP ≥ เลเวลเดียวกัน — วางไมน์น้ำแข็งเพิ่ม ดาเมจครึ่ง + แช่แข็ง 1 วิ (นับรวมใน cap ไมน์)", maxLevel: 1 }
    ],
    LASER: [
        { id: "FOCUS_LENS", name: "🔍 FOCUS LENS", desc: "🔒 ต้องมี CHARGED LANCE ≥ เลเวลเดียวกัน — ดาเมจลำแสง +40% ต่อเลเวล", maxLevel: 3 },
        { id: "INCENDIARY", name: "🔥 INCENDIARY BEAM", desc: "🔒 ต้องมี CHARGED LANCE ≥ เลเวลเดียวกัน — ลำแสงติดไฟ ดาเมจต่อเนื่อง 25-50%/วินาที (บอสต้านครึ่ง)", maxLevel: 3 }
    ],
    DRONE: [
        { id: "TITAN", name: "🔩 TITAN FRAME", desc: "🔒 ต้องมี SWARM ≥ เลเวลเดียวกัน — โดรน HP ×2 (ร่วมกับ SWARM เต็ม = HIVE MIND)", maxLevel: 1 },
        { id: "RICOCHET", name: "🎱 RICOCHET", desc: "🔒 ต้องมี SWARM ≥ เลเวลเดียวกัน — กระสุนชิ่งกำแพง 1/2/3 ครั้ง แล้วบินต่อ", maxLevel: 3 }
    ]
};

const SLOW_WAVE_LEVELS = {
    1: { pct: 0.25, dur: 0.30 }, 2: { pct: 0.30, dur: 0.35 }, 3: { pct: 0.35, dur: 0.40 },
    4: { pct: 0.40, dur: 0.45 }, 5: { pct: 0.45, dur: 0.50 }
};
const SLOW_WAVE = { arcDeg: 180, maxVfx: 8, maxUptime: 0.60 };

const SHATTER = {
    window: 2.0, hitsNeeded: 3, freezeDur: 1.0,
    dmgPct: 0.10, radius: TILE_SIZE * 2, slowPct: 0.25, slowDur: 2.0
};

const INCENDIARY_LEVELS = { 1: { dpsPct: 0.25, dur: 1.5 }, 2: { dpsPct: 0.35, dur: 2.0 }, 3: { dpsPct: 0.50, dur: 2.5 } };
const STUN_SHELLS_LEVELS = { 1: { pellets: 5, stunDur: 0.40 }, 2: { pellets: 4, stunDur: 0.50 }, 3: { pellets: 3, stunDur: 1.00 } };
const STUN_SHELLS = { cooldown: 3.0 };

const MINE_CFG = { dmgMult: 5, shardDmgMult: 2.5, radius: 120, triggerRange: 40, minSpacing: 48 };
const SHARD_MINE = { freezeDur: 1.0 };

const MONSTER_DROPS = { coinChance: BAL.ECO.COIN_CHANCE, heartChance: BAL.ECO.HEART_CHANCE, buffChance: BAL.ECO.BUFF_CHANCE, coinValue: BAL.ECO.COIN_VALUE };
function heartHealAmount() { return BAL.PLR.HEART_BASE + BAL.PLR.HEART_PER_FLOOR * (currentFloor - 1); }
const BUFF_DUR = 20;
const BUFF_DROPS = [
    { type: "BUFF_SHIELD", icon: "🛡️", color: "#66ccff" },
    { type: "BUFF_FIRE",   icon: "⏩", color: "#ffcc00" },
    { type: "BUFF_DMG",    icon: "💥", color: "#ff5577" },
    { type: "BUFF_SPD",    icon: "👟", color: "#3dff8c" }
];
// [v29] หมายเหตุ: ไอคอน ⏩ เดิมเป็น "BUFF_FIRE" ตามชื่อเก่า แต่ผลจริง = โจมตีเร็ว (ลด CD) — คงไอคอน/สีเดิมเพื่อไม่ให้ผู้เล่นเก่าสับสน

const BOSS_EXP_PCT = BAL.XP.BOSS_PCT;

const DEPLOY = {
    life: 30, hpPct: 0.5, dmgPct: 0.2, cd: 5, size: 26,
    turretRange: 380, bulletSpd: 9,
    auraRadius: TILE_SIZE * 3, auraSlow: 0.5, auraTick: 0.3,
    droneRange: 320, droneCd: 10,
    standDelay: 14
};

const FLOOR_MODS = [
    { id: "GREED",  short: "💰GREED",  name: "💰 ชั้นแห่งความโลภ", desc: "เหรียญที่ได้รับ ×2 แต่มอนสเตอร์เร็วขึ้น 20%", apply: m => { m.coinMult *= 2; m.enemySpeedMult *= 1.2; } },
    { id: "FROST",  short: "❄️FROST",  name: "❄️ ชั้นน้ำแข็ง", desc: "ศัตรูทุกตัวช้าลง 15% แต่บอส HP ×1.5", apply: m => { m.enemySlowPct += 0.15; m.bossHpMult *= 1.5; } },
    { id: "BLOOD",  short: "🩸BLOOD",  name: "🩸 ชั้นเลือด", desc: "ไม่มีหัวใจดรอปอีกต่อไป แต่พลังโจมตี +2", apply: m => { m.noHearts = true; m.bonusDmg += 2; } },
    { id: "SWARM",  short: "🐝SWARM",  name: "🐝 ชั้นฝูง", desc: "มอนสเตอร์เกิดเพิ่ม 50% แต่คะแนน ×1.5", apply: m => { m.spawnCapMult *= 1.5; m.scoreMult *= 1.5; } },
    { id: "GLASS",  short: "⚔️GLASS",  name: "⚔️ ชั้นแก้ว", desc: "ดาเมจที่คุณทำ +25% แต่โดนโจมตีเจ็บขึ้น 30%", apply: m => { m.dmgDealtMult *= 1.25; m.dmgTakenMult *= 1.3; } },
    { id: "RICH",   short: "✨RICH",   name: "✨ ชั้นสมบัติ", desc: "เริ่มชั้นถัดไปด้วยกองเหรียญ 5 จุด แต่มอน HP +15%", apply: m => { m.treasureFloor = true; m.enemyHpMult *= 1.15; } },
    { id: "OMEN",   short: "🎯OMEN",   name: "🎯 ชั้นสังหรณ์", desc: "โอกาสคริติคอล +15% แต่ตัวคูณคริ -0.5", apply: m => { m.critUp += 0.15; m.critMultDown += 0.5; } }
];

// [3B-3] ดีลปีศาจ: ส่วนตัวผูกผู้เก็บ / ระดับรันใช้ทั้งทีม (จับคู่ tier: บุญระดับรันคู่คำสาประดับรัน)
const DEVIL_DEALS = [
    {
        boons: [
            { t: "+75 COINS", f: (pl) => { pl.coins += 75; } },
            { t: "โล่ +100", f: (pl) => { pl.shield += 100; } }
        ],
        curses: [
            { t: "มอนเร็วขึ้น 15%", f: () => { runMods.enemySpeedMult *= 1.15; } },
            { t: "แม่เหล็กใช้ไม่ได้ (คนเก็บ)", f: (pl) => { pl.magnetOff = true; } }
        ]
    },
    {
        boons: [
            { t: "+1 อัพเกรดสุ่ม (ทุกคน)", f: () => { players.forEach(pl => { let p = getUpgradePool(pl); if (p.length) applyUpgrade(pl, p[Math.floor(Math.random() * p.length)].id); }); } },
            { t: "ฟื้น HP เต็ม", f: (pl) => { pl.hp = pl.maxHp; } },
            { t: "คริ +15% ตลอดรัน", f: () => { runMods.critUp += 0.15; } }
        ],
        curses: [
            { t: "MAX HP -20 (คนเก็บ)", f: (pl) => { pl.maxHpDown = (pl.maxHpDown || 0) + 20; recalcStats(); pl.hp = Math.min(pl.hp, pl.maxHp); } },
            { t: "เสียเหรียญ 40% (คนเก็บ)", f: (pl) => { pl.coins = Math.floor(pl.coins * 0.6); } },
            { t: "ศัตรูโจมตีคริ 10%", f: () => { runMods.enemyCrit += 0.10; } }
        ]
    }
];

const META_PERKS = [
    { id: "shield", name: "🛡 AEGIS BOOT", desc: "เริ่มทุกชั้นด้วยโล่ 50% ของ Max HP", cost: 2 },
    { id: "revive", name: "💠 PHOENIX PROTOCOL", desc: "ฟื้นชีพ 1 ครั้งต่อรัน (HP 50% + อมตะ 2 วิ)", cost: 4 },
    { id: "luck",   name: "🍀 COIN LUCK", desc: "โอกาสดรอปเหรียญ +40% (20%→28%)", cost: 3 },
    { id: "crit",   name: "🎯 CRIT BOOT", desc: "เริ่มทุกรันด้วยโอกาสคริติคอล +10%", cost: 3 }
];

const ACHIEVEMENTS = [
    { id: "first_blood",    name: "FIRST BLOOD",     desc: "กำจัดศัตรูตัวแรก" },
    { id: "exterminator",   name: "EXTERMINATOR",    desc: "กำจัดศัตรูรวม 1,000 ตัว" },
    { id: "deep_diver",     name: "DEEP DIVER",      desc: "ไปถึงชั้น 10" },
    { id: "boss_slayer",    name: "BOSS SLAYER",     desc: "กำจัดบอสรวม 10 ตัว" },
    { id: "overlord_killer",name: "OVERLORD KILLER", desc: "เอาชนะ OVERLORD" },
    { id: "devilcore",      name: "SOUL MATCHED",    desc: "เอาชนะ DEVIL CORE (บอสโคลนบิลด์คุณ)" },
    { id: "rich",           name: "HIGH ROLLER",     desc: "ถือเหรียญ 300+ พร้อมกัน" },
    { id: "evolved",        name: "EVOLUTION",       desc: "วิวัฒนาการอาวุธสำเร็จ" },
    { id: "devil",          name: "DEVIL'S CLIENT",  desc: "ทำดีลปีศาจ 5 ครั้ง" },
    { id: "untouched",      name: "UNTOUCHED",       desc: "เคลียร์ชั้นโดยไม่โดนโจมตีเลย" },
    { id: "crit_mass",      name: "CRITICAL MASS",   desc: "คริติคอลรวม 1,000 ครั้ง" }
];
const ACH_BY_ID = {};
ACHIEVEMENTS.forEach(a => ACH_BY_ID[a.id] = a);

// ================== [v27] RUN CHALLENGES — รีเซ็ตทุกรัน สำเร็จ = เหรียญติด High Score ==================
// โครงสร้าง: { id, name, desc, check(stats) } — check รับ "สถิติรัน" คืน true = สำเร็จ
// เพิ่มชาเลนจ์ใหม่ = ยัด object เข้าอาร์เรย์นี้เท่านั้น (โค้ดอื่นอ่านอัตโนมัติ)
// สำหรับตัวที่ต้องนับระหว่างเล่น: เพิ่มตัวนับใน runChal.count แล้วเช็คใน fn (ดู unlockRunChal ใน 05-combat)
const RUN_CHALLENGES = [
    { id: "first_blood",  name: "FIRST BLOOD",     desc: "กำจัดศัตรูตัวแรกของรัน" },
    { id: "deep_diver",   name: "DEEP DIVER",      desc: "ไปถึงชั้น 10 ในรันนี้" },
    { id: "rich",         name: "HIGH ROLLER",     desc: "ถือเหรียญ 300+ พร้อมกันในรันนี้" },
    { id: "evolved",      name: "EVOLUTION",       desc: "วิวัฒนาการอาวุธสำเร็จในรันนี้" },
    { id: "overlord_killer", name: "OVERLORD KILLER", desc: "เอาชนะ OVERLORD ในรันนี้" },
    { id: "devilcore",    name: "SOUL MATCHED",    desc: "เอาชนะ DEVIL CORE ในรันนี้" },
    { id: "untouched",    name: "UNTOUCHED",       desc: "เคลียร์ชั้นโดยไม่โดนโจมตีเลย (1 ชั้น)" },
    { id: "exterminator", name: "EXTERMINATOR",    desc: "กำจัดศัตรู 300 ตัวในรันเดียว" },        // เดิมถาวร 1,000 สะสม
    { id: "boss_slayer",  name: "BOSS SLAYER",     desc: "กำจัดบอส 3 ตัวในรันเดียว" },             // เดิมถาวร 10 สะสม
    { id: "crit_mass",    name: "CRITICAL MASS",   desc: "คริติคอล 150 ครั้งในรันเดียว" },         // เดิมถาวร 1,000 สะสม
    { id: "devil",        name: "DEVIL'S CLIENT",  desc: "ทำดีลปีศาจ 3 ครั้งในรันเดียว" },         // เดิมถาวร 5 สะสม
    { id: "flawless",     name: "FLAWLESS",        desc: "ไม่ได้รับดาเมจเลยตั้งแต่เริ่มรันจนจบรัน" },   // [v28]
    { id: "deep_20",      name: "GRID RUNNER",     desc: "ไปถึงชั้น 20 ในรันนี้" },                  // [v28]
    { id: "deep_30",      name: "VOID WALKER",     desc: "ไปถึงชั้น 30 ในรันนี้" },                  // [v28]
    { id: "deep_40",      name: "BEYOND THE GRID", desc: "ไปถึงชั้น 40 ในรันนี้" }                   // [v28]
];
const CHAL_ICON = {
    first_blood: "🩸", deep_diver: "🧭", rich: "💰", evolved: "🧬", overlord_killer: "👾",
    devilcore: "👹", untouched: "🛡", exterminator: "💀", boss_slayer: "🐉", crit_mass: "🎯", devil: "🃏",
    flawless: "✨", deep_20: "🏁", deep_30: "🌌", deep_40: "♾"   // [v28]
};

let shotgunBlastSeq = 0, uidSeq = 0;

