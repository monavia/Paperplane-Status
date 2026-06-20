# monavia Lavalink Status

Discord bot untuk memonitor status beberapa node Lavalink secara real-time.

## Fitur

- Mengecek 5+ node Lavalink via REST API `/v4/info`
- Menampilkan status dalam satu embed yang di-update otomatis setiap 15 detik
- Informasi per node: status online/offline, ping, versi, jumlah player, uptime, memory, CPU

## Node Lavalink

| # | Nama | Host | Port |
|---|------|------|------|
| 1 | Localhost | `localhost` | 2333 |
| 2 | Trinium 4333 | `lavalink.triniumhost.com` | 4333 |
| 3 | Trinium 2333 | `lavalink.triniumhost.com` | 2333 |
| 4 | Serenetia | `lavalinkv4.serenetia.com` | 80 |
| 5 | Jirayu | `lavalink.jirayu.net` | 13592 |

## Persyaratan

- Node.js 18+ (built-in `fetch`)
- Bot Discord dengan token

## Instalasi

```bash
git clone <repo-url>
cd paperplane-status
npm install
```

## Konfigurasi

Salin `.env.example` ke `.env` dan isi:

```
DISCORD_BOT_TOKEN=token_bot_kamu
CHANNEL_ID=id_channel_discord
```

## Menjalankan

```bash
npm start
```

## Menambahkan Node Baru

Edit `nodes.js` dan tambahkan objek baru ke array:

```js
{
  name: "Nama Node",
  host: "host.domain.com",
  port: 2333,
  password: "password",
  secure: false,
  description: "Deskripsi"
}
```
