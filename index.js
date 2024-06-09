require('dotenv').config();
const { Client, GatewayIntentBits, MessageEmbed } = require('discord.js');
const schedule = require('node-schedule');
const fs = require('fs');
const { backup } = require('./driveHelper');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

const token = process.env.TOKEN;
const guildId = process.env.GUILD_ID;
const logChannelId = process.env.LOG_CHANNEL_ID;
const targetChannelId = process.env.TARGET_CHANNEL_ID;

let userPoints = {};
let allTimePoints = {};

// Puanları dosyadan yükleme
function loadPoints() {
  if (fs.existsSync('userPoints.json')) {
    userPoints = JSON.parse(fs.readFileSync('userPoints.json', 'utf8'));
  }
  if (fs.existsSync('allTimePoints.json')) {
    allTimePoints = JSON.parse(fs.readFileSync('allTimePoints.json', 'utf8'));
  }
}

// Puanları dosyaya kaydetme
function savePoints() {
  fs.writeFileSync('userPoints.json', JSON.stringify(userPoints, null, 2));
  fs.writeFileSync('allTimePoints.json', JSON.stringify(allTimePoints, null, 2));
  backup('userPoints.json');
  backup('allTimePoints.json');
}

client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}!`);
  loadPoints();

  // Puanları her 1 dakikada bir kaydetme
  setInterval(savePoints, 1 * 60 * 1000);

  // Haftalık sıfırlama ve yedekleme
  schedule.scheduleJob('0 0 * * 0', () => {
    logAndResetPoints();
    savePoints();
  });
});

client.on('messageCreate', async (message) => {
  if (message.guild.id !== guildId) return;

  if (message.channel.id === targetChannelId && containsInviteLink(message.content)) {
    const userId = message.author.id;
    const userAvatarURL = message.author.displayAvatarURL();

    if (!userPoints[userId]) {
      userPoints[userId] = 0;
    }
    if (!allTimePoints[userId]) {
      allTimePoints[userId] = 0;
    }

    userPoints[userId] += 1;
    allTimePoints[userId] += 1;

    const userWeeklyRank = getUserRank(userPoints, userId);
    const userAllTimeRank = getUserRank(allTimePoints, userId);

    const embed = new MessageEmbed()
      .setColor('#f4bfc7')
      .setTitle('Partner Başarılı!')
      .setDescription(`🪷︰Yeni partner için teşekkürler <@${userId}>! >ᴗ<\n🪷︰Partner yaparak 1 puan kazandınız. Şu anki toplam puanınız: ${userPoints[userId]} 🏆\n\n**Haftalık Sıralama:** ${userWeeklyRank}\n\n**Toplam Sıralama:** ${userAllTimeRank}`)
      .setThumbnail(userAvatarURL);

    message.reply({ embeds: [embed] });

    savePoints();
  }

  if (message.content.startsWith('!puan')) {
    const userMention = message.mentions.users.first();
    const userId = userMention ? userMention.id : message.author.id;
    const userAvatarURL = userMention ? userMention.displayAvatarURL() : message.author.displayAvatarURL();

    const weeklyPoints = userPoints[userId] || 0;
    const allTimePointsCount = allTimePoints[userId] || 0;
    const userWeeklyRank = getUserRank(userPoints, userId);
    const userAllTimeRank = getUserRank(allTimePoints, userId);

    const embed = new MessageEmbed()
      .setColor('#00FF00')
      .setTitle('Puan Durumu')
      .setDescription(`
        ㅤㅤ ㅤ‿︵˓ ʚ🪷ɞ ˓ ︵ ͜

        🪽︰<@${userId}> için puan durumu;
        🕯️︰\n\n**Haftalık Puan:** ${weeklyPoints}
        ☁️︰\n**Haftalık Sıralama:** ${userWeeklyRank}
        🐚︰\n\n**Toplam Puan:** ${allTimePointsCount}
        🦢︰\n**Toplam Sıralama:** ${userAllTimeRank}
      ㅤ   💌
      ㅤㅤㅤㅤ  ㅤ 
      ㅤㅤㅤ︶ ͡ ۫ ˓ ʚ🪷ɞ ˒ ۫ ͡ ︶`)
      .setThumbnail(userAvatarURL);

    message.reply({ embeds: [embed] });
  }
});

function containsInviteLink(message) {
  const inviteLinkPattern = /\b(?:https?:\/\/)?(?:www\.)?(?:discord(?:\.com|app\.com|\.gg)\/invite\/)?[a-zA-Z0-9-]{2,32}\b/gi;
  return inviteLinkPattern.test(message);
}

function logAndResetPoints() {
  const logChannel = client.channels.cache.get(logChannelId);

  if (logChannel) {
    const weeklyRanking = getWeeklyRanking();
    const allTimeRanking = getAllTimeRanking();

    const weeklyEmbed = new MessageEmbed()
      .setColor('#FFA500')
      .setTitle('Haftalık Partner Durumu')
      .setDescription(weeklyRanking);

    const allTimeEmbed = new MessageEmbed()
      .setColor('#0000FF')
      .setTitle('Tüm Zamanların Partner Durumu')
      .setDescription(allTimeRanking);

    logChannel.send({ embeds: [weeklyEmbed, allTimeEmbed] });

    userPoints = {};
    savePoints();
  }
}

function getUserRank(points, userId) {
  const sortedUsers = Object.entries(points).sort((a, b) => b[1] - a[1]);
  const userIndex = sortedUsers.findIndex(([id]) => id === userId);

  return userIndex !== -1 ? userIndex + 1 : 'Sıralama Bulunamadı';
}

function getWeeklyRanking() {
  let ranking = '';
  const sortedUsers = Object.entries(userPoints).sort((a, b) => b[1] - a[1]);

  sortedUsers.forEach(([userId, points], index) => {
    ranking += `${index + 1}. <@${userId}>: ${points} puan\n`;
  });

  return ranking || 'Bu hafta henüz puan yok.';
}

function getAllTimeRanking() {
  let ranking = '';
  const sortedUsers = Object.entries(allTimePoints).sort((a, b) => b[1] - a[1]);

  sortedUsers.forEach(([userId, points], index) => {
    ranking += `${index + 1}. <@${userId}>: ${points} puan\n`;
  });

  return ranking || 'Henüz toplam puan yok.';
}

client.login(token);
