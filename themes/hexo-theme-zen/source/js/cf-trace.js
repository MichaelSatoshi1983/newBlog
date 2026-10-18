(function () {
    var list = document.getElementById('trace-list');
    if (!list) return;
    var commitSha = list.getAttribute('data-version') || '';

    var traceFields = [
        ['fl', 'Cloudflare 实例标识'],
        ['h', '主机名'],
        ['ip', '访问者 IP'],
        ['ts', '时间戳'],
        ['visit_scheme', '访问协议'],
        ['uag', '浏览器标识'],
        ['colo', 'Cloudflare 接入机房'],
        ['sliver', '发布分组'],
        ['http', 'HTTP 版本'],
        ['loc', '访问地区'],
        ['tls', 'TLS 版本'],
        ['sni', 'SNI 模式'],
        ['warp', 'WARP 状态'],
        ['gateway', 'Gateway 状态'],
        ['rbi', '远程浏览器隔离状态'],
        ['kex', '密钥交换算法']
    ];
    var workerFields = [
        ['asn', 'ASN'],
        ['asOrganization', '网络组织'],
        ['continent', '访问大洲'],
        ['city', 'IP 定位城市'],
        ['region', 'IP 定位地区'],
        ['timezone', '访问者时区'],
        ['clientTcpRtt', 'TCP 往返时延'],
        ['clientQuicRtt', 'QUIC 往返时延'],
        ['cfRay', 'CF-Ray 请求标识'],
        ['cacheStatus', '页面缓存状态']
    ];
    var labels = {};
    traceFields.forEach(function (field) { labels[field[0]] = field[1]; });

    var traceValues = {};
    var workerValues = {};
    var traceAvailable = false;
    var workerAvailable = false;
    var cacheStatus = null;
    var cacheStatusAvailable = false;

    function displayValue(key, value, available) {
        if (!available || value === undefined || value === null || value === '') return 'N/A';
        if (key === 'asn') return 'AS' + value;
        if (key === 'clientTcpRtt' || key === 'clientQuicRtt') return value + ' ms';
        return String(value);
    }

    function render() {
        list.textContent = '';
        traceFields.forEach(function (field) {
            var item = document.createElement('li');
            item.textContent = field[1] + '\uFF1A' + displayValue(field[0], traceValues[field[0]], traceAvailable);
            list.appendChild(item);
        });

        workerFields.forEach(function (field) {
            var available = field[0] === 'cacheStatus' ? cacheStatusAvailable : workerAvailable;
            var value = field[0] === 'cacheStatus' ? cacheStatus : workerValues[field[0]];
            var item = document.createElement('li');
            item.textContent = field[1] + '\uFF1A' + displayValue(field[0], value, available);
            list.appendChild(item);
        });

        Object.keys(traceValues).forEach(function (key) {
            if (Object.prototype.hasOwnProperty.call(labels, key)) return;
            var item = document.createElement('li');
            item.textContent = key + '\uFF1A' + traceValues[key];
            list.appendChild(item);
        });

        var versionItem = document.createElement('li');
        versionItem.appendChild(document.createTextNode('\u7248\u672c\uFF1A'));
        if (/^[a-f0-9]{40}$/i.test(commitSha)) {
            var commitLink = document.createElement('a');
            commitLink.href = 'https://github.com/MichaelSatoshi1983/newBlog/commit/' + commitSha;
            commitLink.target = '_blank';
            commitLink.rel = 'noopener';
            commitLink.textContent = commitSha.slice(0, 7);
            versionItem.appendChild(commitLink);
        } else {
            versionItem.appendChild(document.createTextNode('N/A'));
        }
        list.appendChild(versionItem);
    }

    render();

    fetch('/cdn-cgi/trace', { cache: 'no-store' })
        .then(function (response) {
            if (!response.ok) throw new Error('Trace request failed');
            return response.text();
        })
        .then(function (trace) {
            trace.trim().split(/\r?\n/).filter(Boolean).forEach(function (line) {
                var separator = line.indexOf('=');
                if (separator < 0) return;
                traceValues[line.slice(0, separator)] = line.slice(separator + 1);
            });
            traceAvailable = Object.keys(traceValues).length > 0;
            render();
        })
        .catch(function () {
            traceAvailable = false;
            render();
        });

    fetch('/api/about-website-info', { cache: 'no-store' })
        .then(function (response) {
            if (!response.ok) throw new Error('Cloudflare metadata request failed');
            return response.json();
        })
        .then(function (info) {
            workerValues = info || {};
            workerAvailable = true;
            render();
        })
        .catch(function () {
            workerAvailable = false;
            render();
        });

    fetch(window.location.href, { method: 'HEAD', cache: 'reload' })
        .then(function (response) {
            cacheStatus = response.headers.get('cf-cache-status');
            cacheStatusAvailable = true;
            render();
        })
        .catch(function () {
            cacheStatusAvailable = false;
            render();
        });
})();
