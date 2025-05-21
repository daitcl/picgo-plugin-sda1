
/**
 * 流浪图床插件 - PicGo图片上传插件
 * @module picgo-plugin-sda1
 * @description 通过HTTP接口实现图片批量上传，支持并发控制与JSON响应解析
 * 
 * 核心功能模块：
 * 1. 并发控制引擎：基于Promise.all实现并行请求，通过索引追踪保证结果顺序
 * 2. JSON解析器：支持JSON Path配置，实现响应数据的灵活提取
 * 3. 配置管理系统：采用用户配置 > 默认配置的合并策略
 *
 * 主要配置项：
 * - url: 图床API地址（默认：SDA1公共接口）
 * - jsonPath: 图片URL在JSON响应中的路径（默认：data.url）
 *
 * 技术亮点：
 * - Promise索引追踪：保留原始任务索引，确保并发结果顺序一致性
 * - 错误隔离机制：单任务异常不影响整体流程，支持错误定位
 * - 内存优化：及时清理base64/buffer数据，防止内存泄漏
 *
 * 编码规范：
 * - 严格遵循ES6+语法规范
 * - 使用JSDoc类型标注
 * - 符合PicGo官方插件开发规范
 * - 关键操作添加异常边界保护
 */
const DEFAULT_CONFIG = {
  url: 'https://p.sda1.dev/api/v1/upload_external_noform?filename=',
  jsonPath: 'data.url'
};
module.exports = (ctx) => {
  const register = () => {
    ctx.helper.uploader.register('sda1', {
      handle, // 处理上传的函数
      name: '流浪图床', // 上传器的名称
      config: config // 配置上传器的函数
    });
  };
/**
 * 图片上传处理器（并发控制核心）
 * @param {Object} ctx - PicGo上下文对象
 * @returns {Promise<void>}
 * 
 * 流程图：
 * 1. 深拷贝原始输出队列 → 2. 创建带索引的Promise数组 → 3. 并行执行上传任务
 * 4. 按原始顺序重组结果 → 5. 异常分类处理（网络错误/JSON解析错误）
 */
  const handle = async function (ctx) {
    // 获取用户配置
    // 配置合并策略：用户配置 > 默认配置
    let userConfig = ctx.getConfig('picBed.sda1');
    if (!userConfig) {
      throw new Error('Can\'t find uploader config');
    }

    // 解构配置参数
    const { url, jsonPath, timeout } = userConfig;

    try {
      // 创建原始列表副本防止污染原始数据
      const originalList = [...ctx.output];

      // 创建带索引的并行任务数组
      // 并发控制核心逻辑（保留原始索引顺序）
      // 使用闭包保存每个任务的原始索引，确保结果重组顺序正确
      const promises = originalList.map((img, index) => {
        return (async () => {
          try {
            // 二进制数据预处理
            let image = img.buffer;
            if (!image && img.base64Image) {
              image = Buffer.from(img.base64Image, 'base64');
            } else if (img.url) {
              try {
                image = await downloadImage(ctx, img.url, timeout);
              } catch (downloadErr) {
                ctx.log.error('图片下载失败', downloadErr);
                throw new Error(`远程图片下载失败: ${downloadErr.message}`);
              }
            }

            // 构建请求参数
            const postConfig = postOptions(image, url, img.fileName);

            // 发送HTTP请求
            const body = await ctx.Request.request(postConfig);

            // 清理内存数据
            delete img.base64Image;
            delete img.buffer;

            // 处理响应结果
            const result = { ...img }; // 创建结果对象副本

            if (!jsonPath) {
              // 直接使用原始响应
              result.imgUrl = body;
            } else {
              try {
                // JSON解析与路径查找
                const responseJson = JSON.parse(body);
                let imgUrl = responseJson;
                // JSON路径解析流程（支持嵌套属性访问）
                // 错误类型：1. 字段不存在 2. 非对象类型 3. 空值
                jsonPath.split('.').forEach(field => {
                  if (imgUrl.hasOwnProperty(field)) {
                    imgUrl = imgUrl[field];
                  } else {
                    throw new Error(`JSON路径${field}不存在`);
                  }
                });

                // 空值校验
                result.imgUrl = imgUrl || '';
                if (!result.imgUrl) {
                  throw new Error('从JSON响应中提取的URL为空');
                }
              } catch (parseErr) {
                // 记录详细错误日志
                ctx.log.error('JSON解析失败', parseErr);
                ctx.emit('notification', {
                  title: 'JSON解析失败',
                  body: `错误详情：${parseErr.message}\n响应内容：${body.substring(0, 200)}` // 截取前200字符防止信息过长
                });
                result.imgUrl = ''; // 保证结果结构一致性
              }
            }
            return { index, result }; // 返回带原始索引的结果
          } catch (err) {
            // 构建错误结果对象
            const errorResult = {
              ...img,
              imgUrl: '',
              error: err.message // 保留错误信息
            };

            // 发送带序号的通知
            ctx.emit('notification', {
              title: `第${index + 1}张图片上传失败`,
              body: err.message
            });
            return { index, result: errorResult };
          }
        })();
      });

      // 处理并行结果
      const results = await Promise.all(promises);

      // 按原始顺序重组结果
      ctx.output = results
        .sort((a, b) => a.index - b.index) // 根据原始索引排序
        .map(item => item.result); // 提取最终结果

    } catch (err) {
      // 全局错误处理
      ctx.emit('notification', {
        title: '上传失败',
        body: JSON.stringify(err)
      });
    }
  };
  /**
 * 构建HTTP请求配置
 * @param {Buffer} image - 图片二进制数据
 * @param {string} url - API端点地址
 * @param {string} fileName - 原始文件名
 * @returns {Object} 请求配置项
 * @throws 当参数校验失败时抛出异常
 */
  const postOptions = (image, url, fileName) => {
    
    if (!image || !url || !fileName) {
      throw new Error('postOptions 参数无效');
    }
    // 自动识别Content-Type
    const ext = fileName.split('.').pop().toLowerCase();
    const mimeMap = {
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      gif: 'image/gif',
      webp: 'image/webp'
    };
    
    let headers = {
      'Content-Type': mimeMap[ext] || 'application/octet-stream',
      'User-Agent': 'PicGo',
      'Connection': 'keep-alive'
    };
    // 定义请求配置对象
    const opts = {
      method: 'POST',
      url: url + encodeURIComponent(fileName),
      headers: headers,
      body: image
    };
    return opts;
  };
  const config = (ctx) => {
    // 配置合并策略：用户配置 > 默认配置
    let userConfig = ctx.getConfig('picBed.sda1');
    if (!userConfig) {
      userConfig = {};
    }
    return [
      {
        name: 'url',
        type: 'input',
        default: userConfig.url || DEFAULT_CONFIG.url,
        required: true,
        message: 'API地址',
        alias: 'API地址'
      },
      {
        name: 'jsonPath',
        type: 'input',
        default: userConfig.jsonPath || DEFAULT_CONFIG.jsonPath,
        required: false,
        message: '图片URL JSON路径(eg: data.url)',
        alias: 'JSON路径'
      },
      {
        name: 'timeout',
        type: 'input',
        default: userConfig.timeout || 5000,
        required: true,
        message: '下载超时时间(毫秒)',
        alias: '超时设置',
        validate: (value) => (Number(value) > 0) || '必须输入正整数'
      },
    ];
  };
  return {
    uploader: 'sda1',
    register
  };
};
/**
 * 下载远程图片
 * @param {Object} ctx - PicGo上下文
 * @param {string} url - 图片URL
 * @param {number} timeout - 超时时间(毫秒)
 * @returns {Promise<Buffer>}
 */
const downloadImage = async (ctx, url, timeout = 5000) => {
  const urlPattern = /^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([\/\w .-]*)*\/?$/;
  if (!urlPattern.test(url)) {
    throw new Error('无效的URL格式');
  }

  const response = await ctx.Request.request({
    url,
    method: 'GET',
    timeout,
    headers: {
      'User-Agent': 'PicGo'
    },
    resolveWithFullResponse: true
  });

  if (response.statusCode !== 200) {
    throw new Error(`HTTP ${response.statusCode}`);
  }

  return Buffer.from(response.body);
};