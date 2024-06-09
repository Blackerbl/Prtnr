require('dotenv').config();
const { Client, GatewayIntentBits, MessageEmbed, Permissions } = require('discord.js');
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

// Kullanıcının sıralamasını hesaplama
function getUserRank(points, userId) {
  const sortedUsers = Object.entries(points).sort(([, a], [, b]) => b - a);
  return sortedUsers.findIndex(([id]) => id === userId) + 1;
}

// Haftalık puanları sıfırlayıp log kanalı ve target kanala mesaj gönderme
function logAndResetPoints() {
  const logChannel = client.channels.cache.get(logChannelId);
  const targetChannel = client.channels.cache.get(targetChannelId);
  
  const sortedWeeklyPoints = Object.entries(userPoints).sort(([, a], [, b]) => b - a);
  const sortedAllTimePoints = Object.entries(allTimePoints).sort(([, a], [, b]) => b - a);

  const weeklyRanking = sortedWeeklyPoints.map(([id, points], index) => `${index + 1}. <@${id}>: ${points} puan`).join('\n');
  const allTimeRanking = sortedAllTimePoints.map(([id, points], index) => `${index + 1}. <@${id}>: ${points} puan`).join('\n');

  const logEmbed = new MessageEmbed()
    .setColor('#0099ff')
    .setTitle('Haftalık Partnerlik Puanları Sıfırlanması')
    .setDescription('Haftalık puanlar sıfırlanmış ve yedeklenmiştir.')
    .addField('Haftalık Sıralama', weeklyRanking)
    .addField('Tüm Zamanlar Sıralaması', allTimeRanking);

  const targetEmbed = new MessageEmbed()
    .setColor('#ff9900')
    .setTitle('Haftalık Partnerlik Puanları Sıfırlanması')
    .setDescription('Haftalık puanlar sıfırlanmıştır. Yeni haftaya hazır olun!');

  if (logChannel) logChannel.send({ embeds: [logEmbed] });
  if (targetChannel) targetChannel.send({ embeds: [targetEmbed] });

  userPoints = {};
  savePoints();
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
      .setThumbnail(userAvatarURL); // Üyenin resmini ekliyoruz

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
      .setThumbnail(userAvatarURL); // Üyenin resmini ekliyoruz

    message.reply({ embeds: [embed] });
  }

  if (message.content.startsWith('/kanalayarla')) {
    if (!message.member.permissions.has(Permissions.FLAGS.ADMINISTRATOR)) {
      return message.reply('Bu komutu kullanmak için yetkiniz yok.');
    }

    const args = message.content.split(' ').slice(1);
    const targetChannelId = args[1];
    const logChannelId = args[0];

    if (!targetChannelId || !logChannelId) {
      return message.reply('Lütfen hem hedef kanal ID\'sini hem de log kanal ID\'sini belirtin. Örnek kullanım: `/kanalayarla [logChannelId] [targetChannelId]`');
    }

    process.env.TARGET_CHANNEL_ID = targetChannelId;
    process.env.LOG_CHANNEL_ID = logChannelId;

    message.reply('Kanallar başarıyla ayarlandı.');
  }
});

function containsInviteLink(message) {
  const inviteLinkPattern = /\b(?:https?:\/\/)?(?:www\.)?(?:discord(?:\.com|app\.com|\.gg)\/\S+)/gi;
  return inviteLinkPattern.test(message);
}

client.login(token);
