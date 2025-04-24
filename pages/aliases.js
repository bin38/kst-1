import Head from 'next/head';
import { parse } from 'cookie';
import { useState, useEffect } from 'react';

// 不再需要 checkUserExistsClientSide

export async function getServerSideProps({ req }) {
  const cookies = parse(req.headers.cookie || '');
  const oauthUsername = cookies.oauthUsername;
  const trustLevel = parseInt(cookies.oauthTrustLevel || '0', 10);
  const requiredTrustLevel = parseInt(process.env.REQUIRED_TRUST_LEVEL || '3', 10);

  // Basic validation: user must be logged in and meet trust level
  if (!oauthUsername || trustLevel < requiredTrustLevel) {
    return { redirect: { destination: '/', permanent: false } };
  }

  // 确定主邮箱和别名
  const rawDom = process.env.EMAIL_DOMAIN;
  const domain = rawDom.startsWith('@') ? rawDom.slice(1) : rawDom;
  const cleanPrimaryUsername = oauthUsername.split('@')[0];
  const studentEmail = `${cleanPrimaryUsername}@${domain}`;
  const secondaryEmail = `kst_${cleanPrimaryUsername}@${domain}`; // 这是别名

  // 可以在这里添加服务器端检查别名是否存在的逻辑（可选但更健壮）
  // let aliasExists = null;
  // try {
  //   const token = await fetchGoogleToken(); // 需要引入或重构 fetchGoogleToken
  //   const res = await fetch(`https://admin.googleapis.com/admin/directory/v1/users/${studentEmail}/aliases/${secondaryEmail}`, { headers: { Authorization: `Bearer ${token}` } });
  //   aliasExists = res.ok;
  // } catch (e) { console.error("Error checking alias existence:", e); }

  return {
    props: {
      studentEmail, // 主邮箱
      aliasEmail: secondaryEmail, // 别名邮箱
      emailDomain: domain,
      // initialAliasExists: aliasExists, // 传递初始状态
    },
  };
}

// 修改 props 接收 aliasEmail
export default function ManageAliasesPage({ studentEmail, aliasEmail, emailDomain /*, initialAliasExists */ }) {
  const [isLoadingAdd, setIsLoadingAdd] = useState(false);
  const [isLoadingDelete, setIsLoadingDelete] = useState(false);
  const [result, setResult] = useState(null);
  // 不再需要 accountInfo 和 accountExists 状态
  // const [aliasExists, setAliasExists] = useState(initialAliasExists); // 使用从服务器获取的初始状态

  // Handle Add Alias
  const handleAdd = async () => {
    setIsLoadingAdd(true);
    setResult(null);

    try {
      const res = await fetch('/api/aliases/add', {
        method: 'POST',
        // API 现在根据 cookie 自动确定别名，无需发送 body
      });

      const data = await res.json(); // 尝试解析 JSON

      if (res.ok || res.status === 409) { // 成功或已存在都算成功处理
        setResult({ type: 'success', message: data.message || (res.status === 409 ? `别名 ${aliasEmail} 已存在。` : '别名添加成功！') });
        // setAliasExists(true); // 更新状态
      } else {
        setResult({ type: 'error', message: data.message || `添加失败: ${await res.text()}` });
      }
    } catch (error) {
      console.error("调用添加 API 出错:", error);
      setResult({ type: 'error', message: '发生意外错误。' });
    } finally {
      setIsLoadingAdd(false);
    }
  };

  // Handle Delete Alias
  const handleDelete = async () => {
    if (!confirm(`确定要删除别名 ${aliasEmail} 吗？`)) {
      return;
    }
    setIsLoadingDelete(true);
    setResult(null);

    try {
      const res = await fetch('/api/aliases/delete', {
        method: 'POST', // 前端仍用 POST 调用
      });

      const data = await res.json(); // 尝试解析 JSON

      if (res.ok || res.status === 404) { // 成功或未找到都算成功处理
        setResult({ type: 'success', message: data.message || (res.status === 404 ? `别名 ${aliasEmail} 未找到或已被删除。` : '别名删除成功！') });
        // setAliasExists(false); // 更新状态
      } else {
        setResult({ type: 'error', message: data.message || `删除失败: ${await res.text()}` });
      }
    } catch (error) {
      console.error("调用删除 API 出错:", error);
      setResult({ type: 'error', message: '发生意外错误。' });
    } finally {
      setIsLoadingDelete(false);
    }
  };

  return (
    <>
      <Head>
        <title>管理邮箱别名</title> {/* 更新标题 */}
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0" />
      </Head>
      <div className="container">
        <div className="school-header">
          <img src="/img/logo.png" alt="KST Logo" className="logo" />
          <div className="school-text">
            <h1>吉尔吉斯坦科技大学</h1>
            <h2>管理邮箱别名</h2> {/* 更新副标题 */}
          </div>
        </div>

        <div className="info">
          <p><strong>你的主邮箱:</strong> {studentEmail}</p>
          {/* 更新说明文字 */}
          <p>此页面用于管理附加到你主账户的邮箱别名:</p>
          <p><strong><code className="email-code">{aliasEmail}</code></strong></p>
          <p><strong>注意:</strong> 添加别名后，发送到 <code className="email-code">{aliasEmail}</code> 的邮件将会自动进入你的主邮箱 <code className="email-code">{studentEmail}</code> 的收件箱。</p>
          <p>你也可以设置 Gmail，使其能够以 <code className="email-code">{aliasEmail}</code> 的名义发送邮件。</p>
        </div>

        {/* 操作按钮 */}
        <div className="actions">
           {/* 简化按钮逻辑，用户可以随时尝试添加或删除 */}
           <button onClick={handleAdd} disabled={isLoadingAdd || isLoadingDelete} className="add-button">
             {isLoadingAdd ? '正在添加...' : '添加/确认别名'}
           </button>
           <button onClick={handleDelete} disabled={isLoadingAdd || isLoadingDelete} className="delete-button">
             {isLoadingDelete ? '正在删除...' : '删除别名'}
           </button>
        </div>
         {/* 可以移除状态提示，让用户通过按钮操作和结果信息判断 */}
         {/* {aliasExists === true && <p className="status-note">别名当前已激活。</p>}
         {aliasExists === false && <p className="status-note">别名当前未激活或已被删除。</p>}
         {aliasExists === null && <p className="status-note">正在检查别名状态...</p>} */}


        {/* 显示结果 */}
        {result && (
          <div className={`result-message ${result.type}`}>
            <p>{result.message}</p>
            {/* 移除显示密码和许可证警告的部分 */}
          </div>
        )}

        <p className="back-link">
          <a href="/student-portal">← 返回门户</a>
        </p>
      </div>

      <style jsx>{`
        .container {
          max-width: 700px;
          margin: 40px auto;
          padding: 0 20px;
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        }
        .school-header {
          display: flex;
          align-items: center;
          gap: 15px;
          margin-bottom: 30px;
          padding-bottom: 15px;
          border-bottom: 1px solid #eee;
        }
        .logo {
            width: 50px;
            height: 50px;
            object-fit: contain;
        }
        .school-text h1 {
          margin: 0;
          font-size: 22px;
          color: #152b64; /* KST Blue */
        }
        .school-text h2 {
          margin: 4px 0 0;
          font-size: 18px;
          color: #555;
          font-weight: 400;
        }
        .info {
          background: #f0f4f8;
          padding: 16px 20px;
          border-radius: 8px;
          margin-bottom: 25px;
          border: 1px solid #d1e0ec;
          font-size: 0.98em;
          line-height: 1.6;
        }
        .info p {
          margin: 8px 0;
        }
        .email-code {
            background-color: #e3eaf3;
            padding: 2px 6px;
            border-radius: 4px;
            font-family: monospace;
            word-break: break-all; /* 确保长邮箱地址能换行 */
        }

        .actions {
          display: flex;
          gap: 15px;
          margin-bottom: 20px; /* 调整间距 */
        }
        .actions button {
          flex: 1; /* Make buttons share space */
          padding: 12px 16px;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          font-size: 1.05em;
          transition: background-color 0.2s, opacity 0.2s;
          font-weight: 500;
        }
        .add-button {
          background-color: #28a745; /* Green */
          color: #fff;
        }
        .add-button:hover:not(:disabled) {
          background-color: #218838;
        }
        .delete-button {
          background-color: #dc3545; /* Red */
          color: #fff;
        }
        .delete-button:hover:not(:disabled) {
          background-color: #c82333;
        }
        .actions button:disabled {
          background-color: #aaa;
          cursor: not-allowed;
          opacity: 0.7;
        }

        .result-message {
          padding: 15px 20px;
          margin-top: 25px;
          border-radius: 6px;
          border: 1px solid;
        }
        .result-message.success {
          background-color: #d4edda;
          border-color: #c3e6cb;
          color: #155724;
        }
        .result-message.error {
          background-color: #f8d7da;
          border-color: #f5c6cb;
          color: #721c24;
        }
        .result-message p {
          margin: 0 0 10px 0;
        }
        .result-message p:last-child {
           margin-bottom: 0; /* 移除结果消息最后一段的下边距 */
        }

        .back-link {
          text-align: center;
          margin-top: 30px;
        }
        .back-link a {
          color: #0070f3;
          text-decoration: none;
          font-size: 1em;
          padding: 8px 15px;
          border-radius: 5px;
          transition: background-color 0.2s;
        }
        .back-link a:hover {
          background-color: #e6f2ff;
          text-decoration: none;
        }

        /* 移动端适配 */
        @media (max-width: 480px) {
          .container {
            margin: 20px auto;
          }
          .school-header {
            flex-direction: column;
            align-items: flex-start;
            gap: 10px;
            text-align: left;
          }
          .school-text h1 { font-size: 20px; }
          .school-text h2 { font-size: 16px; }
          .actions {
              flex-direction: column; /* Stack buttons vertically */
          }
        }
      `}</style>
    </>
  );
}
