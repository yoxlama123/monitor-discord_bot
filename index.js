require('dotenv').config();
const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } = require('discord.js');
const axios = require('axios');
const { ApplicationCommandOptionType } = require('discord-api-types/v10');

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});

const N8N_WEBHOOK = process.env.N8N_WEBHOOK;
const CHANNEL_A_ID = process.env.CHANNEL_A_ID;
const BOT_TOKEN = process.env.BOT_TOKEN;
const GUILD_ID = process.env.GUILD_ID;
const CLIENT_ID = process.env.CLIENT_ID

// Slash komutlarını tanımla
const commands = [
  new SlashCommandBuilder()
    .setName('addurl')
    .setDescription('URL ekle')
    .addStringOption(option =>
      option.setName('url')
        .setDescription('Eklemek istediğin URL')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('category')
        .setDescription('Kategori (örn: sfw)')
        .setRequired(true)),
  new SlashCommandBuilder()
    .setName('removeurl')
    .setDescription('URL sil')
    .addStringOption(option =>
      option.setName('url')
        .setDescription('Silmek istediğin URL')
        .setRequired(true)),
  new SlashCommandBuilder()
    .setName('listurl')
    .setDescription('URL listele')
    .addStringOption(option =>
      option.setName('category')
        .setDescription('Filtrelemek istediğin kategori (boş bırak tümünü göster)')
        .setRequired(false)),
];

client.on('ready', async () => {
  console.log(`Bot ${client.user.tag} hazır!`);

  const rest = new REST({ version: '10' }).setToken(BOT_TOKEN);
  try {
    console.log('Slash komutları deploy ediliyor...');
    await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands.map(c => c.toJSON()) });
    console.log('Slash komutları başarıyla deploy edildi!');
  } catch (error) {
    console.error('Deploy hatası:', error);
  }
});

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  if (interaction.channel.id !== CHANNEL_A_ID) return;

  const command = interaction.commandName;
  const url = interaction.options.getString('url');
  const category = interaction.options.getString('category');

  await interaction.deferReply({ ephemeral: true });

  if (!url && command !== 'listurl') {
    return interaction.editReply({ content: 'URL eksik! Örn: /addurl https://x.com/elonmusk sfw' });
  }

  try {
    const response = await axios.post(N8N_WEBHOOK, { action: command, url, category }, { timeout: 10000 });

    if (command === 'listurl') {
      let data = response.data || [];
      if (!Array.isArray(data)) data = [data];
      let urls = data.map(item => item.urls || '');
      const count = urls.length;
      const filteredUrls = urls.filter(Boolean);
      const filteredCount = filteredUrls.length;
      const reply = category 
        ? `Kategoria : ${category}  Linklərin sayı : ${filteredCount}\n${filteredUrls.join('\n')}`
        : `Linklərin sayı : ${count}\n${urls.join('\n')}`;
      await interaction.editReply(filteredCount ? reply : 'Bu kategoride URL yok.');
    } else {
      const message = response.data.message || `${command === 'addurl' ? 'Eklendi' : 'Silindi'}: ${url} (Kategori: ${category})`;
      await interaction.editReply(message);
    }
  } catch (error) {
    console.error('Webhook hatası:', error.message);
    await interaction.editReply({ content: 'Hata! n8n kontrol et.' });
  }
});

client.on('messageCreate', (message) => {
  if (message.author.bot || message.channel.id !== CHANNEL_A_ID) return;
  if (!message.content.startsWith('!')) return;

  const args = message.content.slice(1).trim().split(/ +/);
  const command = args.shift().toLowerCase();
  let url = args[0];
  let category = args[1];

  if (command === 'listurl') {
    category = args[0]; // !listurl sfw için category = 'sfw'
    url = null; // url'i boşalt
  }

  if (!url && command !== 'listurl') return message.reply('URL eksik! Örn: !addurl https://x.com/elonmusk sfw');

  axios.post(N8N_WEBHOOK, { action: command, url, category }, { timeout: 10000 })
    .then(response => {
      if (command === 'listurl') {
        let data = response.data || [];
        if (!Array.isArray(data)) data = [data];
        let urls = data.map(item => item.urls || '');
        const count = urls.length;
        const filteredUrls = urls.filter(Boolean);
        const filteredCount = filteredUrls.length;
        const reply = category 
          ? `Kategoria : ${category}  Linklərin sayı : ${filteredCount}\n${filteredUrls.join('\n')}`
          : `Linklərin sayı : ${count}\n${urls.join('\n')}`;
        message.reply(filteredCount ? reply : 'Bu kategoride URL yok.');
      } else {
        const messageText = response.data.message || `${command === 'addurl' ? 'Eklendi' : 'Silindi'}: ${url} (Kategori: ${category})`;
        message.reply(messageText);
      }
    })
    .catch(error => {
      console.error('Webhook hatası:', error.message);
      message.reply('Hata! n8n kontrol et.');
    });
});

client.login(BOT_TOKEN);