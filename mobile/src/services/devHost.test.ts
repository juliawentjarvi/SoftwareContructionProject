import { describe, expect, it } from "vitest";
import { apiBaseFromHost } from "./devHost";

describe("apiBaseFromHost", () => {
	it("points at the machine serving the app, on the API port", () => {
		expect(apiBaseFromHost("192.168.1.23:8081")).toBe("http://192.168.1.23:3000/api");
		expect(apiBaseFromHost("exp://130.232.171.89:8081")).toBe("http://130.232.171.89:3000/api");
		expect(apiBaseFromHost("localhost")).toBe("http://localhost:3000/api");
		expect(apiBaseFromHost("my-laptop.local:8081/path")).toBe("http://my-laptop.local:3000/api");
	});

	it("gives up for tunnel hosts and missing or malformed values", () => {
		expect(apiBaseFromHost("abc-123.exp.direct:80")).toBeNull();
		expect(apiBaseFromHost("x.ngrok-free.app")).toBeNull();
		expect(apiBaseFromHost("")).toBeNull();
		expect(apiBaseFromHost(undefined)).toBeNull();
		expect(apiBaseFromHost("bad host")).toBeNull();
	});
});
