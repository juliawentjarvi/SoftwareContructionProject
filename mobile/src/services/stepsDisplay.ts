const number = (n: number) => n.toLocaleString("en-US");

/** Today's steps against the target. Missing step information is never shown as zero or as a met target. */
export function stepsLabel(steps: number | null, target: number | null): string {
	if (steps === null) return "No steps entered today";
	if (target === null) return `${number(steps)} steps (no step target set)`;
	return `${number(steps)} / ${number(target)} steps${steps >= target ? " - target reached" : ""}`;
}

export function energyLabel(energy: { points: number; target: number; fill?: number }): string {
	return `${energy.points}/${energy.target} energy`;
}
