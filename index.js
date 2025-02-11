require("dotenv").config();
const { Client, GatewayIntentBits, ActivityType, PresenceUpdateStatus } = require("discord.js");
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

// **ตรวจสอบว่า `CHANNEL_ID` โหลดค่าถูกต้องหรือไม่**
if (!process.env.CHANNEL_ID) {
  console.error("❌ ERROR: ไม่พบค่า `CHANNEL_ID` ใน `.env` หรือ Railway Environment Variables");
  process.exit(1);
}
console.log(`📌 ใช้ CHANNEL_ID: ${process.env.CHANNEL_ID}`);

// **รายการเตือนอัตโนมัติ**
const defaultReminders = [
  { time: "04:50", message: `⏰ <@${USER_ID}> ตื่นได้แล้วครับ!` },
  { time: "05:00", message: `🛀 <@${USER_ID}> ไป อาบน้ำ + แปรงฟัน + ล้างหน้า ได้แล้วครับ` },
  { time: "05:30", message: `✅ <@${USER_ID}> ได้เวลากินข้าวเช้าครับ` },
  { time: "05:50", message: `🍽️ <@${USER_ID}> ได้เวลาออกจากบ้านครับ` },
  { time: "08:00", message: `🥤 <@${USER_ID}> ได้เวลาทำงานครับ` },
  { time: "11:30", message: `🍽️ <@${USER_ID}> ได้เวลาพักที่ยงครับ` },
  { time: "12:30", message: `✅ <@${USER_ID}> ได้เวลาทำงานต่อแล้วครับ` },
  { time: "17:00", message: `✅ <@${USER_ID}> ได้เลิกงานแล้วครับ` },
  { time: "19:30", message: `🛀  <@${USER_ID}> ไป อาบน้ำ + ล้างหน้า ได้แล้วครับ` },
  { time: "20:30", message: `🍛 <@${USER_ID}> กินข้าวเย็น` },
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
db.prepare(
  `CREATE TABLE IF NOT EXISTS reminders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    time TEXT,
    message TEXT
  )`
).run();

// **เพิ่มรายการเตือนอัตโนมัติถ้ายังไม่มี**
for (const reminder of defaultReminders) {
  const exists = db.prepare("SELECT * FROM reminders WHERE time = ?").get(reminder.time);
  if (!exists) {
    db.prepare("INSERT INTO reminders (time, message) VALUES (?, ?)").run(reminder.time, reminder.message);
    console.log(`📌 เพิ่มการเตือน: ${reminder.time} - ${reminder.message}`);
  }
}

// **เพิ่มวันขัดผิวเฉพาะวันพุธ & อาทิตย์**
const today = new Date().toLocaleString("en-US", { weekday: "long" });
if (scrubDays.includes(today)) {
  const exists = db.prepare("SELECT * FROM reminders WHERE time = ?").get(scrubReminder.time);
  if (!exists) {
    db.prepare("INSERT INTO reminders (time, message) VALUES (?, ?)").run(scrubReminder.time, scrubReminder.message);
    console.log(`📌 เพิ่มการเตือนวันขัดผิว: ${scrubReminder.time}`);
  }
}

// **เมื่อบอทออนไลน์**
client.once("ready", async () => {
  console.log(`✅ บอท ${client.user.tag} ทำงานแล้ว!`);

  // **เช็คว่า `CHANNEL_ID` ใช้งานได้ไหม**
  const channel = await client.channels.fetch(process.env.CHANNEL_ID).catch(() => null);
  if (!channel) {
    console.error("❌ ERROR: ไม่พบช่อง ตรวจสอบ `CHANNEL_ID` และให้บอทมีสิทธิ์ในช่องนั้น!");
  } else {
    console.log(`📢 บอทสามารถเข้าถึงช่อง: #${channel.name}`);
    
    // **เช็คว่า บอทสามารถพิมพ์ข้อความในช่องนั้นได้ไหม**
    const permissions = channel.permissionsFor(client.user);
    if (!permissions || !permissions.has("SendMessages")) {
      console.error("❌ ERROR: บอทไม่มีสิทธิ์ส่งข้อความในช่องนี้! โปรดให้สิทธิ์ 'Send Messages'");
    } else {
      console.log("✅ บอทสามารถส่งข้อความได้ในช่องนี้!");
    }
  }

  // **เริ่มเช็คเวลาเตือนทุก 1 นาที**
  setInterval(checkReminder, 60000);

  // **เปลี่ยนสถานะบอททุก 2 วินาที**
  cycleBotStatus();
});

// **ฟังก์ชันเปลี่ยนสถานะบอท**
function cycleBotStatus() {
  const statuses = ["online", "idle", "dnd"];
  let index = 0;

  setInterval(() => {
    client.user.setStatus(statuses[index]);
    console.log(`🔄 เปลี่ยนสถานะเป็น: ${statuses[index]}`);
    index = (index + 1) % statuses.length; // วนซ้ำ
  }, 2000);
}

// **ฟังก์ชันเช็คเวลาและเตือนทุก 1 นาที**
function checkReminder() {
  const now = new Date();
  const currentTime = `${now.getHours()}:${String(now.getMinutes()).padStart(2, "0")}`;
  console.log(`⏰ Checking reminders at: ${currentTime}`);

  const rows = db.prepare("SELECT * FROM reminders WHERE time = ?").all(currentTime);
  if (rows.length > 0) {
    const channel = client.channels.cache.get(process.env.CHANNEL_ID);
    if (channel) {
      rows.forEach((reminder) => {
        console.log(`📢 ส่งข้อความ: ${reminder.message}`);
        channel.send(reminder.message);
      });
    } else {
      console.log("❌ ไม่พบช่อง หรือ `CHANNEL_ID` ผิด!");
    }
  }
}

client.login(process.env.TOKEN);
