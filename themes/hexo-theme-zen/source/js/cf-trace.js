(function () {
    var list = document.getElementById('trace-list');
    if (!list) return;
    var commitSha = list.getAttribute('data-version') || '';
    var rangeSelector = document.getElementById('analytics-range');
    var rangeLabels = { '24h': '近24小时', '7d': '近7天', '30d': '近30天' };
    var browserLanguage = (navigator.languages && navigator.languages.length
        ? navigator.languages.filter(Boolean).join(', ')
        : navigator.language) || null;

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
        ['clientAcceptEncoding', '客户端 Accept-Encoding'],
        ['clientQuicRtt', 'QUIC 往返时延'],
        ['clientTcpRtt', 'TCP 往返时延'],
        ['colo', 'Worker 接入机房'],
        ['country', 'Worker 访问国家代码'],
        ['edgeL4DeliveryRate', '边缘网络传输速率'],
        ['isEUCountry', '是否来自欧盟'],
        ['httpProtocol', 'Worker HTTP 协议'],
        ['hostMetadata', '自定义主机元数据'],
        ['requestPriority', '浏览器请求优先级'],
        ['tlsCipher', 'TLS 加密套件'],
        ['tlsClientAuth', 'mTLS 客户端证书信息'],
        ['tlsClientCiphersSha1', 'TLS 客户端密码套件 SHA-1'],
        ['tlsClientExtensionsSha1', 'TLS 客户端扩展 SHA-1'],
        ['tlsClientExtensionsSha1Le', 'TLS 客户端扩展 SHA-1（小端）'],
        ['tlsClientHelloLength', 'TLS ClientHello 长度'],
        ['tlsClientRandom', 'TLS ClientHello 随机值'],
        ['tlsVersion', 'Worker TLS 版本'],
        ['continent', '访问大洲'],
        ['city', 'IP 定位城市'],
        ['latitude', 'IP 定位纬度'],
        ['longitude', 'IP 定位经度'],
        ['postalCode', 'IP 定位邮编'],
        ['metroCode', 'IP 定位都会区代码'],
        ['region', 'IP 定位地区'],
        ['regionCode', 'IP 定位地区代码'],
        ['timezone', '访问者时区'],
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
    var analyticsValues = {};
    var analyticsAvailable = false;
    var pageLoadTime = null;

    function getPageLoadTime() {
        if (!window.performance) return null;
        var navigationEntries = performance.getEntriesByType && performance.getEntriesByType('navigation');
        if (navigationEntries && navigationEntries.length && navigationEntries[0].loadEventEnd > 0) {
            return Math.round(navigationEntries[0].loadEventEnd - navigationEntries[0].startTime);
        }
        var timing = performance.timing;
        if (timing && timing.loadEventEnd > 0 && timing.navigationStart > 0) {
            return Math.round(timing.loadEventEnd - timing.navigationStart);
        }
        return null;
    }

    function updatePageLoadTime() {
        pageLoadTime = getPageLoadTime();
        render();
    }

    if (document.readyState === 'complete') {
        window.setTimeout(updatePageLoadTime, 0);
    } else {
        window.addEventListener('load', function () {
            window.setTimeout(updatePageLoadTime, 0);
        }, { once: true });
    }

    function displayValue(key, value, available) {
        if (!available || value === undefined || value === null || value === '') return 'N/A';
        if (key === 'asn') return 'AS' + value;
        if (key === 'clientTcpRtt' || key === 'clientQuicRtt') return value + ' ms';
        if (key === 'edgeL4DeliveryRate') return value + ' B/s';
        if (typeof value === 'object') return JSON.stringify(value);
        return String(value);
    }

    function formatBytes(value) {
        if (value === undefined || value === null || value === '') return 'N/A';
        var bytes = Number(value);
        if (!isFinite(bytes)) return 'N/A';
        var units = ['B', 'KB', 'MB', 'GB', 'TB'];
        var unit = 0;
        while (bytes >= 1024 && unit < units.length - 1) {
            bytes /= 1024;
            unit++;
        }
        return (unit === 0 ? Math.round(bytes) : bytes.toFixed(2)) + ' ' + units[unit];
    }

    function formatBreakdown(rows, nameKey, countKey) {
        if (!Array.isArray(rows) || !rows.length) return 'N/A';
        return rows.map(function (row) {
            return row[nameKey] + ': ' + row[countKey];
        }).join('，');
    }

    function formatSecurityEvents(rows) {
        if (!Array.isArray(rows)) return 'N/A';
        if (!rows.length) return '0';
        return rows.map(function (row) {
            return row.source + '/' + row.action + ': ' + row.events;
        }).join('，');
    }

    function formatWorkerCpu(value) {
        var formatted = displayValue('workerCpu', value, true);
        return formatted === 'N/A' ? formatted : formatted + ' μs';
    }

    function currentRange() {
        return rangeSelector && rangeLabels[rangeSelector.value] ? rangeSelector.value : '24h';
    }

    function loadAnalytics() {
        analyticsAvailable = false;
        analyticsValues = {};
        render();

        fetch('/api/about-website-analytics?range=' + encodeURIComponent(currentRange()), { cache: 'no-store' })
            .then(function (response) {
                if (!response.ok) throw new Error('Cloudflare Analytics request failed');
                return response.json();
            })
            .then(function (analytics) {
                analyticsValues = analytics || {};
                analyticsAvailable = true;
                render();
            })
            .catch(function () {
                analyticsAvailable = false;
                render();
            });
    }

    function render() {
        list.textContent = '';
        traceFields.forEach(function (field) {
            var item = document.createElement('li');
            item.textContent = field[1] + '\uFF1A' + displayValue(field[0], traceValues[field[0]], traceAvailable);
            list.appendChild(item);
        });

        var languageItem = document.createElement('li');
        languageItem.textContent = '浏览器语言：' + (browserLanguage || 'N/A');
        list.appendChild(languageItem);

        var loadTimeItem = document.createElement('li');
        loadTimeItem.textContent = '本次页面加载耗时：' + (pageLoadTime === null ? 'N/A' : pageLoadTime + ' ms');
        list.appendChild(loadTimeItem);

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

        var selectedRange = currentRange();
        var analyticsFields = [
            ['统计时间范围', rangeLabels[selectedRange]],
            ['请求量', analyticsAvailable ? displayValue('requests', analyticsValues.requests, true) : 'N/A'],
            ['流量', analyticsAvailable ? formatBytes(analyticsValues.trafficBytes) : 'N/A'],
            ['缓存情况', analyticsAvailable ? formatBreakdown(analyticsValues.cache, 'status', 'requests') : 'N/A'],
            ['地区分布', analyticsAvailable ? formatBreakdown(analyticsValues.countries, 'country', 'requests') : 'N/A'],
            ['状态码分布', analyticsAvailable ? formatBreakdown(analyticsValues.statuses, 'status', 'requests') : 'N/A'],
            ['安全事件', analyticsAvailable ? formatSecurityEvents(analyticsValues.securityEvents) : 'N/A'],
            ['Worker 调用数', analyticsAvailable ? displayValue('workerRequests', analyticsValues.worker && analyticsValues.worker.requests, true) : 'N/A'],
            ['Worker 错误数', analyticsAvailable ? displayValue('workerErrors', analyticsValues.worker && analyticsValues.worker.errors, true) : 'N/A'],
            ['Worker 子请求数', analyticsAvailable ? displayValue('workerSubrequests', analyticsValues.worker && analyticsValues.worker.subrequests, true) : 'N/A'],
            ['Worker CPU P50', analyticsAvailable ? formatWorkerCpu(analyticsValues.worker && analyticsValues.worker.cpuTimeP50) : 'N/A'],
            ['Worker CPU P99', analyticsAvailable ? formatWorkerCpu(analyticsValues.worker && analyticsValues.worker.cpuTimeP99) : 'N/A']
        ];
        analyticsFields.forEach(function (field) {
            var item = document.createElement('li');
            item.textContent = field[0] + '\uFF1A' + field[1];
            list.appendChild(item);
        });
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

    if (rangeSelector) {
        rangeSelector.addEventListener('change', loadAnalytics);
    }
    loadAnalytics();
})();
