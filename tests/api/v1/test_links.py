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
