---
title: rime?qingjian?
date: 2026-10-18 06:45:09
tags: ["something..."]
description: "在rime上实现qingjian的效果"
---

我想实现的做法非常简单，就是类似于 [qingjian-team/qingjian: 青简 Qingjian：用 Rust 写的拼音输入法，候选词旁多一条正在学的语言的译词](https://github.com/qingjian-team/qingjian/) 青简输入法一样，实现候选词旁边出现英文，参考下图：

 ![](https://static.eth0.bond/images/rime1.webp)

实现起来应该挺简单的，但是真正做起来的适合就发现很多地方和我现在用的万象拼音有冲突。

# 整体方案

```flowchart
flowchart LR
    A[青简英文释义 TSV] --> B[整理成 中文词<TAB>英文释义]
    B --> C[首次加载的适合去构建独立 LevelDB]
    D[万象生成中文候选] --> E[青简 Lua Filter]
    C --> E
    E --> F[单独为候选 comment 追加方括号释义]
    F --> G[后续过滤与 uniquifier]
    H[Ctrl+反引号开关] --> E
```

# 为什么不直接导入到词典？

**普通的拼音词典的职责在于进行排序和候选生成。**如果我直接把单词放到词典里面可能会意外的改变调频的结果，但是我的需求只是看释义，而不是让英文说明参与中文的运算。

Rime 的候选对象里，显示文字和注释是分开的：候选文本用于最终上屏，comment 用于候选旁的信息。这个功能只改 comment，不改 text。因此：

- 按空格、数字键选中“苹果”，上屏内容仍然是“苹果”。
- 英文释义不作为额外候选，也不会参与中文候选排序。
- 关闭释义开关后，候选恢复为原来的显示方式。

万象的 super_replacer 本身也支持 comment 模式，文档说明它可以只生成注释而不改候选文本。

# 词表怎么变成输入法能快速查的索引

青简提供英文释义 TSV，源文件在 [qingjian/assets/glossary/glossary-en.tsv](https://github.com/qingjian-team/qingjian/blob/main/assets/glossary/glossary-en.tsv)。

输入时不能每显示一个候选，就从几 MB 的文本文件里从头扫描一次。那样就把是否有释义的成本乘上候选数。因此我们可以把这个流程拆成两步：

1. **文本词表是可读的源数据。** 每行以中文词条和英文释义组成，用制表符分隔。
2. **LevelDB 是运行时的索引。** 第一次加载的时候，它把词表逐行读入独立数据库；候选出现时，再用候选中文文本去查那个对应的 key。

# 实现过程

候选词经过万象拼音与哪有的生成和前置注释注入之，filter会逐个读取候选文本（伪代码）：

```lua
if not enabled or not composing then
    yield(original_candidates)
    return
end

for each candidate in candidates do
    local gloss = lookup(candidate.text)
    if gloss and not already_appended(candidate.comment, gloss) then
        candidate.comment = candidate.comment .. " [" .. gloss .. "]"
    end
    yield(candidate)
end
```

 Filter 放在万象候选处理链中、最终去重器之前。
