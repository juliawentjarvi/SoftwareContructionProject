/** Percentage (0 to 100) of the daily meal target reached by `mealCount` meals. */
export function goalBarFill(mealCount: number, goal: number): number {
	if (!Number.isFinite(mealCount) || !Number.isFinite(goal) || goal <= 0) return 0;
	return Math.min(100, Math.max(0, (mealCount / goal) * 100));
}

export function goalBarLabel(mealCount: number, goal: number): string {
	return `${mealCount}/${goal}`;
}
