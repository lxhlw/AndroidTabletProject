# L101 Volume Float

A lightweight floating volume controller designed for legacy Android tablets.

<p align="center">
  <a href="https://lxhlw.github.io/AndroidTabletProject/">
    <img src="https://img.shields.io/badge/🌐_Official_Website-4f8cff?style=for-the-badge" alt="Official Website">
  </a>
  <a href="https://github.com/lxhlw/AndroidTabletProject/releases/latest">
    <img src="https://img.shields.io/badge/📦_Download_APK-48c78e?style=for-the-badge" alt="Download APK">
  </a>
</p>

<p align="center">
  <img src="https://img.shields.io/github/actions/workflow/status/lxhlw/AndroidTabletProject/build-apk.yml?branch=main&label=Build" alt="Build Status">
  <img src="https://img.shields.io/github/v/release/lxhlw/AndroidTabletProject?label=Latest%20Release&sort=semver" alt="Latest Release">
  <img src="https://img.shields.io/badge/Android-4.4.2%20%7C%20API%2019-3ddc84" alt="Android 4.4.2">
  <img src="https://img.shields.io/badge/Tested%20ABI-armeabi--v7a-3ddc84" alt="Tested ABI: armeabi-v7a">
</p>

## 🇨🇳 中文

L101 Volume Float 是一款为老旧 Android 平板设计的轻量级悬浮音量控制工具。

**[🌐 打开中文版/English 双语官网](https://lxhlw.github.io/AndroidTabletProject/)**

### 主要功能

- 小型悬浮音量按钮
- 点击展开 `+` / `-` 控制
- 直接调节系统音量
- 支持拖动悬浮按钮
- 无操作后自动收起
- 平板开机自动启动
- 适配老旧 Android 设备

### 兼容性

| 项目 | 支持 |
| --- | --- |
| Android | 4.4.2（API 19） |
| Tested device ABI | armeabi-v7a |
| 测试屏幕 | 800 × 1280 |
| 包名 | `com.l101.volumefloat` |

### 下载

**[📦 下载最新 APK](https://github.com/lxhlw/AndroidTabletProject/releases/latest)**

进入最新 Release 后下载：

`L101VolumeFloat.apk`

## 🇺🇸 English

L101 Volume Float is a lightweight floating volume controller designed for legacy Android tablets.

**[🌐 Open the bilingual project website](https://lxhlw.github.io/AndroidTabletProject/)**

### Features

- Small floating volume button
- Tap to expand `+` / `-` controls
- Direct system volume adjustment
- Draggable floating control
- Automatically collapses after inactivity
- Starts automatically after device boot
- Designed for older Android devices

### Compatibility

| Item | Support |
| --- | --- |
| Android | 4.4.2 (API 19) |
| Tested device ABI | armeabi-v7a |
| Tested screen | 800 × 1280 |
| Package | `com.l101.volumefloat` |

### Download

**[📦 Download latest APK](https://github.com/lxhlw/AndroidTabletProject/releases/latest)**

Download:

`L101VolumeFloat.apk`

## Installation / Upgrade

### First installation

On the Android 4.4.2 tablet, install `L101VolumeFloat.apk`.

If an older copy signed with a different certificate is already installed, uninstall the old copy first.

### Later upgrades

All official Release APKs use the same signing key. New versions can therefore be installed over the existing app without uninstalling it.

### ADB

For official Release APK installation or upgrade:

```bat
adb install -r L101VolumeFloat.apk
```

Package:

`com.l101.volumefloat`

### Test APK

Debug/Test APKs are signed with a different certificate from official Release APKs. Before installing a test APK, remove the currently installed copy:

```bat
adb uninstall com.l101.volumefloat
adb install L101VolumeFloat.apk
```

Use this method only for test/debug APKs. After testing, uninstall the test APK before installing the official Release APK if Android reports a signature mismatch.

## Build & Release

### GitHub Actions

Pushing to `main` or `master` automatically builds a Debug APK.

Creating a version tag such as:

`v0.21.2`

automatically:

1. Sets the Android `versionName` from the tag
2. Builds a signed Release APK
3. Generates APK metadata
4. Generates GitHub change notes
5. Publishes `L101VolumeFloat.apk` to the GitHub Release

### Windows

The repository includes the standard Gradle Wrapper, so a Debug APK can be built with:

```bat
gradlew.bat assembleDebug
```

The convenience script `build_apk.bat` is also available; it downloads Gradle 4.10.3 automatically when needed.

A local build requires **JDK 8**.

Official signed Release APKs should be downloaded from GitHub Releases.

## WhyMusic / LX Music Source Compatibility

This repository also deploys the WhyMusic web player and its LX Music source compatibility layer.

### Production WhyMusic

- **WhyMusic website:** https://whymusic-l101.pages.dev/
- **Official WhyMusic plugin:** https://whymusic-l101.pages.dev/plugins/whymusic.js

### Install an LX Music source

Open the WhyMusic website, go to **Settings → Install source from URL**, and paste an LX Music source JavaScript URL.

The player accepts LX-style sources that expose the LX runtime protocol (globalThis.lx / window.lx and EVENT_NAMES.inited) and loads them directly through the compatibility layer. Installed source code is persisted in browser storage and restored after refresh.

Verified compatibility includes:

- LX source initialization
- musicUrl playback for wy / tx / kg / kw / mg
- LX request → WhyMusic proxy bridge
- lyric and cover (pic) actions when supplied by the source
- automatic source fallback when a child source fails
- search aggregation that keeps successful sources when another source fails
- reinstall/update without duplicate plugin entries
- multiple real-world LX source formats, including a minimal musicUrl-only source

The WhyMusic deployment is validated through GitHub Actions, including a real browser install → persistence → reload → search E2E test.

### Current search note

WhyMusic performs cross-source search aggregation in its own player/worker layer. LX source compatibility is not limited to the search implementation; LX sources are used directly for their playback, lyric, cover, request, and initialization protocols.

## Project

Package:

`com.l101.volumefloat`

Main components:

- `MainActivity`
- `VolumeFloatService`
- `BootReceiver`

## Official Links

- **[🌐 Official Project Website](https://lxhlw.github.io/AndroidTabletProject/)**
- **[📦 Latest APK](https://github.com/lxhlw/AndroidTabletProject/releases/latest)**
- **[🏷️ All Releases](https://github.com/lxhlw/AndroidTabletProject/releases)**

The website provides the full in-page Chinese / English language switcher and automatically reads the latest GitHub Release.
