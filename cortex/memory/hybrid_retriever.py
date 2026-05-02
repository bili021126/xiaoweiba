"""
混合检索器（Hybrid Retriever）

四因子加权混合检索：
final_score = α × vector_similarity + β × keyword_match 
            + γ × time_decay + δ × importance

遵循 Cortex 架构法典 MEM-005
"""
import math
from typing import List, Dict, Any, Optional
from datetime import datetime


class HybridRetriever:
    """
    四因子加权混合检索器
    
    结合向量检索、关键词匹配、时间衰减和重要性评分，
    提供最相关的记忆结果。
    
    默认权重：
    - vector: 0.40 (语义相似度)
    - keyword: 0.25 (关键词匹配)
    - time_decay: 0.15 (时间衰减)
    - importance: 0.20 (重要性)
    """
    
    def __init__(
        self,
        chroma_client: Any,
        sqlite_conn: Any,
        weights: Optional[Dict[str, float]] = None
    ):
        """
        初始化混合检索器
        
        Args:
            chroma_client: ChromaDB 客户端
            sqlite_conn: SQLite 数据库连接
            weights: 检索权重配置（可选）
        """
        self.chroma = chroma_client
        self.sqlite = sqlite_conn
        
        # 默认权重
        self.weights = weights or {
            'vector': 0.40,
            'keyword': 0.25,
            'time_decay': 0.15,
            'importance': 0.20
        }
        
        # 时间衰减系数（半衰期约 7 天）
        self.decay_lambda = 0.1
    
    async def retrieve(
        self,
        query: str,
        limit: int = 10,
        filters: Optional[Dict[str, Any]] = None
    ) -> List[Dict[str, Any]]:
        """
        执行混合检索
        
        Args:
            query: 查询文本
            limit: 返回的最大数量
            filters: 过滤条件（可选）
            
        Returns:
            按最终分数排序的记忆列表
        """
        # 1. 向量检索（ChromaDB）
        vector_results = await self._vector_search(query, limit * 2, filters)
        
        # 2. 关键词检索（SQLite FTS5）
        keyword_results = await self._keyword_search(query, limit * 2, filters)
        
        # 3. 合并并加权评分
        scored_results = self._merge_and_score(vector_results, keyword_results)
        
        # 4. 按最终分数排序并返回
        sorted_results = sorted(
            scored_results,
            key=lambda x: x['final_score'],
            reverse=True
        )
        
        return sorted_results[:limit]
    
    async def _vector_search(
        self,
        query: str,
        limit: int,
        filters: Optional[Dict[str, Any]] = None
    ) -> List[Dict[str, Any]]:
        """
        向量检索（ChromaDB）
        
        Args:
            query: 查询文本
            limit: 返回数量
            filters: 过滤条件
            
        Returns:
            向量检索结果列表
        """
        try:
            # 生成查询向量（需要 EmbeddingService）
            # embedding = await self.embedding_service.encode(query)
            
            # ChromaDB 查询
            # results = self.chroma.query(
            #     query_embeddings=[embedding],
            #     n_results=limit,
            #     where=filters
            # )
            
            # TODO: 实际实现时需要集成 EmbeddingService
            # 这里返回空列表作为占位符
            return []
            
        except Exception as e:
            print(f"[HybridRetriever] Vector search error: {e}")
            return []
    
    async def _keyword_search(
        self,
        query: str,
        limit: int,
        filters: Optional[Dict[str, Any]] = None
    ) -> List[Dict[str, Any]]:
        """
        关键词检索（SQLite FTS5）
        
        Args:
            query: 查询文本
            limit: 返回数量
            filters: 过滤条件
            
        Returns:
            关键词检索结果列表
        """
        try:
            cursor = self.sqlite.cursor()
            
            # FTS5 全文搜索
            sql = """
                SELECT id, summary, task_type, timestamp, entities,
                       match_score(episodic_memory_fts, ?) as keyword_score
                FROM episodic_memory
                WHERE episodic_memory MATCH ?
                ORDER BY keyword_score DESC
                LIMIT ?
            """
            
            cursor.execute(sql, (query, query, limit))
            rows = cursor.fetchall()
            
            results = []
            for row in rows:
                results.append({
                    'id': row[0],
                    'summary': row[1],
                    'task_type': row[2],
                    'timestamp': row[3],
                    'entities': row[4],
                    'keyword_score': row[5]
                })
            
            return results
            
        except Exception as e:
            print(f"[HybridRetriever] Keyword search error: {e}")
            return []
    
    def _merge_and_score(
        self,
        vector_results: List[Dict],
        keyword_results: List[Dict]
    ) -> List[Dict[str, Any]]:
        """
        合并向量检索和关键词检索结果，计算加权分数
        
        Args:
            vector_results: 向量检索结果
            keyword_results: 关键词检索结果
            
        Returns:
            带最终分数的合并结果
        """
        # 使用字典存储合并后的结果（以 ID 为键）
        merged = {}
        
        # 处理向量检索结果
        for result in vector_results:
            mem_id = result.get('id')
            if not mem_id:
                continue
            
            # 归一化向量相似度（距离转相似度）
            distance = result.get('distance', 1.0)
            vector_sim = 1.0 - distance
            
            merged[mem_id] = {
                **result,
                'vector_score': vector_sim,
                'keyword_score': 0.0,
            }
        
        # 处理关键词检索结果
        for result in keyword_results:
            mem_id = result.get('id')
            if not mem_id:
                continue
            
            # 归一化关键词分数
            keyword_score = result.get('keyword_score', 0.0)
            
            if mem_id in merged:
                # 已存在，更新关键词分数
                merged[mem_id]['keyword_score'] = keyword_score
            else:
                # 新结果
                merged[mem_id] = {
                    **result,
                    'vector_score': 0.0,
                    'keyword_score': keyword_score,
                }
        
        # 计算最终分数
        now = datetime.now().timestamp()
        scored_results = []
        
        for mem_id, result in merged.items():
            # 1. 向量相似度
            vector_score = result.get('vector_score', 0.0)
            
            # 2. 关键词匹配
            keyword_score = result.get('keyword_score', 0.0)
            
            # 3. 时间衰减
            timestamp = result.get('timestamp', now)
            age_days = (now - timestamp) / (24 * 3600)
            time_decay = math.exp(-self.decay_lambda * age_days)
            
            # 4. 重要性（从元数据中获取，默认为 1.0）
            importance = result.get('importance', 1.0)
            
            # 加权求和
            final_score = (
                self.weights['vector'] * vector_score +
                self.weights['keyword'] * keyword_score +
                self.weights['time_decay'] * time_decay +
                self.weights['importance'] * importance
            )
            
            scored_results.append({
                **result,
                'final_score': final_score,
                'vector_score': vector_score,
                'keyword_score': keyword_score,
                'time_decay': time_decay,
                'importance': importance
            })
        
        return scored_results
    
    def update_weights(self, weights: Dict[str, float]) -> None:
        """
        更新检索权重
        
        Args:
            weights: 新的权重配置
        """
        # 验证权重总和为 1.0
        total = sum(weights.values())
        if abs(total - 1.0) > 0.01:
            raise ValueError(f"Weights must sum to 1.0, got {total}")
        
        self.weights = weights
    
    def get_stats(self) -> Dict[str, Any]:
        """
        获取检索器统计信息
        
        Returns:
            统计信息字典
        """
        return {
            'weights': self.weights,
            'decay_lambda': self.decay_lambda,
            'half_life_days': math.log(2) / self.decay_lambda
        }
