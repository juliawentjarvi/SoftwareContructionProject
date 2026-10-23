import React, { useCallback, useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Pressable, View } from "react-native";
import Svg from "react-native-svg";
import { BearArt } from "./BearArt.generated";
import { BORED_BEHAVIORS, BearAnimator, Clip, TAP_REACTIONS, blink, earWave, feedJump, hearts } from "./animation";
import { PoseContext } from "./Part";
import type { Pose } from "./pose";

// Visible region: the bear plus room to jump and for hearts to float up.
const VIEW_BOX = "134 440 813 1100";
const ASPECT = 813 / 1100;
const FRAME_MS = 33;

const pick = <T,>(items: T[]): T => items[Math.floor(Math.random() * items.length)];
const between = (min: number, max: number) => min + Math.random() * (max - min);

export type BearProps = {
	height?: number;
	/** Increment to play the feed reaction (jump, wave, hearts). */
	feedSignal?: number;
	/** Increment to play one of the tap reactions, e.g. when the game is clicked. */
	emoteSignal?: number;
	/** Seconds without interaction before the bear gets bored. */
	boredAfterSeconds?: number;
};

export function Bear({ height = 250, feedSignal = 0, emoteSignal = 0, boredAfterSeconds = 30 }: BearProps) {
	const animator = useRef(new BearAnimator()).current;
	const [pose, setPose] = useState<Pose>({});
	const reduceMotion = useRef(false);
	const lastInteraction = useRef(Date.now());
	const clock = useRef(() => Date.now() / 1000).current;

	const play = useCallback((clip: Clip) => animator.start(clip, clock()), [animator, clock]);
	const interact = useCallback(() => { lastInteraction.current = Date.now(); }, []);
	const react = useCallback(() => { interact(); play(pick(TAP_REACTIONS)()); }, [interact, play]);

	// Frame loop: sample the animator ~30 times a second.
	useEffect(() => {
		let frame = 0;
		let last = 0;
		const loop = (time: number) => {
			if (time - last >= FRAME_MS) {
				last = time;
				setPose(animator.sample(clock()));
			}
			frame = requestAnimationFrame(loop);
		};
		frame = requestAnimationFrame(loop);
		return () => cancelAnimationFrame(frame);
	}, [animator, clock]);

	// Autonomous behavior: blinking, ear waves, and boredom.
	useEffect(() => {
		let cancelled = false;
		const timers: ReturnType<typeof setTimeout>[] = [];
		const schedule = (fn: () => void, min: number, max: number) => {
			const timer = setTimeout(() => { if (!cancelled) fn(); }, between(min, max) * 1000);
			timers.push(timer);
		};
		const blinkLoop = () => {
			if (!reduceMotion.current) {
				play(blink());
				if (Math.random() < 0.25) setTimeout(() => { if (!cancelled) play(blink()); }, 330);
			}
			schedule(blinkLoop, 2.2, 5.5);
		};
		const earLoop = () => {
			if (!reduceMotion.current) play(earWave(Math.random() < 0.5 ? "left" : "right"));
			schedule(earLoop, 8, 20);
		};
		const boredLoop = () => {
			const idle = (Date.now() - lastInteraction.current) / 1000;
			if (!reduceMotion.current && idle >= boredAfterSeconds && !animator.isPlaying("body")) {
				play(pick(BORED_BEHAVIORS)());
				lastInteraction.current = Date.now() - (boredAfterSeconds - 12) * 1000; // repeat roughly every 12–20 s while idle
			}
			schedule(boredLoop, 4, 8);
		};
		void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
			reduceMotion.current = enabled;
			animator.breathing = !enabled;
		}).catch(() => undefined);
		schedule(blinkLoop, 1, 3);
		schedule(earLoop, 5, 10);
		schedule(boredLoop, 4, 8);
		return () => { cancelled = true; timers.forEach(clearTimeout); };
	}, [animator, play, boredAfterSeconds]);

	const feedMounted = useRef(feedSignal);
	useEffect(() => {
		if (feedSignal === feedMounted.current) return;
		feedMounted.current = feedSignal;
		interact();
		play(feedJump());
		play(hearts());
	}, [feedSignal, interact, play]);

	const emoteMounted = useRef(emoteSignal);
	useEffect(() => {
		if (emoteSignal === emoteMounted.current) return;
		emoteMounted.current = emoteSignal;
		react();
	}, [emoteSignal, react]);

	return (
		<Pressable onPress={react} accessibilityRole="button" accessibilityLabel="Bear. Tap to say hi." style={{ height, width: height * ASPECT }}>
			<View pointerEvents="none" style={{ flex: 1 }}>
				<PoseContext.Provider value={pose}>
					<Svg width="100%" height="100%" viewBox={VIEW_BOX} fillRule="evenodd">
						<BearArt />
					</Svg>
				</PoseContext.Provider>
			</View>
		</Pressable>
	);
}
