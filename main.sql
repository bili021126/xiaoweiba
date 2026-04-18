/*
 Navicat Premium Dump SQL

 Source Server         : memory
 Source Server Type    : SQLite
 Source Server Version : 3045000 (3.45.0)
 Source Schema         : main

 Target Server Type    : SQLite
 Target Server Version : 3045000 (3.45.0)
 File Encoding         : 65001

 Date: 19/04/2026 04:32:24
*/

PRAGMA foreign_keys = false;

-- ----------------------------
-- Table structure for episodic_memory
-- ----------------------------
DROP TABLE IF EXISTS "episodic_memory";
CREATE TABLE "episodic_memory" (
  "id" TEXT,
  "project_fingerprint" TEXT NOT NULL,
  "timestamp" INTEGER NOT NULL,
  "task_type" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "entities" TEXT,
  "decision" TEXT,
  "outcome" TEXT NOT NULL,
  "final_weight" REAL NOT NULL,
  "model_id" TEXT NOT NULL,
  "latency_ms" INTEGER,
  "vector" BLOB,
  "memory_tier" TEXT DEFAULT 'LONG_TERM',
  "last_accessed_at" INTEGER,
  "metadata" TEXT,
  PRIMARY KEY ("id")
);

-- ----------------------------
-- Records of episodic_memory
-- ----------------------------
INSERT INTO "episodic_memory" VALUES ('backup-test-1776484821856', 'fp-test', 1776484821856, 'CODE_GENERATE', 'Backup test', '["test"]', NULL, 'SUCCESS', 0.9, 'gpt-4', 1200, NULL, 'LONG_TERM', NULL, NULL);
INSERT INTO "episodic_memory" VALUES ('backup-test-1776484845097', 'fp-test', 1776484845097, 'CODE_GENERATE', 'Backup test', '["test"]', NULL, 'SUCCESS', 0.9, 'gpt-4', 1200, NULL, 'LONG_TERM', NULL, NULL);
INSERT INTO "episodic_memory" VALUES ('backup-test-1776485058401', 'fp-test', 1776485058401, 'CODE_GENERATE', 'Backup test', '["test"]', NULL, 'SUCCESS', 0.9, 'gpt-4', 1200, NULL, 'LONG_TERM', NULL, NULL);
INSERT INTO "episodic_memory" VALUES ('backup-test-1776485118773', 'fp-test', 1776485118773, 'CODE_GENERATE', 'Backup test', '["test"]', NULL, 'SUCCESS', 0.9, 'gpt-4', 1200, NULL, 'LONG_TERM', NULL, NULL);
INSERT INTO "episodic_memory" VALUES ('backup-test-1776485200324', 'fp-test', 1776485200324, 'CODE_GENERATE', 'Backup test', '["test"]', NULL, 'SUCCESS', 0.9, 'gpt-4', 1200, NULL, 'LONG_TERM', NULL, NULL);
INSERT INTO "episodic_memory" VALUES ('backup-test-1776485270867', 'fp-test', 1776485270867, 'CODE_GENERATE', 'Backup test', '["test"]', NULL, 'SUCCESS', 0.9, 'gpt-4', 1200, NULL, 'LONG_TERM', NULL, NULL);
INSERT INTO "episodic_memory" VALUES ('backup-test-1776485600430', 'fp-test', 1776485600430, 'CODE_GENERATE', 'Backup test', '["test"]', NULL, 'SUCCESS', 0.9, 'gpt-4', 1200, NULL, 'LONG_TERM', NULL, NULL);
INSERT INTO "episodic_memory" VALUES ('backup-test-1776485855404', 'fp-test', 1776485855404, 'CODE_GENERATE', 'Backup test', '["test"]', NULL, 'SUCCESS', 0.9, 'gpt-4', 1200, NULL, 'LONG_TERM', NULL, NULL);
INSERT INTO "episodic_memory" VALUES ('backup-test-1776486581288', 'fp-test', 1776486581288, 'CODE_GENERATE', 'Backup test', '["test"]', NULL, 'SUCCESS', 0.9, 'gpt-4', 1200, NULL, 'LONG_TERM', NULL, NULL);
INSERT INTO "episodic_memory" VALUES ('backup-test-1776486776977', 'fp-test', 1776486776977, 'CODE_GENERATE', 'Backup test', '["test"]', NULL, 'SUCCESS', 0.9, 'gpt-4', 1200, NULL, 'LONG_TERM', NULL, NULL);
INSERT INTO "episodic_memory" VALUES ('backup-test-1776487059939', 'fp-test', 1776487059939, 'CODE_GENERATE', 'Backup test', '["test"]', NULL, 'SUCCESS', 0.9, 'gpt-4', 1200, NULL, 'LONG_TERM', NULL, NULL);
INSERT INTO "episodic_memory" VALUES ('backup-test-1776487246821', 'fp-test', 1776487246821, 'CODE_GENERATE', 'Backup test', '["test"]', NULL, 'SUCCESS', 0.9, 'gpt-4', 1200, NULL, 'LONG_TERM', NULL, NULL);
INSERT INTO "episodic_memory" VALUES ('backup-test-1776487547890', 'fp-test', 1776487547890, 'CODE_GENERATE', 'Backup test', '["test"]', NULL, 'SUCCESS', 0.9, 'gpt-4', 1200, NULL, 'LONG_TERM', NULL, NULL);
INSERT INTO "episodic_memory" VALUES ('backup-test-1776487696775', 'fp-test', 1776487696775, 'CODE_GENERATE', 'Backup test', '["test"]', NULL, 'SUCCESS', 0.9, 'gpt-4', 1200, NULL, 'LONG_TERM', NULL, NULL);
INSERT INTO "episodic_memory" VALUES ('backup-test-1776488038722', 'fp-test', 1776488038722, 'CODE_GENERATE', 'Backup test', '["test"]', NULL, 'SUCCESS', 0.9, 'gpt-4', 1200, NULL, 'LONG_TERM', NULL, NULL);
INSERT INTO "episodic_memory" VALUES ('backup-test-1776488065694', 'fp-test', 1776488065694, 'CODE_GENERATE', 'Backup test', '["test"]', NULL, 'SUCCESS', 0.9, 'gpt-4', 1200, NULL, 'LONG_TERM', NULL, NULL);
INSERT INTO "episodic_memory" VALUES ('backup-test-1776488111593', 'fp-test', 1776488111593, 'CODE_GENERATE', 'Backup test', '["test"]', NULL, 'SUCCESS', 0.9, 'gpt-4', 1200, NULL, 'LONG_TERM', NULL, NULL);
INSERT INTO "episodic_memory" VALUES ('ep_1776489745180_x31dzl0', '58bbd4ea83f9aa51916f420508a938a7dd2c60f0dda96fea84dc3344f6157833', 1776489745180, 'CHAT', '现在记得我刚刚做了什么吗？ ... 哈', '[]', NULL, 'SUCCESS', 8.0, 'local-rule', NULL, NULL, 'SHORT_TERM', NULL, '{"sessionId":"session_1776357031299_xg1iy11"}');
INSERT INTO "episodic_memory" VALUES ('ep_1776490483053_0n616b6', '58bbd4ea83f9aa51916f420508a938a7dd2c60f0dda96fea84dc3344f6157833', 1776490483053, 'CHAT', '记得我刚刚做了什么操作吗？ ... 虾', '[]', NULL, 'SUCCESS', 8.0, 'local-rule', NULL, NULL, 'SHORT_TERM', NULL, '{"sessionId":"session_1776357029684_0lvexun"}');
INSERT INTO "episodic_memory" VALUES ('ep_1776490483533_vbscxcw', '58bbd4ea83f9aa51916f420508a938a7dd2c60f0dda96fea84dc3344f6157833', 1776490483533, 'CHAT', '现在记得我刚刚做了什么吗？ ... 哈', '[]', NULL, 'SUCCESS', 8.0, 'local-rule', NULL, NULL, 'SHORT_TERM', NULL, '{"sessionId":"session_1776357031299_xg1iy11"}');
INSERT INTO "episodic_memory" VALUES ('ep_1776490815288_oksgxgv', '58bbd4ea83f9aa51916f420508a938a7dd2c60f0dda96fea84dc3344f6157833', 1776490815288, 'CODE_EXPLAIN', 'Explained code', '[]', NULL, 'FAILED', 2.0, 'deepseek', 530, NULL, 'SHORT_TERM', NULL, NULL);
INSERT INTO "episodic_memory" VALUES ('ep_1776490929469_wndhdc2', '58bbd4ea83f9aa51916f420508a938a7dd2c60f0dda96fea84dc3344f6157833', 1776490929469, 'CODE_EXPLAIN', 'Explained code', '[]', NULL, 'SUCCESS', 8.0, 'deepseek', 7385, NULL, 'SHORT_TERM', NULL, NULL);
INSERT INTO "episodic_memory" VALUES ('ep_1776491510371_uicwne6', '58bbd4ea83f9aa51916f420508a938a7dd2c60f0dda96fea84dc3344f6157833', 1776491510371, 'CHAT', '发送 ... 这是第几次了', '[]', NULL, 'SUCCESS', 8.0, 'local-rule', NULL, NULL, 'SHORT_TERM', NULL, '{"sessionId":"session_1776490635032_psj6y17"}');
INSERT INTO "episodic_memory" VALUES ('ep_1776491544780_byel2c1', '58bbd4ea83f9aa51916f420508a938a7dd2c60f0dda96fea84dc3344f6157833', 1776491544780, 'CODE_EXPLAIN', 'Explained code', '[]', NULL, 'SUCCESS', 8.0, 'deepseek', 6948, NULL, 'SHORT_TERM', NULL, NULL);
INSERT INTO "episodic_memory" VALUES ('ep_1776491583812_av423zu', '58bbd4ea83f9aa51916f420508a938a7dd2c60f0dda96fea84dc3344f6157833', 1776491583812, 'CODE_EXPLAIN', 'Explained code', '[]', NULL, 'FAILED', 2.0, 'deepseek', 3, NULL, 'SHORT_TERM', NULL, NULL);
INSERT INTO "episodic_memory" VALUES ('ep_1776491583815_8gsrtux', '58bbd4ea83f9aa51916f420508a938a7dd2c60f0dda96fea84dc3344f6157833', 1776491583815, 'CHAT_COMMAND', '聊天触发命令: explainCode', '["explainCode","我进行了代码解释操作，你的记忆没读取到吗、"]', '我进行了代码解释操作，你的记忆没读取到吗、', 'SUCCESS', 8.0, 'deepseek', 7, NULL, 'SHORT_TERM', NULL, NULL);
INSERT INTO "episodic_memory" VALUES ('ep_1776491596153_kuluavn', '58bbd4ea83f9aa51916f420508a938a7dd2c60f0dda96fea84dc3344f6157833', 1776491596153, 'CODE_EXPLAIN', 'Explained code', '[]', NULL, 'SUCCESS', 8.0, 'deepseek', 4887, NULL, 'SHORT_TERM', NULL, NULL);
INSERT INTO "episodic_memory" VALUES ('ep_1776491632358_9d2hlkf', '58bbd4ea83f9aa51916f420508a938a7dd2c60f0dda96fea84dc3344f6157833', 1776491632358, 'CHAT', '发送 ... 这是第几次了', '[]', NULL, 'SUCCESS', 8.0, 'local-rule', NULL, NULL, 'SHORT_TERM', NULL, '{"sessionId":"session_1776490635032_psj6y17"}');
INSERT INTO "episodic_memory" VALUES ('ep_1776491930925_cwqdqiw', '58bbd4ea83f9aa51916f420508a938a7dd2c60f0dda96fea84dc3344f6157833', 1776491930925, 'CHAT', '发送 ... 这是第几次了', '[]', NULL, 'SUCCESS', 8.0, 'local-rule', NULL, NULL, 'SHORT_TERM', NULL, '{"sessionId":"session_1776490635032_psj6y17"}');
INSERT INTO "episodic_memory" VALUES ('ep_1776491942045_b02vdvp', '58bbd4ea83f9aa51916f420508a938a7dd2c60f0dda96fea84dc3344f6157833', 1776491942045, 'CHAT', '喂喂，还记得我问了你什么吗？ ... 现在还记得我刚才做了什么', '[]', NULL, 'SUCCESS', 8.0, 'local-rule', NULL, NULL, 'SHORT_TERM', NULL, '{"sessionId":"session_1776491506176_7fvsw85"}');
INSERT INTO "episodic_memory" VALUES ('backup-test-1776501127696', 'fp-test', 1776501127696, 'CODE_GENERATE', 'Backup test', '["test"]', NULL, 'SUCCESS', 0.9, 'gpt-4', 1200, NULL, 'LONG_TERM', NULL, NULL);
INSERT INTO "episodic_memory" VALUES ('backup-test-1776501160044', 'fp-test', 1776501160044, 'CODE_GENERATE', 'Backup test', '["test"]', NULL, 'SUCCESS', 0.9, 'gpt-4', 1200, NULL, 'LONG_TERM', NULL, NULL);
INSERT INTO "episodic_memory" VALUES ('backup-test-1776501248634', 'fp-test', 1776501248634, 'CODE_GENERATE', 'Backup test', '["test"]', NULL, 'SUCCESS', 0.9, 'gpt-4', 1200, NULL, 'LONG_TERM', NULL, NULL);
INSERT INTO "episodic_memory" VALUES ('backup-test-1776501392631', 'fp-test', 1776501392631, 'CODE_GENERATE', 'Backup test', '["test"]', NULL, 'SUCCESS', 0.9, 'gpt-4', 1200, NULL, 'LONG_TERM', NULL, NULL);
INSERT INTO "episodic_memory" VALUES ('backup-test-1776502194575', 'fp-test', 1776502194575, 'CODE_GENERATE', 'Backup test', '["test"]', NULL, 'SUCCESS', 0.9, 'gpt-4', 1200, NULL, 'LONG_TERM', NULL, NULL);
INSERT INTO "episodic_memory" VALUES ('backup-test-1776502235826', 'fp-test', 1776502235826, 'CODE_GENERATE', 'Backup test', '["test"]', NULL, 'SUCCESS', 0.9, 'gpt-4', 1200, NULL, 'LONG_TERM', NULL, NULL);
INSERT INTO "episodic_memory" VALUES ('backup-test-1776502288399', 'fp-test', 1776502288399, 'CODE_GENERATE', 'Backup test', '["test"]', NULL, 'SUCCESS', 0.9, 'gpt-4', 1200, NULL, 'LONG_TERM', NULL, NULL);
INSERT INTO "episodic_memory" VALUES ('backup-test-1776502354301', 'fp-test', 1776502354301, 'CODE_GENERATE', 'Backup test', '["test"]', NULL, 'SUCCESS', 0.9, 'gpt-4', 1200, NULL, 'LONG_TERM', NULL, NULL);
INSERT INTO "episodic_memory" VALUES ('backup-test-1776502378126', 'fp-test', 1776502378126, 'CODE_GENERATE', 'Backup test', '["test"]', NULL, 'SUCCESS', 0.9, 'gpt-4', 1200, NULL, 'LONG_TERM', NULL, NULL);
INSERT INTO "episodic_memory" VALUES ('backup-test-1776502433405', 'fp-test', 1776502433405, 'CODE_GENERATE', 'Backup test', '["test"]', NULL, 'SUCCESS', 0.9, 'gpt-4', 1200, NULL, 'LONG_TERM', NULL, NULL);
INSERT INTO "episodic_memory" VALUES ('backup-test-1776502488878', 'fp-test', 1776502488878, 'CODE_GENERATE', 'Backup test', '["test"]', NULL, 'SUCCESS', 0.9, 'gpt-4', 1200, NULL, 'LONG_TERM', NULL, NULL);
INSERT INTO "episodic_memory" VALUES ('backup-test-1776502603034', 'fp-test', 1776502603034, 'CODE_GENERATE', 'Backup test', '["test"]', NULL, 'SUCCESS', 0.9, 'gpt-4', 1200, NULL, 'LONG_TERM', NULL, NULL);
INSERT INTO "episodic_memory" VALUES ('backup-test-1776502639568', 'fp-test', 1776502639568, 'CODE_GENERATE', 'Backup test', '["test"]', NULL, 'SUCCESS', 0.9, 'gpt-4', 1200, NULL, 'LONG_TERM', NULL, NULL);
INSERT INTO "episodic_memory" VALUES ('backup-test-1776533142305', 'fp-test', 1776533142305, 'CODE_GENERATE', 'Backup test', '["test"]', NULL, 'SUCCESS', 0.9, 'gpt-4', 1200, NULL, 'LONG_TERM', NULL, NULL);
INSERT INTO "episodic_memory" VALUES ('backup-test-1776534042072', 'fp-test', 1776534042072, 'CODE_GENERATE', 'Backup test', '["test"]', NULL, 'SUCCESS', 0.9, 'gpt-4', 1200, NULL, 'LONG_TERM', NULL, NULL);
INSERT INTO "episodic_memory" VALUES ('backup-test-1776534070966', 'fp-test', 1776534070966, 'CODE_GENERATE', 'Backup test', '["test"]', NULL, 'SUCCESS', 0.9, 'gpt-4', 1200, NULL, 'LONG_TERM', NULL, NULL);
INSERT INTO "episodic_memory" VALUES ('backup-test-1776534105741', 'fp-test', 1776534105741, 'CODE_GENERATE', 'Backup test', '["test"]', NULL, 'SUCCESS', 0.9, 'gpt-4', 1200, NULL, 'LONG_TERM', NULL, NULL);
INSERT INTO "episodic_memory" VALUES ('backup-test-1776534307680', 'fp-test', 1776534307680, 'CODE_GENERATE', 'Backup test', '["test"]', NULL, 'SUCCESS', 0.9, 'gpt-4', 1200, NULL, 'LONG_TERM', NULL, NULL);
INSERT INTO "episodic_memory" VALUES ('backup-test-1776534332381', 'fp-test', 1776534332381, 'CODE_GENERATE', 'Backup test', '["test"]', NULL, 'SUCCESS', 0.9, 'gpt-4', 1200, NULL, 'LONG_TERM', NULL, NULL);
INSERT INTO "episodic_memory" VALUES ('backup-test-1776534363412', 'fp-test', 1776534363412, 'CODE_GENERATE', 'Backup test', '["test"]', NULL, 'SUCCESS', 0.9, 'gpt-4', 1200, NULL, 'LONG_TERM', NULL, NULL);
INSERT INTO "episodic_memory" VALUES ('backup-test-1776534608913', 'fp-test', 1776534608913, 'CODE_GENERATE', 'Backup test', '["test"]', NULL, 'SUCCESS', 0.9, 'gpt-4', 1200, NULL, 'LONG_TERM', NULL, NULL);
INSERT INTO "episodic_memory" VALUES ('backup-test-1776534634255', 'fp-test', 1776534634255, 'CODE_GENERATE', 'Backup test', '["test"]', NULL, 'SUCCESS', 0.9, 'gpt-4', 1200, NULL, 'LONG_TERM', NULL, NULL);
INSERT INTO "episodic_memory" VALUES ('backup-test-1776534700413', 'fp-test', 1776534700413, 'CODE_GENERATE', 'Backup test', '["test"]', NULL, 'SUCCESS', 0.9, 'gpt-4', 1200, NULL, 'LONG_TERM', NULL, NULL);
INSERT INTO "episodic_memory" VALUES ('ep_1776537621228_s94oxl8', '58bbd4ea83f9aa51916f420508a938a7dd2c60f0dda96fea84dc3344f6157833', 1776537621228, 'CODE_EXPLAIN', 'Explained code', '[]', NULL, 'FAILED', 2.0, 'deepseek', 5509, NULL, 'SHORT_TERM', NULL, NULL);
INSERT INTO "episodic_memory" VALUES ('ep_1776537621233_83x4cdi', '58bbd4ea83f9aa51916f420508a938a7dd2c60f0dda96fea84dc3344f6157833', 1776537621233, 'CODE_EXPLAIN', 'Explained code', '[]', NULL, 'SUCCESS', 8.0, 'deepseek', 5526, NULL, 'SHORT_TERM', NULL, NULL);
INSERT INTO "episodic_memory" VALUES ('ep_1776537679369_vfu85tp', '58bbd4ea83f9aa51916f420508a938a7dd2c60f0dda96fea84dc3344f6157833', 1776537679369, 'CHAT_COMMAND', '用户询问AI助手记忆能力，助手说明其短期、会话记忆功能及长期记忆限制。', '["explainCode","重构","短期记忆","会话记忆","长期记忆"]', NULL, 'SUCCESS', 8.0, 'deepseek', NULL, NULL, 'SHORT_TERM', NULL, '{"sessionId":"session_1776491628851_fw2c7w2"}');
INSERT INTO "episodic_memory" VALUES ('ep_1776537781708_15iabet', '58bbd4ea83f9aa51916f420508a938a7dd2c60f0dda96fea84dc3344f6157833', 1776537781708, 'CHAT_COMMAND', '喂喂，还记得我问了你什么吗？ ... 现在还记得我刚才做了什么', '[]', NULL, 'SUCCESS', 8.0, 'local-rule', NULL, NULL, 'SHORT_TERM', NULL, '{"sessionId":"session_1776491506176_7fvsw85"}');
INSERT INTO "episodic_memory" VALUES ('ep_1776537783731_hxye72w', '58bbd4ea83f9aa51916f420508a938a7dd2c60f0dda96fea84dc3344f6157833', 1776537783731, 'CHAT_COMMAND', '发送 ... 这是第几次了', '[]', NULL, 'SUCCESS', 8.0, 'local-rule', NULL, NULL, 'SHORT_TERM', NULL, '{"sessionId":"session_1776490635032_psj6y17"}');
INSERT INTO "episodic_memory" VALUES ('ep_1776537786083_12i1uxe', '58bbd4ea83f9aa51916f420508a938a7dd2c60f0dda96fea84dc3344f6157833', 1776537786083, 'CHAT_COMMAND', '你有上轮对话的记忆吗？ ... 现在你的记忆能力咋样', '[]', NULL, 'SUCCESS', 8.0, 'local-rule', NULL, NULL, 'SHORT_TERM', NULL, '{"sessionId":"session_1776491628851_fw2c7w2"}');
INSERT INTO "episodic_memory" VALUES ('ep_1776537819979_qih954p', '58bbd4ea83f9aa51916f420508a938a7dd2c60f0dda96fea84dc3344f6157833', 1776537819979, 'CODE_EXPLAIN', 'Explained code', '[]', NULL, 'FAILED', 2.0, 'deepseek', 6856, NULL, 'SHORT_TERM', NULL, NULL);
INSERT INTO "episodic_memory" VALUES ('ep_1776537819980_r70esz0', '58bbd4ea83f9aa51916f420508a938a7dd2c60f0dda96fea84dc3344f6157833', 1776537819980, 'CODE_EXPLAIN', 'Explained code', '[]', NULL, 'SUCCESS', 8.0, 'deepseek', 6861, NULL, 'SHORT_TERM', NULL, NULL);
INSERT INTO "episodic_memory" VALUES ('ep_1776537912373_ga5vffu', '58bbd4ea83f9aa51916f420508a938a7dd2c60f0dda96fea84dc3344f6157833', 1776537912373, 'CODE_EXPLAIN', 'Explained code', '[]', NULL, 'FAILED', 2.0, 'deepseek', 6889, NULL, 'SHORT_TERM', NULL, NULL);
INSERT INTO "episodic_memory" VALUES ('ep_1776537912375_o1vyn2a', '58bbd4ea83f9aa51916f420508a938a7dd2c60f0dda96fea84dc3344f6157833', 1776537912375, 'CODE_EXPLAIN', 'Explained code', '[]', NULL, 'SUCCESS', 8.0, 'deepseek', 6894, NULL, 'SHORT_TERM', NULL, NULL);
INSERT INTO "episodic_memory" VALUES ('ep_1776538210659_1rox74n', '58bbd4ea83f9aa51916f420508a938a7dd2c60f0dda96fea84dc3344f6157833', 1776538210659, 'CHAT_COMMAND', 'Generated commit message', '[]', NULL, 'FAILED', 2.0, 'deepseek', 9886, NULL, 'SHORT_TERM', NULL, NULL);
INSERT INTO "episodic_memory" VALUES ('ep_1776538210662_5wfmo62', '58bbd4ea83f9aa51916f420508a938a7dd2c60f0dda96fea84dc3344f6157833', 1776538210662, 'CHAT_COMMAND', 'Generated commit message', '[]', NULL, 'SUCCESS', 8.0, 'deepseek', 12942, NULL, 'SHORT_TERM', NULL, NULL);
INSERT INTO "episodic_memory" VALUES ('ep_1776538210663_5hy1sin', '58bbd4ea83f9aa51916f420508a938a7dd2c60f0dda96fea84dc3344f6157833', 1776538210663, 'CHAT_COMMAND', '聊天触发命令: generateCommit', '["generateCommit","提交代码"]', '提交代码', 'SUCCESS', 8.0, 'deepseek', 12943, NULL, 'SHORT_TERM', NULL, NULL);
INSERT INTO "episodic_memory" VALUES ('ep_1776538432595_rjfeu0x', '58bbd4ea83f9aa51916f420508a938a7dd2c60f0dda96fea84dc3344f6157833', 1776538432595, 'CODE_EXPLAIN', 'Explained code', '[]', NULL, 'FAILED', 2.0, 'deepseek', 6070, NULL, 'SHORT_TERM', NULL, NULL);
INSERT INTO "episodic_memory" VALUES ('ep_1776538527206_ehhz8ig', '58bbd4ea83f9aa51916f420508a938a7dd2c60f0dda96fea84dc3344f6157833', 1776538527206, 'CODE_EXPLAIN', 'Explained code', '[]', NULL, 'FAILED', 2.0, 'deepseek', 6162, NULL, 'SHORT_TERM', NULL, NULL);
INSERT INTO "episodic_memory" VALUES ('ep_1776538619449_3s6nekk', '58bbd4ea83f9aa51916f420508a938a7dd2c60f0dda96fea84dc3344f6157833', 1776538619449, 'CODE_EXPLAIN', 'Explained code', '[]', NULL, 'FAILED', 2.0, 'deepseek', 6451, NULL, 'SHORT_TERM', NULL, NULL);
INSERT INTO "episodic_memory" VALUES ('ep_1776538620855_nv246e4', '58bbd4ea83f9aa51916f420508a938a7dd2c60f0dda96fea84dc3344f6157833', 1776538620855, 'CHAT_COMMAND', '用户多次重复询问自己执行的操作，助手总结为连续提问同一问题。', '["对话记录","操作","提问"]', NULL, 'SUCCESS', 8.0, 'deepseek', NULL, NULL, 'SHORT_TERM', NULL, '{"sessionId":"session_1776537800386_fmg37l5"}');
INSERT INTO "episodic_memory" VALUES ('ep_1776539264159_xvltdty', '58bbd4ea83f9aa51916f420508a938a7dd2c60f0dda96fea84dc3344f6157833', 1776539264159, 'CODE_EXPLAIN', 'Explained code', '[]', NULL, 'SUCCESS', 8.0, 'deepseek', 5516, NULL, 'SHORT_TERM', NULL, NULL);
INSERT INTO "episodic_memory" VALUES ('ep_1776539396198_vn0l5v0', '58bbd4ea83f9aa51916f420508a938a7dd2c60f0dda96fea84dc3344f6157833', 1776539396198, 'CODE_EXPLAIN', 'Explained code', '[]', NULL, 'SUCCESS', 8.0, 'deepseek', 5245, NULL, 'SHORT_TERM', NULL, NULL);
INSERT INTO "episodic_memory" VALUES ('ep_1776539568574_mqlkwu0', '58bbd4ea83f9aa51916f420508a938a7dd2c60f0dda96fea84dc3344f6157833', 1776539568574, 'CHAT_COMMAND', '用户多次重复询问自己执行了什么操作，助手总结为连续询问同一问题。', '["对话记录","记忆导出"]', NULL, 'SUCCESS', 8.0, 'deepseek', NULL, NULL, 'SHORT_TERM', NULL, '{"sessionId":"session_1776537800386_fmg37l5"}');
INSERT INTO "episodic_memory" VALUES ('ep_1776540260502_0jcoufh', '58bbd4ea83f9aa51916f420508a938a7dd2c60f0dda96fea84dc3344f6157833', 1776540260502, 'CODE_EXPLAIN', '解释了 LoginView.vue 中的代码', '["LoginView.vue"]', NULL, 'SUCCESS', 8.0, 'deepseek', 6203, NULL, 'SHORT_TERM', NULL, NULL);
INSERT INTO "episodic_memory" VALUES ('ep_1776540287298_6ehtkzy', '58bbd4ea83f9aa51916f420508a938a7dd2c60f0dda96fea84dc3344f6157833', 1776540287298, 'CODE_EXPLAIN', '解释了 LoginView.vue 中的代码', '["LoginView.vue"]', NULL, 'SUCCESS', 8.0, 'deepseek', 6844, NULL, 'SHORT_TERM', NULL, NULL);
INSERT INTO "episodic_memory" VALUES ('ep_1776540450895_zt82m8m', '58bbd4ea83f9aa51916f420508a938a7dd2c60f0dda96fea84dc3344f6157833', 1776540450895, 'CODE_EXPLAIN', '解释了 LoginView.vue 中的代码', '["LoginView.vue"]', NULL, 'SUCCESS', 8.0, 'deepseek', 5845, NULL, 'SHORT_TERM', NULL, NULL);
INSERT INTO "episodic_memory" VALUES ('ep_1776540702168_eck0pfd', '58bbd4ea83f9aa51916f420508a938a7dd2c60f0dda96fea84dc3344f6157833', 1776540702168, 'CODE_EXPLAIN', '解释了 LoginView.vue 中的代码', '["LoginView.vue"]', NULL, 'SUCCESS', 8.0, 'deepseek', 5621, NULL, 'SHORT_TERM', NULL, NULL);
INSERT INTO "episodic_memory" VALUES ('ep_1776540732998_4rlzq47', '58bbd4ea83f9aa51916f420508a938a7dd2c60f0dda96fea84dc3344f6157833', 1776540732998, 'CHAT_COMMAND', '你现在还记得我刚刚做了什么吗？ ... 我做了什么', '[]', NULL, 'SUCCESS', 8.0, 'local-rule', NULL, NULL, 'SHORT_TERM', NULL, '{"sessionId":"session_1776537800386_fmg37l5"}');
INSERT INTO "episodic_memory" VALUES ('ep_1776540955848_0ox5q6q', '58bbd4ea83f9aa51916f420508a938a7dd2c60f0dda96fea84dc3344f6157833', 1776540955848, 'CODE_EXPLAIN', '解释了 LoginView.vue 中的代码', '["LoginView.vue"]', NULL, 'SUCCESS', 8.0, 'deepseek', 4860, NULL, 'SHORT_TERM', NULL, NULL);
INSERT INTO "episodic_memory" VALUES ('ep_1776540955850_ac5l6oi', '58bbd4ea83f9aa51916f420508a938a7dd2c60f0dda96fea84dc3344f6157833', 1776540955850, 'CHAT_COMMAND', '聊天触发命令: explainCode', '["explainCode","那现在能帮我解释代码吗？"]', '那现在能帮我解释代码吗？', 'SUCCESS', 8.0, 'deepseek', 4868, NULL, 'SHORT_TERM', NULL, NULL);
INSERT INTO "episodic_memory" VALUES ('ep_1776541229388_8z91viu', '58bbd4ea83f9aa51916f420508a938a7dd2c60f0dda96fea84dc3344f6157833', 1776541229388, 'CODE_EXPLAIN', '解释了 LoginView.vue 中的代码', '["LoginView.vue"]', NULL, 'SUCCESS', 8.0, 'deepseek', 5398, NULL, 'SHORT_TERM', NULL, NULL);
INSERT INTO "episodic_memory" VALUES ('ep_1776541304057_m1539t1', '58bbd4ea83f9aa51916f420508a938a7dd2c60f0dda96fea84dc3344f6157833', 1776541304057, 'CHAT_COMMAND', '聊天触发命令: explainCode', '["explainCode","代码解释"]', '代码解释', 'SUCCESS', 8.0, 'deepseek', 7, NULL, 'SHORT_TERM', NULL, NULL);
INSERT INTO "episodic_memory" VALUES ('ep_1776541320769_i5ii3e3', '58bbd4ea83f9aa51916f420508a938a7dd2c60f0dda96fea84dc3344f6157833', 1776541320769, 'CODE_EXPLAIN', '解释了 LoginView.vue 中的代码', '["LoginView.vue"]', NULL, 'SUCCESS', 8.0, 'deepseek', 6308, NULL, 'SHORT_TERM', NULL, NULL);
INSERT INTO "episodic_memory" VALUES ('ep_1776541339977_zunlrq8', '58bbd4ea83f9aa51916f420508a938a7dd2c60f0dda96fea84dc3344f6157833', 1776541339977, 'CHAT_COMMAND', '用户多次询问自己刚才的操作，助手回顾了之前对LoginView.vue代码的解释。', '["LoginView.vue"]', NULL, 'SUCCESS', 8.0, 'deepseek', NULL, NULL, 'SHORT_TERM', NULL, '{"sessionId":"session_1776540734148_tdyxsua"}');
INSERT INTO "episodic_memory" VALUES ('ep_1776541453458_3wi87l3', '58bbd4ea83f9aa51916f420508a938a7dd2c60f0dda96fea84dc3344f6157833', 1776541453458, 'CHAT_COMMAND', '我刚刚做了什么 ... 记得我刚才做了什么', '[]', NULL, 'SUCCESS', 8.0, 'local-rule', NULL, NULL, 'SHORT_TERM', NULL, '{"sessionId":"session_1776540734148_tdyxsua"}');
INSERT INTO "episodic_memory" VALUES ('ep_1776541627527_v0g92ri', '58bbd4ea83f9aa51916f420508a938a7dd2c60f0dda96fea84dc3344f6157833', 1776541627527, 'CHAT_COMMAND', '我刚刚做了什么 ... 记得我刚才做了什么', '[]', NULL, 'SUCCESS', 8.0, 'local-rule', NULL, NULL, 'SHORT_TERM', NULL, '{"sessionId":"session_1776540734148_tdyxsua"}');
INSERT INTO "episodic_memory" VALUES ('ep_1776542331158_fxzhhq1', '58bbd4ea83f9aa51916f420508a938a7dd2c60f0dda96fea84dc3344f6157833', 1776542331158, 'CODE_EXPLAIN', '解释了 admin/src/views/LoginView.vue 中的代码', '["admin/src/views/LoginView.vue"]', NULL, 'SUCCESS', 8.0, 'deepseek', 5184, NULL, 'SHORT_TERM', NULL, NULL);
INSERT INTO "episodic_memory" VALUES ('ep_1776543709654_aomx0ax', '58bbd4ea83f9aa51916f420508a938a7dd2c60f0dda96fea84dc3344f6157833', 1776543709654, 'CODE_EXPLAIN', '解释了 admin/src/views/LoginView.vue 中的代码', '["admin/src/views/LoginView.vue"]', NULL, 'SUCCESS', 8.0, 'deepseek', 5198, NULL, 'SHORT_TERM', NULL, NULL);
INSERT INTO "episodic_memory" VALUES ('ep_1776543740013_x3m3qrp', '58bbd4ea83f9aa51916f420508a938a7dd2c60f0dda96fea84dc3344f6157833', 1776543740013, 'CODE_EXPLAIN', '解释了 admin/src/views/LoginView.vue 中的代码', '["admin/src/views/LoginView.vue"]', NULL, 'SUCCESS', 8.0, 'deepseek', 5411, NULL, 'SHORT_TERM', NULL, NULL);
INSERT INTO "episodic_memory" VALUES ('ep_1776543817791_1lst0lp', '58bbd4ea83f9aa51916f420508a938a7dd2c60f0dda96fea84dc3344f6157833', 1776543817791, 'CHAT_COMMAND', '聊天触发命令: explainCode', '["explainCode","不包含我现在与你对话，能复述一遍代码的内容解释吗?"]', '不包含我现在与你对话，能复述一遍代码的内容解释吗?', 'SUCCESS', 8.0, 'deepseek', 5, NULL, 'SHORT_TERM', NULL, NULL);
INSERT INTO "episodic_memory" VALUES ('ep_1776544114362_3vxpzgw', '58bbd4ea83f9aa51916f420508a938a7dd2c60f0dda96fea84dc3344f6157833', 1776544114362, 'CHAT_COMMAND', '用户反复询问自己之前的操作，助手根据对话记录逐一回顾并说明。', '["LoginView.vue","explainCode"]', NULL, 'SUCCESS', 8.0, 'deepseek', NULL, NULL, 'SHORT_TERM', NULL, '{"sessionId":"session_1776541508176_1osbbeo"}');
INSERT INTO "episodic_memory" VALUES ('ep_1776544168381_q6jupg2', '58bbd4ea83f9aa51916f420508a938a7dd2c60f0dda96fea84dc3344f6157833', 1776544168381, 'CODE_EXPLAIN', '解释了 admin/src/views/LoginView.vue 中的代码', '["admin/src/views/LoginView.vue"]', NULL, 'SUCCESS', 8.0, 'deepseek', 6358, NULL, 'SHORT_TERM', NULL, NULL);
INSERT INTO "episodic_memory" VALUES ('ep_1776544195831_vf5psg2', '58bbd4ea83f9aa51916f420508a938a7dd2c60f0dda96fea84dc3344f6157833', 1776544195831, 'CODE_EXPLAIN', '解释了 admin/src/views/LoginView.vue 中的代码', '["admin/src/views/LoginView.vue"]', NULL, 'SUCCESS', 8.0, 'deepseek', 5267, NULL, 'SHORT_TERM', NULL, NULL);
INSERT INTO "episodic_memory" VALUES ('ep_1776544215556_602x6f3', '58bbd4ea83f9aa51916f420508a938a7dd2c60f0dda96fea84dc3344f6157833', 1776544215556, 'CODE_EXPLAIN', '解释了 admin/src/views/ForgotPasswordView.vue 中的代码', '["admin/src/views/ForgotPasswordView.vue"]', NULL, 'SUCCESS', 8.0, 'deepseek', 6166, NULL, 'SHORT_TERM', NULL, NULL);

-- ----------------------------
-- Table structure for preference_memory
-- ----------------------------
DROP TABLE IF EXISTS "preference_memory";
CREATE TABLE "preference_memory" (
  "id" TEXT,
  "domain" TEXT NOT NULL,
  "pattern" TEXT NOT NULL,
  "confidence" REAL NOT NULL,
  "sample_count" INTEGER NOT NULL DEFAULT 1,
  "last_updated" INTEGER NOT NULL,
  "model_id" TEXT,
  "project_fingerprint" TEXT,
  "pattern_hash" TEXT NOT NULL,
  PRIMARY KEY ("id")
);

-- ----------------------------
-- Records of preference_memory
-- ----------------------------

-- ----------------------------
-- Table structure for procedural_memory
-- ----------------------------
DROP TABLE IF EXISTS "procedural_memory";
CREATE TABLE "procedural_memory" (
  "id" TEXT,
  "skill_name" TEXT NOT NULL,
  "description" TEXT,
  "steps" TEXT NOT NULL,
  "dependencies" TEXT,
  "version" TEXT NOT NULL,
  "author" TEXT,
  "project_fingerprint" TEXT,
  "created_at" INTEGER NOT NULL,
  "updated_at" INTEGER NOT NULL,
  "pattern_hash" TEXT NOT NULL,
  PRIMARY KEY ("id")
);

-- ----------------------------
-- Records of procedural_memory
-- ----------------------------

-- ----------------------------
-- Table structure for task_state
-- ----------------------------
DROP TABLE IF EXISTS "task_state";
CREATE TABLE "task_state" (
  "id" TEXT,
  "task_id" TEXT NOT NULL,
  "project_fingerprint" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "context" TEXT,
  "created_at" INTEGER NOT NULL,
  "updated_at" INTEGER NOT NULL,
  PRIMARY KEY ("id")
);

-- ----------------------------
-- Records of task_state
-- ----------------------------

-- ----------------------------
-- Indexes structure for table episodic_memory
-- ----------------------------
CREATE INDEX "idx_episodic_memory_tier"
ON "episodic_memory" (
  "memory_tier" ASC
);
CREATE INDEX "idx_episodic_outcome"
ON "episodic_memory" (
  "outcome" ASC
);
CREATE INDEX "idx_episodic_project"
ON "episodic_memory" (
  "project_fingerprint" ASC
);
CREATE INDEX "idx_episodic_task_type"
ON "episodic_memory" (
  "task_type" ASC
);
CREATE INDEX "idx_episodic_timestamp"
ON "episodic_memory" (
  "timestamp" ASC
);

-- ----------------------------
-- Indexes structure for table preference_memory
-- ----------------------------
CREATE INDEX "idx_preference_domain"
ON "preference_memory" (
  "domain" ASC
);
CREATE INDEX "idx_preference_model"
ON "preference_memory" (
  "model_id" ASC
);
CREATE INDEX "idx_preference_pattern_hash"
ON "preference_memory" (
  "pattern_hash" ASC
);
CREATE INDEX "idx_preference_project"
ON "preference_memory" (
  "project_fingerprint" ASC
);

-- ----------------------------
-- Indexes structure for table procedural_memory
-- ----------------------------
CREATE INDEX "idx_procedural_hash"
ON "procedural_memory" (
  "pattern_hash" ASC
);
CREATE INDEX "idx_procedural_project"
ON "procedural_memory" (
  "project_fingerprint" ASC
);

-- ----------------------------
-- Indexes structure for table task_state
-- ----------------------------
CREATE INDEX "idx_task_project"
ON "task_state" (
  "project_fingerprint" ASC
);
CREATE INDEX "idx_task_status"
ON "task_state" (
  "status" ASC
);

PRAGMA foreign_keys = true;
