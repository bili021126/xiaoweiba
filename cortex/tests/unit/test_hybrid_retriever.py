"""
HybridRetriever 单元测试

测试四因子加权混合检索算法
"""
import pytest
from unittest.mock import MagicMock, patch
from datetime import datetime, timedelta
from cortex.memory.hybrid_retriever import HybridRetriever


class TestHybridRetriever:
    """HybridRetriever 测试类"""
    
    @pytest.fixture
    def mock_chroma(self):
        """Mock ChromaDB 客户端"""
        chroma = MagicMock()
        chroma.query.return_value = {
            'ids': [['doc1', 'doc2']],
            'distances': [[0.3, 0.5]],  # 距离越小越相似
            'metadatas': [[
                {'content': 'Document 1', 'created_at': '2026-04-01'},
                {'content': 'Document 2', 'created_at': '2026-04-20'}
            ]]
        }
        return chroma
    
    @pytest.fixture
    def mock_sqlite(self):
        """Mock SQLite 连接"""
        conn = MagicMock()
        cursor = MagicMock()
        cursor.fetchall.return_value = [
            ('doc1', 'Document 1 content'),
            ('doc3', 'Document 3 content')
        ]
        conn.cursor.return_value.__enter__.return_value = cursor
        return conn
    
    @pytest.fixture
    def retriever(self, mock_chroma, mock_sqlite):
        """创建检索器实例"""
        return HybridRetriever(
            chroma_client=mock_chroma,
            sqlite_conn=mock_sqlite,
            weights={
                'vector': 0.40,
                'keyword': 0.25,
                'time_decay': 0.15,
                'importance': 0.20
            }
        )
    
    def test_default_weights(self, mock_chroma, mock_sqlite):
        """测试默认权重"""
        retriever = HybridRetriever(mock_chroma, mock_sqlite)
        
        assert retriever.weights['vector'] == 0.40
        assert retriever.weights['keyword'] == 0.25
        assert retriever.weights['time_decay'] == 0.15
        assert retriever.weights['importance'] == 0.20
    
    def test_custom_weights(self, mock_chroma, mock_sqlite):
        """测试自定义权重"""
        custom_weights = {
            'vector': 0.50,
            'keyword': 0.20,
            'time_decay': 0.10,
            'importance': 0.20
        }
        retriever = HybridRetriever(mock_chroma, mock_sqlite, custom_weights)
        
        assert retriever.weights == custom_weights
    
    def test_vector_similarity_score(self, retriever):
        """测试向量相似度评分（距离转相似度）"""
        # 距离 0.0 -> 相似度 1.0
        score = retriever._calculate_vector_score(0.0)
        assert score == pytest.approx(1.0)
        
        # 距离 1.0 -> 相似度 0.0
        score = retriever._calculate_vector_score(1.0)
        assert score == pytest.approx(0.0)
        
        # 距离 0.3 -> 相似度 0.7
        score = retriever._calculate_vector_score(0.3)
        assert score == pytest.approx(0.7)
    
    def test_keyword_match_score(self, retriever):
        """测试关键词匹配评分"""
        # 完全匹配
        score = retriever._calculate_keyword_score('doc1', ['doc1', 'doc2'])
        assert score == 1.0
        
        # 部分匹配
        score = retriever._calculate_keyword_score('doc1', ['doc2', 'doc3'])
        assert score == 0.0
        
        # 无匹配
        score = retriever._calculate_keyword_score('doc1', [])
        assert score == 0.0
    
    def test_time_decay_score(self, retriever):
        """测试时间衰减评分"""
        now = datetime.now()
        
        # 今天的文档（age_days = 0）-> 分数 1.0
        score = retriever._calculate_time_decay_score(now.isoformat())
        assert score == pytest.approx(1.0)
        
        # 昨天的文档（age_days = 1）
        yesterday = (now - timedelta(days=1)).isoformat()
        score = retriever._calculate_time_decay_score(yesterday)
        expected = (1 - retriever.lambda_decay) ** 1
        assert score == pytest.approx(expected)
        
        # 30天前的文档
        old_date = (now - timedelta(days=30)).isoformat()
        score = retriever._calculate_time_decay_score(old_date)
        expected = (1 - retriever.lambda_decay) ** 30
        assert score == pytest.approx(expected)
    
    def test_importance_score(self, retriever):
        """测试重要性评分"""
        # 高重要性
        score = retriever._calculate_importance_score(0.9)
        assert score == pytest.approx(0.9)
        
        # 低重要性
        score = retriever._calculate_importance_score(0.1)
        assert score == pytest.approx(0.1)
        
        # 默认重要性
        score = retriever._calculate_importance_score(None)
        assert score == pytest.approx(0.5)
    
    def test_final_score_calculation(self, retriever):
        """测试最终评分计算"""
        final_score = retriever._calculate_final_score(
            vector_sim=0.8,
            keyword_match=0.6,
            time_decay=0.9,
            importance=0.7
        )
        
        expected = (
            0.40 * 0.8 +   # vector
            0.25 * 0.6 +   # keyword
            0.15 * 0.9 +   # time_decay
            0.20 * 0.7     # importance
        )
        
        assert final_score == pytest.approx(expected)
    
    @pytest.mark.asyncio
    async def test_hybrid_search(self, retriever):
        """测试混合检索"""
        results = await retriever.search("test query", top_k=5)
        
        # 验证返回结果格式
        assert isinstance(results, list)
        if len(results) > 0:
            first_result = results[0]
            assert 'id' in first_result
            assert 'score' in first_result
            assert 'content' in first_result
    
    def test_weight_normalization(self, mock_chroma, mock_sqlite):
        """测试权重归一化"""
        # 权重总和不为 1.0
        invalid_weights = {
            'vector': 0.5,
            'keyword': 0.5,
            'time_decay': 0.5,
            'importance': 0.5
        }
        
        retriever = HybridRetriever(mock_chroma, mock_sqlite, invalid_weights)
        
        # 应该自动归一化
        total = sum(retriever.weights.values())
        assert total == pytest.approx(1.0)
    
    def test_invalid_weight_keys(self, mock_chroma, mock_sqlite):
        """测试无效的权重键"""
        invalid_weights = {
            'invalid_key': 0.5,
            'vector': 0.5
        }
        
        with pytest.raises(ValueError, match="Invalid weight keys"):
            HybridRetriever(mock_chroma, mock_sqlite, invalid_weights)
