# L101 Volume Float

A lightweight floating volume controller designed for legacy Android tablets.

![Latest Release](https://img.shields.io/github/v/release/lxhlw/AndroidTabletProject?label=latest%20release&sort=semver)

---

## 中文版

一款为老旧 Android 平板设计的轻量级悬浮音量控制工具。

### 功能

- 小型悬浮音量按钮
- 点击展开 `+` / `-` 音量控制
- 直接调节系统音量
- 悬浮按钮支持自由拖动
- 短时间无操作后自动收起
- 平板开机后自动启动
- 轻量级设计，适合老旧 Android 设备

### 兼容性

| 项目 | 支持情况 |
| --- | --- |
| Android | 4.4.2（API 19） |
| CPU ABI | armeabi-v7a |
| 屏幕 | 800 × 1280（已测试） |
| 项目目标 | Android 4.x 兼容 |

### 下载 APK

最新 APK 会自动发布到 GitHub Releases。

**下载最新版本：**  
https://github.com/lxhlw/AndroidTabletProject/releases/latest

进入 Release 后，下载：

`L101VolumeFloat.apk`

顶部的 **Latest Release** 徽章会自动读取 GitHub 最新 Release 的版本号，因此以后发布新版本时不需要手动修改 README 中的版本号。

### 构建

#### GitHub Actions

每次向 `main` 或 `master` 分支提交代码时，GitHub Actions 都会自动编译项目。

创建类似下面的版本标签：

`v0.20.0`

会自动完成：

1. 编译 APK
2. 创建 GitHub Release
3. 将 `L101VolumeFloat.apk` 上传到 Release Assets

#### Windows

项目包含本地构建脚本：

`build_apk.bat`

运行该脚本即可通过项目的 Gradle 配置构建 Release APK。

### 项目信息

包名：

`com.l101.volumefloat`

主要组件：

- `MainActivity`
- `VolumeFloatService`
- `BootReceiver`

### 当前版本

**最新 Release：** 请查看页面顶部的 Latest Release 徽章。

项目已启用 APK 自动编译和 GitHub Release 自动发布。

---

## English Version

A lightweight floating volume controller designed for legacy Android tablets.

### Features

- Small floating volume button
- Tap to expand `+` / `-` controls
- Adjust system volume directly
- Drag the floating control to any position
- Automatically collapses after a short period of inactivity
- Starts automatically after device boot
- Lightweight and compatible with older Android systems

### Compatibility

| Item | Support |
| --- | --- |
| Android | 4.4.2 (API 19) |
| CPU ABI | armeabi-v7a |
| Screen | 800 × 1280 tested |
| Project target | Android 4.x compatible |

### Download

The latest APK is published automatically in the project's GitHub Releases.

**Download latest APK:**  
https://github.com/lxhlw/AndroidTabletProject/releases/latest

Look for:

`L101VolumeFloat.apk`

The version shown by the **Latest Release** badge above is read dynamically from the repository's latest GitHub Release, so the README does not need a manual version update.

### Build

#### GitHub Actions

Every push to `main` or `master` automatically builds the project.

Creating a version tag such as:

`v0.20.0`

automatically:

1. Builds the APK
2. Creates the GitHub Release
3. Uploads `L101VolumeFloat.apk` to the Release Assets

#### Windows

A local build script is included:

`build_apk.bat`

It invokes the Gradle wrapper with the project's release build configuration.

### Project

Package:

`com.l101.volumefloat`

Main components:

- `MainActivity`
- `VolumeFloatService`
- `BootReceiver`

### Release

**Latest Release:** shown automatically by the badge at the top of this page.

Automatic APK build and GitHub Release publishing are enabled.
