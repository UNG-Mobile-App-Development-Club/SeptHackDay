# Sunset Run

A small arcade highway racer made with HTML, CSS, JavaScript, and Three.js. Dodge traffic in a low-poly desert, use nitro, and beat your saved distance record.

## Run

Double-click `index.html` to play. You can also serve this folder with VS Code's **Live Server** extension or any static web server.

No build step or npm dependencies. Three.js 0.160.1 is included locally in `three.min.js` (MIT license), so the game does not need a CDN or internet connection. Optional Google Fonts use system font fallbacks offline. The game requires a browser with WebGL support.

## Controls

- W / Up: accelerate (the car cruises automatically).
- A / D or Left / Right: steer.
- S / Down: brake.
- Space: nitro; recharges when released.
- Left-click anywhere on the road: fire a huge blue mega laser from the front of your car. Hold to repeat; F also works. The beam lasts 0.65 seconds, reaches 145 meters, and destroys every car it touches. Mobile has a FIRE LASERS button.
- Collect the spinning orange flame rings for eight seconds of fire mode: visible flames, a 290 km/h speed target, and collision invincibility. Ramming traffic while on fire destroys it. Braking still works.
- P / Escape: pause or resume.
- Touch controls are shown on small screens.

Drive a white, low-poly Toyota Corolla-inspired sedan with a labeled rear badge and front laser emitters. Ramming traffic blows it apart into tumbling body panels, wheels, and fiery particles. Collisions slow you slightly; fire mode lets you smash through at full speed. The highway includes guardrails, streetlights, overhead signs, rocks, and cacti. Your best distance is saved during the run when browser storage is available. Switching tabs pauses the game, including power-up timers. Restarting clears weapons, explosions, and power-ups.

Three.js: https://threejs.org/ — license included in `three.LICENSE.txt`.
