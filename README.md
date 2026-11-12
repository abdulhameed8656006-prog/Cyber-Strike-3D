# Cyber Strike 3D

A 3D first-person **team deathmatch** shooter that runs in the browser, in landscape. Play on a phone or on a PC.

- **Map:** a full night-city map (about 300 x 300 m) with streets, towers, warehouses, containers, cover walls and two team bases.
- **Mode:** Team Deathmatch, 5 vs 5 (you + 4 teammates against 5 enemies). First team to 30 kills, or the most kills after 5 minutes, wins.
- **Bots:** Easy, Normal and Hard bots that patrol the streets, hear shots, chase, strafe and respawn.
- **Gun:** assault rifle with recoil, spread, headshots (double damage), reload and aim-down-sights.
- **Hit feedback:** hit markers, damage direction, kill feed, minimap and scoreboard.
- **Online rooms:** one player creates a room, friends join with the 5-letter code (PeerJS, no server of your own). The host runs the match, empty slots are filled with bots, and everyone sees the same score.
- **No downloads:** the map, the people, the textures and the sounds are all made in code. It only loads Three.js from a CDN.

## Controls
**PC:** WASD move, mouse aim, left click fire, right click aim, Shift sprint, Space jump, R reload, Esc pause.

**Phone (landscape):** left thumb moves (push the stick all the way to sprint), right thumb looks, FIRE / AIM / JUMP / R buttons on the right. Aim assist helps when you fire near an enemy.

## Play it
Turn on GitHub Pages (Settings > Pages > Deploy from a branch > main > / root) and open the link.
It is also a PWA, so it can be added to the home screen or packaged as an APK with PWABuilder.

## Files
`index.html` (menu and HUD), `game.js` (the whole game), `sw.js` + `manifest.webmanifest` + icons (PWA).

## Next ideas
More weapons, more maps, voice/text chat, and a battle-royale mode.
