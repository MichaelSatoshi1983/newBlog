(function () {
    var list = document.getElementById('trace-list');
    if (!list) return;
    var commitSha = list.getAttribute('data-version') || '';

    var fields = [
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
    var labels = {};
    fields.forEach(function (field) { labels[field[0]] = field[1]; });

    function render(values, available) {
        list.textContent = '';
        fields.forEach(function (field) {
            var item = document.createElement('li');
            item.textContent = field[1] + '\uFF1A' + (available && Object.prototype.hasOwnProperty.call(values, field[0]) ? values[field[0]] : 'N/A');
            list.appendChild(item);
        });
        Object.keys(values).forEach(function (key) {
            if (Object.prototype.hasOwnProperty.call(labels, key)) return;
            var item = document.createElement('li');
            item.textContent = key + '\uFF1A' + values[key];
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

    var values = {};
    render(values, false);

    fetch('/cdn-cgi/trace', { cache: 'no-store' })
        .then(function (response) {
            if (!response.ok) throw new Error('Trace request failed');
            return response.text();
        })
        .then(function (trace) {
            trace.trim().split(/\r?\n/).filter(Boolean).forEach(function (line) {
                var separator = line.indexOf('=');
                if (separator < 0) return;
                values[line.slice(0, separator)] = line.slice(separator + 1);
            });
            if (Object.keys(values).length) render(values, true);
        })
        .catch(function () {
            render({}, false);
        });
})();
