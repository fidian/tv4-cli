// Normalize a schema before passing it to tv4 because tv4 does not support
// Windows paths properly.

export function normSchema(schema, baseUri) {
    if (schema && typeof schema === "object") {
        if (baseUri === undefined) {
            baseUri = schema.id;
        } else if (typeof schema.id === "string") {
            baseUri = resolveUrl(baseUri, schema.id);
            schema.id = baseUri;
        }

        if (Array.isArray(schema)) {
            for (var i = 0; i < schema.length; i++) {
                normSchema(schema[i], baseUri);
            }
        } else {
            if (typeof schema["$ref"] === "string") {
                schema["$ref"] = resolveUrl(baseUri, schema["$ref"]);
            }

            for (var key in schema) {
                if (key !== "enum") {
                    normSchema(schema[key], baseUri);
                }
            }
        }
    }
}

export function removeDotSegments(input) {
    const pathSeparator = getPathSeparator(input);
    const pathSegments = splitPath(input);
    const result = [];
    let prefix = '';

    if (pathSegments[0] === '') {
        prefix = pathSeparator;
        pathSegments.shift();
    }

    if (pathSegments[0].match(/^[A-Za-z]:$/)) {
        prefix = pathSegments.shift() + pathSeparator;
    }

    for (const segment of pathSegments) {
        if (segment === '..') {
            result.pop();
        } else if (segment !== '.') {
            result.push(segment);
        }
    }

    return prefix + result.join(pathSeparator);
}

export function resolveUrl(base, href) {
    // RFC 3986
    href = parseUri(href || "");
    base = parseUri(base || "");

    if (!href || !base) {
        return null;
    }

    const result = { ...base, hash: href.hash };

    if (href.protocol) {
        result.protocol = href.protocol;
        result.authority = href.authority;
        result.pathname = href.pathname;
        result.search = href.search;
    } else if (href.authority) {
        result.authority = href.authority;
        result.pathname = href.pathname;
        result.search = href.search;
    } else if (isRootRelative(href.pathname)) {
        result.pathname = href.pathname;
        result.search = href.search;
    } else if (href.pathname) {
        const relativeFrom = splitPath(base.pathname || (base.authority ? "/" : ""));
        relativeFrom.pop();
        relativeFrom.push(...splitPath(href.pathname));
        result.pathname = relativeFrom.join(getPathSeparator(base.pathname));
        result.search = href.search;
    } else if (href.search) {
        result.search = href.search;
        result.hash = href.hash;
    }

    return `${result.protocol}${result.authority}${removeDotSegments(result.pathname)}${result.search}${result.hash}`;
}

export function parseUri(url) {
    const m = `${url}`
        .trim()
        .match(
            /^([^:\/?#]+:)?(\/\/(?:[^:@]*(?::[^:@]*)?@)?(([^:\/?#]*)(?::(\d*))?))?([^?#]*)(\?[^#]*)?(#[\s\S]*)?/
        );
    // authority = '//' + user + ':' + pass '@' + hostname + ':' port
    return m
        ? {
              href: m[0] || "",
              protocol: m[1] || "",
              authority: m[2] || "",
              host: m[3] || "",
              hostname: m[4] || "",
              port: m[5] || "",
              pathname: m[6] || "",
              search: m[7] || "",
              hash: m[8] || ""
          }
        : null;
}

export function splitPath(path) {
    return path.split(/\/|\\/);
}

export function isRootRelative(path) {
    return path.startsWith('/') || path.startsWith('\\');
}

export function getPathSeparator(path) {
    return path.includes('\\') ? '\\' : '/';
}
