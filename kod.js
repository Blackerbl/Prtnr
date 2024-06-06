require('dotenv').config();
const { Client, Intents, MessageEmbed } = require('discord.js');
const schedule = require('node-schedule');
const fs = require('fs');
const express = require('express');
const { backup } = require('./driveHelper');

const client = new Client({
  intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES]
});

const token = process.env.TOKEN;

let userPoints = {};
let allTimePoints = {};
let serverConfig = {};

// Puanları dosyadan yükleme
function loadPoints() {
  if (fs.existsSync('userPoints.json')) {
    userPoints = JSON.parse(fs.readFileSync('userPoints.json', 'utf8'));
  }
  if (fs.existsSync('allTimePoints.json')) {
    allTimePoints = JSON.parse(fs.readFileSync('allTimePoints.json', 'utf8'));
  }
  if (fs.existsSync('serverConfig.json')) {
    serverConfig = JSON.parse(fs.readFileSync('serverConfig.json', 'utf8'));
  }
}

// Puanları dosyaya kaydetme
function savePoints() {
  fs.writeFileSync('userPoints.json', JSON.stringify(userPoints, null, 2));
  fs.writeFileSync('allTimePoints.json', JSON.stringify(allTimePoints, null, 2));
  fs.writeFileSync('serverConfig.json', JSON.stringify(serverConfig, null, 2));
  backup('userPoints.json');
  backup('allTimePoints.json');
  backup('serverConfig.json');
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
  const guildId = message.guild.id;

  if (message.channel.id === serverConfig[guildId]?.targetChannelId && containsInviteLink(message.content)) {
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
    if (!message.member.permissions.has('ADMINISTRATOR')) {
      return message.reply('Bu komutu kullanmak için yetkiniz yok.');
    }

    const args = message.content.split(' ').slice(1);
    const targetChannelId = args[1];
    const logChannelId = args[0];

    if (!targetChannelId || !logChannelId) {
      return message.reply('Lütfen hem hedef kanal ID\'sini hem de log kanal ID\'sini belirtin. Örnek kullanım: `/kanalayarla [logChannelId] [targetChannelId]`');
    }

    serverConfig[guildId] = {
      targetChannelId,
      logChannelId,
    };

    savePoints();

    message.reply('Kanallar başarıyla ayarlandı.');
  }
});

function containsInviteLink(message) {
  const inviteLinkPattern = /\b(?:https?:\/\/)?(?:www\.)?(?:discord(?:\.com|app\.com|\.gg)\/invite\/)?[a-zA-Z0-9-]{2,32}\b/gi;
  return inviteLinkPattern.test(message);
}

function logAndResetPoints() {
  for (const guildId in serverConfig) {
    const logChannel = client.channels.cache.get(serverConfig[guildId].logChannelId);

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
