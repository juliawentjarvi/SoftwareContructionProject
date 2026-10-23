// Converts assets/bear/bear.svg into src/components/bear/BearArt.generated.tsx.
// Run with `npm run generate:bear` after changing the SVG. Named groups listed in PARTS become
// animatable <Part> wrappers; PART_META records each part's bounding box so animations can pivot on it.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = resolve(root, "assets/bear/bear.svg");
const target = resolve(root, "src/components/bear/BearArt.generated.tsx");
const metaTarget = resolve(root, "src/components/bear/bearMeta.generated.ts");

// SVG group ids that become animatable parts.
const PARTS = new Set([
	"bear1", "main", "arms", "rightArm", "leftArm", "legs", "rightLeg", "leftLeg", "Body",
	"ears", "rightEar", "leftEar", "eyes", "leftEye", "rightEye", "eyebrows", "open_mouth",
	"heart_emotes", "bigHeart", "littleHeart",
]);
// Siblings that must move together (e.g. the head plus everything drawn on it).
const SIBLING_GROUPS = [{ name: "headAll", ids: ["ears", "head", "headShadow", "NeutralFace"] }];
// Name the root part is exposed under.
const RENAME = { bear1: "bear" };
// Groups copied after the face so the arms can be drawn in front of it.
const FRONT_COPIES = ["rightArm", "leftArm"];

// ---------------------------------------------------------------- minimal XML parser
function parseXml(text) {
	text = text.replace(/<\?[\s\S]*?\?>/g, "").replace(/<!DOCTYPE[^>]*>/g, "").replace(/<!--[\s\S]*?-->/g, "");
	const tokens = text.match(/<[^>]+>/g);
	const rootNode = { tag: "#root", attrs: {}, children: [] };
	const stack = [rootNode];
	for (const token of tokens) {
		if (token.startsWith("</")) { stack.pop(); continue; }
		const selfClosing = token.endsWith("/>");
		const tag = token.match(/^<([^\s/>]+)/)[1];
		const attrs = {};
		for (const m of token.matchAll(/([\w:-]+)="([^"]*)"/g)) attrs[m[1]] = m[2];
		const node = { tag, attrs, children: [] };
		stack[stack.length - 1].children.push(node);
		if (!selfClosing) stack.push(node);
	}
	return rootNode.children[0];
}

// ---------------------------------------------------------------- matrices & boxes
const IDENTITY = [1, 0, 0, 1, 0, 0];
const multiply = (m, n) => [
	m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1],
	m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3],
	m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5],
];
const apply = (m, x, y) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
const parseTransform = (value) => {
	if (!value) return IDENTITY;
	const m = value.match(/matrix\(([^)]+)\)/);
	if (!m) throw new Error(`Unsupported transform: ${value}`);
	return m[1].split(/[\s,]+/).map(Number);
};
const emptyBox = () => [Infinity, Infinity, -Infinity, -Infinity];
const grow = (box, x, y) => { box[0] = Math.min(box[0], x); box[1] = Math.min(box[1], y); box[2] = Math.max(box[2], x); box[3] = Math.max(box[3], y); };
const isEmpty = (box) => box[0] === Infinity;

// Points of a shape in its own coordinates (control points bound a Bezier curve, which is close enough here).
function shapePoints(node) {
	const a = node.attrs;
	const n = (k) => Number(a[k]);
	const corners = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x0, y1], [x1, y1]];
	if (node.tag === "circle") return corners(n("cx") - n("r"), n("cy") - n("r"), n("cx") + n("r"), n("cy") + n("r"));
	if (node.tag === "ellipse") return corners(n("cx") - n("rx"), n("cy") - n("ry"), n("cx") + n("rx"), n("cy") + n("ry"));
	if (node.tag === "rect") return corners(n("x"), n("y"), n("x") + n("width"), n("y") + n("height"));
	if (node.tag === "path") {
		if (/[a-bd-ln-yA-BD-LN-Y]/.test(a.d.replace(/[MLCZ]/g, ""))) throw new Error("Path uses commands other than M, L, C, Z");
		const points = [];
		for (const seg of a.d.match(/[MLC][^MLCZ]*/g)) {
			const nums = seg.slice(1).trim().split(/[\s,]+/).map(Number);
			for (let i = 0; i < nums.length; i += 2) points.push([nums[i], nums[i + 1]]);
		}
		return points;
	}
	return [];
}

// Box of `node` in the coordinate space *inside* the node's own transform, plus the same box in root space.
function measure(node, parentMatrix, out) {
	const local = emptyBox();
	const world = emptyBox();
	const own = node.tag === "svg" ? IDENTITY : parseTransform(node.attrs.transform);
	const matrix = multiply(parentMatrix, own);
	for (const [x, y] of shapePoints(node)) {
		grow(local, x, y);
		const [wx, wy] = apply(matrix, x, y);
		grow(world, wx, wy);
	}
	for (const child of node.children) {
		const result = measure(child, matrix, out);
		if (isEmpty(result.local)) continue;
		// child.local is in the child's inner space; bring it into this node's inner space.
		const childOwn = parseTransform(child.attrs.transform);
		for (const [cx, cy] of [[result.local[0], result.local[1]], [result.local[2], result.local[1]], [result.local[0], result.local[3]], [result.local[2], result.local[3]]]) {
			const [x, y] = apply(childOwn, cx, cy);
			grow(local, x, y);
		}
		grow(world, result.world[0], result.world[1]);
		grow(world, result.world[2], result.world[3]);
	}
	node.local = local;
	node.world = world;
	node.matrix = matrix;
	return { local, world };
}

// ---------------------------------------------------------------- code generation
const round = (v) => Math.round(v * 1000) / 1000;
const partName = (id) => RENAME[id] ?? id;
const meta = {};

function styleProps(style) {
	const props = {};
	for (const part of (style ?? "").split(";")) {
		const [k, v] = part.split(":").map((s) => s?.trim());
		if (!k) continue;
		const camel = k.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
		props[camel] = v;
	}
	return props;
}

function attrString(node) {
	const a = node.attrs;
	const props = { ...styleProps(a.style) };
	if (node.tag === "path") props.d = a.d;
	for (const k of ["cx", "cy", "r", "rx", "ry", "x", "y", "width", "height"]) if (a[k] !== undefined) props[k] = Number(a[k]);
	if (a.transform) props.transform = a.transform.replace(/matrix\(([^)]+)\)/, (_, v) => `matrix(${v.split(/[\s,]+/).join(" ")})`);
	return Object.entries(props).map(([k, v]) => typeof v === "number" ? `${k}={${v}}` : `${k}=${JSON.stringify(v)}`).join(" ");
}

const COMPONENT = { g: "G", path: "Path", circle: "Circle", ellipse: "Ellipse", rect: "Rect" };

function recordMeta(name, node, scaleSource) {
	const local = node.local;
	const world = node.world;
	const m = scaleSource.matrix;
	meta[name] = { box: local.map(round), world: world.map(round), scale: round(Math.hypot(m[0], m[1])) };
}

function emit(node, indent, suffix = "") {
	const pad = "\t".repeat(indent);
	const tag = COMPONENT[node.tag];
	if (!tag) throw new Error(`Unsupported element <${node.tag}>`);
	const id = node.attrs.id;
	const animated = id && PARTS.has(id) && node.tag === "g";
	let children = emitChildren(node, indent + 1, suffix);
	if (id === "main" && !suffix) children += "\n" + frontArms(indent + 1);
	if (animated) {
		const name = partName(id) + suffix;
		recordMeta(name, node, node);
		children = `${pad}\t<Part name="${name}">\n${children.replace(/^/gm, "\t")}\n${pad}\t</Part>`;
	}
	const attrs = attrString(node);
	if (!node.children.length) return `${pad}<${tag}${attrs ? " " + attrs : ""} />`;
	return `${pad}<${tag}${attrs ? " " + attrs : ""}>\n${children}\n${pad}</${tag}>`;
}

function emitChildren(node, indent, suffix) {
	const pad = "\t".repeat(indent);
	const out = [];
	const kids = node.children;
	for (let i = 0; i < kids.length; i++) {
		const group = SIBLING_GROUPS.find((g) => kids[i].attrs.id === g.ids[0]);
		if (group && !suffix) {
			const members = kids.slice(i, i + group.ids.length);
			if (members.map((k) => k.attrs.id).join() !== group.ids.join()) throw new Error(`Siblings for ${group.name} are not adjacent`);
			const wrapper = { local: emptyBox(), world: emptyBox(), matrix: node.matrix };
			for (const member of members) {
				const own = parseTransform(member.attrs.transform);
				for (const [x, y] of [[member.local[0], member.local[1]], [member.local[2], member.local[3]]]) grow(wrapper.local, ...apply(own, x, y));
				grow(wrapper.world, member.world[0], member.world[1]);
				grow(wrapper.world, member.world[2], member.world[3]);
			}
			recordMeta(group.name, wrapper, wrapper);
			out.push(`${pad}<Part name="${group.name}">\n${members.map((member) => emit(member, indent + 1, suffix)).join("\n")}\n${pad}</Part>`);
			i += group.ids.length - 1;
			continue;
		}
		out.push(emit(kids[i], indent, suffix));
	}
	return out.join("\n");
}

// ---------------------------------------------------------------- main
const svg = parseXml(readFileSync(source, "utf8"));
const viewBox = svg.attrs.viewBox.split(/\s+/).map(Number);
measure(svg, IDENTITY, {});

const findPath = (node, id) => {
	if (node.attrs.id === id) return [node];
	for (const child of node.children) {
		const found = findPath(child, id);
		if (found) return [node, ...found];
	}
	return null;
};
const bear = svg.children.find((c) => c.attrs.id === "bear1");
const mainPath = findPath(bear, "arms"); // bear1 > main > ... > arms

// Front copies of the arms: same chain of transforms as the original, drawn after the face so they cover it.
function frontArms(indent) {
	const pad = "	".repeat(indent);
	const mainIndex = mainPath.findIndex((n) => n.attrs.id === "main");
	const chain = mainPath.slice(mainIndex + 1); // transform groups down to and including "arms"
	const open = chain.map((n) => `<G${n.attrs.transform ? ` transform="${n.attrs.transform.replace(/matrix\(([^)]+)\)/, (_, v) => `matrix(${v.split(/[\s,]+/).join(" ")})`)}"` : ""}>`);
	const arms = chain[chain.length - 1];
	const copies = FRONT_COPIES.map((id) => emit(arms.children.find((c) => c.attrs.id === id), indent + 2, "F").replace(/ id="[^"]*"/g, ""));
	const lines = [`${pad}<Part name="frontArms">`, `${pad}\t${open.join("")}`, ...copies, `${pad}\t${open.map(() => "</G>").join("")}`, `${pad}</Part>`];
	return lines.join("\n");
}
let body = emit(bear, 3);

const metaOutput = `// Generated by scripts/generate-bear.mjs from assets/bear/bear.svg. Do not edit by hand.
export const BEAR_VIEW_BOX = ${JSON.stringify(viewBox)} as const;

export type PartMeta = { box: [number, number, number, number]; world: [number, number, number, number]; scale: number };

/** Bounding boxes: \`box\` in the part's own coordinates, \`world\` in viewBox coordinates. */
export const PART_META: Record<string, PartMeta> = ${JSON.stringify(meta, null, "\t")} as Record<string, PartMeta>;
`;
const output = `// Generated by scripts/generate-bear.mjs from assets/bear/bear.svg. Do not edit by hand.
import React from "react";
import { G, Path, Circle, Ellipse, Rect } from "react-native-svg";
import { Part } from "./Part";

function BearArtInner() {
	return (
		<>
${body}
		</>
	);
}

export const BearArt = React.memo(BearArtInner);
`;
writeFileSync(metaTarget, metaOutput);
writeFileSync(target, output);
console.log(`Wrote ${target} with ${Object.keys(meta).length} parts: ${Object.keys(meta).join(", ")}`);
console.log("bear world box", meta.bear.world);
