import { deepStrictEqual, strictEqual } from "node:assert";
import { describe, it } from "node:test";
import {
    normSchema,
    parseUri,
    removeDotSegments,
    resolveUrl
} from "./norm-schema.mjs";

describe("removeDotSegments", () => {
    it("handles urls without dots", () => {
        strictEqual(
            removeDotSegments("http://example.com"),
            "http://example.com"
        );
    });

    it("removes dots", () => {
        strictEqual(
            removeDotSegments("../moo/../../cow/./test/../test2"),
            "cow/test2"
        );
    });

    it("works with leading slash", () => {
        strictEqual(
            removeDotSegments("/../moo/../../cow/./test/../test2"),
            "/cow/test2"
        );
    });

    it('handles Windows paths with backslashes', () => {
        strictEqual(
            removeDotSegments('C:\\path\\.\\to\\..\\file.txt'),
            'C:\\path\\file.txt'
        );
    });

    it('handles Windows paths with backslashes and too many dots', () => {
        strictEqual(
            removeDotSegments('C:\\path\\..\\..\\..\\..\\to\\..\\file.txt'),
            'C:\\file.txt'
        );
    });
});

describe("parseUri", () => {
    it("parses a uri", () => {
        const uri = "http://example.com/path/to/file.txt?query=string#fragment";
        const parsed = parseUri(uri);
        deepStrictEqual(parsed, {
            href: uri,
            protocol: "http:",
            authority: "//example.com",
            host: "example.com",
            hostname: "example.com",
            port: "",
            pathname: "/path/to/file.txt",
            search: "?query=string",
            hash: "#fragment"
        });
    });

    it("parses a file path", () => {
        const uri = "/path/to/file.txt";
        const parsed = parseUri(uri);
        deepStrictEqual(parsed, {
            href: uri,
            protocol: "",
            authority: "",
            host: "",
            hostname: "",
            port: "",
            pathname: "/path/to/file.txt",
            search: "",
            hash: ""
        });
    });

    it("handles a Windows file path with backslashes", () => {
        const uri = "C:\\path\\to\\file.txt";
        const parsed = parseUri(uri);
        deepStrictEqual(parsed, {
            href: uri,
            protocol: "C:",
            authority: "",
            host: "",
            hostname: "",
            port: "",
            pathname: "\\path\\to\\file.txt",
            search: "",
            hash: ""
        });
    });

    it("handles a Windows file path with forward slashes", () => {
        const uri = "C:/path/to/file.txt";
        const parsed = parseUri(uri);
        deepStrictEqual(parsed, {
            href: uri,
            protocol: "C:",
            authority: "",
            host: "",
            hostname: "",
            port: "",
            pathname: "/path/to/file.txt",
            search: "",
            hash: ""
        });
    });
});

describe("resolveUrl", () => {
    it("resolves a relative url", () => {
        const base = "http://example.com/path/to/file.txt";
        const href = "../relative/schema.json";
        const resolved = resolveUrl(base, href);
        strictEqual(resolved, "http://example.com/path/relative/schema.json");
    });

    it("resolves a relative url with excessive dots", () => {
        const base = "http://example.com/path/to/file.txt";
        const href = ".././.././.././relative/schema.json";
        const resolved = resolveUrl(base, href);
        strictEqual(resolved, "http://example.com/relative/schema.json");
    });

    it("resolves an absolute URL", () => {
        const base = "http://example.com/path/to/file.txt";
        const href = "https://example.net/absolute/schema.json";
        const resolved = resolveUrl(base, href);
        strictEqual(resolved, href);
    });

    it("resolves an absolute URL with excessive dots", () => {
        const base = "http://example.com/path/to/file.txt";
        const href =
            "https://example.net/absolute/../../././../.././schema.json";
        const resolved = resolveUrl(base, href);

        // Technically this is incorrect because one could send the dots to the
        // server, but in practice this is what would be expected.
        strictEqual(resolved, "https://example.net/schema.json");
    });

    it("resolves an absolute file path on Windows", () => {
        const base = "C:\\path\\to\\file.txt";
        const href = "D:\\shared\\schema.json";
        const resolved = resolveUrl(base, href);
        strictEqual(resolved, href);
    });

    it("resolves a relative file path (*nix style) on Windows", () => {
        const base = "C:\\path\\to\\file.txt";
        const href = "../shared/schema.json";
        const resolved = resolveUrl(base, href);
        strictEqual(resolved, "C:\\path\\shared\\schema.json");
    });
});

describe("normSchema", () => {
    it("resolves a schema id to be absolute", () => {
        const schema = {
            id: "../test/x.json",
        };
        const baseUri = "http://example.com/path/to/schema.json";
        normSchema(schema, baseUri);
        deepStrictEqual(schema, {
            id: "http://example.com/path/test/x.json",
        });
    });

    it("resolves a schema relative $ref", () => {
        const schema = {
            other: {
                $ref: "../shared/other.json"
            }
        };
        const baseUri = "http://example.com/path/to/schema.json";
        normSchema(schema, baseUri);
        deepStrictEqual(schema, {
            other: {
                $ref: "http://example.com/path/shared/other.json"
            }
        });
    });

    it("resolves a schema relative $ref on Windows", () => {
        const schema = {
            other: {
                $ref: "../shared/other.json"
            }
        };
        const baseUri = "C:\\Users\\test\\repo\\schemas\\target\\base.json";
        normSchema(schema, baseUri);
        deepStrictEqual(schema, {
            other: {
                $ref: "C:\\Users\\test\\repo\\schemas\\shared\\other.json"
            }
        });
    });
});
