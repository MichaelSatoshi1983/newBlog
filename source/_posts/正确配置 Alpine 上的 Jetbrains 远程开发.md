---
title: 正确配置 Alpine 上的 Jetbrains 远程开发
date: 2026-06-03 03:56:19
tags: ["排错"]
---

> 一个风和日丽的上午，我决定让 Jetbrains 的 IDE 连上我跑在 WSL 里面的 Alpine，然后这个风和日丽的上午没了。

# 为啥非得遭罪

事情是这样的。

我有一台 Thinkpad，上面跑的 Alpine on WSL，选他就是因为轻便，不和其他的系统一样臃肿。

**但是 Alpine 有一个怪癖就是不用 glibc 而是 musl libc，虽然轻量符合 POSIX 吧，但是有一个很大的缺点就是这个世界上百分之 99 的二进制包都是基于 glibc 的，你 musl libc 大概不能直接用。**

噩梦就这样开始了。。

# 报错

Gateway 输出了好多日志，我这里就只放最主要的了：

```
java.lang.VerifyError: Expecting a stack map frame
Exception Details:
  Location:
    com/intellij/idea/Main.initRemoteDevGraphicsEnvironment()V @1: nop
  Bytecode:
    0000000: b100 0000 0000 0000 0000 0000 0000
```

我当时以为是 Goland 包坏了，因为我看字节码错误，那肯定是 class 文件有问题啊，谁会想到我 libc 有问题。然后我删了重下，一样。我决定手动跑一下试试。

> 另外提一嘴，实际上 Jetbrains Gateway 本质上做的事情很简单，就是 `wsl.exe --distribution Alpine -- /bin/zsh -lc "echo REMOTE_EXEC_OUTPUT_MARKER_ && ..."`

自己手动跑了也是一样出问题，那就证明和 Gateway 无关，是我 Alpine 的问题（其实到这里我还是认为是 class 的问题，毕竟说的是 VerifyError，定位在 initRemoteDevGraphicsEnvironment 方法上，这么多 0 那不就是坏的么。）

**后面发现这个字节码竟然是合法的。。。**

# 当你相信问题 A 那么问题一定在 B

既然认定是字节码的问题，我就开始尝试绕开验证器。但是 `-noverify` 和 `_JAVA_OPTIONS=noverify` 竟然都特么没用，这就离谱了，这种 JVM 亲爹几倍的选项理论上所有的字节码验证都被关了，居然还能 VerifyError？？？

不过仔细一想，**如果真的把验证关了，那么这个错误就不是验证器报的，可能是类加载器在解析 class 的时候报的。**

我于是开始怀疑 JVM 的问题，直接跑 JBR：

```
Error: dl failure on line 578
Error: failed .../libjvm.so, because Error relocating
posix_fallocate64: symbol not found
```

卧槽。。

问题直接就明了了，JBR 的 `libjvm.so` 在加载的时候动态链接器找不到 `posix_fallocate64`，因为 glibc 有这个符号，但是 musl 没用，**虽然 Alpine 装了兼容层 gcompat，但是只提供一部分的符号。**

glibc 有一套 *64 后缀的文件操作函数，musl 是一个都没。

```
fopen64
fstatfs64
fstatvfs64
ftruncate64
getrlimit64
lseek64
mkstemp64
mmap64
open64
posix_fadvise64
posix_fallocate64
pread64
pwrite64
readdir64
sendfile64
setrlimit64
statfs64
statvfs64
fcntl64          ← 这个是 GLIBC_2.28，其余全是 GLIBC_2.2.5
```

别看这么多，其实解决的话挺简单，写一个 shim 共享库就行。

思路就是在 64 位系统上，musl 的 `off_t` 已经是 64 位了，glibc 那的函数在功能上完全一样，只需要做到给每一个函数写一个 wrapper 让他转发到 musl 就行，然后把编译好的库注入到进程空间就行。

部分 trivial 是这样的：

```c
// fopen64 → fopen，函数签名一模一样
FILE *fopen64(const char *pathname, const char *mode) {
    return fopen(pathname, mode);
}

// lseek64 → lseek，在 64 位上 off_t 就是 64 位的
off_t lseek64(int fd, off_t offset, int whence) {
    return lseek(fd, offset, whence);
}

// posix_fallocate64 → posix_fallocate
int posix_fallocate64(int fd, off_t offset, off_t len) {
    return posix_fallocate(fd, offset, len);
}
```

不过需要注意的是：

- `statfs64` / `fstatfs64` ：`struct statfs` 在 musl 上直接对应 glibc 的 `struct statfs64`
- `statvfs64` / `fstatvfs64` 同理
- `readdir64` ：`struct dirent`在 musl 上就是 64 位的，跟 glibc `struct dirent64` 布局一致
- `getrlimit64` / `setrlimit64`  ：`struct rlimit` 直通
- `fcntl64` ： 这个是 varargs，稍微麻烦一点，但也只是参数转发

不过比较幸运的是，这俩核心的数据结构都遵循同一套 ABI 内存布局一样，直接 cast 就能跑。

```
sudo gcc -shared -fPIC -O2 -o /usr/local/lib/libjbr-musl-shim.so jbr-musl-shim.c
```

测试：

```
LD_PRELOAD=/usr/local/lib/libjbr-musl-shim.so ./jbr/bin/java -version
# 活了
openjdk version "25.0.3" 2026-04-21
OpenJDK Runtime Environment JBR-25.0.3+9-496.62-nomod
```

# JDK 在 musl 的 bug

再连接的时候还是会遇到问题：

```
java.lang.VerifyError: Expecting a stack map frame
Exception Details:
  Location:
    com/intellij/idea/Main.initRemoteDevGraphicsEnvironment()V @1: nop
```

还是同一个错误，JBR 能跑，为啥启动 IDE 就报错呢。。

这个时候 Steven 提醒我或可以反编译一下，把那个方法反编译出来一行行看：

```
private static final void initRemoteDevGraphicsEnvironment();
    descriptor: ()V
    Code:
      stack=0, locals=0, args_size=0
         0: return        ← b1，void 方法返回
         1: nop           ← 00，空操作
         2: nop
         ...
        13: nop
      LineNumberTable:
        line 228: 0
        line 229: 13
```

一个 `return`，后面跟了 13 个 `nop`。

**这他妈是合法的 Java 字节码。。。。**

`return` 后面的指令是不可达的，但是 JVM 规范明确允许不可达代码。没有跳转和分支的时候所以不需要 `StackMapTable` 属性。`LineNumberTable` 是 debug 信息，验证器直接忽略。

既然不是字节码的问题，那只能把锅甩给 JDK 了(bushi

众所周知 Alpine 里面的 OpenJDK 25 是专门给 musl编译的，上面的 noveify 是 HotSpot 标准的选项，但是在某些移植版本里面是没有实现的，或者说验证器的某些条件只能在 musl 上面触发，但是当你用 Xverify:none 的时候：

```
STATUS:
{
  "appPid": 2153,
  "appVersion": "GO-262.6653.43",
  "runtimeVersion": "25.0.3b496.62",
  "backendUnresponsive": false
}
```

一切就正常了，不过需要注意一个细节就是虽然 `-noverify` 和 `-Xverify:none` 在文档里面是等价的，但是在 musl 的 JDK 里面，只有后者有用，我也不知道为啥，但是能用就行了呗。

后续的字体问题只需要删掉 GOLAND_JDK 这个变量就行，让 goland.sh 去自己找升级之后的 jbr（虽然这个也是 25，但是它的 awt 模块是 jb patch 的，没字体问题）

# 总结

修改 `~/.zshenv`：

```
export LD_PRELOAD=/usr/local/lib/libjbr-musl-shim.so
。
export _JAVA_OPTIONS=-Xverify:none
```

然后从 `.zshrc` 里**删掉**之前那行：

```
export GOLAND_JDK=/usr/lib/jvm/java-25-openjdk
```
