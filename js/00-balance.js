"use strict";
// ================== BALANCE CONFIG ==================
// ปรับสมดุลเกมทั้งหมดจากไฟล์นี้ไฟล์เดียว — แก้แล้ว refresh เห็นผลทันที
// ตัวเลขในวงเล็บ (ค่าเดิม) = ค่าที่ใช้อยู่ ถ้างให้คืนตามนั้นได้เลย

const BAL = {

    // ═══════════ มอนสเตอร์ ═══════════
    MON: {
        HP_PER_FLOOR: 0.5,     // HP มอนโตตามชั้น (0.22 = +22%/ชั้น | ชั้น10=×3 ชั้น20=×5.2)
        HP_COOP: 0.25,          // HP มอนโตตามผู้เล่นเพิ่ม (0.25 = 2คน=×1.25 3คน=×1.5 4คน=×1.75)
        DMG_PER_FLOOR: 0.12,    // ดาเมจมอนโตตามชั้น (0.12 = +12%/ชั้น)
        DMG_CAP: 3.5,           // แคปดาเมจจากสูตรชั้น (ไม่รวม co-op — co-op ไม่โดนแคป)
        DMG_COOP: 0.25,         // ดาเมจมอนโตตามผู้เล่นเพิ่ม

        ELITE_BASE: 0.12,       // โอกาส elite พื้นฐาน (12% ชั้น 1-9)
        ELITE_MAX: 0.25,        // แคปโอกาส elite (สูงสุด 25%)
        ELITE_GROWTH: 0.0045,   // elite เพิ่ม/ชั้น หลังชั้น 10 (ถึงแคป)

        SPAWN_RATE: 60,        // เฟรมต่อการเกิด 1 ตัว (100 = ~1.7 วิ)
        SPAWN_RATE_BOSS: 600,   // หลังบอสเกิด ช้าลง (300 = ~5 วิ — ลด clutter ตอนไฟต์บอส)
        CAP_BASE: 40,           // มอนรวมทั้งจอสูงสุด โหมดเดี่ยว (เดิม per-spawner 10)
        CAP_PER_PLAYER: 7,      // เพิ่ม cap ต่อผู้เล่น (2คน=47 3คน=54 4คน=61)
        SPAWNS_TO_BOSS: 20,     // เกิดกี่ตัวแล้วบอสผุด (เร่ง = ลดจำนวนนี้)
    },

    // ═══════════ บอส ═══════════
    BOSS: {
        HP_A: 1.5,             // ชั้น 1-12: HP × A^(ชั้น-1) 1.32 (เติมโตเร็ว)
        HP_B: 1.15,             // ชั้น 13+: HP × B^(ชั้น-13) (เติมช้าลง | เดิม 1.15)
        HP_A_CAP: 12,           // เพดานชั้นของสูตร A
        MEGA_MULT: 2,        // บอสใหญ่ (ชั้น 5/10/15) HP 1.75 เพิ่ม ×1.25
        HP_COOP: 0.5,           // HP บอส ×(1 + 0.5/คนที่เพิ่ม)
        EXTRA_PER_ROUND: 1,     // OVERLORD/DEVILCORE: +N ตัวทุกครั้งที่เกิดซ้ำ
        MAX_COUNT: 3,           // จำนวนบอสสูงสุดต่อฟลอร์ (ปรับได้)

        SHIELD_MAGE_BASE: 10,          // [v14] โล่ CYBERMAGE ตอนเกิด
        SHIELD_MAGE_PER_FLOOR: 8,      // [v14] โล่ CYBERMAGE +N ต่อชั้น (แทน BOSS_SHIELD_LINEAR ใน 01-config — คงไว้แต่เลิกใช้)
        SHIELD_OVERLORD_BASE: 30,      // [v14] โล่ OVERLORD ตอนเกิด
        SHIELD_OVERLORD_PER_ROUND: 15, // [v14] โล่ OVERLORD +N ทุกรอบ 5 ชั้น
        SHIELD_DEVIL_BASE: 40,         // [v14] โล่ DEVILCORE ตอนเกิด
        SHIELD_DEVIL_PER_ROUND: 25,    // [v14] โล่ DEVILCORE +N ทุกรอบ 10 ชั้น
    },

    // ═══════════ สกิลบอส ═══════════
    BOSS_SKILL: {
        CD_BASE: 200,         // คูลดาวน์พื้น (เฟรม 200 = ~3.3 วิ) [v10-4] ตั้งให้ตรงโค้ดจริง — ค่าเดิมในไฟล์ 60 เป็นค่าเก่าที่โค้ดไม่เคยใช้
        CD_VAR: 80,           // สุ่มเพิ่ม 0-80 เฟรม [v10-4] เดิม 30 — ตามโค้ดจริง (แพตช์นี้ไม่เปลี่ยนพฤติกรรมเกมเลย แค่ทำให้ปรับจาก BAL ได้จริง)
        CD_PHASE2: 0.6,        // เฟส 2 คูลดาวน์ × 0.6 (เร็วขึ้น 40%)
        TELEGRAPH: 45,         // เฟรมเตือนก่อนท่า (เฟส 2 = 40)
        TELEGRAPH_P2: 40,      // เตือนก่อนท่า เฟส 2
        RECOVER: 25,           // เฟรมฟื้นตัวหลังท่า
        RECOVER_P2: 42,        // ฟื้นตัว เฟส 2 (นานขึ้น)

        DASH_SPEED: 4.5,       // ความเร็วชาร์จ × speed บอส
        DASH_SPEED_P2: 1.25,   // เฟส 2 เร็วขึ้นอีก ×1.25
        DASH_FRAMES: 24,       // ระยะเวลาชาร์จ (เฟรม)

        SPIRAL_RATE: 6,        // ยิงก้นหอยทุก N เฟรม
        SPIRAL_TURN: 0.38,     // องศาหมุนต่อชอต (เฟส 2 = 0.5)
        SPIRAL_TURN_P2: 0.5,
        SPIRAL_SHOTS: 2,       // จำนวนทิศต่อชอต (เฟส 2 = 3)
        SPIRAL_SHOTS_P2: 3,
        SPIRAL_DURATION: 90,   // ระยะเวลาท่าก้นหอย (เฟรม)

        BURST_N: 10,           // จำนวนกระสุนรอบตัว (OVERLORD 12/18)
        BULLET_SPD: 3.6,       // ความเร็วกระสุนบอส (พื้นฐาน)
        FAN_N: 9,              // จำนวนเม็ดพัดกระสุน
        FAN_SPD: 4.5,          // ความเร็วพัดกระสุน
        FAN_SPREAD: 0.14,      // [v10-3] มุมห่างระหว่างเม็ด (เรเดียน) — 9 เม็ด ≈ ครอบ ~64°
        BEAM_SPD: 8,           // ความเร็วลำแสง
        HOMING_N: 4,           // จำนวนมิสไซล์โฮม
        HOMING_SPD: 3.2,       // ความเร็วมิสไซล์โฮม
        HOMING_TURN: 0.045,    // ความคมโค้งของโฮม

        SLASH_RADIUS: 175,     // รัศมีโนวา
        SUMMON_N: 3,           // จำนวนมอนอัญเชิญ (OVERLORD 4)
        SUMMON_N_P2: 4,        // จำนวนอัญเชิญเฟส 2 (OVERLORD)

        SPIRAL_SPD: 3.0,       // [v14] ความเร็วกระสุนก้นหอย
        TELEPORT_MIN: 180,     // [v14] วาร์ป: ระยะขั้นต่ำจากเป้า
        TELEPORT_VAR: 90,      // [v14] วาร์ป: สุ่มเพิ่ม 0-N
        TELEPORT_RING_N: 8,    // [v14] OVERLORD วาร์ปแล้ว: จำนวนกระสุนวงแหวน
        RING_SPD: 3.2,         // [v14] OVERLORD วาร์ปแล้ว: ความเร็วกระสุนวงแหวน
        HOMING_SPREAD: 0.35,   // [v14] มุมห่างระหว่างมิสไซล์โฮม
        BEAM_SPREAD: 0.25,     // [v14] มุมห่างระหว่างลำแสง (ยิง 3 เส้น)
        BEAM_DMG_MULT: 1.5,    // [v14] ลำแสง: ดาเมจ × N ของ bulletDamage
        SKILL_RANGE: 640,      // [v14] บอสใช้ท่าเฉพาะเมื่อเป้าอยู่ใกล้กว่า N
        SUMMON_CAP: 45,        // [v14] ไม่อัญเชิญถ้ามอนบนสนามเกิน N
        DASH_RECOVER: 30,      // [v14] ฟื้นตัวหลังชาร์จจบ (เฟรม)
        CD_INIT: 160,          // [v14] คูลดาวน์แรกตอนบอสเกิด (เฟรม)
    },

    // ═══════════ กระสุน ═══════════
    BULLET: {
        PELLET_RANGE: 200,       // SHOTGUN: ระยะสูงสุด (px)
        LASER_RANGE: 460,        // LASER: ระยะสูงสุด (px)
        PELLET_DECAY: [1.0, 0.7, 0.5],  // ทะลุ: ตัวทะลุ 1=100% 2=70% 3=50%
        PELLET_CAP: 3,           // ทะลุสูงสุด N ตัว/เม็ด แล้วหาย
    },

    // ═══════════ เศรษฐกิจ ═══════════
    ECO: {
        SHOP_BASE: 60,          // ราคาเริ่มต้นร้าน (ครั้งที่ 1)
        SHOP_MULT: 1.3,        // ราคาโตต่อครั้งที่ซื้อ (1.38 = ซื้อ7ครั้ง~500 ซื้อ10~1200)
        COIN_CHANCE: 0.10,      // โอกาสดรอปเหรียญจากมอน (20% / perk 28%)
        COIN_VALUE: 10,         // มูลค่าเหรียญต่อเม็ด (ก่อนคูณ mod)
        HEART_CHANCE: 0.05,     // โอกาสดรอปหัวใจ (5%)
        BUFF_CHANCE: 0.05,      // โอกาสดรอปบัฟ (5%)
        COOP_SPLIT: 0.5,        // เหรียญ+EXP มูลค่า ×(1+0.5/คน) แล้วหารเท่ากัน
    },

    // ═══════════ EXP / เลเวล ═══════════
    XP: {
        BASE: 16,               // EXP ต้องเก็บถึงเลเวล 2 (จากเลเวล 1)
        GROWTH: 1.52,           // EXP โตต่อเลเวล (×1.32 + BONUS)
        BONUS: 8,               // บวกเพิ่มต่อเลเวล (+8 คงที่)
        BOSS_PCT: 0.15,         // ไอเทม EXP จากบอส = % ของ xpNext ปัจจุบัน
        LEVELUP_SECONDS: 20,    // เวลาเลือกการ์ดเลเวลอัพ (หมดเวลา = ยืนยันการ์ดที่เลือก)
    },

    // ═══════════ ผู้เล่น ═══════════
    PLR: {
        HURT_TIMER: 30,         // i-frame หลังโดนตี (เฟรม | 30 = 0.5 วิ)
        VAMP_CAP: 0.05,
        MAGNET_BASE: 80,        // รัศมีเก็บของพื้นฐาน (MAGNET upgrade removed)
        HP_REGEN_PCT: 0.01,     // regen 1% MaxHP ทุก 10 วิ
        HP_REGEN_INTERVAL: 600,  // ทุก 600 เฟรม = 10 วิ
        HEART_BASE: 20,         // หัวใจฟื้นพื้นฐาน
        HEART_PER_FLOOR: 2,     // หัวใจฟื้นเพิ่มต่อชั้น
    },

    // ═══════════ อัพเกรดคลาส ═══════════
    CLS: {
        GATE: 5,                // CLASS skill auto-activate ที่ Level 5/10/15
        DMG_FLAT: 5,            // DMG upgrade: +N ต่อเลเวล (ปรับได้)
        DMG_PCT: 0,             // [v9-2] ส่วนคูณ % ต่อเลเวลของ DMG upgrade (0 = flat ล้วนตามเป้าหมาย | เดิม hardcode 0.02)
        FIRERATE_SKILL_CD: 0.05, // -5% skill CD ต่อเลเวล FIRERATE

        MISSILE_EVERY: 6,       // GUN: ยิงมิสไซล์ทุก N นัด
        MISSILE_EVO_EVERY: 4,   // GUN evolved: ทุก N นัด
        MISSILE_DMG: 1.5,       // GUN: ดาเมจมิสไซล์ × N เท่า (เดิม 3)
        MISSILE_RANGE: 480,     // [v11-2] มิสไซล์เล็งเฉพาะศัตรูในรัศมีนี้เท่านั้น (ไม่รวมหิน) — เดิมล็อกทั้งแผนที่ สู้บอสอยู่ก็บินหาเป้าไกล | ปรับได้: ใหญ่ขึ้น=กระจายมากขึ้น

        MINE_EVERY: 5,          // SHOTGUN: โยนไมน์ทุก N นัด
        MINE_CAP: 3,            // SHOTGUN: cap ไมน์ = เลเวล × N (3/6/9)

        LANCE_EVERY: 5,         // LASER: ลำแสงใหญ่ทุก N นัด
        LANCE_DMG: [0, 2, 2.5, 3], // LASER: ดาเมจตามเลเวล 1/2/3

        DRONE_BASE: 1,          // DRONE: โดรนเริ่มต้น
        RICOCHET_MAX: 3,        // ชิ่งกำแพงสูงสุด 3 ครั้ง (GUN/DRONE/TURRET เท่านั้น)
        STUN_CONE_RANGE: 40,    // กรวยแตกจากเป้า 1 ช่อง (40px)
        STUN_CONE_DMG: 0.25,    // ดาเมจกรวย 25%
        THUNDER_CHAIN_N: 2,     // สายฟ้าเมื่อคริ: เด้งไป N เป้า
        THUNDER_CHAIN_RANGE: 130, // ระยะสายฟ้า
        THUNDER_CHAIN_DMG: 0.4,  // ดาเมจสายฟ้า 40%
        NOVA_EVERY: 4,           // SHOTGUN evolved: ทุก N ยิง = โนวา
        NOVA_PELLETS: 12,        // SHOTGUN evolved: จำนวนเม็ดโนวา 360°
        NOVA_DMG: 0.6,           // SHOTGUN evolved: ดาเมจโนวา 60%

        SG_PELLETS: 5,           // [v14] SHOTGUN: จำนวนเม็ดต่อยิง (เม็ดกลาง = ดูดเลือด คำนวณอัตโนมัติ)
        SG_STEP: 0.08,           // [v14] SHOTGUN: ระยะห่างมุมระหว่างเม็ด (5 เม็ด = ±0.16 เหมือนเดิม)
        MISSILE_SPD: 5,          // [v14] GUN: ความเร็วมิสไซล์ (ปกติ)
        ZERO_EVERY: 4,           // [v14] SWORD evolved (ZERO BLADE): โนวาแช่แข็งทุก N ฟัน
        ZERO_RADIUS: 180,        // [v14] SWORD evolved: รัศมีโนวา
        ZERO_FREEZE: 0.8,        // [v14] SWORD evolved: แช่แข็ง N วิ
        ZERO_DMG: 0.5,           // [v14] SWORD evolved: ดาเมจโนวา × N
    },

    // ═══════════ สกิล [E] รายคลาส ═══════════
    SKILL: {
        VORTEX_RADIUS: 90,   // SWORD: รัศมีพายุ = bulletSize + N
        VORTEX_DMG: 3,       // SWORD: ดาเมจ × N เท่า
        BARRAGE_N: 6,        // GUN: จำนวนมิสไซล์ระดม
        BARRAGE_DMG: 2,      // GUN: ดาเมจ × N
        BARRAGE_SPD: 5,      // GUN: ความเร็วมิสไซล์ระดม
        EMP_RANGE: 520,      // SHOTGUN: รัศมีสตัน
        EMP_STUN: 2.0,       // SHOTGUN: สตัน N วิ
        EMP_DMG: 5,          // SHOTGUN: ดาเมจตรง (flat)
        NOVA_DIRS: 10,       // LASER: จำนวนทิศลำแสง (สกิล NOVA ของ LASER — ต่างจาก CLS.NOVA_* ของ SHOTGUN evolved)
        NOVA_DMG: 2,         // LASER: ดาเมจ × N (ก่อนคูณ focus)
        OVERDRIVE_SEC: 5,    // DRONE: โดรนเร็ว 4 เท่า N วิ
    },
};
