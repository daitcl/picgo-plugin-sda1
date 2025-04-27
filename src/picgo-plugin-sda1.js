const axios = require('axios');
const FormData = require('form-data');
const log = require('picgo/dist/utils/log');

module.exports = (ctx) => {
    const register = () => {
        ctx.helper.uploader.register('sda1', {
            handle: async (ctx) => {
                let imgList = ctx.output;
                const config = ctx.getConfig('picgo-plugin-sda1');
                const uploadUrl = config.uploadUrl || 'https://p.sda1.dev/upload';

                for (let i = 0; i < imgList.length; i++) {
                    let img = imgList[i];
                    if (!img.file) {
                        log.error('Can\'t find image');
                        throw new Error('Can\'t find image');
                    }
                    let formData = new FormData();
                    formData.append('image', img.buffer, {
                        filename: img.fileName,
                        contentType: img.mimeType
                    });
                    try {
                        log.info(`Uploading image: ${img.fileName}`);
                        const response = await axios.post(uploadUrl, formData, {
                            headers: formData.getHeaders()
                        });
                        img.imgUrl = response.data.url;
                        log.success(`Image ${img.fileName} uploaded successfully. URL: ${img.imgUrl}`);
                    } catch (error) {
                        log.error(`Upload failed for image ${img.fileName}: ${error.message}`);
                        throw new Error(`Upload failed: ${error.message}`);
                    }
                }
                return ctx;
            },
            name: 'SDA1 图床',
            config: (ctx) => {
                const defaultUploadUrl = 'https://p.sda1.dev/upload';
                return [
                    {
                        name: 'uploadUrl',
                        type: 'input',
                        default: defaultUploadUrl,
                        required: false,
                        message: `请输入图床的上传地址（默认: ${defaultUploadUrl}）`,
                        alias: '上传地址'
                    }
                ];
            }
        });
    };
    return {
        register
    };
};    