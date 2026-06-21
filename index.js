/*
 * Created by monavia
 * Do not remove this credit
 */

require("dotenv").config();
const os = require("os");
const { Client, GatewayIntentBits, EmbedBuilder, ActivityType } = require("discord.js");
const nodes = require("./nodes");

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

let statusMessage = null;
const CHECK_INTERVAL = 60_000;

function parseVersion(ver) {
  if (typeof ver === "object" && ver !== null) return ver.semver || JSON.stringify(ver);
  return String(ver || "?");
}

function formatUptime(ms) {
  const sec = Math.floor(ms / 1000);
  const h = String(Math.floor(sec / 3600)).padStart(2, "0");
  const m = String(Math.floor((sec % 3600) / 60)).padStart(2, "0");
  const s = String(sec % 60).padStart(2, "0");
  return `${h}:${m}:${s}`;
}

function formatLoad(val) {
  if (val === undefined || val === null) return "0.00%";
  return `${(val * 100).toFixed(2)}%`;
}

async function checkNode(node) {
  const protocol = node.secure ? "https" : "http";
  const url = `${protocol}://${node.host}:${node.port}/v4/info`;
  const start = Date.now();

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const res = await fetch(url, {
      signal: controller.signal,
      headers: { Authorization: node.password },
    });
    clearTimeout(timeout);

    if (!res.ok) {
      return { node, online: false, ping: Date.now() - start, error: `HTTP ${res.status}` };
    }

    const d = await res.json();

    return {
      node,
      online: true,
      ping: Date.now() - start,
      version: parseVersion(d.version),
      players: d.stats?.players ?? 0,
      playingPlayers: d.stats?.playingPlayers ?? 0,
      uptime: d.stats?.uptime ?? 0,
      cores: d.stats?.cpu?.cores ?? 0,
      systemLoad: d.stats?.cpu?.systemLoad ?? 0,
      lavalinkLoad: d.stats?.cpu?.lavalinkLoad ?? 0,
      memoryFree: d.stats?.memory?.free ?? 0,
      memoryUsed: d.stats?.memory?.used ?? 0,
      memoryReservable: d.stats?.memory?.reservable ?? 0,
      memoryAllocated: d.stats?.memory?.allocated ?? 0,
    };
  } catch (err) {
    if (err.name === "AbortError") {
      return { node, online: false, ping: Date.now() - start, error: "Timeout" };
    }
    return { node, online: false, ping: Date.now() - start, error: err.code || err.message };
  }
}

function buildEmbed(results) {
  const totalOnline = results.filter((r) => r.online).length;
  const totalNodes = results.length;
  const now = new Date();

  const embed = new EmbedBuilder()
    .setDescription("Lavalink Node")
    .setColor(totalOnline === totalNodes ? 0x00ff00 : totalOnline > 0 ? 0xffaa00 : 0xff0000)
    .setFooter({ text: "monavia Status" })
    .setTimestamp();

  const mem = process.memoryUsage();
  const cpus = os.cpus();
  const cpuInfo = cpus.length > 0 ? cpus[0] : null;

  for (const r of results) {
    const { node, online, ping, error } = r;

    if (!online) {
      embed.addFields({
        name: ` `,
        value: [
          `Status : Offline 🔴`,
          `Node: ${node.name}`,
          `Error: ${error || "Unknown"}`,
          `Host: ${node.host}:${node.port}`,
          `Ping: ${ping}ms`,
          `----------------------------`,
        ].join("\n"),
        inline: false,
      });
      continue;
    }

    const isLocal = node.host === "localhost";

    const fields = [
      `Status : Online 🟢`,
      `Node: ${node.name}`,
      `Host: ${node.host}:${node.port}`,
      isLocal ? `Player: ${r.players}` : null,
      isLocal ? `Playing Players: ${r.playingPlayers}` : null,
      isLocal ? `Uptime: ${formatUptime(r.uptime)}` : null,
      isLocal ? `` : null,
      isLocal ? `CPU` : null,
      isLocal ? `Cores: ${r.cores}` : null,
      isLocal ? `System Load: ${formatLoad(r.systemLoad)}` : null,
      isLocal ? `Lavalink Load: ${formatLoad(r.lavalinkLoad)}` : null,
      `----------------------------`,
    ].filter(Boolean);

    embed.addFields({ name: ` `, value: fields.join("\n"), inline: false });
  }

  const systemLines = [
    `Total Memory  :: ${formatMB(os.totalmem())} mb`,
    `Free Memory   :: ${formatMB(os.freemem())} mb`,
    `RSS           :: ${formatMB(mem.rss)} mb`,
    `Heap Total    :: ${formatMB(mem.heapTotal)} mb`,
    `Heap Used     :: ${formatMB(mem.heapUsed)} mb`,
    `External      :: ${formatMB(mem.external)} mb`,
    `Array Buffer  :: ${formatMB(mem.arrayBuffers || 0)} mb`,
    cpuInfo ? `CPU Model     :: ${cpuInfo.model}` : null,
    `Cores         :: ${cpus.length}`,
    cpuInfo ? `Speed         :: ${cpuInfo.speed}Mhz` : null,
    `Platform      :: ${os.platform()}`,
    `PID           :: ${process.pid}`,
    `${now.toLocaleDateString()} ${now.toLocaleTimeString()}`,
  ].filter(Boolean).join("\n");

  embed.addFields({ name: ` `, value: systemLines, inline: false });

  return embed;
}

function formatMB(bytes) {
  return (bytes / 1024 / 1024).toFixed(0);
}

async function updateStatus() {
  const results = await Promise.all(nodes.map(checkNode));

  const embed = buildEmbed(results);
  const channel = client.channels.cache.get(process.env.CHANNEL_ID);
  if (!channel) { console.log(`Channel ${process.env.CHANNEL_ID} tidak ditemukan`); return; }

  if (!statusMessage) {
    const messages = await channel.messages.fetch({ limit: 10 });
    statusMessage = messages.find(
      (m) => m.author.id === client.user.id && m.embeds.length > 0
    ) || null;
  }

  try {
    if (statusMessage) {
      await statusMessage.edit({ embeds: [embed] });
      console.log(`Pesan embed berhasil diupdate`);
    } else {
      statusMessage = await channel.send({ embeds: [embed] });
      console.log(`Pesan embed berhasil dikirim`);
    }
  } catch {
    statusMessage = null;
    const messages = await channel.messages.fetch({ limit: 10 });
    const old = messages.find((m) => m.author.id === client.user.id && m.embeds.length > 0);
    if (old) {
      statusMessage = old;
      await old.edit({ embeds: [embed] });
    } else {
      statusMessage = await channel.send({ embeds: [embed] });
    }
  }
}

const ALLOWED_GUILD = process.env.ALLOWED_GUILD_ID;

async function leaveOtherGuilds() {
  for (const guild of client.guilds.cache.values()) {
    if (guild.id !== ALLOWED_GUILD) {
      console.log(`Meninggalkan server: ${guild.name} (${guild.id}) — tidak diizinkan`);
      await guild.leave();
    }
  }
}

client.once("clientReady", async () => {
  console.log(`Bot login sebagai ${client.user.tag}`);
  client.user.setPresence({ status: "dnd", activities: [{ name: "Watching Seryn", type: ActivityType.Custom }] });
  await leaveOtherGuilds();
  await updateStatus();
  setInterval(updateStatus, CHECK_INTERVAL);
});

client.on("guildCreate", async (guild) => {
  if (guild.id !== ALLOWED_GUILD) {
    console.log(`Meninggalkan server: ${guild.name} (${guild.id}) — tidak diizinkan`);
    await guild.leave();
  }
});

client.login(process.env.DISCORD_BOT_TOKEN);
