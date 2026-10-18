"""API integration tests use a fake detector; these do not measure recognition."""
import base64
import threading
import time
import unittest
from unittest.mock import patch
from fastapi.testclient import TestClient
import app as server

class IntegrationTests(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(server.app)
        self.headers = {"X-API-Key": server.API_KEY}
    def submit(self, data=b"video"):
        return self.client.post("/api/v1/analyze", headers=self.headers, files={"file": ("test.mov", data, "video/quicktime")})
    def wait(self, job_id):
        for _ in range(100):
            result = self.client.get("/api/v1/jobs/" + job_id, headers=self.headers).json()
            if result["status"] != "processing":
                return result
            time.sleep(.01)
        self.fail("worker did not finish")
    def test_auth_on_both_routes_and_health(self):
        self.assertEqual(self.client.get("/api/v1/jobs/unknown").status_code, 401)
        self.assertEqual(self.client.post("/api/v1/analyze", files={"file": ("x.mov", b"x")}).status_code, 401)
        self.assertEqual(self.client.get("/api/v1/health").status_code, 401)
    def test_health_requires_available_model(self):
        with patch.object(server, "model_health", return_value={"ready": False, "reason": "ollama_unavailable"}):
            self.assertFalse(self.client.get("/api/v1/health", headers=self.headers).json()["ready"])
            self.assertEqual(self.submit().status_code, 503)
    def test_clean_and_failed_are_distinct(self):
        for status in ("done", "failed"):
            def detector(path, *, job_id, accepted_at):
                self.assertLess(time.perf_counter() - accepted_at, 2)
                result = {"job_id": job_id, "status": status}
                if status == "done": result.update(verdict="no_violation", violations=[])
                return result
            with patch.object(server, "model_health", return_value={"ready": True}), patch.object(server, "analyze_video", side_effect=detector):
                response = self.submit()
                self.assertEqual(response.status_code, 200)
                result = self.wait(response.json()["job_id"])
                self.assertEqual(result["status"], status)
                if status == "failed": self.assertNotIn("verdict", result)
    def test_busy_is_rejected_and_upload_is_cleaned(self):
        entered, release = threading.Event(), threading.Event()
        def detector(path, *, job_id, accepted_at):
            entered.set(); release.wait(3)
            return {"job_id": job_id, "status": "failed"}
        with patch.object(server, "model_health", return_value={"ready": True}), patch.object(server, "analyze_video", side_effect=detector):
            first = self.submit().json()["job_id"]
            self.assertTrue(entered.wait(1))
            try: self.assertEqual(self.submit().status_code, 429)
            finally: release.set()
            self.wait(first)
        for _ in range(100):
            if not list(server.UPLOADS.glob(first + "*")): break
            time.sleep(.01)
        self.assertFalse(list(server.UPLOADS.glob(first + "*")))
    def test_deadline_does_not_return_clean(self):
        key = "expired-test"
        with server.LOCK:
            server.JOBS[key] = {"job_id": key, "status": "processing", "_accepted_at": time.perf_counter() - 281}
        self.assertEqual(self.client.get("/api/v1/jobs/" + key, headers=self.headers).json(), {"job_id": key, "status": "failed"})
    def test_video_validation(self):
        self.assertEqual(self.client.post("/api/v1/analyze", headers=self.headers, files={"file": ("x.txt", b"x")}).status_code, 415)
        with patch.object(server, "model_health", return_value={"ready": True}):
            self.assertEqual(self.submit(b"").status_code, 400)
    def test_public_bootstrap_never_discloses_key(self):
        response = self.client.get("/api/local-config.js", headers={"host": "jury.example.com", "cf-connecting-ip": "203.0.113.1"})
        self.assertEqual(response.status_code, 200)
        self.assertNotIn(server.API_KEY, response.text)
        response = self.client.get("/api/local-config.js", headers={"cf-connecting-ip": "203.0.113.1"})
        self.assertNotIn(server.API_KEY, response.text)
    def test_local_bootstrap_and_static_site(self):
        response = self.client.get("/api/local-config.js")
        self.assertEqual(response.status_code, 200)
        self.assertIn("no-store", response.headers["cache-control"])
        self.assertEqual(self.client.get("/api/local-config.js", headers={"sec-fetch-site": "cross-site"}).status_code, 403)
        self.assertIn("ARGUS", self.client.get("/").text)

if __name__ == "__main__": unittest.main()
