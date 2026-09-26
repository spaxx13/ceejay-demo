# Custom Ragnarok Online (prototype)

Foundation ng sarili nating classic-Ragnarok-inspired na multiplayer game, gawa sa
[Godot 4](https://godotengine.org/) (4.3+). Ito ay networking skeleton pa lang:
top-down movement na naka-sync sa lahat ng konektadong players, walang pa
sprites/maps/combat/items — susunod na ilalagay yun.

## Kailangan

- Godot 4.3 o mas bago (Standard build, hindi kailangan ng .NET/C# version).
  Download: https://godotengine.org/download

## Pagbukas ng project

1. Buksan ang Godot, i-click **Import**, tapos piliin ang
   `ragnarok/project.godot` sa loob ng repo na ito.
2. Pindutin ang **Run Project** (F5).

## Pag-test nang mag-isa (dalawang window sa parehong machine)

1. Sa unang window, i-click **Host Server**.
2. Sa Godot editor, patakbuhin ulit ang project bilang pangalawang instance
   (Debug > Run Multiple Instances, o buksan ulit ang exported build), tapos
   sa `Server IP` field ilagay ang `127.0.0.1` at i-click **Join Server**.
3. Dapat magkita ang dalawang parisukat (players) at pareho silang
   gumagalaw gamit ang arrow keys.

## Pag-connect galing ibang device (Mac + Windows, o mobile)

1. Sa host machine (hal. MacBook), i-click **Host Server**. Tandaan ang
   local IP address nito (`ipconfig`/`ifconfig`), o gumamit ng
   [ngrok](https://ngrok.com/) / Cloudflare Tunnel kung magkaiba ang network
   (hal. bahay vs. work).
2. Sa ibang device, ilagay ang IP/hostname na iyon sa `Server IP` field at
   i-click **Join Server**.
3. Default port: `8910` (TCP/UDP, ENet). Siguraduhing bukas ito sa
   firewall/router kung direktang IP connection (hindi tunnel).

## Pag-deploy sa isang VPS bilang dedicated/headless server

1. Sa Godot editor: **Project > Export**, mag-dagdag ng **Linux/X11**
   preset, i-export bilang binary (hal. `ragnarok_server.x86_64`).
   Kakailanganin mo i-download ang export templates sa unang pagkakataon
   (Editor > Manage Export Templates).
2. I-upload ang exported binary papunta sa VPS mo (Oracle Cloud Free Tier,
   Hetzner, DigitalOcean, atbp).
3. Patakbuhin bilang headless server:

   ```bash
   chmod +x ragnarok_server.x86_64
   ./ragnarok_server.x86_64 --headless --server
   ```

   Ang `--server` flag ay kino-check ng `scenes/main.gd` para diretsong
   mag-host nang walang UI/graphics — ito ang mode na dapat laging naka-on
   sa VPS.
4. Sa mga clients (Mac, Windows, mobile export), ilagay ang public IP ng
   VPS sa `Server IP` field.

## Kasalukuyang istruktura

```
ragnarok/
  project.godot
  autoload/
    network_manager.gd   # host/join, peer connect/disconnect signals
  scenes/
    main.tscn / main.gd  # connect UI + dedicated-server bootstrap
    player.tscn / player.gd  # synced top-down player movement
```

## Susunod na idadagdag

- Sprites/tilemaps (kailalangan ng sariling art, hindi galing sa orihinal
  na RO client dahil sa copyright)
- Combat, skills, at stats system
- Database (items, characters, inventory) — Postgres/SQLite via Godot's
  `SQLite` addon o hiwalay na backend
- Maps/zones at server-side authoritative movement (kasalukuyan, client
  ang may authority sa sarili niyang position — okay lang para sa
  prototype, pero dapat i-secure bago mag-public launch para hindi
  mag-cheat ang players)
