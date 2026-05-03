from datetime import datetime, timedelta, timezone

import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio


class TestCreateLink:
    async def test_create_link_success(self, client: AsyncClient):
        """Normal creation — only original_url provided."""
        response = await client.post(
            "/v1/links", json={"original_url": "https://example.com"}
        )
        assert response.status_code == 201
        data = response.json()
        assert data["original_url"] == "https://example.com/"
        assert "code" in data
        assert len(data["code"]) >= 6
        assert data["click_count"] == 0
        assert data["expires_at"] is None

    async def test_create_link_with_expires_at(self, client: AsyncClient):
        """Creation with expiry date — expires_at should be in response."""
        expires_at = (datetime.now(timezone.utc) + timedelta(days=7)).isoformat()
        response = await client.post(
            "/v1/links",
            json={"original_url": "https://example.com", "expires_at": expires_at},
        )
        assert response.status_code == 201
        data = response.json()
        assert data["expires_at"] is not None

    async def test_create_link_invalid_url(self, client: AsyncClient):
        """Invalid URL string should return 422 Unprocessable Entity."""
        response = await client.post(
            "/v1/links", json={"original_url": "not-a-valid-url"}
        )
        assert response.status_code == 422


class TestLinkStats:
    async def test_link_stats_success(self, client: AsyncClient):
        """Stats for an existing link returns 200 with full link info."""
        create_response = await client.post(
            "/v1/links", json={"original_url": "https://example.com"}
        )
        code = create_response.json()["code"]

        response = await client.get(f"/v1/links/{code}/stats")
        assert response.status_code == 200
        data = response.json()
        assert data["code"] == code
        assert data["original_url"] == "https://example.com/"
        assert data["click_count"] == 0

    async def test_link_stats_not_found(self, client: AsyncClient):
        """Stats for a non-existent code returns 404."""
        response = await client.get("/v1/links/doesnotexist/stats")
        assert response.status_code == 404

    async def test_multiple_links_stats(self, client: AsyncClient):
        """Stats for multiple codes returns correct info for each."""
        response1 = await client.post(
            "/v1/links", json={"original_url": "https://example.com/1"}
        )
        code1 = response1.json()["code"]

        response2 = await client.post(
            "/v1/links", json={"original_url": "https://example.com/2"}
        )
        code2 = response2.json()["code"]

        stats_response = await client.get(f"/v1/links?codes={code1}&codes={code2}")
        assert stats_response.status_code == 200
        data = stats_response.json()
        assert len(data) == 2
        codes = {item["code"] for item in data}
        assert code1 in codes and code2 in codes

    async def test_multiple_links_stats_with_invalid_code(self, client: AsyncClient):
        """Stats with some valid and some invalid codes returns only valid ones."""
        response1 = await client.post(
            "/v1/links", json={"original_url": "https://example.com/1"}
        )
        code1 = response1.json()["code"]

        await client.post("/v1/links", json={"original_url": "https://example.com/2"})

        stats_response = await client.get(f"/v1/links?codes={code1}&codes=invalid")
        assert stats_response.status_code == 200
        data = stats_response.json()
        assert len(data) == 1
        assert data[0]["code"] == code1


class TestRedirect:
    async def test_redirect_success(self, client: AsyncClient):
        """Redirect for existing code returns 302 with correct Location header."""
        create_response = await client.post(
            "/v1/links", json={"original_url": "https://example.com"}
        )
        code = create_response.json()["code"]

        response = await client.get(f"/v1/{code}", follow_redirects=False)
        assert response.status_code == 302
        assert response.headers["location"] == "https://example.com/"

    async def test_redirect_not_found(self, client: AsyncClient):
        """Redirect for non-existent code returns 404."""
        response = await client.get("/v1/doesnotexist", follow_redirects=False)
        assert response.status_code == 404

    async def test_redirect_increments_click_count(self, client: AsyncClient):
        """After a redirect, click_count increases by 1 (background task runs synchronously in ASGI transport)."""
        create_response = await client.post(
            "/v1/links", json={"original_url": "https://example.com"}
        )
        code = create_response.json()["code"]

        await client.get(f"/v1/{code}", follow_redirects=False)

        stats_response = await client.get(f"/v1/links/{code}/stats")
        assert stats_response.json()["click_count"] == 1


class TestDeleteLink:
    async def test_delete_link_success(self, client: AsyncClient):
        """Deleting an existing link returns 204 No Content."""
        create_response = await client.post(
            "/v1/links", json={"original_url": "https://example.com"}
        )
        code = create_response.json()["code"]

        response = await client.delete(f"/v1/links/{code}")
        assert response.status_code == 204

    async def test_delete_link_not_found(self, client: AsyncClient):
        """Deleting a non-existent code returns 404."""
        response = await client.delete("/v1/links/doesnotexist")
        assert response.status_code == 404

    async def test_delete_link_then_get_stats(self, client: AsyncClient):
        """After deletion, stats endpoint returns 404."""
        create_response = await client.post(
            "/v1/links", json={"original_url": "https://example.com"}
        )
        code = create_response.json()["code"]

        await client.delete(f"/v1/links/{code}")

        stats_response = await client.get(f"/v1/links/{code}/stats")
        assert stats_response.status_code == 404


class TestCleanupExpired:
    async def test_cleanup_deletes_only_expired_links(self, client: AsyncClient):
        """Expired links are deleted; active links survive."""
        expired_at = (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat()
        await client.post(
            "/v1/links",
            json={"original_url": "https://expired.com", "expires_at": expired_at},
        )

        active_at = (datetime.now(timezone.utc) + timedelta(days=7)).isoformat()
        active_response = await client.post(
            "/v1/links",
            json={"original_url": "https://active.com", "expires_at": active_at},
        )
        active_code = active_response.json()["code"]

        response = await client.delete("/v1/links/expired")
        assert response.status_code == 200
        assert response.json() == {"deleted": 1}

        stats = await client.get(f"/v1/links/{active_code}/stats")
        assert stats.status_code == 200

    async def test_cleanup_returns_zero_when_none_expired(self, client: AsyncClient):
        """Returns 0 when no links have expired."""
        response = await client.delete("/v1/links/expired")
        assert response.status_code == 200
        assert response.json() == {"deleted": 0}
