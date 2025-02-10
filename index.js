require("dotenv").config();
const { Client, GatewayIntentBits } = require("discord.js");
const Database = require("better-sqlite3");

// เชื่อมต่อฐานข้อมูล SQLite
const db = new Database("./reminders.db");
console.log("✅ Connected to SQLite database.");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

// **ID ของผู้ใช้ที่ต้องการให้ Tag**
const USER_ID = "1308478122705813616"; // เปลี่ยนเป็น ID ของคุณ

// **รายการเตือนอัตโนมัติ**
const defaultReminders = [
  { time: "04:50", message: `⏰ <@${USER_ID}> ตื่นได้แล้ว!` },
  {
    time: "05:00",
    message: `🌅 <@${USER_ID}> **ล้างหน้า + ทาครีม (30 นาที)**  
1️⃣ Cetaphil – ล้างหน้า  
2️⃣ Smooth E Acne-5 Pore Clear Whitening Toner – เช็ดหน้า  
3️⃣ Boots Vitamin C Advanced Brightening & Smoothing Serum – ทาทั่วใบหน้า  
4️⃣ La Roche-Posay CICAPLAST BAUME B5+ – บำรุงผิว`
  },
  { time: "05:30", message: `✅ <@${USER_ID}> อาบน้ำ + แปรงฟัน` },
  { time: "06:00", message: `🍽️ <@${USER_ID}> กินอาหารเช้า` },
  { time: "06:30", message: `🥤 <@${USER_ID}> ดื่มน้ำมะเขือเทศ` },
  { time: "19:30", message: `🛀 <@${USER_ID}> ไปอาบน้ำได้แล้ว` },
  {
    time: "20:00",
    message: `🌆 <@${USER_ID}> **ล้างหน้า + ทาครีม (30 นาที)**  
✅ วันเว้นวัน: ทา Provamed Acne Retinol-A Gel (ถ้าใช้วันนี้ → ข้าม Vitamin C)  
✅ ถ้าไม่ใช้ Retinol → ทา Boots Vitamin C Advanced Brightening & Smoothing Serum  
✅ La Roche-Posay CICAPLAST BAUME B5+ – บำรุงผิว`
  },
  { time: "21:00", message: `🍛 <@${USER_ID}> กินข้าวเย็น` },
  { time: "21:30", message: `🥤 <@${USER_ID}> ดื่มน้ำมะเขือเทศ` },
  { time: "22:00", message: `🌙 <@${USER_ID}> ได้เวลานอนแล้ว!` },
];

// **วันขัดผิว (พุธ & อาทิตย์)**
const scrubDays = ["Wednesday", "Sunday"];
const scrubReminder = {
  time: "19:00",
  message: `📌 <@${USER_ID}> **วันนี้เป็นวันขัดผิว!**  
✅ อาบน้ำ + ขัดผิวเบา ๆ ด้วยสครับ  
✅ ล้างหน้า + ทาครีมตามปกติ`
};

// **สร้างตารางเตือนถ้ายังไม่มี**
db.run(
  `CREATE TABLE IF NOT EXISTS reminders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    time TEXT,
    message TEXT
  )`
);

// **เพิ่มรายการเตือนอัตโนมัติถ้ายังไม่มี**
defaultReminders.forEach((reminder) => {
  db.get("SELECT * FROM reminders WHERE time = ?", [reminder.time], (err, row) => {
    if (!row) {
      db.run("INSERT INTO reminders (time, message) VALUES (?, ?)", [reminder.time, reminder.message]);
      console.log(`📌 เพิ่มการเตือน: ${reminder.time} - ${reminder.message}`);
    }
  });
});

// **เพิ่มวันขัดผิวเฉพาะวันพุธ & อาทิตย์**
const today = new Date().toLocaleString("en-US", { weekday: "long" });
if (scrubDays.includes(today)) {
  db.get("SELECT * FROM reminders WHERE time = ?", [scrubReminder.time], (err, row) => {
    if (!row) {
      db.run("INSERT INTO reminders (time, message) VALUES (?, ?)", [scrubReminder.time, scrubReminder.message]);
      console.log(`📌 เพิ่มการเตือนวันขัดผิว: ${scrubReminder.time}`);
    }
  });
}

// **ฟังก์ชันเช็คเวลาและเตือนทุก 1 นาที**
function checkReminder() {
  const now = new Date();
  const currentTime = `${now.getHours()}:${String(now.getMinutes()).padStart(2, "0")}`;

  db.all("SELECT * FROM reminders WHERE time = ?", [currentTime], (err, rows) => {
    if (rows.length > 0) {
      const channel = client.channels.cache.get(process.env.CHANNEL_ID);
      if (channel) {
        rows.forEach((reminder) => {
          channel.send(reminder.message);
        });
      }
    }
  });
}

// **เริ่มเช็คเวลาเตือนทุก 1 นาที**
setInterval(checkReminder, 60000);

// **เมื่อบอทออนไลน์**
client.once("ready", () => {
  console.log(`✅ บอท ${client.user.tag} ทำงานแล้ว!`);
});

client.login(process.env.TOKEN);
