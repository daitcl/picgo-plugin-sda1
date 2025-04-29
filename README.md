# picgo-plugin-sda1

### 简介

这是一个 PicGo 插件，用于将图片上传到 p.sda1.dev 图床（流浪图床）。

### 安装

1. 确保你已经安装了 PicGo。
2. 打开 PicGo 插件设置，搜索 `picgo-plugin-sda1` 并安装。

### 使用方法

1. 打开 PicGo 配置界面，选择 `SDA1`。
2. 可以根据需要修改上传地址（默认为 `https://p.sda1.dev/api/v1/upload_external_noform?filename=`）。
3. 上传图片时，选择 `SDA1` 作为上传器。

### 配置选项

- **上传地址**: 图床上传API地址，默认为 `https://p.sda1.dev/api/v1/upload_external_noform?filename=`。
- **jsonPath**: 图片URL所在返回值的**JsonPath**，`data.url`

### 许可证

本项目采用 MIT 许可证。
