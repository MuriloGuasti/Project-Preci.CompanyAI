import asyncio
import os
import sys
import unittest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List

from app.core.config import settings
from app.db.supabase_client import db
from app.services.rag.reranker import (
    ChunkResult,
    exact_keyword_match,
    recency_boost,
    rerank,
)
from app.services.rag.hybrid_search import (
    compute_rrf_score,
    hybrid_search,
)
from app.services.agents.executor import RagNode


class TestHybridSearchAndReranker(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        # Garante execução instantânea em Cota Zero nos testes unitários
        self._orig_google_key = settings.GOOGLE_API_KEY
        self._orig_openai_key = settings.OPENAI_API_KEY
        self._orig_supabase_url = settings.SUPABASE_URL
        settings.GOOGLE_API_KEY = ""
        settings.OPENAI_API_KEY = ""
        settings.SUPABASE_URL = ""

        # Limpa e inicializa dados de teste em memória
        db.documents.clear()
        db.document_chunks.clear()

        self.tenant_a = "11111111-1111-1111-1111-111111111111"
        self.tenant_b = "22222222-2222-2222-2222-222222222222"
        self.user_a = "user-alice"
        self.user_b = "user-bob"

    async def asyncTearDown(self):
        settings.GOOGLE_API_KEY = self._orig_google_key
        settings.OPENAI_API_KEY = self._orig_openai_key
        settings.SUPABASE_URL = self._orig_supabase_url

    def test_recency_boost(self):
        """Verifica se o boost de recência decai exponencialmente com meia-vida de 90 dias."""
        now = datetime.now(timezone.utc)
        
        # Documento criado agora: boost máximo (+0.10)
        boost_today = recency_boost(now, max_boost=0.10, half_life_days=90)
        self.assertAlmostEqual(boost_today, 0.10, delta=0.005)

        # Documento com 90 dias: metade do boost (+0.05)
        ninety_days_ago = now - timedelta(days=90)
        boost_90d = recency_boost(ninety_days_ago, max_boost=0.10, half_life_days=90)
        self.assertAlmostEqual(boost_90d, 0.05, delta=0.005)

        # Documento com 180 dias: 1/4 do boost (+0.025)
        one_eighty_days_ago = now - timedelta(days=180)
        boost_180d = recency_boost(one_eighty_days_ago, max_boost=0.10, half_life_days=90)
        self.assertAlmostEqual(boost_180d, 0.025, delta=0.005)

        # Documento nulo ou inválido
        self.assertEqual(recency_boost(None), 0.0)

    def test_exact_keyword_match(self):
        """Verifica detecção de matches exatos de códigos, nomes e frases."""
        content = "O cliente Rodrigo Silveira assinou o contrato sob código CLI-98234-XP com vigência anual."

        # Código exato
        self.assertTrue(exact_keyword_match("CLI-98234-XP", content))
        # Nome próprio
        self.assertTrue(exact_keyword_match("Rodrigo Silveira", content))
        # Frase parcial
        self.assertTrue(exact_keyword_match("código CLI-98234-XP", content))
        # Case insensitive
        self.assertTrue(exact_keyword_match("cli-98234-xp", content))
        # Termo inexistente
        self.assertFalse(exact_keyword_match("Fernanda Montenegro", content))
        # Stopwords puras não devem ativar falso positivo
        self.assertFalse(exact_keyword_match("de em para com", content))

    def test_rerank_logic(self):
        """Verifica a fórmula de score final: rrf_score + keyword_boost (+0.15) + recency_boost."""
        now = datetime.now(timezone.utc)
        cand1 = ChunkResult(
            id="c1",
            document_id="d1",
            content="Dados gerais sem termos específicos sobre o produto.",
            rrf_score=0.03,
            metadata={"updated_at": (now - timedelta(days=200)).isoformat()}
        )
        cand2 = ChunkResult(
            id="c2",
            document_id="d2",
            content="Informações do contrato código PRECI-99 com garantias.",
            rrf_score=0.025,
            metadata={"updated_at": now.isoformat()}
        )

        ranked = rerank([cand1, cand2], query="PRECI-99")
        # cand2 tem rrf menor (0.025), mas ganha +0.15 de keyword e ~+0.10 de recência = ~0.275
        # cand1 tem rrf (0.03) + ~0.02 = ~0.05
        self.assertEqual(ranked[0].id, "c2")
        self.assertGreater(ranked[0].final_score, ranked[1].final_score)
        self.assertAlmostEqual(ranked[0].keyword_boost, 0.15, places=2)

    async def test_vector_only_match(self):
        """(a) Só match vetorial: pergunta conceitual sem termos literais coincidentes."""
        # Chunk com embedding alinhado com o vetor de fallback determinístico da query
        from app.services.rag.embeddings import generate_embedding
        q_emb = await generate_embedding("diretrizes de reembolso e despesas corporativas")

        db.document_chunks["chunk-vec"] = {
            "id": "chunk-vec",
            "document_id": "doc-vec",
            "company_id": self.tenant_a,
            "created_by": self.user_a,
            "content": "Políticas de restituição de gastos financeiros de funcionários em viagens de negócios.",
            "metadata": {"document_name": "Financeiro"},
            "embedding": q_emb, # Similaridade vetorial máxima 1.0
        }
        db.document_chunks["chunk-other"] = {
            "id": "chunk-other",
            "document_id": "doc-other",
            "company_id": self.tenant_a,
            "created_by": self.user_a,
            "content": "Orientações de login na intranet e troca de senhas de acesso.",
            "metadata": {"document_name": "TI"},
            "embedding": [-x for x in q_emb], # Similaridade negativa
        }

        results = await hybrid_search(
            query="diretrizes de reembolso e despesas corporativas",
            company_id=self.tenant_a,
            user_id=self.user_a,
            top_k=2,
            threshold=0.5,
        )

        self.assertTrue(len(results) >= 1)
        self.assertEqual(results[0].id, "chunk-vec")
        self.assertIsNotNone(results[0].vector_rank)

    async def test_text_only_exact_match(self):
        """(b) Só match textual: código ou identificador exato que sobrepõe similaridade fraca."""
        db.document_chunks["chunk-1"] = {
            "id": "chunk-1",
            "document_id": "doc-1",
            "company_id": self.tenant_a,
            "created_by": self.user_a,
            "content": "Acordo comercial sigiloso registrado sob a chave interna CLI-98234-XP para faturamento.",
            "metadata": {"document_name": "Contratos", "created_at": datetime.now(timezone.utc).isoformat()},
            "embedding": [0.01] * 1536, # Similaridade vetorial fraca/aleatória
        }
        db.document_chunks["chunk-2"] = {
            "id": "chunk-2",
            "document_id": "doc-2",
            "company_id": self.tenant_a,
            "created_by": self.user_a,
            "content": "Orientações operacionais genéricas sobre procedimentos administrativos de rotina.",
            "metadata": {"document_name": "Manual", "created_at": datetime.now(timezone.utc).isoformat()},
            "embedding": [0.5] * 1536,
        }

        results = await hybrid_search(
            query="CLI-98234-XP",
            company_id=self.tenant_a,
            user_id=self.user_a,
            top_k=2,
        )

        self.assertTrue(len(results) > 0)
        # O chunk com o código exato deve ser o primeiro
        self.assertEqual(results[0].id, "chunk-1")
        self.assertIn("CLI-98234-XP", results[0].content)

    async def test_both_vector_and_text_match(self):
        """(c) Match em ambos: soma de RRF coloca o chunk com duplo match no topo isolado."""
        from app.services.rag.embeddings import generate_embedding
        q_emb = await generate_embedding("sistema de auditoria de contratos")

        # Chunk 1: Match vetorial E textual
        db.document_chunks["chunk-both"] = {
            "id": "chunk-both",
            "document_id": "doc-both",
            "company_id": self.tenant_a,
            "created_by": self.user_a,
            "content": "O sistema de auditoria de contratos realiza checagens contábeis diárias.",
            "metadata": {"document_name": "Auditoria"},
            "embedding": q_emb,
        }
        # Chunk 2: Apenas match vetorial
        db.document_chunks["chunk-vec-only"] = {
            "id": "chunk-vec-only",
            "document_id": "doc-vec-only",
            "company_id": self.tenant_a,
            "created_by": self.user_a,
            "content": "Processos de verificação contábil e fiscal para compliance empresarial.",
            "metadata": {"document_name": "Compliance"},
            "embedding": q_emb,
        }
        # Chunk 3: Apenas match textual parcial
        db.document_chunks["chunk-text-only"] = {
            "id": "chunk-text-only",
            "document_id": "doc-text-only",
            "company_id": self.tenant_a,
            "created_by": self.user_a,
            "content": "Guia de contratos comerciais com fornecedores de hardware e software.",
            "metadata": {"document_name": "Fornecedores"},
            "embedding": [-x for x in q_emb],
        }

        results = await hybrid_search(
            query="sistema de auditoria de contratos",
            company_id=self.tenant_a,
            user_id=self.user_a,
            top_k=3,
            threshold=0.3,
        )

        self.assertTrue(len(results) >= 2)
        # O chunk com duplo match deve vencer com folga
        self.assertEqual(results[0].id, "chunk-both")
        self.assertIsNotNone(results[0].vector_rank)
        self.assertIsNotNone(results[0].text_rank)
        self.assertGreater(results[0].rrf_score, results[1].rrf_score)

    async def test_no_results_below_threshold(self):
        """(d) Nenhum resultado acima do threshold: retorna lista vazia."""
        db.document_chunks["chunk-unrelated"] = {
            "id": "chunk-unrelated",
            "document_id": "doc-unrelated",
            "company_id": self.tenant_a,
            "created_by": self.user_a,
            "content": "Receita culinária tradicional de bolo de cenoura com cobertura de chocolate.",
            "metadata": {"document_name": "Receitas"},
            "embedding": [0.0] * 1536,
        }

        results = await hybrid_search(
            query="normas aeroespaciais da aviação comercial militar",
            company_id=self.tenant_a,
            user_id=self.user_a,
            top_k=4,
            threshold=0.8,
        )

        self.assertEqual(len(results), 0)

    async def test_recency_priority_on_similar_content(self):
        """Documento mais recente recebe prioridade sobre documento antigo com mesmo conteúdo."""
        now = datetime.now(timezone.utc)
        
        # Documento legado (180 dias atrás)
        db.document_chunks["chunk-old"] = {
            "id": "chunk-old",
            "document_id": "doc-old",
            "company_id": self.tenant_a,
            "created_by": self.user_a,
            "content": "Tabela de preços dos planos corporativos vigentes para novos clientes Preci.",
            "metadata": {
                "document_name": "Tabela Antiga",
                "created_at": (now - timedelta(days=180)).isoformat(),
                "updated_at": (now - timedelta(days=180)).isoformat(),
            },
        }

        # Documento recente (criado hoje)
        db.document_chunks["chunk-new"] = {
            "id": "chunk-new",
            "document_id": "doc-new",
            "company_id": self.tenant_a,
            "created_by": self.user_a,
            "content": "Tabela de preços dos planos corporativos vigentes para novos clientes Preci.",
            "metadata": {
                "document_name": "Tabela Nova",
                "created_at": now.isoformat(),
                "updated_at": now.isoformat(),
            },
        }

        results = await hybrid_search(
            query="planos corporativos tabela de preços",
            company_id=self.tenant_a,
            user_id=self.user_a,
            top_k=2,
        )

        self.assertEqual(len(results), 2)
        # O documento novo deve superar o antigo no score final graças ao recency_boost
        self.assertEqual(results[0].id, "chunk-new")
        self.assertGreater(results[0].recency_boost, results[1].recency_boost)

    async def test_tenant_isolation(self):
        """Garante que documentos do Tenant B nunca apareçam nas buscas do Tenant A."""
        db.document_chunks["chunk-tenant-a"] = {
            "id": "chunk-tenant-a",
            "document_id": "doc-a",
            "company_id": self.tenant_a,
            "created_by": self.user_a,
            "content": "Relatório financeiro confidencial da Empresa Alfa.",
            "metadata": {"document_name": "Alfa"},
        }
        db.document_chunks["chunk-tenant-b"] = {
            "id": "chunk-tenant-b",
            "document_id": "doc-b",
            "company_id": self.tenant_b,
            "created_by": self.user_b,
            "content": "Relatório financeiro confidencial da Empresa Beta.",
            "metadata": {"document_name": "Beta"},
        }

        results_a = await hybrid_search(
            query="Relatório financeiro confidencial",
            company_id=self.tenant_a,
            user_id=self.user_a,
            top_k=5,
        )
        for r in results_a:
            self.assertEqual(r.id, "chunk-tenant-a")
            self.assertNotIn("Beta", r.content)

    async def test_ragnode_telemetry_and_signature(self):
        """Verifica que RagNode retorna search_mode: 'hybrid' e preserva campos esperados."""
        db.document_chunks["chunk-rag"] = {
            "id": "chunk-rag",
            "document_id": "doc-rag",
            "company_id": self.tenant_a,
            "created_by": self.user_a,
            "content": "Política oficial de garantia estendida e devolução Preci em até 30 dias.",
            "metadata": {"document_name": "Políticas Preci"},
        }

        rag_node = RagNode(
            node_id="node_rag_1",
            label="Busca RAG",
            config={
                "query": "qual a garantia e devolução?",
                "top_k": 3,
            }
        )

        context = {
            "user": {
                "id": self.user_a,
                "company_id": self.tenant_a,
            }
        }

        result = await rag_node.execute(context)

        # Campos obrigatórios
        self.assertIn("query", result)
        self.assertIn("found_count", result)
        self.assertIn("chunks", result)
        self.assertIn("context_text", result)
        self.assertIn("output", result)
        
        # Novo campo de telemetria do critério de aceite
        self.assertEqual(result.get("search_mode"), "hybrid")
        self.assertEqual(result["found_count"], 1)
        self.assertIn("garantia estendida", result["context_text"])


if __name__ == "__main__":
    unittest.main()
