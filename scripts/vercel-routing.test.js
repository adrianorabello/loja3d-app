const assert = require('node:assert/strict');
const test = require('node:test');
const config = require('../vercel.json');

// Model route ordering, with a supplied deployment file inventory.
function resolve(path, files = []) {
    const headers = {};
    for (const route of config.routes) {
        if (route.handle === 'filesystem') {
            if (files.includes(path)) return { status: 200, dest: path, headers };
            continue;
        }
        if (!new RegExp(`^${route.src}$`).test(path)) continue;
        Object.assign(headers, route.headers);
        if (!route.continue) return { status: route.status || 200, dest: route.dest, headers };
    }
    throw new Error(`No route matched ${path}`);
}

test('explicit routes do not mix incompatible rewrites, redirects or headers', () => {
    for (const key of ['rewrites', 'redirects', 'headers', 'cleanUrls', 'trailingSlash']) {
        assert.equal(config[key], undefined);
    }
    assert.ok(config.routes.some(route => route.handle === 'filesystem'));
});

test('existing bundles are served from the filesystem with immutable cache', () => {
    for (const path of ['/runtime.a3cd8a75520fa3a38ba0.js', '/styles.54aa9fdb22849e53be1f.css']) {
        const result = resolve(path, [path]);
        assert.equal(result.status, 200);
        assert.equal(result.dest, path);
        assert.match(result.headers['Cache-Control'], /immutable/);
        assert.equal(result.headers['X-Content-Type-Options'], 'nosniff');
    }
});

test('missing assets return 404 and override any immutable or translation cache', () => {
    for (const path of [
        '/missing.js', '/runtime.0123456789abcdef.js', '/styles.0123456789abcdef.css',
        '/assets/i18n/missing.json', '/assets/icons/missing.svg', '/assets/missing',
        '/assets', '/favicon.ico', '/nested/missing.js'
    ]) {
        const result = resolve(path);
        assert.equal(result.status, 404, path);
        assert.equal(result.dest, undefined, path);
        assert.equal(result.headers['Cache-Control'], 'no-store', path);
    }
});

test('Angular navigation still receives index.html without immutable cache', () => {
    for (const path of ['/', '/admin/products', '/admin/products/new', '/account/profile', '/sign-in', '/products/dinosaur']) {
        const result = resolve(path);
        assert.equal(result.status, 200, path);
        assert.equal(result.dest, '/index.html', path);
        assert.equal(result.headers['Cache-Control'], 'no-cache', path);
    }
});

test('HTML, unhashed assets and translations have revalidatable cache policies', () => {
    for (const path of ['/index.html', '/assets/styles/splash-screen.css', '/assets/fonts/inter/inter.css', '/assets/icons/heroicons-outline.svg']) {
        assert.equal(resolve(path, [path]).headers['Cache-Control'], 'no-cache', path);
    }
    const path = '/assets/i18n/pt.json';
    assert.equal(resolve(path, [path]).headers['Cache-Control'], 'public, max-age=300');
});
