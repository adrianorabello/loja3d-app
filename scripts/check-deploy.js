const assert = require('node:assert/strict');

async function checkDeployment(baseUrl) {
    const origin = new URL(baseUrl);
    assert.ok(['http:', 'https:'].includes(origin.protocol), 'Use an HTTP(S) URL');

    async function get(path) {
        const url = new URL(path, origin);
        const response = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(20000) });
        console.log(`${response.status} ${url} (${response.headers.get('content-type')})`);
        return response;
    }

    const home = await get('/');
    assert.equal(home.status, 200, 'Home must return 200');
    assert.match(home.headers.get('content-type') || '', /^text\/html/i);
    assert.doesNotMatch(home.headers.get('cache-control') || '', /immutable/i);
    const html = await home.text();
    const assets = [...html.matchAll(/(?:src|href)=["']([^"']+\.(js|css)(?:\?[^"']*)?)["']/g)]
        .filter(match => new URL(match[1], origin).origin === origin.origin);
    assert.ok(assets.some(match => match[2] === 'js'), 'No local JavaScript bundles found in HTML');
    assert.ok(assets.some(match => match[2] === 'css'), 'No local stylesheets found in HTML');
    for (const [, path, extension] of assets) {
        const response = await get(path);
        assert.equal(response.status, 200, `Missing asset: ${path}`);
        assert.match(response.headers.get('content-type') || '',
            extension === 'js' ? /^(application|text)\/(javascript|ecmascript)/i : /^text\/css/i,
            `Wrong MIME type: ${path}`);
        assert.doesNotMatch((await response.text()).slice(0, 200), /^\s*<!doctype html/i, `HTML returned for ${path}`);
    }
    const deepLink = await get('/admin/products');
    assert.equal(deepLink.status, 200, 'Angular deep link must return 200');
    assert.match(deepLink.headers.get('content-type') || '', /^text\/html/i);
    assert.doesNotMatch(deepLink.headers.get('cache-control') || '', /immutable/i);
    const unique = Date.now();
    for (const path of [
        `/missing-${unique}.js`, `/styles.${unique.toString(16)}deadbeef.css`,
        `/assets/i18n/missing-${unique}.json`
    ]) {
        const response = await get(path);
        assert.equal(response.status, 404, `Missing file must return 404, not index.html: ${path}`);
        assert.match(response.headers.get('cache-control') || '', /no-store/i, `Missing file must not be cached: ${path}`);
    }
    console.log('Deployment checks passed.');
}

checkDeployment(process.argv[2] || 'https://www.printoy3d.com').catch(error => {
    console.error(`[check-deploy] ${error.message}`);
    process.exitCode = 1;
});
