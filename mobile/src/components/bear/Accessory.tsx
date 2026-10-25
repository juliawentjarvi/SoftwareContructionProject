import React from "react";
import { Circle, Ellipse, G, Path, Polygon, Rect } from "react-native-svg";

/** Appearance options drawn over the bear, in the artwork's coordinates (the head is centred near x 540, eyes near y 915). */
export function Accessory({ kind }: { kind: string | null | undefined }) {
	if (kind === "party-hat") {
		return (
			<G transform="rotate(-9 540 725)">
				<Polygon points="540,520 440,735 640,735" fill="#7b5ad8" />
				<Polygon points="540,520 500,606 580,606" fill="#f4c542" />
				<Polygon points="478,670 602,670 622,704 458,704" fill="#f4c542" opacity="0.9" />
				<Circle cx={540} cy={514} r={26} fill="#ff7fa8" />
			</G>
		);
	}
	if (kind === "bow") {
		return (
			<G>
				<Path d="M540 1118 L438 1062 Q420 1118 438 1176 Z" fill="#d6455a" />
				<Path d="M540 1118 L642 1062 Q660 1118 642 1176 Z" fill="#d6455a" />
				<Rect x={516} y={1090} width={48} height={56} rx={18} fill="#a8283c" />
			</G>
		);
	}
	if (kind === "sunglasses") {
		return (
			<G>
				<Path d="M298 880 L250 850 M782 884 L830 854" stroke="#111" strokeWidth={14} strokeLinecap="round" />
				<Ellipse cx={395} cy={915} rx={104} ry={66} fill="#101418" />
				<Ellipse cx={685} cy={918} rx={104} ry={66} fill="#101418" />
				<Rect x={480} y={896} width={120} height={16} rx={8} fill="#101418" />
				<Ellipse cx={355} cy={890} rx={34} ry={14} fill="#ffffff" opacity={0.35} transform="rotate(-18 355 890)" />
				<Ellipse cx={645} cy={893} rx={34} ry={14} fill="#ffffff" opacity={0.35} transform="rotate(-18 645 893)" />
			</G>
		);
	}
	return null;
}
