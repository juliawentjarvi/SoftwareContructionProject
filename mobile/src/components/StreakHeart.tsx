import React, { useEffect, useRef } from "react";
import { Animated, Platform } from "react-native";
import Svg, { Path } from "react-native-svg";
import { HEARTBEAT, streakColor } from "../services/streakHeart";

const HEART = "M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z";

/** Heart-shaped streak indicator: its colour follows the rainbow with each day of the streak, and it beats when the app is entered. */
export default function StreakHeart({ days, size = 40, beatKey }: { days: number; size?: number; beatKey: number }) {
	const scale = useRef(new Animated.Value(1)).current;

	useEffect(() => {
		const beat = Animated.sequence(HEARTBEAT.map((step) => Animated.timing(scale, { toValue: step.scale, duration: step.ms, useNativeDriver: Platform.OS !== "web" })));
		beat.start();
		return () => beat.stop();
	}, [beatKey, scale]);

	return (
		<Animated.View accessibilityRole="image" accessibilityLabel={`Streak heart: ${days} day${days === 1 ? "" : "s"}`} style={{ transform: [{ scale }] }}>
			<Svg width={size} height={size} viewBox="0 0 24 24">
				<Path d={HEART} fill={streakColor(days)} />
			</Svg>
		</Animated.View>
	);
}
