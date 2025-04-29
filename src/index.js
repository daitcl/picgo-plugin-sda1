// 移除日志相关代码
// const logger = require('@varnxy/logger');
// logger.setDirectory('/Users/zhang/Work/WorkSpaces/WebWorkSpace/picgo-plugin-sda1/logs');
// let log = logger('plugin');

// 定义默认配置对象，包含 API 地址和 JSON 路径的默认值
const DEFAULT_CONFIG = {
  url: 'https://p.sda1.dev/api/v1/upload_external_noform?filename=',
  jsonPath: 'data.url'
};

// 导出一个函数，该函数接收上下文对象 ctx 作为参数
module.exports = (ctx) => {
  /**
   * 注册上传器到 PicGo 上下文中
   */
  const register = () => {
    // 使用 PicGo 上下文的 helper.uploader.register 方法注册名为 'sda1' 的上传器
    ctx.helper.uploader.register('sda1', {
      handle, // 处理上传的函数
      name: '流浪图床', // 上传器的名称
      config: config // 配置上传器的函数
    });
  };

  /**
   * 处理图片上传的异步函数
   * @param {Object} ctx - PicGo 上下文对象
   */
  const handle = async function (ctx) {
    // 从 PicGo 上下文中获取 'picBed.sda1' 的用户配置
    let userConfig = ctx.getConfig('picBed.sda1');
    // 如果未找到用户配置，抛出错误
    if (!userConfig) {
      throw new Error('Can\'t find uploader config');
    }
    // 从用户配置中提取 API 地址和 JSON 路径
    const url = userConfig.url;
    const jsonPath = userConfig.jsonPath;
    try {
      // 获取待上传的图片列表
      let imgList = ctx.output;
      // 使用 map 方法将图片列表转换为包含上传 Promise 的数组
      const uploadPromises = imgList.map(async (img) => {
        // 获取图片的二进制数据
        let image = img.buffer;
        // 如果没有二进制数据，尝试从 base64 数据转换
        if (!image && img.base64Image) {
          image = Buffer.from(img.base64Image, 'base64');
        }
        // 生成上传请求的配置对象
        const postConfig = postOptions(image, url, img.fileName);
        // 发送上传请求并等待响应
        let body = await ctx.Request.request(postConfig);

        // 删除图片对象中的 base64 数据和二进制数据
        delete img.base64Image;
        delete img.buffer;
        // 如果没有配置 JSON 路径，直接将响应体作为图片 URL
        if (!jsonPath) {
          img['imgUrl'] = body;
        } else {
          try {
            // 解析响应体为 JSON 对象
            body = JSON.parse(body);
            let imgUrl = body;
            // 根据 JSON 路径提取图片 URL
            for (let field of jsonPath.split('.')) {
              imgUrl = imgUrl[field];
            }
            // 如果成功提取到图片 URL，将其赋值给图片对象
            if (imgUrl) {
              img['imgUrl'] = imgUrl;
            } else {
              // 否则，发送通知提示用户检查 JSON 路径设置
              ctx.emit('notification', {
                title: '返回解析失败',
                body: '请检查JsonPath设置'
              });
            }
          } catch (parseErr) {
            // 如果 JSON 解析失败，发送通知提示用户
            ctx.emit('notification', {
              title: 'JSON解析失败',
              body: JSON.stringify(parseErr)
            });
          }
        }
        return img;
      });
      // 等待所有上传 Promise 完成，并将结果赋值给上下文的 output 属性
      ctx.output = await Promise.all(uploadPromises);
    } catch (err) {
      // 如果上传过程中出现错误，发送通知提示用户
      ctx.emit('notification', {
        title: '上传失败',
        body: JSON.stringify(err)
      });
    }
  };

  /**
   * 生成上传请求的配置对象
   * @param {Buffer} image - 图片的二进制数据
   * @param {string} url - API 地址
   * @param {string} fileName - 文件名
   * @returns {Object} - 上传请求的配置对象
   */
  const postOptions = (image, url, fileName) => {
    // 检查参数是否有效，如果无效则抛出错误
    if (!image || !url || !fileName) {
      throw new Error('postOptions 参数无效');
    }
    // 定义请求头
    let headers = {
      'Content-Type': 'application/octet-stream', // [!code ++]
      'User-Agent': 'PicGo',
      'Connection': 'keep-alive'
    };
    // 定义请求配置对象
    const opts = {
      method: 'POST',
      url: url + fileName,
      headers: headers,
      body: image
    };
    return opts;
  };

  /**
   * 获取上传器的配置项
   * @param {Object} ctx - PicGo 上下文对象
   * @returns {Array} - 配置项数组
   */
  const config = (ctx) => {
    // 从 PicGo 上下文中获取 'picBed.sda1' 的用户配置
    let userConfig = ctx.getConfig('picBed.sda1');
    // 如果未找到用户配置，初始化为空对象
    if (!userConfig) {
      userConfig = {};
    }
    return [
      {
        name: 'url', // 配置项名称
        type: 'input', // 配置项类型为输入框
        default: userConfig.url || DEFAULT_CONFIG.url, // 默认值
        required: true, // 是否为必填项
        message: 'API地址', // 提示信息
        alias: 'API地址' // 别名
      },
      {
        name: 'jsonPath',
        type: 'input',
        default: userConfig.jsonPath || DEFAULT_CONFIG.jsonPath,
        required: false,
        message: '图片URL JSON路径(eg: data.url)',
        alias: 'JSON路径'
      }
    ];
  };

  // 返回一个对象，包含上传器名称和注册函数
  return {
    uploader: 'sda1',
    register
  };
};    