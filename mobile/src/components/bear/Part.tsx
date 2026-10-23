import React, { createContext, useContext } from "react";
import { G } from "react-native-svg";
import { partOpacity, partTransform, Pose } from "./pose";

export const PoseContext = createContext<Pose>({});

/** Wraps a named piece of the bear artwork and applies that piece's current animation pose. */
export function Part({ name, children }: { name: string; children?: React.ReactNode }) {
	const pose = useContext(PoseContext)[name];
	const opacity = partOpacity(name, pose);
	return <G transform={partTransform(name, pose)} opacity={opacity}>{children}</G>;
}
