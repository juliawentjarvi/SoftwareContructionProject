// Builds the app icons from the bear's head (ears, head and face; no body) in assets/bear/bear.svg.
// Run with `npm run generate:icon` after changing the artwork. Writes assets/icon.png, adaptive-icon.png, favicon.png.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Resvg } from "@resvg/resvg-js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const svg = readFileSync(resolve(root, "assets/bear/bear.svg"), "utf8");

const BACKGROUND = "#315b49"; // the app's green

// The head parts are direct children of the "main" group, which carries the transform that places them in the artwork.
const mainMatch = /<g id="main" transform="([^"]+)">/.exec(svg);
if (!mainMatch) throw new Error('Could not find <g id="main"> in bear.svg');

function groupFrom(id) {
	const start = svg.indexOf(`<g id="${id}"`);
	if (start === -1) throw new Error(`Could not find group "${id}" in bear.svg`);
	let depth = 0;
	for (const m of svg.slice(start).matchAll(/<g[\s>]|<\/g>/g)) {
		depth += m[0] === "</g>" ? -1 : 1;
		if (depth === 0) return svg.slice(start, start + m.index + m[0].length);
	}
	throw new Error(`Group "${id}" is not closed`);
}

const head = ["ears", "head", "headShadow", "NeutralFace"].map(groupFrom).join("\n");

// Head bounds in artwork coordinates (from the generated part metadata): x 194-886, y 654-1112; centre (540, 883).
const CENTRE = { x: 540, y: 883 };

function render({ side, background, size }) {
	const box = `${CENTRE.x - side / 2} ${CENTRE.y - side / 2} ${side} ${side}`;
	const fill = background ? `<rect x="${CENTRE.x - side / 2}" y="${CENTRE.y - side / 2}" width="${side}" height="${side}" fill="${background}"/>` : "";
	const doc = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${box}" width="${size}" height="${size}">${fill}<g transform="${mainMatch[1]}">${head}</g></svg>`;
	return new Resvg(doc, { fitTo: { mode: "width", value: size } }).render().asPng();
}

// iOS and the browser icon: the head fills most of a solid square. Android adaptive icon: the system crops to a
// shape, so the head stays inside the central safe area on a transparent layer (the colour comes from app.json).
writeFileSync(resolve(root, "assets/icon.png"), render({ side: 780, background: BACKGROUND, size: 1024 }));
writeFileSync(resolve(root, "assets/adaptive-icon.png"), render({ side: 1100, background: null, size: 1024 }));
writeFileSync(resolve(root, "assets/favicon.png"), render({ side: 820, background: BACKGROUND, size: 48 }));
console.log("Wrote assets/icon.png, assets/adaptive-icon.png, assets/favicon.png");
