import React from "react";
import { Image, StyleSheet, Text, View } from "react-native";

/** The person's picture, or their initial on a green circle when they have not chosen one. */
export default function Avatar({ image, name, size = 40 }: { image: string | null; name: string; size?: number }) {
	const round = { width: size, height: size, borderRadius: size / 2 };
	if (image) return <Image accessibilityLabel="Your profile picture" source={{ uri: image }} style={[styles.image, round]} />;
	return <View style={[styles.initial, round]}><Text style={[styles.initialText, { fontSize: size * 0.4 }]}>{name.slice(0, 1).toUpperCase()}</Text></View>;
}

const styles = StyleSheet.create({
	image: { backgroundColor: "#dce5dc" },
	initial: { backgroundColor: "#315b49", justifyContent: "center", alignItems: "center" },
	initialText: { color: "#fff", fontWeight: "800" },
});
