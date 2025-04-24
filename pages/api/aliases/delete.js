// pages/api/aliases/delete.js
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
  if (req.method !== 'POST') { // API 期望 DELETE，但前端用 POST 调用
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

  // 确定主邮箱地址和要删除的别名地址
  const rawDom = process.env.EMAIL_DOMAIN;
  const domain = rawDom.startsWith('@') ? rawDom.slice(1) : rawDom;
  const cleanPrimaryUsername = primaryUsername.split('@')[0];
  const primaryEmail = `${cleanPrimaryUsername}@${domain}`; // 主用户邮箱
  const aliasToDelete = `kst_${cleanPrimaryUsername}@${domain}`; // 要删除的别名

  // *** 安全检查：禁止删除主登录邮箱本身 ***
  // (虽然 API 不允许，但加一层保险)
  if (aliasToDelete.toLowerCase() === primaryEmail.toLowerCase()) {
      console.warn(`尝试通过别名删除端点删除主邮箱 (${primaryEmail}) 的操作已被阻止。`);
      return res.status(400).json({ message: '无法删除主邮箱地址。' });
  }

  // --- 删除别名逻辑 ---
  try {
    // 获取 Access Token
    const access_token = await fetchGoogleToken();

    // 调用 Google Admin SDK 删除别名
    const delAliasRes = await fetch(
      `https://admin.googleapis.com/admin/directory/v1/users/${encodeURIComponent(primaryEmail)}/aliases/${encodeURIComponent(aliasToDelete)}`,
      {
        method: 'DELETE', // 使用正确的 HTTP 方法
        headers: { Authorization: `Bearer ${access_token}` },
      }
    );

    // 处理响应
    // Google API 在成功删除时返回 204 No Content
    if (delAliasRes.status === 204) {
      console.log(`成功从用户 ${primaryEmail} 删除别名: ${aliasToDelete}`);
      return res.status(200).json({ message: `别名 ${aliasToDelete} 删除成功。` });
    } else if (delAliasRes.status === 404) {
      // 如果别名本身就不存在
       console.log(`尝试删除不存在的别名 ${aliasToDelete} (用户 ${primaryEmail})`);
       return res.status(404).json({ message: `别名 ${aliasToDelete} 未找到或不属于该用户。` });
    } else {
      // 处理其他错误
      let errorText = `删除别名失败，状态码: ${delAliasRes.status}`;
       try {
           const errorData = await delAliasRes.json(); // 尝试解析错误详情
           errorText = errorData.error?.message || errorText;
       } catch (e) {
           // 如果无法解析 JSON，使用状态码
       }
      console.error(`从用户 ${primaryEmail} 删除别名 ${aliasToDelete} 失败:`, errorText);
      return res.status(delAliasRes.status).json({ message: `删除别名失败: ${errorText}` });
    }

  } catch (error) {
    console.error(`处理从用户 ${primaryEmail} 删除别名 ${aliasToDelete} 的请求时出错:`, error);
     // 检查是否是 fetchGoogleToken 抛出的错误
    if (error.message === 'Token 错误') {
        return res.status(500).json({ message: '无法获取操作权限，请检查服务器配置。'});
    }
    res.status(500).json({ message: '处理请求时发生内部服务器错误。' });
  }
}
