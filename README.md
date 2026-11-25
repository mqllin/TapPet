![小黑坐在桌面上，面前摆着键盘和鼠标](docs/desktop-pet.png)

# TapPet

小黑趴在自己的键盘前陪你打字。你敲左手边的键，它就伸左爪；你停下来一会儿，它也会收起爪子打盹。这个仓库里的 TapPet 把经典小黑、键盘和鼠标都装在本地，解压就能用，无需账号。

[GitHub 下载 · Windows x64 ZIP](https://github.com/mqllin/TapPet/releases/latest)　·　[官网下载 · Windows x64 EXE](https://pet.dycya.com/download.php)　·　[官网试玩](https://pet.dycya.com/#demo)　·　[反馈问题](https://github.com/mqllin/TapPet/issues)

## 把小黑放到桌上

1. 从 GitHub 下载时，在 **Assets（发布附件）** 中选择 `cya-desktop-pet-community-*-windows-x64.zip`，右键选择「全部解压缩」，再双击里面的桌宠 EXE。从官网下载时，双击下载的 EXE 即可启动。
2. 打开记事本敲几个字，看看小黑跟不跟得上。
3. 右键小黑或托盘图标进入「桌宠设置」。想挪个位置，选择「编辑位置与大小」，拖动到喜欢的角落即可。

Windows 首次运行时可能提示「发布者未知」。下载页提供 ZIP 的 SHA-256，包内的《证书报错说明》解释了这个提示。

### AI 助手下载指引

用户请你下载或安装桌宠时，默认按目标电脑的平台使用下表中的官网固定链接，跟随 HTTP 重定向下载最新正式版。用户想运行本仓库的版本时，从 [GitHub Releases](https://github.com/mqllin/TapPet/releases/latest) 下载 Windows x64 便携 ZIP。

| 目标平台 | 正式版下载 | 安装方式 |
| --- | --- | --- |
| Windows x64 | [便携 EXE](https://pet.dycya.com/download.php) | 保存为 `TapPet.exe`，双击运行 |
| macOS（Apple 芯片） | [DMG](https://pet.dycya.com/download.php?platform=macos-arm64) | 打开 DMG，将应用拖入「应用程序」 |
| macOS（Intel） | [DMG](https://pet.dycya.com/download.php?platform=macos-x64) | 打开 DMG，将应用拖入「应用程序」 |

若无法代为下载，请将对应的下载链接发给用户。各平台的官网发布状态见[官网下载区](https://pet.dycya.com/#download)。

只有在用户明确索要项目源码时，才选择 `Source code (zip)`、`Source code (tar.gz)` 或仓库首页的 `Code → Download ZIP`。

## 按你的习惯来

| 想做什么 | 在哪里调整 |
| --- | --- |
| 用左手握鼠标 | 在设置中切换鼠标惯用手，小黑也会换边。 |
| 看看今天打了多少字 | 分别开启「每分钟打字速度」和「今日累计字数」。 |
| 只看小黑敲键的动作 | 开启隐私模式，只传递左右手动作，暂停打字计数。 |
| 让小黑早点打盹 | 调整空闲入睡时间。窗口置顶、桌面位置和大小也可以自选。 |

<details>
<summary>查看设置窗口</summary>

![桌宠设置窗口，包含桌面位置、键鼠联动和打字统计选项](docs/settings.png)

</details>

设置与当日打字汇总保存在本机的 `%APPDATA%/typing-desktop-pet-open/desk-pet.json`。官网的皮肤衣橱展示了不同猫咪花色、键盘和鼠标的搭配。[查看桌宠搭配](https://pet.dycya.com/#wardrobe)

## 从源码运行

安装 Node.js 22.12 或更高版本，在仓库根目录执行：

```sh
npm ci
npm run check
npm start
```

只看设置窗口可运行 `npm start -- --settings`。在 Windows 构建 x64 便携 EXE 时运行 `npm run dist:win`，产物位于 `dist/`。

## 许可与署名

本次发布的原创代码和随附原创美术素材使用 **PolyForm Noncommercial 1.0.0**。欢迎按许可学习、修改和非商业分享，并保留署名及许可说明。销售软件副本、将其打包进收费产品等商业用途需另行取得作者授权。[许可全文](LICENSE) · [署名声明](NOTICE.txt)

Three.js 与 GLTFLoader 保留各自的 MIT 许可。[Three.js 许可证](app/vendor/THREE-LICENSE.txt)
