"""Runtime patches for twikit (X API format changes, 2026).

- ClientTransaction: KEY_BYTE / ondemand.s webpack format (PR #411)
- User.__init__: missing legacy fields (e.g. entities.description.urls)
"""

from __future__ import annotations

import re
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from twikit.client.client import Client

_TX_PATCHED = False
_USER_PATCHED = False


def apply_twikit_transaction_patch() -> None:
    global _TX_PATCHED
    if _TX_PATCHED:
        return

    tx_mod = __import__(
        "twikit.x_client_transaction.transaction",
        fromlist=["ClientTransaction"],
    )

    tx_mod.ON_DEMAND_FILE_REGEX = re.compile(
        r""",(\d+):["']ondemand\.s["']""",
        flags=(re.VERBOSE | re.MULTILINE),
    )
    tx_mod.ON_DEMAND_HASH_PATTERN = r',{}:["\']([0-9a-f]+)["\']'
    tx_mod.INDICES_REGEX = re.compile(
        r"""(\(\w{1}\[(\d{1,2})\],\s*16\))+""",
        flags=(re.VERBOSE | re.MULTILINE),
    )

    async def patched_get_indices(self, home_page_response, session, headers):
        key_byte_indices: list[str] = []
        response = self.validate_response(home_page_response) or self.home_page_response
        body = str(response)
        idx_match = tx_mod.ON_DEMAND_FILE_REGEX.search(body)
        if idx_match:
            chunk_idx = idx_match.group(1)
            hash_regex = re.compile(tx_mod.ON_DEMAND_HASH_PATTERN.format(chunk_idx))
            hash_match = hash_regex.search(body)
            if hash_match:
                on_demand_file_url = (
                    "https://abs.twimg.com/responsive-web/client-web/"
                    f"ondemand.s.{hash_match.group(1)}a.js"
                )
                on_demand_file_response = await session.request(
                    method="GET",
                    url=on_demand_file_url,
                    headers=headers,
                )
                for item in tx_mod.INDICES_REGEX.finditer(str(on_demand_file_response.text)):
                    key_byte_indices.append(item.group(2))

        if not key_byte_indices:
            raise Exception("Couldn't get KEY_BYTE indices")

        indices = list(map(int, key_byte_indices))
        return indices[0], indices[1:]

    tx_mod.ClientTransaction.get_indices = patched_get_indices
    _TX_PATCHED = True


def apply_twikit_user_patch() -> None:
    """Patch User parsing so one missing legacy field does not abort a fetch.

    Mirrors unclecode/twikit (May 2026): X drops fields from user legacy over time.
    """
    global _USER_PATCHED
    if _USER_PATCHED:
        return

    user_mod = __import__("twikit.user", fromlist=["User"])

    def patched_user_init(self: user_mod.User, client: Client, data: dict) -> None:
        self._client = client
        legacy = data.get("legacy") or {}
        core = data.get("core") or {}

        self.id: str = data.get("rest_id")
        self.created_at: str = legacy.get("created_at") or core.get("created_at")
        self.name: str = legacy.get("name") or core.get("name")
        self.screen_name: str = legacy.get("screen_name") or core.get("screen_name")
        self.profile_image_url: str = legacy.get("profile_image_url_https") or core.get(
            "profile_image_url_https"
        )
        self.profile_banner_url: str = legacy.get("profile_banner_url")
        self.url: str = legacy.get("url")
        self.location: str = legacy.get("location", "")
        self.description: str = legacy.get("description", "")

        entities = legacy.get("entities") or {}
        description_entities = entities.get("description") or {}
        self.description_urls: list = description_entities.get("urls", [])
        url_entities = entities.get("url") or {}
        self.urls: list = url_entities.get("urls", [])

        self.pinned_tweet_ids: list[str] = legacy.get("pinned_tweet_ids_str", [])
        self.is_blue_verified: bool = data.get("is_blue_verified", False)
        self.verified: bool = legacy.get("verified", False)
        self.possibly_sensitive: bool = legacy.get("possibly_sensitive", False)
        self.can_dm: bool = legacy.get("can_dm", False)
        self.can_media_tag: bool = legacy.get("can_media_tag", False)
        self.want_retweets: bool = legacy.get("want_retweets", False)
        self.default_profile: bool = legacy.get("default_profile", False)
        self.default_profile_image: bool = legacy.get("default_profile_image", False)
        self.has_custom_timelines: bool = legacy.get("has_custom_timelines", False)
        self.followers_count: int = legacy.get("followers_count", 0)
        self.fast_followers_count: int = legacy.get("fast_followers_count", 0)
        self.normal_followers_count: int = legacy.get("normal_followers_count", 0)
        self.following_count: int = legacy.get("friends_count", 0)
        self.favourites_count: int = legacy.get("favourites_count", 0)
        self.listed_count: int = legacy.get("listed_count", 0)
        self.media_count = legacy.get("media_count", 0)
        self.statuses_count: int = legacy.get("statuses_count", 0)
        self.is_translator: bool = legacy.get("is_translator", False)
        self.translator_type: str = legacy.get("translator_type", "none")
        self.withheld_in_countries: list[str] = legacy.get("withheld_in_countries", [])
        self.protected: bool = legacy.get("protected", False)

    user_mod.User.__init__ = patched_user_init
    _USER_PATCHED = True


def apply_twikit_patches() -> None:
    apply_twikit_transaction_patch()
    apply_twikit_user_patch()
