(function (global) {
    'use strict';

    const BLOCKED_KEYS = new Set(['__proto__', 'prototype', 'constructor']);
    const PATH_RE = /^[A-Za-z_$][A-Za-z0-9_$]*(?:\.[A-Za-z_$][A-Za-z0-9_$]*)*$/;
    const NUMBER_RE = /^-?(?:\d+\.?\d*|\.\d+)$/;
    const handlerCache = new Map();

    function splitTopLevel(input, delimiter) {
        const out = [];
        let start = 0;
        let quote = null;
        let escaped = false;
        let parenDepth = 0;
        let bracketDepth = 0;
        let braceDepth = 0;

        for (let i = 0; i < input.length; i += 1) {
            const ch = input[i];

            if (quote) {
                if (escaped) {
                    escaped = false;
                    continue;
                }
                if (ch === '\\') {
                    escaped = true;
                    continue;
                }
                if (ch === quote) quote = null;
                continue;
            }

            if (ch === '"' || ch === '\'') {
                quote = ch;
                continue;
            }

            if (ch === '(') {
                parenDepth += 1;
                continue;
            }
            if (ch === ')' && parenDepth > 0) {
                parenDepth -= 1;
                continue;
            }
            if (ch === '[') {
                bracketDepth += 1;
                continue;
            }
            if (ch === ']' && bracketDepth > 0) {
                bracketDepth -= 1;
                continue;
            }
            if (ch === '{') {
                braceDepth += 1;
                continue;
            }
            if (ch === '}' && braceDepth > 0) {
                braceDepth -= 1;
                continue;
            }

            if (
                ch === delimiter &&
                parenDepth === 0 &&
                bracketDepth === 0 &&
                braceDepth === 0
            ) {
                out.push(input.slice(start, i));
                start = i + 1;
            }
        }

        out.push(input.slice(start));
        return out;
    }

    function decodeQuoted(token) {
        const quote = token[0];
        let out = '';

        for (let i = 1; i < token.length - 1; i += 1) {
            const ch = token[i];
            if (ch !== '\\' || i >= token.length - 2) {
                out += ch;
                continue;
            }

            i += 1;
            const escaped = token[i];
            if (escaped === 'n') out += '\n';
            else if (escaped === 'r') out += '\r';
            else if (escaped === 't') out += '\t';
            else if (escaped === quote) out += quote;
            else if (escaped === '\\') out += '\\';
            else out += escaped;
        }

        return out;
    }

    function getPathParts(path) {
        if (!PATH_RE.test(path)) {
            throw new Error(`Unsupported expression "${path}"`);
        }

        const parts = path.split('.');
        if (parts.some((part) => BLOCKED_KEYS.has(part))) {
            throw new Error(`Blocked expression "${path}"`);
        }

        return parts;
    }

    function resolvePathValue(path, thisArg, event) {
        const parts = getPathParts(path);
        let context = global;
        let idx = 0;

        if (parts[0] === 'window') {
            context = global;
            idx = 1;
        } else if (parts[0] === 'this') {
            context = thisArg;
            idx = 1;
        } else if (parts[0] === 'event') {
            context = event;
            idx = 1;
        }

        if (idx >= parts.length) return context;

        for (let i = idx; i < parts.length; i += 1) {
            if (context == null) return undefined;
            context = context[parts[i]];
        }
        return context;
    }

    function resolveCallable(path, thisArg, event) {
        const parts = getPathParts(path);
        let context = global;
        let idx = 0;

        if (parts[0] === 'window') {
            context = global;
            idx = 1;
        } else if (parts[0] === 'this') {
            context = thisArg;
            idx = 1;
        } else if (parts[0] === 'event') {
            context = event;
            idx = 1;
        }

        if (idx >= parts.length) return null;

        for (let i = idx; i < parts.length - 1; i += 1) {
            if (context == null) return null;
            context = context[parts[i]];
        }
        if (context == null) return null;

        const fn = context[parts[parts.length - 1]];
        if (typeof fn !== 'function') return null;
        return { fn, context };
    }

    function parseArgument(rawArg, thisArg, event) {
        const token = String(rawArg || '').trim();
        if (!token) return undefined;

        const first = token[0];
        const last = token[token.length - 1];
        if ((first === '"' || first === '\'') && first === last && token.length >= 2) {
            return decodeQuoted(token);
        }

        if (NUMBER_RE.test(token)) return Number(token);
        if (token === 'true') return true;
        if (token === 'false') return false;
        if (token === 'null') return null;
        if (token === 'undefined') return undefined;

        return resolvePathValue(token, thisArg, event);
    }

    function compileInternal(code) {
        const source = String(code || '').trim();
        const statements = splitTopLevel(source, ';')
            .map((entry) => entry.trim())
            .filter(Boolean);

        return function compiledDelegatedHandler(event) {
            let lastResult;

            for (let i = 0; i < statements.length; i += 1) {
                const statement = statements[i];
                if (!statement) continue;
                if (statement === 'return false') return false;
                if (statement === 'return true') return true;

                const callMatch = statement.match(
                    /^([A-Za-z_$][A-Za-z0-9_$]*(?:\.[A-Za-z_$][A-Za-z0-9_$]*)*)\s*\(([\s\S]*)\)$/
                );
                if (!callMatch) {
                    throw new Error(`Unsupported delegated statement: "${statement}"`);
                }

                const callPath = callMatch[1];
                const argSource = callMatch[2].trim();
                const callable = resolveCallable(callPath, this, event);
                if (!callable) {
                    throw new Error(`Unknown delegated handler: "${callPath}"`);
                }

                const args = argSource
                    ? splitTopLevel(argSource, ',').map((raw) => parseArgument(raw, this, event))
                    : [];

                lastResult = callable.fn.apply(callable.context, args);
                if (lastResult === false) return false;
            }

            return lastResult;
        };
    }

    function compile(code) {
        const key = String(code || '');
        if (!handlerCache.has(key)) {
            handlerCache.set(key, compileInternal(key));
        }
        return handlerCache.get(key);
    }

    function run(el, attrName, event) {
        if (!el || typeof el.getAttribute !== 'function') return undefined;
        const code = el.getAttribute(attrName);
        if (!code) return undefined;
        const handler = compile(code);
        return handler.call(el, event);
    }

    global.RTF_DELEGATED_HANDLER = {
        compile,
        run
    };
})(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this));
