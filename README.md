# L101 Volume Float

A lightweight floating volume controller designed for legacy Android tablets.

**🇺🇸 English** · [🇨🇳 中文](README.zh-CN.md)

![Latest Release](https://img.shields.io/github/v/release/lxhlw/AndroidTabletProject?label=latest%20release&sort=semver)

## Features

- Small floating volume button
- Tap to expand `+` / `-` controls
- Adjust system volume directly
- Drag the floating control to any position
- Automatically collapses after a short period of inactivity
- Starts automatically after device boot
- Lightweight and compatible with older Android systems

## Compatibility

| Item | Support |
| --- | --- |
| Android | 4.4.2 (API 19) |
| CPU ABI | armeabi-v7a |
| Screen | 800 × 1280 tested |
| Project target | Android 4.x compatible |

## Download

The latest APK is published automatically in the project's GitHub Releases.

**[Download latest APK](https://github.com/lxhlw/AndroidTabletProject/releases/latest)**

Look for:

`L101VolumeFloat.apk`

The **Latest Release** badge above is read dynamically from the repository's latest GitHub Release, so the README does not need a manual version update.

## Build

### GitHub Actions

Every push to `main` or `master` automatically builds the project.

Creating a version tag such as:

`v0.20.0`

automatically:

1. Builds the APK
2. Creates the GitHub Release
3. Uploads `L101VolumeFloat.apk` to the Release Assets

### Windows

A local build script is included:

`build_apk.bat`

It invokes the Gradle wrapper with the project's release build configuration.

## Project

Package:

`com.l101.volumefloat`

Main components:

- `MainActivity`
- `VolumeFloatService`
- `BootReceiver`

## Release

**Latest Release:** shown automatically by the badge at the top of this page.

Automatic APK build and GitHub Release publishing are enabled.
