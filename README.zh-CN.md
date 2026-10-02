# L101 Volume Float

一款为老旧 Android 平板设计的轻量级悬浮音量控制工具。

**🇨🇳 中文** · [🇺🇸 English](README.md)

![最新版本](https://img.shields.io/github/v/release/lxhlw/AndroidTabletProject?label=latest%20release&sort=semver)

## 功能

- 小型悬浮音量按钮
- 点击展开 `+` / `-` 音量控制
- 直接调节系统音量
- 悬浮按钮支持自由拖动
- 短时间无操作后自动收起
- 平板开机后自动启动
- 轻量级设计，适合老旧 Android 设备

## 兼容性

| 项目 | 支持情况 |
| --- | --- |
| Android | 4.4.2（API 19） |
| CPU ABI | armeabi-v7a |
| 屏幕 | 800 × 1280（已测试） |
| 项目目标 | Android 4.x 兼容 |

## 下载 APK

最新 APK 会自动发布到 GitHub Releases。

**[下载最新 APK](https://github.com/lxhlw/AndroidTabletProject/releases/latest)**

进入最新 Release 后，下载：

`L101VolumeFloat.apk`

顶部的版本徽章会自动读取 GitHub 最新 Release 的版本号，因此以后发布新版本时不需要手动修改 README。

## 构建

### GitHub Actions

每次向 `main` 或 `master` 分支提交代码时，GitHub Actions 都会自动编译项目。

创建类似下面的版本标签：

`v0.20.0`

会自动完成：

1. 编译 APK
2. 创建 GitHub Release
3. 将 `L101VolumeFloat.apk` 上传到 Release Assets

### Windows

项目包含本地构建脚本：

`build_apk.bat`

运行该脚本即可通过项目的 Gradle 配置构建 Release APK。

## 项目信息

包名：

`com.l101.volumefloat`

主要组件：

- `MainActivity`
- `VolumeFloatService`
- `BootReceiver`

## 版本

**最新 Release：** 请查看页面顶部的版本徽章。

项目已启用 APK 自动编译和 GitHub Release 自动发布。
