import tempfile
import unittest
from pathlib import Path

import chain


class ChainIntegrityTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        chain.DB_PATH = Path(self.tmp.name) / "trail.db"
        chain._SUPPRESS_FLAG_PATH = Path(self.tmp.name) / ".suppress_offhours"
        chain._DEMO_CAPTURE_PAUSE_PATH = Path(self.tmp.name) / ".pause_demo_capture"
        chain._ensure_db()

    def tearDown(self):
        self.tmp.cleanup()

    def _seed(self):
        chain.append_manual_event("CREATED", "demo/a.sh", "demo a", "CRITICAL", "Suspicious executable/script dropped (.sh)")
        chain.append_manual_event("MODIFIED", "demo/b.txt", "demo b", "CRITICAL", "Rapid mass modification detected (6 files in 10s) - ransomware-like pattern")
        chain.append_manual_event("DELETED", "demo/c.txt", "demo c", "CRITICAL", "Mass deletion burst detected (5 deletes in 15s)")

    def test_clean_chain_verifies(self):
        self._seed()
        result = chain.verify_chain()
        self.assertTrue(result["chain_valid"])
        self.assertEqual([e["status"] for e in result["events"]], ["OK"] * 4)

    def test_tampering_is_record_specific(self):
        self._seed()
        chain.tamper_event(2, "attacker changed the log")
        result = chain.verify_chain()
        self.assertFalse(result["chain_valid"])
        self.assertEqual([e["status"] for e in result["events"]], ["OK", "TAMPERED", "OK", "OK"])
        self.assertTrue(result["events"][2]["record_integrity_ok"])

    def test_restore_returns_chain_to_valid(self):
        self._seed()
        chain.tamper_event(2, "attacker changed the log")
        self.assertTrue(chain.restore_event(2))
        self.assertTrue(chain.verify_chain()["chain_valid"])


if __name__ == "__main__":
    unittest.main()
