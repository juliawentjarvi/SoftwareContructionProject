export interface IdlePolicy {
	breathing: boolean;
	blinking: boolean;
	earWaves: boolean;
	bored: boolean;
}

/** Which idle animations run. Taps and feeding always react and are not controlled here. */
export function idlePolicy(animate: boolean): IdlePolicy {
	return { breathing: animate, blinking: animate, earWaves: animate, bored: animate };
}
