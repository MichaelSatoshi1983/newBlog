---
title: "一个基于图像特征比较的图片相似度匹配工具"
date: "2025-08-22"
updated: 2025-08-22
description: "纯数学、全可复现的图片相似度匹配工具，通过HSV/HOG/Gabor/pHash/SSIM多特征提取与加权融合，快速找出最相似图片。"
tags: ["奇怪的小玩具"]
---
# 一个基于图像特征比较的图片相似度匹配工具

**纯数学实现，无任何深度学习与模型训练成分。**

项目地址：https://github.com/MichaelSatoshi1983/pixelmatch

完全 deterministic，结果可复现。

我暂时为他起名为黄渤孙红雷辨别器。

当然，你也可以用来辨别苹果和鸭梨、香蕉和牛油果...

# 主要特性和实现

## **多种图像特征提取**：

- **HSV直方图（色彩分布）**：通过将图像分为多个区域，统计每个区域中像素的色相（Hue）、饱和度（Saturation）和明度（Value）的分布。
- **HOG（梯度方向直方图）**：从图像中提取纹理特征，反映局部图像区域的形状和边缘信息。
- **Gabor特征**：通过Gabor滤波器对图像进行处理，提取图像中的纹理特征，尤其适用于边缘和纹理信息。
- **pHash**：通过离散余弦变换（DCT）计算图像的感知哈希值，用于图像的指纹识别和比较。
- **SSIM（结构相似性指数）**：衡量两张图像之间的结构相似度，考虑亮度、对比度和结构等因素。

## **图片相似度计算**：

- **Bhattacharyya距离**：用于计算两张图片的颜色分布差异。
- **余弦相似度**：用于计算HOG、Gabor特征之间的相似度。
- **SSIM**：计算目标图像与其他图片之间的结构相似度。
- **pHash**：计算图像的感知哈希值，度量两张图像的相似度。

# 我是如何实现的？

## 先预制菜加工一下

为了统一尺度和颜色空间，工具首先将图片**重采样到固定尺寸（默认256x256）**，并生成灰度矩阵与RGB矩阵。灰度矩阵用于HOG和Gabor特征，RGB矩阵用于HSV直方图和pHash计算。

```go
g := resizeGrayFloat(img, cfg.size, cfg.size)
R,G,B := resizeRGB(img, cfg.size, cfg.size)
```

## 特征提取

**HSV直方图 + 空间金字塔**

- 将图像转换到 HSV 空间
- 按 H/S/V 分量分别量化
- 多尺度金字塔提取局部颜色分布

**HOG（方向梯度直方图）**

- 计算 Sobel 梯度
- 分块统计方向梯度分布
- 多层空间金字塔增强局部结构信息

**Gabor滤波器响应**

- 构建多尺度、多方向的Gabor核
- 卷积计算滤波响应
- 利用平方和+局部均值平滑形成纹理特征

**pHash（感知哈希）**

- DCT变换提取低频系数
- 二值化生成64位哈希
- 用Hamming距离衡量整体结构差异

**MS-SSIM（多尺度结构相似性指数）**

- 分块计算灰度SSIM
- 多尺度下加权求平均，衡量整体结构相似度

```go
tf := buildFeatures(timg) // 构建目标图像特征
```

## 相似度度量与融合

每类特征计算**相似度或距离**：

- HSV → Bhattacharyya距离
- HOG/Gabor → Cosine距离
- pHash → Hamming距离
- MS-SSIM → 直接用1-SSIM

然后通过**归一化 + 排名融合 + 加权求和**得到最终综合评分：

```go
s1 := (wColor*nColor[i] + wHog*nHog[i] + ... + wSSIM*nSSIM[i])/wSum
s2 := (rColor[i] + rHog[i] + ... + rSSIM[i])/5.0
results[i].score = 0.6*s1 + 0.4*(s2/float64(len(results)))
```

最终按分数升序排序，Top N就是最相似的图片。

# 咋用：

```bash
go run main.go -target 你要对比的图片 -dir 图片的目录
```