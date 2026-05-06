/**
 * DirectMail SDK封装
 * 阿里云邮件推送服务
 */
const DM = require('@alicloud/dm20151123');
const OpenApi = require('@alicloud/openapi-client');
const Util = require('@alicloud/tea-util');

/**
 * 创建DirectMail客户端
 */
function createClient() {
  const config = new OpenApi.Config({
    accessKeyId: process.env.ALIBABA_CLOUD_ACCESS_KEY_ID,
    accessKeySecret: process.env.ALIBABA_CLOUD_ACCESS_KEY_SECRET,
  });
  config.endpoint = 'dm.aliyuncs.com';
  return new DM(config);
}

/**
 * 发送邮件
 * @param {string} toAddress - 收件人邮箱
 * @param {string} subject - 邮件主题
 * @param {string} htmlBody - HTML邮件内容
 * @returns {Promise<boolean>}
 */
async function directMailSend(toAddress, subject, htmlBody) {
  try {
    const client = createClient();
    
    const sendMailRequest = new DM.SendMailRequest({
      accountName: 'noreply@keeneed.com',
      addressType: 1,
      toAddress: toAddress,
      subject: subject,
      htmlBody: htmlBody,
    });
    
    const runtime = new Util.RuntimeOptions({});
    
    const result = await client.sendMailWithOptions(sendMailRequest, runtime);
    
    console.log('DirectMail send result:', JSON.stringify(result));
    return true;
  } catch (error) {
    console.error('DirectMail send error:', error.message);
    // 如果阿里云SDK失败，回退到nodemailer
    return null;
  }
}

/**
 * 发送验证码邮件
 * @param {string} email - 收件人邮箱
 * @param {string} code - 验证码
 * @returns {Promise<boolean>}
 */
async function sendVerificationEmail(email, code) {
  const htmlBody = `
    <html>
    <body style="font-family:sans-serif;background:#0a0f1a;color:#e0e6ed;">
      <div style="max-width:500px;margin:0 auto;background:#111827;border-radius:12px;padding:30px;">
        <h2 style="color:#00f0ff;">KEENEED 验证码</h2>
        <p>您的验证码是：</p>
        <div style="font-size:32px;color:#00f0ff;letter-spacing:8px;">${code}</div>
        <p>5分钟内有效</p>
      </div>
    </body>
    </html>
  `;
  
  const result = await directMailSend(email, 'KEENEED 验证码', htmlBody);
  
  // 如果DirectMail失败，返回null让调用方决定是否使用nodemailer
  if (result === null) {
    return null;
  }
  
  return result;
}

module.exports = {
  directMailSend,
  sendVerificationEmail,
  createClient
};
