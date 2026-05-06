const OpenApi = require('@alicloud/openapi-client');
const Dm = require('@alicloud/dm20151123');
const Util = require('@alicloud/tea-util');

let dmClient = null;

function getClient() {
  if (dmClient) return dmClient;
  const config = new OpenApi.Config({
    accessKeyId: process.env.ALIYUN_ACCESS_KEY_ID || 'LTAI5t6xVN8WLx99aHrHY7NU',
    accessKeySecret: process.env.ALIYUN_ACCESS_KEY_SECRET || '',
    endpoint: 'dm.aliyuncs.com',
  });
  dmClient = new Dm.default(config);
  return dmClient;
}

async function sendMail(to, subject, htmlBody) {
  try {
    const client = getClient();
    const req = new Dm.SingleSendMailRequest({
      accountName: 'noreply@keeneed.com',
      addressType: 1,
      replyToAddress: false,
      toAddress: to,
      subject: subject,
      htmlBody: htmlBody,
      fromAlias: 'KEENEED',
    });
    const runtime = new Util.RuntimeOptions({});
    const resp = await client.singleSendMailWithOptions(req, runtime);
    console.log('DirectMail sent:', resp.body.requestId);
    return true;
  } catch (err) {
    console.error('DirectMail error:', err.message);
    return false;
  }
}

module.exports = { sendMail };
