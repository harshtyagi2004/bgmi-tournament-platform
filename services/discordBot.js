const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');

const client = new Client({ 
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages] 
});

let isBotReady = false;

if (process.env.DISCORD_BOT_TOKEN) {
  client.login(process.env.DISCORD_BOT_TOKEN).catch(err => {
    console.warn('Discord Authentication Warning:', err.message);
  });
}

client.once('ready', () => {
  isBotReady = true;
  console.log(`🤖 Discord Bot online as ${client.user.tag}`);
});

async function announceRoomDetails(channelId, tournamentTitle, roomId, password) {
  if (!isBotReady) {
    console.log('[Mock Discord Announcement]', { tournamentTitle, roomId, password });
    return true;
  }

  try {
    const channel = await client.channels.fetch(channelId);
    if (!channel) return false;

    const embed = new EmbedBuilder()
      .setColor('#FF6B00')
      .setTitle(`🎮 ROOM DETAILS: ${tournamentTitle}`)
      .setDescription('Join your assigned slot numbers! Do not share credentials.')
      .addFields(
        { name: '🔑 Room ID', value: `\`${roomId}\``, inline: true },
        { name: '🔒 Password', value: `\`${password}\``, inline: true }
      )
      .setFooter({ text: 'Powered by Esports Engine' })
      .setTimestamp();

    await channel.send({ content: '@everyone Match is launching!', embeds: [embed] });
    return true;
  } catch (error) {
    console.error('Discord Publish Error:', error.message);
    return false;
  }
}

module.exports = { announceRoomDetails };