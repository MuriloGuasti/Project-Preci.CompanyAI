import asyncio
import os
import sys
import unittest
from datetime import datetime, timezone

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.core.config import settings
from app.db.supabase_client import db
from app.models.schemas import AgentNode, AgentEdge
from app.services.agents.executor import (
    WorkflowEngine,
    execute_agent_workflow,
    resume_workflow_execution,
    detect_inter_agent_cycle,
    NodeRegistry,
)
from app.workers.scheduler_tick import (
    validate_cron_expression,
    get_due_schedules,
    scheduler_tick,
)
from app.api.routes.agents import validate_agent_topology
from fastapi import HTTPException


class TestNewAgentNodes(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self._orig_google_key = settings.GOOGLE_API_KEY
        self._orig_openai_key = settings.OPENAI_API_KEY
        settings.GOOGLE_API_KEY = ""
        settings.OPENAI_API_KEY = ""

        # Setup test company and users
        self.company_id = "00000000-0000-0000-0000-000000000001"
        self.other_company_id = "00000000-0000-0000-0000-000000000002"
        self.admin_user = {
            "id": "admin-1",
            "company_id": self.company_id,
            "role": "admin",
            "full_name": "Admin Test",
            "email": "admin@preci.local",
        }
        self.member_user = {
            "id": "member-1",
            "company_id": self.company_id,
            "role": "member",
            "full_name": "Member Test",
            "email": "member@preci.local",
        }

        # Clear mock tables
        db.agents.clear()
        db.agent_schedules.clear()
        db.agent_executions.clear()

    # ==========================================
    # 1. LoopNode Tests
    # ==========================================
    async def test_loop_node_append_strategy(self):
        """Test LoopNode iterating over an array with append strategy, injecting loop.item and loop.index."""
        agent_data = {
            "id": "agent-loop-append",
            "name": "Loop Append Test",
            "company_id": self.company_id,
            "created_by": self.admin_user["id"],
            "status": "published",
            "nodes": [
                {
                    "id": "trigger-1",
                    "type": "trigger",
                    "label": "Start",
                    "position": {"x": 0, "y": 0},
                    "config": {"trigger_type": "manual"},
                },
                {
                    "id": "code-prep",
                    "type": "code",
                    "label": "Prep List",
                    "position": {"x": 100, "y": 0},
                    "config": {
                        "code": "result = {'items': ['alpha', 'beta', 'gamma']}"
                    },
                },
                {
                    "id": "loop-1",
                    "type": "loop",
                    "label": "Process Items",
                    "position": {"x": 200, "y": 0},
                    "config": {
                        "input_array_field": "items",
                        "max_iterations": 10,
                        "collect_strategy": "append",
                    },
                },
                {
                    "id": "code-step",
                    "type": "code",
                    "label": "Transform Item",
                    "position": {"x": 300, "y": 0},
                    "config": {
                        "code": "result = f'Processed {context.get(\"loop.item\")} at idx {context.get(\"loop.index\")}'"
                    },
                },
                {
                    "id": "output-node",
                    "type": "output",
                    "label": "Final Output",
                    "position": {"x": 400, "y": 0},
                    "config": {"response_format": "text"},
                },
            ],
            "edges": [
                {"id": "e1", "source_node_id": "trigger-1", "target_node_id": "code-prep"},
                {"id": "e2", "source_node_id": "code-prep", "target_node_id": "loop-1"},
                {
                    "id": "e3",
                    "source_node_id": "loop-1",
                    "target_node_id": "code-step",
                    "source_handle": "loop_body",
                },
                {
                    "id": "e4",
                    "source_node_id": "code-step",
                    "target_node_id": "loop-1",
                    "edge_type": "loop_back",
                },
                {
                    "id": "e5",
                    "source_node_id": "loop-1",
                    "target_node_id": "output-node",
                    "source_handle": "loop_complete",
                },
            ],
        }

        result = await execute_agent_workflow(agent_data, current_user=self.admin_user)
        self.assertIn(result["status"], ["success", "completed"])

        loop_res = result["node_results"]["loop-1"]
        self.assertEqual(loop_res["iteration_count"], 3)
        self.assertIsInstance(loop_res["collected_output"], list)
        self.assertEqual(len(loop_res["collected_output"]), 3)
        self.assertEqual(loop_res["collected_output"][0], "Processed alpha at idx 0")
        self.assertEqual(loop_res["collected_output"][1], "Processed beta at idx 1")
        self.assertEqual(loop_res["collected_output"][2], "Processed gamma at idx 2")

    async def test_loop_node_last_strategy(self):
        """Test LoopNode iterating with last collect_strategy."""
        agent_data = {
            "id": "agent-loop-last",
            "name": "Loop Last Test",
            "company_id": self.company_id,
            "created_by": self.admin_user["id"],
            "status": "published",
            "nodes": [
                {
                    "id": "trigger-1",
                    "type": "trigger",
                    "label": "Start",
                    "position": {"x": 0, "y": 0},
                    "config": {"trigger_type": "manual"},
                },
                {
                    "id": "code-prep",
                    "type": "code",
                    "label": "Prep List",
                    "position": {"x": 100, "y": 0},
                    "config": {
                        "code": "result = {'numbers': [10, 20, 30]}"
                    },
                },
                {
                    "id": "loop-1",
                    "type": "loop",
                    "label": "Sum Numbers",
                    "position": {"x": 200, "y": 0},
                    "config": {
                        "input_array_field": "numbers",
                        "max_iterations": 10,
                        "collect_strategy": "last",
                    },
                },
                {
                    "id": "code-calc",
                    "type": "code",
                    "label": "Double",
                    "position": {"x": 300, "y": 0},
                    "config": {
                        "code": "result = context.get('loop.item') * 2"
                    },
                },
            ],
            "edges": [
                {"id": "e1", "source_node_id": "trigger-1", "target_node_id": "code-prep"},
                {"id": "e2", "source_node_id": "code-prep", "target_node_id": "loop-1"},
                {"id": "e3", "source_node_id": "loop-1", "target_node_id": "code-calc", "source_handle": "loop_body"},
                {"id": "e4", "source_node_id": "code-calc", "target_node_id": "loop-1", "edge_type": "loop_back"},
            ],
        }

        result = await execute_agent_workflow(agent_data, current_user=self.admin_user)
        self.assertIn(result["status"], ["success", "completed"])
        loop_res = result["node_results"]["loop-1"]
        self.assertEqual(loop_res["iteration_count"], 3)
        self.assertEqual(loop_res["collected_output"], 60)

    async def test_loop_node_hard_cap_50(self):
        """Test LoopNode halts at 50 iterations even when input array has 60 items."""
        agent_data = {
            "id": "agent-loop-cap",
            "name": "Loop Cap Test",
            "company_id": self.company_id,
            "created_by": self.admin_user["id"],
            "status": "published",
            "nodes": [
                {
                    "id": "trigger-1",
                    "type": "trigger",
                    "label": "Start",
                    "position": {"x": 0, "y": 0},
                    "config": {"trigger_type": "manual"},
                },
                {
                    "id": "code-prep",
                    "type": "code",
                    "label": "Prep Big List",
                    "position": {"x": 100, "y": 0},
                    "config": {
                        "code": "result = {'big_list': list(range(60))}"
                    },
                },
                {
                    "id": "loop-1",
                    "type": "loop",
                    "label": "Loop 60",
                    "position": {"x": 200, "y": 0},
                    "config": {
                        "input_array_field": "big_list",
                        "max_iterations": 100,  # exceeds hard cap of 50
                        "collect_strategy": "append",
                    },
                },
                {
                    "id": "code-step",
                    "type": "code",
                    "label": "Step",
                    "position": {"x": 300, "y": 0},
                    "config": {
                        "code": "result = context.get('loop.item')"
                    },
                },
            ],
            "edges": [
                {"id": "e1", "source_node_id": "trigger-1", "target_node_id": "code-prep"},
                {"id": "e2", "source_node_id": "code-prep", "target_node_id": "loop-1"},
                {"id": "e3", "source_node_id": "loop-1", "target_node_id": "code-step", "source_handle": "loop_body"},
                {"id": "e4", "source_node_id": "code-step", "target_node_id": "loop-1", "edge_type": "loop_back"},
            ],
        }

        result = await execute_agent_workflow(agent_data, current_user=self.admin_user)
        self.assertIn(result["status"], ["success", "completed"])
        loop_res = result["node_results"]["loop-1"]
        self.assertEqual(loop_res["iteration_count"], 50)
        self.assertEqual(len(loop_res["collected_output"]), 50)

    def test_nested_loops_rejection_guardrail(self):
        """Test validate_agent_topology rejects nested loops."""
        nodes = [
            {"id": "trigger-1", "type": "trigger"},
            {"id": "loop-outer", "type": "loop"},
            {"id": "loop-inner", "type": "loop"},
            {"id": "code-1", "type": "code"},
        ]
        edges = [
            {"id": "e1", "source_node_id": "trigger-1", "target_node_id": "loop-outer"},
            {"id": "e2", "source_node_id": "loop-outer", "target_node_id": "loop-inner", "source_handle": "loop_body"},
            {"id": "e3", "source_node_id": "loop-inner", "target_node_id": "code-1", "source_handle": "loop_body"},
            {"id": "e4", "source_node_id": "code-1", "target_node_id": "loop-inner", "edge_type": "loop_back"},
            {"id": "e5", "source_node_id": "loop-inner", "target_node_id": "loop-outer", "edge_type": "loop_back"},
        ]
        with self.assertRaises(HTTPException) as ctx:
            validate_agent_topology("test-agent", nodes, edges, self.company_id)
        self.assertEqual(ctx.exception.status_code, 400)
        self.assertIn("Loops aninhados não são permitidos", ctx.exception.detail)

    # ==========================================
    # 2. ScheduleTrigger & Cron Tests
    # ==========================================
    def test_cron_validation_guardrail(self):
        """Test cron expression validation: accepts valid >= 5m, rejects invalid or < 5m."""
        # 10 minutes interval: should be valid
        ok, err, next_dt = validate_cron_expression("*/10 * * * *")
        self.assertTrue(ok)
        self.assertIsNone(err)
        self.assertIsNotNone(next_dt)

        # 1 minute interval: must be rejected by 5-minute guardrail
        ok_rapid, err_rapid, _ = validate_cron_expression("* * * * *")
        self.assertFalse(ok_rapid)
        self.assertIn("intervalo mínimo permitido entre execuções é de 5 minutos", err_rapid)

        # Invalid syntax
        ok_bad, err_bad, _ = validate_cron_expression("not-a-cron")
        self.assertFalse(ok_bad)
        self.assertIn("inválida", err_bad)

    async def test_scheduler_tick_execution(self):
        """Test get_due_schedules and scheduler_tick executing due schedules."""
        # Register an agent
        agent_id = "agent-sched-target"
        db.agents[agent_id] = {
            "id": agent_id,
            "company_id": self.company_id,
            "created_by": self.admin_user["id"],
            "name": "Scheduled Agent",
            "status": "published",
            "nodes": [
                {"id": "n1", "type": "trigger", "label": "Start", "config": {}},
                {"id": "n2", "type": "code", "label": "Run", "config": {"code": "result = 'ran_by_cron'"}},
            ],
            "edges": [{"id": "e1", "source_node_id": "n1", "target_node_id": "n2"}],
        }

        # Register schedule with next_run_at in the past
        sched_id = "sched-due-1"
        past_time = datetime(2026, 1, 1, 12, 0, 0, tzinfo=timezone.utc)
        db.agent_schedules[sched_id] = {
            "id": sched_id,
            "agent_id": agent_id,
            "company_id": self.company_id,
            "cron_expression": "*/10 * * * *",
            "timezone": "America/Sao_Paulo",
            "is_active": True,
            "last_run_at": None,
            "next_run_at": past_time,
            "created_by": self.admin_user["id"],
            "created_at": past_time,
        }

        due = await get_due_schedules()
        self.assertEqual(len(due), 1)
        self.assertEqual(due[0]["id"], sched_id)

        count = await scheduler_tick()
        self.assertEqual(count, 1)

        # Verify next_run_at was updated to future
        sched = db.agent_schedules[sched_id]
        self.assertIsNotNone(sched["last_run_at"])
        self.assertGreater(sched["next_run_at"], past_time)

    # ==========================================
    # 3. HumanApprovalNode Tests
    # ==========================================
    async def test_human_approval_pause_and_approve(self):
        """Test workflow pauses at HumanApprovalNode, saves state snapshot, and resumes upon approval."""
        agent_data = {
            "id": "agent-approval-flow",
            "name": "Approval Agent",
            "company_id": self.company_id,
            "created_by": self.admin_user["id"],
            "status": "published",
            "nodes": [
                {
                    "id": "trigger-1",
                    "type": "trigger",
                    "label": "Start",
                    "position": {"x": 0, "y": 0},
                    "config": {"trigger_type": "manual"},
                },
                {
                    "id": "code-before",
                    "type": "code",
                    "label": "Prepare Payload",
                    "position": {"x": 100, "y": 0},
                    "config": {"code": "result = {'invoice_id': 999, 'amount': 1500}"},
                },
                {
                    "id": "approval-1",
                    "type": "human_approval",
                    "label": "Authorize Payment",
                    "position": {"x": 200, "y": 0},
                    "config": {
                        "prompt": "Favor autorizar o pagamento de R$ 1.500",
                        "assigned_roles": ["admin"],
                    },
                },
                {
                    "id": "code-after",
                    "type": "code",
                    "label": "Complete Payment",
                    "position": {"x": 300, "y": 0},
                    "config": {"code": "result = {'status': 'paid', 'approved': True}"},
                },
            ],
            "edges": [
                {"id": "e1", "source_node_id": "trigger-1", "target_node_id": "code-before"},
                {"id": "e2", "source_node_id": "code-before", "target_node_id": "approval-1"},
                {"id": "e3", "source_node_id": "approval-1", "target_node_id": "code-after"},
            ],
        }

        # 1. Execute initial run
        result = await execute_agent_workflow(agent_data, current_user=self.admin_user)
        self.assertEqual(result["status"], "waiting_approval")

        # Find the execution record in db
        exec_id = None
        for eid, rec in db.agent_executions.items():
            if rec.get("agent_id") == "agent-approval-flow":
                exec_id = eid
                break

        self.assertIsNotNone(exec_id)
        exec_rec = db.agent_executions[exec_id]
        self.assertEqual(exec_rec["status"], "waiting_approval")
        self.assertIsNotNone(exec_rec.get("state"))
        self.assertEqual(exec_rec["state"]["pending_approval_node_id"], "approval-1")

        # 2. Member cannot approve (RBAC check)
        with self.assertRaises(PermissionError):
            await resume_workflow_execution(exec_id, action="approve", current_user=self.member_user)

        # 3. Admin approves
        resumed = await resume_workflow_execution(
            exec_id,
            action="approve",
            reason_or_note="Aprovado pelo diretor",
            current_user=self.admin_user,
        )
        self.assertIn(resumed["status"], ["success", "completed"])
        self.assertIn("code-after", resumed["node_results"])
        self.assertEqual(resumed["node_results"]["code-after"]["output"]["status"], "paid")

    async def test_human_approval_reject(self):
        """Test rejecting an execution transitions status to failed and halts remaining nodes."""
        agent_data = {
            "id": "agent-approval-reject",
            "name": "Approval Reject Agent",
            "company_id": self.company_id,
            "created_by": self.admin_user["id"],
            "status": "published",
            "nodes": [
                {"id": "t1", "type": "trigger", "label": "Start", "config": {}},
                {"id": "app1", "type": "human_approval", "label": "Gate", "config": {}},
                {"id": "c1", "type": "code", "label": "Never Run", "config": {"code": "result = 'should_not_run'"}},
            ],
            "edges": [
                {"id": "e1", "source_node_id": "t1", "target_node_id": "app1"},
                {"id": "e2", "source_node_id": "app1", "target_node_id": "c1"},
            ],
        }

        result = await execute_agent_workflow(agent_data, current_user=self.admin_user)
        self.assertEqual(result["status"], "waiting_approval")

        exec_id = list(db.agent_executions.keys())[-1]
        rejected = await resume_workflow_execution(
            exec_id,
            action="reject",
            reason_or_note="Dados inconsistentes",
            current_user=self.admin_user,
        )
        self.assertIn(rejected["status"], ["rejected", "failed"])
        self.assertNotIn("c1", rejected["node_results"])
        self.assertEqual(rejected["rejection_reason"], "Dados inconsistentes")

    # ==========================================
    # 4. SubAgentNode Tests
    # ==========================================
    async def test_sub_agent_execution_success(self):
        """Test SubAgentNode successfully executes a child agent and maps output."""
        # 1. Register Child Agent
        child_id = "agent-child-1"
        db.agents[child_id] = {
            "id": child_id,
            "name": "Child Agent",
            "company_id": self.company_id,
            "created_by": self.admin_user["id"],
            "status": "published",
            "nodes": [
                {"id": "c-trig", "type": "trigger", "label": "Start", "config": {}},
                {
                    "id": "c-code",
                    "type": "code",
                    "label": "Process",
                    "config": {
                        "code": "result = {'score': context.get('val', 10) * 5}"
                    },
                },
            ],
            "edges": [{"id": "ce1", "source_node_id": "c-trig", "target_node_id": "c-code"}],
        }

        # 2. Register Parent Agent
        parent_agent = {
            "id": "agent-parent-1",
            "name": "Parent Agent",
            "company_id": self.company_id,
            "created_by": self.admin_user["id"],
            "status": "published",
            "nodes": [
                {"id": "p-trig", "type": "trigger", "label": "Start", "config": {}},
                {
                    "id": "p-sub",
                    "type": "sub_agent",
                    "label": "Call Child",
                    "config": {
                        "target_agent_id": child_id,
                        "input_mapping": {"val": 7},
                        "output_mapping": "child_result",
                    },
                },
            ],
            "edges": [{"id": "pe1", "source_node_id": "p-trig", "target_node_id": "p-sub"}],
        }

        result = await execute_agent_workflow(parent_agent, current_user=self.admin_user)
        self.assertIn(result["status"], ["success", "completed"])

        sub_res = result["node_results"]["p-sub"]
        self.assertIn(sub_res["status"], ["success", "completed"])
        self.assertEqual(sub_res["sub_agent_id"], child_id)
        self.assertIn("c-code", sub_res["sub_agent_results"])
        self.assertEqual(sub_res["sub_agent_results"]["c-code"]["score"], 35)

    async def test_sub_agent_tenant_isolation(self):
        """Test SubAgentNode fails when attempting to call an agent from another company."""
        foreign_id = "agent-foreign-9"
        db.agents[foreign_id] = {
            "id": foreign_id,
            "name": "Foreign Agent",
            "company_id": self.other_company_id,
            "created_by": "other-user",
            "status": "published",
            "nodes": [],
            "edges": [],
        }

        parent_agent = {
            "id": "agent-tenant-breach",
            "name": "Attacker Agent",
            "company_id": self.company_id,
            "created_by": self.admin_user["id"],
            "status": "published",
            "nodes": [
                {"id": "t1", "type": "trigger", "label": "Start", "config": {}},
                {
                    "id": "s1",
                    "type": "sub_agent",
                    "label": "Call Foreign",
                    "config": {"target_agent_id": foreign_id},
                },
            ],
            "edges": [{"id": "e1", "source_node_id": "t1", "target_node_id": "s1"}],
        }

        result = await execute_agent_workflow(parent_agent, current_user=self.admin_user)
        self.assertIn(result["status"], ["error", "failed"])
        err_msg = result["node_results"]["s1"].get("error_message") or result["node_results"]["s1"].get("error", "")
        self.assertTrue(
            "outra empresa" in err_msg.lower() or "acesso negado" in err_msg.lower() or "permissão" in err_msg.lower()
        )

    def test_inter_agent_cycle_detection(self):
        """Test detect_inter_agent_cycle detects direct and indirect circular references between agents."""
        # A calls B
        db.agents["agent-A"] = {
            "id": "agent-A",
            "company_id": self.company_id,
            "nodes": [{"id": "n1", "type": "sub_agent", "config": {"target_agent_id": "agent-B"}}],
        }
        # B calls C
        db.agents["agent-B"] = {
            "id": "agent-B",
            "company_id": self.company_id,
            "nodes": [{"id": "n1", "type": "sub_agent", "config": {"target_agent_id": "agent-C"}}],
        }

        # Saving C calling A creates a cycle: C -> A -> B -> C
        new_nodes_for_C = [{"id": "n1", "type": "sub_agent", "config": {"target_agent_id": "agent-A"}}]
        cycle = detect_inter_agent_cycle("agent-C", new_nodes_for_C, self.company_id)
        self.assertIsNotNone(cycle)
        self.assertIn("agent-C", cycle)
        self.assertIn("agent-A", cycle)

        # Topology validation raises HTTPException 400
        with self.assertRaises(HTTPException) as ctx:
            validate_agent_topology("agent-C", new_nodes_for_C, [], self.company_id)
        self.assertEqual(ctx.exception.status_code, 400)
        self.assertIn("Ciclo de dependência circular detectado", ctx.exception.detail)


if __name__ == "__main__":
    unittest.main()
