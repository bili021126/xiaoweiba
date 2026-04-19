const fs = require('fs');
const path = require('path');
const os = require('os');

// 检查数据库文件
const dbPath = path.join(os.homedir(), '.xiaoweiba', 'data', 'memory.db');
console.log('数据库路径:', dbPath);
console.log('文件存在:', fs.existsSync(dbPath));

if (fs.existsSync(dbPath)) {
  const stats = fs.statSync(dbPath);
  console.log('文件大小:', stats.size, 'bytes');
  console.log('最后修改时间:', stats.mtime.toLocaleString('zh-CN'));
  
  // 计算与当前时间的差值
  const now = new Date();
  const diffMs = now - stats.mtime;
  const diffMinutes = Math.floor(diffMs / 60000);
  console.log('距离最后修改:', diffMinutes, '分钟前');
  
  if (diffMinutes > 5) {
    console.log('\n⚠️  警告：数据库已经超过5分钟没有更新了！');
    console.log('这说明写操作没有触发save()，持久化机制可能失效。');
  } else {
    console.log('\n✅ 数据库在最近5分钟内被更新过，持久化机制正常工作。');
  }
} else {
  console.log('❌ 数据库文件不存在！');
}
