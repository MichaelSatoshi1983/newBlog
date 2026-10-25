# hexo-theme-zen
## 禅 - Hexo极简主题

---

功能简单，但是文件超小，不开评论功能每个页面只加载**15kb**左右

配置文件参考`_config.zen.yml`

支持`Twikoo`和`beaudar`评论功能

支持在页脚显示 Cloudflare Worker 提供的访问统计。将下面配置加入站点的主题配置文件：

```yaml
site_stats:
  enable: true
  endpoint: https://pv.eth0.bond
  time_zone: Asia/Shanghai
```

统计脚本会等页面实际变为可见后再发送一次统计请求，避免浏览器预渲染和后台预加载造成 PV 虚高；不会定时轮询。PV 是服务启用后的累计页面浏览次数，UV 按所选时区每天对浏览器去重。浏览器标识每天轮换，原始访客 IP 不写入 D1。接口不可用时页脚保持占位符，不影响页面显示。

正确的高亮配置
```yaml
highlight:
  enable: true
  line_number: false
  auto_detect: false
  tab_replace: ''
  wrap: false
  hljs: true
prismjs:
  enable: false
```
