const { Telegraf } = require('telegraf');
const axios = require('axios');
const QRCode = require('qrcode');

// Initialize bot (token from environment variable)
const bot = new Telegraf(process.env.BOT_TOKEN);

// -------------------------------------------------------------------
// Helper Functions
// -------------------------------------------------------------------
const isGroup = (ctx) => ctx.chat.type.includes('group');
const isAdmin = async (ctx, userId) => {
  if (!isGroup(ctx)) return false;
  const admins = await ctx.telegram.getChatAdministrators(ctx.chat.id);
  return admins.some(admin => admin.user.id === userId);
};

// -------------------------------------------------------------------
// Command Handlers
// -------------------------------------------------------------------
const handlers = {
  // ---------- MENU ----------
  menu: async (ctx) => {
    const text = `
📋 *Available Commands*

*Group Admin*
.hidetag - Mention all members silently
.tagall - Mention all members
.promote - Promote user to admin
.demote - Demote admin
.mute - Restrict sending messages
.unmute - Unrestrict
.kick - Remove user
.ban - Ban user
.unban - Unban user
.grouplink - Get group invite link
.listadmins - List group admins
.welcome - Set welcome message

*Download*
.play <song> - Download audio from YouTube
.ytsearch <query> - Search YouTube
.movie <name> - Movie info (OMDb)
.tiktok <url> - Download TikTok video (no watermark)
.qrcode <text> - Generate QR code
.shorturl <url> - Shorten URL (is.gd)
.say <text> - Text to speech (voicerss)

*Search*
.dictionary <word> - Define word (Free Dictionary API)
.wiki <query> - Wikipedia summary
.urban <term> - Urban Dictionary definition
.weather <city> - Current weather (OpenWeatherMap)
.dog - Random dog picture (Dog CEO)
.cat - Random cat picture (CATAAS)
.fact - Random fact (Useless Facts)
.recipe <dish> - Recipe search (Edamam – limited)
    `;
    await ctx.replyWithMarkdown(text);
  },

  // ---------- GROUP ADMIN ----------
  hidetag: async (ctx) => {
    if (!isGroup(ctx)) return ctx.reply('❌ This command works only in groups.');
    
    // Check bot permissions
    const botMember = await ctx.telegram.getChatMember(ctx.chat.id, ctx.botInfo.id);
    if (!botMember.can_restrict_members) 
      return ctx.reply('❌ I need admin rights with "restrict members" permission.');

    // Fetch admins (only admins are guaranteed to be fetchable)
    const admins = await ctx.telegram.getChatAdministrators(ctx.chat.id);
    let mentions = '';
    for (const admin of admins) {
      if (!admin.user.is_bot) {
        mentions += `[${admin.user.first_name}](tg://user?id=${admin.user.id}) `;
      }
    }
    // Send as a silent message (no notification)
    await ctx.replyWithMarkdown(`👥 *Members*\n${mentions || 'No members found'}`, {
      disable_notification: true
    });
  },

  tagall: async (ctx) => {
    if (!isGroup(ctx)) return ctx.reply('❌ Works only in groups.');
    const botMember = await ctx.telegram.getChatMember(ctx.chat.id, ctx.botInfo.id);
    if (!botMember.can_restrict_members) 
      return ctx.reply('❌ I need admin rights with "restrict members" permission.');

    const admins = await ctx.telegram.getChatAdministrators(ctx.chat.id);
    let mentions = '';
    for (const admin of admins) {
      if (!admin.user.is_bot) {
        mentions += `[${admin.user.first_name}](tg://user?id=${admin.user.id}) `;
      }
    }
    await ctx.replyWithMarkdown(`👥 *All Members*\n${mentions || 'No members found'}`);
  },

  promote: async (ctx) => {
    if (!isGroup(ctx)) return ctx.reply('❌ Works only in groups.');
    if (!ctx.message.reply_to_message) 
      return ctx.reply('❌ Reply to a user to promote.');
    
    const userId = ctx.message.reply_to_message.from.id;
    const botMember = await ctx.telegram.getChatMember(ctx.chat.id, ctx.botInfo.id);
    if (!botMember.can_promote_members) 
      return ctx.reply('❌ I need admin rights to promote.');

    try {
      await ctx.telegram.promoteChatMember(ctx.chat.id, userId, {
        can_change_info: true,
        can_delete_messages: true,
        can_invite_users: true,
        can_restrict_members: true,
        can_pin_messages: true,
        can_promote_members: false, // not giving promote rights by default
      });
      await ctx.reply(`✅ User promoted successfully.`);
    } catch (err) {
      await ctx.reply(`❌ Failed to promote: ${err.message}`);
    }
  },

  demote: async (ctx) => {
    if (!isGroup(ctx)) return ctx.reply('❌ Works only in groups.');
    if (!ctx.message.reply_to_message) 
      return ctx.reply('❌ Reply to a user to demote.');
    
    const userId = ctx.message.reply_to_message.from.id;
    const botMember = await ctx.telegram.getChatMember(ctx.chat.id, ctx.botInfo.id);
    if (!botMember.can_promote_members) 
      return ctx.reply('❌ I need admin rights to demote.');

    try {
      // Remove all admin privileges
      await ctx.telegram.promoteChatMember(ctx.chat.id, userId, {
        can_change_info: false,
        can_delete_messages: false,
        can_invite_users: false,
        can_restrict_members: false,
        can_pin_messages: false,
        can_promote_members: false,
      });
      await ctx.reply(`✅ User demoted successfully.`);
    } catch (err) {
      await ctx.reply(`❌ Failed to demote: ${err.message}`);
    }
  },

  mute: async (ctx) => {
    if (!isGroup(ctx)) return ctx.reply('❌ Works only in groups.');
    if (!ctx.message.reply_to_message) 
      return ctx.reply('❌ Reply to a user to mute.');

    const userId = ctx.message.reply_to_message.from.id;
    const botMember = await ctx.telegram.getChatMember(ctx.chat.id, ctx.botInfo.id);
    if (!botMember.can_restrict_members) 
      return ctx.reply('❌ I need admin rights to restrict.');

    try {
      const untilDate = Math.floor(Date.now() / 1000) + 3600; // 1 hour
      await ctx.telegram.restrictChatMember(ctx.chat.id, userId, {
        permissions: { can_send_messages: false },
        until_date: untilDate,
      });
      await ctx.reply(`✅ User muted for 1 hour.`);
    } catch (err) {
      await ctx.reply(`❌ Failed to mute: ${err.message}`);
    }
  },

  unmute: async (ctx) => {
    if (!isGroup(ctx)) return ctx.reply('❌ Works only in groups.');
    if (!ctx.message.reply_to_message) 
      return ctx.reply('❌ Reply to a user to unmute.');

    const userId = ctx.message.reply_to_message.from.id;
    const botMember = await ctx.telegram.getChatMember(ctx.chat.id, ctx.botInfo.id);
    if (!botMember.can_restrict_members) 
      return ctx.reply('❌ I need admin rights to unrestrict.');

    try {
      await ctx.telegram.restrictChatMember(ctx.chat.id, userId, {
        permissions: {
          can_send_messages: true,
          can_send_media_messages: true,
          can_send_polls: true,
          can_send_other_messages: true,
          can_add_web_page_previews: true,
        },
      });
      await ctx.reply(`✅ User unmuted.`);
    } catch (err) {
      await ctx.reply(`❌ Failed to unmute: ${err.message}`);
    }
  },

  kick: async (ctx) => {
    if (!isGroup(ctx)) return ctx.reply('❌ Works only in groups.');
    if (!ctx.message.reply_to_message) 
      return ctx.reply('❌ Reply to a user to kick.');

    const userId = ctx.message.reply_to_message.from.id;
    const botMember = await ctx.telegram.getChatMember(ctx.chat.id, ctx.botInfo.id);
    if (!botMember.can_restrict_members) 
      return ctx.reply('❌ I need admin rights to kick.');

    try {
      await ctx.telegram.kickChatMember(ctx.chat.id, userId);
      await ctx.reply(`✅ User kicked.`);
    } catch (err) {
      await ctx.reply(`❌ Failed to kick: ${err.message}`);
    }
  },

  ban: async (ctx) => {
    // Ban is same as kick but with permanent restriction (kick + ban)
    if (!isGroup(ctx)) return ctx.reply('❌ Works only in groups.');
    if (!ctx.message.reply_to_message) 
      return ctx.reply('❌ Reply to a user to ban.');

    const userId = ctx.message.reply_to_message.from.id;
    const botMember = await ctx.telegram.getChatMember(ctx.chat.id, ctx.botInfo.id);
    if (!botMember.can_restrict_members) 
      return ctx.reply('❌ I need admin rights to ban.');

    try {
      await ctx.telegram.kickChatMember(ctx.chat.id, userId);
      await ctx.reply(`✅ User banned.`);
    } catch (err) {
      await ctx.reply(`❌ Failed to ban: ${err.message}`);
    }
  },

  unban: async (ctx) => {
    if (!isGroup(ctx)) return ctx.reply('❌ Works only in groups.');
    if (!ctx.message.reply_to_message) 
      return ctx.reply('❌ Reply to a user to unban.');

    const userId = ctx.message.reply_to_message.from.id;
    const botMember = await ctx.telegram.getChatMember(ctx.chat.id, ctx.botInfo.id);
    if (!botMember.can_restrict_members) 
      return ctx.reply('❌ I need admin rights to unban.');

    try {
      await ctx.telegram.unbanChatMember(ctx.chat.id, userId);
      await ctx.reply(`✅ User unbanned.`);
    } catch (err) {
      await ctx.reply(`❌ Failed to unban: ${err.message}`);
    }
  },

  grouplink: async (ctx) => {
    if (!isGroup(ctx)) return ctx.reply('❌ Works only in groups.');
    const botMember = await ctx.telegram.getChatMember(ctx.chat.id, ctx.botInfo.id);
    if (!botMember.can_invite_users) 
      return ctx.reply('❌ I need admin rights with "invite users" permission.');

    try {
      const link = await ctx.telegram.exportChatInviteLink(ctx.chat.id);
      await ctx.reply(`🔗 Group link: ${link}`);
    } catch (err) {
      await ctx.reply(`❌ Failed to get link: ${err.message}`);
    }
  },

  listadmins: async (ctx) => {
    if (!isGroup(ctx)) return ctx.reply('❌ Works only in groups.');
    const admins = await ctx.telegram.getChatAdministrators(ctx.chat.id);
    let list = '';
    for (const a of admins) {
      list += `- ${a.user.first_name} ${a.user.last_name || ''} (@${a.user.username || 'no username'})\n`;
    }
    await ctx.reply(`👮 *Admins:*\n${list}`, { parse_mode: 'Markdown' });
  },

  welcome: async (ctx) => {
    // Placeholder: in a real bot, you'd store this in a database
    const text = ctx.message.text.split(' ').slice(1).join(' ');
    if (!text) return ctx.reply('❌ Usage: .welcome <message>');
    // For now, just acknowledge
    await ctx.reply(`✅ Welcome message set to: "${text}" (not persistent)`);
  },

  // ---------- DOWNLOAD ----------
  play: async (ctx) => {
    const query = ctx.message.text.split(' ').slice(1).join(' ');
    if (!query) return ctx.reply('❌ Usage: .play <song name>');

    // Using a free YouTube to MP3 API (this is a demo endpoint – you may need a different one)
    try {
      const apiUrl = `https://api.vevioz.com/api/button/mp3/${encodeURIComponent(query)}`;
      // This API returns a direct download link, but we can't download and send large files on Vercel.
      // Instead, we provide the link.
      await ctx.reply(`🎵 Search: ${query}\nDownload link (may not work): ${apiUrl}`);
    } catch (err) {
      await ctx.reply('❌ Failed to process request.');
    }
  },

  ytsearch: async (ctx) => {
    const query = ctx.message.text.split(' ').slice(1).join(' ');
    if (!query) return ctx.reply('❌ Usage: .ytsearch <query>');

    try {
      // Using a public YouTube search API (e.g., from yt-search)
      const { data } = await axios.get(`https://www.googleapis.com/youtube/v3/search`, {
        params: {
          part: 'snippet',
          q: query,
          maxResults: 5,
          type: 'video',
          key: process.env.YOUTUBE_API_KEY || 'YOUR_API_KEY' // you must set this env var
        }
      });
      let reply = `🔍 *YouTube Search Results for "${query}":*\n\n`;
      data.items.forEach((item, i) => {
        const title = item.snippet.title;
        const channel = item.snippet.channelTitle;
        const videoId = item.id.videoId;
        const link = `https://youtu.be/${videoId}`;
        reply += `${i+1}. [${title}](${link}) - ${channel}\n`;
      });
      await ctx.replyWithMarkdown(reply);
    } catch (err) {
      await ctx.reply('❌ Failed to search YouTube. API key might be missing or quota exceeded.');
    }
  },

  movie: async (ctx) => {
    const title = ctx.message.text.split(' ').slice(1).join(' ');
    if (!title) return ctx.reply('❌ Usage: .movie <movie title>');

    try {
      const { data } = await axios.get('http://www.omdbapi.com/', {
        params: {
          t: title,
          apikey: process.env.OMDB_API_KEY || 'YOUR_API_KEY' // set env var
        }
      });
      if (data.Response === 'False') return ctx.reply('❌ Movie not found.');
      
      let reply = `🎬 *${data.Title} (${data.Year})*\n`;
      reply += `⭐ *IMDb Rating:* ${data.imdbRating}\n`;
      reply += `🎭 *Genre:* ${data.Genre}\n`;
      reply += `🎥 *Director:* ${data.Director}\n`;
      reply += `📝 *Plot:* ${data.Plot}\n`;
      if (data.Poster && data.Poster !== 'N/A') {
        await ctx.replyWithPhoto(data.Poster, { caption: reply, parse_mode: 'Markdown' });
      } else {
        await ctx.replyWithMarkdown(reply);
      }
    } catch (err) {
      await ctx.reply('❌ Failed to fetch movie info.');
    }
  },

  tiktok: async (ctx) => {
    const url = ctx.message.text.split(' ')[1];
    if (!url) return ctx.reply('❌ Usage: .tiktok <tiktok video url>');

    // Using a free TikTok downloader API (this is a demo, may not work)
    try {
      const apiUrl = `https://api.tikmate.io/api/convert?url=${encodeURIComponent(url)}`;
      const { data } = await axios.get(apiUrl);
      if (data.error) return ctx.reply('❌ Failed to download.');
      const videoUrl = `https://tikmate.io/download/${data.token}/${data.id}.mp4`;
      await ctx.reply(`✅ Download link: ${videoUrl}`);
    } catch (err) {
      await ctx.reply('❌ TikTok download failed. The API might be down or rate-limited.');
    }
  },

  qrcode: async (ctx) => {
    const text = ctx.message.text.split(' ').slice(1).join(' ');
    if (!text) return ctx.reply('❌ Usage: .qrcode <text or url>');

    try {
      const qrBuffer = await QRCode.toBuffer(text);
      await ctx.replyWithPhoto({ source: qrBuffer }, { caption: '✅ QR Code generated' });
    } catch (err) {
      await ctx.reply('❌ Failed to generate QR code.');
    }
  },

  shorturl: async (ctx) => {
    const url = ctx.message.text.split(' ')[1];
    if (!url) return ctx.reply('❌ Usage: .shorturl <long url>');

    try {
      const { data } = await axios.get(`https://is.gd/create.php`, {
        params: { format: 'json', url }
      });
      await ctx.reply(`✅ Shortened URL: ${data.shorturl}`);
    } catch (err) {
      await ctx.reply('❌ Failed to shorten URL.');
    }
  },

  say: async (ctx) => {
    const text = ctx.message.text.split(' ').slice(1).join(' ');
    if (!text) return ctx.reply('❌ Usage: .say <text>');

    // Using VoiceRSS (free tier limited). You need an API key.
    try {
      const apiKey = process.env.VOICERSS_API_KEY || 'YOUR_API_KEY';
      const audioUrl = `https://api.voicerss.org/?key=${apiKey}&hl=en-us&src=${encodeURIComponent(text)}`;
      // Send as voice message
      await ctx.replyWithVoice(audioUrl);
    } catch (err) {
      await ctx.reply('❌ TTS failed. Check API key.');
    }
  },

  // ---------- SEARCH ----------
  dictionary: async (ctx) => {
    const word = ctx.message.text.split(' ')[1];
    if (!word) return ctx.reply('❌ Usage: .dictionary <word>');

    try {
      const { data } = await axios.get(`https://api.dictionaryapi.dev/api/v2/entries/en/${word}`);
      const entry = data[0];
      const meaning = entry.meanings[0];
      const definition = meaning.definitions[0].definition;
      const example = meaning.definitions[0].example ? `\n📝 *Example:* ${meaning.definitions[0].example}` : '';
      await ctx.replyWithMarkdown(`📖 *${word}*\n*Part of speech:* ${meaning.partOfSpeech}\n*Definition:* ${definition}${example}`);
    } catch (err) {
      await ctx.reply('❌ Word not found or API error.');
    }
  },

  wiki: async (ctx) => {
    const query = ctx.message.text.split(' ').slice(1).join(' ');
    if (!query) return ctx.reply('❌ Usage: .wiki <search term>');

    try {
      const { data } = await axios.get('https://en.wikipedia.org/api/rest_v1/page/summary/' + encodeURIComponent(query));
      if (data.type === 'disambiguation') {
        return ctx.reply('❌ Your query is ambiguous. Try a more specific term.');
      }
      let reply = `📚 *${data.title}*\n${data.extract}`;
      if (data.thumbnail) {
        await ctx.replyWithPhoto(data.thumbnail.source, { caption: reply, parse_mode: 'Markdown' });
      } else {
        await ctx.replyWithMarkdown(reply);
      }
    } catch (err) {
      await ctx.reply('❌ Wikipedia page not found.');
    }
  },

  urban: async (ctx) => {
    const term = ctx.message.text.split(' ').slice(1).join(' ');
    if (!term) return ctx.reply('❌ Usage: .urban <term>');

    try {
      const { data } = await axios.get('https://api.urbandictionary.com/v0/define', {
        params: { term }
      });
      if (data.list.length === 0) return ctx.reply('❌ No definitions found.');
      const def = data.list[0];
      await ctx.replyWithMarkdown(`📙 *${term}*\n*Definition:* ${def.definition}\n*Example:* ${def.example}`);
    } catch (err) {
      await ctx.reply('❌ Failed to fetch definition.');
    }
  },

  weather: async (ctx) => {
    const city = ctx.message.text.split(' ').slice(1).join(' ');
    if (!city) return ctx.reply('❌ Usage: .weather <city>');

    try {
      const apiKey = process.env.OPENWEATHER_API_KEY || 'YOUR_API_KEY';
      const { data } = await axios.get('https://api.openweathermap.org/data/2.5/weather', {
        params: {
          q: city,
          appid: apiKey,
          units: 'metric'
        }
      });
      const temp = data.main.temp;
      const feelsLike = data.main.feels_like;
      const description = data.weather[0].description;
      const humidity = data.main.humidity;
      const wind = data.wind.speed;
      await ctx.replyWithMarkdown(`🌍 *Weather in ${data.name}, ${data.sys.country}*\n🌡️ Temperature: ${temp}°C (feels like ${feelsLike}°C)\n☁️ Conditions: ${description}\n💧 Humidity: ${humidity}%\n💨 Wind: ${wind} m/s`);
    } catch (err) {
      await ctx.reply('❌ City not found or API error.');
    }
  },

  dog: async (ctx) => {
    try {
      const { data } = await axios.get('https://dog.ceo/api/breeds/image/random');
      await ctx.replyWithPhoto(data.message);
    } catch (err) {
      await ctx.reply('❌ Failed to fetch dog picture.');
    }
  },

  cat: async (ctx) => {
    try {
      const { data } = await axios.get('https://cataas.com/cat?json=true');
      await ctx.replyWithPhoto(`https://cataas.com${data.url}`);
    } catch (err) {
      await ctx.reply('❌ Failed to fetch cat picture.');
    }
  },

  fact: async (ctx) => {
    try {
      const { data } = await axios.get('https://uselessfacts.jsph.pl/random.json?language=en');
      await ctx.reply(`🧠 *Random Fact:* ${data.text}`, { parse_mode: 'Markdown' });
    } catch (err) {
      await ctx.reply('❌ Failed to fetch fact.');
    }
  },

  recipe: async (ctx) => {
    const dish = ctx.message.text.split(' ').slice(1).join(' ');
    if (!dish) return ctx.reply('❌ Usage: .recipe <dish>');

    // Using Edamam recipe search API (free tier requires app_id and app_key)
    try {
      const appId = process.env.EDAMAM_APP_ID || 'YOUR_APP_ID';
      const appKey = process.env.EDAMAM_APP_KEY || 'YOUR_APP_KEY';
      const { data } = await axios.get('https://api.edamam.com/search', {
        params: {
          q: dish,
          app_id: appId,
          app_key: appKey,
          to: 3
        }
      });
      if (data.hits.length === 0) return ctx.reply('❌ No recipes found.');
      
      let reply = `🍽️ *Recipes for "${dish}":*\n\n`;
      data.hits.forEach((hit, i) => {
        const recipe = hit.recipe;
        reply += `${i+1}. [${recipe.label}](${recipe.url})\n`;
        reply += `   Calories: ${Math.round(recipe.calories)}\n`;
      });
      await ctx.replyWithMarkdown(reply);
    } catch (err) {
      await ctx.reply('❌ Failed to fetch recipes. Check API keys.');
    }
  }
};

// -------------------------------------------------------------------
// Register all commands
// -------------------------------------------------------------------
const commandsList = [
  'menu', 'hidetag', 'tagall', 'promote', 'demote', 'mute', 'unmute', 'kick', 'ban', 'unban',
  'grouplink', 'listadmins', 'welcome', 'play', 'ytsearch', 'movie', 'tiktok', 'qrcode',
  'shorturl', 'say', 'dictionary', 'wiki', 'urban', 'weather', 'dog', 'cat', 'fact', 'recipe'
];

commandsList.forEach(cmd => {
  bot.command(cmd, async (ctx) => {
    if (handlers[cmd]) {
      try {
        await handlers[cmd](ctx);
      } catch (err) {
        console.error(`Error in /${cmd}:`, err);
        await ctx.reply('❌ An internal error occurred.');
      }
    } else {
      await ctx.reply(`❌ Command /${cmd} is not implemented.`);
    }
  });
});

// Handle non-command messages (optional)
bot.on('text', (ctx) => {
  if (ctx.message.text.startsWith('/')) return;
  ctx.reply('You said: ' + ctx.message.text);
});

// Vercel serverless handler
module.exports = async (req, res) => {
  try {
    await bot.handleUpdate(req.body, res);
  } catch (err) {
    console.error('Error handling update:', err);
    res.status(200).end(); // Always respond 200 to Telegram
  }
};
