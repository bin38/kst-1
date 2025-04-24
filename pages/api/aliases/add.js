// pages/api/aliases/add.js
import cookie from 'cookie';

// 辅助函数：获取 Google Access Token
async function fetchGoogleToken() {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method:'POST',
    headers:{'Content-Type':'application/x-www-form-urlencoded'},
    body:new URLSearchParams({
      client_id:     process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
      grant_type:    'refresh_token'
    })
  });
  if (!res.ok) {
      console.error('获取 Token 失败:', await res.text());
      throw new Error('Token 错误');
  }
  const { access_token } = await res.json();
  return access_token;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ message: '方法不允许' });
  }

  const cookies = cookie.parse(req.headers.cookie || '');
  const primaryUsername = cookies.oauthUsername; // 来自 Linux.do OAuth 的用户名
  const trust = parseInt(cookies.oauthTrustLevel || '0', 10);
  const requiredTrustLevel = parseInt(process.env.REQUIRED_TRUST_LEVEL || '3', 10);

  if (!primaryUsername || trust < requiredTrustLevel) {
    return res.status(403).json({ message: '禁止访问' });
  }

  // 确定主邮箱地址和要添加的别名地址
  const rawDom = process.env.EMAIL_DOMAIN;
  const domain = rawDom.startsWith('@') ? rawDom.slice(1) : rawDom;
  const cleanPrimaryUsername = primaryUsername.split('@')[0];
  const primaryEmail = `${cleanPrimaryUsername}@${domain}`; // 主用户邮箱
  const aliasToAdd = `kst_${cleanPrimaryUsername}@${domain}`; // 要添加的别名

  // --- 添加别名逻辑 ---
  try {
    // 获取 Google Access Token
    const access_token = await fetchGoogleToken();

    // 调用 Google Admin SDK 添加别名
    const addAliasRes = await fetch(
      `https://admin.googleapis.com/admin/directory/v1/users/${encodeURIComponent(primaryEmail)}/aliases`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ alias: aliasToAdd }), // API 需要 alias 字段
      }
    );

    // 处理响应
    if (addAliasRes.ok) {
      // 成功添加别名
      console.log(`成功为用户 ${primaryEmail} 添加别名: ${aliasToAdd}`);
      return res.status(200).json({ message: `别名 ${aliasToAdd} 添加成功。` });
    } else {
      // 处理错误
      const errorData = await addAliasRes.json();
      console.error(`为用户 ${primaryEmail} 添加别名 ${aliasToAdd} 失败:`, errorData);
      const message = errorData.error?.message || '添加别名失败';
      // 特别处理别名已存在的错误 (通常是 409 Conflict)
      if (addAliasRes.status === 409) {
        return res.status(409).json({ message: `别名 ${aliasToAdd} 已存在。` });
      }
      return res.status(addAliasRes.status).json({ message: `添加别名失败: ${message}` });
    }

  } catch (error) {
    console.error(`处理为用户 ${primaryEmail} 添加别名 ${aliasToAdd} 的请求时出错:`, error);
    // 检查是否是 fetchGoogleToken 抛出的错误
    if (error.message === 'Token 错误') {
        return res.status(500).json({ message: '无法获取操作权限，请检查服务器配置。'});
    }
    res.status(500).json({ message: '处理请求时发生内部服务器错误。' });
  }
}
