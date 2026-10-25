import React, { createContext, useContext, useSyncExternalStore } from "react";
import { G } from "react-native-svg";
import { PoseStore } from "./poseStore";
import { partOpacity, partTransform } from "./pose";

const restingStore = new PoseStore();
export const PoseStoreContext = createContext<PoseStore>(restingStore);

/** Wraps a named piece of the bear artwork and applies that piece's current animation pose. Re-renders only when it changes. */
export function Part({ name, children }: { name: string; children?: React.ReactNode }) {
	const store = useContext(PoseStoreContext);
	const pose = useSyncExternalStore(
		(listener) => store.subscribe(name, listener),
		() => store.get(name),
		() => undefined,
	);
	return <G transform={partTransform(name, pose)} opacity={partOpacity(name, pose)}>{children}</G>;
}
