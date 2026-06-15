"""Patch twikit ClientTransaction for X's 2026 webpack format change.

PyPI twikit 2.3.3 raises ``Couldn't get KEY_BYTE indices`` because X split
ondemand.s metadata into separate name/hash maps. This patch mirrors
unclecode/twikit and ryanstoic/twikit PR #411.
"""

from __future__ import annotations

import re

_PATCHED = False


def apply_twikit_transaction_patch() -> None:
    global _PATCHED
    if _PATCHED:
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
    _PATCHED = True
