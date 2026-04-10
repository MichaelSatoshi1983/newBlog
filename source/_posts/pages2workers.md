---
title: " 把博客从 Pages 迁移到 Workers "
date: "2025-07-21"
updated: 2025-07-21
description: "记录了 Astro 博客从 Cloudflare Pages 迁移到 Cloudflare Workers。"
tags: ["博客搭建记录"]
---
> 更新：本站已于 2025 年 7 月 23 日迁移到了 Vercel

最近将博客迁移到了 Astro 上，丝般顺滑。但是默认是通过 Cloudflare Pages 去部署的，迁移到 Workers 也不费力，但是官方没写，于是就记录一下。
# 创建 workers 所需的文件
只需要在根目录下创建一个 `wrangler.json`：
```json
{
  "name": "blog",
  "compatibility_date": "2025-07-21",
  "assets": {
    "directory": "./dist"
  }
}
```
> ”不要忘记将相关信息修改为自己的哦“
然后一个 `.assetsignore`：
```text
_worker.js
_routes.json
```
> 在 `public` 文件夹下面即可
然后再执行构建就可以了。