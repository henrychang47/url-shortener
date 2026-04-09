from sqids import Sqids

sqids = Sqids(min_length=6)


def encode_from_num(num: int) -> str:
    return sqids.encode([num])
